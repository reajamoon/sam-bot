#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();

function isJs(file) {
  return file.endsWith('.js') || file.endsWith('.mjs');
}

async function walk(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, acc);
    } else if (isJs(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function rel(from, to) {
  return path.relative(from, to).replace(/\\/g, '/');
}

async function main() {
  const srcDir = path.join(ROOT, 'src');
  const targets = [
    path.join(srcDir, 'shared', 'emojiStore.js'),
    path.join(srcDir, 'shared', 'utils', 'logger.js'),
    path.join(srcDir, 'shared', 'utils', 'buttonId.js'),
    path.join(srcDir, 'shared', 'utils', 'permissionLevel.js'),
    path.join(srcDir, 'shared', 'utils', 'modLockUtils.js'),
    path.join(srcDir, 'shared', 'utils', 'globalModlockUtils.js'),
    path.join(srcDir, 'shared', 'utils', 'dateIso.js'),
    path.join(srcDir, 'shared', 'utils', 'interactionNavigation.js'),
    path.join(srcDir, 'shared', 'utils', 'messageTracking.js'),
    path.join(srcDir, 'shared', 'utils', 'timezoneValidator.js'),
    path.join(srcDir, 'shared', 'utils', 'validateAttachment.js'),
    path.join(srcDir, 'shared', 'utils', 'regionValidator.js'),
    path.join(srcDir, 'shared', 'utils', 'dualUpdate.js'),
  ];
  const files = await walk(srcDir);
  const problems = [];

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect imports referencing targeted shared modules via relative paths
      const m = line.match(/import\s+[^;]*from\s+['\"](\.{1,2}\/[^'\"]*)['\"]/);
      if (m) {
        const importPath = m[1];
        const fileDir = path.dirname(file);
        const resolved = path.normalize(path.join(fileDir, importPath));
        for (const target of targets) {
          if (path.basename(resolved) === path.basename(target)) {
            const expectedRel = rel(fileDir, target);
            const expectedImport = expectedRel.startsWith('.') ? expectedRel : './' + expectedRel;
            if (path.normalize(resolved) !== path.normalize(target)) {
              problems.push({ file, line: i + 1, importPath, expectedImport });
            }
          }
        }
        // Case-sensitivity guard: warn when importing a modlock util with wrong casing
        const baseLower = path.basename(resolved).toLowerCase();
        if (baseLower.includes('modlockutils')) {
          // enforce exact module names to reduce confusion across OS
          const expectedNames = ['modlockUtils.js', 'modLockUtils.js'];
          if (!expectedNames.includes(path.basename(resolved))) {
            problems.push({ file, line: i + 1, importPath, expectedImport: '<use exact casing: shared/modlockUtils.js or shared/utils/modLockUtils.js>' });
          }
        }
      }
      // Special case: models should import from the consolidated index: '../../models/index.js' or equivalent
      const mModels = line.match(/from\s+['\"](\.{1,2}\/[^'\"]*models\/[A-Za-z0-9_\-]+\.js)['\"]/);
      if (mModels) {
        const importPath = mModels[1];
        // Recommend using models/index.js instead of direct file imports to avoid duplication
        problems.push({ file, line: i + 1, importPath, expectedImport: '<use models/index.js>' });
      }
    }
  }

  if (problems.length) {
    console.error('[lint:relative-imports] Found incorrect relative import paths:');
    for (const p of problems) {
      console.error(`- ${p.file}:${p.line} uses '${p.importPath}' -> expected '${p.expectedImport}'`);
    }
    process.exit(1);
  } else {
    console.log('[lint:relative-imports] emojiStore imports look good.');
  }
}

main().catch(err => {
  console.error('[lint:relative-imports] Error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
