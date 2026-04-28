const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { pool } = require("./db"); // Връзката с Neon

// --- CONFIG ---
const CONFIG = {
    ADMIN_ID: ['190189929316352000', '825016547138732082'],
    CHANNEL_ID: '1498803889305157743', 
    ROLES: {
        'ship_1': '1491392968270151700',
        'ship_2': '1496765894708301925',
        'ship_3': '1496765963222384641'
    },
    CAPTAINS: ['306882897611063306','825016547138732082','1479431114148806708'],
    MAX_MEMBERS: 10
};

module.exports = {
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
                    value: 'These buttons are for **active players**. Pick your role below!', 
                    inline: false 
                },
                { 
                    name: '⚓ Permanent Crew', 
                    value: 'Your spots are **secured**. You are already part of the manifest.', 
                    inline: false 
                },
                { 
                    name: '📝 Request Permanent Status', 
                    value: 'Use `!want [ship-name]` to never have to click buttons again!', 
                    inline: false 
                }
            )
            .setColor('#2ecc71') 
            .setImage('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExczVjbHA5emc1M3NuYmNybXZhNjlsNHk2OGtjbHMxODRzb2U0dGg1ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7zmLy0sYn9Y8O6BrlF/giphy.gif') 
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('mugi-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('mari-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('goat-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Reset Fleet').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: '@everyone Belly Rush is OPEN!', embeds: [embed], components: [row] });
    },

    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        // --- RESET FLEET ---
        if (customId === 'clear_all') {
            const isAdmin = member.permissions.has('Administrator');
            // ПРАВИЛНА ПРОВЕРКА ЗА МАСИВ ОТ АДМИНИ
            if (!CONFIG.ADMIN_ID.includes(user.id) && !isAdmin) {
                return interaction.reply({ content: '❌ No permission.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            const res = await pool.query("SELECT user_id FROM permanent_crew");
            const permanentIDs = res.rows.map(row => row.user_id);

            let removed = 0;
            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (!role) continue;
                for (const [id, m] of role.members) {
                    if (!permanentIDs.includes(m.id) && !CONFIG.CAPTAINS.includes(m.id)) {
                        await m.roles.remove(role).catch(() => {});
                        removed++;
                    }
                }
            }
            return interaction.editReply(`✅ Cleared ${removed} users. Permanent crew stayed.`);
        }

        // --- SHIP JOIN ---
        if (CONFIG.ROLES[customId]) {
            const roleId = CONFIG.ROLES[customId];
            const role = guild.roles.cache.get(roleId);

            // 1. ПРОВЕРКА: Вече ли е в този кораб?
            if (member.roles.cache.has(roleId)) {
                return interaction.reply({ content: 'ℹ️ Already in this ship.', ephemeral: true });
            }

            // 2. ПРОВЕРКА: Постоянен екипаж
            const check = await pool.query("SELECT 1 FROM permanent_crew WHERE user_id = $1", [member.id]);
            if (check.rowCount > 0) return interaction.reply({ content: '⚠️ You are permanent crew.', ephemeral: true });

            // 3. ПРОВЕРКА: Капитан
            if (CONFIG.CAPTAINS.includes(member.id)) return interaction.reply({ content: '⚠️ Captains cannot switch.', ephemeral: true });
            
            // 4. ПРОВЕРКА: Пълен ли е корабът?
            if (role.members.size >= CONFIG.MAX_MEMBERS) {
                return interaction.reply({ content: '❌ Ship is full.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            // МАХАНЕ НА ДРУГИ КОРАБНИ РОЛИ
            for (const rId of Object.values(CONFIG.ROLES)) {
                if (member.roles.cache.has(rId)) await member.roles.remove(rId).catch(() => {});
            }

            await member.roles.add(role);
            return interaction.editReply(`✅ Joined ${role.name}`);
        }
    },

    handleMessage: async (message) => {
        if (message.author.bot || !message.guild || message.channel.id !== CONFIG.CHANNEL_ID || !message.content.startsWith('!want')) return;

        try {
            const args = message.content.trim().split(/\s+/);
            const ship = args[1];
            const shipMap = { 'mugi-ship': 'ship_1', 'mari-ship': 'ship_2', 'goat-ship': 'ship_3' };
            const shipKey = shipMap[ship];

            if (!shipKey) return message.reply('❌ Use: `!want mugi-ship`, `!want mari-ship` or `!want goat-ship`');

            const roleId = CONFIG.ROLES[shipKey];
            const role = message.guild.roles.cache.get(roleId);
            if (!role) return message.reply("❌ Role not found.");

            for (const rId of Object.values(CONFIG.ROLES)) {
                if (message.member.roles.cache.has(rId)) await message.member.roles.remove(rId).catch(() => {});
            }

            await message.member.roles.add(role);

            await pool.query(
                `INSERT INTO permanent_crew (user_id, username) 
                 VALUES ($1, $2) 
                 ON CONFLICT (user_id) 
                 DO UPDATE SET username = $2`, 
                [message.author.id, message.author.username]    
            );

            return message.reply(`✅ You are now **PERMANENT** in ${role.name}`);
        } catch (error) {
            console.error("Database Error:", error);
            return message.reply("⚠️ Database error occurred.");
        }
    }
};
