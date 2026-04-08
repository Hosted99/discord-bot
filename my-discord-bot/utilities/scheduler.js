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
        const reaction = planMsg.reactions.cache.get("✅");
        const users = reaction ? await reaction.users.fetch() : [];
        const confirmed = users.filter(u => !u.bot).map(u => `<@${u.id}>`);

        const listEmbed = new EmbedBuilder()
            .setTitle("📊 CURRENT ONLINE LIST")
            .setDescription(confirmed.length > 0 ? confirmed.join("\n") : "No one confirmed.")
            .addFields({ name: "TOTAL:", value: `${confirmed.length} players` })
            .setColor("#0099FF");

        await msg.channel.send({ embeds: [listEmbed] });
    } catch (e) {
        msg.reply("Error fetching plan data.");
    }
}

/**
 * ПУБЛИКУВАНЕ НА СТРАТЕГИЯ (mania-strategy)
 */
async function handleManiaStrategy(msg, pool) {
    const rawContent = msg.content.replace(/mania-strategy/gi, "").trim();
    if (!rawContent) return;

    const lines = rawContent.split('\n').filter(l => l.trim() !== "");
    const stratEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ DAILY BATTLE STRATEGY")
        .setDescription("All pirates to your positions!")
        .setColor("#FF4500")
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
