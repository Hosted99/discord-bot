const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,PermissionsBitField} = require("discord.js");

const ALLOWED_GUILDS = [
  "1486343040162468003",
  "1451310326019526800"
];

// 🔐 ROLE IDs (ЗАМЕНИ ТЕЗИ С ТВОИТЕ)
const ROLES = {
  ROOKIES: "1498708853896908891",
  PLAYER: "1498707138250277005"
};

// 👋 per-guild welcome tracking
const lastWelcomeMessage = new Map();

// bounty tiers
const bountyTiers = [];
for (let i = 900; i >= 50; i -= 50) {
  bountyTiers.push({ min: i * 1000000, name: `Bounty: ${i}M+` });
}

/**
 * 1. ПОСРЕЩАНЕ И ВЕРИФИКАЦИЯ (НОВИЯТ КОД)
 */
async function handleNewMember(member) {
  if (!ALLOWED_GUILDS.includes(member.guild.id)) return;

  try {
    const rookieRole = member.guild.roles.cache.get(ROLES.ROOKIES);
    const welcomeChannel = member.guild.channels.cache.find(
      ch => ch.name === "│👋│welcome"
    );

    if (rookieRole) await member.roles.add(rookieRole);

    if (!welcomeChannel) return;

    const oldMsg = lastWelcomeMessage.get(member.guild.id);
    if (oldMsg) await oldMsg.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("⚓ New Pirate Aboard!")
      .setDescription(
        `Ahoy, pirate ${member}! 🏴‍☠️\n\n` +
        `Welcome to the **Pirate Queen’s Family**, ruled by <@825016547138732082>.\n\n` +
        `📜 **The Pirate Code:** Check <#1497466531322527877> or risk walking the plank!\n` +
        `💰 **Bounties:** Drop your in-game profile pic in <#1490838764057268392> to claim your reward! ⚔️\n\n` +
        `🍻 **The Tavern:** Say hi at <#1486343047632523398>. but first put a NickName \n` +
        `📝 **Nickanme:** To unlock the server, press the button below and enter your nickname.\n` +
        `*Note: Your name should include the guild name or tag (e.g., TS Hsoted, Thousand Sunny HOsted).*`
    )
      .setColor("#2ECC71")
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_verify")
        .setLabel("Nickname")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await welcomeChannel.send({
      content: `${member}`,
      embeds: [embed],
      components: [row]
    });

    lastWelcomeMessage.set(member.guild.id, msg);
  } catch (err) {
    console.error("Welcome error:", err);
  }
}

/**
 * 2. ОБРАБОТКА НА БУТОНА И МОДАЛА (НОВИЯТ КОД)
 */
async function handleInteraction(interaction) {
  if (!interaction.guild) return;
  if (!ALLOWED_GUILDS.includes(interaction.guild.id)) return;

  const { guild, member } = interaction;

  // BUTTON
  if (interaction.isButton() && interaction.customId === "start_verify") {
    const modal = new ModalBuilder()
      .setCustomId("nick_modal")
      .setTitle("Nickanmeя");

    const input = new TextInputBuilder()
    .setCustomId("new_nickname")
    // This is the instruction above the input box
    .setLabel("Put your guild name or initials before your name:")
    .setStyle(TextInputStyle.Short)
    // This is the clue inside the box
    .setPlaceholder("Example: TS Luffy or Thousand Sunny Luffy") 
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }

  // MODAL
  if (interaction.isModalSubmit() && interaction.customId === "nick_modal") {
    const newNick = interaction.fields.getTextInputValue("new_nickname");

    try {
      const playerRole = guild.roles.cache.get(ROLES.PLAYER);
      const rookieRole = guild.roles.cache.get(ROLES.ROOKIES);

      // already verified
      if (playerRole && member.roles.cache.has(playerRole.id)) {
        return interaction.reply({
          content: "⚠️ you have a nickanme already!",
          ephemeral: true
        });
      }

      await member.setNickname(newNick);

      if (rookieRole) await member.roles.remove(rookieRole);
      if (playerRole) await member.roles.add(playerRole);

      return interaction.reply({
        content: `✅ Welcome, **${newNick}**!`,
        ephemeral: true
      });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "❌ nickanme error  .",
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

module.exports = { handleNewMember, handleRoleCommands, updateBountyRole, handleInteraction };

