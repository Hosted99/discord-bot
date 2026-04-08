# 🏴‍☠️ Sailing Kingdom Engine | v2.7

**Sailing Kingdom Engine** is a high-performance, multi-functional Discord bot designed for elite pirate-themed gaming communities. It automates complex server management, real-time translations, battle strategies, and a unique bounty-based social system.

---

## 🚀 Core Features

### 🌐 1. AI Translator (#ai-translator)
*Powered by NLP to break language barriers.*
*   **Auto-Translate:** Any language typed is instantly converted to 🇺🇸 English.
*   **Reverse Translation:** Reply to a translated message in English to translate it back to the original author's native language.

### ⚔️ 2. Mania Strategy System
*Coordinated warfare management with automated audits.*
*   **Recording:** Use `mania-strategy <text>` to store battle plans (Reacts with 📥).
*   **Auto-Post:** Every day at **19:25 (London)**, the strategy is posted in `#mania-reminder` with an `@everyone` ping and a ✅ confirmation poll.
*   **Audit Mode:** At **20:00 (London)**, the bot automatically pings all members who haven't confirmed their status in the poll.

### 🚢 3. Smart Channel Management
*   **#repair-ship:** Strict syntax filter. Only accepts: `repair @mugi`, `repair @goat`, or `repair @ati`. All other messages are auto-purged.
*   **Media Enforcement:** In channels tagged with "photos", text-only messages without attachments are automatically removed to keep the feed clean.

### ☠️ 4. Bounty & Wanted System
*A dynamic RPG layer for server engagement.*
*   `!wanted [@user]` — Generates a custom Wanted Poster with the user's current bounty.
*   `!setbounty @user <amount>` — (Admin) Manually adjust a pirate's reward.
*   `!resetbounty @user` — (Admin) Clear a pirate's criminal record.
*   **Auto-Ranking:** Member roles/ranks scale automatically based on their total accumulated bounty.

### ⚔️ 5. Hero Guides (#unit-build)
*   `!hero <name>` — Detailed build guides including **Role, Seals, and Haki** with custom visual GIFs.
*   `!hero-list` — Full directory of all heroes currently in the database.

### ⏰ 6. Reminders & Event Engine
*   **Static Pings:** Hardcoded reminders for *Mania*, *Shandora*, and *Belly Rush*.
*   **Custom Reminders:** `!remind <cron> <text>` — Users can set their own persistent reminders (stored in Neon DB).
*   **Management:** `!reminders` (personal list) and `!allreminders` (global schedule).

---

## 🛠️ Technical Stack

*   **Runtime:** [Node.js](https://nodejs.org) (Discord.js) / [Python](https://python.org)
*   **Database:** [Neon DB](https://neon.tech) — Serverless PostgreSQL for persistent storage of bounties, reminders, and hero data.
*   **Task Scheduling:** [Node-Cron](https://npmjs.com) for time-sensitive pings (London Timezone).
*   **Security:** Integrated `#admin-logs` for message auditing and bulk-clear tools (`!clear`).

---

## ⚙️ Installation & Setup

1. **Clone the Repo:**
   ```bash
   git clone https://github.com
   cd sailing-kingdom-engine
    Install Dependencies:
    bash
   
    npm install

    Configure Environment Variables:
    Create a .env file in the root directory:
    env

    DISCORD_TOKEN=your_bot_token_here
    DATABASE_URL=your_neon_postgres_url
    OPENAI_API_KEY=your_api_key (for AI translation)
    GUILD_ID=your_server_id

    Launch the Ship:
    bash

    npm start

📊 Database Schema (Neon DB)
The engine utilizes a relational database to maintain the following:

    users: discord_id, bounty_amount, current_rank, last_active.
    reminders: user_id, cron_schedule, message, is_active.
    hero_meta: hero_name, role, seals_config, haki_build, gif_url.
