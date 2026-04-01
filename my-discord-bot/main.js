const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, isValidCron } = require("./utilities/scheduler");
const heroesData = require("./data/heroes.json");
const staticReminders = require("./data/staticReminders");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

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

    // --- КОМАНДА: !hero ---
    if (cmd === "!hero" && msg.channel.name === "unit-build") {
        const heroName = args[0]?.toLowerCase();
        const hero = heroesData[heroName];
        if (!hero) return msg.reply("Hero not found!");
        
        const embed = new EmbedBuilder()
            .setTitle(hero.title)
            .setImage(hero.image)
            .setColor(hero.color || "#2b2d31")
            .addFields(
                { name: "Role", value: hero.role, inline: true },
                { name: "Seals", value: hero.seals, inline: false }
            );
        return msg.channel.send({ embeds: [embed] });
    }

    // --- КОМАНДА: !remind ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("No #reminders channel found!");
        
        if (args.length < 6) return msg.reply("Usage: !remind 0 12 * * * Message");
        
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        
        if (!isValidCron(cronExpr)) return msg.reply("Invalid Cron!");
        
        try {
            await pool.query(
                "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
                [Date.now(), cronExpr, text, targetCh.id, msg.author.id]
            );
            msg.reply(`✅ Reminder set for <#${targetCh.id}>`);
        } catch (err) {
            msg.reply("Database error.");
        }
    }

    // --- КОМАНДА: !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) msg.channel.bulkDelete(amount, true);
    }
});

client.login(process.env.DISCORD_TOKEN);
