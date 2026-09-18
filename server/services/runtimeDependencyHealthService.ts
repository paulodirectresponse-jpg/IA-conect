import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { packCatalogService } from './packCatalogService.js';

type CheckStatus='OK'|'ERROR'|'DEGRADED';
interface RuntimeCheck{key:string;status:CheckStatus;code:string;detail:string;metadata?:Record<string,string|number|boolean>;}

function classifyFirestoreError(error:any){
  const message=String(error?.message||error||'');
  const upper=message.toUpperCase();
  if(message.includes('FIREBASE_SERVICE_ACCOUNT_JSON não configurado'))return 'FIREBASE_SERVICE_ACCOUNT_MISSING';
  if(/JSON|PRIVATE KEY|PKCS8|INVALID/i.test(message))return 'FIREBASE_SERVICE_ACCOUNT_INVALID';
  if(upper.includes('PERMISSION_DENIED')||String(error?.status)==='403')return 'FIRESTORE_PERMISSION_DENIED';
  if(upper.includes('UNAUTHENTICATED')||String(error?.status)==='401')return 'FIRESTORE_AUTH_FAILED';
  if(upper.includes('NOT_FOUND')||String(error?.status)==='404')return 'FIRESTORE_DATABASE_NOT_FOUND';
  return 'FIRESTORE_UNAVAILABLE';
}

function serviceAccountCheck():RuntimeCheck{
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if(!raw)return{key:'firebase-service-account',status:'ERROR',code:'MISSING',detail:'Credencial administrativa do Firebase ausente no runtime.'};
  try{
    const parsed=JSON.parse(raw);
    const valid=Boolean(parsed?.client_email&&parsed?.private_key&&parsed?.project_id);
    if(!valid)return{key:'firebase-service-account',status:'ERROR',code:'INCOMPLETE',detail:'Credencial administrativa do Firebase está incompleta.'};
    return{key:'firebase-service-account',status:'OK',code:'CONFIGURED',detail:'Credencial administrativa do Firebase está presente e estruturalmente válida.'};
  }catch{
    return{key:'firebase-service-account',status:'ERROR',code:'INVALID_JSON',detail:'Credencial administrativa do Firebase não contém JSON válido.'};
  }
}

export const runtimeDependencyHealthService={
  async snapshot(){
    const checks:RuntimeCheck[]=[];
    checks.push(serviceAccountCheck());

    try{
      await firestoreAdminRest.runQuery({from:[{collectionId:'users'}],limit:1});
      checks.push({key:'firestore',status:'OK',code:'CONNECTED',detail:'Acesso administrativo ao Firestore está operacional.'});
    }catch(error:any){
      const code=classifyFirestoreError(error);
      console.error('[RuntimeHealth] Firestore dependency failed:',error?.message||error);
      checks.push({key:'firestore',status:'ERROR',code,detail:'O backend não conseguiu acessar o Firestore.'});
    }

    const adapters=providerRegistry.listAdapters();
    const configured=adapters.filter(adapter=>adapter.isConfigured()).map(adapter=>adapter.providerId);
    checks.push({
      key:'providers',
      status:configured.length?'OK':'ERROR',
      code:configured.length?'CONFIGURED':'NO_PROVIDER_KEYS',
      detail:configured.length?`${configured.length} provider(s) com credencial disponível no runtime.`:'Nenhum provider possui credencial disponível no runtime.',
      metadata:{configured_count:configured.length,total_count:adapters.length,configured_provider_ids:configured.join(',')},
    });

    const storageConfigured=Boolean(process.env.SUPABASE_URL?.trim()&&process.env.SUPABASE_SECRET_KEY?.trim()&&process.env.SUPABASE_BUCKET?.trim());
    checks.push({
      key:'storage',
      status:storageConfigured?'OK':'DEGRADED',
      code:storageConfigured?'CONFIGURED':'MISSING_BINDING',
      detail:storageConfigured?'Bindings do armazenamento estão configurados.':'Um ou mais bindings do armazenamento estão ausentes.',
    });

    const packs=packCatalogService.list();
    checks.push({
      key:'credit-packs',
      status:packs.length?'OK':'ERROR',
      code:packs.length?'AVAILABLE':'EMPTY',
      detail:packs.length?`${packs.length} pacotes de créditos estão disponíveis no catálogo local.`:'O catálogo local de pacotes está vazio.',
      metadata:{count:packs.length},
    });

    const status:CheckStatus=checks.some(check=>check.status==='ERROR')?'ERROR':checks.some(check=>check.status==='DEGRADED')?'DEGRADED':'OK';
    return{status,checked_at:new Date().toISOString(),checks};
  },
};
