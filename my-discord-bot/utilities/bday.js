const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // ТЕСТ: Нагласено за 02:20 (след 4 минути)
    cron.schedule('20 02 * * *', async () => {
        const CHANNEL_ID = '1490378124259758261';
        const FRIEND_ID = '190189929316352000';

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            const bdayEmbed = new EmbedBuilder()
                .setColor('#00FFFF')
                .setTitle('🎉 HAPPY BIRTHDAY! 🎉')
                .setDescription(`Wishing <@${FRIEND_ID}> an incredible day! 🎂`)
                .setImage('https://giphy.com');

            await channel.send({ content: `📢 @everyone, birthday time! <@${FRIEND_ID}> 🎈`, embeds: [bdayEmbed] });
            console.log("🚀 TEST SUCCESSFUL: Message sent.");
        } catch (err) {
            console.error("Cron Error:", err);
        }
    }, {
        timezone: "Europe/Sofia"
    });

    console.log("✅ Birthday system active. Waiting for 02:20...");
};
