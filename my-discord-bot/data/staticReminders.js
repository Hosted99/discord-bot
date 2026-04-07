// Функция за случаен избор на съобщение
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

// PREPARATION MESSAGES (11:00)
const warHype = [
  "⚔️ 'We're going to be the Pirate Kings!' - Prep has started! Let's sharpen our blades like Zoro! 🗡️",
  "🍖 Our feast is over! The crew is ready, are you? Set our course for the Guild War! 🏴‍☠️",
  "🛡️ 'Our dreams... HAVE NO END!' - Get your gear ready, guild preparation is LIVE! 🌊",
  "⚓ Raise the sails! We need everyone ready before the storm hits. Preparation starts now! 🧭",
  "🔥 Focus up, Nakama! We're not just a team, we're a legend in the making. Get ready! 🛡️"
];

// BATTLE MESSAGES (12, 15, 18:00)
const warBattle = [
  "🔥 OUR GUM-GUM BATTLE IS ON! Guild War is LIVE! Let's go beyond our limits, GEAR SECOND! ⚡",
  "🏹 'The One Piece is real!' - Show them our power! Don't let them touch our treasure! 💎",
  "💥 'Scars on our backs are a swordsman's shame!' - To the front lines, we never run away! 🤜",
  "🌩️ We're bringing the 'D' energy to the battlefield! Charge together and crush them! ⚡",
  "🏴‍☠️ The Grand Line belongs to US! Join the fight and show them the strength of our crew! 🔱"
];

// END MESSAGES (21:00)
const warEnd = [
  "🍻 'Inherited Will, The Destiny of the Age!' - Our war has ended, let's party like pirates! 🍖",
  "🏆 We're not just crewmates, we're FAMILY! Great job today, legends. Rest up for the next voyage! ⚓",
  "🌊 The dust has settled on the battlefield. We stood our ground! Time to head to the tavern! 🍻",
  "⭐ Another victory (or a great fight) for our flag! Proud of every single one of you, Nakama! 🚩",
  "💤 Even the strongest pirates need sleep. The war is over. Rest well, the sea calls tomorrow! 🌙"
];

// END MESSAGES (23:00)
const ghostLastCall = [
  "⏰ ONLY 1 HOUR LEFT! Stop procrastinating, Nakama! Get the Ghost Trial done! 👻",
  "🏃‍♂️ MOVE IT! Only 60 minutes left for the Ghost Trial! Don't let rewards vanish! 🌊",
  "🏴‍☠️ 'A pirate never misses his mark!' - Finish the Ghost Trial NOW! ⚔️",
  "💀 YOHOHOHO! Time is running out for your shadows! 1 hour left! 🕯️"
];

// START MESSAGES (10:00)
const ghostStart = [
  "💀 YOHOHOHO! A new day begins and the Ghost Trial is waiting for us! Don't let them take your shadows! 👻",
  "🧟‍♂️ Thriller Bark vibes! Ghost Trial is open for the day. Let's show these spirits our crew's power! ⚔️",
  "🌑 Wake up, Nakama! The spirits are restless. Ghost Trial is available, go clear it! 🕯️",
  "🎻 The Binks' Sake is playing... the ghosts are calling! Time to hit the Ghost Trial! 💀",
  "👻 Don't wait until the last minute! The Ghost Trial is open. Get those rewards now! 🔥"
];

 

module.exports = [
  { cron: "0 12 * * 2,4", message: "Shandora is open!", target: "everyone" },
  { cron: "0 12 * * 3,5,0", message: "Mania today!", target: "@everyone" },
  { cron: "45 19 * * 3,5,0", message: "15 min until Mania starts!", target: "@everyone" },
  { cron: "0 20 * * 3,5,0", message: "Mania is open!", target: "@everyone" },


  //SHANDORA !!!
  // 1. Повтаря съобщението за отворено състояние през 3 часа (до 21:00 включително)
  { cron: "0 12,15,18,21 * * 2,4", message: "Shandora is open! Watch out or Enel is going to FRY you ⚡!! ", target: "everyone"},
  // 2. ПРЕДУПРЕЖДЕНИЕ: Изпраща се в 23:50 (10 минути преди края) във вторник и четвъртък
  { cron: "50 23 * * 2,4", message: "Shandora is closing soon! 10 minutes left.", target: "everyone"},
  // 2. Изпраща финално съобщение за затваряне точно в 00:00 (сряда и петък сутрин)
  { cron: "0 0 * * 3,5", message: "Shandora is now CLOSED!", target: "everyone" },

  //BELLY RUSH !!!
  // Ще изпраща съобщението в 12:00, 16:00 и 20:00 във вторник (2) и петък (5) и  в 10:00, сряда и събота това е съобщението където вече плаваме!
  { cron: "0 12,16,20 * * 2,5", message: "Belly Rush ports open today go kidnap NAKAMA to sail together!!", target: "everyone"},
  { cron: "0 10 * * 3,6", message: "Belly Rush. The time we sail is today (at some point) :D", target: "everyone" },

  // --- GUILD WARS (With Random Messages) !!!
  { cron: "0 11 * * 1,3,5", message: () => random(warHype), target: "everyone" },
  { cron: "0 12,15,18 * * 1,3,5",message: () => random(warBattle), target: "everyone" },
  { cron: "0 21 * * 1,3,5", message: () => random(warEnd), target: "everyone" },

  //Ghost Trial !!!
  // GHOST TRIAL (Last hour reminder - Sunday 23:00)
  { cron: "0 23 * * 0", message: () => random(ghostLastCall), target: "everyone" },
  // GHOST TRIAL (START reiminder - everyday at 10:00)
  { cron: "0 10 * * *", message: () => random(ghostStart),target: "everyone" },
  // SPECIAL FOR HOSTED 
  { cron: "0 10 * * *", message: "The event has started! Get your ass in the Ghost Trial! 💀", target: "@Hosted" },
  { cron: "0 20 * * 3,5,0", message: () => random(ghostStart),target: "everyone" },
 
  // --- SUNDAY SPECIAL (Guild Battle) ---
  { cron: "0 10 * * 0", message: "⚔️ Sunday Prep is LIVE! Start supporting the crew NOW! Don't wait for the battle to sharpen your blades. MOVE! 🛡️", target: "everyone" },
  { cron: "0 12 * * 0", message: "🧭 Only 1 hour until the battle starts! Did you support the crew yet? Don't make me come find you... I'm already lost anyway! 🗡️", target: "everyone" },
  { cron: "0 13 * * 0", message: "🔥 THE BATTLE IS ON! The preparation is over, now it's time for blood! Santoryu: OGI... SANZEN SEKAI! 🌪️🗡️", target: "everyone" },

  

];
