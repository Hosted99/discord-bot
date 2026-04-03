const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const staticList = require("../data/staticReminders");

global.lastStrategyContent = null;
let strategyMsgObject = null; 

const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

function initSchedulers(client, pool) {
    // 1. СТАТИЧНИ (Mania, Shandora и т.н.)
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

    // 2. ДИНАМИЧНИ (От базата данни)
    pool.query("SELECT * FROM reminders").then(res => {
        res.rows.forEach(rem => {
            if (!isValidCron(rem.cron)) return;
            cron.schedule(rem.cron, () => {
                const ch = client.channels.cache.get(rem.channel_id);
                if (ch) ch.send(rem.message);
            }, { timezone: "Europe/London" });
        });
    }).catch(err => console.error("DB Scheduler Error:", err.message));

    // 3. ПУСКАНЕ НА СТРАТЕГИЯТА (19:25 London Time)
    cron.schedule("25 19 * * *", async () => {
        if (!global.lastStrategyContent) return;
        client.guilds.cache.forEach(async (guild) => {
            const channel = guild.channels.cache.find(c => c.name === "mania-reminder");
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle("📜 DAILY STRATEGY")
                    .setDescription(global.lastStrategyContent)
                    .setColor("#FF4500")
                    .setFooter({ text: "React with ✅ to confirm!" })
                    .setTimestamp();

                strategyMsgObject = await channel.send({ content: "@everyone", embeds: [embed] });
                await strategyMsgObject.react("✅");
            }
        });
    }, { timezone: "Europe/London" });

    // 4. ПРОВЕРКА ЗА ЛИПСВАЩИ РЕАКЦИИ (20:00 London Time)
    cron.schedule("00 20 * * *", async () => {
        if (!strategyMsgObject) return;
        try {
            const guild = strategyMsgObject.guild;
            const channel = strategyMsgObject.channel;
            const reaction = strategyMsgObject.reactions.cache.get("✅");
            let reactedIds = [];
            if (reaction) {
                const users = await reaction.users.fetch();
                reactedIds = users.map(u => u.id);
            }
            const allMembers = await guild.members.fetch();
            const missing = allMembers.filter(m => !m.user.bot && !reactedIds.includes(m.id));

            if (missing.size > 0) {
                const pings = missing.map(m => `<@${m.id}>`).join(" ");
                await channel.send(`⚠️ **MISSING CONFIRMATION:**\n${pings}\n\nPlease react to the strategy!`);
            } else {
                await channel.send("✅ **Everyone is ready for battle!**");
            }
            strategyMsgObject = null;
            global.lastStrategyContent = null;
        } catch (err) { console.error("Audit Error:", err); }
    }, { timezone: "Europe/London" });
}

function captureStrategy(content) {
    if (content.toLowerCase().includes("mania-strategy")) {
        global.lastStrategyContent = content.replace(/mania-strategy/gi, "").trim();
        return true;
    }
    return false;
}

async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target;
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
    if (role) return `<@&${role.id}>`;
    const member = guild.members.cache.find(m => 
        m.user.username.toLowerCase() === target.toLowerCase() || 
        m.displayName.toLowerCase() === target.toLowerCase()
    );
    return member ? `<@${member.id}>` : target;
}

module.exports = { initSchedulers, isValidCron, captureStrategy };
