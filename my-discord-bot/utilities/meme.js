const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    async getRandomMeme(msg) {
        try {
            const response = await fetch('https://meme-api.com/gimme/OnePiece');
            const data = await response.json();

            // филтър за реални картинки
            if (!data.url || !data.url.match(/\.(jpg|jpeg|png|gif)$/)) {
                throw new Error("Invalid image");
            }

            const embed = new EmbedBuilder()
                .setTitle(data.title || "One Piece Meme 🏴‍☠️")
                .setImage(data.url)
                .setColor('#ffcc00')
                .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` });

            await msg.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            await msg.reply('Няма мемета от Grand Line 😭');
        }

        await msg.delete().catch(() => {});
    }
};
