const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

// --- КОНФИГУРАЦИЯ ---
const ALLOWED_GUILDS = ['1486343040162468003', '1451310326019526800']; // Сложи истинските ID-та тук
let lastWelcomeMessage = null;

const managedRoles = [
    "Pirate King Crew", "Pirate King", "Whitebeard's", "Mini Whitebeard's", 
    "Team builder", "Whitebeard's Leader", "Whitebeard's Vice Leader", 
    "Mini Whitebeard's Leader", "Mini Whitebeard's Vice Leader", "Rookies"
];

const bountyTiers = [];
for (let i = 900; i >= 50; i -= 50) {
    bountyTiers.push({ min: i * 1000000, name: `Bounty: ${i}M+` });
}

/**
 * Автоматично посрещане
 */
async function handleNewMember(member) {
    if (!ALLOWED_GUILDS.includes(member.guild.id)) return;

    try {
        const rookieRole = member.guild.roles.cache.find(r => r.name === "Rookies");
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === "│👋│welcome");

        if (rookieRole) await member.roles.add(rookieRole);

        if (welcomeChannel) {
            if (lastWelcomeMessage) {
                await lastWelcomeMessage.delete().catch(() => {});
            }

            const welcomeEmbed = new EmbedBuilder()
                .setTitle("⚓ New Pirate Aboard!")
                .setDescription(
                    `Ahoy, pirate ${member}! 🏴‍☠️\n\n` +
                    `Welcome to the **Pirate Queen’s Family**.\n\n` +
                    `📜 **The Pirate Code:** Check <#1497466531322527877>.\n` +
                    `💰 **Верификация:** Натисни бутона долу, за да въведеш никнейма си, да премахнеш роля **Rookies** и да получиш **Player** достъп! ⚔️`
                )
                .setColor("#2ECC71")
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Member #${member.guild.memberCount}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verify')
                    .setLabel('Въведи Никнейм')
                    .setStyle(ButtonStyle.Success)
            );

            lastWelcomeMessage = await welcomeChannel.send({ 
                content: `${member}`, 
                embeds: [welcomeEmbed], 
                components: [row] 
            });
        }
    } catch (err) { console.error("Welcome Error:", err.message); }
}

/**
 * Обработка на бутона и формата за никнейм
 */
async function handleInteraction(interaction) {
    if (!interaction.guild || !ALLOWED_GUILDS.includes(interaction.guild.id)) return;

    // 1. Отваряне на прозореца при натискане на бутона
    if (interaction.isButton() && interaction.customId === 'start_verify') {
        const modal = new ModalBuilder()
            .setCustomId('nick_modal')
            .setTitle('Регистрация на Пират');

        const nameInput = new TextInputBuilder()
            .setCustomId('new_nickname')
            .setLabel("Въведи твоя никнейм:")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Пример: Monkey D. Luffy")
            .setMinLength(2)
            .setMaxLength(32)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
    }

    // 2. Обработка на изпратения никнейм
    if (interaction.isModalSubmit() && interaction.customId === 'nick_modal') {
        const newNick = interaction.fields.getTextInputValue('new_nickname');
        
        try {
            const rookieRole = interaction.guild.roles.cache.find(r => r.name === "Rookies");
            const playerRole = interaction.guild.roles.cache.find(r => r.name === "Player");

            // Сменяме никнейма
            await interaction.member.setNickname(newNick);

            // Сменяме ролите (Махаме Rookies, Даваме Player)
            if (rookieRole) await interaction.member.roles.remove(rookieRole);
            if (playerRole) await interaction.member.roles.add(playerRole);

            await interaction.reply({ 
                content: `✅ Твоят никнейм е променен на **${newNick}**! Вече си **Player** и имаш пълен достъп.`, 
                ephemeral: true 
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({ 
                content: "❌ Не мога да променя никнейма ти. Провери дали ботът има нужните права!", 
                ephemeral: true 
            });
        }
    }
}



///__________________________________ТЕСТ



/**
 * Контрол на специалните пиратски роли чрез команди !addroleall !addrole и !removerole
 */
async function handleRoleCommands(msg, cmd, args) {
    if (!msg.member.permissions.has("ManageRoles")) return;


     // --- МАСОВИ КОМАНДИ ЗА ТАГОВЕ ---
    if (cmd === "!addroleallts" || cmd === "!addroleallgm") {
        msg.delete().catch(() => {});
        
        // Само Админи могат да пускат масово раздаване
        if (!msg.member.permissions.has("Administrator")) {
            return msg.reply("❌ Only Admirals can use mass-role commands.")
                      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        // Определяме кой таг да търсим според командата
        // Ако пишеш !addroleallts -> търси ᐪˢ☠️
        // Ако пишеш !addroleallgm -> търси ᴳᴹ☠️
        const tag = (cmd === "!addroleallgm") ? "ᴳᴹ☠️" : "ᐪˢ☠️";

        const role = msg.mentions.roles.first() || msg.guild.roles.cache.get(args[0]);

        if (!role) {
            return msg.channel.send(`❌ Usage: \`${cmd} @role\``)
                      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        const statusMsg = await msg.channel.send(`⏳ Scanning for pirates with tag **${tag}**...`);

        try {
            const allMembers = await msg.guild.members.fetch();
            
            // Филтрираме по съответния таг
            const targets = allMembers.filter(m => 
                m.user.username.includes(tag) || 
                (m.nickname && m.nickname.includes(tag))
            );

            if (targets.size === 0) {
                return statusMsg.edit(`❌ No users found with tag **${tag}**.`);
            }

            let count = 0;
            for (const [id, member] of targets) {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role).catch(() => {});
                    count++;
                }
            }

            return statusMsg.edit(`✅ Added **${role.name}** to **${count}** members with the **${tag}** tag.`);
        } catch (err) {
            console.error(err);
            return statusMsg.edit("❌ Error during mass update.");
        }
    }

  
///

    
    const targetUser = msg.mentions.members.first();
    // 1. Проверяваме дали е тагната роля или е написана като текст
    const mentionedRole = msg.mentions.roles.first();
    
    // Ако има тагната роля, взимаме нейното име, иначе взимаме текста след потребителя
    let roleName = mentionedRole ? mentionedRole.name : args.slice(1).join(" ").trim();

    if (!targetUser || !roleName) {
        return msg.reply("❌ Usage: `!addrole @user RoleName`").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // 2. Проверка в списъка (managedRoles трябва да е дефиниран в същия файл или подаден)
    const isManaged = managedRoles.some(r => r.toLowerCase().trim() === roleName.toLowerCase().trim());
    
    if (!isManaged) {
        console.log(`[DEBUG] Role rejected: "${roleName}"`); // За да видиш в Railway какво точно се проваля
        return msg.reply(`⚠️ The role "**${roleName}**" is not in the managed pirate list!`);
    }

    // 3. Намиране на обекта на ролята в сървъра
    const role = mentionedRole || msg.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

    if (!role) return msg.reply(`❌ Role "**${roleName}**" not found in this server!`);

    try {
        if (cmd === "!addrole") {
            await targetUser.roles.add(role);
            
            // Специален поздрав за лидери
            if (roleName.toLowerCase().includes("leader") || roleName.toLowerCase().includes("king")) {
                const promo = new EmbedBuilder()
                    .setTitle("🎖️ New Promotion!")
                    .setDescription(`Everyone salute! ${targetUser} has been promoted to **${role.name}**!`)
                    .setColor("#FFD700")
                    .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }));
                return msg.channel.send({ embeds: [promo] });
            }
            return msg.reply(`✅ **${role.name}** assigned to ${targetUser.user.username}.`);
        }

        if (cmd === "!removerole") {
            await targetUser.roles.remove(role);
            return msg.reply(`🗑️ **${role.name}** removed from ${targetUser.user.username}.`);
        }
    } catch (err) {
        console.error(err);
        return msg.reply("❌ **Hierarchy Error!** Go to Server Settings -> Roles and move my bot role **HIGHER** than the pirate roles.");
    }
}

/**
 * АВТОМАТИЧНА СМЯНА НА ЦВЕТНИТЕ BOUNTY РОЛИ (След !setbounty)
 */
async function updateBountyRole(member, amount) {
    if (!member) return null;
    try {
        // Намираме най-високото ниво, което сумата покрива
        const tier = bountyTiers.find(t => amount >= t.min);
        const newRoleName = tier ? tier.name : null;

        // Взимаме всички текущи Bounty роли на човека (за да ги изчистим)
        const currentBountyRoles = member.roles.cache.filter(r => r.name.startsWith("Bounty: "));
        
        // Ако потребителят вече има правилната роля, не правим нищо
        if (newRoleName && member.roles.cache.some(r => r.name === newRoleName)) return newRoleName;

        // Махаме старите Bounty роли, за да не се дублират цветовете
        if (currentBountyRoles.size > 0) await member.roles.remove(currentBountyRoles);

        // Даваме новата роля според наградата
        if (newRoleName) {
            const roleToGive = member.guild.roles.cache.find(r => r.name === newRoleName);
            if (roleToGive) {
                await member.roles.add(roleToGive);
                return newRoleName;
            }
        }
    } catch (err) { console.error("Bounty Role Update Error:", err.message); }
    return null;
}

module.exports = { handleNewMember, handleRoleCommands, updateBountyRole };
