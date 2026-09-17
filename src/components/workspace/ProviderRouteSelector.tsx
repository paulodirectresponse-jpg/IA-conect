import React from 'react';
import {Route,ShieldCheck} from 'lucide-react';

export interface ProviderRouteOption{provider_id:string;provider_name:string;}
interface Props{providers:ProviderRouteOption[];selectedProviderId:string;onChange:(providerId:string)=>void;modelName?:string;disabled?:boolean;}

export const ProviderRouteSelector:React.FC<Props>=({providers,selectedProviderId,onChange,modelName,disabled=false})=>{
 const ready=providers.length>0;
 return <section className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-2.5">
  <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.04] grid place-items-center text-cyan-300"><Route className="w-3.5 h-3.5"/></span><div className="min-w-0"><p className="text-[10px] font-semibold text-zinc-300">Provider</p><p className="text-[8px] text-zinc-700 truncate">{modelName||'Modelo selecionado'} · somente rotas verificadas</p></div>{ready&&<ShieldCheck className="ml-auto w-3.5 h-3.5 text-emerald-300"/>}</div>
  <select value={ready?selectedProviderId:'AUTO'} disabled={disabled||!ready} onChange={e=>onChange(e.target.value)} className="mt-2 w-full h-9 rounded-lg border border-white/[0.07] bg-[#0b0e13] px-2.5 text-[9px] font-semibold text-zinc-300 outline-none disabled:opacity-40">
   {ready?<><option value="AUTO">AUTO · mais econômico/saudável</option>{providers.map(provider=><option key={provider.provider_id} value={provider.provider_id}>{provider.provider_name}</option>)}</>:<option value="AUTO">Nenhum provider verificado</option>}
  </select>
  <p className={`mt-2 text-[8px] leading-relaxed ${ready?'text-zinc-600':'text-amber-300'}`}>{ready?(selectedProviderId==='AUTO'?'O IA Conect escolhe a rota segura com menor custo entre os providers disponíveis.':'O provider escolhido ainda passa por saldo, preço e limite de COGS antes da execução.'):'Este modelo não tem mapping + credencial + preço verificado. Ele não deve gerar até a rota ser validada.'}</p>
 </section>;
};
