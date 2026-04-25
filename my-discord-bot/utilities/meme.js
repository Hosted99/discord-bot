const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Взимаме случайно меме от API
            const response = await axios.get('https://meme-api.com');
            const data = response.data;

            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor('#ff4500')
                .setFooter({ text: `👍 ${data.ups} | Subreddit: r/${data.subreddit}` });

            await msg.reply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            msg.reply("❌ Не можах да намеря меме в момента.");
        }
    }
};
