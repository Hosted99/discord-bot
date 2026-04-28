const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');

// --- КОНФИГУРАЦИЯ ---
const TARGET_GUILD_ID = '1486343040162468003'; 
const LEVEL_UP_CHANNEL_ID = '1498426382219481248'; 
const LOG_CHANNEL_ID = '1498426571806085192';   
const STATS_CHANNEL_ID = '1498426456143958027';     

// Локален кеш за бърз достъп до XP данните на потребителите
const messageTracker = new Map();
const warnTracker = new Map();

// Функция за създаване на визуален прогрес бар (например: [▇▇▇——] 60%)
function createProgressBar(current, total, size = 10) {
    const progress = Math.min(size, Math.floor((current / total) * size));
    const emptyProgress = size - progress;
    return `\`[${'▇'.repeat(progress)}${'—'.repeat(emptyProgress)}]\` ${Math.floor((current / total) * 100)}%`;
}

// СПИСЪК С РОЛИТЕ (РАНГОВЕ) И СЪОТВЕТНИТЕ НИВА
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

// Забавни съобщения при качване на ниво, ако няма конкретно за ранга
const FUNNY_FALLBACKS = [
    "Still a nobody, but at least you're a louder nobody now. 🤡",
    "Level up! Sadly, your reputation is still 0. 📉",
    "Congratulations! You've achieved... absolutely nothing new. ✨"
];

// Функция за запис на данни в Neon базата данни
async function saveToDatabase(pool, userId, data) {
    const query = `INSERT INTO levels (user_id, xp, level, username) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3, username = $4;`;
    try { await pool.query(query, [userId, data.xp, data.level, data.username]); } catch (e) { console.error("DB Error:", e); }
}

// Функция за намиране или автоматично създаване на роля в сървъра
async function getOrCreateRole(guild, roleData) {
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;
    let role = guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) { try { role = await guild.roles.create({ name: roleData.name, color: roleData.color, reason: 'Automated Rank' }); } catch (e) { console.error(e); } }
    return role;
}

module.exports = (client, poolObj) => {
    const pool = poolObj.pool;

    // --- ЗАЩИТА 1: ЗАРЕЖДАНЕ НА КЕША ОТ БД ПРИ СТАРТ ---
    async function loadCacheFromDB() {
        try {
            const res = await pool.query('SELECT user_id, xp, level, username FROM levels');
            res.rows.forEach(row => {
                xpCache.set(row.user_id, { xp: parseInt(row.xp), level: parseInt(row.level), username: row.username, needsUpdate: false });
            });
            console.log(`[System] Заредени ${res.rowCount} профила от Neon.`);
        } catch (e) { console.error("Cache load error:", e); }
    }

    loadCacheFromDB();

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.guild.id !== TARGET_GUILD_ID) return;
        const userId = message.author.id;

        // --- ЗАЩИТА 2: ВЗЕМАНЕ НА ДАННИ (КЕШ ИЛИ БД) ---
        let userData = xpCache.get(userId);
        if (!userData) {
            const dbRes = await pool.query('SELECT xp, level, username FROM levels WHERE user_id = $1', [userId]);
            if (dbRes.rows.length > 0) {
                // Използваме индекса [0], за да вземем първия намерен запис
                userData = { xp: parseInt(dbRes.rows[0].xp), level: parseInt(dbRes.rows[0].level), username: dbRes.rows[0].username, needsUpdate: false };
            } else {
                // Ако е нов потребител, го създаваме
                userData = { xp: 0, level: 1, username: message.member.displayName, needsUpdate: true };
                await saveToDatabase(pool, userId, userData);
            }
            xpCache.set(userId, userData);
        }

           // --- ЛОГИКА ЗА АВТОМАТИЧНА РОЛЯ (НИВО 1) ---
        const allRankNames = Object.values(RANK_ROLES).map(r => r.name);
        const hasLevelRole = message.member.roles.cache.some(role => allRankNames.includes(role.name));

        if (!hasLevelRole && userData.level >= 1) {
            const role1 = RANK_ROLES[1]; 
            const role = await getOrCreateRole(message.guild, role1);
            if (role) {
                await message.member.roles.add(role).catch(() => {});
                
                // Приветствие в канала за нива
                const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                if (lvlChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setAuthor({ name: `${message.member.displayName} joined the crew!`, iconURL: message.author.displayAvatarURL() })
                        .setTitle('🏴‍☠️ NEW RECRUIT SPOTTED')
                        .setDescription(`Welcome ${message.author}!\n🔹 **Status:** **${role1.name}**\n\n> *"${role1.msg}"*`)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setColor(role1.color);
                    lvlChannel.send({ embeds: [welcomeEmbed] });
                }
            }
        }


        // --- КОМАНДА !RANK (С ОБРАТНО БРОЕНЕ И АВТОМАТИЧНО ИЗТРИВАНЕ) ---
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

            // Таймер за обновяване на ембеда всяка секунда/през 10 сек
            const countdown = setInterval(async () => {
                timeLeft -= 10;
                if (timeLeft <= 0) { clearInterval(countdown); return rankMsg.delete().catch(() => {}); }
                const updatedEmbed = EmbedBuilder.from(embed).setFooter({ text: `Auto-deleting in ${timeLeft}s` });
                await rankMsg.edit({ embeds: [updatedEmbed] }).catch(() => clearInterval(countdown));
            }, 10000);
            return;
        }

        // --- КОМАНДА !TOP (СЛУЧАЙНИ ПИРАТСКИ ВАРИАНТИ) ---
        if (message.content.toLowerCase() === '!top') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) { message.delete().catch(() => {}); return; }
            const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
            if (!statsChannel) return;
            message.delete().catch(() => {});

            const res = await pool.query('SELECT username, level, xp FROM levels ORDER BY level DESC, xp DESC LIMIT 10');
            const desc = res.rows.map((row, i) => `\`#${i + 1}\` **${row.username}** — Level \`${row.level}\` (${row.xp} XP)`).join('\n');

            const variants = [
                { t: '🏴‍☠️ THE NOISIEST PIRATES ON DECK!', d: `*Arrr! These sea dogs be makin’ the most noise:* \n\n${desc}` },
                { t: '🍻 WHO WON’T SHUT UP?!', d: `*These pirates drank too much rum...*\n\n${desc}` },
                { t: '⚓ CREW CHATTER CHAMPIONS', d: `*The loudest voices aboard:*\n\n${desc}` },
                { t: '🔥 TOP SPAM LORDS', d: `*Current legends of chaos:*\n\n${desc}` },
                { t: '💀 THE TAVERN’S LOUDEST LEGENDS', d: `*If silence was gold, they'd be broke:*\n\n${desc}` }
            ];

            const v = variants[Math.floor(Math.random() * variants.length)];
            const embed = new EmbedBuilder().setTitle(v.t).setDescription(v.d).setColor('#FF4500').setThumbnail(message.guild.iconURL({ dynamic: true })).setFooter({ text: '☠️ Vanish in 60s' }).setTimestamp();
            return statsChannel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 60000));
        }

        // --- КОМАНДА !SYNC (РЪЧЕН ЗАПИС В БД) ---
        if (message.content.toLowerCase() === '!sync' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            message.delete().catch(() => {});
            let count = 0;
            for (const [id, data] of xpCache.entries()) { if (data.needsUpdate) { await saveToDatabase(pool, id, data); data.needsUpdate = false; count++; } }
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const syncEmbed = new EmbedBuilder()
                    .setTitle('♻️ Manual Sync Executed')
                    .setDescription(`Admin **${message.member.displayName}** triggered a manual sync.\nUpdated **${count}** pirate profiles in DataBase.`)
                    .setColor('#2ecc71') // Зеленият цвят от снимката
                    .setTimestamp();
                
                logChannel.send({ embeds: [syncEmbed] });
            }
            return;
        }


        //_--------
        
        // --- ИНТЕЛИГЕНТНА ЛОГИКА ЗА XP + ANTI SPAM ---

let now = Date.now();

// 📊 TRACKER: следи колко съобщения е пратил user в кратък прозорец (10 сек)
let track = messageTracker.get(userId) || {
    count: 0,
    lastReset: now
};

// ⚠️ WARNING TRACKER: следи колко предупреждения има user-а
let warnData = warnTracker.get(userId) || {
    warns: 0,
    lastWarnTime: 0
};

// 🔄 reset на брояча на всеки 10 секунди
if (now - track.lastReset > 10000) {
    track.count = 0;
    track.lastReset = now;
}

// ➕ увеличаваме броя съобщения в текущия прозорец
track.count += 1;
messageTracker.set(userId, track);

// 🧮 XP база
let words = message.content.trim().split(/\s+/).length;
let baseXP = message.attachments.size > 0 ? 35 : 15;

// 📏 бонус XP според дължината на съобщението
// +10 XP на всеки 10 думи (до максимум 50 XP)
let lengthBonus = Math.min(Math.floor(words / 10) * 10, 50);

// 🧠 SPAM MULTIPLIER (намаля XP при spam)
let multiplier = 1;
let shouldWarn = false;

// 🟡 лек spam (4–6 съобщения)
if (track.count > 3) {
    multiplier = 0.7;
    shouldWarn = true;
}

// 🟠 среден spam (7–10 съобщения)
if (track.count > 6) {
    multiplier = 0.4;
    shouldWarn = true;
}

// 🔴 тежък spam (10+ съобщения)
if (track.count > 10) {
    multiplier = 0.1;
    shouldWarn = true;
}

// 🧮 финално XP след penalty
let xpGain = Math.floor((baseXP + lengthBonus) * multiplier);

// =========================
// ⚠️ WARNING SYSTEM
// =========================
if (shouldWarn) {

    // ⏱️ анти-spam за warning (на 10 секунди максимум 1 warning)
    if (now - (warnData.lastWarnTime || 0) > 10000) {

        // ➕ увеличаваме warnings
        warnData.warns += 1;
        warnData.lastWarnTime = now;
        warnTracker.set(userId, warnData);

        // 📢 изпращаме warning съобщение
        const warnMsg = await message.channel.send(
            `⚠️ ${message.author} stop spamming! Warning **${warnData.warns}/3**`
        );

        // 🧹 автоматично изтриваме warning съобщението след 5 сек
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

        // =========================
        // 🔇 AUTO MUTE (3 warnings)
        // =========================
        if (warnData.warns >= 3) {

            const member = message.member;

            // 🔒 mute (timeout) ако ботът има права
            if (member && member.moderatable) {
                await member.timeout(10 * 60 * 1000, "Spam - 3 warnings reached");
            }

            // 🔄 reset warnings след mute
            warnTracker.set(userId, { warns: 0, lastWarnTime: 0 });

            // 📢 mute notification
            const muteMsg = await message.channel.send(
                `🔇 ${message.author} has been muted for **10 minutes**.`
            );

            // 🧹 auto delete mute message
            setTimeout(() => muteMsg.delete().catch(() => {}), 8000);
        }
    }
}

///--------

        
        // ПРОВЕРКА ЗА КАЧВАНЕ НА НИВО
        if (userData.xp >= (userData.level * 500)) {
            userData.level++;
            userData.xp = 0; // Нулираме XP за следващото ниво
            const roleData = RANK_ROLES[userData.level];
            const lvlChannel = client.channels.cache.get(LEVEL_UP_CHANNEL_ID);

            if (lvlChannel) {
                const customMsg = roleData ? roleData.msg : FUNNY_FALLBACKS[Math.floor(Math.random() * FUNNY_FALLBACKS.length)];
                const lvEmbed = new EmbedBuilder()
                    .setAuthor({ name: `${message.member.displayName} ranked up!`, iconURL: message.author.displayAvatarURL() })
                    .setDescription(`Congratulations ${message.author}!\n🔹 **Level:** \`${userData.level}\`\n🔹 **Status:** **${roleData?.name || "Wanderer"}**\n\n> *"${customMsg}"*`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setColor(roleData?.color || '#34495e');
                lvlChannel.send({ content: `${message.author}`, embeds: [lvEmbed] });
            }

            // ПРЕМAXВАНЕ НА СТАРИ РОЛИ И ДОБАВЯНЕ НА НОВАТА
            if (roleData) {
                const newRole = await getOrCreateRole(message.guild, roleData);
                if (newRole) {
                    const allRankNames = Object.values(RANK_ROLES).map(r => r.name);
                    const oldRoles = message.member.roles.cache.filter(r => allRankNames.includes(r.name));
                    if (oldRoles.size > 0) await message.member.roles.remove(oldRoles).catch(() => {});
                    await message.member.roles.add(newRole).catch(() => {});
                }
            }
            // Записваме веднага при качване на ниво
            await saveToDatabase(pool, userId, userData);
            userData.needsUpdate = false;
        } else {
            userData.needsUpdate = true; // Отбелязваме, че има нови данни за записване по-късно
        }
        xpCache.set(userId, userData);
    });

    // СЕДМИЧЕН ТОП 10 (ВСЯКА НЕДЕЛЯ В 23:59)
    cron.schedule('59 23 * * 0', async () => {
        const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (!statsChannel) return;
        const headers = [
            { title: '🏆 The Loudest Pirates of the Week', desc: 'The crew members who simply will not shut up! 📢' },
            { title: '🏴‍☠️ Most Wanted Grass Avoiders 🌱❌', desc: 'The weekly report is in: Sunlight is needed!' }
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
        } catch (e) { console.error(e); }
    }, { timezone: "Europe/London" });

    // АВТОМАТИЧНА СИНХРОНИЗАЦИЯ НА ВСЕКИ 2 ЧАСА (ЗА ДА НЕ СЕ ГУБИ ПРОГРЕС)
    cron.schedule('0 */2 * * *', async () => {
        try {
            for (const [id, data] of xpCache.entries()) { 
                if (data.needsUpdate) { 
                    await saveToDatabase(pool, id, data); 
                    data.needsUpdate = false; 
                } 
            }
        } catch (e) { console.error(e); }
    }, { timezone: "Europe/London" });
};
