import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { billingControlService } from './billingControlService.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { assetReferenceResolver } from './assetReferenceResolver.js';

export type SystemHealthStatus='OK'|'DEGRADED'|'ERROR';
export interface SystemHealthCheck{
  key:string;
  label:string;
  status:SystemHealthStatus;
  detail:string;
}

export const systemHealthService={
  async snapshot(){
    const checks:SystemHealthCheck[]=[];

    try{
      await firestoreAdminRest.runQuery({from:[{collectionId:'users'}],limit:1});
      checks.push({key:'firestore',label:'Persistência',status:'OK',detail:'Firestore REST operacional.'});
    }catch{
      checks.push({key:'firestore',label:'Persistência',status:'ERROR',detail:'Não foi possível consultar o Firestore.'});
    }

    try{
      const [models,providers,mappings]=await Promise.all([
        catalogRepository.listModels(),
        catalogRepository.listProviders(),
        catalogRepository.listMappings(),
      ]);
      const activeMappings=mappings.filter((row)=>row.status==='ACTIVE').length;
      const healthy=models.length>0&&providers.length>0&&activeMappings>0;
      checks.push({
        key:'catalog',
        label:'Catálogo',
        status:healthy?'OK':'ERROR',
        detail:healthy?`${models.length} modelos, ${providers.length} providers e ${activeMappings} mappings ativos.`:'Catálogo persistente incompleto.',
      });
    }catch{
      checks.push({key:'catalog',label:'Catálogo',status:'ERROR',detail:'Falha ao consultar o catálogo persistente.'});
    }

    const configured=providerRegistry.listAdapters().filter((adapter)=>adapter.isConfigured());
    checks.push({
      key:'providers',
      label:'Providers',
      status:configured.length>0?'OK':'ERROR',
      detail:configured.length>0?`${configured.length} adapter(s) configurado(s): ${configured.map((a)=>a.name).join(', ')}.`:'Nenhum adapter de geração está configurado.',
    });

    try{
      const billing=await billingControlService.get(true);
      const enabled=billing.credit_v2_enabled&&billing.new_generations_enabled&&billing.provider_execution_enabled;
      checks.push({
        key:'billing',
        label:'Créditos & geração',
        status:enabled?'OK':'DEGRADED',
        detail:enabled?'Credits V2 e execução estão habilitados.':'Há um kill switch operacional pausado.',
      });
    }catch{
      checks.push({key:'billing',label:'Créditos & geração',status:'ERROR',detail:'Não foi possível carregar os controles operacionais.'});
    }

    try{
      const storage=await assetReferenceResolver.runStorageDiagnostic();
      checks.push({
        key:'storage',
        label:'Assets',
        status:storage.is_configured?'OK':'ERROR',
        detail:storage.message,
      });
    }catch{
      checks.push({key:'storage',label:'Assets',status:'ERROR',detail:'Não foi possível validar o armazenamento de assets.'});
    }

    try{
      const recent=await generationRepository.listAllGenerations(50);
      const failed=recent.filter((g)=>g.status==='FAILED').length;
      const inFlight=recent.filter((g)=>['QUEUED','RESERVING_FUNDS','SUBMITTED','PROCESSING'].includes(g.status)).length;
      const failureRate=recent.length?failed/recent.length:0;
      checks.push({
        key:'generations',
        label:'Gerações recentes',
        status:failureRate>=0.5?'DEGRADED':'OK',
        detail:recent.length?`${recent.length} recentes · ${failed} falhas · ${inFlight} em andamento.`:'Nenhuma geração registrada ainda.',
      });
    }catch{
      checks.push({key:'generations',label:'Gerações recentes',status:'DEGRADED',detail:'Não foi possível consultar gerações recentes.'});
    }

    const overall:SystemHealthStatus=checks.some((c)=>c.status==='ERROR')
      ?'ERROR'
      :checks.some((c)=>c.status==='DEGRADED')
        ?'DEGRADED'
        :'OK';

    return{status:overall,checked_at:new Date().toISOString(),checks};
  },
};
