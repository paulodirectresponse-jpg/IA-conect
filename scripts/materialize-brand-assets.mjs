import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const assets = [
  {
    source: 'logo',
    output: 'ia-connect-logo-oficial.png',
    size: 160484,
    sha256: '995fb779b42f6abafb46602382e577fb5eeb5d65aac0322ee54147e7c04dde72',
  },
  {
    source: 'icon',
    output: 'ia-connect-app-icon.png',
    size: 1357605,
    sha256: '814829e1eaa3f7acbbc0048ffa0e74becf84ed9f49139ddfd25f26017ba9524a',
  },
];

const outDir = 'public/brand';
await mkdir(outDir, { recursive: true });

for (const asset of assets) {
  const sourceDir = join('brand-source', asset.source);
  const chunks = (await readdir(sourceDir))
    .filter((name) => name.endsWith('.b64'))
    .sort();

  if (chunks.length === 0) {
    throw new Error(`No transport chunks found for ${asset.output}`);
  }

  const base64 = (await Promise.all(
    chunks.map((name) => readFile(join(sourceDir, name), 'utf8')),
  )).join('');

  const bytes = Buffer.from(base64, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  if (bytes.length !== asset.size || sha256 !== asset.sha256) {
    throw new Error(
      `Brand asset integrity check failed for ${asset.output}: size=${bytes.length}, sha256=${sha256}`,
    );
  }

  await writeFile(join(outDir, asset.output), bytes);
  console.log(`Materialized ${asset.output} (${bytes.length} bytes, sha256=${sha256})`);
}
