const { EmbedBuilder } = require("discord.js");
const heroesData = require("../data/heroes.json");
const staticReminders = require("../data/staticReminders");
const { isValidCron } = require("./scheduler");

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // --- КОМАНДА: !help ---
    if (cmd === "!help") {
        const embed = new EmbedBuilder()
            .setTitle("🏴‍☠️ Sailing Kingdom Bot - Help Menu")
            .setColor("#00AE86")
            .addFields(
                { name: "⚔️ General", value: "`!hero <name>` (only in #unit-build)\n`!help`" },
                { name: "⏰ Reminders", value: "`!remind <cron> <msg>`\n`!reminders`\n`!allreminders`\n`!delete <id>`" },
                { name: "🔧 Repair", value: "Write `repair @ship` in #repair-ship" },
                { name: "🧹 Admin", value: "`!clear <num>`\n`!addrole @user Role`" }
            );
        return msg.reply({ embeds: [embed] });
    }

    // --- КОМАНДА: !hero (Само в #unit-build) ---
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") {
            return msg.reply("❌ Use #unit-build for guides!").then(m => setTimeout(() => m.delete(), 5000));
        }
        const hero = heroesData[args[0]?.toLowerCase()];
        if (!hero) return msg.reply("❌ Hero not found!");
        const embed = new EmbedBuilder()
            .setTitle(hero.title).setImage(hero.image).setColor(hero.color || "#2b2d31")
            .addFields({ name: "Role", value: hero.role }, { name: "Seals", value: hero.seals });
        return msg.channel.send({ embeds: [embed] });
    }

    // --- КОМАНДА: !remind (Записва за стая #reminders) ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ No #reminders channel!");
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron!");
        try {
            await pool.query("INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
            [Date.now(), cronExpr, text, targetCh.id, msg.author.id]);
            msg.reply(`✅ Reminder set in <#${targetCh.id}>`);
        } catch (err) { msg.reply("❌ DB Error."); }
    }

    // --- КОМАНДА: !reminders ---
    if (cmd === "!reminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "No reminders.";
        return msg.reply("📋 **Your Reminders:**\n" + list);
    }

    // --- КОМАНДА: !allreminders ---
    if (cmd === "!allreminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
        const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
        const embed = new EmbedBuilder()
            .setTitle("📋 All Reminders").setColor("#5865F2")
            .addFields({ name: "📌 Static", value: staticList }, { name: "⏰ Dynamic", value: dynamicList });
        return msg.reply({ embeds: [embed] });
    }

    // --- КОМАНДА: !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
