const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // --- CONFIGURATION ---
   const TARGET_HOUR = 2;         // Сега е 2 часа
const TARGET_MINUTE = 12;      // :00
    const CHANNEL_ID = '1490378124259758261';
    const FRIEND_ID = '190189929316352000';
    // ---------------------

    const now = new Date();
    const targetDate = new Date();
    
    // Set for tomorrow at 09:00:00
    targetDate.setDate(now.getDate() + 1); 
    targetDate.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    const delay = targetDate.getTime() - now.getTime();

    if (delay > 0) {
        console.log(`✅ Birthday alert scheduled for: ${targetDate.toString()}`);
        console.log(`⏰ Time remaining: ${(delay / 1000 / 3600).toFixed(2)} hours.`);

        setTimeout(async () => {
            try {
                const channel = await client.channels.fetch(CHANNEL_ID);
                if (!channel) return console.error("Channel not found!");

                const bdayEmbed = new EmbedBuilder()
                    .setColor('#00FFFF') // Cyan color
                    .setTitle('🎉 HAPPY BIRTHDAY! 🎉')
                    .setDescription(`Today is a very special day! Wishing <@${FRIEND_ID}> an incredible year filled with success and happiness! 🎂🍻`)
                    .setImage('https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTVpbHliempjZWdmN3YzNDdvODFicWI0MG1vMWw4c2VpMmg3YThzdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YuKRFGvBhcSLVFO6Oh/giphy.gif')
                    .setFooter({ text: 'Party Mode: Activated 🎈' })
                    .setTimestamp();

                await channel.send({ 
                    content: `📢 Wake up @everyone! It's time to celebrate! <@${FRIEND_ID}> is leveling up today! 🎊`, 
                    embeds: [bdayEmbed] 
                });
                
                console.log("🚀 Birthday message sent successfully!");
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }, delay);
    } else {
        console.log("❌ Error: Target time is in the past.");
    }
};
