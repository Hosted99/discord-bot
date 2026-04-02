const { EmbedBuilder } = require("discord.js");
const heroesData = require("../data/heroes.json");
const { isValidCron } = require("./scheduler"); // Увери се, че scheduler.js експортира isValidCron

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // --- КОМАНДА: !hero ---
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") {
            const err = await msg.reply("❌ This command only works in #unit-build!");
            return setTimeout(() => { err.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
        }
        const heroName = args[0]?.toLowerCase();
        const hero = heroesData[heroName];
        if (!hero) return msg.reply("❌ Hero not found!");
        
        const embed = new EmbedBuilder()
            .setTitle(hero.title).setImage(hero.image).setColor(hero.color || "#2b2d31")
            .addFields(
                { name: "Role", value: hero.role, inline: true },
                { name: "Seals", value: hero.seals, inline: false },
                { name: "Haki Rec", value: hero.haki || "N/A", inline: true }
            );
        return msg.channel.send({ embeds: [embed] });
    }

    // --- КОМАНДА: !remind ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ No #reminders channel found!");
        if (args.length < 5) return msg.reply("❌ Usage: `!remind <min> <hour> <day> <month> <weekday> <message>`");
        
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron format!");

        try {
            await pool.query(
                "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
                [Date.now(), cronExpr, text, targetCh.id, msg.author.id]
            );
            msg.reply(`✅ Reminder set for <#${targetCh.id}>`);
        } catch (err) { msg.reply("❌ Database error."); }
    }

    // --- КОМАНДА: !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
