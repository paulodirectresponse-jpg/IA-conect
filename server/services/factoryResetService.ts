import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

type Row={path:string;collection:string;data:Record<string,any>};
const LEGACY_INVENTORY=['providers','models','provider_models','provider_pricing','provider_scan_latest','retail_pricing','retail_pricing_versions','retail_pricing_active','pricing_health_snapshots','routing_logs','beta_catalog_policies'];
const GENERATION_DATA=['generations','generation_attempts','generation_client_requests','generation_economics','beta_jobs','beta_job_attempts','beta_job_idempotency','beta_job_mutations','beta_economic_ledger'];
const SYNTHETIC_FINANCE=['credit_accounts','credit_lots','credit_transactions','credit_idempotency','credit_reservations'];
const PRESERVED=['Firebase Auth de usuários reais','users/perfis reais e ADMIN','secrets e integrações','Cloudflare/Supabase/Firebase config','payments','credit_* de usuários reais','arquivos físicos no Supabase Storage'];
const CONFIRM='RESET_GREENFIELD_PRESERVE_REAL_USERS_SECRETS_PAYMENTS_BALANCES_AND_ASSET_FILES';
const RESET_ID='greenfield-final-system-convergence-v1';
const syntheticEmail=/^routing-v2-(?:runtime|probe|final|validation)(?:[-+._][a-z0-9]+)*@(?:example\.com|ia-conect\.invalid)$/i;
const syntheticName=/^routing v2 (?:runtime )?validation/i;
const ns=()=>{const value=String(process.env.ROUTING_V2_NAMESPACE||'').trim().toLowerCase();if(value&&!/^[a-z0-9_-]{1,32}$/.test(value))throw new Error('ROUTING_V2_NAMESPACE inválido.');return value?`${value}_`:'';};
const isPreview=()=>String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()==='true';
const v2Collections=()=>[`${ns()}routing_v2_providers`,`${ns()}routing_v2_models`,`${ns()}routing_v2_routes`,`${ns()}routing_v2_pricing_settings`];
const relativePath=(name:string)=>{const marker='/documents/';const i=name.indexOf(marker);if(i<0)throw new Error('Nome de documento Firestore inválido.');return name.slice(i+marker.length).split('/').map(decodeURIComponent).join('/');};
const list=async(collection:string)=>{const found:any[]=[];for(let offset=0;;offset+=500){const page=await firestoreAdminRest.runQuery({from:[{collectionId:collection}],offset,limit:500});found.push(...page);if(page.length<500)break;}return found.map((r:any)=>({path:relativePath(String(r.name)),collection,data:r.data||{}} as Row));};
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const uidOf=(row:Row)=>String(row.data.user_id||row.data.owner_user_id||row.data.uid||'');
const syntheticProfile=(row:Row)=>syntheticEmail.test(String(row.data.email||''))||syntheticName.test(String(row.data.display_name||row.data.name||''));
const syntheticAuth=(row:any)=>syntheticEmail.test(String(row.email||''))||syntheticName.test(String(row.displayName||''));

function assertEnvironment(approvalToken?:string){
  if(isPreview())return;
  if(String(process.env.FACTORY_RESET_PRODUCTION_ENABLED||'').toLowerCase()!=='true')throw Object.assign(new Error('Reset de produção não está habilitado.'),{code:'FACTORY_RESET_PRODUCTION_DISABLED'});
  const expected=String(process.env.FACTORY_RESET_APPROVAL_SHA256||'').trim().toLowerCase(),actual=hash(String(approvalToken||''));
  if(!expected||expected.length!==64||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))throw Object.assign(new Error('Token one-shot de aprovação inválido.'),{code:'FACTORY_RESET_APPROVAL_REQUIRED'});
}

async function plan(){
  const [users,authUsers]=await Promise.all([list('users'),firestoreAdminRest.listAuthUsers()]);
  const syntheticUsers=users.filter(syntheticProfile);
  const syntheticAuthUsers=authUsers.filter(syntheticAuth).map((row:any)=>({uid:String(row.localId||''),email:String(row.email||''),display_name:String(row.displayName||'')}));
  const syntheticIds=new Set([...syntheticUsers.map(uidOf),...syntheticAuthUsers.map(row=>row.uid)].filter(Boolean));
  const runtimeCollection=`${ns()}routing_v2_runtime_state`,wholesale=[...LEGACY_INVENTORY,...v2Collections(),...GENERATION_DATA,'assets'];
  const all=await Promise.all([...wholesale,runtimeCollection,...SYNTHETIC_FINANCE].map(async collection=>[collection,await list(collection)] as const));
  const rows:Row[]=[],counts:Record<string,number>={};
  for(const[collection,found]of all){const selected=collection===runtimeCollection?found.filter(row=>!row.path.endsWith('/cutover')):wholesale.includes(collection)?found:found.filter(row=>syntheticIds.has(uidOf(row)));counts[collection]=selected.length;rows.push(...selected);}
  for(const row of syntheticUsers){counts.users=(counts.users||0)+1;rows.push(row);}
  rows.sort((a,b)=>a.path.localeCompare(b.path));
  const proof={documents:rows.map(row=>[row.path,row.data]),synthetic_auth:syntheticAuthUsers.map(row=>[row.uid,row.email,row.display_name]).sort()};
  return{created_at:new Date().toISOString(),namespace:ns().slice(0,-1)||'production-default',preserve:PRESERVED,reset:[...wholesale,'assets (somente metadados; arquivos físicos preservados)',...SYNTHETIC_FINANCE.map(x=>`${x} (somente contas sintéticas)`),'users/Auth (somente routing-v2-* sintéticos)'],counts:{...counts,firebase_auth_synthetic:syntheticAuthUsers.length},synthetic_users:syntheticUsers.map(row=>({uid:uidOf(row),email:String(row.data.email||'')})),synthetic_auth_users:syntheticAuthUsers,rows,fingerprint:hash(JSON.stringify(proof))};
}

async function writeSnapshot(p:Awaited<ReturnType<typeof plan>>,adminId:string){
  const snapshotId=`frs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,createdAt=new Date().toISOString();
  await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{snapshot_id:snapshotId,reset_id:RESET_ID,status:'READY',created_at:createdAt,created_by:adminId,fingerprint:p.fingerprint,item_count:p.rows.length,counts:p.counts,namespace:p.namespace,synthetic_auth_users:p.synthetic_auth_users});
  for(let i=0;i<p.rows.length;i+=100){const chunk=p.rows.slice(i,i+100);await firestoreAdminRest.commit(chunk.map(row=>({update:{name:firestoreAdminRest.docName(`factory_reset_snapshot_items/${hash(`${snapshotId}:${row.path}`)}`),fields:firestoreAdminRest.fields({snapshot_id:snapshotId,path:row.path,collection:row.collection,data:row.data,created_at:createdAt})},currentDocument:{exists:false}})));}
  return{snapshot_id:snapshotId,item_count:p.rows.length,fingerprint:p.fingerprint,counts:p.counts,created_at:createdAt,non_restorable:{firebase_auth_synthetic:p.synthetic_auth_users.length}};
}

export const factoryResetService={
 async inventory(){const p=await plan();const{rows,...publicPlan}=p;return{...publicPlan,total_reset_documents:rows.length,confirmation_phrase:CONFIRM,environment:isPreview()?'preview':'production'};},
 async snapshot(adminId:string,input:{approval_token?:string}={}){assertEnvironment(input.approval_token);const marker=await firestoreAdminRest.get(`factory_reset_control/${RESET_ID}`);if(marker.exists&&marker.data?.status==='EXECUTED')throw Object.assign(new Error('Este reset one-shot já foi executado.'),{code:'FACTORY_RESET_ALREADY_EXECUTED'});return writeSnapshot(await plan(),adminId);},
 async execute(input:{snapshot_id:string;fingerprint:string;confirm:string;approval_token?:string},adminId:string){
  assertEnvironment(input.approval_token);if(input.confirm!==CONFIRM)throw Object.assign(new Error('Confirmação explícita inválida.'),{code:'FACTORY_RESET_CONFIRMATION_REQUIRED'});
  const markerPath=`factory_reset_control/${RESET_ID}`,marker=await firestoreAdminRest.get(markerPath);if(marker.exists&&marker.data?.status==='EXECUTED')throw Object.assign(new Error('Este reset one-shot já foi executado.'),{code:'FACTORY_RESET_ALREADY_EXECUTED'});
  const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(input.snapshot_id)}`);if(!snapshot.exists||snapshot.data?.status!=='READY'||snapshot.data?.reset_id!==RESET_ID)throw Object.assign(new Error('Snapshot READY não encontrado.'),{code:'FACTORY_RESET_SNAPSHOT_REQUIRED'});
  const p=await plan();if(input.fingerprint!==p.fingerprint||snapshot.data?.fingerprint!==p.fingerprint)throw Object.assign(new Error('O inventário mudou após o snapshot; gere um novo snapshot.'),{code:'FACTORY_RESET_INVENTORY_CHANGED'});
  await firestoreAdminRest.set(markerPath,{reset_id:RESET_ID,status:'EXECUTING',snapshot_id:input.snapshot_id,fingerprint:p.fingerprint,started_at:new Date().toISOString(),started_by:adminId});
  for(let i=0;i<p.rows.length;i+=100)await firestoreAdminRest.commit(p.rows.slice(i,i+100).map(row=>({delete:firestoreAdminRest.docName(row.path)})));
  for(const user of p.synthetic_auth_users)await firestoreAdminRest.deleteAuthUser(user.uid);
  const cutover={mode:'HYBRID',updated_at:new Date().toISOString(),updated_by:adminId,reason:'controlled-greenfield-reset'};await firestoreAdminRest.set(`${ns()}routing_v2_runtime_state/cutover`,cutover);
  const executedAt=new Date().toISOString();await firestoreAdminRest.set(`factory_reset_snapshots/${input.snapshot_id}`,{...snapshot.data,status:'EXECUTED',executed_at:executedAt,executed_by:adminId,deleted_auth_uids:p.synthetic_auth_users.map(row=>row.uid)});await firestoreAdminRest.set(markerPath,{reset_id:RESET_ID,status:'EXECUTED',snapshot_id:input.snapshot_id,fingerprint:p.fingerprint,executed_at:executedAt,executed_by:adminId});
  const after=await plan();return{snapshot_id:input.snapshot_id,before:{documents:p.rows.length,counts:p.counts},after:{documents:after.rows.length,counts:after.counts},deleted:p.rows.length,deleted_auth_users:p.synthetic_auth_users.length,remaining_reset_documents:after.rows.length,cutover};
 },
 async rollback(snapshotId:string,adminId:string,input:{approval_token?:string}={}){assertEnvironment(input.approval_token);const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(snapshotId)}`);if(!snapshot.exists||snapshot.data?.status!=='EXECUTED')throw Object.assign(new Error('Snapshot executado não encontrado.'),{code:'FACTORY_RESET_ROLLBACK_NOT_AVAILABLE'});const items:any[]=[];for(let offset=0;;offset+=500){const page=await firestoreAdminRest.runQuery({from:[{collectionId:'factory_reset_snapshot_items'}],where:{fieldFilter:{field:{fieldPath:'snapshot_id'},op:'EQUAL',value:{stringValue:snapshotId}}},offset,limit:500});items.push(...page);if(page.length<500)break;}for(let i=0;i<items.length;i+=100)await firestoreAdminRest.commit(items.slice(i,i+100).map((item:any)=>({update:{name:firestoreAdminRest.docName(String(item.data.path)),fields:firestoreAdminRest.fields(item.data.data||{})}})));await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{...snapshot.data,status:'ROLLED_BACK',rolled_back_at:new Date().toISOString(),rolled_back_by:adminId});await firestoreAdminRest.set(`factory_reset_control/${RESET_ID}`,{reset_id:RESET_ID,status:'ROLLED_BACK',snapshot_id:snapshotId,rolled_back_at:new Date().toISOString(),rolled_back_by:adminId});return{snapshot_id:snapshotId,restored:items.length,not_restored:{firebase_auth_users:(snapshot.data?.synthetic_auth_users||[]).length}};},
};
