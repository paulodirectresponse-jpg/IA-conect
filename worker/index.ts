import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { apiRootRouter } from '../server/routes/index.js';
import { pricingSyncService } from '../server/services/pricingSyncService.js';
import { routingV2ScheduledSyncService } from '../server/routing-v2/scheduledSyncService.js';

const app=express();
app.use('/api',apiRootRouter);
app.get('/health',(_req,res)=>res.json({status:'ok',service:'ia-conect',runtime:'cloudflare-workers',stage:'credits-v2'}));
app.listen(3000);
const httpHandler=httpServerHandler({port:3000}) as any;
export default{fetch:httpHandler.fetch.bind(httpHandler),async scheduled(_controller:any,_env:unknown,ctx:any){
  ctx.waitUntil((async()=>{
    const legacy=await pricingSyncService.runHourlySync();
    console.log('[PricingSync]',JSON.stringify({checked_at:legacy.checked_at,checked:legacy.checked,healthy:legacy.healthy,failed:legacy.failed,fx_rate:legacy.fx_rate}));
    const v2=await routingV2ScheduledSyncService.run({fx_rate_usd_brl:Number(legacy.fx_rate)||undefined,limit:10});
    console.log('[RoutingV2PriceSync]',JSON.stringify({checked_at:v2.checked_at,cursor:v2.cursor,next_cursor:v2.next_cursor,processed:v2.processed,updated:v2.updated,failed:v2.failed,done:v2.done}));
  })());
}};
