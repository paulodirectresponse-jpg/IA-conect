import React,{useEffect,useState}from'react';
import{Wallet,RotateCcw,FileText,Plus,Check,X,Loader2,Tag,ShieldCheck,ArrowRight,CalendarClock,CreditCard,Sparkles,Images}from'lucide-react';
import{useAuth}from'../../context/AuthContext.js';
import{creditService}from'../../services/creditService.js';
import{subscriptionClient}from'../../services/subscriptionClient.js';
import{workspaceService}from'../../services/workspaceService.js';
import{CreditTransaction,PackVersion,UserSubscription,CreditWalletSummary}from'../../types/credits.js';
import{formatCentsToBRL}from'../../config/constants.js';
import{CreditAmount}from'../common/CreditAmount.js';

const unitPerThousand=(p:PackVersion)=>Math.round((p.price_brl_cents/Math.max(1,p.total_credits))*1000);
const statusLabel=(s?:string)=>s==='ACTIVE'?'Ativa':s==='PENDING'?'Aguardando ativação':s==='PAUSED'?'Pausada':s==='CANCELED'?'Cancelada':'Indisponível';
const positive=(t:string)=>['PURCHASE_ISSUE','PROMO_ISSUE','ADMIN_CREDIT','CREATOR_REWARD','MIGRATION_ISSUE','GENERATION_RELEASE'].includes(t);
const txLabel=(tx:CreditTransaction)=>{
 if(tx.type==='PURCHASE_ISSUE')return tx.metadata?.recurring?'Créditos do plano':'Compra de créditos';
 if(tx.type==='PROMO_ISSUE')return'Créditos promocionais';
 if(tx.type==='GENERATION_CAPTURE')return'Geração concluída';
 if(tx.type==='GENERATION_RELEASE')return'Estorno de geração';
 if(tx.type==='PAYMENT_REVERSAL')return'Estorno de pagamento';
 if(tx.type==='EXPIRE')return tx.reference_type==='SUBSCRIPTION_ROLLOVER'?'Ajuste de rollover':'Créditos expirados';
 if(tx.type==='ADMIN_CREDIT')return'Ajuste de crédito';
 if(tx.type==='ADMIN_DEBIT')return'Ajuste de débito';
 if(tx.type==='CREATOR_REWARD')return'Recompensa';
 if(tx.type==='MIGRATION_ISSUE')return'Saldo migrado';
 return tx.type.replaceAll('_',' ');
};

export const WalletView:React.FC=()=>{
 const{wallet,refreshWallet}=useAuth();
 const[transactions,setTransactions]=useState<CreditTransaction[]>([]);
 const[packs,setPacks]=useState<PackVersion[]>([]);
 const[subscription,setSubscription]=useState<UserSubscription|null>(null);
 const[summary,setSummary]=useState<CreditWalletSummary|null>(null);
 const[imagePrices,setImagePrices]=useState<number[]>([]);
 const[selectedPack,setSelectedPack]=useState<PackVersion|null>(null);
 const[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[plansOpen,setPlansOpen]=useState(false),[redeemOpen,setRedeemOpen]=useState(false),[redeemCode,setRedeemCode]=useState(''),[redeemLoading,setRedeemLoading]=useState(false),[redeemMessage,setRedeemMessage]=useState(''),[actionLoading,setActionLoading]=useState(false),[message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  try{
   const[t,p,s,w,m]=await Promise.all([creditService.listTransactions(50),creditService.listPacks(),subscriptionClient.getCurrent(),creditService.getSummary(),workspaceService.listModels().catch(()=>[])]);
   setTransactions(t.transactions);setPacks(p);setSubscription(s);setSummary(w);
   setImagePrices(m.filter(model=>model.category==='IMAGE'&&model.readiness==='READY'&&model.pricing_available&&Number(model.minimum_credit_price)>0).map(model=>Math.max(1,Math.ceil(Number(model.minimum_credit_price)))));
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
 const samePlan=Boolean(selectedPack&&subscription?.pack_id===selectedPack.pack_id&&subscription?.pack_version===selectedPack.version&&!subscription?.pending_plan_change);
 const visibleTransactions=transactions.filter(tx=>tx.type!=='GENERATION_RESERVE');
 const rolloverCap=subscription?subscription.monthly_credits*(summary?.rollover_multiplier||2):0;
 const imageEstimate=(pack:PackVersion)=>{
  if(!imagePrices.length)return null;
  const min=Math.min(...imagePrices),max=Math.max(...imagePrices);
  const lower=Math.max(1,Math.floor(pack.total_credits/max)),upper=Math.max(lower,Math.floor(pack.total_credits/min));
  return lower===upper?`≈ ${upper.toLocaleString('pt-BR')} imagens`:`≈ ${lower.toLocaleString('pt-BR')}–${upper.toLocaleString('pt-BR')} imagens`;
 };
 const planAudience=(id:string)=>id==='creator'?'Para começar':id==='pro'?'Para criar toda semana':'Para alto volume';
 const planTone=(id:string)=>id==='pro'?'is-recommended':'';


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

  {summary&&<div className="grid gap-2 sm:grid-cols-4">
   <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-[8px] uppercase tracking-wider text-zinc-600">Do plano</p><div className="mt-1"><CreditAmount value={summary.subscription_credits} size="sm" className="font-bold text-white"/></div></div>
   <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-[8px] uppercase tracking-wider text-zinc-600">Promocionais</p><div className="mt-1"><CreditAmount value={summary.promotional_credits} size="sm" className="font-bold text-white"/></div></div>
   <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-[8px] uppercase tracking-wider text-zinc-600">Outros saldos</p><div className="mt-1"><CreditAmount value={summary.other_credits} size="sm" className="font-bold text-white"/></div></div>
   <div className="rounded-xl border border-sky-300/10 bg-sky-300/[0.035] p-3"><p className="text-[8px] uppercase tracking-wider text-sky-300/70">Rollover do plano</p><p className="mt-1 text-[10px] font-bold text-sky-100">{subscription&&subscription.status==='ACTIVE'?<>até <CreditAmount value={rolloverCap} size="xs" className="font-bold text-sky-100"/></>:'Ativa com assinatura'}</p><p className="mt-1 text-[8px] text-zinc-600">Máximo de {summary.rollover_multiplier}× a franquia mensal recorrente.</p></div>
  </div>}

  <div className="rounded-2xl border border-white/[0.07] bg-[#08131e] overflow-hidden">
   <div className="px-5 py-4 border-b border-white/[0.06]"><h2 className="text-sm font-semibold">Movimentações</h2><p className="text-[10px] text-zinc-600 mt-0.5">Histórico de créditos</p></div>
   {loading?<div className="py-12 text-center text-xs text-zinc-600">Carregando...</div>:visibleTransactions.length===0?<div className="py-12 flex flex-col items-center text-zinc-600"><FileText className="w-5 h-5 mb-2"/><span className="text-xs">Nenhuma movimentação ainda.</span></div>:<div className="overflow-x-auto"><table className="w-full text-[11px]"><thead className="text-zinc-600 border-b border-white/[0.05]"><tr><th className="text-left font-medium px-5 py-3">Data</th><th className="text-left font-medium px-3 py-3">Tipo</th><th className="text-right font-medium px-5 py-3">Créditos</th></tr></thead><tbody className="divide-y divide-white/[0.045]">{visibleTransactions.map(tx=><tr key={tx.transaction_id}><td className="px-5 py-3 text-zinc-500 whitespace-nowrap">{new Date(tx.created_at).toLocaleString('pt-BR')}</td><td className="px-3 py-3 text-zinc-300"><div className="font-medium">{txLabel(tx)}</div>{tx.type==='EXPIRE'&&tx.metadata?.reason==='ROLLOVER_CAP'&&<div className="mt-0.5 text-[8px] text-zinc-600">Limite de acúmulo da assinatura</div>}</td><td className={`px-5 py-3 text-right font-semibold tabular-nums ${positive(tx.type)?'text-sky-300':'text-zinc-200'}`}><CreditAmount value={Math.abs(tx.amount_credits)} size="xs" prefix={positive(tx.type)?'+':'-'}/></td></tr>)}</tbody></table></div>}
  </div>

  {redeemOpen&&<div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#08131e] p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Resgatar código</h2><p className="text-[10px] text-zinc-500 mt-1">Códigos de crédito são aplicados diretamente à carteira.</p></div><button onClick={()=>setRedeemOpen(false)} className="p-2 text-zinc-600 hover:text-white"><X className="w-4 h-4"/></button></div><div className="mt-4 flex gap-2"><input autoFocus value={redeemCode} onChange={e=>setRedeemCode(e.target.value.toUpperCase())} placeholder="Digite seu código" className="flex-1 h-10 px-3 rounded-xl bg-white/[0.035] border border-white/[0.08] text-xs text-white uppercase outline-none focus:border-sky-300/40"/><button onClick={smartRedeem} disabled={redeemLoading||!redeemCode.trim()} className="ia-primary h-10 px-4 rounded-xl text-[10px] font-black disabled:opacity-40">{redeemLoading?<Loader2 className="w-4 h-4 animate-spin"/>:'Resgatar'}</button></div>{redeemMessage&&<div className="mt-3 p-3 rounded-xl border border-white/[0.07] bg-white/[0.03] text-[10px] text-zinc-300">{redeemMessage}</div>}</div></div>}

  {plansOpen&&<div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
   <div className="ia-plans-dialog w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[24px] border">
    <div className="ia-plans-header sticky top-0 z-10 px-5 sm:px-7 py-5 flex items-start justify-between gap-4">
     <div className="min-w-0">
      <div className="ia-plans-eyebrow"><Sparkles className="w-3.5 h-3.5"/> Planos IA Connect</div>
      <h2 className="ia-plans-title">Escolha o plano para o seu ritmo de criação</h2>
      <p className="ia-plans-subtitle">Assinatura mensal com um único saldo e acesso aos modelos disponíveis no estúdio. Você escolhe quanto quer produzir por mês.</p>
     </div>
     <button onClick={()=>{setPlansOpen(false);setMessage('')}} aria-label="Fechar planos" className="ia-plans-close"><X className="w-4 h-4"/></button>
    </div>

    <div className="p-4 sm:p-6">
     {active&&<div className="ia-plan-current-banner mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-wider">Plano atual</p><p className="mt-1 text-[15px] font-black text-white">{subscription?.plan_name}</p><p className="mt-1 text-[9px] text-zinc-500">A troca de plano passa a valer na próxima cobrança. Seu saldo atual continua disponível; na renovação, o saldo recorrente respeita o limite de 2× a franquia mensal.</p></div><button onClick={cancelSubscription} disabled={actionLoading} className="h-9 rounded-xl border border-rose-300/15 bg-rose-400/[0.04] px-3 text-[9px] font-bold text-rose-200 disabled:opacity-40">Cancelar renovação</button></div>}
     {pending&&<div className="mb-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4"><p className="text-[10px] font-bold text-amber-200">Assinatura aguardando conclusão no Mercado Pago.</p>{subscription?.checkout_url&&<button onClick={()=>window.location.assign(subscription.checkout_url!)} className="mt-3 h-9 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 text-[9px] font-bold text-amber-100">Continuar checkout</button>}</div>}

     <div className="ia-plan-grid">
      {packs.map(pack=>{const selected=selectedPack?.pack_id===pack.pack_id&&selectedPack?.version===pack.version,unit=unitPerThousand(pack),saving=baselineUnit>0?Math.max(0,Math.round((1-unit/baselineUnit)*100)):0,current=subscription?.pack_id===pack.pack_id&&subscription?.pack_version===pack.version&&active,estimate=imageEstimate(pack);return <button key={`${pack.pack_id}-${pack.version}`} onClick={()=>choosePack(pack)} className={`ia-plan-card ${selected?'is-selected':''} ${planTone(pack.pack_id)}`}>
       <div className="ia-plan-card-top">
        <div>
         <div className="ia-plan-audience">{planAudience(pack.pack_id)}</div>
         <h3>{pack.name}</h3>
        </div>
        {current?<span className="ia-plan-badge is-current">Plano atual</span>:pack.recommended?<span className="ia-plan-badge">Mais escolhido</span>:pack.pack_id==='studio'?<span className="ia-plan-badge is-subtle">Maior volume</span>:null}
       </div>
       <div className="ia-plan-price"><strong>{formatCentsToBRL(pack.price_brl_cents)}</strong><span>/mês</span></div>
       <div className="ia-plan-credits"><CreditAmount value={pack.total_credits} size="md" className="font-black"/></div>
       <p className="ia-plan-description">{pack.description}</p>
       <div className="ia-plan-estimate"><Images className="w-4 h-4"/><div><span>Estimativa com imagens</span><strong>{estimate||'calculando preços atuais...'}</strong></div></div>
       <div className="ia-plan-features">{pack.features.slice(0,3).map(feature=><div key={feature}><Check className="w-3.5 h-3.5"/><span>{feature}</span></div>)}</div>
       <div className="ia-plan-economics"><span>{saving>0?`${saving}% melhor custo que o Creator`:'Referência do plano'}</span><strong>{formatCentsToBRL(unit)} / 1.000</strong></div>
      </button>})}
     </div>

     <section className="ia-plan-comparison">
      <div className="ia-plan-comparison-heading">
       <div><span>Compare antes de assinar</span><h3>O que muda entre os planos</h3></div>
       <p>Todos usam a mesma carteira e têm acesso aos modelos disponíveis. O volume mensal é a principal diferença.</p>
      </div>
      <div className="ia-plan-comparison-table">
       <div className="ia-plan-comparison-row is-head"><div>Benefício</div>{packs.map(pack=><div key={pack.pack_id}>{pack.name}</div>)}</div>
       <div className="ia-plan-comparison-row"><div>Créditos por mês</div>{packs.map(pack=><div key={pack.pack_id}><CreditAmount value={pack.total_credits} size="xs" className="font-bold"/></div>)}</div>
       <div className="ia-plan-comparison-row"><div>Modelos disponíveis</div>{packs.map(pack=><div key={pack.pack_id}><Check className="ia-compare-check"/> Todos</div>)}</div>
       <div className="ia-plan-comparison-row"><div>Saldo único entre categorias</div>{packs.map(pack=><div key={pack.pack_id}><Check className="ia-compare-check"/> Sim</div>)}</div>
       <div className="ia-plan-comparison-row"><div>Rollover máximo</div>{packs.map(pack=><div key={pack.pack_id}><CreditAmount value={pack.total_credits*2} size="xs" className="font-bold"/></div>)}</div>
       <div className="ia-plan-comparison-row"><div>Estimativa de imagens/mês</div>{packs.map(pack=><div key={pack.pack_id}>{imageEstimate(pack)||'—'}</div>)}</div>
       <div className="ia-plan-comparison-row"><div>Custo efetivo por 1.000 créditos</div>{packs.map(pack=><div key={pack.pack_id}>{formatCentsToBRL(unitPerThousand(pack))}</div>)}</div>
      </div>
      <p className="ia-plan-estimate-note">Estimativas usam os preços mínimos atuais dos modelos de imagem READY. O mesmo saldo pode ser usado nas categorias disponíveis no catálogo; o consumo varia por modelo, resolução, quantidade e parâmetros.</p>
     </section>

     {selectedPack&&<div className="ia-plan-checkout">
      <div className="grid gap-3 sm:grid-cols-3">
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Plano escolhido</p><p className="mt-1 text-[12px] font-black text-white">{selectedPack.name}</p></div>
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Mensalidade</p><p className="mt-1 text-[12px] font-black text-white">{formatCentsToBRL(selectedPack.price_brl_cents)}</p></div>
       <div><p className="text-[8px] uppercase tracking-wider text-zinc-600">Todo ciclo</p><div className="mt-1"><CreditAmount value={selectedPack.total_credits} size="sm" className="font-black text-white"/></div></div>
      </div>
      {message&&<div className="mt-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] px-3 py-2 text-[9px] text-sky-100">{message}</div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
       <div className="ia-plan-security"><ShieldCheck className="h-4 w-4 shrink-0"/><span>Cobrança mensal segura. Os créditos entram após a confirmação do pagamento e o saldo recorrente pode acumular até 2× a franquia do plano.</span></div>
       {active?<button onClick={changePlan} disabled={actionLoading||samePlan} className="ia-primary h-11 shrink-0 rounded-xl px-5 text-[10px] font-black disabled:opacity-35">{actionLoading?<Loader2 className="w-4 h-4 animate-spin"/>:samePlan?'Plano atual':<>Trocar no próximo ciclo<CalendarClock className="ml-2 inline w-3.5 h-3.5"/></>}</button>:<button onClick={subscribe} disabled={actionLoading} className="ia-primary h-11 shrink-0 rounded-xl px-5 text-[10px] font-black flex items-center justify-center gap-2 disabled:opacity-40">{actionLoading?<Loader2 className="w-4 h-4 animate-spin"/>:<>Assinar {selectedPack.name}<ArrowRight className="w-3.5 h-3.5"/></>}</button>}
      </div>
     </div>}
    </div>
   </div>
  </div>}
 </div>;
};
