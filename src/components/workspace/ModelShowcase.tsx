import React from 'react';
import { ArrowRight, ExternalLink, PlayCircle } from 'lucide-react';

export interface ShowcaseItem {
  modelId:string;
  name:string;
  mode:'VIDEO'|'IMAGE';
  youtubeId?:string;
  youtubeStart?:number;
  sourceLabel:string;
  headline:string;
  description:string;
  badges:string[];
}

export const SHOWCASE_MODELS:ShowcaseItem[]=[
  {modelId:'kling-3-0',name:'Kling 3.0',mode:'VIDEO',youtubeId:'BOlFslVqujg',youtubeStart:35,sourceLabel:'Theoretically Media',headline:'Personagens, acting e movimento cinematográfico',description:'Demonstração pública com exemplos reais do Kling 3.0. O player já começa depois da abertura para chegar mais rápido aos resultados.',badges:['15s','cinematográfico','personagens']},
  {modelId:'seedance-2-5',name:'Seedance 2.5',mode:'VIDEO',youtubeId:'PSIjAlK_5to',youtubeStart:31,sourceLabel:'CapCut / demonstração pública',headline:'Cenas longas, anúncios e consistência visual',description:'Exemplo público de Seedance 2.5 com foco em criação cinematográfica. Começa já na parte prática, sem introdução longa.',badges:['até 30s','áudio','multimodal']},
  {modelId:'google-omni-flash',name:'Google Omni Flash',mode:'VIDEO',youtubeId:'KUyRq7szZsM',youtubeStart:5,sourceLabel:'Google',headline:'Vídeo multimodal com edição e áudio nativo',description:'Demonstração oficial do Gemini Omni, publicada pelo Google, mostrando geração e transformação de vídeo.',badges:['oficial','multimodal','áudio']},
  {modelId:'wan-3-0',name:'WAN 3.0',mode:'VIDEO',sourceLabel:'Alibaba / comunidade',headline:'Até 30 segundos em uma única geração',description:'WAN 3.0 une texto, imagem e referências em um fluxo de vídeo longo. O card já está pronto para receber um clipe oficial dedicado.',badges:['até 30s','1080p','referências']},
];

const youtubeWatch=(id:string,start=0)=>`https://www.youtube.com/watch?v=${id}${start?`&t=${start}s`:''}`;

export const ModelShowcase:React.FC<{compact?:boolean;onTry?:(item:ShowcaseItem)=>void;title?:string;subtitle?:string}> = ({compact=false,onTry,title='Veja o que cada modelo consegue fazer',subtitle='Exemplos públicos selecionados para você comparar resultado antes de gastar crédito.'}) => <section>
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Model discovery</p><h2 className={`${compact?'text-xl':'text-3xl sm:text-4xl'} mt-2 font-black tracking-[-.04em] text-white`}>{title}</h2><p className="mt-2 max-w-2xl text-[11px] sm:text-sm leading-relaxed text-zinc-500">{subtitle}</p></div></div>
  <div className={`mt-5 grid ${compact?'md:grid-cols-2 xl:grid-cols-3':'md:grid-cols-2'} gap-4`}>
    {SHOWCASE_MODELS.map(item=><article key={item.modelId} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1118] hover:border-white/[0.14] transition-colors">
      <div className="relative aspect-video bg-[#080b10] overflow-hidden">
        {item.youtubeId?<iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?start=${item.youtubeStart||0}&rel=0&modestbranding=1`} title={`${item.name} demo`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(34,211,238,.18),transparent_24%),radial-gradient(circle_at_35%_70%,rgba(124,58,237,.22),transparent_26%),#090c11] grid place-items-center"><div className="text-center"><PlayCircle className="w-10 h-10 mx-auto text-zinc-600"/><p className="mt-2 text-[10px] font-bold text-zinc-500">Demo dedicada em curadoria</p></div></div>}
        <div className="absolute left-2 top-2 pointer-events-none"><span className="px-2 py-1 rounded-full bg-black/70 backdrop-blur border border-white/10 text-[8px] font-black text-white">{item.name}</span></div>
      </div>
      <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[8px] uppercase tracking-[.14em] font-bold text-zinc-600">Fonte · {item.sourceLabel}</p><h3 className="mt-1.5 text-sm font-black text-white">{item.headline}</h3><p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">{item.description}</p></div></div><div className="mt-3 flex items-center gap-1.5 flex-wrap">{item.badges.map(b=><span key={b} className="px-2 py-1 rounded-full border border-white/[0.07] bg-white/[0.025] text-[8px] font-semibold text-zinc-500">{b}</span>)}</div><div className="mt-4 flex items-center gap-2">{onTry&&<button onClick={()=>onTry(item)} className="h-9 px-3 rounded-xl bg-white text-black text-[9px] font-black inline-flex items-center gap-1.5">Testar {item.name}<ArrowRight className="w-3 h-3"/></button>}{item.youtubeId&&<a href={youtubeWatch(item.youtubeId,item.youtubeStart)} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[9px] font-semibold text-zinc-400 hover:text-white inline-flex items-center gap-1.5">Ver no YouTube<ExternalLink className="w-3 h-3"/></a>}</div></div>
    </article>)}
  </div>
  <p className="mt-3 text-[8px] leading-relaxed text-zinc-700">Os vídeos são incorporados do YouTube e permanecem hospedados pelos respectivos publicadores. A IA Connect não reenvia nem reivindica autoria sobre esse material.</p>
</section>;
