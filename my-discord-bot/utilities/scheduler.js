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
 * ГЛАВНА ФУНКЦИЯ ЗА ОБРАБОТКА НА КОМАНДАТА mania-plan
 */
async function handleManiaPlan(msg) {
    // Правим целия текст малък и махаме излишни интервали
    const content = msg.content.toLowerCase().trim();
    
    // ID на главния канал за известия
    const MAIN_CHANNEL_ID = '1486343047632523398'; 

    // --- НАСТРОЙКИ НА РОЛИТЕ ---
    // ЗАМЕНИ ТЕЗИ ЧИСЛА С РЕАЛНИТЕ ID-ТА ОТ ТВОЯ СЪРВЪР
    const ROLES = {
        'g1': '1490805399010545794', // ID на Роля за Гилдия 1
        'g2': '1490805404710469642'  // ID на Роля за Гилдия 2
    };

    // Вземаме само частта след "mania-plan" (аргумента g1, g2 или all)
    const arg = content.replace('mania-plan', '').trim();

    // ПРОВЕРКА ЗА ТРИТЕ ВАРИАНТА
    if (arg === 'all') {
        // Вариант 1: Пингваме всички (@everyone) и пускаме два плана
        await createPlan(msg, 'g1', ROLES['g1'], MAIN_CHANNEL_ID, true);
        await createPlan(msg, 'g2', ROLES['g2'], MAIN_CHANNEL_ID, true);
    } 
    else if (arg === 'g1' || arg === 'g2') {
        // Вариант 2: Пингваме САМО ролята на конкретната гилдия (без everyone)
        await createPlan(msg, arg, ROLES[arg], MAIN_CHANNEL_ID, false);
    } 
    else {
        // Ако потребителят е сгрешил командата
        const errorMsg = await msg.reply("❌ Напиши: `mania-plan g1`, `g2` или `all`.");
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        return;
    }

    // Изтриваме съобщението на потребителя за чистота в чата
    if (msg.deletable) await msg.delete().catch(() => {});
}

/**
 * ПОМОЩНА ФУНКЦИЯ ЗА СЪЗДАВАНЕ НА ПЛАНА
 * type: 'g1' или 'g2'
 * roleId: ID-то на ролята
 * mainChannelId: ID на канала за известия
 * useEveryone: true (ако искаме @everyone) или false (ако искаме само ролята)
 */
async function createPlan(msg, type, roleId, mainChannelId, useEveryone) {
    const targetRolePing = `<@&${roleId}>`;
    
    // ЛОГИКА ЗА ПИНГ: Ако е 'all', добавяме @everyone, иначе само ролята
    const pingContent = useEveryone ? `@everyone (${targetRolePing})` : targetRolePing;
    
    const guildName = type.toUpperCase();

    // Създаване на Embed съобщението
    const planEmbed = new EmbedBuilder()
        .setTitle(`⚔️ MANIA FORMATION - ${guildName}`)
        .setDescription(`${pingContent} Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play`)
        .setColor(type === 'g1' ? "#00FF00" : "#0099FF") // Зелено за G1, Синьо за G2
        .setTimestamp();

    // Пращаме плана в текущия канал
    const planMsg = await msg.channel.send({ 
        content: pingContent, 
        embeds: [planEmbed] 
    });
    
    // Добавяме реакциите
    await planMsg.react("✅");
    await planMsg.react("❌");

    // Опит за изпращане на известие в главния канал
    try {
        const mainChannel = msg.client.channels.cache.get(mainChannelId);
        if (mainChannel) {
            await mainChannel.send(`🚨 **${pingContent} A new Mania Plan for ${guildName} has been posted: ${planMsg.url}**`);
        }
    } catch (e) { 
        console.error("Грешка при пращане в главния канал:", e.message); 
    }
}


/**
 * СПИСЪК НА ПОТВЪРДИЛИТЕ (mania-list)
 */
async function handleManiaList(msg) {
    const MAIN_CHANNEL_ID = '1486343047632523398';
    const content = msg.content.toLowerCase().trim();
    
    // Вземаме аргумента (g1 или g2)
    const arg = content.replace('mania-list', '').trim();
    
    // Настройки за ролите (Сложи същите ID-та като в mania-plan)
    const ROLES = {
        'g1': '1490805399010545794',
        'g2': '1490805404710469642'
    };

    if (arg !== 'g1' && arg !== 'g2') {
        return msg.reply("❌ Please specify guild: `mania-list g1` or `mania-list g2`").then(m => setTimeout(() => m.delete(), 5000));
    }

    // 1. Проверяваме за запис в базата
    if (!fs.existsSync(DB_PATH)) return msg.reply("❌ No active plans found!");
    const planData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const targetPlanId = planData[`planId_${arg}`]; // Вземаме точното ID за g1 или g2

    if (!targetPlanId) return msg.reply(`❌ No active plan found for ${arg.toUpperCase()}!`);

    try {
        const planMsg = await msg.channel.messages.fetch(targetPlanId).catch(() => null);
        if (!planMsg) return msg.reply("❌ Original plan message not found!");

        // 2. Събираме гласовете
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => `<@${u.id}>`);

        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 3. Филтрираме САМО членовете на съответната гилдия
        const allMembers = await msg.guild.members.fetch();
        const targetRoleId = ROLES[arg];
        const votedIds = [...usersYes.keys(), ...usersNo.keys()];
        
        // ВАЖНО: Тук филтрираме по ролята на гилдията
        const missing = allMembers.filter(m => 
            !m.user.bot && 
            m.roles.cache.has(targetRoleId) && // Само хора с ролята за G1/G2
            !votedIds.includes(m.id)
        ).map(m => `<@${m.id}>`);

        // 4. Създаваме Embed
        const statusEmbed = new EmbedBuilder()
            .setTitle(`⚔️ FORMATION STATUS - ${arg.toUpperCase()}`)
            .setDescription(`Checking votes for <@&${targetRoleId}>`)
            .setColor(arg === 'g1' ? "#00FF00" : "#0099FF")
            .addFields(
                { name: `✅ CONFIRMED (${confirmed.length})`, value: confirmed.join(", ") || "None yet", inline: false },
                { name: `❌ DECLINED (${declined.length})`, value: declined.join(", ") || "None", inline: false }
            );

        await msg.channel.send({ embeds: [statusEmbed] });

        // 5. Пингване на липсващите
        if (missing.length > 0) {
            const missingText = missing.join(" ");
            await msg.channel.send(`🔔 **Attention!** These players from **${arg.toUpperCase()}** haven't voted:\n${missingText}`);
        
            // Известие в главния канал
            const mainChannel = await msg.client.channels.fetch(MAIN_CHANNEL_ID).catch(() => null);
            if (mainChannel) {
                await mainChannel.send(`🚨 **MANDATORY!** Members of **${arg.toUpperCase()}** need to vote: ${missingText}\nGo to <#${msg.channel.id}>`);
            }
        } else {
            await msg.channel.send(`✅ Everyone from **${arg.toUpperCase()}** has voted!`);
        }

        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (e) {
        console.error("Грешка в mania-list:", e);
        msg.reply("Error updating list.");
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
