const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния
const fs = require('fs');
const path = require('path');
// Пътят отива една папка нагоре и влиза в 'data'
const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

// Глобални променливи за модула
let currentPlanMsgId = null;
let strategyMsgObject = null;
let lastVotedString = ""; // Помни последното състояние на гласовете

// Проверка дали cron изразът е валиден
const isValidCron = (expr) => typeof expr === "string" && cron.validate(expr);

/**
 * Инициализира всички автоматични таймери (Cron Jobs)
 */
function initSchedulers(client, pool) {
    // 1. СТАТИЧНИ НАПОМНЯНИЯ
    staticList.forEach(rem => { 
        if (!isValidCron(rem.cron)) return;

        cron.schedule(rem.cron, () => {
            client.guilds.cache.forEach(async (guild) => {
                const ch = guild.channels.cache.find(c => c.name === "reminders");
                if (ch) {
                    const mention = await getMention(guild, rem.target);
                    const finalMsg = typeof rem.message === 'function' ? rem.message() : rem.message;
                    ch.send(`${mention} ${finalMsg}`);
                }
            });
        }, { timezone: "Europe/London" });
    });

    // 2. ДИНАМИЧНИ НАПОМНЯНИЯ (от база данни)
    pool.query("SELECT * FROM reminders").then(res => {
        res.rows.forEach(rem => {
            if (!isValidCron(rem.cron)) return;

            cron.schedule(rem.cron, () => {
                const ch = client.channels.cache.get(rem.channel_id);
                if (ch) ch.send(rem.message);
            }, { timezone: "Europe/London" });
        });
    });
}

async function handleManiaPlan(msg) {
    const content = msg.content.toLowerCase();
    if (!content.startsWith('mania-plan')) return;

    const MAIN_CHANNEL_ID = '1486343047632523398'; 
    const ROLES = {
        'g1': '1490805399010545794', 
        'g2': '1490805404710469642'  
    };

    // Вземаме всичко след "mania-plan"
    const arg = content.replace('mania-plan', '').trim(); 

    if (arg === 'all') {
        await createPlan(msg, 'g1', ROLES['g1'], MAIN_CHANNEL_ID);
        await createPlan(msg, 'g2', ROLES['g2'], MAIN_CHANNEL_ID);
    } else if (arg === 'g1' || arg === 'g2') {
        await createPlan(msg, arg, ROLES[arg], MAIN_CHANNEL_ID);
    } else {
        // Ако е празно или грешно, ботът ще отговори
        return msg.reply("❌ Write: `mania-plan g1`, `mania-plan g2` or `mania-plan all`").then(m => setTimeout(() => m.delete(), 5000));
    }

    if (msg.deletable) await msg.delete().catch(() => {});
}

async function createPlan(msg, type, roleId, mainChannelId) {
    const targetRolePing = `<@&${roleId}>`;
    const fullPing = `@everyone (${targetRolePing})`;
    const guildName = type.toUpperCase();

    const planEmbed = new EmbedBuilder()
        .setTitle(`⚔️ MANIA FORMATION - ${guildName}`)
        .setDescription(`${fullPing} Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play`)
        .setColor(type === 'g1' ? "#00FF00" : "#0099FF");

    const planMsg = await msg.channel.send({ content: fullPing, embeds: [planEmbed] });
    await planMsg.react("✅");
    await planMsg.react("❌");
    
    // Записва само последното ID в DB
    fs.writeFileSync(DB_PATH, JSON.stringify({ planId: planMsg.id, guild: type }, null, 2));

    try {
        const mainChannel = msg.client.channels.cache.get(mainChannelId);
        if (mainChannel) {
            await mainChannel.send(`🚨 **@everyone A new Mania Plan for ${guildName} has been posted: ${planMsg.url}**`);
        }
    } catch (e) { console.error("Error sending to main channel:", e); }
}


/**
 * ГЛАВНА ФУНКЦИЯ ЗА ОБРАБОТКА НА КОМАНДАТА
 */
async function handleManiaPlan(msg) {
    // Правим целия текст малък и махаме излишни интервали
    const content = msg.content.toLowerCase().trim();
    
    // ID на главния канал за известия
    const MAIN_CHANNEL_ID = '1486343047632523398'; 

    // --- НАСТРОЙКИ НА РОЛИТЕ ---
    // ЗАМЕНИ ТЕЗИ ЧИСЛА С РЕАЛНИТЕ ID-ТА ОТ ТВОЯ СЪРВЪР
    const ROLES = {
        'g1': '123456789012345678', // ID на Роля за Гилдия 1
        'g2': '876543210987654321'  // ID на Роля за Гилдия 2
    };

    // Вземаме само частта след "mania-plan" (аргумента g1, g2 или all)
    const arg = content.replace('mania-plan', '').trim();

    // ПРОВЕРКА ЗА ТРИТЕ ВАРИАНТА
    if (arg === 'all') {
        // Вариант 1: Пингваме всички (@everyone) и пускаме два плана
        await createPlan(msg, 'g1', ROLES['g1'], MAIN_CHANNEL_ID, true);
        await createPlan(msg, 'g2', ROLES['g2'], MAIN_CHANNEL_ID, true);
    } 
    else if (arg === 'g1' || arg === 'g2') {
        // Вариант 2: Пингваме САМО ролята на конкретната гилдия (без everyone)
        await createPlan(msg, arg, ROLES[arg], MAIN_CHANNEL_ID, false);
    } 
    else {
        // Ако потребителят е сгрешил командата
        const errorMsg = await msg.reply("❌ Напиши: `mania-plan g1`, `g2` или `all`.");
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        return;
    }

    // Изтриваме съобщението на потребителя за чистота в чата
    if (msg.deletable) await msg.delete().catch(() => {});
}

/**
 * ПОМОЩНА ФУНКЦИЯ ЗА СЪЗДАВАНЕ НА ПЛАНА
 * type: 'g1' или 'g2'
 * roleId: ID-то на ролята
 * mainChannelId: ID на канала за известия
 * useEveryone: true (ако искаме @everyone) или false (ако искаме само ролята)
 */
async function createPlan(msg, type, roleId, mainChannelId, useEveryone) {
    const targetRolePing = `<@&${roleId}>`;
    
    // ЛОГИКА ЗА ПИНГ: Ако е 'all', добавяме @everyone, иначе само ролята
    const pingContent = useEveryone ? `@everyone (${targetRolePing})` : targetRolePing;
    
    const guildName = type.toUpperCase();

    // Създаване на Embed съобщението
    const planEmbed = new EmbedBuilder()
        .setTitle(`⚔️ MANIA FORMATION - ${guildName}`)
        .setDescription(`${pingContent} Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play`)
        .setColor(type === 'g1' ? "#00FF00" : "#0099FF") // Зелено за G1, Синьо за G2
        .setTimestamp();

    // Пращаме плана в текущия канал
    const planMsg = await msg.channel.send({ 
        content: pingContent, 
        embeds: [planEmbed] 
    });
    
    // Добавяме реакциите
    await planMsg.react("✅");
    await planMsg.react("❌");

    // Опит за изпращане на известие в главния канал
    try {
        const mainChannel = msg.client.channels.cache.get(mainChannelId);
        if (mainChannel) {
            await mainChannel.send(`🚨 **${pingContent} A new Mania Plan for ${guildName} has been posted: ${planMsg.url}**`);
        }
    } catch (e) { 
        console.error("Грешка при пращане в главния канал:", e.message); 
    }
}





/**
 * ПУБЛИКУВАНЕ НА СТРАТЕГИЯ (mania-strategy)
 */
async function handleManiaStrategy(msg, pool) {
    const { EmbedBuilder } = require('discord.js');
    const rawContent = msg.content.replace(/mania-strategy/gi, "").trim();
    if (!rawContent) return;

    const strategyGifs = [
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3kxYzJmN3N2MTNqNzI4ZHk5dXVldWI3cjdvMndjdnJmMWN3bmdzdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QfD1Hv15WwflPZeeWF/giphy.gif",
        "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExODVhMWpwY3h6OGk5OW1ldDJucDVjZXp5ZjloNG82OW1pNjh0NDF1biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Muqc4t03A8sz4ksa5i/giphy.gif",
        "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzljYXR6cTQ2aWtrc25lbXljenVmMTN4YjdhMXcyNmJjeWdoZW1ueiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Rz24pRStq8KaEwz9c6/giphy.gif"
    ];
    const randomGif = strategyGifs[Math.floor(Math.random() * strategyGifs.length)];

    const lines = rawContent.split('\n').filter(l => l.trim() !== "");
    
    const stratEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ DAILY BATTLE STRATEGY")
        .setDescription("All pirates to your positions!")
        .setColor("#FF4500")
        .setImage(randomGif)
        .setTimestamp();

    // Брояч за колоните
    let fieldCount = 0;

    lines.forEach((line) => {
        if (line.includes('-')) {
            const firstDashIndex = line.indexOf('-');
            const boss = line.substring(0, firstDashIndex).trim().toUpperCase();
            const playersPart = line.substring(firstDashIndex + 1).trim();

            let players = playersPart
                .split(/(?=\s@)|(?<=me),?\s*/) 
                .map(p => p.trim())
                .filter(p => p.length > 0);

            if (players.length > 0) {
                stratEmbed.addFields({
                    name: `⚔️ ${boss}`,
                    value: `• ${players.join('\n• ')}`,
                    inline: true
                });

                fieldCount++;

                // На всеки 3 боса добавяме "инстант прекъсване", за да подредим следващия ред
                if (fieldCount % 3 === 0) {
                    // Това невидимо поле гарантира, че следващите 3 ще са точно отдолу
                    // stratEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false }); // Може да се махне, ако имената са много къси
                }
            }
        }
    });

    // Запис в DB
    await pool.query(`
        INSERT INTO global_vars (key, value) 
        VALUES ('last_strategy', $1) 
        ON CONFLICT (key) 
        DO UPDATE SET value = EXCLUDED.value
    `, [rawContent]);

    await msg.channel.send({ 
        content: "@everyone 🚩 **TODAY'S TARGETS 👑 !**", 
        embeds: [stratEmbed] 
    });

    if (typeof currentPlanMsgId !== 'undefined') currentPlanMsgId = null; 
    if (msg.deletable) await msg.delete().catch(() => {});
}




/**
 * Функция за взимане на mention (role или everyone)
 */
async function getMention(guild, target) {
    if (target === "@everyone" || target === "@here") return target;
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
    if (role) return `<@&${role.id}>`;
    return target;
}

/**
 * Експортираме всички функции в един обект
 */
module.exports = { initSchedulers, isValidCron, handleManiaPlan, handleManiaList, handleManiaStrategy,getMention 
};
