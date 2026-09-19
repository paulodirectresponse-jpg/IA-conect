import { routingV2PriceSyncService } from './priceSyncService.js';
import { routingV2Repository } from './repository.js';
import { fxRateService } from '../services/fxRateService.js';

export const routingV2ScheduledSyncService={
  async run(input:{fx_rate_usd_brl?:number;limit?:number}={}){
    const cursor=await routingV2Repository.getPriceSyncCursor();
    const suppliedFx=Number(input.fx_rate_usd_brl);
    const fx=Number.isFinite(suppliedFx)&&suppliedFx>0?suppliedFx:(await fxRateService.get(true)).rate;
    const result=await routingV2PriceSyncService.runBatch({
      cursor,
      limit:input.limit??10,
      fx_rate_usd_brl:fx,
    });
    await routingV2Repository.savePriceSyncCursor(result.next_cursor??0);
    return result;
  },
};
