const cron = require("node-cron");
// Зареждаме данните директно тук, за да не ги прехвърляме през main.js
const staticList = require("../data/staticReminders"); 

const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

// Вече не искаме staticList като аргумент, защото го имаме горе
function initSchedulers(client, pool) { 
    // 1. Статични напомняния
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

    // 2. Динамични напомняния (от базата)
    pool.query("SELECT * FROM reminders").then(res => {
        res.rows.forEach(rem => {
            if (!isValidCron(rem.cron)) return;
            cron.schedule(rem.cron, () => {
                const ch = client.channels.cache.get(rem.channel_id);
                if (ch) ch.send(rem.message);
            }, { timezone: "Europe/London" });
        });
    }).catch(err => console.error("DB Scheduler Error:", err.message));
}

// Помощна функция за тагване
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

module.exports = { initSchedulers, isValidCron };
