const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --- КОНФИГУРАЦИЯ ---
const TARGET_GUILD_ID = 'ID_НА_ТВОЯ_СЪРВЪР'; 
const LOG_CHANNEL_ID = 'ID_НА_ЛОГ_КАНАЛА';   
const STATS_CHANNEL_ID = 'ID_ЗА_ТОП_10';     
// --------------------

const xpCache = new Map(); 

// ПЪЛЕН СПИСЪК С 35 ПИРАТСКИ РОЛИ
const RANK_ROLES = {
    1:   { name: "Bilge Rat", color: "#7f8c8d" },
    3:   { name: "Deck Hand", color: "#95a5a6" },
    5:   { name: "Swabber", color: "#bdc3c7" },
    7:   { name: "Cabin Boy", color: "#ecf0f1" },
    10:  { name: "Ship's Cook", color: "#e67e22" },
    13:  { name: "Powder Monkey", color: "#d35400" },
    16:  { name: "Lighthouse Keeper", color: "#f39c12" },
    20:  { name: "Helmsman", color: "#2ecc71" },
    24:  { name: "Lookout", color: "#27ae60" },
    28:  { name: "Oarsman", color: "#16a085" },
    32:  { name: "Boatswain", color: "#1abc9c" },
    36:  { name: "Musketeer", color: "#3498db" },
    40:  { name: "Master Gunner", color: "#2980b9" },
    45:  { name: "Cannoneer", color: "#c0392b" },
    50:  { name: "Shipwright", color: "#a0522d" },
    55:  { name: "Quartermaster", color: "#d35400" },
    60:  { name: "First Mate", color: "#e74c3c" },
    65:  { name: "Navigator", color: "#34495e" },
    70:  { name: "Sloop Captain", color: "#8e44ad" },
    75:  { name: "Brigantine Captain", color: "#9b59b6" },
    80:  { name: "Frigate Captain", color: "#f1c40f" },
    85:  { name: "Galleon Commander", color: "#f39c12" },
    90:  { name: "Corsair", color: "#e67e22" },
    95:  { name: "Privateer", color: "#d35400" },
    100: { name: "Sea Rover", color: "#c0392b" },
    110: { name: "Commodore", color: "#e91e63" },
    120: { name: "Rear Admiral", color: "#9c27b0" },
    130: { name: "Vice Admiral", color: "#673ab7" },
    140: { name: "Fleet Admiral", color: "#3f51b5" },
    150: { name: "Scourge of the Ocean", color: "#2196f3" },
    160: { name: "Sea Lord", color: "#00bcd4" },
    170: { name: "Tide Master", color: "#009688" },
    180: { name: "Legendary Pirate", color: "#ffeb3b" },
    190: { name: "Pirate King", color: "#f1c40f" },
    200: { name: "Immortal Captain", color: "#ffffff" }
};

// Функция за запис в таблица "levels"
async function saveToDatabase(pool, userId, data) {
    const query = `
        INSERT INTO levels (user_id, xp, level) VALUES ($1, $2, $3) 
        ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3;
    `;
    await pool.query(query, [userId, data.xp, data.level]);
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
                reason: 'Automated Leveling System'
            });
        } catch (e) { console.error("Error creating role:", e); }
    }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    client.on('messageCreate', async (message) => {
        // Проверка: Работи само в зададения сървър и игнорира ботове
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;

        const userId = message.author.id;
        let xpGain = message.attachments.size > 0 ? 35 : 15; 

        let userData = xpCache.get(userId) || { xp: 0, level: 1, needsUpdate: false };
        userData.xp += xpGain;

        let nextLevelXP = userData.level * 500; 

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            message.reply(`🏴‍☠️ **Level Up!** Congratulations ${message.author}, you are now level **${userData.level}**!`);

            // Проверка дали на това ниво се дава роля
            if (RANK_ROLES[userData.level]) {
                const role = await getOrCreateRole(message.guild, RANK_ROLES[userData.level]);
                if (role) await message.member.roles.add(role).catch(() => {});
            }
            await saveToDatabase(pool, userId, userData);
            userData.needsUpdate = false;
        } else {
            userData.needsUpdate = true; 
        }
        xpCache.set(userId, userData);
    });

    // Седмичен Топ 10
    setInterval(async () => {
        const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (!statsChannel) return;
        try {
            const res = await pool.query('SELECT user_id, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const embed = new EmbedBuilder()
                .setTitle('🏆 Weekly Top 10 Pirates')
                .setColor('#f1c40f')
                .setTimestamp()
                .setDescription(res.rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — Level \`${row.level}\` (${row.xp} XP)`).join('\n') || "No data.");
            statsChannel.send({ embeds: [embed] });
        } catch (e) { console.error("Leaderboard error:", e); }
    }, 604800000);

    // Синхронизация на всеки 15 минути
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
                    .setTitle('📊 Leveling Sync')
                    .setDescription(`Successfully synced **${syncCount}** active members to table "levels".`)
                    .setColor('#2ecc71')
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }
    }, 900000); 
};
