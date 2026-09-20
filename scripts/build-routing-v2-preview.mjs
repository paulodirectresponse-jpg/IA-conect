import {spawnSync} from 'node:child_process';

const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error('npm_execpath indisponível. Execute via npm run build:routing-v2-preview.');
const result=spawnSync(process.execPath,[npmCli,'run','build'],{
  stdio:'inherit',
  env:{...process.env,CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH:'wrangler.routing-v2-preview.jsonc'},
});
process.exit(result.status??1);
