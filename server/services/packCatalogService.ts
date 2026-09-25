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
  name:string;
  description:string;
  badge?:string;
  recommended?:boolean;
  features:string[];
}

const HISTORICAL_PACKS:PackVersion[]=[
  {pack_id:'starter',version:1,price_brl_cents:1000,base_credits:1000,bonus_credits:0,total_credits:1000,active:false,effective_from:'2026-09-10T00:00:00.000Z',label:'1.000 créditos',name:'Essencial',description:'Pack histórico.',features:[]},
  {pack_id:'casual',version:1,price_brl_cents:2500,base_credits:2500,bonus_credits:125,total_credits:2625,active:false,effective_from:'2026-09-10T00:00:00.000Z',label:'2.625 créditos',name:'Creator legado',description:'Pack histórico.',features:[]},
  {pack_id:'popular',version:1,price_brl_cents:5000,base_credits:5000,bonus_credits:500,total_credits:5500,active:false,effective_from:'2026-09-10T00:00:00.000Z',label:'5.500 créditos',name:'Pro legado',description:'Pack histórico.',features:[]},
  {pack_id:'professional',version:1,price_brl_cents:10000,base_credits:10000,bonus_credits:1500,total_credits:11500,active:false,effective_from:'2026-09-10T00:00:00.000Z',label:'11.500 créditos',name:'Studio legado',description:'Pack histórico.',features:[]},
  {pack_id:'power',version:1,price_brl_cents:20000,base_credits:20000,bonus_credits:4000,total_credits:24000,active:false,effective_from:'2026-09-10T00:00:00.000Z',label:'24.000 créditos',name:'Scale legado',description:'Pack histórico.',features:[]},
  {pack_id:'creator',version:1,price_brl_cents:3990,base_credits:4000,bonus_credits:0,total_credits:4000,active:false,effective_from:'2026-09-25T00:00:00.000Z',label:'4.000 créditos',name:'Creator',description:'Versão comercial histórica.',features:[]},
  {pack_id:'pro',version:1,price_brl_cents:7990,base_credits:8000,bonus_credits:400,total_credits:8400,active:false,effective_from:'2026-09-25T00:00:00.000Z',label:'8.400 créditos',name:'Pro',description:'Versão comercial histórica.',features:[]},
  {pack_id:'studio',version:1,price_brl_cents:14990,base_credits:15000,bonus_credits:1500,total_credits:16500,active:false,effective_from:'2026-09-25T00:00:00.000Z',label:'16.500 créditos',name:'Studio',description:'Versão comercial histórica.',features:[]},
];

const COMMERCIAL_PLANS:PackVersion[]=[
  {
    pack_id:'creator',
    version:2,
    price_brl_cents:4990,
    base_credits:5000,
    bonus_credits:0,
    total_credits:5000,
    active:true,
    effective_from:'2026-09-25T00:00:00.000Z',
    label:'5.000 créditos',
    name:'Creator',
    description:'Para começar a produzir com frequência sem complicação.',
    features:['Acesso a todos os modelos disponíveis','Créditos válidos em imagem, vídeo, voz, música e 3D','Rollover de créditos recorrentes até 2× a franquia mensal'],
  },
  {
    pack_id:'pro',
    version:2,
    price_brl_cents:9990,
    base_credits:11000,
    bonus_credits:0,
    total_credits:11000,
    active:true,
    effective_from:'2026-09-25T00:00:00.000Z',
    label:'11.000 créditos',
    name:'Pro',
    description:'Para criadores que usam IA toda semana e precisam de mais volume.',
    badge:'Mais escolhido',
    recommended:true,
    features:['Tudo do Creator','11.000 créditos por ciclo','Melhor custo efetivo por crédito que o Creator'],
  },
  {
    pack_id:'studio',
    version:2,
    price_brl_cents:19990,
    base_credits:23500,
    bonus_credits:0,
    total_credits:23500,
    active:true,
    effective_from:'2026-09-25T00:00:00.000Z',
    label:'23.500 créditos',
    name:'Studio',
    description:'Para produção recorrente, equipes pequenas e maior volume mensal.',
    badge:'Melhor valor',
    features:['Tudo do Pro','23.500 créditos por ciclo','Menor custo efetivo por crédito entre os três planos'],
  },
];

const PACKS=[...HISTORICAL_PACKS,...COMMERCIAL_PLANS];

export const packCatalogService={
  list(){return PACKS.filter(p=>p.active);},
  get(packId:string,version?:number){return PACKS.find(p=>p.pack_id===packId&&p.active&&(version==null||p.version===version))||null;},
  getAnyVersion(packId:string,version:number){return PACKS.find(p=>p.pack_id===packId&&p.version===version)||null;},
  byAmount(amountCents:number){return PACKS.find(p=>p.active&&p.price_brl_cents===amountCents)||null;},
};
