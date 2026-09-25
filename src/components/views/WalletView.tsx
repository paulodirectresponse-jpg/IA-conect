import React,{useEffect,useState}from'react';
import{Wallet,RotateCcw,FileText,Plus,Check,CheckCircle2,X,Loader2,Tag,ShieldCheck,ArrowRight,CalendarClock,CreditCard}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{creditService}from'../../services/creditService.js';
import{subscriptionClient}from'../../services/subscriptionClient.js';
import{CreditTransaction,PackVersion,UserSubscription}from'../../types/credits.js';
import{formatCentsToBRL}from'../../config/constants.js';
import{CreditAmount}from'../common/CreditAmount.js';

const unitPerThousand=(p:PackVersion)=>Math.round((p.price_brl_cents/Math.max(1,p.total_credits))*1000);
const statusLabel=(s?:string)=>s==='ACTIVE'?'Ativa':s==='PENDING'?'Aguardando ativação':s==='PAUSED'?'Pausada':s==='CANCELED'?'Cancelada':'Indisponível';
const positive=(t:string)=>['PURCHASE_ISSUE','PROMO_ISSUE','ADMIN_CREDIT','CREATOR_REWARD','MIGRATION_ISSUE','GENERATION_RELEASE'].includes(t);

export const WalletView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[transactions,setTransactions]=useState<CreditTransaction[]>([]);
 const[packs,setPacks]=useState<PackVersion[]>([]);
 const[subscription,setSubscription]=useState<UserSubscription|null>(null);
 const[selectedPack,setSelectedPack]=useState<PackVersion|null>(null);
 const[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[plansOpen,setPlansOpen]=useState(false),[redeemOpen,setRedeemOpen]=useState(false),[redeemCode,setRedeemCode]=useState(''),[redeemLoading,setRedeemLoading]=useState(false),[redeemMessage,setRedeemMessage]=useState(''),[actionLoading,setActionLoading]=useState(false),[message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  try{
   const[t,p,s]=await Promise.all([creditService.listTransactions(50),creditService.listPacks(),subscriptionClient.getCurrent()]);
   setTransactions(t.transactions);setPacks(p);setSubscription(s);
   if(!selectedPack&&p.length){
    const current=p.find(x=>x.pack_id===s?.pack_id);
    setSelectedPack(current||p.find(x=>x.recommended)||p[0]);
   }
  }finally{setLoading(false);}
 };
 useEffect(()=>{load().catch(console.error);},[]);
 const refresh=async()=>{setRefreshing(true);try{await Promise.all([refreshWallet(),load()]);}finally{setRefreshing(false);}};
 const choosePack=(pack:PackVersion)=>{setSelectedPack(pack);setMessage('');};
 const smartRedeem=async()=>{
  if(!redeemCode.trim())return;setRedeemLoading(true);setRedeemMessage('');
  try{
   const inspected=await creditService.inspectCoupon(redeemCode.trim());
   if(inspected.redemption_mode==='CHECKOUT'){setRedeemMessage('Este código exige checkout e não é aplicado à assinatura recorrente nesta etapa.');return;}
   const result=await creditService.redeemCoupon(redeemCode.trim());await refreshWallet();
   setRedeemMessage(`${Number(result.credits||0).toLocaleString('pt-BR')} créditos adicionados com sucesso.`);setRedeemCode('');
  }catch(e:any){setRedeemMessage(e?.message||'Não foi possível resgatar este código.');}
  finally{setRedeemLoading(false);}
 };
 const subscribe=async()=>{
  if(!selectedPack)return;setActionLoading(true);setMessage('');
  try{
   const sub=await subscriptionClient.createCheckout(selectedPack.pack_id,selectedPack.version);setSubscription(sub);
   if(sub.checkout_url){window.location.assign(sub.checkout_url);return;}
   setMessage('Assinatura criada, mas o checkout do Mercado Pago não foi retornado.');
  }catch(e:any){setMessage(e?.message||'Não foi possível iniciar a assinatura.');}
  finally{setActionLoading(false);}
 };
 const changePlan=async()=>{
  if(!selectedPack)return;setActionLoading(true);setMessage('');
  try{const sub=await subscriptionClient.changePlan(selectedPack.pack_id,selectedPack.version);setSubscription(sub);setMessage(`Mudança para ${selectedPack.name} programada para a próxima cobrança.`);}
  catch(e:any){setMessage(e?.message||'Não foi possível alterar o plano.');}
  finally{setActionLoading(false);}
 };
 const cancelSubscription=async()=>{
  if(!subscription||!window.confirm('Cancelar a renovação da assinatura? Seu saldo atual continuará disponível.'))return;
  setActionLoading(true);setMessage('');
  try{const sub=await subscriptionClient.cancel();setSubscription(sub);setMessage('Assinatura cancelada. Não haverá novas cobranças recorrentes.');}
  catch(e:any){setMessage(e?.message||'Não foi possível cancelar a assinatura.');}
  finally{setActionLoading(false);}
 };
 const baselineUnit=packs.length?unitPerThousand(packs[0]):0,bestUnit=packs.length?Math.min(...packs.map(unitPerThousand)):0;
 const active=subscription?.status==='ACTIVE',pending=subscription?.status==='PENDING';
 const samePlan=Boolean(selectedPack&&subscription?.pack_id===selectedPack.pack_id&&!subscription?.pending_plan_change);

 return <div className="ia-wallet space-y-7 text-zinc-100">
  <div className="ia-wallet-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
   <div className="ia-view-header"><h1 className="ia-view-title">Créditos</h1><p className="ia-view-description">Sua assinatura, saldo e movimentações em um só lugar.</p></div>
   <div className="flex flex-wrap gap-2">
    <button onClick={refresh} disabled={refreshing} className="ia-wallet-secondary-action h-10 px-3.5 text-[11px] flex items-center gap-2"><RotateCcw className={`w-3.5 h-3.5 ${refreshing?'animate-spin':''}`}/>Atualizar</button>
    <button onClick={()=>{setRedeemMessage('');setRedeemOpen(true)}} className="ia-wallet-secondary-action h-10 px-3.5 text-[11px] flex items-center gap-2"><Tag className="w-3.5 h-3.5"/>Resgatar código</button>
    <button onClick={()=>setPlansOpen(true)} className="ia-primary h-10 px-4 rounded-[10px] text-[11px] font-bold flex items-center gap-2"><Plus className="w-3.5 h-3.5"/>{active?'Gerenciar plano':'Ver planos'}</button>
   </div>
  </div>

  <div className="grid gap-3 lg:grid-cols-[1.3fr_.9fr]">
   <div className="grid sm:grid-cols-3 gap-3">
    <div className="sm:col-span-2 p-5 rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-400/[0.10] to-blue-500/[0.025]">
     <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-medium"><Wallet className="w-4 h-4 text-sky-300"/>Disponível</div>
     <div className="mt-3"><CreditAmount value={wallet?.available_credits??0} size="lg" className="text-3xl font-black text-white" valueClassName="text-3xl"/></div>
     <p className="text-[10px] text-zinc-500 mt-2">O preço de cada geração é exibido antes da confirmação.</p>
    </div>
    <div className="p-5 rounded-2xl border border-white/[0.07] bg-[#08131e]">
     <p className="text-[11px] font-medium text-zinc-500">Reservado</p>
     <div className="mt-3"><CreditAmount value={wallet?.reserved_credits??0} size="md" className="text-xl font-bold text-white" valueClassName="text-xl"/></div>
     <p className="text-[10px] text-zinc-600 mt-2">Gerações em processamento.</p>
    </div>
   </div>

   <div className="rounded-2xl border border-white/[0.07] bg-[#08131e] p-5">
    <div className="flex items-start justify-between gap-3">
     <div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">Assinatura</p><h2 className="mt-1 text-[16px] font-black text-white">{active||pending?subscription?.plan_name:'Sem plano ativo'}</h2></div>
     <span className={`rounded-full border px-2.5 py-1 text-[8px] font-bold ${active?'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300':pending?'border-amber-300/20 bg-amber-300/[0.06] text-amber-200':'border-white/[0.06] text-zinc-500'}`}>{statusLabel(subscription?.status)}</span>
    </div>
    {subscription&&subscription.status!=='CANCELED'?<div className="mt-4 space-y-2 text-[9px]">
     <div className="flex items-center justify-between text-zinc-500"><span>Mensalidade</span><strong className="text-zinc-200">{formatCentsToBRL(subscription.price_brl_cents)}</strong></div>
     <div className="flex items-center justify-between text-zinc-500"><span>Créditos por ciclo</span><CreditAmount value={subscription.monthly_credits} size="xs" className="font-bold text-zinc-200"/></div>
     <div className="flex items-center justify-between text-zinc-500"><span>Próxima cobrança</span><strong className="text-zinc-300">{subscription.next_payment_date?new Date(subscription.next_payment_date).toLocaleDateString('pt-BR'):'—'}</strong></div>
     {subscription.pending_plan_change&&<div className="mt-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] p-2.5 text-sky-200">Próximo ciclo: {subscription.pending_plan_change.plan_name} · {formatCentsToBRL(subscription.pending_plan_change.price_brl_cents)}</div>}
    </div>:<p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Escolha Creator, Pro ou Studio. A cobrança é mensal e os créditos entram somente após uma cobrança confirmada.</p>}
    <button onClick={()=>setPlansOpen(true)} className="mt-4 h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] text-[9px] font-bold text-zinc-200 hover:bg-white/[0.05]">{active?'Ver ou trocar plano':'Escolher plano'}</button>
   </div>
  </div>

  <div className="rounded-2xl border border-white/[0.07] bg-[#08131e] overflow-hidden">
   <div className="px-5 py-4 border-b border-white/[0.06]"><h2 className="text-sm font-semibold">Movimentações</h2><p className="text-[10px] text-zinc-600 mt-0.5">Histórico de créditos</p></div>
   {loading?<div className="py-12 text-center text-xs text-zinc-600">Carregando...</div>:transactions.length===0?<div className="py-12 flex flex-col items-center text-zinc-600"><FileText className="w-5 h-5 mb-2"/><span className="text-xs">Nenhuma movimentação ainda.</span></div>:<div className="overflow-x-auto"><table className="w-full text-[11px]"><thead className="text-zinc-600 border-b border-white/[0.05]"><tr><th className="text-left font-medium px-5 py-3">Data</th><th className="text-left font-medium px-3 py-3">Tipo</th><th className="text-right font-medium px-5 py-3">Créditos</th></tr></thead><tbody className="divide-y divide-white/[0.045]">{transactions.map(tx=><tr key={tx.transaction_id}><td className="px-5 py-3 text-zinc-500 whitespace-nowrap">{new Date(tx.created_at).toLocaleString('pt-BR')}</td><td className="px-3 py-3 text-zinc-300">{tx.type.replaceAll('_',' ')}</td><td className={`px-5 py-3 text-right font-semibold tabular-nums ${positive(tx.type)?'text-sky-300':'text-zinc-200'}`}><CreditAmount value={Math.abs(tx.amount_credits)} size="xs" prefix={positive(tx.type)?'+':'-'}/></td></tr>)}</tbody></table></div>}
  </div>

  {redeemOpen&&<div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#08131e] p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Resgatar código</h2><p className="text-[10px] text-zinc-500 mt-1">Códigos de crédito são aplicados diretamente à carteira.</p></div><button onClick={()=>setRedeemOpen(false)} className="p-2 text-zinc-600 hover:text-white"><X className="w-4 h-4"/></button></div><div className="mt-4 flex gap-2"><input autoFocus value={redeemCode} onChange={e=>setRedeemCode(e.target.value.toUpperCase())} placeholder="Digite seu código" className="flex-1 h-10 px-3 rounded-xl bg-white/[0.035] border border-white/[0.08] text-xs text-white uppercase outline-none focus:border-sky-300/40"/><button onClick={smartRedeem} disabled={redeemLoading||!redeemCode.trim()} className="ia-primary h-10 px-4 rounded-xl text-[10px] font-black disabled:opacity-40">{redeemLoading?<Loader2 className="w-4 h-4 animate-spin"/>:'Resgatar'}</button></div>{redeemMessage&&<div className="mt-3 p-3 rounded-xl border border-white/[0.07] bg-white/[0.03] text-[10px] text-zinc-300">{redeemMessage}</div>}</div></div>}

  {plansOpen&&<div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
   <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#07111b] shadow-[0_32px_100px_rgba(0,0,0,.65)]">
    <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-white/[0.06] bg-[#07111b]/95 backdrop-blur-xl flex items-start justify-between gap-4">
     <div><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-sky-300/10 border border-sky-300/15 grid place-items-center"><CreditCard className="w-4 h-4 text-sky-300"/></div><div><h2 className="text-[15px] font-black text-white">Planos IA Connect</h2><p className="text-[10px] text-zinc-500 mt-0.5">Assinatura mensal · cobrança recorrente pelo Mercado Pago</p></div></div></div>
     <button onClick={()=>{setPlansOpen(false);setMessage('')}} aria-label="Fechar planos" className="w-9 h-9 rounded-xl border border-white/[0.07] bg-white/[0.025] grid place-items-center text-zinc-500 hover:text-white"><X className="w-4 h-4"/></button>
    </div>

    <div className="p-4 sm:p-6">
     {active&&<div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Plano atual</p><p className="mt-1 text-[15px] font-black text-white">{subscription?.plan_name}</p><p className="mt-1 text-[9px] text-zinc-500">A troca de plano passa a valer na próxima cobrança. Seu saldo atual não é removido.</p></div><button onClick={cancelSubscription} disabled={actionLoading} className="h-9 rounded-xl border border-rose-300/15 bg-rose-400/[0.04] px-3 text-[9px] font-bold text-rose-200 disabled:opacity-40">Cancelar renovação</button></div>}
     {pending&&<div className="mb-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4"><p className="text-[10px] font-bold text-amber-200">Assinatura aguardando conclusão no Mercado Pago.</p>{subscription?.checkout_url&&<button onClick={()=>window.location.assign(subscription.checkout_url!)} className="mt-3 h-9 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 text-[9px] font-bold text-amber-100">Continuar checkout</button>}</div>}

     <div className="grid md:grid-cols-3 gap-3">
      {packs.map(pack=>{const selected=selectedPack?.pack_id===pack.pack_id&&selectedPack?.version===pack.version,unit=unitPerThousand(pack),saving=baselineUnit>0?Math.max(0,Math.round((1-unit/baselineUnit)*100)):0,best=unit===bestUnit&&packs.length>1,current=subscription?.pack_id===pack.pack_id&&active;return <button key={`${pack.pack_id}-${pack.version}`} onClick={()=>choosePack(pack)} className={`ia-wallet-pack group relative min-h-[238px] p-4 rounded-2xl border text-left transition-[border-color,background-color,box-shadow] ${selected?'border-sky-300/55 bg-gradient-to-br from-sky-300/[0.12] to-blue-500/[0.035] shadow-[0_0_0_1px_rgba(125,211,252,.08),0_16px_40px_rgba(0,0,0,.22)]':'border-white/[0.07] bg-white/[0.022] hover:border-white/[0.14] hover:bg-white/[0.035]'}`}>
       <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.08em] text-zinc-400">{pack.name}</p><p className="mt-2 text-[22px] font-black text-white">{formatCentsToBRL(pack.price_brl_cents)}<span className="ml-1 text-[9px] font-medium text-zinc-600">/mês</span></p><div className="mt-2"><CreditAmount value={pack.total_credits} size="sm" className="font-black text-sky-100"/></div></div>{current?<span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2 py-1 text-[7px] font-black uppercase text-emerald-300">Atual</span>:(pack.badge||best)?<span className="rounded-full bg-sky-300 px-2 py-1 text-[7px] font-black uppercase text-[#03121c]">{pack.badge||'Melhor custo'}</span>:null}</div>
       <p className="mt-3 min-h-[34px] text-[9px] leading-relaxed text-zinc-500">{pack.description}</p>
       <div className="mt-3 space-y-1.5">{pack.features.slice(0,3).map(feature=><div key={feature} className="flex items-start gap-1.5 text-[8px] leading-relaxed text-zinc-400"><Check className="mt-0.5 h-3 w-3 shrink-0 text-sky-300"/><span>{feature}</span></div>)}</div>
       <div className="mt-4 border-t border-white/[0.06] pt-3 flex items-center justify-between text-[8px] text-zinc-600"><span>{saving>0?`~${saving}% melhor custo`:'Preço base'}</span><span>{formatCentsToBRL(unit)} / 1.000</span></div>
      </button>})}
     </div>

     {selectedPack&&<div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0a1622] p-4">
      <div className="grid gap-3 sm:grid-cols-3">
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Plano escolhido</p><p className="mt-1 text-[12px] font-black text-white">{selectedPack.name}</p></div>
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Mensalidade</p><p className="mt-1 text-[12px] font-black text-white">{formatCentsToBRL(selectedPack.price_brl_cents)}</p></div>
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Todo ciclo</p><div className="mt-1"><CreditAmount value={selectedPack.total_credits} size="sm" className="font-black text-white"/></div></div>
      </div>
      {message&&<div className="mt-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] px-3 py-2 text-[9px] text-sky-100">{message}</div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
       <div className="flex items-start gap-2 text-[8px] leading-relaxed text-zinc-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300"/><span>O Mercado Pago gerencia o meio de pagamento e as cobranças recorrentes. Os créditos entram somente quando cada cobrança for confirmada.</span></div>
       {active?<button onClick={changePlan} disabled={actionLoading||samePlan} className="ia-primary h-11 shrink-0 rounded-xl px-5 text-[10px] font-black disabled:opacity-35">{actionLoading?<Loader2 className="w-4 h-4 animate-spin"/>:samePlan?'Plano atual':<>Trocar no próximo ciclo<CalendarClock className="ml-2 inline w-3.5 h-3.5"/></>}</button>:<button onClick={subscribe} disabled={actionLoading} className="ia-primary h-11 shrink-0 rounded-xl px-5 text-[10px] font-black flex items-center justify-center gap-2 disabled:opacity-40">{actionLoading?<Loader2 className="w-4 h-4 animate-spin"/>:<>Assinar {selectedPack.name}<ArrowRight className="w-3.5 h-3.5"/></>}</button>}
      </div>
     </div>}
    </div>
   </div>
  </div>}
 </div>;
};
