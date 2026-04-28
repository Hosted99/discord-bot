const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');

// ================= CONFIG =================
const TARGET_GUILD_ID = '1486343040162468003';
const LEVEL_UP_CHANNEL_ID = '1498426382219481248';
const LOG_CHANNEL_ID = '1498426571806085192';
const STATS_CHANNEL_ID = '1498426456143958027';

// ================= CACHE =================
const xpCache = new Map();
const cooldown = new Map();

// ================= PROGRESS BAR =================
function createProgressBar(current, total, size = 10) {
    const progress = Math.min(size, Math.floor((current / total) * size));
    const empty = size - progress;
    return `\`[${'▇'.repeat(progress)}${'—'.repeat(empty)}]\` ${Math.floor((current / total) * 100)}%`;
}

// ================= ROLES =================
const RANK_ROLES = {
    1: { name: "Silent Snail 🐌", color: "#7f8c8d", msg: "Welcome to the crew... or are you just watching? 👀" },
    3: { name: "Keyboard Lost", color: "#95a5a6", msg: "Did you drop your keyboard in the ocean? Say something! 🌊" },
    5: { name: "Typing… (forever)", color: "#bdc3c7", msg: "The bubble is there, but no message. Suspicious... 💬" },
    10: { name: "Background NPC", color: "#95a5a6", msg: "Keep up! 🎮" },
    20: { name: "Word Dripper", color: "#27ae60", msg: "You're getting there. 💧" },
    50: { name: "Spam Apprentice", color: "#3498db", msg: "Learning spam arts... ✍️" },
    100: { name: "Infinite Talker", color: "#e67e22", msg: "Does this guy ever stop? ♾️" },
    200: { name: "Message King", color: "#f1c40f", msg: "The ultimate talker! 🏆" },
    220: { name: "Grass Avoider 🌱❌", color: "#ffeb3b", msg: "Touch grass challenge failed. 👑" }
};

// ================= FALLBACK =================
const FUNNY_FALLBACKS = [
    "Still a nobody, but louder now. 🤡",
    "Level up... nothing changed. 📉",
    "Achievement unlocked: existing. ✨"
];

// ================= DB =================
async function saveToDatabase(pool, userId, data) {
    const query = `
        INSERT INTO levels (user_id, xp, level, username)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET xp = $2, level = $3, username = $4;
    `;
    try {
        await pool.query(query, [userId, data.xp, data.level, data.username]);
    } catch (e) {
        console.error("DB Error:", e);
    }
}

// ================= ROLE =================
async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;

    let role = guild.roles.cache.find(r => r.name === roleData.name);

    if (!role) {
        const fetched = await guild.roles.fetch();
        role = fetched.find(r => r.name === roleData.name);
    }

    if (!role) {
        role = await guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            reason: "Auto Rank"
        });
    }

    return role;
}

// ================= MAIN =================
module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;

        const userId = message.author.id;
        const content = message.content.toLowerCase();

        // ================= ANTI SPAM =================
        const now = Date.now();
        if (cooldown.has(userId) && now < cooldown.get(userId) + 5000) return;
        cooldown.set(userId, now);

        // ================= !RANK =================
        // --- КОМАНДА !RANK (Самоизтриваща се) ---
        if (message.content.toLowerCase().startsWith('!rank')) {
            const rankChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
            if (!rankChannel) return;
            setTimeout(() => message.delete().catch(() => {}), 30000);

            let dbRes = await pool.query('SELECT xp, level FROM levels WHERE user_id = $1', [userId]);
            let xp = dbRes.rows[0]?.xp || 0, lvl = dbRes.rows[0]?.level || 1;
            const cached = xpCache.get(userId);
            if (cached) { xp = cached.xp; lvl = cached.level; }

            const nextXP = lvl * 500;
            const roleInfo = RANK_ROLES[lvl];
            const embed = new EmbedBuilder()
                .setTitle(`⚓ ${message.member.displayName}'s Status`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setColor(roleInfo?.color || '#34495e')
                .addFields(
                    { name: '👤 Title', value: `**${roleInfo?.name || "Wanderer"}**`, inline: true },
                    { name: '📈 Level', value: `\`${lvl}\``, inline: true },
                    { name: '📊 Progress', value: createProgressBar(xp, nextXP), inline: false }
                )
                .setFooter({ text: 'Auto-deleting in 60s' });

            return rankChannel.send({ content: `⚓ ${message.author}, check your status:`, embeds: [embed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 60000);
            });
        }

        // ================= !TOP =================
        // --- КОМАНДА !TOP (Админска проверка със случайни текстове) ---
        if (message.content.toLowerCase() === '!top') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                setTimeout(() => message.delete().catch(() => {}), 30000);
                return;
            }

            const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
            if (!statsChannel) return;
            message.delete().catch(() => {}), 30000;

            // 1. Извличаме данните от Neon
            const res = await pool.query('SELECT username, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const desc = res.rows.map((row, i) => `\`#${i + 1}\` **${row.username}** — Level \`${row.level}\` (${row.xp} XP)`).join('\n');

            // 2. ДЕФИНИРАМЕ ВАРИАНТИТЕ ТУК
            const variants = [
                { t: '🏴‍☠️ THE NOISIEST PIRATES ON DECK!', d: `*Arrr! These sea dogs be makin’ the most noise across the seven seas:* \n\n${desc}` },
                { t: '🍻 WHO WON’T SHUT UP?!', d: `*These pirates drank too much rum and haven’t stopped talkin’ since...*\n\n${desc}` },
                { t: '⚓ CREW CHATTER CHAMPIONS', d: `*The loudest voices aboard the ship at this very moment:*\n\n${desc}` },
                { t: '🔥 TOP SPAM LORDS', d: `*Current legends of chaos and chatter:*\n\n${desc}` },
                { t: '💀 THE TAVERN’S LOUDEST LEGENDS', d: `*If silence was gold, these pirates would be broke:*\n\n${desc}` }
            ];

            // 3. Избираме един случаен вариант
            const v = variants[Math.floor(Math.random() * variants.length)];

            const embed = new EmbedBuilder()
                .setTitle(v.t)
                .setDescription(v.d)
                .setColor('#FF4500')
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setFooter({ text: '☠️ This list will vanish into the mist in 60 seconds...' })
                .setTimestamp();

            return statsChannel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 60000));
        }

        // ================= !SYNC =================
        if (content === '!sync') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

            setTimeout(() => message.delete().catch(() => {}), 30000);

            let count = 0;

            for (const [id, data] of xpCache.entries()) {
                if (data.needsUpdate) {
                    await saveToDatabase(pool, id, data);
                    data.needsUpdate = false;
                    count++;
                }
            }

            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const syncEmbed = new EmbedBuilder()
                    .setTitle('♻️ Manual Sync Executed')
                    .setDescription(`Admin **${message.member.displayName}** triggered a manual sync.\nUpdated **${count}** pirate profiles in Neon.`)
                    .setColor('#2ecc71')
                    .setTimestamp();
                logChannel.send({ embeds: [syncEmbed] });
            }
        }

        // ================= XP =================
        if (message.content.length < 3) return;

        let xpGain = message.attachments.size ? 35 : 15;

        let userData = xpCache.get(userId) || {
            xp: 0,
            level: 1,
            username: message.member.displayName,
            needsUpdate: false
        };

        userData.username = message.member.displayName;
        userData.xp += xpGain;

        let nextLevelXP = Math.floor(500 * Math.pow(userData.level, 1.2));

        while (userData.xp >= nextLevelXP) {
            userData.level++;
            nextLevelXP = Math.floor(500 * Math.pow(userData.level, 1.2));
        }

        xpCache.set(userId, userData);
    });

    // ================= WEEKLY TOP =================
   // СЕДМИЧЕН ТОП 10 - Изпълнява се всяка неделя в 23:59 (Лондонско време)
    cron.schedule('59 23 * * 0', async () => {
        const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (!statsChannel) return;

        const headers = [
            { title: '🏆 The Loudest Pirates of the Week', desc: 'The crew members who simply will not shut up! 📢' },
            { title: '🏴‍☠️ Most Wanted Grass Avoiders 🌱❌', desc: 'The weekly report is in: These legends need sunlight!' }
        ];
        const style = headers[Math.floor(Math.random() * headers.length)];

        try {
            const res = await pool.query('SELECT username, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const desc = res.rows.map((row, i) => {
                let icon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`#${i + 1}\``;
                return `${icon} **${row.username || 'Unknown'}** — Level \`${row.level}\` (${row.xp} XP)`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(style.title)
                .setColor('#FF4500')
                .setDescription(`*${style.desc}*\n\n${desc}`)
                .setFooter({ text: 'Weekly Ship Log | Official Record' })
                .setTimestamp();
            
            statsChannel.send({ content: "🔔 **WEEKLY LEADERBOARD IS HERE!**", embeds: [embed] });
            console.log("[System] Седмичната класация беше изпратена по разписание.");
        } catch (e) { console.error("Cron Leaderboard Error:", e); }
    }, {
        timezone: "Europe/London" // Настройваме точното часово време
    });

    // ================= AUTO SYNC =================
    cron.schedule('0 */2 * * *', async () => {
        const guild = client.guilds.cache.get(TARGET_GUILD_ID);
        if (!guild) return;

        const roles = Object.values(RANK_ROLES).map(r => r.name);
        const res = await pool.query('SELECT user_id, level FROM levels');

        for (const row of res.rows) {
            const member = await guild.members.fetch(row.user_id).catch(() => null);
            if (!member) continue;

            const roleData = RANK_ROLES[row.level];
            if (!roleData) continue;

            const role = await getOrCreateRole(guild, roleData);
            if (!role) continue;

            const toRemove = member.roles.cache.filter(r => roles.includes(r.name));
            await member.roles.remove(toRemove).catch(() => {});
            await member.roles.add(role).catch(() => {});
        }
    });
    // КРИТИЧНО: ЗАПИС ПРИ СПИРАНЕ/РЕСТАРТ (CTRL+C)
    process.on('SIGINT', async () => {
        console.log('⚠️ Saving progress before shutdown...');
        await massSync();
        process.exit(0);
    });
};
