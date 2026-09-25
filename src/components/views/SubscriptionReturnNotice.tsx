import React from 'react';
import{ArrowRight,CircleCheck,CircleX,Clock3,Loader2,X}from'lucide-react';

export type SubscriptionReturnState={status:'SYNCING'|'ACTIVE'|'PENDING'|'FAILED';planName?:string;monthlyCredits?:number;checkoutUrl?:string;};

export const SubscriptionReturnNotice:React.FC<{
 state:SubscriptionReturnState;
 onDismiss:()=>void;
 onRefresh:()=>void;
 onOpenPlans:()=>void;
 onCreate:()=>void;
}> = ({state,onDismiss,onRefresh,onOpenPlans,onCreate})=>{
 const syncing=state.status==='SYNCING';
 const active=state.status==='ACTIVE';
 const pending=state.status==='PENDING';
 return <section className={`ia-subscription-return is-${state.status.toLowerCase()}`} aria-live="polite">
  <div className="ia-subscription-return-icon">
   {syncing?<Loader2 className="w-5 h-5 animate-spin"/>:active?<CircleCheck className="w-5 h-5"/>:pending?<Clock3 className="w-5 h-5"/>:<CircleX className="w-5 h-5"/>}
  </div>
  <div className="ia-subscription-return-copy">
   <span>{active?'Assinatura ativada':pending?'Confirmação em andamento':state.status==='FAILED'?'Não foi possível concluir':'Verificando assinatura'}</span>
   <h2>{active?`Plano ${state.planName||''} pronto para usar`:pending?'Estamos confirmando seu pagamento':state.status==='FAILED'?'Revise o pagamento e tente novamente':'Só um instante...'}</h2>
   <p>{active
    ?'Sua assinatura está ativa. O saldo é atualizado assim que a cobrança recorrente é confirmada pelo provedor de pagamento.'
    :pending
    ?'O pagamento ainda não recebeu confirmação final. Você pode aguardar alguns instantes ou continuar o checkout.'
    :state.status==='FAILED'
    ?'Nenhum crédito foi consumido por essa tentativa. Você pode verificar novamente ou iniciar um novo checkout.'
    :'Estamos sincronizando o status e atualizando sua carteira.'}</p>
  </div>
  <div className="ia-subscription-return-actions">
   {active&&<button type="button" onClick={onCreate} className="ia-subscription-return-primary">Começar a criar<ArrowRight className="w-3.5 h-3.5"/></button>}
   {pending&&state.checkoutUrl&&<button type="button" onClick={()=>window.location.assign(state.checkoutUrl!)} className="ia-subscription-return-primary">Continuar pagamento<ArrowRight className="w-3.5 h-3.5"/></button>}
   {(pending||state.status==='FAILED')&&<button type="button" onClick={onRefresh} className="ia-subscription-return-secondary">{state.status==='FAILED'?'Verificar novamente':'Atualizar status'}</button>}
   {state.status==='FAILED'&&<button type="button" onClick={onOpenPlans} className="ia-subscription-return-primary">Ver planos</button>}
   {!syncing&&<button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="ia-subscription-return-dismiss"><X className="w-4 h-4"/></button>}
  </div>
 </section>;
};
