import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

type Row={path:string;collection:string;data:Record<string,any>};

const AI_CONFIG_COLLECTIONS=[
  'providers',
  'models',
  'provider_models',
  'provider_pricing',
  'provider_scan_latest',
  'provider_scan_runs',
  'retail_pricing',
  'retail_pricing_versions',
  'retail_pricing_active',
  'pricing_health_snapshots',
  'routing_logs',
  'beta_catalog_policies',
  'beta_model_policies',
  'beta_pricing_policies',
];

const AI_CONFIG_DOCUMENTS=[
  'app_config/pricing_health_latest',
];

const PROTECTED_COLLECTIONS=[
  'users',
  'assets',
  'credit_accounts',
  'credit_lots',
  'credit_transactions',
  'credit_idempotency',
  'credit_reservations',
  'payments',
  'subscriptions',
  'billing_records',
  'generations',
  'generation_attempts',
  'generation_client_requests',
  'generation_economics',
  'beta_jobs',
  'beta_job_attempts',
  'beta_job_idempotency',
  'beta_job_mutations',
  'beta_economic_ledger',
  'workspace_drafts',
  'workspace_presets',
  'creative_entities',
  'beta_library_items',
  'beta_collections',
  'beta_projects',
  'beta_spaces',
  'feature_flags',
];

const PROTECTED_SYSTEMS=[
  'Firebase Auth, users e admins',
  'wallet/ledger/reservas/créditos',
  'payments/subscriptions/billing',
  'assets/imagens/vídeos/música/voz/3D',
  'historical generations e user jobs',
  'biblioteca/projetos/Spaces/presets/uploads/referências',
  'Supabase/Storage e arquivos físicos',
];

const CONFIRM='RESET_AI_CONFIGURATION_ONLY_PRESERVE_ALL_REAL_USER_DATA';
const RESET_ID='final-ai-system-reset-v2';

const ns=()=>{
  const value=String(process.env.ROUTING_V2_NAMESPACE||'').trim().toLowerCase();
  if(value&&!/^[a-z0-9_-]{1,32}$/.test(value))throw new Error('ROUTING_V2_NAMESPACE inválido.');
  return value?`${value}_`:'';
};
const isPreview=()=>String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()==='true';
const v2Collections=()=>[
  `${ns()}routing_v2_providers`,
  `${ns()}routing_v2_models`,
  `${ns()}routing_v2_routes`,
  `${ns()}routing_v2_pricing_settings`,
];
const runtimeCollection=()=>`${ns()}routing_v2_runtime_state`;
const relativePath=(name:string)=>{
  const marker='/documents/';
  const i=name.indexOf(marker);
  if(i<0)throw new Error('Nome de documento Firestore inválido.');
  return name.slice(i+marker.length).split('/').map(decodeURIComponent).join('/');
};
const list=async(collection:string)=>{
  const found:any[]=[];
  for(let offset=0;;offset+=500){
    const page=await firestoreAdminRest.runQuery({from:[{collectionId:collection}],offset,limit:500});
    found.push(...page);
    if(page.length<500)break;
  }
  return found.map((r:any)=>({path:relativePath(String(r.name)),collection,data:r.data||{}} as Row));
};
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');

function assertEnvironment(approvalToken?:string){
  if(isPreview())return;
  if(String(process.env.FACTORY_RESET_PRODUCTION_ENABLED||'').toLowerCase()!=='true'){
    throw Object.assign(new Error('Reset de produção não está habilitado.'),{code:'FACTORY_RESET_PRODUCTION_DISABLED'});
  }
  const expected=String(process.env.FACTORY_RESET_APPROVAL_SHA256||'').trim().toLowerCase();
  const actual=hash(String(approvalToken||''));
  if(!expected||expected.length!==64||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))){
    throw Object.assign(new Error('Token one-shot de aprovação inválido.'),{code:'FACTORY_RESET_APPROVAL_REQUIRED'});
  }
}

function assertDeleteScope(rows:Row[]){
  const protectedRows=rows.filter(row=>PROTECTED_COLLECTIONS.includes(row.collection));
  if(protectedRows.length){
    throw Object.assign(
      new Error(`PROTECTED USER DATA MUST NEVER BE DELETED: ${[...new Set(protectedRows.map(row=>row.collection))].join(', ')}`),
      {code:'FACTORY_RESET_PROTECTED_DATA_DETECTED'},
    );
  }
  const allowedCollections=new Set([...AI_CONFIG_COLLECTIONS,...v2Collections(),runtimeCollection()]);
  const allowedDocuments=new Set(AI_CONFIG_DOCUMENTS);
  const outside=rows.filter(row=>!allowedCollections.has(row.collection)&&!allowedDocuments.has(row.path));
  if(outside.length){
    throw Object.assign(new Error('Reset contém documento fora da allowlist da camada de IA.'),{code:'FACTORY_RESET_ALLOWLIST_VIOLATION'});
  }
  const appConfigOutside=rows.filter(row=>row.collection==='app_config'&&!allowedDocuments.has(row.path));
  if(appConfigOutside.length){
    throw Object.assign(new Error('Reset tentou remover app_config fora da allowlist explícita.'),{code:'FACTORY_RESET_APP_CONFIG_VIOLATION'});
  }
}

async function protectedCounts(){
  const counts:Record<string,number>={};
  for(const collection of PROTECTED_COLLECTIONS){
    counts[collection]=(await list(collection)).length;
  }
  return counts;
}

async function targetedDocuments(){
  const rows:Row[]=[];
  for(const documentPath of AI_CONFIG_DOCUMENTS){
    const doc=await firestoreAdminRest.get(documentPath);
    if(doc.exists){
      const collection=documentPath.split('/')[0];
      rows.push({path:documentPath,collection,data:doc.data||{}});
    }
  }
  return rows;
}

async function plan(){
  const collections=[...AI_CONFIG_COLLECTIONS,...v2Collections(),runtimeCollection()];
  const all=new Map(await Promise.all(collections.map(async collection=>[collection,await list(collection)] as const)));
  const rows:Row[]=[];
  const counts:Record<string,number>={};

  for(const[collection,found]of all){
    const selected=collection===runtimeCollection()
      ?found.filter(row=>!row.path.endsWith('/cutover'))
      :found;
    counts[collection]=selected.length;
    rows.push(...selected);
  }

  const documents=await targetedDocuments();
  for(const row of documents){
    counts[row.path]=1;
    rows.push(row);
  }

  assertDeleteScope(rows);
  rows.sort((a,b)=>a.path.localeCompare(b.path));
  const protected_counts=await protectedCounts();
  const proof={
    documents:rows.map(row=>[row.path,row.data]),
    protected_counts,
    protected_collections:PROTECTED_COLLECTIONS,
  };

  return{
    created_at:new Date().toISOString(),
    namespace:ns().slice(0,-1)||'production-default',
    delete_allowlist:[
      ...AI_CONFIG_COLLECTIONS,
      ...v2Collections(),
      `${runtimeCollection()} (exceto cutover)`,
      ...AI_CONFIG_DOCUMENTS,
    ],
    protected_collections:PROTECTED_COLLECTIONS,
    protected_systems:PROTECTED_SYSTEMS,
    counts,
    protected_counts,
    rows,
    fingerprint:hash(JSON.stringify(proof)),
  };
}

async function writeSnapshot(p:Awaited<ReturnType<typeof plan>>,adminId:string){
  const snapshotId=`frs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const createdAt=new Date().toISOString();
  await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{
    snapshot_id:snapshotId,
    reset_id:RESET_ID,
    status:'READY',
    created_at:createdAt,
    created_by:adminId,
    fingerprint:p.fingerprint,
    item_count:p.rows.length,
    before_counts:p.counts,
    protected_counts:p.protected_counts,
    namespace:p.namespace,
  });
  for(let i=0;i<p.rows.length;i+=100){
    const chunk=p.rows.slice(i,i+100);
    await firestoreAdminRest.commit(chunk.map(row=>({
      update:{
        name:firestoreAdminRest.docName(`factory_reset_snapshot_items/${hash(`${snapshotId}:${row.path}`)}`),
        fields:firestoreAdminRest.fields({snapshot_id:snapshotId,path:row.path,collection:row.collection,data:row.data,created_at:createdAt}),
      },
      currentDocument:{exists:false},
    })));
  }
  return{
    snapshot_id:snapshotId,
    item_count:p.rows.length,
    fingerprint:p.fingerprint,
    before_counts:p.counts,
    protected_counts:p.protected_counts,
    created_at:createdAt,
  };
}

export const factoryResetService={
  async dryRun(){
    const p=await plan();
    const{rows,...publicPlan}=p;
    return{
      phase:'DRY_RUN',
      ...publicPlan,
      total_reset_documents:rows.length,
      confirmation_phrase:CONFIRM,
      environment:isPreview()?'preview':'production',
      destructive:false,
    };
  },

  async inventory(){
    return this.dryRun();
  },

  async snapshot(adminId:string,input:{approval_token?:string}={}){
    assertEnvironment(input.approval_token);
    const marker=await firestoreAdminRest.get(`factory_reset_control/${RESET_ID}`);
    if(marker.exists&&marker.data?.status==='EXECUTED'){
      throw Object.assign(new Error('Este reset one-shot já foi executado.'),{code:'FACTORY_RESET_ALREADY_EXECUTED'});
    }
    return writeSnapshot(await plan(),adminId);
  },

  async execute(input:{snapshot_id:string;fingerprint:string;confirm:string;approval_token?:string},adminId:string){
    assertEnvironment(input.approval_token);
    if(input.confirm!==CONFIRM){
      throw Object.assign(new Error('Confirmação explícita inválida.'),{code:'FACTORY_RESET_CONFIRMATION_REQUIRED'});
    }

    const markerPath=`factory_reset_control/${RESET_ID}`;
    const marker=await firestoreAdminRest.get(markerPath);
    if(marker.exists&&marker.data?.status==='EXECUTED'){
      throw Object.assign(new Error('Este reset one-shot já foi executado.'),{code:'FACTORY_RESET_ALREADY_EXECUTED'});
    }

    const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(input.snapshot_id)}`);
    if(!snapshot.exists||snapshot.data?.status!=='READY'||snapshot.data?.reset_id!==RESET_ID){
      throw Object.assign(new Error('Snapshot READY não encontrado.'),{code:'FACTORY_RESET_SNAPSHOT_REQUIRED'});
    }

    const before=await plan();
    if(input.fingerprint!==before.fingerprint||snapshot.data?.fingerprint!==before.fingerprint){
      throw Object.assign(new Error('O inventário mudou após o snapshot; gere um novo snapshot.'),{code:'FACTORY_RESET_INVENTORY_CHANGED'});
    }

    await firestoreAdminRest.set(markerPath,{
      reset_id:RESET_ID,
      status:'EXECUTING',
      snapshot_id:input.snapshot_id,
      fingerprint:before.fingerprint,
      started_at:new Date().toISOString(),
      started_by:adminId,
    });

    for(let i=0;i<before.rows.length;i+=100){
      await firestoreAdminRest.commit(before.rows.slice(i,i+100).map(row=>({delete:firestoreAdminRest.docName(row.path)})));
    }

    const cutover={
      mode:'HYBRID',
      updated_at:new Date().toISOString(),
      updated_by:adminId,
      reason:'ai-configuration-only-reset',
    };
    await firestoreAdminRest.set(`${ns()}routing_v2_runtime_state/cutover`,cutover);

    const after=await plan();
    for(const[key,count]of Object.entries(before.protected_counts)){
      if(after.protected_counts[key]!==count){
        throw Object.assign(new Error(`Coleção protegida mudou durante o reset: ${key}`),{code:'FACTORY_RESET_PROTECTED_DATA_CHANGED'});
      }
    }
    if(after.rows.length!==0){
      throw Object.assign(new Error(`Reset de IA incompleto: ${after.rows.length} documento(s) da allowlist ainda existem.`),{code:'FACTORY_RESET_INCOMPLETE'});
    }

    const executedAt=new Date().toISOString();
    await firestoreAdminRest.set(`factory_reset_snapshots/${input.snapshot_id}`,{
      ...snapshot.data,
      status:'EXECUTED',
      executed_at:executedAt,
      executed_by:adminId,
      after_counts:after.counts,
    });
    await firestoreAdminRest.set(markerPath,{
      reset_id:RESET_ID,
      status:'EXECUTED',
      snapshot_id:input.snapshot_id,
      fingerprint:before.fingerprint,
      executed_at:executedAt,
      executed_by:adminId,
      before_counts:before.counts,
      after_counts:after.counts,
    });

    return{
      snapshot_id:input.snapshot_id,
      before:{documents:before.rows.length,counts:before.counts,protected_counts:before.protected_counts},
      after:{documents:after.rows.length,counts:after.counts,protected_counts:after.protected_counts},
      deleted:before.rows.length,
      remaining_reset_documents:after.rows.length,
      cutover,
    };
  },

  async rollback(snapshotId:string,adminId:string,input:{approval_token?:string}={}){
    assertEnvironment(input.approval_token);
    const snapshot=await firestoreAdminRest.get(`factory_reset_snapshots/${encodeURIComponent(snapshotId)}`);
    if(!snapshot.exists||snapshot.data?.status!=='EXECUTED'){
      throw Object.assign(new Error('Snapshot executado não encontrado.'),{code:'FACTORY_RESET_ROLLBACK_NOT_AVAILABLE'});
    }
    const items:any[]=[];
    for(let offset=0;;offset+=500){
      const page=await firestoreAdminRest.runQuery({
        from:[{collectionId:'factory_reset_snapshot_items'}],
        where:{fieldFilter:{field:{fieldPath:'snapshot_id'},op:'EQUAL',value:{stringValue:snapshotId}}},
        offset,
        limit:500,
      });
      items.push(...page);
      if(page.length<500)break;
    }
    for(let i=0;i<items.length;i+=100){
      await firestoreAdminRest.commit(items.slice(i,i+100).map((item:any)=>({
        update:{name:firestoreAdminRest.docName(String(item.data.path)),fields:firestoreAdminRest.fields(item.data.data||{})},
      })));
    }
    await firestoreAdminRest.set(`factory_reset_snapshots/${snapshotId}`,{
      ...snapshot.data,
      status:'ROLLED_BACK',
      rolled_back_at:new Date().toISOString(),
      rolled_back_by:adminId,
    });
    await firestoreAdminRest.set(`factory_reset_control/${RESET_ID}`,{
      reset_id:RESET_ID,
      status:'ROLLED_BACK',
      snapshot_id:snapshotId,
      rolled_back_at:new Date().toISOString(),
      rolled_back_by:adminId,
    });
    return{snapshot_id:snapshotId,restored:items.length};
  },
};
