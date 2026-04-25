const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    async getRandomMeme(msg) {
        try {
            let data;

            // пробваме до 5 пъти да намерим читав meme
            for (let i = 0; i < 5; i++) {
                const res = await fetch('https://meme-api.com/gimme/OnePiece,animememes');
                const json = await res.json();

                if (
                    json.url &&
                    json.url.match(/\.(jpg|jpeg|png|gif)$/) &&
                    json.ups > 200 &&
                    !json.title.toLowerCase().includes("chapter") &&
                    !json.title.toLowerCase().includes("episode")
                ) {
                    data = json;
                    break;
                }
            }

            if (!data) throw new Error("No good memes found");

            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setImage(data.url)
                .setColor('#ffcc00')
                .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` });

            await msg.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            await msg.reply('Няма истински мемета 😭');
        }

        await msg.delete().catch(() => {});
    }
};
