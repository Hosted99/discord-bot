const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния
let currentPlanMsgId = null;

global.lastStrategyContent = null; // Глобална променлива за последната стратегия (не се ползва активно тук)
let strategyMsgObject = null; // Ще пазим последното изпратено съобщение със стратегия

// Проверка дали cron изразът е валиден
const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

function initSchedulers(client, pool) {
    // 1. СТАТИЧНИ НАПОМНЯНИЯ
    staticList.forEach(rem => { // Минаваме през всяко статично напомняне
        if (!isValidCron(rem.cron)) return; // Ако cron форматът не е валиден – пропускаме

        cron.schedule(rem.cron, () => { // Създаваме scheduler
            client.guilds.cache.forEach(async (guild) => { // За всеки сървър
                const ch = guild.channels.cache.find(c => c.name === "reminders"); // Търсим канал "reminders"
                if (ch) {
                    const mention = await getMention(guild, rem.target); // Вземаме mention (role или everyone)
                   const finalMsg = typeof rem.message === 'function' ? rem.message() : rem.message;
                   ch.send(`${mention} ${finalMsg}`);
                }
            });
        }, { timezone: "Europe/London" }); // Задаваме timezone
    });

    // 2. ДИНАМИЧНИ НАПОМНЯНИЯ (от база данни)
    pool.query("SELECT * FROM reminders").then(res => { // Вземаме всички reminders от DB
        res.rows.forEach(rem => { // За всяко напомняне
            if (!isValidCron(rem.cron)) return; // Проверка за валиден cron

            cron.schedule(rem.cron, () => { // Създаваме scheduler
                const ch = client.channels.cache.get(rem.channel_id); // Вземаме канала по ID
                if (ch) ch.send(rem.message); // Пращаме съобщението
            }, { timezone: "Europe/London" });
        });
    });

    const { EmbedBuilder } = require('discord.js');

// Пазим ID на плана само в паметта за текущата сесия
let currentPlanMsgId = null;

// --- ФУНКЦИЯ ЗА ПЛАН (mania-plan) ---
async function handleManiaPlan(msg) {
    const planEmbed = new EmbedBuilder()
        .setTitle("⚔️ MANIA FORMATION")
        .setDescription("@everyone Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play")
        .setColor("#00FF00");

    const planMsg = await msg.channel.send({ content: "@everyone", embeds: [planEmbed] });
    await planMsg.react("✅");
    await planMsg.react("❌");
    
    currentPlanMsgId = planMsg.id; // Запомняме съобщението
    if (msg.deletable) await msg.delete();
}

// --- ФУНКЦИЯ ЗА СПИСЪК (mania-list) ---
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

// --- ФУНКЦИЯ ЗА СТРАТЕГИЯ (mania-strategy) ---
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

    // ПРЕЗАПИСВАНЕ: Използваме ON CONFLICT за автоматично обновяване на стратегията
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

    currentPlanMsgId = null; // Чистим плана за деня
    if (msg.deletable) await msg.delete();
}

// Експортираме функциите, за да се ползват в index.js
module.exports = { handleManiaPlan, handleManiaList, handleManiaStrategy };


// Функция за взимане на mention (role или everyone)
async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target; // Ако е глобално mention
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase()); // Търсим роля
    if (role) return `<@&${role.id}>`; // Връщаме role mention
    return target; // Ако няма – връщаме текста
}

module.exports = { initSchedulers, isValidCron, captureStrategy }; // Експортираме функциите
