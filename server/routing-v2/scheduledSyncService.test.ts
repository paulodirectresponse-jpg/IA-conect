import { beforeEach,describe,expect,it,vi } from 'vitest';

const mocks=vi.hoisted(()=>(
  {getPriceSyncCursor:vi.fn(),savePriceSyncCursor:vi.fn(),runBatch:vi.fn(),getFx:vi.fn()}
));

vi.mock('./repository.js',()=>({routingV2Repository:{
  getPriceSyncCursor:mocks.getPriceSyncCursor,
  savePriceSyncCursor:mocks.savePriceSyncCursor,
}}));
vi.mock('./priceSyncService.js',()=>({routingV2PriceSyncService:{runBatch:mocks.runBatch}}));
vi.mock('../services/fxRateService.js',()=>({fxRateService:{get:mocks.getFx}}));

describe('Routing V2 scheduled price sync',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getPriceSyncCursor.mockResolvedValue(20);
    mocks.savePriceSyncCursor.mockImplementation(async(cursor:number)=>cursor);
    mocks.getFx.mockResolvedValue({rate:5.25});
    mocks.runBatch.mockResolvedValue({cursor:20,next_cursor:30,processed:10,updated:8,failed:2,done:false});
  });

  it('advances one bounded batch and persists its cursor for the next scheduled tick',async()=>{
    const {routingV2ScheduledSyncService}=await import('./scheduledSyncService.js');

    const result=await routingV2ScheduledSyncService.run({limit:10});

    expect(mocks.runBatch).toHaveBeenCalledWith({cursor:20,limit:10,fx_rate_usd_brl:5.25});
    expect(mocks.savePriceSyncCursor).toHaveBeenCalledWith(30);
    expect(result).toMatchObject({cursor:20,next_cursor:30,processed:10,failed:2,done:false});
  });

  it('resets the cursor only after the final batch and returns its failure counts unchanged',async()=>{
    mocks.runBatch.mockResolvedValue({cursor:110,next_cursor:null,processed:5,updated:3,failed:2,done:true});
    const {routingV2ScheduledSyncService}=await import('./scheduledSyncService.js');

    const result=await routingV2ScheduledSyncService.run({limit:10,fx_rate_usd_brl:5.5});

    expect(mocks.getFx).not.toHaveBeenCalled();
    expect(mocks.runBatch).toHaveBeenCalledWith({cursor:20,limit:10,fx_rate_usd_brl:5.5});
    expect(mocks.savePriceSyncCursor).toHaveBeenCalledWith(0);
    expect(result).toMatchObject({cursor:110,next_cursor:null,processed:5,failed:2,done:true});
  });
});
