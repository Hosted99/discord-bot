const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния
const fs = require('fs');
const path = require('path');
// Пътят отива една папка нагоре и влиза в 'data'
const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

// Глобални променливи за модула
let currentPlanMsgId = null;
let strategyMsgObject = null;
let lastVotedString = ""; // Помни последното състояние на гласовете

// Проверка дали cron изразът е валиден
const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

/**
 * Инициализира всички автоматични таймери (Cron Jobs)
 */
function initSchedulers(client, pool) {
    // 1. СТАТИЧНИ НАПОМНЯНИЯ
    staticList.forEach(rem => { 
        if (!isValidCron(rem.cron)) return;

        cron.schedule(rem.cron, () => {
            client.guilds.cache.forEach(async (guild) => {
                const ch = guild.channels.cache.find(c => c.name === "reminders");
                if (ch) {
                    const mention = await getMention(guild, rem.target);
                    const finalMsg = typeof rem.message === 'function' ? rem.message() : rem.message;
                    ch.send(`${mention} ${finalMsg}`);
                }
            });
        }, { timezone: "Europe/London" });
    });

    // 2. ДИНАМИЧНИ НАПОМНЯНИЯ (от база данни)
    pool.query("SELECT * FROM reminders").then(res => {
        res.rows.forEach(rem => {
            if (!isValidCron(rem.cron)) return;

            cron.schedule(rem.cron, () => {
                const ch = client.channels.cache.get(rem.channel_id);
                if (ch) ch.send(rem.message);
            }, { timezone: "Europe/London" });
        });
    });
}

/**
 * ПУСКАНЕ НА ПЛАН (mania-plan)
 */
async function handleManiaPlan(msg) {
    const MAIN_CHANNEL_ID = '1486343047632523398'; 

    // --- НАСТРОЙКИ ЗА ГИЛДИИТЕ ---
    const ROLES = {
        'g1': '1490805399010545794', 
        'g2': '1490805404710469642'  
    };

    const args = msg.content.split(' ');
    const guildType = args[1] ? args[1].toLowerCase() : null;

    if (!guildType || !ROLES[guildType]) {
        return msg.reply("❌ Моля, посочи гилдия! Използвай: `!mania-plan g1` или `!mania-plan g2`").then(m => setTimeout(() => m.delete(), 5000));
    }

    // ТУК Е ПРОМЯНАТА: Пингваме и everyone, и ролята
    const targetRolePing = `<@&${ROLES[guildType]}>`;
    const fullPing = `@everyone (${targetRolePing})`; // Комбиниран пинг
    const guildName = guildType.toUpperCase();

    const planEmbed = new EmbedBuilder()
        .setTitle(`⚔️ MANIA FORMATION - ${guildName}`)
        .setDescription(`${fullPing} Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play`)
        .setColor(guildType === 'g1' ? "#00FF00" : "#0099FF");

    const planMsg = await msg.channel.send({ 
        content: fullPing, // Пингът извън ембеда, за да светне нотификацията
        embeds: [planEmbed] 
    });
    
    await planMsg.react("✅");
    await planMsg.react("❌");
    
    fs.writeFileSync(DB_PATH, JSON.stringify({ planId: planMsg.id }, null, 2));
    lastVotedString = "";

    try {
        const mainChannel = msg.client.channels.cache.get(MAIN_CHANNEL_ID);
        if (mainChannel) {
            // Пингваме everyone и в главния канал за съответната гилдия
            await mainChannel.send(`🚨 **@everyone A new Mania Plan for ${targetRolePing} has been posted in: ${planMsg.url}**`);
        }
    } catch (error) {
        console.error("Не можах да пратя съобщение в главния канал:", error);
    }

    if (msg.deletable) await msg.delete().catch(() => {});
}

/**
 * СПИСЪК НА ПОТВЪРДИЛИТЕ (mania-list)
 */
async function handleManiaList(msg) {

    // 1.1. ID НА ГЛАВНИЯ ЧАТ (Където ще отиде "push" известието)
    const MAIN_CHANNEL_ID = '1486343047632523398';
    
    // 1. Проверяваме дали има активен план в базата данни (файла)
    let planData = { planId: null };
    if (fs.existsSync(DB_PATH)) {
        planData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }

    if (!planData.planId) return msg.reply("❌ No active plan found!");

    try {
        // Опитваме се да намерим оригиналното съобщение на плана
        const planMsg = await msg.channel.messages.fetch(planData.planId).catch(() => null);
        if (!planMsg) return msg.reply("❌ Original plan not found!");

        // 2. Събираме хората, гласували с ✅
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // Събираме хората, гласували с ❌
        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 3. Намираме тези, които все още не са гласували
        const allMembers = await msg.guild.members.fetch();
        const votedIds = [...usersYes.keys(), ...usersNo.keys()];
        
        // Филтрираме: да не е бот, да има поне една роля и да не е в списъка на гласувалите
        const missing = allMembers.filter(m => 
            !m.user.bot && 
            m.roles.cache.size > 1 && 
            !votedIds.includes(m.id)
        ).map(m => `<@${m.id}>`);

        // 4. Създаваме Embed-а със статуса (визуалната таблица)
        const statusEmbed = new EmbedBuilder()
            .setTitle("⚔️ CURRENT FORMATION STATUS")
            .setDescription("The original plan is still active above! 👆")
            .setColor("#3498db")
            .addFields(
                { name: `✅ CONFIRMED (${confirmed.length})`, value: confirmed.join(", ") || "None yet", inline: false },
                { name: `❌ DECLINED (${declined.length})`, value: declined.join(", ") || "None", inline: false }
            );

        // Пращаме Embed-а в mania-reminder канала
        await msg.channel.send({ embeds: [statusEmbed] });

        // 5. Проверка дали има липсващи гласове
        if (missing.length > 0) {
            const missingText = missing.join(" "); // Правим списъка с пингове на един ред
            
            // Пращаме списъка в текущия канал (mania-reminder)
            await msg.channel.send(`🔔 **Attention!** These players haven't voted:\n${missingText}`);
        
            // 6. ИЗВЕСТИЕ В ГЛАВНИЯ КАНАЛ (за да ги "светне" по телефона)
            try {
                // Търсим канала директно през API-то на Discord за по-сигурно
                const mainChannel = await msg.client.channels.fetch(MAIN_CHANNEL_ID).catch(() => null);
                if (mainChannel) {
                    await mainChannel.send(`🚨 **MANDATORY ATTENTION!** 🚨\n\nThese players still need to vote for the Mania: ${missingText}\n\nGo to <#${msg.channel.id}> now!`);
                } else {
                    console.error("Грешка: Главният канал не е намерен. Провери ID-то!");
                }
            } catch (err) {
                console.error("Грешка при пращане в главния канал:", err);
            }
        
        } else {
            // Ако всички са гласували
            await msg.channel.send("✅ Everyone has voted!");
        }

        // Изтриваме командата на потребителя (mania-list), за да е чист чата
        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (e) {
        console.error("Грешка в mania-list:", e);
        msg.reply("Error fetching player lists.");
    }
}





/**
 * ПУБЛИКУВАНЕ НА СТРАТЕГИЯ (mania-strategy)
 */
async function handleManiaStrategy(msg, pool) {
    const { EmbedBuilder } = require('discord.js');
    const rawContent = msg.content.replace(/mania-strategy/gi, "").trim();
    if (!rawContent) return;

    const strategyGifs = [
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3kxYzJmN3N2MTNqNzI4ZHk5dXVldWI3cjdvMndjdnJmMWN3bmdzdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QfD1Hv15WwflPZeeWF/giphy.gif",
        "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExODVhMWpwY3h6OGk5OW1ldDJucDVjZXp5ZjloNG82OW1pNjh0NDF1biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Muqc4t03A8sz4ksa5i/giphy.gif",
        "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzljYXR6cTQ2aWtrc25lbXljenVmMTN4YjdhMXcyNmJjeWdoZW1ueiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Rz24pRStq8KaEwz9c6/giphy.gif"
    ];
    const randomGif = strategyGifs[Math.floor(Math.random() * strategyGifs.length)];

    const lines = rawContent.split('\n').filter(l => l.trim() !== "");
    
    const stratEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ DAILY BATTLE STRATEGY")
        .setDescription("All pirates to your positions!")
        .setColor("#FF4500")
        .setImage(randomGif)
        .setTimestamp();

    // Брояч за колоните
    let fieldCount = 0;

    lines.forEach((line) => {
        if (line.includes('-')) {
            const firstDashIndex = line.indexOf('-');
            const boss = line.substring(0, firstDashIndex).trim().toUpperCase();
            const playersPart = line.substring(firstDashIndex + 1).trim();

            let players = playersPart
                .split(/(?=\s@)|(?<=me),?\s*/) 
                .map(p => p.trim())
                .filter(p => p.length > 0);

            if (players.length > 0) {
                stratEmbed.addFields({
                    name: `⚔️ ${boss}`,
                    value: `• ${players.join('\n• ')}`,
                    inline: true
                });

                fieldCount++;

                // На всеки 3 боса добавяме "инстант прекъсване", за да подредим следващия ред
                if (fieldCount % 3 === 0) {
                    // Това невидимо поле гарантира, че следващите 3 ще са точно отдолу
                    // stratEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false }); // Може да се махне, ако имената са много къси
                }
            }
        }
    });

    // Запис в DB
    await pool.query(`
        INSERT INTO global_vars (key, value) 
        VALUES ('last_strategy', $1) 
        ON CONFLICT (key) 
        DO UPDATE SET value = EXCLUDED.value
    `, [rawContent]);

    await msg.channel.send({ 
        content: "@everyone 🚩 **TODAY'S TARGETS 👑 !**", 
        embeds: [stratEmbed] 
    });

    if (typeof currentPlanMsgId !== 'undefined') currentPlanMsgId = null; 
    if (msg.deletable) await msg.delete().catch(() => {});
}




/**
 * Функция за взимане на mention (role или everyone)
 */
async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target;
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
    if (role) return `<@&${role.id}>`;
    return target;
}

/**
 * Експортираме всички функции в един обект
 */
module.exports = { initSchedulers, isValidCron, handleManiaPlan, handleManiaList, handleManiaStrategy,getMention 
};
