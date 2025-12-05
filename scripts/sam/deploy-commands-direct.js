import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve as pathResolve } from 'path';
import fs from 'fs';
import https from 'https';

// Resolve repo root and load .env explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = pathResolve(__dirname, '../..');
const envPath = join(repoRoot, '.env');
dotenv.config({ path: envPath });

// Prefer SAM_* envs, fallback to legacy
const BOT_TOKEN = (process.env.SAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const CLIENT_ID_RAW = (process.env.SAM_CLIENT_ID || process.env.CLIENT_ID || '').trim();
const CLIENT_ID = encodeURIComponent(CLIENT_ID_RAW);

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error('[sam:direct] Missing env(s). Require BOT_TOKEN and CLIENT_ID.');
  process.exit(1);
}

// Collect Sam command JSON from src/bots/sam/commands
const commandsDir = join(repoRoot, 'src', 'bots', 'sam', 'commands');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
const commands = [];
for (const file of files) {
  const mod = await import(join(commandsDir, file).replace(/\\/g, '/'));
  const cmd = mod.default || mod;
  if (!cmd?.data?.toJSON) continue;
  commands.push(cmd.data.toJSON());
}

const payload = JSON.stringify(commands);
const options = {
  method: 'PUT',
  hostname: 'discord.com',
  path: `/api/v10/applications/${CLIENT_ID}/commands`,
  headers: {
    'Authorization': `Bot ${BOT_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'pb-bots/2.0 (Sam deploy direct)'
  }
};

console.log(`[sam:direct] Deploying ${commands.length} global commands via direct HTTPS...`);
const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const parsed = JSON.parse(body);
        console.log(`[sam:direct] ✅ Success (${res.statusCode}). Commands deployed: ${Array.isArray(parsed) ? parsed.length : 'n/a'}`);
        process.exit(0);
      } catch {
        console.log(`[sam:direct] ✅ Success (${res.statusCode}).`);
        process.exit(0);
      }
    } else {
      console.error(`[sam:direct] ❌ Failed (${res.statusCode}). Response: ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', err => {
  console.error('[sam:direct] Request error:', err);
  process.exit(1);
});

req.write(payload);
req.end();
