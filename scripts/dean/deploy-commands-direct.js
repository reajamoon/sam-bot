import 'dotenv/config';
import https from 'https';

const token = process.env.DEAN_BOT_TOKEN;
const clientId = process.env.DEAN_CLIENT_ID;
const guildId = process.env.DEAN_GUILD_ID;

if (!token || !clientId) {
  console.error('[dean] Missing token or clientId. Set DEAN_BOT_TOKEN and DEAN_CLIENT_ID.');
  process.exit(1);
}

// Load Dean command JSON from built command modules if available
// Fallback: empty array to clear or no-op
let commands = [];
try {
  const { default: deanCommands } = await import('../../src/bots/dean/registerCommands.js');
  if (Array.isArray(deanCommands)) commands = deanCommands;
import 'dotenv/config';
import https from 'https';
import { readdirSync } from 'fs';
import { join } from 'path';

const token = process.env.DEAN_BOT_TOKEN;
const clientId = process.env.DEAN_CLIENT_ID;
const guildId = process.env.DEAN_GUILD_ID;

if (!token || !clientId) {
  console.error('[dean] Missing token or clientId. Set DEAN_BOT_TOKEN and DEAN_CLIENT_ID.');
  process.exit(1);
}

// Build command JSON by scanning Dean's commands folder
async function buildCommands() {
  const commands = [];
  const commandsPath = join(process.cwd(), 'src', 'bots', 'dean', 'commands');
  let files = [];
  try {
    files = readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  } catch (e) {
    console.warn('[dean] Could not read commands folder:', e?.message || e);
  }
  for (const file of files) {
    try {
      const mod = await import(join(commandsPath, file).replace(/\\/g, '/'));
      const command = mod.default || mod;
      if (command?.data?.toJSON) {
        commands.push(command.data.toJSON());
      }
    } catch (e) {
      console.warn(`[dean] Failed to import command ${file}:`, e?.message || e);
    }
  }
  return commands;
}

const commands = await buildCommands();
const body = JSON.stringify(commands);
const path = guildId
  ? `/api/v10/applications/${clientId}/guilds/${guildId}/commands`
  : `/api/v10/applications/${clientId}/commands`;

const req = https.request(
  {
    hostname: 'discord.com',
    method: 'PUT',
    path,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  res => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[dean] Registered ${commands.length} commands${guildId ? ' (guild)' : ''}.`);
        process.exit(0);
      } else {
        console.error(`[dean] Failed to register commands: ${res.statusCode}`);
        console.error(data);
        process.exit(1);
      }
    });
  }
);

req.on('error', err => {
  console.error('[dean] HTTPS error registering commands:', err);
  process.exit(1);
});

req.write(body);
req.end();
