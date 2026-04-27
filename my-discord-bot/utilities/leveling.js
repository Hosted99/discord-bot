const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --- КОНФИГУРАЦИЯ (Сложи твоите ID-та тук) ---
const TARGET_GUILD_ID = 'ID_НА_ТВОЯ_СЪРВЪР'; 
const LEVEL_UP_CHANNEL_ID = 'ID_НА_КАНАЛА_ЗА_НИВА'; 
const LOG_CHANNEL_ID = 'ID_НА_ЛОГ_КАНАЛА';   
const STATS_CHANNEL_ID = 'ID_ЗА_ТОП_10';     
// ----------------------------------------------

const xpCache = new Map(); // Кеш памет за XP

// СПИСЪК С 35 РОЛИ, ЦВЕТОВЕ И СЪОБЩЕНИЯ
const RANK_ROLES = {
    // 🐌 Low Activity (just started typing)
    1:   { name: "Silent Snail 🐌", color: "#7f8c8d", msg: "Welcome to the crew... or are you just watching? 👀" },
    3:   { name: "Keyboard Lost", color: "#95a5a6", msg: "Did you drop your keyboard in the ocean? Say something! 🌊" },
    5:   { name: "Typing… (forever)", color: "#bdc3c7", msg: "The bubble is there, but no message. Suspicious... 💬" },
    8:   { name: "Sea Lurker", color: "#7f8c8d", msg: "Hiding in the deep sea of the chat? We see you! 🐙" },
    10:  { name: "Background NPC", color: "#95a5a6", msg: "The main characters are talking, keep up! 🎮" },

    // 💬 Starting to talk
    15:  { name: "Chat Rookie", color: "#2ecc71", msg: "First steps into the world of chatter! ⚓" },
    20:  { name: "Word Dripper", color: "#27ae60", msg: "One word at a time... you're getting there. 💧" },
    25:  { name: "Slow Typist", color: "#16a085", msg: "Slow and steady wins the race? Not in a pirate fight! 🐢" },
    30:  { name: "Casual Talker", color: "#2ecc71", msg: "Just enjoying a grog and a chat in the tavern. 🍻" },
    35:  { name: "Den Den Beginner", color: "#1abc9c", msg: "Starting to use the Den Den Mushi properly! 📞" },

    // 📈 Getting active
    40:  { name: "Message Machine", color: "#3498db", msg: "You're starting to pump those numbers up! ⚙️" },
    45:  { name: "Chat Sailor", color: "#2980b9", msg: "Sailing through the sea of messages! ⛵" },
    50:  { name: "Spam Apprentice", color: "#3498db", msg: "You're learning the dark arts of spamming... ✍️" },
    55:  { name: "Typing Pirate", color: "#2980b9", msg: "Your fingers are fast as a cutlass! ⚔️" },
    60:  { name: "Den Den Caller", color: "#34495e", msg: "Bero-bero-bero-bero! You never hang up! 🐌🔊" },

    // 😂 Clearly addicted
    65:  { name: "Keyboard Warrior", color: "#9b59b6", msg: "Your keyboard is your strongest weapon! 🛡️" },
    70:  { name: "Spam Cannon", color: "#8e44ad", msg: "Boom! Messages flying everywhere! 💣" },
    75:  { name: "Chat Addict", color: "#9b59b6", msg: "You can't go 5 minutes without checking the chat, can you? 💉" },
    80:  { name: "Message Storm", color: "#8e44ad", msg: "A literal hurricane of words! 🌪️" },
    85:  { name: "No-Life Sailor", color: "#34495e", msg: "Is there even a real world outside the ship? 🏚️" },

    // 🔥 High activity (spam mode)
    90:  { name: "Typing Beast", color: "#e67e22", msg: "Your hands are a blur! Stop them if you can! 🦁" },
    95:  { name: "Chat Hurricane", color: "#d35400", msg: "The chat is shaking from your activity! 💨" },
    100: { name: "Infinite Talker", color: "#e67e22", msg: "Does this guy ever stop for breath? ♾️" },
    110: { name: "Spam Lord", color: "#d35400", msg: "All hail the master of the fast type! 👑" },
    120: { name: "Den Den Master", color: "#e67e22", msg: "You own the communication lines of the New World! 📞💎" },

    // 💀 Too much…
    130: { name: "Touch Grass Needed", color: "#e74c3c", msg: "Go outside. Seriously. The sun won't hurt you. 🌱❌" },
    140: { name: "Sleep Is Optional", color: "#c0392b", msg: "Sleep is for the weak. Spam is for the legends. 💤" },
    150: { name: "Server Resident", color: "#e74c3c", msg: "You literally live in this server now. Rent is due! 🏠" },
    160: { name: "Keyboard Destroyer", color: "#c0392b", msg: "How many mechanical keyboards have you broken so far? ⌨️💥" },
    170: { name: "No Break Pirate", color: "#e74c3c", msg: "Breaks are for marines. Pirates never stop! ⚓" },

    // 👑 Absolute legends
    180: { name: "Chat Emperor", color: "#f1c40f", msg: "Your words rule these waters! 👑" },
    190: { name: "Spam Yonko", color: "#f39c12", msg: "One of the four Great Spam-lords of the sea! 🚩" },
    200: { name: "Message King", color: "#f1c40f", msg: "The ultimate title for the ultimate talker! 🏆" },
    210: { name: "Server Overlord", color: "#ffffff", msg: "The server is your kingdom, and we just live in it. ✨" },
    220: { name: "Grass Avoider 🌱❌", color: "#ffeb3b", msg: "Legend says he hasn't seen a tree since 2012. 👑🔥" }
};


// Функция за запис в таблица "levels"
async function saveToDatabase(pool, userId, data) {
    const query = `INSERT INTO levels (user_id, xp, level) VALUES ($1, $2, $3) 
                   ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3;`;
    try { await pool.query(query, [userId, data.xp, data.level]); } catch (e) { console.error("DB Error:", e); }
}

// Функция за създаване/намиране на роли
async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) {
        try {
            role = await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                reason: 'Automated Leveling Rank'
            });
        } catch (e) { console.error(e); }
    }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    client.on('messageCreate', async (message) => {
        // Проверка: Работи само в твоя сървър и без ботове
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;

        const userId = message.author.id;
        let xpGain = message.attachments.size > 0 ? 35 : 15; 

        let userData = xpCache.get(userId) || { xp: 0, level: 1, needsUpdate: false };
        userData.xp += xpGain;

        let nextLevelXP = userData.level * 500; 

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const roleData = RANK_ROLES[userData.level];

            // 1. ПРАЩАНЕ НА СЪОБЩЕНИЕ В СПЕЦИАЛНИЯ КАНАЛ
            const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
            if (lvlChannel) {
                const customMsg = roleData ? roleData.msg : "The tides are turning in your favor...";
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ Rank Up! | New Title Unlocked')
                    .setDescription(`Congratulations ${message.author}!\n\n**Level:** \`${userData.level}\`\n**Rank:** \`${roleData?.name || "Veteran Pirate"}\` ⚓\n\n> *${customMsg}*`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setColor(roleData ? roleData.color : '#f1c40f')
                    .setTimestamp();
                
                lvlChannel.send({ content: `${message.author}`, embeds: [embed] });
            }

            // 2. УПРАВЛЕНИЕ НА РОЛИ (Премахва старите, дава новата)
            if (roleData) {
                const newRole = await getOrCreateRole(message.guild, roleData);
                if (newRole) {
                    const allRankNames = Object.values(RANK_ROLES).map(r => r.name);
                    const currentRankRoles = message.member.roles.cache.filter(r => allRankNames.includes(r.name));
                    
                    if (currentRankRoles.size > 0) {
                        await message.member.roles.remove(currentRankRoles).catch(() => {});
                    }
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

    // СЕДМИЧЕН ТОП 10 (Leaderboard)
    setInterval(async () => {
        const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (!statsChannel) return;
        try {
            const res = await pool.query('SELECT user_id, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const embed = new EmbedBuilder()
                .setTitle('🏆 The Legendary Top 10 Pirates')
                .setColor('#f1c40f')
                .setTimestamp()
                .setDescription(res.rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — Level \`${row.level}\` (${row.xp} XP)`).join('\n') || "No data.");
            statsChannel.send({ embeds: [embed] });
        } catch (e) { console.error(e); }
    }, 604800000);

    // СИНХРОНИЗАЦИЯ НА ВСЕКИ 1 ЧАС
    setInterval(async () => {
        let syncCount = 0;
        for (const [userId, data] of xpCache.entries()) {
            if (data.needsUpdate) {
                await saveToDatabase(pool, userId, data);
                data.needsUpdate = false;
                syncCount++;
            }
        }
        if (syncCount > 0) {
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📊 Leveling Sync Complete')
                    .setDescription(`Successfully synced **${syncCount}** active members.`)
                    .setColor('#2ecc71')
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }
    }, 7200000); 
};
