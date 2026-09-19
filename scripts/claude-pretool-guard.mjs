import { execFileSync } from 'node:child_process';

let input = {};
try {
  const raw = await new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
  input = raw ? JSON.parse(raw) : {};
} catch {}

const command = String(input?.tool_input?.command || '');
if (!command) process.exit(0);

function block(message) {
  console.error(`[claude-guardrail] BLOCKED: ${message}`);
  process.exit(2);
}

if (/git\s+push\b/i.test(command) && /--force(?:-with-lease)?\b/i.test(command) && /\bmain\b/i.test(command)) {
  block('force-pushing main is forbidden. Use a normal push or an explicit reviewed rollback commit.');
}

if (/git\s+commit\b/i.test(command)) {
  try {
    execFileSync(process.execPath, ['scripts/verify-agent-guardrails.mjs', '--staged'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    block('staged changes violate IA Conect agent guardrails. Fix the reported violations before committing.');
  }
}

if (/git\s+push\b/i.test(command)) {
  try {
    execFileSync(process.execPath, ['scripts/verify-agent-guardrails.mjs'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    block('the latest commit violates IA Conect agent guardrails. Fix it before pushing.');
  }
}

process.exit(0);
