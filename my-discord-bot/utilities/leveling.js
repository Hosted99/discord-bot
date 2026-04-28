const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --- КОНФИГУРАЦИЯ (ID-тата, които вече попълни) ---
const TARGET_GUILD_ID = '1486343040162468003'; 
const LEVEL_UP_CHANNEL_ID = '1498426382219481248'; 
const LOG_CHANNEL_ID = '1498426571806085192';   
const STATS_CHANNEL_ID = '1498426456143958027';     
// ----------------------------------------------

const xpCache = new Map();

// Функция за визуален прогрес бар
function createProgressBar(current, total, size = 10) {
    const progress = Math.min(size, Math.floor((current / total) * size));
    const emptyProgress = size - progress;
    return `\`[${'▇'.repeat(progress)}${'—'.repeat(emptyProgress)}]\` ${Math.floor((current / total) * 100)}%`;
}

// СПИСЪК С РОЛИТЕ (35 БРОЯ)
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
    "Congratulations! You've achieved... absolutely nothing new. ✨",
    "Wow, Level Up! Even the sea gulls are unimpressed. 🐦"
];

// Функция за запис в Neon
async function saveToDatabase(pool, userId, data) {
    const query = `
        INSERT INTO levels (user_id, xp, level, username) VALUES ($1, $2, $3, $4) 
        ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3, username = $4;
    `;
    try { await pool.query(query, [userId, data.xp, data.level, data.username]); } catch (e) { console.error("DB Error:", e); }
}

async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) {
        try { role = await guild.roles.create({ name: roleData.name, color: roleData.color, reason: 'Automated Rank' }); } catch (e) { console.error(e); }
    }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;
        const userId = message.author.id;

        // --- КОМАНДА !RANK (Самоизтриваща се) ---
        if (message.content.toLowerCase().startsWith('!rank')) {
            const rankChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
            if (!rankChannel) return;

            message.delete().catch(() => {}); // Трие командата !rank

            let dbRes = await pool.query('SELECT xp, level FROM levels WHERE user_id = $1', [userId]);
            let xp = dbRes.rows[0]?.xp || 0, lvl = dbRes.rows[0]?.level || 1;
            const cached = xpCache.get(userId);
            if (cached) { xp = cached.xp; lvl = cached.level; }

            const nextXP = lvl * 500;
            const roleInfo = RANK_ROLES[lvl];
            const embed = new EmbedBuilder()
                .setTitle(`⚓ ${message.author.username}'s Status`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setColor(roleInfo?.color || '#34495e')
                .addFields(
                    { name: '👤 Title', value: `**${roleInfo?.name || "Wanderer"}**`, inline: true },
                    { name: '📈 Level', value: `\`${lvl}\``, inline: true },
                    { name: '📊 Progress', value: createProgressBar(xp, nextXP), inline: false }
                )
                .setFooter({ text: 'Auto-deleting in 60s' });

            return rankChannel.send({ content: `⚓ ${message.author}, here is your rank:`, embeds: [embed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 60000);
            });
        }

        // --- КОМАНДА !TOP (Самоизтриваща се) ---
        if (message.content.toLowerCase() === '!top') {
            const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
            if (!statsChannel) return;

            message.delete().catch(() => {}); // Трие командата !top

            const res = await pool.query('SELECT username, level FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const desc = res.rows.map((r, i) => `**${i + 1}.** ${r.username || 'Unknown'} — Lvl \`${r.level}\``).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('🏆 Most Wanted Pirates')
                .setDescription(desc || "No data.")
                .setColor('#f1c40f')
                .setFooter({ text: 'Auto-deleting in 60s' });

            return statsChannel.send({ embeds: [embed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 60000);
            });
        }

                // --- КОМАНДА !SYNC (Админ) ---
        if (message.content.toLowerCase() === '!sync' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID); // Взимаме лог канала
            
            let count = 0;
            // Изтриваме командата на админа за чистота
            message.delete().catch(() => {}); 

            for (const [id, data] of xpCache.entries()) { 
                if (data.needsUpdate) { 
                    await saveToDatabase(pool, id, data); 
                    data.needsUpdate = false; 
                    count++; 
                } 
            }

            // Пращаме потвърждението в ЛОГ канала
            if (logChannel) {
                const syncEmbed = new EmbedBuilder()
                    .setTitle('♻️ Manual Sync Executed')
                    .setDescription(`Admin **${message.author.username}** triggered a manual sync.\nUpdated **${count}** pirate profiles in Neon.`)
                    .setColor('#2ecc71')
                    .setTimestamp();

                logChannel.send({ embeds: [syncEmbed] });
            }

            // Пращаме кратко съобщение на админа в текущия чат, което се трие бързо
            return message.channel.send(`✅ Sync complete. Check <#${LOG_CHANNEL_ID}> for details.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }


        // --- ЛОГИКА ЗА XP ---
        let xpGain = message.attachments.size > 0 ? 35 : 15; 
        let userData = xpCache.get(userId) || { xp: 0, level: 1, username: message.author.username, needsUpdate: false };
        userData.username = message.author.username;

        // Посрещане на Ниво 1
        if (userData.level === 1 && !message.member.roles.cache.some(r => r.name === RANK_ROLES[1].name)) {
            const role = await getOrCreateRole(message.guild, RANK_ROLES[1]);
            if (role) {
                await message.member.roles.add(role).catch(() => {});
                const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                if (lvlChannel) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `${message.author.username} joined the crew!`, iconURL: 'https://imgur.com' })
                        .setTitle('🏴‍☠️ NEW RECRUIT SPOTTED')
                        .setDescription(`Welcome ${message.author}!\n🔹 **Status:** **${RANK_ROLES[1].name}**\n\n> *"${RANK_ROLES[1].msg}"*`)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setColor(RANK_ROLES[1].color);
                    lvlChannel.send({ embeds: [embed] });
                }
            }
        }

        userData.xp += xpGain;
        let nextLevelXP = userData.level * 500; 

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const roleData = RANK_ROLES[userData.level];
            const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);

            if (lvlChannel) {
                const customMsg = roleData ? roleData.msg : FUNNY_FALLBACKS[Math.floor(Math.random() * FUNNY_FALLBACKS.length)];
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${message.author.username} ranked up!`, iconURL: 'https://imgur.com' })
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
        } else { userData.needsUpdate = true; }
        xpCache.set(userId, userData);
    });

    // Синхронизация на 2 часа
    setInterval(async () => {
        for (const [id, data] of xpCache.entries()) { if (data.needsUpdate) { await saveToDatabase(pool, id, data); data.needsUpdate = false; } }
    }, 7200000); 
};
