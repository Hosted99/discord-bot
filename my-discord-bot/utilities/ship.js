const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- CONFIGURATION ---
const CONFIG = {
    ADMIN_ID: '190189929316352000', 
    ROLES: {
        'ship_1': '1490301070029623448', 
        'ship_2': '1490478060322033838', 
        'ship_3': '1497553509392974004'  
    },
    CAPTAINS: ['825016547138732082'],
    PERMANENT_CREW: ['529416192893517824'],
    MAX_MEMBERS: 10
};

module.exports = {
    // Функция за пращане на панела с @everyone и новия текст
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 BELLY RUSH | Ship Registration')
            .setDescription(
                '***Attention Sailors!*** ⚓\n' +
                'The fleet is preparing for departure. Get ready for battle!'
            )
            .addFields(
                { 
                    name: '🛡️ Active Crew', 
                    value: 'These buttons are for **active players** who want to manage their participation. If you like switching ships or join frequently, pick your role below!', 
                    inline: false 
                },
                { 
                    name: '⚓ Permanent Crew', 
                    value: 'Your spots are **secured**. If you don\'t feel like clicking, you are already part of the manifest. This is only for those who want to be active!', 
                    inline: false 
                }
            )
            .setColor('#2ecc71') // Свежо зелено за "Open registration"
            .setThumbnail('https://flaticon.com') // Малка икона на кораб
            // Можеш да добавиш голям банер тук:
            .setImage('https://imgur.com') 
            .setFooter({ 
                text: '⚓ Pick your ship and prepare for battle! | Hosted by Captain', 
                iconURL: 'https://flaticon.com' 
            })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('Ship 1').setStyle(ButtonStyle.Primary).setEmoji('🚢'),
            new ButtonBuilder().setCustomId('ship_2').setLabel('Ship 2').setStyle(ButtonStyle.Primary).setEmoji('🛥️'),
            new ButtonBuilder().setCustomId('ship_3').setLabel('Ship 3').setStyle(ButtonStyle.Primary).setEmoji('⛵'),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Reset Fleet').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await channel.send({ 
            content: '@everyone **The Belly Rush registration is now OPEN!** 🌊', 
            embeds: [embed], 
            components: [row] 
        });
    },

    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        // 1. ИЗЧИСТВАНЕ
        if (customId === 'clear_all') {
            if (user.id !== CONFIG.ADMIN_ID) {
                return interaction.reply({ content: '❌ Only the administrator can reset crews!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            let removed = 0;
            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    for (const [id, m] of role.members) {
                        if (!CONFIG.PERMANENT_CREW.includes(m.id) && !CONFIG.CAPTAINS.includes(m.id)) {
                            await m.roles.remove(role).catch(() => {});
                            removed++;
                        }
                    }
                }
            }
            return interaction.editReply(`✅ Cleared ${removed} active members.`);
        }

        // 2. ИЗБОР НА КОРАБ
        if (CONFIG.ROLES[customId]) {
            const targetRoleId = CONFIG.ROLES[customId];
            const role = guild.roles.cache.get(targetRoleId);

            if (CONFIG.PERMANENT_CREW.includes(member.id) || CONFIG.CAPTAINS.includes(member.id)) {
                return interaction.reply({ content: '⚠️ Captains and permanent crew cannot change ships.', ephemeral: true });
            }

            if (role && role.members.size >= CONFIG.MAX_MEMBERS && !member.roles.cache.has(targetRoleId)) {
                return interaction.reply({ content: `❌ This ship is full! (Max ${CONFIG.MAX_MEMBERS})`, ephemeral: true });
            }

            try {
                await interaction.deferReply({ ephemeral: true });

                const allShipRoles = Object.values(CONFIG.ROLES);
                for (const rId of allShipRoles) {
                    if (member.roles.cache.has(rId) && rId !== targetRoleId) {
                        await member.roles.remove(rId).catch(() => {});
                    }
                }

                if (!member.roles.cache.has(targetRoleId)) {
                    await member.roles.add(role);
                    return interaction.editReply(`✅ Joined **${role.name}**!`);
                } else {
                    return interaction.editReply('ℹ️ You are already in this crew.');
                }
            } catch (err) {
                return interaction.editReply(`❌ Error: ${err.message}. Check bot role hierarchy!`);
            }
        }
    }
};
