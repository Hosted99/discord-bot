const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния

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
    if (!currentPlanMsgId) return msg.reply("❌ No active plan found!");

    try {
        const planMsg = await msg.channel.messages.fetch(currentPlanMsgId).catch(() => null);
        if (!planMsg) return msg.reply("❌ Original plan message was deleted!");

        // 1. Взимаме гласувалите
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => u.id); // Взимаме само ID-та за проверка

        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => u.id);

        // 2. ПРОВЕРКА ЗА ПРОМЯНА: Сравняваме текущите гласове с предишните
        const currentVotedString = [...confirmed, ...declined].sort().join(",");
        if (currentVotedString === lastVotedString && lastVotedString !== "") {
            const noChangeMsg = await msg.channel.send("ℹ️ No changes since the last list.");
            // Изтриваме съобщението "няма промяна" след 5 секунди, за да е чисто
            setTimeout(() => noChangeMsg.delete().catch(() => {}), 5000);
            if (msg.deletable) await msg.delete().catch(() => {});
            return; // Спираме до тук, няма нужда от нов списък
        }
        
        lastVotedString = currentVotedString; // Обновяваме "паметта" на бота

        // 3. Намираме негласувалите (тук често става грешката)
        let missingMentions = [];
        try {
            const allMembers = await msg.guild.members.fetch();
            const votedIds = [...confirmed, ...declined];
            missingMentions = allMembers
                .filter(m => !m.user.bot && m.roles.cache.size > 1 && !votedIds.includes(m.id))
                .map(m => `<@${m.id}>`);
        } catch (fetchError) {
            console.error("Fetch Error:", fetchError);
            // Ако fetch се провали, просто продължаваме без списък "Missing", вместо да спираме всичко
        }

        // 4. Подготвяме споменаванията за потвърдилите и отказалите
        const confirmedMentions = confirmed.map(id => `<@${id}>`).join(", ") || "None yet";
        const declinedMentions = declined.map(id => `<@${id}>`).join(", ") || "None";

        // 5. Пращаме Embed
        const statusEmbed = new EmbedBuilder()
            .setTitle("⚔️ CURRENT FORMATION STATUS")
            .setDescription("The original plan is still active above! 👆")
            .setColor("#3498db")
            .addFields(
                { name: `✅ CONFIRMED (${confirmed.length})`, value: confirmedMentions, inline: false },
                { name: `❌ DECLINED (${declined.length})`, value: declinedMentions, inline: false }
            );

        await msg.channel.send({ embeds: [statusEmbed] });

        // 6. Пингваме липсващите само ако има такива
        if (missingMentions.length > 0) {
            await msg.channel.send({ 
                content: `🔔 **Attention!** These players haven't voted:\n${missingMentions.join(" ")}` 
            });
        }

        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (e) {
        // Тази грешка вече ще излиза само при сериозен проблем, не при всяко писане
        console.error("General List Error:", e);
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
