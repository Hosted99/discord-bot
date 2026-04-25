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
            .setTitle('🚢 Belly Rush - Ship Registration')
            .setDescription(
                '**Attention Sailors!** ⚓\n\n' +
                'These buttons are for **active players** who participate in the event frequently or want to join the crew in a more interactive way. If you like switching ships or just want to be part of the action, grab a role!\n\n' +
                '*Note: If you are a permanent crew member and don\'t feel like clicking, don\'t worry – your spot is already secured. This is mainly for those who want to manage their participation actively.*'
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Pick your ship and prepare for battle!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('Ship 1').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('Ship 2').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('Ship 3').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Clear Active Crew').setStyle(ButtonStyle.Danger)
        );

        // Пращаме @everyone таг заедно с панела
        await channel.send({ 
            content: '@everyone The ship registration is now open!', 
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
