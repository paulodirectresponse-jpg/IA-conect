import React,{useState}from 'react';
import { ArrowRight } from 'lucide-react';

const imageMedia=(key:string)=>`https://hzjyhhenajbjxkwkmzdg.supabase.co/functions/v1/showcase-media?key=${key}`;
export interface ShowcaseItem {
  modelId:string;
  name:string;
  mode:'VIDEO'|'IMAGE';
  videoSrc:string;
  youtubeId?:string;
  fallbackImage:string;
  sourceLabel:string;
  headline:string;
  description:string;
  badges:string[];
  availableInStudio:boolean;
}

export const SHOWCASE_MODELS:ShowcaseItem[]=[
  {modelId:'kling-3.0',name:'Kling 3.0',mode:'VIDEO',videoSrc:'/media/showcase/kling-3.mp4',youtubeId:'BOlFslVqujg',fallbackImage:imageMedia('character'),sourceLabel:'IA Connect showcase',headline:'Personagens, acting e movimento cinematográfico',description:'Movimento natural, direção de câmera e takes com acabamento cinematográfico.',badges:['cinematográfico','personagens','vídeo'],availableInStudio:true},
  {modelId:'gemini-omni-flash',name:'Omni Flash',mode:'VIDEO',videoSrc:'/media/showcase/omni-flash.mp4',youtubeId:'KUyRq7szZsM',fallbackImage:imageMedia('cgi'),sourceLabel:'IA Connect showcase',headline:'Vídeo multimodal com velocidade e qualidade',description:'Transforme texto, imagem e referências em um fluxo de criação multimodal.',badges:['multimodal','áudio','vídeo'],availableInStudio:true},
  {modelId:'seedance-2.5',name:'Seedance 2.5',mode:'VIDEO',videoSrc:'/media/showcase/seedance-2-5.mp4',youtubeId:'PSIjAlK_5to',fallbackImage:imageMedia('toy'),sourceLabel:'IA Connect showcase',headline:'Cenas longas e consistência visual',description:'Demonstração selecionada para comparar linguagem, ritmo e continuidade.',badges:['consistência','cenas','vídeo'],availableInStudio:false},
  {modelId:'wan-3.0',name:'WAN 3.0',mode:'VIDEO',videoSrc:'/media/showcase/wan-3.mp4',fallbackImage:imageMedia('anime'),sourceLabel:'IA Connect showcase',headline:'Realismo cinematográfico e referências',description:'Exemplo de geração para comparar textura, composição e movimento.',badges:['realismo','referências','vídeo'],availableInStudio:false},
  {modelId:'wan-3.0-prime',name:'WAN 3.0 Prime',mode:'VIDEO',videoSrc:'/media/showcase/wan-3-prime.mp4',fallbackImage:imageMedia('scifi'),sourceLabel:'IA Connect showcase',headline:'Uma variação premium para comparação',description:'Um segundo resultado do ecossistema WAN para ampliar a descoberta visual.',badges:['premium','comparação','vídeo'],availableInStudio:false},
];

const AutoLoopPreview:React.FC<{item:ShowcaseItem}>=({item})=>{
 const[failed,setFailed]=useState(false);
 if(!failed)return <video className="absolute inset-0 w-full h-full object-cover scale-[1.01]" src={item.videoSrc} autoPlay muted loop playsInline preload="metadata" disablePictureInPicture onError={()=>setFailed(true)}/>;
 if(item.youtubeId)return <iframe title={`${item.name} demo`} className="absolute inset-0 w-full h-full scale-[1.18] pointer-events-none" src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${item.youtubeId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin"/>;
 return <img src={item.fallbackImage} alt="" className="absolute inset-0 w-full h-full object-cover motion-safe:animate-[pulse_6s_ease-in-out_infinite]"/>;
};

export const ModelShowcase:React.FC<{compact?:boolean;onTry?:(item:ShowcaseItem)=>void;title?:string;subtitle?:string}> = ({compact=false,onTry,title='Modelos em destaque',subtitle='Veja os resultados em movimento e entre direto no modelo certo.'}) => <section>
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-sky-300">Model discovery</p><h2 className={`${compact?'text-xl':'text-3xl sm:text-4xl'} mt-2 font-black tracking-[-.04em] text-white`}>{title}</h2><p className="mt-2 max-w-2xl text-[11px] sm:text-sm leading-relaxed text-zinc-500">{subtitle}</p></div></div>
  <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-5 gap-3">
    {SHOWCASE_MODELS.map(item=><article key={item.modelId} className="group overflow-hidden rounded-2xl border border-sky-300/[0.1] bg-[#07111b] hover:border-sky-300/[0.24] transition-all hover:-translate-y-0.5">
      <div className="relative aspect-video bg-[#050b12] overflow-hidden">
        <AutoLoopPreview item={item}/>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#03080d]/75 via-transparent to-transparent"/>
        <div className="absolute left-2 bottom-2 pointer-events-none"><span className="px-2 py-1 rounded-lg bg-[#03080d]/70 backdrop-blur border border-sky-300/[0.12] text-[8px] font-black text-white">{item.name}</span></div>
      </div>
      <div className="p-3"><h3 className="text-[11px] font-black text-white leading-tight">{item.headline}</h3><p className="mt-1.5 text-[9px] leading-relaxed text-zinc-500 line-clamp-2">{item.description}</p><div className="mt-2 flex gap-1 flex-wrap">{item.badges.slice(0,2).map(b=><span key={b} className="px-1.5 py-0.5 rounded-md border border-sky-300/[0.08] bg-sky-300/[0.03] text-[7px] font-semibold text-zinc-500">{b}</span>)}</div>{onTry&&item.availableInStudio&&<button onClick={()=>onTry(item)} className="mt-3 h-8 px-2.5 rounded-lg ia-primary text-[8px] font-black inline-flex items-center gap-1.5">Testar modelo<ArrowRight className="w-3 h-3"/></button>}{!item.availableInStudio&&<p className="mt-3 text-[8px] font-semibold text-sky-300/70">Showcase · integração em breve</p>}</div>
    </article>)}
  </div>
</section>;
