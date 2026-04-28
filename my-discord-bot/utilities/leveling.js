const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');

// --- КОНФИГУРАЦИЯ ---
const TARGET_GUILD_ID = '1486343040162468003'; 
const LEVEL_UP_CHANNEL_ID = '1498426382219481248'; 
const LOG_CHANNEL_ID = '1498426571806085192';   
const STATS_CHANNEL_ID = '1498426456143958027';     
// --------------------

const xpCache = new Map();

function createProgressBar(current, total, size = 10) {
    const progress = Math.min(size, Math.floor((current / total) * size));
    const emptyProgress = size - progress;
    return `\`[${'▇'.repeat(progress)}${'—'.repeat(emptyProgress)}]\` ${Math.floor((current / total) * 100)}%`;
}

const RANK_ROLES = {
    1:   { name: "Silent Snail 🐌", color: "#7f8c8d", msg: "Welcome to the crew... or are you just watching? 👀" },
    3:   { name: "Keyboard Lost", color: "#95a5a6", msg: "Did you drop your keyboard in the ocean? Say something! 🌊" },
    5:   { name: "Typing… (forever)", color: "#bdc3c7", msg: "The bubble is there, but no message. Suspicious... 💬" },
    8:   { name: "Sea Lurker", color: "#7f8c8d", msg: "Hiding in the deep sea of the chat? We see you! 🐙" },
    10:  { name: "Background NPC", color: "#95a5a6", msg: "The main characters are talking, keep up! 🎮" },
    15:  { name: "Chat Rookie", color: "#2ecc71", msg: "First steps into the world of chatter! ⚓" },
    20:  { name: "Word Dripper", color: "#27ae60", msg: "One word at a time... you're getting there. 💧" },
    25:  { name: "Slow Typist", color: "#16a085", msg: "Slow and steady wins the race? Not here! 🐢" },
    30:  { name: "Casual Talker", color: "#2ecc71", msg: "Just enjoying a grog and a chat in the tavern. 🍻" },
    35:  { name: "Den Den Beginner", color: "#1abc9c", msg: "Starting to use the Den Den Mushi properly! 📞" },
    40:  { name: "Message Machine", color: "#3498db", msg: "You're starting to pump those numbers up! ⚙️" },
    45:  { name: "Chat Sailor", color: "#2980b9", msg: "Sailing through the sea of messages! ⛵" },
    50:  { name: "Spam Apprentice", color: "#3498db", msg: "You're learning the dark arts of spamming... ✍️" },
    55:  { name: "Typing Pirate", color: "#2980b9", msg: "Your fingers are fast as a cutlass! ⚔️" },
    60:  { name: "Den Den Caller", color: "#34495e", msg: "Bero-bero-bero-bero! You never hang up! 🐌🔊" },
    65:  { name: "Keyboard Warrior", color: "#9b59b6", msg: "Your keyboard is your strongest weapon! 🛡️" },
    70:  { name: "Spam Cannon", color: "#8e44ad", msg: "Boom! Messages flying everywhere! 💣" },
    75:  { name: "Chat Addict", color: "#9b59b6", msg: "You can't go 5 minutes without checking the chat! 💉" },
    80:  { name: "Message Storm", color: "#8e44ad", msg: "A literal hurricane of words! 🌪️" },
    85:  { name: "No-Life Sailor", color: "#34495e", msg: "Is there even a real world outside? 🏚️" },
    90:  { name: "Typing Beast", color: "#e67e22", msg: "Your hands are a blur! Stop them if you can! 🦁" },
    95:  { name: "Chat Hurricane", color: "#d35400", msg: "The chat is shaking from your activity! 💨" },
    100: { name: "Infinite Talker", color: "#e67e22", msg: "Does this guy ever stop for breath? ♾️" },
    110: { name: "Spam Lord", color: "#d35400", msg: "All hail the master of the fast type! 👑" },
    120: { name: "Den Den Master", color: "#e67e22", msg: "You own the communication lines! 📞💎" },
    130: { name: "Touch Grass Needed 🌱❌", color: "#e74c3c", msg: "Go outside. The sun won't hurt you, I promise. ☀️" },
    140: { name: "Sleep Is Optional", color: "#c0392b", msg: "Sleep is for the weak. Spam is for the legends. 💤" },
    150: { name: "Server Resident", color: "#e74c3c", msg: "You literally live here now. Rent is due! 🏠" },
    160: { name: "Keyboard Destroyer", color: "#c0392b", msg: "How many keyboards have you broken so far? ⌨️💥" },
    170: { name: "No Break Pirate", color: "#e74c3c", msg: "Breaks are for marines. Pirates never stop! ⚓" },
    180: { name: "Chat Emperor", color: "#f1c40f", msg: "Your words rule these waters! 👑" },
    190: { name: "Spam Yonko", color: "#f39c12", msg: "One of the four Great Spam-lords! 🚩" },
    200: { name: "Message King", color: "#f1c40f", msg: "The ultimate title for the ultimate talker! 🏆" },
    210: { name: "Server Overlord", color: "#ffffff", msg: "The server is your kingdom. ✨" },
    220: { name: "Grass Avoider 🌱❌", color: "#ffeb3b", msg: "Legend says he hasn't seen a tree since 2012. 👑🔥" }
};

const FUNNY_FALLBACKS = [
    "Still a nobody, but at least you're a louder nobody now. 🤡",
    "Level up! Sadly, your reputation is still 0. 📉",
    "Congratulations! You've achieved... absolutely nothing new. ✨"
];

// Функция за запис
async function saveToDatabase(pool, userId, data) {
    const query = `INSERT INTO levels (user_id, xp, level, username) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3, username = $4;`;
    try { await pool.query(query, [userId, data.xp, data.level, data.username]); } catch (e) { console.error("DB Error:", e); }
}

async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) { try { role = await guild.roles.create({ name: roleData.name, color: roleData.color, reason: 'Automated Rank' }); } catch (e) { console.error(e); } }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    // --- ЗАЩИТА 1: ЗАРЕЖДАНЕ НА КЕША ПРИ СТАРТ ---
    async function loadCacheFromDB() {
        try {
            const res = await pool.query('SELECT user_id, xp, level, username FROM levels');
            res.rows.forEach(row => {
                xpCache.set(row.user_id, { xp: parseInt(row.xp), level: parseInt(row.level), username: row.username, needsUpdate: false });
            });
            console.log(`[System] Заредени ${res.rowCount} профила от Neon.`);
        } catch (e) { console.error("Грешка при зареждане на кеша:", e); }
    }

    loadCacheFromDB();

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;
        const userId = message.author.id;

        // --- ЗАЩИТА 2: ПРОВЕРКА В БД, АКО ЛИПСВА В КЕША ---
        let userData = xpCache.get(userId);
        if (!userData) {
            const dbRes = await pool.query('SELECT xp, level, username FROM levels WHERE user_id = $1', [userId]);
            if (dbRes.rows.length > 0) {
                userData = { xp: parseInt(dbRes.rows[0].xp), level: parseInt(dbRes.rows[0].level), username: dbRes.rows[0].username, needsUpdate: false };
            } else {
                userData = { xp: 0, level: 1, username: message.member.displayName, needsUpdate: true };
            }
            xpCache.set(userId, userData);
        }

        // Автоматична роля за Ниво 1 (Recruit)
        if (userData.level === 1) {
            const role1 = RANK_ROLES[1];
            if (!message.member.roles.cache.some(r => r.name === role1.name)) {
                const role = await getOrCreateRole(message.guild, role1);
                if (role) await message.member.roles.add(role).catch(() => {});
            }
        }

        // --- КОМАНДА !RANK (С ОБРАТНО БРОЕНЕ) ---
        if (message.content.toLowerCase().startsWith('!rank')) {
            message.delete().catch(() => {});
            const rankChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;
            const nextXP = userData.level * 500;
            const roleInfo = RANK_ROLES[userData.level];
            let timeLeft = 60;

            const embed = new EmbedBuilder()
                .setTitle(`⚓ ${message.member.displayName}'s Status`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setColor(roleInfo?.color || '#34495e')
                .addFields(
                    { name: '👤 Title', value: `**${roleInfo?.name || "Wanderer"}**`, inline: true },
                    { name: '📈 Level', value: `\`${userData.level}\``, inline: true },
                    { name: '📊 Progress', value: createProgressBar(userData.xp, nextXP), inline: false }
                )
                .setFooter({ text: `Auto-deleting in ${timeLeft}s` });

            const rankMsg = await rankChannel.send({ content: `⚓ ${message.author}, check your status:`, embeds: [embed] });

            const countdown = setInterval(async () => {
                timeLeft -= 10;
                if (timeLeft <= 0) { clearInterval(countdown); return rankMsg.delete().catch(() => {}); }
                const updatedEmbed = EmbedBuilder.from(embed).setFooter({ text: `Auto-deleting in ${timeLeft}s` });
                await rankMsg.edit({ embeds: [updatedEmbed] }).catch(() => clearInterval(countdown));
            }, 10000);
            return;
        }

        // --- КОМАНДА !TOP ---
        if (message.content.toLowerCase() === '!top') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                message.delete().catch(() => {});
                return;
            }
            const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
            if (!statsChannel) return;
            message.delete().catch(() => {});

            const res = await pool.query('SELECT username, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const desc = res.rows.map((row, i) => `\`#${i + 1}\` **${row.username}** — Level \`${row.level}\` (${row.xp} XP)`).join('\n');

            const variants = [
                { t: '🏴‍☠️ THE NOISIEST PIRATES ON DECK!', d: `*Arrr! These sea dogs be makin’ the most noise across the seven seas:* \n\n${desc}` },
                { t: '🍻 WHO WON’T SHUT UP?!', d: `*These pirates drank too much rum and haven’t stopped talkin’ since...*\n\n${desc}` },
                { t: '⚓ CREW CHATTER CHAMPIONS', d: `*The loudest voices aboard the ship at this very moment:*\n\n${desc}` },
                { t: '🔥 TOP SPAM LORDS', d: `*Current legends of chaos and chatter:*\n\n${desc}` },
                { t: '💀 THE TAVERN’S LOUDEST LEGENDS', d: `*If silence was gold, these pirates would be broke:*\n\n${desc}` }
            ];

            const v = variants[Math.floor(Math.random() * variants.length)];
            const embed = new EmbedBuilder()
                .setTitle(v.t).setDescription(v.d).setColor('#FF4500')
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setFooter({ text: '☠️ This list will vanish into the mist in 60 seconds...' })
                .setTimestamp();

            return statsChannel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 60000));
        }

        // --- КОМАНДА !SYNC ---
        if (message.content.toLowerCase() === '!sync' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            message.delete().catch(() => {}); 
            
            let count = 0;
            for (const [id, data] of xpCache.entries()) { 
                if (data.needsUpdate) { 
                    await saveToDatabase(pool, id, data); 
                    data.needsUpdate = false; 
                    count++; 
                } 
            }

            if (logChannel) {
                const syncEmbed = new EmbedBuilder()
                    .setTitle('♻️ Manual Sync Executed')
                    .setDescription(`Admin **${message.member.displayName}** triggered a manual sync.\nUpdated **${count}** pirate profiles in Neon.`)
                    .setColor('#2ecc71').setTimestamp();
                logChannel.send({ embeds: [syncEmbed] });
            }
            return;
        }

        // --- ЛОГИКА ЗА XP ---
        let xpGain = message.attachments.size > 0 ? 35 : 15; 
        let userData = xpCache.get(userId);

        if (!userData) {
            // Опит за възстановяване от БД при съобщение, ако кеша е празен
            const dbRes = await pool.query('SELECT xp, level, username FROM levels WHERE user_id = $1', [userId]);
            if (dbRes.rows.length > 0) {
                userData = { xp: dbRes.rows[0].xp, level: dbRes.rows[0].level, username: dbRes.rows[0].username, needsUpdate: false };
            } else {
                userData = { xp: 0, level: 1, username: message.member.displayName, needsUpdate: false };
            }
        }
        
        userData.username = message.member.displayName;
        userData.xp += xpGain;
        let nextLevelXP = userData.level * 500; 

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            userData.xp = 0; // Рестартираме XP при качване на ниво
            const roleData = RANK_ROLES[userData.level];
            const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);

            if (lvlChannel) {
                const customMsg = roleData ? roleData.msg : FUNNY_FALLBACKS[Math.floor(Math.random() * FUNNY_FALLBACKS.length)];
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${message.member.displayName} ranked up!`, iconURL: message.author.displayAvatarURL() })
                    .setDescription(`Congratulations ${message.author}!\n🔹 **Level:** \`${userData.level}\`\n🔹 **Status:** **${roleData?.name || "Wanderer"}**\n\n> *"${customMsg}"*`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setColor(roleData?.color || '#34495e');
                lvlChannel.send({ content: `${message.author}`, embeds: [embed] });
            }

            if (roleData) {
                const newRole = await getOrCreateRole(message.guild, roleData);
                if (newRole) {
                    const allRanks = Object.values(RANK_ROLES).map(r => r.name);
                    const oldRoles = message.member.roles.cache.filter(r => allRanks.includes(r.name));
                    if (oldRoles.size > 0) await message.member.roles.remove(oldRoles).catch(() => {});
                    await message.member.roles.add(newRole).catch(() => {});
                }
            }
            await saveToDatabase(pool, userId, userData);
            userData.needsUpdate = false;
        } else { 
            userData.needsUpdate = true; 
        }
        xpCache.set(userId, userData);
    });

    // СЕДМИЧЕН ТОП 10
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
            const embed = new EmbedBuilder().setTitle(style.title).setColor('#FF4500').setDescription(`*${style.desc}*\n\n${desc}`).setFooter({ text: 'Weekly Ship Log' }).setTimestamp();
            statsChannel.send({ content: "🔔 **WEEKLY LEADERBOARD IS HERE!**", embeds: [embed] });
        } catch (e) { console.error("Cron Leaderboard Error:", e); }
    }, { timezone: "Europe/London" });

    // АВТОМАТИЧНА СИНХРОНИЗАЦИЯ НА ВСЕКИ 2 ЧАСА
    cron.schedule('0 */2 * * *', async () => {
        console.log('--- Background Sync Started ---');
        const guild = client.guilds.cache.get(TARGET_GUILD_ID);
        if (!guild) return;
        try {
            const allRankNames = Object.values(RANK_ROLES).map(r => r.name);
            const res = await pool.query('SELECT user_id, level FROM levels WHERE level > 0');
            for (const row of res.rows) {
                const member = await guild.members.fetch(row.user_id).catch(() => null);
                if (!member) continue;
                const currentRoleData = RANK_ROLES[row.level];
                if (currentRoleData) {
                    const targetRole = await getOrCreateRole(guild, currentRoleData);
                    if (targetRole && !member.roles.cache.has(targetRole.id)) {
                        const rolesToRemove = member.roles.cache.filter(r => allRankNames.includes(r.name) && r.id !== targetRole.id);
                        if (rolesToRemove.size > 0) await member.roles.remove(rolesToRemove).catch(() => {});
                        await member.roles.add(targetRole).catch(() => {});
                    }
                }
            }
            for (const [id, data] of xpCache.entries()) {
                if (data.needsUpdate) { await saveToDatabase(pool, id, data); data.needsUpdate = false; }
            }
            console.log('--- Background Sync Finished ---');
        } catch (e) { console.error("Sync Error:", e); }
    }, { timezone: "Europe/London" });
};
