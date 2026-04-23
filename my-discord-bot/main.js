const Groq = require("groq-sdk");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const path = require('path'); 
const DB_PATH = path.join(__dirname, 'data', 'database.json');
const { pool, initDB } = require("./utilities/db");
const { 
    initSchedulers, 
    handleManiaPlan, 
    handleManiaList, 
    handleManiaStrategy,
    handleManiaHelp // <--- Добави това
} = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { sendBotManual } = require("./utilities/infoHandler");
const { logDeletedMessage } = require("./utilities/logger");

// 1. Конфигурация на Groq AI и Cooldown система
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const translationCooldown = new Set();

function cleanDiscordContent(content) {
    if (!content) return "";
    
    // 1. Премахваме всичко излишно
    let cleaned = content
        .replace(/<a?:\w+:\d+>/g, '') // Discord емоджита
        .replace(/https?:\/\/\S+/g, '') // Линкове
        .trim();

    // 2. СУПЕР ПРОВЕРКА: Има ли изобщо букви или цифри?
    // Ако съобщението съдържа САМО емоджита и специални знаци, това ще върне false
    const hasActualText = /[a-zA-Zа-яА-Я0-9]/.test(cleaned);
    
    if (!hasActualText) return ""; 

    return cleaned;
}


// 2. Инициализация на клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 3. Keep-alive сървър за хостинг
const http = require('http');
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running!');
}).listen(port);
console.log(`Monitoring server started on port ${port}`);

// 4. Функция за стартиране на системата
async function startSystem() {
    try {
        await initDB(); // Изчакваме таблиците да са готови
        console.log("✅ Database is ready.");
        
        // Влизаме в Discord едва след като базата е готова
        client.login(process.env.DISCORD_TOKEN);
    } catch (err) {
        console.error("❌ Critical Startup Error:", err.message);
    }
}

// 5. БОТЪТ Е ОНЛАЙН (Връщаме съобщенията тук)
client.once("ready", async () => {
    // Вече можем безопасно да пуснем шедулъра
    initSchedulers(client, pool);
    console.log(`🤖 Онлайн като: ${client.user.tag}`);

    // --- ДОБАВИ ТОВА ТУК ---
    // Теглим всички членове на сървъра веднъж при пускане, за да ги има в кеша
    client.guilds.cache.forEach(guild => {
        guild.members.fetch().then(() => console.log(`✅ Кеширани членове за: ${guild.name}`));
    });

    

    // Изпращане на Manual и Online статус във всеки сървър
    client.guilds.cache.forEach(async (guild) => {
        // Изпращане на инфо за бота (Manual)
        await sendBotManual(guild).catch(err => console.log("Грешка при Manual msg:", err.message));

        // Търсене на канал за статус
        const botChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (botChannel) {
            const aliveEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Online")
                .setDescription("🏴‍☠️ **The Captain is back on the deck!**\nAll systems are operational and the seas are under watch..")
                .setColor("#00ff00")
                .setTimestamp();

            await botChannel.send({ embeds: [aliveEmbed] }).catch(err => console.log("Грешка при Alive msg:", err.message));
        }
    });
});

// 5. Логване на изтрити съобщения
client.on("messageDelete", async (message) => {
    await logDeletedMessage(message);
});

// 6. Нови членове
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

// 7. ОСНОВЕН СЛУШАТЕЛ
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    const lowerContent = msg.content.toLowerCase();

    // --- 1. MANIA СИСТЕМА ---
    if (lowerContent.startsWith("mania-plan")) {
    return await handleManiaPlan(msg);
}
   // С ТОВА:
if (lowerContent.startsWith("mania-list")) {
    return await handleManiaList(msg);
}
    if (lowerContent.startsWith("mania-strategy")) {
        return await handleManiaStrategy(msg, pool);
    }


    
    // --- 2. Команди (!addrole / !removerole / !commands) ---
    if (msg.content.startsWith("!")) {
        const content = msg.content.trim();
        const args = content.split(/\s+/);
        const cmd = args.shift().toLowerCase();

        if (cmd === "!addrole" || cmd === "!removerole" || cmd === "!addroleallts" || cmd === "!addroleallgm") {
            return await handleRoleCommands(msg, cmd, args);
        }
        return await handleCommands(msg, pool);
    }

    // --- 3. Специални канали ---
    const specialHandled = await handleSpecialChannels(msg, pool);
    if (specialHandled) return;

    // --- 4. Преводач (ai-translator канал) ---
    if (msg.channel.name === 'ai-translator') {
    if (msg.author.bot) return; // Игнорирай други ботове
    if (translationCooldown.has(msg.author.id)) return;

    // СТЪПКА 1: Изчистваме съобщението
    const cleanedText = cleanDiscordContent(msg.content);

        // Ако текстът е празен ИЛИ е прекалено кратък (напр. само 1 символ), спираме
if (!cleanedText || cleanedText.length < 2) {
    return; 
}

    // СТЪПКА 2: Ако съобщението е само картинка, линк или емоджи - ИГНОРИРАЙ
    if (!cleanedText || cleanedText.length < 2) return;

    try {
        const analysis = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "Analyze language. If the text is English (even with typos), respond with isEnglish: true. Respond ONLY JSON: {\"isEnglish\": boolean, \"detectedLang\": \"Language Name\", \"translatedText\": \"...\"}" 
                },
                { role: "user", content: cleanedText }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        // Внимавай за структурата на отговора (choices[0])
        const data = JSON.parse(analysis.choices[0].message.content);

        // ПРОВЕРКА: Считаме го за английски, ако AI каже true ИЛИ в името на езика има "eng"
        const isDetectedEnglish = data.isEnglish === true || 
                                 data.detectedLang.toLowerCase().includes('eng');

        // ЛОГИКА ЗА ИГНОРИРАНЕ: Английски + не е реплай = Мълчание
        if (isDetectedEnglish && !msg.reference) {
            return; 
        }

        // ВАРИАНТ А: Съобщението НЕ е на английски -> Превеждаме на английски
        if (!isDetectedEnglish) {
            const expireTime = new Date();
            expireTime.setHours(expireTime.getHours() + 5);

            await pool.query(
                "INSERT INTO translation_cache (user_id, last_lang, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET last_lang = $2, expires_at = $3",
                [msg.author.id, data.detectedLang, expireTime]
            );

            await msg.reply(`🇺🇸 **English:** ${data.translatedText}`);
        } 
        // ВАРИАНТ Б: Съобщението Е на английски, но Е отговор (Reply) -> Превеждаме го обратно
        else if (msg.reference) {
            try {
                const repliedMessage = await msg.channel.messages.fetch(msg.reference.messageId);
                const res = await pool.query(
                    "SELECT last_lang FROM translation_cache WHERE user_id = $1 AND expires_at > NOW()",
                    [repliedMessage.author.id]
                );

                if (res.rows.length > 0) {
                    const targetLang = res.rows[0].last_lang;

                    const backResult = await groq.chat.completions.create({
                        messages: [
                            { role: "system", content: `Translate to ${targetLang}. Only translation.` },
                            { role: "user", content: cleanedText }
                        ],
                        model: "llama-3.3-70b-versatile"
                    });

                    await msg.reply(`🌍 **To ${targetLang}:** ${backResult.choices[0].message.content}`);
                }
            } catch (err) {
                console.error("Reply translation error:", err.message);
            }
        }

        // Коулдаун логика
        translationCooldown.add(msg.author.id);
        setTimeout(() => translationCooldown.delete(msg.author.id), 5000);

    } catch (err) {
        console.error("Groq error:", err.message);
    }
    return;
}
    // --- 4. Лека нощ ---
    const nightRegex = /\b(good night|nighty night)\b/i;
    if (nightRegex.test(msg.content.toLowerCase())) {
        const nightEmbed = new EmbedBuilder()
            .setTitle(`🌙 Good night!`)
            .setDescription("Rest well, pirate! The seas will be waiting for you tomorrow. 🏴‍☠️")
            .setColor("#2c3e50")
            .setImage("https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXl2amYzcXZxcml3Nm04dWJtN25qaGY2bWU0dmN3NmthcmdrOXZtMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/F6bEXu79gwCENplJcB/giphy.gif");

        return msg.reply({ embeds: [nightEmbed] });
    }

    // --- 5. Добро утро ---
    const morningRegex = /\b(good morning|добро утро)\b/i;

    if (morningRegex.test(msg.content.toLowerCase())) {
    // Списък с различни GIF-ове
    const morningGifs = [
        "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZThydTQ4ZHE0NnpiNnRxODRsanZ5ZmZxaHZzY3owYWhtajV2cmcyNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12PFj4kepMjH51mp7d/giphy.gif",
        "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcm04NGFyeXl1Y3p1NzJ6Y2tvY3gzcGYzaW5rMmhwejNyM25kdWhzbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mChteTAmcjCZq5p9Az/giphy.gif",
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHg3emxudmRqZ2x4eG9nZ3FsYWFuZDZoeHF3MHVwbWI3a3Nod3ZuNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dlKxhG0vaPkXr6R4Da/giphy.gif",
        "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXVqb2drZjVucngybzJiNHhycnRueDJ4OGpja2h6NW4zOXYzMTJwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mSb6D6bfTToa6JAUXD/giphy.gif",
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdG83eW4xemhrOHJjdXhiODBkYmppMHRuanJmbWR1bjJjZnpwYnpvMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/K7HP8vmRFmHdkQwgGU/giphy.gif",
        "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWVmcXliMGlsNWtkbnBzOTN6ZHlsNW55d25ucTh3aWtlbnphMWxkMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BjSp5w6ed5uQpihCAL/giphy.gif"];

    // Избираме случаен GIF
    const randomGif = morningGifs[Math.floor(Math.random() * morningGifs.length)];

    const morningEmbed = new EmbedBuilder()
        .setTitle(`☀️ Good morning!`)
        .setDescription("Is your ass woken up yet? Because mine is! ⚓")
        .setColor("#f1c40f")
        .setImage(randomGif);

    return msg.reply({ embeds: [morningEmbed] });
}

});

// 9. Логване на бота
client.login(process.env.DISCORD_TOKEN);
