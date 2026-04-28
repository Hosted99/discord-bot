const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Замени това с истинското ID на твоя сървър
const TARGET_GUILD_ID = '1451310326019526800'; 

module.exports = (client) => {
    
    // 1. Автоматична роля само в конкретния сървър
    client.on('guildMemberAdd', async (member) => {
        if (member.guild.id !== TARGET_GUILD_ID) return; // Спира тук, ако сървърът е друг

        const rookieRole = member.guild.roles.cache.find(r => r.name.toLowerCase() === 'rookies');
        if (rookieRole) {
            await member.roles.add(rookieRole).catch(() => {});
        }
    });

    // 2. Интеракции само в конкретния сървър
    client.on('interactionCreate', async (interaction) => {
        if (interaction.guildId !== TARGET_GUILD_ID) return; // Спира тук, ако сървърът е друг

        if (interaction.isButton() && interaction.customId === 'start_verify') {
            const modal = new ModalBuilder()
                .setCustomId('nick_modal')
                .setTitle('Регистрация');

            const nameInput = new TextInputBuilder()
                .setCustomId('nickname_input')
                .setLabel("Въведи твоя никнейм:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'nick_modal') {
            const newNick = interaction.fields.getTextInputValue('nickname_input');
            const rookieRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'rookies');
            const playerRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'player');

            try {
                await interaction.member.setNickname(newNick);
                if (rookieRole) await interaction.member.roles.remove(rookieRole);
                if (playerRole) await interaction.member.roles.add(playerRole);

                await interaction.reply({ content: `Готово, ${newNick}!`, ephemeral: true });
            } catch (err) {
                await interaction.reply({ content: 'Грешка с правата!', ephemeral: true });
            }
        }
    });
};

