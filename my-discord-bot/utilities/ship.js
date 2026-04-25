const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    ADMIN_ID: '190189929316352000', // Сложи твоето Discord ID тук
    ROLES: {
        'ship_1': '1490301070029623448', // Сложи ID на ролята за Кораб 1
        'ship_2': '1490478060322033838', // Сложи ID на ролята за Кораб 2
        'ship_3': '1497553509392974004'  // Сложи ID на ролята за Кораб 3
    },
    // Капитани (не могат да сменят сами и не се трият)
    CAPTAINS: [
        '825016547138732082'
    ],
    // Постоянни членове
    PERMANENT_CREW: [
        '529416192893517824'
    ]
};

module.exports = {
    // Функция за пращане на панела (извиква се от графика)
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 Belly Rush - Ship Registration')
            .setDescription('Select your ship for today\'s event.\n\n*Note: Captains and permanent crew remain in their positions.*')
            .setColor('#2b2d31');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('Ship 1').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('Ship 2').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('Ship 3').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Clear Active Crew').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
    },

    // Обработка на бутоните
    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        // 1. ИЗЧИСТВАНЕ (Само за Админ)
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
                        // Проверка: ако НЕ е капитан и НЕ е постоянен, махаме ролята
                        if (!CONFIG.PERMANENT_CREW.includes(m.id) && !CONFIG.CAPTAINS.includes(m.id)) {
                            await m.roles.remove(role).catch(() => {});
                            removed++;
                        }
                    }
                }
            }
            return interaction.editReply(`✅ Cleared ${removed} active members. Captains/Permanent crew were not affected.`);
        }

        // 2. ИЗБОР НА КОРАБ (С автоматична смяна)
        if (CONFIG.ROLES[customId]) {
            const targetRoleId = CONFIG.ROLES[customId];
            
            // Защита за капитани и постоянни
            if (CONFIG.PERMANENT_CREW.includes(member.id) || CONFIG.CAPTAINS.includes(member.id)) {
                return interaction.reply({ content: '⚠️ You cannot change ships manually.', ephemeral: true });
            }

            // Махане на старите роли за кораби (за да има само 1)
            const allShipRoles = Object.values(CONFIG.ROLES);
            const rolesToRemove = member.roles.cache.filter(r => allShipRoles.includes(r.id));
            
            for (const [id, role] of rolesToRemove) {
                if (id !== targetRoleId) await member.roles.remove(role).catch(() => {});
            }

            // Добавяне на новата роля
            if (!member.roles.cache.has(targetRoleId)) {
                await member.roles.add(targetRoleId);
                return interaction.reply({ content: `✅ Joined **${guild.roles.cache.get(targetRoleId).name}**!`, ephemeral: true });
            } else {
                return interaction.reply({ content: 'ℹ️ You are already in this crew.', ephemeral: true });
            }
        }
    }
};
