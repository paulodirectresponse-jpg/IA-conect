import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { apiRootRouter } from '../server/routes/index.js';
import { pricingSyncService } from '../server/services/pricingSyncService.js';
import { routingV2ScheduledSyncService } from '../server/routing-v2/scheduledSyncService.js';
import '../server/routing-v2/health.init.js';
import '../server/routing-v2/adapter.init.js';

const app=express();
app.use('/api',apiRootRouter);
app.get('/health',(_req,res)=>res.json({status:'ok',service:'ia-conect',runtime:'cloudflare-workers',stage:'credits-v2'}));
app.listen(3000);
const httpHandler=httpServerHandler({port:3000}) as any;
export default{fetch:httpHandler.fetch.bind(httpHandler),async scheduled(controller:any,_env:unknown){
  if(controller.cron==='15,45 * * * *'){
    try{
      const legacy=await pricingSyncService.runHourlySync();
      console.log('[PricingSync]',JSON.stringify({checked_at:legacy.checked_at,checked:legacy.checked,healthy:legacy.healthy,failed:legacy.failed,fx_rate:legacy.fx_rate}));
      if(legacy.failed>0){
        const failures=legacy.rows.filter(row=>row.status==='FAILED'||row.health==='RED').map(row=>({provider_id:row.provider_id,model_id:row.model_id,capability_id:row.capability_id,error:row.error||row.health||'Falha de pricing'}));
        console.error('[PricingSyncFailures]',JSON.stringify(failures));
        throw new Error(`Pricing sync terminou com ${legacy.failed} falha(s).`);
      }
    }catch(error:any){
      console.error('[PricingSync]',error?.message||error);
      throw error;
    }
    return;
  }
  if(controller.cron==='*/2 * * * *'){
    try{
      const v2=await routingV2ScheduledSyncService.run({limit:10});
      console.log('[RoutingV2PriceSync]',JSON.stringify({checked_at:v2.checked_at,cursor:v2.cursor,next_cursor:v2.next_cursor,processed:v2.processed,updated:v2.updated,failed:v2.failed,done:v2.done}));
      if(v2.failed>0){
        const failures=v2.rows.filter(row=>!row.ok).map(row=>({route_id:row.route_id,provider_id:row.provider_id,model_id:row.model_id,capability_id:row.capability_id,provider_model_identifier:row.provider_model_identifier,error:row.error||'Falha de pricing'}));
        console.error('[RoutingV2PriceSyncFailures]',JSON.stringify(failures));
        throw new Error(`Routing V2 price sync terminou com ${v2.failed} falha(s) no lote.`);
      }
    }catch(error:any){
      console.error('[RoutingV2PriceSync]',error?.message||error);
      throw error;
    }
    return;
  }
  const error=new Error(`[ScheduledSync] Cron não reconhecido: ${controller.cron}`);
  console.error(error.message);
  throw error;
}};
