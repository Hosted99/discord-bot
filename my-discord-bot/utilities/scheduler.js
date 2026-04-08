const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния

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

    // --- 3. ПУСКАНЕ НА СТРАТЕГИЯТА (18:45 London Time) ---
    cron.schedule("45 18 * * *", async () => { // Всеки ден в 19:15
        try {
            const res = await pool.query("SELECT value FROM global_vars WHERE key = 'last_strategy'"); // Вземаме стратегията от DB
            if (res.rows.length === 0) return; // Ако няма запис – излизаме

            const strategyText = res.rows[0].value; // Вземаме текста на стратегията

            for (const guild of client.guilds.cache.values()) { // За всеки сървър
                const channel = guild.channels.cache.find(c => c.name === "mania-reminder"); // Търсим канал
                if (channel) {
                    const oldMsgs = await channel.messages.fetch({ limit: 20 }); // Вземаме последните 20 съобщения
                    if (oldMsgs.size > 0) await channel.bulkDelete(oldMsgs, true).catch(() => {}); // Изтриваме ги

                    const embed = new EmbedBuilder() // Създаваме embed
                        .setTitle("📜 DAILY BATTLE STRATEGY") // Заглавие
                        .setDescription(strategyText) // Описание
                        .setColor("#FF4500") // Цвят
                        .setThumbnail("https://imgur.com") // Thumbnail (тук трябва реален линк)
                        .setFooter({ text: "Confirm your presence with ✅ before 19:30!" }) // Footer
                        .setTimestamp(); // Timestamp

                    strategyMsgObject = await channel.send({ // Пращаме съобщението
                        content: "@everyone 🏴‍☠️ **NEW STRATEGY ISSUED!**",
                        embeds: [embed]
                    });

                    await strategyMsgObject.react("✅"); // Добавяме реакция
                }
            }
        } catch (err) {
            console.error("Post Strategy Error:", err.message); // Логваме грешка
        }
    }, { timezone: "Europe/London" });

    // --- 4. ПРОВЕРКА НА ДИСЦИПЛИНАТА (19:30 London Time) ---
    cron.schedule("30 19 * * *", async () => { // 1 минута по-късно
        if (!strategyMsgObject) return; // Ако няма стратегия – излизаме

        try {
            const guild = strategyMsgObject.guild; // Вземаме guild
            const channel = strategyMsgObject.channel; // Вземаме channel
            const reaction = strategyMsgObject.reactions.cache.get("✅"); // Вземаме реакцията
            const users = reaction ? await reaction.users.fetch() : new Map(); // Вземаме всички, които са реагирали
            const reactedIds = users.map(u => u.id); // Взимаме ID-тата им

            const allMembers = await guild.members.fetch(); // Взимаме всички членове
            const missing = allMembers.filter(m =>
                !m.user.bot && // Не е бот
                m.roles.cache.size > 1 && // Има роля
                !reactedIds.includes(m.id) // Не е реагирал
            );

            if (missing.size > 0) {
                const pings = missing.map(m => `<@${m.id}>`).join(" "); // Създаваме списък с ping-ове

                const missingEmbed = new EmbedBuilder() // Създаваме embed
                    .setTitle("🚨 URGENT: CHECK")
                    .setDescription("The following pirates have NOT confirmed their positions!")
                    .setColor("#FF0000")
                    .addFields(
                        { name: "📢 TARGETS:", value: pings },
                        { name: "⚠️ ACTION:", value: "React with ✅ to the strategy message NOW!" }
                    )
                    .setTimestamp();

                await channel.send({ // Пращаме предупреждението
                    content: "⚠️ **ATTENTION CREW!**",
                    embeds: [missingEmbed]
                });
            }

            await pool.query("DELETE FROM global_vars WHERE key = 'last_strategy'"); // Трием стратегията от DB
            strategyMsgObject = null; // Нулираме променливата

        } catch (err) {
            console.error("Discipline Check Error:", err.message); // Логваме грешка
        }
    }, { timezone: "Europe/London" });
}

// --- ФУНКЦИЯ ЗА УЛАВЯНЕ НА СТРАТЕГИЯТА ---
async function captureStrategy(msg, pool) {
    if (msg.content.toLowerCase().includes("mania-strategy")) { // Проверяваме дали съобщението съдържа ключова дума
        try {
            let raw = msg.content.replace(/mania-strategy/gi, "").trim(); // Махаме ключовата дума
            const lines = raw.split('\n'); // Разделяме по редове

            const previewEmbed = new EmbedBuilder() // Preview embed
                .setTitle("🏴‍☠️ BATTLE FORMATION CAPTURED")
                .setDescription(`**Strategist:** ${msg.author}\n*Stand by for deployment at 19:15!*`)
                .setColor("#2b2d31")
                .setImage("https://imgur.com") // Тук също трябва реална картинка
                .setTimestamp();

            let formattedForDB = ""; // Ще пазим форматирания текст за DB

            lines.forEach(line => {
                if (line.includes('-')) { // Проверяваме за формат boss - players
                    const parts = line.split('-');
                    const boss = parts[0].trim().toUpperCase(); // Име на боса
                    const players = parts[1].trim(); // Играчите

                    previewEmbed.addFields({ // Добавяме поле в embed
                        name: `🛰️ ${boss}`,
                        value: players.replace(/\s+/g, '\n'), // Всеки играч на нов ред
                        inline: true
                    });

                    formattedForDB += `**⚔️ ${boss}:**\n${players.replace(/\s+/g, '\n')}\n\n`; // Формат за DB
                }
            });

            await pool.query( // Записваме в DB
                "INSERT INTO global_vars (key, value) VALUES ('last_strategy', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
                [formattedForDB.trim()]
            );

            return previewEmbed; // Връщаме embed-а
        } catch (err) {
            console.error("Capture Error:", err.message); // Логваме грешка
            return null;
        }
    }
    return false; // Ако няма ключова дума
}

// Функция за взимане на mention (role или everyone)
async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target; // Ако е глобално mention
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase()); // Търсим роля
    if (role) return `<@&${role.id}>`; // Връщаме role mention
    return target; // Ако няма – връщаме текста
}

module.exports = { initSchedulers, isValidCron, captureStrategy }; // Експортираме функциите
