import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { routingV2Repository } from '../routing-v2/repository.js';
import { billingControlService } from './billingControlService.js';
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
      const [models,providers,routes]=await Promise.all([
        routingV2Repository.listModels(),routingV2Repository.listProviders(),routingV2Repository.listRoutes(),
      ]);
      const ready=routes.filter((row)=>row.status==='READY'&&row.runtime_status==='HEALTHY'&&row.pricing_status==='CURRENT').length;
      checks.push({
        key:'ai_readiness',
        label:'Prontidão do catálogo de IA',
        status:'OK',
        detail:ready>0?`${models.length} modelos, ${providers.length} providers e ${ready} Routes READY.`:'NOT_CONFIGURED — nenhuma Route V2 READY; configuração de IA necessária.',
      });
    }catch{
      checks.push({key:'ai_readiness',label:'Prontidão do catálogo de IA',status:'ERROR',detail:'Falha ao consultar o catálogo persistente.'});
    }

    const providers=await routingV2Repository.listProviders().catch(()=>[]);
    const healthyProviders=providers.filter(provider=>provider.status==='ACTIVE'&&provider.health_status==='HEALTHY');
    checks.push({
      key:'providers',
      label:'Providers',
      status:'OK',
      detail:healthyProviders.length>0?`${healthyProviders.length} provider(s) V2 com health real HEALTHY.`:'NOT_CONFIGURED — nenhum provider V2 cadastrado e saudável.',
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
