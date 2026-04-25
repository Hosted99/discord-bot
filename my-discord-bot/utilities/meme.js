const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Директно API, което връща само картинка
            const response = await fetch('https://meme-api.com');
            const data = await response.json();

            // Проверка дали API-то е върнало валидна картинка
            if (data && data.url) {
                const embed = new EmbedBuilder()
                    .setTitle(data.title || 'Meme Time!')
                    .setURL(data.postLink)
                    .setImage(data.url)
                    .setColor('#ff4500')
                    .setFooter({ text: `r/${data.subreddit} | 👍 ${data.ups}` });

                await msg.channel.send({ embeds: [embed] });
            } else {
                throw new Error("Invalid API response");
            }

            await msg.delete().catch(() => {});

        } catch (err) {
            // АКО API-ТО ПАК ПАДНЕ: Използваме директни линкове към сигурни мемета
            const backupMemes = [
                "https://imgur.com",
                "https://redd.it",
                "https://redd.it",
                "https://imgflip.com"
            ];
            const randomMeme = backupMemes[Math.floor(Math.random() * backupMemes.length)];
            
            await msg.channel.send({ content: randomMeme });
            await msg.delete().catch(() => {});
        }
    }
};
