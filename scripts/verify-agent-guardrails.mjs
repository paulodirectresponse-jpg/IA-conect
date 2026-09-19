import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const mode = process.argv.includes('--staged') ? 'staged' : 'repo';

function runGit(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || error?.message || String(error);
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
}

function fail(message) {
  console.error(`[agent-guardrail] ${message}`);
  process.exitCode = 1;
}

const forbiddenPathPatterns = [
  /^\.wrangler\/state\//,
  /^\.env($|\.)/,
  /(^|\/)\.env($|\.)/,
  /\.sqlite(?:-shm|-wal)?$/i,
  /(^|\/)secrets?\.(?:json|txt|env)$/i,
  /(^|\/)credentials?\.(?:json|txt|env)$/i,
  /\.log$/i,
];

const candidateFiles = mode === 'staged'
  ? runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean)
  : runGit(['diff', 'HEAD^', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);

for (const file of candidateFiles) {
  if (forbiddenPathPatterns.some(pattern => pattern.test(file))) {
    fail(`forbidden generated/secret-like file in ${mode} changes: ${file}`);
  }
}

const claudePath = path.join(root, 'CLAUDE.md');
if (!fs.existsSync(claudePath)) fail('CLAUDE.md is missing.');

const gitignorePath = path.join(root, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fail('.gitignore is missing.');
} else {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignore.split(/\r?\n/).some(line => line.trim() === '.wrangler/')) {
    fail('.gitignore must ignore .wrangler/.');
  }
}

const routingDir = path.join(root, 'server', 'routing-v2');
if (fs.existsSync(routingDir)) {
  const queue = [routingDir];
  while (queue.length) {
    const dir = queue.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (!entry.isFile() || !/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) continue;
      if (/\.test\./.test(entry.name)) continue;

      const rel = path.relative(root, full).replaceAll('\\', '/');
      const source = fs.readFileSync(full, 'utf8');

      if (rel !== 'server/routing-v2/pricingFixtureService.ts' && source.includes('pricingFixtureService')) {
        fail(`production Routing V2 code may not import/use pricing fixtures: ${rel}`);
      }
      if (source.includes('FIXTURE_VALIDATED')) {
        fail(`forbidden pricing provenance marker FIXTURE_VALIDATED in production code: ${rel}`);
      }
    }
  }
}

const wrapperPath = path.join(root, 'server', 'routing-v2', 'legacyWrapperAdapter.ts');
if (fs.existsSync(wrapperPath)) {
  const wrapper = fs.readFileSync(wrapperPath, 'utf8');
  if (/status:\s*['"]HEALTHY['"]/.test(wrapper)) {
    fail('legacy execution wrapper must never fabricate HEALTHY.');
  }
  if (/async\s+getPrice\s*\(/.test(wrapper)) {
    fail('legacy execution wrapper must not expose pricing; verified pricing belongs to real V2 pricing adapters/services.');
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[agent-guardrail] OK (${mode})`);
