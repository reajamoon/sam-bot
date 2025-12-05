import Discord from 'discord.js';
const { REST, Routes } = Discord;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve as pathResolve } from 'path';
import { readdirSync } from 'fs';
// Ensure we load .env from the repo root, regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = pathResolve(__dirname, '../../..');
const envPath = join(repoRoot, '.env');
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.warn('[sam] dotenv failed to load .env:', envResult.error.message);
} else {
  console.log(`[sam] dotenv loaded .env from ${envPath}`);
}

const commands = [];
const commandsPath = join(__dirname, '../../src', 'bots', 'sam', 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const commandModule = await import(join(commandsPath, file));
  const dataExport = commandModule.data || (commandModule.default && commandModule.default.data);
  if (!dataExport || typeof dataExport.toJSON !== 'function') {
    console.warn(`Skipping command file ${file}: no SlashCommandBuilder 'data' export found.`);
    continue;
  }
  commands.push(dataExport.toJSON());
}

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN is missing or empty. Define it in .env.');
  process.exit(1);
}
console.log(`[sam] BOT_TOKEN present (length: ${token.length}).`);
const rest = new REST({ version: '10' }).setToken(token, 'Bot');

(async () => {
  try {
    const guildId = (process.env.GUILD_ID || '').trim();
    const clientId = (process.env.CLIENT_ID || '').trim();
    if (!guildId || !clientId) {
      console.error('❌ GUILD_ID or CLIENT_ID is missing. Set both in environment/PM2 ecosystem.');
      process.exit(1);
    }
    console.log(`Started refreshing ${commands.length} application (/) commands for guild: ${guildId}`);

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
