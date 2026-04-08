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
    if (!currentPlanMsgId) return msg.reply("❌ No active plan found!");

    try {
        const planMsg = await msg.channel.messages.fetch(currentPlanMsgId);
        
        // 1. Взимаме ✅ (Will Play)
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 2. Взимаме ❌ (Won't Play)
        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 3. Намираме тези, които не са гласували (No Response)
        const allMembers = await msg.guild.members.fetch();
        const votedIds = [...usersYes.keys(), ...usersNo.keys()];
        const missing = allMembers.filter(m => 
            !m.user.bot && 
            m.roles.cache.size > 1 && 
            !votedIds.includes(m.id)
        ).map(m => `<@${m.id}>`);

        // --- ИЗПРАЩАНЕ НА 3 ОТДЕЛНИ СЪОБЩЕНИЯ ---

        // Съобщение 1: ✅
        const embedYes = new EmbedBuilder()
            .setTitle("✅ WILL PLAY TODAY")
            .setDescription(confirmed.join(", ") || "No one yet.")
            .setColor("#2ecc71")
            .setFooter({ text: `Total: ${confirmed.length} players` });
        await msg.channel.send({ embeds: [embedYes] });

        // Съобщение 2: ❌
        const embedNo = new EmbedBuilder()
            .setTitle("❌ WON'T PLAY")
            .setDescription(declined.join(", ") || "No one yet.")
            .setColor("#e74c3c")
            .setFooter({ text: `Total: ${declined.length} players` });
        await msg.channel.send({ embeds: [embedNo] });

        // Съобщение 3: ⏳
        const embedMissing = new EmbedBuilder()
            .setTitle("⏳ NO RESPONSE (MISSING)")
            .setDescription(missing.length > 0 ? missing.slice(0, 30).join(", ") : "Everyone has voted!")
            .setColor("#f1c40f")
            .setFooter({ text: `Total: ${missing.length} players ignored the plan` });
        await msg.channel.send({ embeds: [embedMissing] });

    } catch (e) {
        console.error("List Error:", e);
        msg.reply("Error fetching player lists.");
    }
}


/**
 * ПУБЛИКУВАНЕ НА СТРАТЕГИЯ (mania-strategy)
 */
async function handleManiaStrategy(msg, pool) {
    const rawContent = msg.content.replace(/mania-strategy/gi, "").trim();
    if (!rawContent) return;

    // Списък с епични аниме битки за GIF
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
        .setImage(randomGif) // Добавяме GIF-а тук
        .setTimestamp();

    lines.forEach(line => {
        if (line.includes('-')) {
            const [boss, players] = line.split('-');
            stratEmbed.addFields({
                name: `⚔️ ${boss.trim().toUpperCase()}`,
                value: players.trim(),
                inline: true
            });
        }
    });

    // ПРЕЗАПИСВАНЕ В DB
    await pool.query(`
        INSERT INTO global_vars (key, value) 
        VALUES ('last_strategy', $1) 
        ON CONFLICT (key) 
        DO UPDATE SET value = EXCLUDED.value
    `, [rawContent]);

    await msg.channel.send({ 
        content: "@everyone 🚩 **NEW STRATEGY ISSUED!**", 
        embeds: [stratEmbed] 
    });

    currentPlanMsgId = null; // Чистим плана за деня след стратегията
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
