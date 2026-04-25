const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Използваме стабилно API за мемета от Reddit
            const response = await axios.get('https://meme-api.com');
            const data = response.data;

            const embed = new EmbedBuilder()
                .setTitle(data.title) // Заглавието на мемето
                .setURL(data.postLink) // Линк към оригиналния пост
                .setImage(data.url) // Самата картинка
                .setColor('#ff4500') // Оранжев цвят (като Reddit)
                .setFooter({ text: `👍 ${data.ups} upvotes | Source: r/${data.subreddit}` });

            await msg.reply({ embeds: [embed] });
        } catch (err) {
            console.error("Грешка при меме командата:", err.message);
            msg.reply("❌ Oops! The meme treasury is empty right now. Try again later!");
        }
    }
};

