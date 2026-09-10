export interface PackVersion {
  pack_id:string;
  version:number;
  price_brl_cents:number;
  base_credits:number;
  bonus_credits:number;
  total_credits:number;
  active:boolean;
  effective_from:string;
  label:string;
  badge?:string;
}

const PACKS:PackVersion[]=[
  {pack_id:'starter',version:1,price_brl_cents:1000,base_credits:1000,bonus_credits:0,total_credits:1000,active:true,effective_from:'2026-09-10T00:00:00.000Z',label:'1.000 créditos'},
  {pack_id:'casual',version:1,price_brl_cents:2500,base_credits:2500,bonus_credits:125,total_credits:2625,active:true,effective_from:'2026-09-10T00:00:00.000Z',label:'2.625 créditos'},
  {pack_id:'popular',version:1,price_brl_cents:5000,base_credits:5000,bonus_credits:500,total_credits:5500,active:true,effective_from:'2026-09-10T00:00:00.000Z',label:'5.500 créditos',badge:'Mais popular'},
  {pack_id:'professional',version:1,price_brl_cents:10000,base_credits:10000,bonus_credits:1500,total_credits:11500,active:true,effective_from:'2026-09-10T00:00:00.000Z',label:'11.500 créditos'},
  {pack_id:'power',version:1,price_brl_cents:20000,base_credits:20000,bonus_credits:4000,total_credits:24000,active:true,effective_from:'2026-09-10T00:00:00.000Z',label:'24.000 créditos'},
];

export const packCatalogService={
  list(){return PACKS.filter(p=>p.active);},
  get(packId:string,version?:number){return PACKS.find(p=>p.pack_id===packId&&p.active&&(version==null||p.version===version))||null;},
  byAmount(amountCents:number){return PACKS.find(p=>p.active&&p.price_brl_cents===amountCents)||null;},
};
