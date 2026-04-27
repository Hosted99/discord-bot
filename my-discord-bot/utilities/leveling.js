const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --- КОНФИГУРАЦИЯ ---
const TARGET_GUILD_ID = '1486343040162468003'; 
const LEVEL_UP_CHANNEL_ID = '1498426382219481248'; 
const LOG_CHANNEL_ID = '1498426571806085192';   
const STATS_CHANNEL_ID = '1498426456143958027';     
// --------------------

const xpCache = new Map();

// СПИСЪК С РОЛИТЕ
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
    "You're climbing the ladder, but it's leaning against the wrong wall. 🪜",
    "Congratulations! You've achieved... absolutely nothing new. ✨",
    "Wow, Level Up! Even the sea gulls are unimpressed. 🐦"
];

async function saveToDatabase(pool, userId, data) {
    const query = `INSERT INTO levels (user_id, xp, level) VALUES ($1, $2, $3) 
                   ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3;`;
    try { await pool.query(query, [userId, data.xp, data.level]); } catch (e) { console.error("DB Error:", e); }
}

async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) {
        try {
            role = await guild.roles.create({ name: roleData.name, color: roleData.color, reason: 'Automated Rank' });
        } catch (e) { console.error(e); }
    }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;

        const userId = message.author.id;
        let xpGain = message.attachments.size > 0 ? 35 : 15; 

        let userData = xpCache.get(userId) || { xp: 0, level: 1, needsUpdate: false };

        // --- ЛОГИКА ЗА НИВО 1 (НОВОБРАНЦИ) ---
        if (userData.level === 1) {
            const startRoleData = RANK_ROLES[1];
            const hasRole = message.member.roles.cache.some(r => r.name === startRoleData.name);
            
            if (!hasRole) {
                const startRole = await getOrCreateRole(message.guild, startRoleData);
                if (startRole) {
                    await message.member.roles.add(startRole).catch(() => {});
                    const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                    if (lvlChannel) {
                        const embed = new EmbedBuilder()
                            .setAuthor({ name: `${message.author.username} joined the crew!`, iconURL: 'https://imgur.com' })
                            .setTitle('🏴‍☠️ NEW RECRUIT SPOTTED')
                            .setDescription(`Welcome ${message.author} to the **Sailing Kingdom**!\n\n🔹 **Level:** \`1\`\n🔹 **Status:** **${startRoleData.name}**\n\n> *"${startRoleData.msg}"*`)
                            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                            .setColor(startRoleData.color)
                            .setFooter({ text: 'Sailing Kingdom | Official Log', iconURL: message.guild.iconURL() })
                            .setTimestamp();
                        lvlChannel.send({ content: `⚓ **New Pirate Aboard!** ${message.author} has started their journey!`, embeds: [embed] });
                    }
                }
            }
        }

        userData.xp += xpGain;
        let nextLevelXP = userData.level * 500; 

        // --- ЛОГИКА ЗА LEVEL UP ---
        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const roleData = RANK_ROLES[userData.level];

            const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
            if (lvlChannel) {
                const customMsg = roleData ? roleData.msg : FUNNY_FALLBACKS[Math.floor(Math.random() * FUNNY_FALLBACKS.length)];
                const rankName = roleData ? roleData.name : "Just a Wanderer";

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${message.author.username} ranked up!`, iconURL: 'https://imgur.com' })
                    .setTitle('🏴‍☠️ SHIP LOG UPDATE')
                    .setDescription(`Congratulations ${message.author}!\n\n🔹 **Level:** \`${userData.level}\`\n🔹 **Status:** **${rankName}**\n\n> *"${customMsg}"*`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setColor(roleData ? roleData.color : '#34495e')
                    .setFooter({ text: 'Sailing Kingdom | Official Log', iconURL: message.guild.iconURL() })
                    .setTimestamp();
                
                lvlChannel.send({ content: `⚓ **Attention Crew!** ${message.author} has reached Level ${userData.level}!`, embeds: [embed] });
            }

            if (roleData) {
                const newRole = await getOrCreateRole(message.guild, roleData);
                if (newRole) {
                    const allRankNames = Object.values(RANK_ROLES).map(r => r.name);
                    const currentRankRoles = message.member.roles.cache.filter(r => allRankNames.includes(r.name));
                    if (currentRankRoles.size > 0) await message.member.roles.remove(currentRankRoles).catch(() => {});
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

    // СЕДМИЧЕН ТОП 10 (Класация)
    setInterval(async () => {
        const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (!statsChannel) return;
        const headers = [
            { title: '🏆 The Most Wanted Grass Avoiders 🌱❌', desc: 'They have forgotten what the sun looks like...' },
            { title: '🏴‍☠️ The Loudest Pirates on the Deck 📢', desc: 'Hide your ears! These sailors never stop talking!' }
        ];
        const style = headers[Math.floor(Math.random() * headers.length)];
        try {
            const res = await pool.query('SELECT user_id, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const embed = new EmbedBuilder()
                .setTitle(style.title).setColor('#f1c40f')
                .setDescription(`*${style.desc}*\n\n` + res.rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — Level \`${row.level}\` ⚡`).join('\n'))
                .setTimestamp();
            statsChannel.send({ embeds: [embed] });
        } catch (e) { console.error(e); }
    }, 604800000);

    // СИНХРОНИЗАЦИЯ НА 2 ЧАСА (7200000 ms)
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
                    .setDescription(`Synced **${syncCount}** active pirates.`).setColor('#2ecc71').setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }
    }, 7200000); 
};
