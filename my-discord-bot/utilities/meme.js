const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        // Ръчно подбран списък с мемета, които ВИНАГИ работят
        const stableMemes = [
            "https://redd.it",
            "https://redd.it",
            "https://imgur.com",
            "https://imgflip.com",
            "https://redd.it",
            "https://redd.it"
        ];

        try {
            // Първо пробваме пак API-то (може да се е събудило)
            const response = await fetch('https://meme-api.com');
            const data = await response.json();

            // Проверяваме дали линкът е директна картинка
            if (data.url && data.url.match(/\.(jpg|jpeg|png|gif)$/)) {
                const embed = new EmbedBuilder()
                    .setTitle(data.title || "Fresh Meme!")
                    .setImage(data.url)
                    .setColor('#ff4500')
                    .setFooter({ text: `Source: r/${data.subreddit}` });

                await msg.channel.send({ embeds: [embed] });
            } else {
                throw new Error("Invalid API response");
            }

        } catch (err) {
            // АКО API-ТО ПАК ПРЕДАДЕ: Взимаме случаен линк от нашия списък
            const fallbackMeme = stableMemes[Math.floor(Math.random() * stableMemes.length)];
            
            const fallbackEmbed = new EmbedBuilder()
                .setTitle("The treasury was empty, but I found this! ⚓")
                .setImage(fallbackMeme)
                .setColor('#3498db');

            await msg.channel.send({ embeds: [fallbackEmbed] });
        } finally {
            // Трием командата !meme в края
            await msg.delete().catch(() => {});
        }
    }
};
