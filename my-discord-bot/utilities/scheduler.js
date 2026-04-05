const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const staticList = require("../data/staticReminders");

global.lastStrategyContent = null;
let strategyMsgObject = null; 

// Проверка на Cron формата
const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

function initSchedulers(client, pool) {
    // 1. СТАТИЧНИ НАПОМНЯНИЯ (Mania, Shandora и т.н.)
    staticList.forEach(rem => {
        if (!isValidCron(rem.cron)) return;
        cron.schedule(rem.cron, () => {
            client.guilds.cache.forEach(async (guild) => {
                const ch = guild.channels.cache.find(c => c.name === "reminders");
                if (ch) {
                    const mention = await getMention(guild, rem.target);
                    ch.send(`${mention} ${rem.message}`);
                }
            });
        }, { timezone: "Europe/London" });
    });

    // 2. ДИНАМИЧНИ НАПОМНЯНИЯ (От базата данни)
    pool.query("SELECT * FROM reminders").then(res => {
        res.rows.forEach(rem => {
            if (!isValidCron(rem.cron)) return;
            cron.schedule(rem.cron, () => {
                const ch = client.channels.cache.get(rem.channel_id);
                if (ch) ch.send(rem.message);
            }, { timezone: "Europe/London" });
        });
    });

    // --- 3. ПУСКАНЕ НА СТРАТЕГИЯТА (19:25 London Time) ---
    cron.schedule("25 19 * * *", async () => {
        try {
            // Взимаме записаната стратегия от базата
            const res = await pool.query("SELECT value FROM global_vars WHERE key = 'last_strategy'");
            if (res.rows.length === 0) return;

            const strategyText = res.rows[0].value;

            for (const guild of client.guilds.cache.values()) {
                const channel = guild.channels.cache.find(c => c.name === "mania-reminder");
                if (channel) {
                    // ПОЧИСТВАНЕ: Изтриваме старите съобщения в канала
                    const oldMsgs = await channel.messages.fetch({ limit: 20 });
                    if (oldMsgs.size > 0) await channel.bulkDelete(oldMsgs, true).catch(() => {});

                    // СЪЗДАВАНЕ НА ЕМБЕДА
                    const embed = new EmbedBuilder()
                        .setTitle("📜 DAILY BATTLE STRATEGY")
                        .setDescription(strategyText)
                        .setColor("#FF4500")
                        .setThumbnail("https://imgur.com") // Сложи линк към лого
                        .setFooter({ text: "Confirm your presence with ✅ before 19:50!" })
                        .setTimestamp();

                    strategyMsgObject = await channel.send({ content: "@everyone 🏴‍☠️ **NEW STRATEGY ISSUED!**", embeds: [embed] });
                    await strategyMsgObject.react("✅");
                }
            }
        } catch (err) { console.error("Post Strategy Error:", err.message); }
    }, { timezone: "Europe/London" });

    // --- 4. ПРОВЕРКА НА ДИСЦИПЛИНАТА (19:50 London Time) ---
    cron.schedule("50 19 * * *", async () => {
        if (!strategyMsgObject) return;

        try {
            const guild = strategyMsgObject.guild;
            const channel = strategyMsgObject.channel;

            // Кой е реагирал?
            const reaction = strategyMsgObject.reactions.cache.get("✅");
            const users = reaction ? await reaction.users.fetch() : new Map();
            const reactedIds = users.map(u => u.id);

            // Взимаме всички хора с поне една роля (без ботове)
            const allMembers = await guild.members.fetch();
            const missing = allMembers.filter(m => 
                !m.user.bot && 
                m.roles.cache.size > 1 && 
                !reactedIds.includes(m.id)
            );

            if (missing.size > 0) {
                const pings = missing.map(m => `<@${m.id}>`).join(" ");

                const missingEmbed = new EmbedBuilder()
                    .setTitle("🚨 URGENT: DISCIPLINE CHECK")
                    .setDescription("The following pirates have NOT confirmed their positions!")
                    .setColor("#FF0000")
                    .addFields(
                        { name: "📢 TARGETS:", value: pings },
                        { name: "⚠️ ACTION:", value: "React with ✅ to the strategy message NOW!" }
                    )
                    .setTimestamp();

                await channel.send({ content: "⚠️ **ATTENTION CREW!**", embeds: [missingEmbed] });
            }

            // ИЗЧИСТВАМЕ стратегията от БД за следващия ден
            await pool.query("DELETE FROM global_vars WHERE key = 'last_strategy'");
            strategyMsgObject = null;
        } catch (err) { console.error("Discipline Check Error:", err.message); }
    }, { timezone: "Europe/London" });
}

// --- ФУНКЦИЯ ЗА УЛАВЯНЕ НА СТРАТЕГИЯТА ---
async function captureStrategy(msg, pool) {
    if (msg.content.toLowerCase().includes("mania-strategy")) {
        // Форматиране: Правим босовете Bold и добавяме мечове
        let raw = msg.content.replace(/mania-strategy/gi, "").trim();
        let formatted = raw.split('\n')
            .map(line => line.includes('-') ? `**⚔️ ${line.split('-')[0].trim().toUpperCase()}:** ${line.split('-')[1].trim()}` : line)
            .join('\n');

        // Записваме в БД
        await pool.query(
            "INSERT INTO global_vars (key, value) VALUES ('last_strategy', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [formatted]
        );
        return true;
    }
    return false;
}

async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target;
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
    if (role) return `<@&${role.id}>`;
    return target;
}

module.exports = { initSchedulers, isValidCron, captureStrategy };
