import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(scriptDir, '..');
const monorepoSpecsDir = join(siteRoot, '../../specs');
const vendoredSpecsDir = join(siteRoot, 'src/specs');
const files = ['types.ts', 'contract.json'];

mkdirSync(vendoredSpecsDir, { recursive: true });

let synced = 0;
for (const fileName of files) {
  const sourcePath = join(monorepoSpecsDir, fileName);
  if (!existsSync(sourcePath)) continue;
  copyFileSync(sourcePath, join(vendoredSpecsDir, fileName));
  synced += 1;
}

if (synced > 0) {
  console.log(`Synced ${synced} file(s) from /specs into src/specs`);
} else {
  console.log('Parent /specs not available; using vendored src/specs');
}
