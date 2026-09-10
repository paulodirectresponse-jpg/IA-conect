import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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

function verify(asset, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== asset.size || sha256 !== asset.sha256) {
    throw new Error(`Brand asset integrity check failed for ${asset.output}: size=${bytes.length}, sha256=${sha256}`);
  }
  return sha256;
}

for (const asset of assets) {
  const outputPath = join(outDir, asset.output);

  try {
    await access(outputPath);
    const bytes = await readFile(outputPath);
    const sha256 = verify(asset, bytes);
    console.log(`Verified ${asset.output} (${bytes.length} bytes, sha256=${sha256})`);
    continue;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const sourceDir = join('brand-source', asset.source);
  let chunks;
  try {
    chunks = (await readdir(sourceDir)).filter((name) => name.endsWith('.b64')).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing ${outputPath}. Add the original PNG at this exact path.`);
    }
    throw error;
  }

  if (chunks.length === 0) throw new Error(`No transport chunks found for ${asset.output}`);

  const base64 = (await Promise.all(chunks.map((name) => readFile(join(sourceDir, name), 'utf8')))).join('');
  const bytes = Buffer.from(base64, 'base64');
  const sha256 = verify(asset, bytes);
  await writeFile(outputPath, bytes);
  console.log(`Materialized ${asset.output} (${bytes.length} bytes, sha256=${sha256})`);
}
