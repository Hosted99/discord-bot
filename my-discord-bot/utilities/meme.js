const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Използваме това API - то е най-сигурното за картинки
            const response = await fetch('https://meme-api.com');
            const data = await response.json();

            // Проверка дали линкът завършва на картинка (jpg, png, gif)
            const isImage = /\.(jpg|jpeg|png|gif)$/i.test(data.url);

            if (data.url && isImage) {
                const embed = new EmbedBuilder()
                    .setTitle(data.title || "Fresh Meme!")
                    .setURL(data.postLink)
                    .setImage(data.url)
                    .setColor('#ff4500')
                    .setFooter({ text: `👍 ${data.ups} | Source: r/${data.subreddit}` });

                await msg.channel.send({ embeds: [embed] });
            } else {
                // Ако API-то върне нещо друго, пробваме пак веднъж
                return this.getRandomMeme(msg);
            }

            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Meme Error:", err.message);
            // Гарантирана картинка, ако интернетът спре
            await msg.channel.send("https://imgur.com");
        }
    }
};
