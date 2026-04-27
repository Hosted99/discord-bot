const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --- КОНФИГУРАЦИЯ (Попълни своите ID-та тук) ---
const TARGET_GUILD_ID = 'ID_НА_ТВОЯ_СЪРВЪР'; 
const LEVEL_UP_CHANNEL_ID = 'ID_НА_КАНАЛА_ЗА_НИВА'; 
const LOG_CHANNEL_ID = 'ID_НА_ЛОГ_КАНАЛА';   
const STATS_CHANNEL_ID = 'ID_ЗА_ТОП_10';     
// ----------------------------------------------

const xpCache = new Map(); // Кеш за точките (RAM)

// СПИСЪК С 35 РОЛИ И ИНДИВИДУАЛНИ СЪОБЩЕНИЯ
const RANK_ROLES = {
    1:   { name: "Bilge Rat", color: "#7f8c8d", msg: "Welcome aboard, scallywag! Start scrubbing the floors! 🐀" },
    3:   { name: "Deck Hand", color: "#95a5a6", msg: "You've earned your spot on the deck. Keep an eye on the horizon! 🌊" },
    5:   { name: "Swabber", color: "#bdc3c7", msg: "The deck is shining! You're getting the hang of this. 🧹" },
    7:   { name: "Cabin Boy", color: "#ecf0f1", msg: "Keep the captain's boots clean and you might survive! 👞" },
    10:  { name: "Ship's Cook", color: "#e67e22", msg: "The crew is hungry! Grab the grog and start cooking! 🍳" },
    13:  { name: "Powder Monkey", color: "#d35400", msg: "Run fast with that gunpowder, or things will go boom! 💣" },
    16:  { name: "Lighthouse Keeper", color: "#f39c12", msg: "Guide us through the fog, old soul. 🏮" },
    20:  { name: "Helmsman", color: "#2ecc71", msg: "Hold the wheel steady! We sail for glory! ⚓" },
    24:  { name: "Lookout", color: "#27ae60", msg: "Land ho! Your eyes are as sharp as a cutlass. 🔭" },
    28:  { name: "Oarsman", color: "#16a085", msg: "Row until your hands bleed! We need more speed! 🛶" },
    32:  { name: "Boatswain", color: "#1abc9c", msg: "Keep the crew in line! No slacking on my ship! ⛓️" },
    36:  { name: "Musketeer", color: "#3498db", msg: "Ready... Aim... Fire! Your aim is true. 🔫" },
    40:  { name: "Master Gunner", color: "#2980b9", msg: "Show them the power of our cannons! 💥" },
    45:  { name: "Cannoneer", color: "#c0392b", msg: "Another broadside! Send them to the locker! 🌊" },
    50:  { name: "Shipwright", color: "#a0522d", msg: "Patch the holes! This ship must never sink. 🛠️" },
    55:  { name: "Quartermaster", color: "#d35400", msg: "Split the loot fairly, or face the plank! 💰" },
    60:  { name: "First Mate", color: "#e74c3c", msg: "The Captain's right hand. Respect is earned. ⚔️" },
    65:  { name: "Navigator", color: "#34495e", msg: "The stars are our only map. Lead the way. 🧭" },
    70:  { name: "Sloop Captain", color: "#8e44ad", msg: "A small ship, but a brave heart. ⛵" },
    75:  { name: "Brigantine Captain", color: "#9b59b6", msg: "Master of the mid-seas. Fast and deadly! 🏹" },
    80:  { name: "Frigate Captain", color: "#f1c40f", msg: "A true man-o-war! None shall pass! 🛡️" },
    85:  { name: "Galleon Commander", color: "#f39c12", msg: "The gold is ours! Guard the treasure! 💎" },
    90:  { name: "Corsair", color: "#e67e22", msg: "A shadow in the night. Strike fast! 🗡️" },
    95:  { name: "Privateer", color: "#d35400", msg: "Sailing under the crown's shadow. 🎖️" },
    100: { name: "Sea Rover", color: "#c0392b", msg: "A century of sailing! You are a legend. 🏴‍☠️" },
    110: { name: "Commodore", color: "#e91e63", msg: "Leading the fleet to victory! 🚩" },
    120: { name: "Rear Admiral", color: "#9c27b0", msg: "The strategy is yours. Conquer them all! 📈" },
    130: { name: "Vice Admiral", color: "#673ab7", msg: "Your word is law on the ocean. 📜" },
    140: { name: "Fleet Admiral", color: "#3f51b5", msg: "The entire armada bows to you! 🚢" },
    150: { name: "Scourge of the Ocean", color: "#2196f3", msg: "Even the Kraken fears your name! 🐙" },
    160: { name: "Sea Lord", color: "#00bcd4", msg: "The tides obey your command. 🔱" },
    170: { name: "Tide Master", color: "#009688", msg: "Master of the deep blue. 🌀" },
    180: { name: "Legendary Pirate", color: "#ffeb3b", msg: "The legends were true... You are the king! 👑" },
    190: { name: "Pirate King", color: "#f1c40f", msg: "Every port in the world knows your flag! 🌎" },
    200: { name: "Immortal Captain", color: "#ffffff", msg: "Death has no power over you. Sail forever! ✨" }
};

// Функция за запис в таблица "levels"
async function saveToDatabase(pool, userId, data) {
    const query = `
        INSERT INTO levels (user_id, xp, level) VALUES ($1, $2, $3) 
        ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3;
    `;
    try { await pool.query(query, [userId, data.xp, data.level]); } catch (e) { console.error("DB Save Error:", e); }
}

// Функция за автоматично управление на роли
async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) {
        try {
            role = await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                reason: 'Automated Leveling System Rank'
            });
        } catch (e) { console.error("Role Creation Error:", e); }
    }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool; // Взимаме pool от обекта

    client.on('messageCreate', async (message) => {
        // ОГРАНИЧЕНИЕ: Само за определен сървър и без ботове
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;

        const userId = message.author.id;
        let xpGain = message.attachments.size > 0 ? 35 : 15; // Бонус за снимки

        let userData = xpCache.get(userId) || { xp: 0, level: 1, needsUpdate: false };
        userData.xp += xpGain;

        let nextLevelXP = userData.level * 500; // Формула за прогрес

        // ПРОВЕРКА ЗА ВДИГАНЕ НА НИВО
        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const roleData = RANK_ROLES[userData.level];

            // Пращане на съобщение само в определен канал
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

            // Автоматично даване на роля
            if (roleData) {
                const role = await getOrCreateRole(message.guild, roleData);
                if (role) await message.member.roles.add(role).catch(() => {});
            }

            // Записваме веднага в Neon при Level Up
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
        try {
            const res = await pool.query('SELECT user_id, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const embed = new EmbedBuilder()
                .setTitle('🏆 The Legendary Top 10 Pirates')
                .setColor('#f1c40f')
                .setTimestamp()
                .setDescription(res.rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — Level \`${row.level}\` (${row.xp} XP)`).join('\n') || "No legends found yet.");
            statsChannel.send({ embeds: [embed] });
        } catch (e) { console.error("Leaderboard error:", e); }
    }, 604800000); // 7 дни

    // СИНХРОНИЗАЦИЯ С NEON (на всеки 1 час)
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
                    .setDescription(`Successfully synced **${syncCount}** active pirates to the logs.`)
                    .setColor('#2ecc71')
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }
    }, 7200000); // 1 час
};
