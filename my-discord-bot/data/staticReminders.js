module.exports = [
  { cron: "0 14 * * 2,4", message: "Shandora is open!", target: "Marika" },
  { cron: "0 12 * * 2,5", message: "Belly Rush today!", target: "Mugi" },
  { cron: "0 12 * * 3,5,0", message: "Mania today!", target: "@everyone" },
  { cron: "45 21 * * 3,5,0", message: "15 min until Mania starts!", target: "@everyone" },
  { cron: "0 22 * * 3,5,0", message: "Mania is open!", target: "@everyone" }
];
