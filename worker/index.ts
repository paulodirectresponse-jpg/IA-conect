import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { apiRootRouter } from '../server/routes/index.js';
import { pricingSyncService } from '../server/services/pricingSyncService.js';

const app=express();
app.use('/api',apiRootRouter);
app.get('/health',(_req,res)=>res.json({status:'ok',service:'ia-conect',runtime:'cloudflare-workers',stage:'credits-v2'}));
app.listen(3000);
const httpHandler=httpServerHandler({port:3000}) as any;
export default{fetch:httpHandler.fetch.bind(httpHandler),async scheduled(_controller:any,_env:unknown,ctx:any){ctx.waitUntil(pricingSyncService.runHourlySync().then(result=>console.log('[PricingSync]',JSON.stringify({checked_at:result.checked_at,checked:result.checked,healthy:result.healthy,failed:result.failed,fx_rate:result.fx_rate}))));}};
