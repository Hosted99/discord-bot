const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Променяме на MemePiece - там са истинските смешки!
            const response = await fetch('https://meme-api.com');
            const data = await response.json();

            // Проверка дали е реална картинка и дали не е спойлер (NSFW)
            if (!data.url || data.nsfw || !data.url.match(/\.(jpg|jpeg|png|gif)$/)) {
                // Ако не ни хареса, пробваме пак автоматично
                return this.getRandomMeme(msg);
            }

            const embed = new EmbedBuilder()
                .setTitle(data.title.length > 256 ? "🏴‍☠️ One Piece Meme" : data.title)
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor('#ffcc00') // Пиратско златно
                .setFooter({ text: `😂 r/${data.subreddit} | 👍 ${data.ups} Upvotes` });

            await msg.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("Meme Error:", err.message);
            await msg.channel.send('⚓ The Grand Line is foggy today! No memes found.');
        }

        // Изтриваме командата накрая
        await msg.delete().catch(() => {});
    }
};
