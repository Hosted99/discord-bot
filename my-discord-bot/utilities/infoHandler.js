const { EmbedBuilder } = require("discord.js");

/**
 * Функция за изпращане на пълното ръководство в #bot-info
 */
const sendBotManual = async (guild) => {
    // 1. Намираме канала по име
    const infoChannel = guild.channels.cache.find(ch => ch.name === "│🤖│bot-info");
    if (!infoChannel) return;

    // 2. Изчистваме старите съобщения (до 100), за да е винаги чисто и подредено
    await infoChannel.bulkDelete(100).catch(() => {});

    // 3. Създаваме основния Embed с абсолютно всички системи
    const manualEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ Sailing Kingdom | Complete Bot Manual")
        .setDescription("Welcome aboard! Here is the complete guide to all automated systems and commands on our ship:")
        .setColor("#ff0044") // Твоето червено
        .setThumbnail(guild.iconURL({ dynamic: true })) // Иконата на сървъра
        .addFields(
        { 
            name: "🌐 1. AI Translator (#ai-translator)", 
            value: "• **Auto-Translate:** Write in any language; I'll instantly translate it to 🇺🇸 **English**.\n" +
                   "• **Reverse Translation:** Reply to a translated message in English to translate it back to the original author's language."
        },
        { 
            name: "🛂 2. Nickname & Verification", 
            value: "• **New Pirates:** Start as **Rookies** with limited access.\n" +
                   "• **The Button:** Click **'Nickname'** in <#│👋│welcome>.\n" +
                   "• **Requirement:** Put guild tag (e.g., `TS Name` or `Thousand Sunny Name`).\n" +
                   "• **Unlock:** Automatically grants **Player** role and opens the ship! 🔓"
        },
        { 
            name: "⚔️ 3. Mania Battle System", 
            value: "• **Step 1: `mania-plan g1/g2/all`** - Start recruitment with ✅/❌ reactions.\n" +
                   "• **Step 2: `mania-list g1/g2`** - Get a live report of all confirmed players.\n" +
                   "• **Step 3: `mania-strategy <text>`** - Post the battle plan & ping everyone."
        },
        { 
            name: "⚓ 4. Leveling & Pirate Ranks", 
            value: "• **XP Gains:** Chat to earn XP. Images grant **Bonus XP**! 🖼️\n" +
                   "• **35 Unique Roles:** From **Silent Snail** 🐌 to **Grass Avoider** 🌱❌.\n" +
                   "• **Level Up:** Custom roast/congrats messages in <#1498426382219481248>.\n" +
                   "• `!rank` — See your progress bar `[▇▇▇——]` and current title."
        },
        { 
            name: "🚢 5. Belly Rush Registration", 
            value: "• **Interactive Panel:** Use buttons to join **mugi**, **mari**, or **goat** ship.\n" +
                   "• **Limits:** Max **10 members** per active crew.\n" +
                   "• `!clear_all` — (Admin) Reset all active crews for the next event."
        },
        { 
            name: "☠️ 6. Bounty & Wanted System", 
            value: "• `!wanted [@user]` — View a pirate's Wanted Poster.\n" +
                   "• `!setbounty @user <amount>` — (Admin) Set a pirate's bounty.\n" +
                   "• `!resetbounty @user` — (Admin) Reset bounty to 0."
        },
        { 
            name: "⚔️ 7. Hero Guides (#unit-build)", 
            value: "• `!hero <name>` — Full build guide (Role, Seals, Haki) with a custom GIF.\n" +
                   "• `!hero-list` — View all available heroes."
        },
        { 
            name: "⏰ 8. Reminders & Events", 
            value: "• **Auto-Pings:** For Mania, Shandora, and Belly Rush.\n" +
                   "• `!remind <cron> <text>` — Set custom reminders (Stored in **Neon DB**).\n" +
                   "• `!reminders` — List your active personal reminders."
        },
        { 
            name: "🎖️ 9. Role Management", 
            value: "• `!addrole @user <rank>` — Assign specific pirate ranks.\n" +
                   "• `!addroleallts @role` — Sync roles for everyone with **ᐪˢ☠️**.\n" +
                   "• `!addroleallgm @role` — Sync roles for everyone with **ᴳᴹ☠️**."
        },
        { 
            name: "🛡️ 10. Admin Control & Security", 
            value: "• `!top` — Show the Top 10 most active pirates on the ship.\n" +
                   "• `!sync` — Manually save all pirate data to **Neon Cloud**.\n" +
                   "• `!clear <1-100>` — Bulk delete messages.\n" +
                   "• `!sendto #channel <msg>` — Redirect messages (Auto-cleans in 2s)."
            }
        )
        .setFooter({ text: "Sailing Kingdom Engine • v2.7 • Automatically updated on startup" })
        .setTimestamp();

    // Функция за сбогуване
const sendFarewell = async (client) => {
    // Обхождаме всички сървъри, в които е ботът
    const guilds = client.guilds.cache;
    
    for (const [id, guild] of guilds) {
        const botChannel = guild.channels.cache.find(ch => ch.name === "│🤖│bot-info");
        if (botChannel) {
            const farewellEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Offline")
                .setDescription("🌅 **Farewell, pirates! I'm heading to port for maintenance. I will be back soon!**")
                .setColor("#ff4444") // Червено за офлайн
                .setTimestamp();

            // Използваме 'await', за да сме сигурни, че съобщението е пратено преди стопа
            await botChannel.send({ embeds: [farewellEmbed] }).catch(() => {});
        }
    }
};

// Не забравяй да я добавиш в exports!
module.exports = { sendBotManual, sendFarewell };
    

    // 4. Изпращаме финалното съобщение
    await infoChannel.send({ embeds: [manualEmbed] });
};

module.exports = { sendBotManual };
