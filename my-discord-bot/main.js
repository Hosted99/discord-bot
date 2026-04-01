const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, isValidCron } = require("./utilities/scheduler");

// Зареждане на данни от външни файлове
const heroesData = require("./data/heroes.json");
const staticReminders = require("./data/staticReminders");
const repairMessages = require("./data/repairMessages"); // Трябва да са на английски в JSON-а

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

// Списък с позволени кораби за ремонт
const allowedShips = ["@mugi-ship", "@goat-ship", "@ati-ship"];

// Списък със забавни съобщения при грешен кораб (на английски)
const noShipMessages = [
    "🚫 Hmm, **{user}**? This ship is not in our registry. Are you sure it's not a pirate raft?",
    "🔍 We searched everywhere, but couldn't find **{user}**. Maybe it sank somewhere?",
    "⚓ Sorry, our dock doesn't support models like **{user}**. Try a real ship!",
    "🛑 **{user}**? That name sounds unfamiliar. Check if you spelled it correctly!"
];

client.once("ready", async () => {
    await initDB();
    initSchedulers(client, staticReminders, pool);
    console.log(`🤖 Online as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // ========================================================
    // 1. ЛОГИКА ЗА REPAIR-SHIP (Само в този канал)
    // ========================================================
    if (msg.channel.name === "repair-ship") {
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.startsWith("repair ")) {
            const target = content.slice(7).trim(); 
            if (!target) return;

            // Проверка дали корабът е в списъка
            if (allowedShips.includes(target.toLowerCase())) {
                // Успешен ремонт (взима съобщение от data/repairMessages.js)
                const randomMsg = repairMessages[Math.floor(Math.random() * repairMessages.length)];
                const finalResponse = randomMsg.replace("{user}", target);
                return msg.channel.send(finalResponse);
            } else {
                // Грешен кораб
                const randomNoShip = noShipMessages[Math.floor(Math.random() * noShipMessages.length)];
                return msg.channel.send(randomNoShip.replace("{user}", target));
            }
        }
        return; 
    }

    // ========================================================
    // 2. КОМАНДА: !hero (Само в #unit-build)
    // ========================================================
    if (cmd === "!hero" && msg.channel.name === "unit-build") {
        const heroName = args[0]?.toLowerCase();
        const hero = heroesData[heroName];
        
        if (!hero) return msg.reply("❌ Hero not found! Please check the name.");
        
        const embed = new EmbedBuilder()
            .setTitle(hero.title)
            .setImage(hero.image)
            .setColor(hero.color || "#2b2d31")
            .addFields(
                { name: "Role", value: hero.role, inline: true },
                { name: "Seals", value: hero.seals, inline: false },
                { name: "Haki Recommendation", value: hero.haki || "N/A", inline: true }
            )
            .setFooter({ text: "Sailing Kingdom Guide" });

        return msg.channel.send({ embeds: [embed] });
    }

    // ========================================================
    // 3. КОМАНДА: !remind (Записва за стая #reminders)
    // ========================================================
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ Error: No #reminders channel found in this server!");
        
        if (args.length < 5) return msg.reply("❌ Usage: `!remind <min> <hour> <day> <month> <weekday> <message>`");
        
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron format! Use spaces between stars.");
        
        try {
            await pool.query(
                "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
                [Date.now(), cronExpr, text, targetCh.id, msg.author.id]
            );
            msg.reply(`✅ Reminder set! It will be sent in <#${targetCh.id}>`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Database error occurred.");
        }
    }

    // ========================================================
    // 4. КОМАНДА: !clear (Триене на съобщения)
    // ========================================================
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return msg.reply("⚠️ Please enter a number between 1 and 100.");
        }
        await msg.channel.bulkDelete(amount, true).catch(err => console.error(err));
    }
});

client.login(process.env.DISCORD_TOKEN);
