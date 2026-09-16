import{afterEach,describe,expect,it,vi}from'vitest';
import{creditWalletService,CreditAccount,CreditLot}from'./creditWalletService.js';
import{firestoreAdminRest}from'../repositories/firestoreAdminRest.js';

afterEach(()=>vi.restoreAllMocks());

describe('final QA credit concurrency',()=>{
  it('prevents a second generation from reserving credits already reserved by the first',async()=>{
    const userId='qa-user';
    let account:CreditAccount={
      user_id:userId,
      available_credits:100,
      reserved_credits:0,
      total_credits:100,
      total_purchased_credits:100,
      total_promotional_credits:0,
      total_used_credits:0,
      total_expired_credits:0,
      total_revoked_credits:0,
      updated_at:'2026-09-16T00:00:00.000Z',
    };
    let lot:CreditLot={
      credit_lot_id:'lot-1',
      user_id:userId,
      source:'PURCHASE',
      original_credits:100,
      available_credits:100,
      reserved_credits:0,
      consumed_credits:0,
      revoked_credits:0,
      expired_credits:0,
      expires_at:null,
      reference_id:'purchase-1',
      net_cash_backing_micros:1_000_000,
      net_cash_value_per_credit_micros:10_000,
      created_at:'2026-09-16T00:00:00.000Z',
    };
    let accountVersion=1,lotVersion=1;

    vi.spyOn(firestoreAdminRest,'docName').mockImplementation((path:string)=>path);
    vi.spyOn(firestoreAdminRest,'fields').mockImplementation((value:any)=>value);
    vi.spyOn(firestoreAdminRest,'get').mockImplementation(async(path:string)=>{
      if(path===`credit_accounts/${encodeURIComponent(userId)}`)return{exists:true,data:account,updateTime:`account-v${accountVersion}`} as any;
      if(path.startsWith('credit_idempotency/'))return{exists:false,data:null,updateTime:null} as any;
      if(path.startsWith('credit_reservations/'))return{exists:false,data:null,updateTime:null} as any;
      return{exists:false,data:null,updateTime:null} as any;
    });
    vi.spyOn(firestoreAdminRest,'runQuery').mockImplementation(async()=>[
      {name:'credit_lots/lot-1',data:lot,updateTime:`lot-v${lotVersion}`},
    ] as any);
    vi.spyOn(firestoreAdminRest,'commit').mockImplementation(async(writes:any[])=>{
      const accountWrite=writes.find(write=>write?.update?.name===`credit_accounts/${encodeURIComponent(userId)}`);
      const lotWrite=writes.find(write=>write?.update?.name==='credit_lots/lot-1');
      if(accountWrite){account=accountWrite.update.fields;accountVersion++;}
      if(lotWrite){lot=lotWrite.update.fields;lotVersion++;}
      return{} as any;
    });

    const first=await creditWalletService.reserveForGeneration({
      userId,
      credits:60,
      generationId:'gen-first',
      idempotencyKey:'credit-reserve:gen-first',
    });

    expect(first.status).toBe('RESERVED');
    expect(account.available_credits).toBe(40);
    expect(account.reserved_credits).toBe(60);
    expect(lot.available_credits).toBe(40);
    expect(lot.reserved_credits).toBe(60);

    await expect(creditWalletService.reserveForGeneration({
      userId,
      credits:60,
      generationId:'gen-second',
      idempotencyKey:'credit-reserve:gen-second',
    })).rejects.toMatchObject({
      code:'CREDIT_INSUFFICIENT_FUNDS',
      missing_credits:20,
    });

    expect(account.available_credits).toBe(40);
    expect(account.reserved_credits).toBe(60);
  });
});
