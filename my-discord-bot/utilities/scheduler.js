const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния

// Глобални променливи за модула
let currentPlanMsgId = null;
let strategyMsgObject = null;

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
    const planEmbed = new EmbedBuilder()
        .setTitle("⚔️ MANIA FORMATION")
        .setDescription("@everyone Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play")
        .setColor("#00FF00");

    const planMsg = await msg.channel.send({ content: "@everyone", embeds: [planEmbed] });
    await planMsg.react("✅");
    await planMsg.react("❌");
    
    currentPlanMsgId = planMsg.id; // Запомняме съобщението за mania-list
    if (msg.deletable) await msg.delete().catch(() => {});
}

/**
 * СПИСЪК НА ПОТВЪРДИЛИТЕ (mania-list)
 */
async function handleManiaList(msg) {
    // 1. Проверка дали има активен план в паметта на бота
    if (!currentPlanMsgId) {
        return msg.reply("❌ No active plan found! Start one with `mania-plan`.");
    }

    try {
        // 2. Опитваме се да вземем оригиналното съобщение на плана
        const planMsg = await msg.channel.messages.fetch(currentPlanMsgId).catch(() => null);
        
        if (!planMsg) {
            return msg.reply("❌ Original plan message was deleted!");
        }

        // 3. Извличаме хората, които са реагирали с ✅
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 4. Извличаме хората, които са реагирали с ❌
        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 5. Намираме тези, които не са гласували (Missing)
        // ВАЖНО: Изисква "Server Members Intent" в Discord Developer Portal
        const allMembers = await msg.guild.members.fetch();
        const votedIds = [...usersYes.keys(), ...usersNo.keys()];
        
        const missing = allMembers.filter(m => 
            !m.user.bot && 
            m.roles.cache.size > 1 && // Пропуска хората без роли (често са ботове или нови)
            !votedIds.includes(m.id)
        );

        const missingMentions = missing.map(m => `<@${m.id}>`);

        // 6. Създаваме Embed със статистиката (без пингове вътре)
        const statusEmbed = new EmbedBuilder()
            .setTitle("⚔️ CURRENT FORMATION STATUS")
            .setDescription("The original plan is still active above! 👆")
            .setColor("#3498db")
            .addFields(
                { name: `✅ CONFIRMED (${confirmed.length})`, value: confirmed.join(", ") || "None yet", inline: false },
                { name: `❌ DECLINED (${declined.length})`, value: declined.join(", ") || "None", inline: false }
            )
            .setFooter({ text: "Vote using the reactions on the main message!" });

        await msg.channel.send({ embeds: [statusEmbed] });

        // 7. Изпращаме ПИНГ съобщение само за тези, които липсват
        if (missingMentions.length > 0) {
            await msg.channel.send({ 
                content: `🔔 **Attention!** The following players haven't voted yet:\n${missingMentions.join(" ")}` 
            });
        } else {
            await msg.channel.send("✅ Everyone has voted! Great job.");
        }

        // 8. Изтриваме командата на потребителя (!mania-list), за да не се трупа текст
        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (e) {
        console.error("List Error:", e);
        msg.reply("⚠️ Error: Make sure the bot has **'Server Members Intent'** enabled in the Developer Portal!");
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
