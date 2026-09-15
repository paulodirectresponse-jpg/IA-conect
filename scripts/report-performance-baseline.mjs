import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const output = path.join(root, 'performance-baseline.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function kind(file) {
  if (/\.js$/i.test(file)) return 'js';
  if (/\.css$/i.test(file)) return 'css';
  if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file)) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(file)) return 'video';
  return 'other';
}

if (!fs.existsSync(dist)) {
  console.error('dist/ não existe. Execute npm run build antes de npm run perf:bundle.');
  process.exit(1);
}

const files = walk(dist).map((file) => {
  const buffer = fs.readFileSync(file);
  return {
    path: path.relative(dist, file).replaceAll(path.sep, '/'),
    kind: kind(file),
    bytes: buffer.byteLength,
    gzip_bytes: gzipSync(buffer).byteLength,
  };
});

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const js = files.filter((row) => row.kind === 'js');
const css = files.filter((row) => row.kind === 'css');
const payload = {
  generated_at: new Date().toISOString(),
  git_sha: process.env.GITHUB_SHA || null,
  summary: {
    files: files.length,
    js_chunks: js.length,
    css_chunks: css.length,
    js_bytes: sum(js, 'bytes'),
    js_gzip_bytes: sum(js, 'gzip_bytes'),
    css_bytes: sum(css, 'bytes'),
    css_gzip_bytes: sum(css, 'gzip_bytes'),
    total_bytes: sum(files, 'bytes'),
    total_gzip_bytes: sum(files, 'gzip_bytes'),
  },
  largest_files: [...files].sort((a,b) => b.bytes - a.bytes).slice(0, 20),
};

fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');

const kb = (value) => (value / 1024).toFixed(1);
console.log('Performance bundle baseline');
console.log(`JS: ${payload.summary.js_chunks} chunks | ${kb(payload.summary.js_bytes)} KiB raw | ${kb(payload.summary.js_gzip_bytes)} KiB gzip`);
console.log(`CSS: ${payload.summary.css_chunks} chunks | ${kb(payload.summary.css_bytes)} KiB raw | ${kb(payload.summary.css_gzip_bytes)} KiB gzip`);
console.log(`Dist total: ${kb(payload.summary.total_bytes)} KiB raw | ${kb(payload.summary.total_gzip_bytes)} KiB gzip`);
console.log('Largest files:');
for (const row of payload.largest_files.slice(0, 10)) {
  console.log(`- ${row.path}: ${kb(row.bytes)} KiB raw / ${kb(row.gzip_bytes)} KiB gzip`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const markdown = [
    '## Performance bundle baseline',
    '',
    '| Métrica | Valor |',
    '| --- | ---: |',
    `| JS chunks | ${payload.summary.js_chunks} |`,
    `| JS raw | ${kb(payload.summary.js_bytes)} KiB |`,
    `| JS gzip | ${kb(payload.summary.js_gzip_bytes)} KiB |`,
    `| CSS chunks | ${payload.summary.css_chunks} |`,
    `| CSS raw | ${kb(payload.summary.css_bytes)} KiB |`,
    `| CSS gzip | ${kb(payload.summary.css_gzip_bytes)} KiB |`,
    `| dist total raw | ${kb(payload.summary.total_bytes)} KiB |`,
    '',
    '### Maiores arquivos',
    ...payload.largest_files.slice(0, 10).map((row) => `- \`${row.path}\`: ${kb(row.bytes)} KiB raw / ${kb(row.gzip_bytes)} KiB gzip`),
    '',
  ].join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
