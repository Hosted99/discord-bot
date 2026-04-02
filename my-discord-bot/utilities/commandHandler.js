const { EmbedBuilder } = require("discord.js");
const { isValidCron } = require("./scheduler");

async function handleCommands(msg, cmd, args, heroesData, pool, scheduleDynamicReminder) {
    // --- !hero ---
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") {
            const err = await msg.reply("❌ This command only works in #unit-build!");
            return setTimeout(() => { err.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
        }
        const hero = heroesData[args[1]?.toLowerCase()];
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

    // --- !remind ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ No #reminders channel found!");
        if (args.length < 7) return msg.reply("❌ Usage: `!remind <min> <hour> <day> <month> <weekday> <message>`");
        
        const cronExpr = args.slice(1, 6).join(" ");
        const text = args.slice(6).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron format!");

        try {
            const id = Date.now();
            await pool.query("INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", [id, cronExpr, text, targetCh.id, msg.author.id]);
            // Трябва да дефинираш или импортираш scheduleDynamicReminder
            msg.reply(`✅ Reminder set for <#${targetCh.id}>`);
        } catch (err) { msg.reply("❌ Database error."); }
    }

    // --- !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[1]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
