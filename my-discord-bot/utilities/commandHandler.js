const { EmbedBuilder } = require("discord.js");
const fs = require('fs'); 
const path = require('path')
const staticReminders = require("../data/staticReminders");
const { isValidCron } = require("./scheduler");
const { updateBountyRole } = require("./roleHandler");

// --- ФУНКЦИЯ ЗА ЗАРЕЖДАНЕ НА ГЕРОИТЕ (Hot Reload) ---
function getHeroes() {
    try {
        // Използваме path.join, за да сме сигурни, че намира папката 'data'
        const filePath = path.join(__dirname, "../data/heroes.json"); 
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("❌ ГРЕШКА ПРИ ЧЕТЕНЕ НА heroes.json:", err.message);
        return {}; // Връща празен обект, за да не крашне бота
    }
}

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // --- 1. КОМАНДА: !help (ПЪЛНО МЕНЮ) ---
    if (cmd === "!help") {
        const helpEmbed = new EmbedBuilder()
            .setTitle("🏴‍☠️ Sailing Kingdom - Command Manual")
            .setDescription("Welcome aboard! Here are all the tools available to our crew:")
            .setColor("#00AE86")
            .addFields(
                { 
                    name: "🌐 AI Translation System", 
                    value: "• **Auto:** Write in any language in `#ai-translator` for 🇺🇸 English.\n• **Reply:** Reply to a message in English to translate it back." 
                },
                { 
                    name: "💰 Bounty System", 
                    value: "• `!wanted [@user]` - Show wanted poster.\n• `!setbounty @user <amt>` - Set reward & role (Admin).\n• `!resetbounty @user` - Reset reward & role (Admin)." 
                },
                { 
                    name: "⚔️ Heroes & Guides", 
                    value: "• `!hero <name>` - Get guide (Only in `#unit-build`).\n• `!hero-list` - See all available heroes." 
                },
                { 
                    name: "⏰ Reminders", 
                    value: "• `!remind <cron> <msg>` - Set custom reminder.\n• `!reminders` - List your reminders.\n• `!allreminders` - View all schedules." 
                },
                { 
                    name: "🎖️ Role Management (Admin)", 
                    value: "• `!addrole @user <Role>` - Assign crew role.\n• `!removerole @user <Role>` - Remove crew role." 
                },
                { 
                    name: "🧹 Moderation", 
                    value: "• `!clear <1-100>` - Bulk delete messages (Admin)." 
                }
            )
            .setFooter({ text: "Sailing Kingdom | Official Bot Guide" })
            .setTimestamp();

        return msg.reply({ embeds: [helpEmbed] });
    }

    // --- 2.1 КОМАНДА: !hero-list ---
    if (cmd === "!hero-list") {
        if (msg.channel.name !== "unit-build") return msg.reply("❌ Use #unit-build!");
        const heroesData = getHeroes();
        const heroNames = Object.keys(heroesData).sort().join(", ");
        console.log("Намерени герои:", heroNames); // Виж в конзолата дали излиза нещо
        
        const listEmbed = new EmbedBuilder()
            .setTitle("📜 Hero Roster")
            .setColor("#00AE86")
            .setDescription(`Available heroes:\n**${heroNames || "No heroes found in JSON file!"}**`);
        return msg.reply({ embeds: [listEmbed] });
    }

    // --- 2.2 КОМАНДА: !hero ---
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") return msg.reply("❌ Use #unit-build!");
        if (!args[0]) return msg.reply("⚠️ Specify hero! Example: `!hero mihawk`.");
        const heroesData = getHeroes();
        const hero = heroesData[args[0].toLowerCase()];
        if (!hero) return msg.reply("❌ Hero not found! Use `!hero-list`.");
        const embed = new EmbedBuilder()
            .setTitle(hero.title).setImage(hero.image).setColor(hero.color || "#2b2d31")
            .addFields(
                { name: "Role", value: hero.role || "N/A", inline: true },
                { name: "Seals", value: hero.seals || "N/A", inline: false },
                { name: "Haki Rec", value: hero.haki || "N/A", inline: true }
            );
        return msg.channel.send({ embeds: [embed] });
    }

    // --- 3. КОМАНДА: !remind ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh || args.length < 5) return msg.reply("❌ Usage: `!remind 0 12 * * * Message` ");
        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron!");
        try {
            await pool.query("INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)",);
            msg.reply("✅ Reminder set!");
        } catch (err) { msg.reply("❌ DB Error."); }
    }

    // --- 4. КОМАНДА: !reminders ---
    if (cmd === "!reminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None.";
        return msg.reply("📋 **Dynamic Reminders:**\n" + list);
    }

    // --- 5. КОМАНДА: !allreminders ---
    if (cmd === "!allreminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
        const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
        const embed = new EmbedBuilder().setTitle("📋 All Scheduled Events").addFields({ name: "📌 Static", value: staticList }, { name: "⏰ Dynamic", value: dynamicList });
        return msg.reply({ embeds: [embed] });
    }

    // --- 6. КОМАНДА: !delete ---
    if (cmd === "!delete") {
        if (!msg.member.permissions.has("Administrator")) return msg.reply("❌ Only Admirals!");
        const id = args[0];
        if (!id) return msg.reply("❌ Usage: `!delete <id>`");
        await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
        return msg.reply(`🗑️ Deleted reminder \`${id}\`.`);
    }

    // --- 7. BOUNTY КОМАНДА: !wanted (СТИЛИЗИРАН ПЛАКАТ) ---
if (cmd === "!wanted") {
    // 1. Намираме канала "bounties"
    const bountyChannel = msg.guild.channels.cache.find(ch => ch.name === "bounties");
    if (!bountyChannel) return msg.reply("❌ Error: Channel `bounties` not found!");

    const target = msg.mentions.users.first() || msg.author;
    
    try {
        const res = await pool.query("SELECT bounty FROM users WHERE user_id = $1", [target.id]);
        const bounty = res.rows.length > 0 ? res.rows[0].bounty : 0;

        // 2. СЪЗДАВАМЕ ЕМБЕДА 
        const wantedEmbed = new EmbedBuilder()
            .setAuthor({ name: "MARINE HEADQUARTERS" }) // Заглавието най-отгоре
            .setTitle("☠️ W A N T E D ☠️") // Подзаглавието
            .setDescription(`**NAME: ${target.username.toUpperCase()}**\n---------------------------------`)
            .setColor("#e67e22") // Оранжев цвят за линията отстрани
            .addFields(
                { 
                    name: "💰 REWARD", 
                    value: `฿ **${Number(bounty).toLocaleString()}**`, 
                    inline: true 
                },
                { 
                    name: "📜 STATUS", 
                    value: "🔴 **DEAD OR ALIVE**", 
                    inline: true 
                }
            )
            // 3. ТУК СЛАГАМЕ КАРТИНКАТА С ЛУФИ (или аватара на човека)
            .setImage("https://imgur.com") // Можеш да сложиш твоя картинка тук
            .setFooter({ text: "By order of the World Government" })
            .setTimestamp();

        // 4. ИЗПРАЩАМЕ В #BOUNTIES
        await bountyChannel.send({ content: `${target}`, embeds: [wantedEmbed] });

        // 5. КРАТЪК ОТГОВОР В ТЕКУЩИЯ КАНАЛ
        const reply = await msg.reply(`✅ Your Wanted poster has been created in <#${bountyChannel.id}>!`);
        
        // Почистваме командата след 10 секунди
        setTimeout(() => {
            msg.delete().catch(() => {});
            reply.delete().catch(() => {});
        }, 10000);

    } catch (err) {
        console.error("Wanted error:", err.message);
    }
}



    // --- 8. BOUNTY КОМАНДА: !setbounty (ADMIN) ---
    if (cmd === "!setbounty") {
        if (!msg.member.permissions.has("Administrator")) return msg.reply("❌ Admirals only!");
        const target = msg.mentions.members.first();
        const amount = parseInt(args[1]); // args[0] е меншъна, args[1] е сумата
        if (!target || isNaN(amount)) return msg.reply("❌ Usage: `!setbounty @user 50000` ");
        await pool.query("INSERT INTO users (user_id, bounty, username) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET bounty = $2", [target.id, amount, target.user.username]);
        await updateBountyRole(target, amount); 
        return msg.reply(`✅ **${target.user.username}** now has a bounty of **${amount.toLocaleString()}** Beli!`);
    }

    // --- 9. BOUNTY КОМАНДА: !resetbounty (ADMIN) ---
    if (cmd === "!resetbounty") {
        if (!msg.member.permissions.has("Administrator")) return msg.reply("❌ Admirals only!");
        const target = msg.mentions.members.first();
        if (!target) return msg.reply("❌ Mention a user!");
        await pool.query("UPDATE users SET bounty = 0 WHERE user_id = $1", [target.id]);
        await updateBountyRole(target, 0); 
        return msg.reply(`✅ Bounty for **${target.user.username}** has been reset.`);
    }

    // --- 10. МОДЕРАЦИЯ: !clear (ДОСТЪПНА НАВСЯКЪДЕ) ---
if (cmd === "!clear") {
    // 1. ПРОВЕРКА ЗА ПРАВА: Проверяваме дали потребителят е Админ или има право да трие съобщения
    if (!msg.member.permissions.has("ManageMessages") && !msg.member.permissions.has("Administrator")) {
        const err = await msg.reply("❌ Only Admirals have the authority to clean the deck!");
        // Изтриваме съобщението за грешка и командата след 5 секунди, за да не се зацапва чата
        return setTimeout(() => { 
            err.delete().catch(()=>{}); 
            msg.delete().catch(()=>{}); 
        }, 5000);
    }

    // 2. Вземаме числото. Ако преди това си направил args.shift(), числото е в args[0]
    const amount = parseInt(args[0]);

    // 3. Проверка за валидно число (Discord лимитът е 1-100)
    if (isNaN(amount) || amount < 1 || amount > 100) {
        return msg.reply("⚠️ Please specify a number between 1 and 100. Example: `!clear 50`").then(m => {
            setTimeout(() => { m.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
        });
    }

    // 4. ИЗПЪЛНЕНИЕ: Масово изтриване
    try {
        // Трием посочения брой + самата команда (!clear)
        await msg.channel.bulkDelete(amount + 1, true);
        
        // Пращаме кратко потвърждение за успех
        const success = await msg.channel.send(`🧹 **Cleaning complete!** Deleted ${amount} messages.`);
        // Изтриваме автоматично потвърждението след 3 секунди
        setTimeout(() => success.delete().catch(()=>{}), 3000);
        
    } catch (err) {
        console.error("Clear error:", err.message);
        // Обясняваме на потребителя, ако Discord откаже (често при съобщения по-стари от 14 дни)
        msg.reply("❌ Failed to delete messages. (Note: Discord cannot delete messages older than 14 days).");
    }
}
}


module.exports = { handleCommands };
