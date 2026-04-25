const cron = require("node-cron"); // Импортираме cron библиотеката за scheduling
const { EmbedBuilder } = require("discord.js"); // Импортираме EmbedBuilder за красиви Discord съобщения
const { sendEmergencyDMs } = require('./dmHandler.js');
const staticList = require("../data/staticReminders"); // Зареждаме статичните напомняния
const fs = require('fs');
const path = require('path');
// Пътят отива една папка нагоре и влиза в 'data'
const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');
const { pool } = require("./db"); // Вмъкваме връзката с PostgreSQL


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


/**
 * ГЛАВНА ФУНКЦИЯ ЗА ОБРАБОТКА НА КОМАНДАТА mania-plan
 */
async function handleManiaPlan(msg) {
    // Форматираме съдържанието на съобщението
    const content = msg.content.toLowerCase().trim();
    
    // ID на главния канал за автоматични известия
    const MAIN_CHANNEL_ID = '1451310327114498069'; ///////////////////////трябва да върна кода после 1486343047632523398
 
    // Конфигурация на ролите за двете гилдии
    const ROLES = {
        'g1': '1497360851156340836',   ///////////////////////трябва да върна кода после 1490805399010545794
        'g2': '1497360907137847396'   ///////////////////////трябва да върна кода после  1490805404710469642
    };

    // Извличаме аргумента (all, g1 или g2)
    const arg = content.replace('mania-plan', '').trim();

    // Логика за изпълнение според аргумента
    if (arg === 'all') {
        // Пускаме планове и за двете гилдии с @everyone
        await createPlan(msg, 'g1', ROLES['g1'], MAIN_CHANNEL_ID, true);
        await createPlan(msg, 'g2', ROLES['g2'], MAIN_CHANNEL_ID, true);
    } 
    else if (arg === 'g1' || arg === 'g2') {
        // Пускаме план само за конкретната гилдия
        await createPlan(msg, arg, ROLES[arg], MAIN_CHANNEL_ID, false);
    } 
    else {
        // Съобщение при грешно въведена команда
        const errorMsg = await msg.reply("❌ Use: `mania-plan g1`, `g2` or `all`.");
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        return;
    }

    // Изтриваме командата на потребителя за чистота в чата
    if (msg.deletable) await msg.delete().catch(() => {});
}

/**
 * ПОМОЩНА ФУНКЦИЯ ЗА СЪЗДАВАНЕ НА ПЛАНА И ИЗПРАЩАНЕ НА ИЗВЕСТИЯ
 */
async function createPlan(msg, type, roleId, mainChannelId, useEveryone) {
    const targetRolePing = `<@&${roleId}>`;
    const pingContent = useEveryone ? `@everyone (${targetRolePing})` : targetRolePing;
    const guildName = type.toUpperCase();

    // 1. Създаване на Embed съобщението с 3 опции (✅, ❌, ⏳)
    const planEmbed = new EmbedBuilder()
        .setTitle(`⚔️ MANIA FORMATION - ${guildName}`)
        .setDescription(`${pingContent} Who will be able to play today?\n\n✅ - I'm in\n❌ - Can't play\n⏳ - Not sure yet`)
        .setColor(type === 'g1' ? "#00FF00" : "#0099FF")
        .setTimestamp();

    // 2. Изпращане на основния план в текущия канал
    const planMsg = await msg.channel.send({ 
        content: pingContent, 
        embeds: [planEmbed] 
    });
    
    // 3. Автоматично добавяне на трите реакции
    await planMsg.react("✅");
    await planMsg.react("❌");
    await planMsg.react("⏳"); // Бутон за "Може би"

    // 4. ЗАПИС В БАЗАТА ДАННИ (PostgreSQL)
    try {
        const dbKey = `planId_${type}`;
        await pool.query(
            "INSERT INTO global_vars (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
            [dbKey, planMsg.id]
        );
        console.log(`[LOG] Saved plan ID for ${type} to database.`);
    } catch (err) {
        console.error("❌ Database Error:", err.message);
    }

    // 5. ИЗВЕСТИЕ В ГЛАВНИЯ КАНАЛ (Подсигурено с fetch)
    try {
        // Търсим канала първо в кеша, ако го няма - теглим го (fetch)
        let mainChannel = msg.client.channels.cache.get(mainChannelId);
        if (!mainChannel) {
            mainChannel = await msg.client.channels.fetch(mainChannelId).catch(() => null);
        }

        if (mainChannel) {
            await mainChannel.send(`🚨 **${pingContent} A new Mania Plan for ${guildName} has been posted: ${planMsg.url}**`);
            console.log(`[LOG] Global notification sent to: ${mainChannelId}`);
        } else {
            console.error(`[LOG] Could not find channel with ID: ${mainChannelId}`);
        }
    } catch (e) { 
        console.error("[LOG] Error sending notification to main channel:", e.message); 
    }
}




/**
 * СПИСЪК НА ПОТВЪРДИЛИТЕ (mania-list) - ОПТИМИЗИРАН ПРОТИВ RATE LIMIT
 */
async function handleManiaList(msg) {
    const MAIN_CHANNEL_ID = '1451310327114498069';  ///////////////////////трябва да върна кода после 1486343047632523398
    const content = msg.content.toLowerCase().trim();
    
    const parts = content.split(/\s+/);
    const arg = parts[1]; 

    const ROLES = {
        'g1': '1497360851156340836',  ///////////////////////трябва да върна кода после 1490805399010545794
        'g2': '1497360907137847396'  ///////////////////////трябва да върна кода после  1490805404710469642
    };

    if (!arg || !ROLES[arg]) {
        return msg.reply("❌ Use: `mania-list g1` or `mania-list g2`.");
    }

    try {
        // 1. ЧЕТЕМ ID-ТО ОТ БАЗАТА
        const dbKey = `planId_${arg}`;
        const res = await pool.query("SELECT value FROM global_vars WHERE key = $1", [dbKey]);

        if (!res.rows || res.rows.length === 0) {
            return msg.reply(`❌ No active plan for **${arg.toUpperCase()}**!`);
        }

        const targetPlanId = res.rows[0].value; 

        // 2. Опит за намиране на съобщението
        let planMsg = msg.channel.messages.cache.get(targetPlanId);
        if (!planMsg) {
            planMsg = await msg.channel.messages.fetch(targetPlanId).catch(() => null);
        }

        if (!planMsg) return msg.reply(`❌ Original message not found.`);

        // 3. СЪБИРАМЕ ГЛАСОВЕТЕ
        const reactionYes = planMsg.reactions.cache.get("✅");
        const usersYes = reactionYes ? await reactionYes.users.fetch() : new Map();
        const confirmed = usersYes.filter(u => !u.bot).map(u => `<@${u.id}>`);

        const reactionNo = planMsg.reactions.cache.get("❌");
        const usersNo = reactionNo ? await reactionNo.users.fetch() : new Map();
        const declined = usersNo.filter(u => !u.bot).map(u => `<@${u.id}>`);

        // 4. ФИЛТРИРАМЕ ЛИПСВАЩИТЕ
        const targetRole = msg.guild.roles.cache.get(ROLES[arg]);
        if (!targetRole) return msg.reply("❌ Role not found!");

        const votedIds = [...usersYes.keys(), ...usersNo.keys()];
        const missing = targetRole.members.filter(m => 
            !m.user.bot && 
            !votedIds.includes(m.id)
        ).map(m => `<@${m.id}>`);

        // 5. ПРАЩАМЕ ЕМБЕДА
        const statusEmbed = new EmbedBuilder()
            .setTitle(`⚔️ FORMATION STATUS - ${arg.toUpperCase()}`)
            .setDescription(`Formation for: <@&${ROLES[arg]}>`)
            .setColor(arg === 'g1' ? "#00FF00" : "#0099FF")
            .addFields(
                { name: `✅ CONFIRMED (${confirmed.length})`, value: confirmed.join(", ") || "None yet", inline: false },
                { name: `❌ DECLINED (${declined.length})`, value: declined.join(", ") || "None", inline: false }
            );

        await msg.channel.send({ embeds: [statusEmbed] });

        // 6. ИЗВЕСТИЯ ЗА ЛИПСВАЩИ С ПРЕПРАТКА (ТУК Е ПРОМЯНАТА)
        if (missing.length > 0) {
            const missingText = missing.join(" ");
            
            // Съобщение в текущия канал
            await msg.channel.send(`🔔 **Attention!** These players from **${arg.toUpperCase()}** haven't voted or decided on their attendance yet:\n${missingText}`);
            
            // Съобщение в ГЛАВНИЯ КАНАЛ с препратка
            const mainChannel = msg.client.channels.cache.get(MAIN_CHANNEL_ID);
            if (mainChannel) {
                await mainChannel.send(`🚨 **MANDATORY!** Members of **${arg.toUpperCase()}** need to vote:\n${missingText}\n\n👉 **Go to channel:** <#${msg.channel.id}>\n🔗 **Direct Link to Plan:** ${planMsg.url}`);
            }
        } else {
            await msg.channel.send(`✅ Everyone from **${arg.toUpperCase()}** has voted!`);
        }

        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (e) {
        console.error("Грешка в mania-list:", e.message);
        msg.reply("❌ Rate limited or error. Please wait 10-20 seconds.");
    }
}


/**
 * АВАРИЙНО ИЗПРАЩАНЕ НА ЛИЧНИ СЪОБЩЕНИЯ (mania-dm)
 * Използваме лек fetch по роля, за да избегнем Rate Limit грешки.
 */
async function handleManiaDM(msg) {
    console.log("[LOG] Starting mania-dm command...");
    
    // Подготовка на аргументите (g1 или g2)
    const content = msg.content.toLowerCase().trim();
    const parts = content.split(/\s+/);
    const arg = parts[1]; 

    const ROLES = {
        'g1': '1497360851156340836', 
        'g2': '1497360907137847396' 
    };

    // Проверка за валиден аргумент
    if (!arg || !ROLES[arg]) {
        return msg.reply("❌ Use: `mania-dm g1` or `mania-dm g2`.");
    }

    try {
        // 1. ВЗЕМАНЕ НА ДАННИ ОТ БАЗАТА ДАННИ
        console.log(`[LOG] Fetching plan ID for ${arg} from DB...`);
        const dbKey = `planId_${arg}`;
        const res = await pool.query("SELECT value FROM global_vars WHERE key = $1", [dbKey]);

        if (!res.rows || res.rows.length === 0) {
            return msg.reply(`❌ No active plan for **${arg.toUpperCase()}** found!`);
        }

        const targetPlanId = res.rows[0].value;
        const planMsg = await msg.channel.messages.fetch(targetPlanId).catch(() => null);

        if (!planMsg) {
            return msg.reply("❌ Original plan message not found in this channel.");
        }

        // 2. СЪБИРАНЕ НА ГЛАСОВЕТЕ (КОЙ Е ГЛАСУВАЛ)
        console.log("[LOG] Collecting voters from reactions...");
        let votedIds = [];
        const reactions = planMsg.reactions.cache;
        
        for (const [emoji, reaction] of reactions) {
            if (emoji === "✅" || emoji === "❌") {
                const users = await reaction.users.fetch();
                users.forEach(u => { if(!u.bot) votedIds.push(u.id); });
            }
        }
        console.log(`[LOG] Voters found: ${votedIds.length}`);

        // 3. ОБНОВЯВАНЕ НА ЧЛЕНОВЕТЕ (ОПТИМИЗИРАНО ЗА RATE LIMIT)
        // Вземаме САМО хората с тази роля, за да не товарим Discord
        console.log(`[LOG] Fetching members for role ${arg.toUpperCase()}...`);
        try {
            await msg.guild.members.fetch({ role: ROLES[arg] });
        } catch (fetchErr) {
            console.error("[LOG] Warning: Failed to fetch some members:", fetchErr.message);
        }

        const targetRole = msg.guild.roles.cache.get(ROLES[arg]);
        if (!targetRole) return msg.reply("❌ Role not found!");

        // 4. ФИЛТРИРАНЕ НА ЛИПСВАЩИТЕ
        const missingMembers = targetRole.members.filter(m => 
            !m.user.bot && 
            !votedIds.includes(m.id)
        );

        console.log(`[LOG] Missing members count: ${missingMembers.size}`);

        if (missingMembers.size === 0) {
            return msg.reply(`✅ Everyone in **${arg.toUpperCase()}** has already voted!`);
        }

        // 5. ИЗПРАЩАНЕ НА ЛИЧНИТЕ СЪОБЩЕНИЯ
        const statusMsg = await msg.channel.send(`🚨 Sending emergency DMs to **${missingMembers.size}** members...`);
        
        // Викаме помощната функция от dmHandler.js
        const report = await sendEmergencyDMs(
            Array.from(missingMembers.values()), 
            planMsg.url, 
            arg.toUpperCase()
        );

        await statusMsg.edit(`✅ **DM Blast Finished!**\n- Sent: ${report.successCount}\n- Failed: ${report.failCount}`);
        
        if (msg.deletable) await msg.delete().catch(() => {});

    } catch (error) {
        console.error("[LOG] FATAL ERROR:", error);
        // Изписваме грешката директно в Discord за по-лесен дебъг
        msg.reply(`❌ **FATAL ERROR:** \`\`\`${error.message}\`\`\``);
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
module.exports = { initSchedulers, isValidCron, handleManiaPlan, handleManiaList, handleManiaStrategy,getMention, handleManiaDM };
