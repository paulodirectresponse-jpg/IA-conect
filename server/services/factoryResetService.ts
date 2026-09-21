import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

type Row={path:string;collection:string;data:Record<string,any>};
const LEGACY_INVENTORY=['providers','models','provider_models','provider_pricing','provider_scan_latest','retail_pricing','retail_pricing_versions','retail_pricing_active','pricing_health_snapshots','routing_logs'];
const SYNTHETIC_RUNTIME=['generations','generation_attempts','generation_client_requests','generation_economics','beta_jobs','beta_job_attempts','beta_job_idempotency','beta_job_mutations','beta_economic_ledger','credit_accounts','credit_lots','credit_transactions','credit_idempotency','credit_reservations'];
const PRESERVED=['users (reais)','Firebase Auth','assets','Supabase Storage','secrets','app_config','feature_flags','payments','audit_logs','credit_* de usuários reais'];
const syntheticEmail=/^routing-v2-(?:runtime|probe|final)(?:[-+._][a-z0-9]+)*@example\.com$/i;
const namespace=()=>{const value=String(process.env.ROUTING_V2_NAMESPACE||'').trim().toLowerCase();if(!value||!/^[a-z0-9_-]{1,32}$/.test(value))throw Object.assign(new Error('Factory reset exige namespace isolado válido.'),{code:'FACTORY_RESET_NAMESPACE_REQUIRED'});return`${value}_`;};
const v2Collections=()=>[`${namespace()}routing_v2_providers`,`${namespace()}routing_v2_models`,`${namespace()}routing_v2_routes`,`${namespace()}routing_v2_pricing_settings`,`${namespace()}routing_v2_runtime_state`];
const relativePath=(name:string)=>{const marker='/documents/';const i=name.indexOf(marker);if(i<0)throw new Error('Nome de documento Firestore inválido.');return name.slice(i+marker.length).split('/').map(decodeURIComponent).join('/');};
const list=async(collection:string)=>{const rows=await firestoreAdminRest.runQuery({from:[{collectionId:collection}],limit:5000});return rows.map((r:any)=>({path:relativePath(String(r.name)),collection,data:r.data||{}} as Row));};
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const uidOf=(row:Row)=>String(row.data.user_id||row.data.owner_user_id||row.data.uid||'');

async function plan(){
  const users=await list('users');
  const syntheticUsers=users.filter(row=>syntheticEmail.test(String(row.data.email||'')));
  const syntheticIds=new Set(syntheticUsers.map(row=>String(row.data.uid||row.data.user_id||row.path.split('/').at(-1)||'')));
  const resetCollections=[...LEGACY_INVENTORY,...v2Collections()];
  const all=await Promise.all([...resetCollections,...SYNTHETIC_RUNTIME].map(async collection=>[collection,await list(collection)] as const));
  const runtime=new Map(all.filter(([collection])=>SYNTHETIC_RUNTIME.includes(collection)));
  const syntheticGenerations=new Set((runtime.get('generations')||[]).filter(row=>syntheticIds.has(uidOf(row))).map(row=>String(row.data.generation_id||row.path.split('/').at(-1)||'')));
  const syntheticJobs=new Set((runtime.get('beta_jobs')||[]).filter(row=>syntheticIds.has(uidOf(row))).map(row=>String(row.data.job_id||row.path.split('/').at(-1)||'')));
  const belongsToSyntheticRuntime=(row:Row)=>syntheticIds.has(uidOf(row))||syntheticGenerations.has(String(row.data.generation_id||row.data.reference_id||''))||syntheticJobs.has(String(row.data.job_id||row.data.reference_id||''));
  const rows:Row[]=[];const counts:Record<string,number>={};
  for(const[collection,found]of all){
    const selected=resetCollections.includes(collection)?found:found.filter(belongsToSyntheticRuntime);
    counts[collection]=selected.length;rows.push(...selected);
  }
  for(const row of syntheticUsers){counts.users=(counts.users||0)+1;rows.push(row);}
  rows.sort((a,b)=>a.path.localeCompare(b.path));
  const fingerprint=hash(JSON.stringify(rows.map(row=>[row.path,row.data])));
  return{created_at:new Date().toISOString(),namespace:namespace().slice(0,-1),preserve:PRESERVED,reset:[...resetCollections,...SYNTHETIC_RUNTIME.map(x=>`${x} (somente contas sintéticas)`),'users (somente perfis sintéticos routing-v2-*@example.com)'],counts,synthetic_users:syntheticUsers.map(row=>({uid:uidOf(row),email:String(row.data.email||'')})),rows,fingerprint};
}

async function writeSnapshot(p:Awaited<ReturnType<typeof plan>>,adminId:string){
  const snapshotId=`frs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now=new Date().toISOString();
  await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{snapshot_id:snapshotId,status:'READY',created_at:now,created_by:adminId,fingerprint:p.fingerprint,item_count:p.rows.length,counts:p.counts,namespace:p.namespace});
  for(let i=0;i<p.rows.length;i+=100){
    const chunk=p.rows.slice(i,i+100);
    await firestoreAdminRest.commit(chunk.map(row=>({update:{name:firestoreAdminRest.docName(`factory_reset_snapshot_items/${hash(`${snapshotId}:${row.path}`)}`),fields:firestoreAdminRest.fields({snapshot_id:snapshotId,path:row.path,collection:row.collection,data:row.data,created_at:now})},currentDocument:{exists:false}})));
  }
  return{snapshot_id:snapshotId,item_count:p.rows.length,fingerprint:p.fingerprint,counts:p.counts,created_at:now};
}

export const factoryResetService={
 async inventory(){const p=await plan();const{rows,...publicPlan}=p;return{...publicPlan,total_reset_documents:rows.length};},
 async snapshot(adminId:string){if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true')throw Object.assign(new Error('Snapshot do reset liberado apenas no preview isolado.'),{code:'FACTORY_RESET_PREVIEW_ONLY'});const p=await plan();return writeSnapshot(p,adminId);},
 async execute(input:{snapshot_id:string;fingerprint:string;confirm:string},adminId:string){
  if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true')throw Object.assign(new Error('Factory reset liberado apenas no preview isolado.'),{code:'FACTORY_RESET_PREVIEW_ONLY'});
  if(input.confirm!=='RESET_GREENFIELD_AUTH_USERS_WALLET_ASSETS_PRESERVED')throw Object.assign(new Error('Confirmação explícita inválida.'),{code:'FACTORY_RESET_CONFIRMATION_REQUIRED'});
  const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(input.snapshot_id)}`);
  if(!snapshot.exists||snapshot.data?.status!=='READY')throw Object.assign(new Error('Snapshot READY não encontrado.'),{code:'FACTORY_RESET_SNAPSHOT_REQUIRED'});
  const p=await plan();
  if(input.fingerprint!==p.fingerprint||snapshot.data?.fingerprint!==p.fingerprint)throw Object.assign(new Error('O inventário mudou após o snapshot; gere um novo snapshot.'),{code:'FACTORY_RESET_INVENTORY_CHANGED'});
  for(let i=0;i<p.rows.length;i+=100)await firestoreAdminRest.commit(p.rows.slice(i,i+100).map(row=>({delete:firestoreAdminRest.docName(row.path)})));
  const cutover={mode:'HYBRID',updated_at:new Date().toISOString(),updated_by:adminId,reason:'controlled-greenfield-reset'};
  await firestoreAdminRest.set(`${namespace()}routing_v2_runtime_state/cutover`,cutover);
  await firestoreAdminRest.set(`factory_reset_snapshots/${input.snapshot_id}`,{...snapshot.data,status:'EXECUTED',executed_at:new Date().toISOString(),executed_by:adminId});
  const after=await plan();
  return{snapshot_id:input.snapshot_id,deleted:p.rows.length,deleted_counts:p.counts,remaining_reset_documents:after.rows.length,cutover};
 },
 async rollback(snapshotId:string,adminId:string){
  if(String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()!=='true')throw Object.assign(new Error('Rollback liberado apenas no preview isolado.'),{code:'FACTORY_RESET_PREVIEW_ONLY'});
  const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(snapshotId)}`);
  if(!snapshot.exists||snapshot.data?.status!=='EXECUTED')throw Object.assign(new Error('Snapshot executado não encontrado.'),{code:'FACTORY_RESET_ROLLBACK_NOT_AVAILABLE'});
  const items=await firestoreAdminRest.runQuery({from:[{collectionId:'factory_reset_snapshot_items'}],where:{fieldFilter:{field:{fieldPath:'snapshot_id'},op:'EQUAL',value:{stringValue:snapshotId}}},limit:5000});
  for(let i=0;i<items.length;i+=100)await firestoreAdminRest.commit(items.slice(i,i+100).map((item:any)=>({update:{name:firestoreAdminRest.docName(String(item.data.path)),fields:firestoreAdminRest.fields(item.data.data||{})}})));
  await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{...snapshot.data,status:'ROLLED_BACK',rolled_back_at:new Date().toISOString(),rolled_back_by:adminId});
  return{snapshot_id:snapshotId,restored:items.length};
 },
};
