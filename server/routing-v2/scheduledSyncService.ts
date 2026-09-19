import { routingV2PriceSyncService } from './priceSyncService.js';
import { routingV2Repository } from './repository.js';

export const routingV2ScheduledSyncService={
  async run(input:{fx_rate_usd_brl?:number;limit?:number}={}){
    const cursor=await routingV2Repository.getPriceSyncCursor();
    const result=await routingV2PriceSyncService.runBatch({
      cursor,
      limit:input.limit??10,
      fx_rate_usd_brl:input.fx_rate_usd_brl,
    });
    await routingV2Repository.savePriceSyncCursor(result.next_cursor??0);
    return result;
  },
};
