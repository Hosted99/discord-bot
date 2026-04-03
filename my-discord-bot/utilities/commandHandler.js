const { EmbedBuilder } = require("discord.js");
const heroesData = require("../data/heroes.json");
const staticReminders = require("../data/staticReminders");
const { isValidCron } = require("./scheduler");

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // --- 1. КОМАНДА: !help (Пълно меню) ---
    // Показва всички налични команди на бота
    if (cmd === "!help") {
        const embed = new EmbedBuilder()
            .setTitle("🏴‍☠️ Sailing Kingdom - Help Menu")
            .setColor("#00AE86")
            .addFields(
                { name: "💰 Bounty", value: "`!wanted` | `!setbounty @user <amt>` | `!resetbounty @user`" },
                { name: "⚔️ Guides", value: "`!hero <name>` (only in #unit-build)" },
                { name: "⏰ Reminders", value: "`!remind`, `!reminders`, `!allreminders`" },
                { name: "🧹 Admin", value: "`!delete <id>` (Admin only) | `!clear <num>`" }
            )
            .setFooter({ text: "Sailing Kingdom | London Time" });
        return msg.reply({ embeds: [embed] });
    }

    // --- 2. КОМАНДА: !hero (Гайдове за герои) ---
    // Търси информация за герой в data/heroes.json
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") {
            const err = await msg.reply("❌ Use #unit-build!");
            return setTimeout(() => { err.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
        }
        const hero = heroesData[args[0]?.toLowerCase()];
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

    // --- 3. КОМАНДА: !remind (Нов динамичен ремайндър) ---
    // Записва напомняне в базата данни за канал #reminders
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ No #reminders channel found!");
        if (args.length < 5) return msg.reply("❌ Usage: `!remind 0 12 * * * Message` ");
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron format!");
        try {
            await pool.query("INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
            [Date.now(), cronExpr, text, targetCh.id, msg.author.id]);
            msg.reply(`✅ Reminder set for <#${targetCh.id}>`);
        } catch (err) { msg.reply("❌ Database error."); }
    }

    // --- 4. КОМАНДА: !reminders (Списък динамични) ---
    if (cmd === "!reminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "No dynamic reminders.";
        return msg.reply("📋 **Your Reminders:**\n" + list);
    }

    // --- 5. КОМАНДА: !allreminders (Всички събития) ---
    if (cmd === "!allreminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
        const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
        const embed = new EmbedBuilder()
            .setTitle("📋 All Reminders").setColor("#5865F2")
            .addFields({ name: "📌 Static", value: staticList }, { name: "⏰ Dynamic", value: dynamicList });
        return msg.reply({ embeds: [embed] });
    }

    // --- 6. КОМАНДА: !delete (САМО ЗА АДМИНИ) ---
    if (cmd === "!delete") {
        if (!msg.member.permissions.has("Administrator")) {
            return msg.reply("❌ Only Admirals can delete reminders!").then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }
        const id = args[0];
        if (!id) return msg.reply("❌ Usage: `!delete <id>`");
        try {
            const res = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
            if (res.rowCount === 0) return msg.reply("❌ ID not found.");
            return msg.reply(`🗑️ Reminder \`${id}\` deleted.`);
        } catch (err) { return msg.reply("❌ DB Error during delete."); }
    }

    // --- 7. КОМАНДА: !wanted (Bounty плакат) ---
    if (cmd === "!wanted") {
        const target = msg.mentions.users.first() || msg.author;
        try {
            const res = await pool.query("SELECT bounty FROM users WHERE user_id = $1", [target.id]);
            const bounty = res.rows.length > 0 ? res.rows[0].bounty : 0;
            const embed = new EmbedBuilder()
                .setTitle("🏴‍☠️ WANTED").setDescription(`**${target.username.toUpperCase()}**`)
                .addFields({ name: "REWARD", value: `฿ ${parseInt(bounty).toLocaleString()}` })
                .setColor("#E67E22").setThumbnail(target.displayAvatarURL())
                .setFooter({ text: "DEAD OR ALIVE" });
            return msg.channel.send({ embeds: [embed] });
        } catch (err) { return msg.reply("❌ Error fetching bounty."); }
    }

    // --- 8. КОМАНДА: !setbounty (Админ) ---
    if (cmd === "!setbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const target = msg.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return msg.reply("❌ Usage: `!setbounty @user 50000` ");
        try {
            await pool.query("INSERT INTO users (user_id, bounty, username) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET bounty = $2, username = $3", [target.id, amount, target.username]);
            return msg.channel.send(`💰 **${target.username}** bounty set to **฿ ${amount.toLocaleString()}**!`);
        } catch (err) { return msg.reply("❌ DB Error."); }
    }

    // --- 9. КОМАНДА: !resetbounty (Админ - ИЗТРИВАНЕ/НУЛИРАНЕ) ---
    if (cmd === "!resetbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const target = msg.mentions.users.first();
        if (!target) return msg.reply("❌ Usage: `!resetbounty @user` ");
        try {
            const res = await pool.query("DELETE FROM users WHERE user_id = $1", [target.id]);
            if (res.rowCount === 0) return msg.reply("❌ This pirate had no active bounty.");
            return msg.channel.send(`🗑️ **${target.username}** bounty has been reset to 0!`);
        } catch (err) { return msg.reply("❌ DB Error resetting bounty."); }
    }

    // --- 10. КОМАНДА: !clear (Масово триене) ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
