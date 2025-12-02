// Scan command modules and report missing SlashCommandBuilder `data`
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const commandsPath = join(__dirname, '..', 'src', 'bots', 'sam', 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

const results = [];

for (const file of commandFiles) {
  try {
    const mod = await import(join(commandsPath, file));
    const dataExport = mod.data || (mod.default && mod.default.data);
    const hasToJSON = !!(dataExport && typeof dataExport.toJSON === 'function');
    results.push({ file, ok: hasToJSON, style: mod.data ? 'named' : (mod.default ? 'default' : 'unknown') });
  } catch (e) {
    results.push({ file, ok: false, error: e.message });
  }
}

console.table(results);

const bad = results.filter(r => !r.ok);
if (bad.length) {
  console.log('\nOffending files:');
  bad.forEach(b => console.log(`- ${b.file}${b.error ? ` (error: ${b.error})` : ''}`));
  process.exit(1);
} else {
  console.log('\nAll command files have a valid SlashCommandBuilder `data`.');
}
