import React,{useEffect,useRef,useState}from 'react';
import { ArrowRight } from 'lucide-react';

const SHOWCASE_STORAGE_BASE='https://hzjyhhenajbjxkwkmzdg.supabase.co/storage/v1/object/public/ia-conect-assets/showcase';
export const showcaseVideo=(fileName:string)=>`${SHOWCASE_STORAGE_BASE}/${encodeURIComponent(fileName)}`;
export interface ShowcaseItem {
  modelId:string;
  name:string;
  mode:'VIDEO'|'IMAGE';
  videoSrc:string;
  sourceLabel:string;
  headline:string;
  description:string;
  badges:string[];
  availableInStudio:boolean;
}

export const SHOWCASE_MODELS:ShowcaseItem[]=[
  {modelId:'kling-3-0',name:'Kling 3.0',mode:'VIDEO',videoSrc:showcaseVideo('Kling.mp4'),sourceLabel:'IA Connect showcase',headline:'Personagens, acting e movimento cinematográfico',description:'Movimento natural, direção de câmera e takes com acabamento cinematográfico.',badges:['cinematográfico','personagens','vídeo'],availableInStudio:true},
  {modelId:'google-omni-flash',name:'Omni Flash',mode:'VIDEO',videoSrc:showcaseVideo('Omni flash.mp4'),sourceLabel:'IA Connect showcase',headline:'Vídeo multimodal com velocidade e qualidade',description:'Transforme texto, imagem e referências em um fluxo de criação multimodal.',badges:['multimodal','áudio','vídeo'],availableInStudio:true},
  {modelId:'seedance-2-5',name:'Seedance 2.5',mode:'VIDEO',videoSrc:showcaseVideo('Seedance 2.5.mp4'),sourceLabel:'IA Connect showcase',headline:'Cenas longas e consistência visual',description:'Geração cinematográfica multimodal com áudio nativo e referências densas.',badges:['consistência','cenas','vídeo'],availableInStudio:true},
  {modelId:'wan-3-0',name:'WAN 3.0',mode:'VIDEO',videoSrc:showcaseVideo('Wan 3.0.mp4'),sourceLabel:'IA Connect showcase',headline:'Realismo cinematográfico e referências',description:'Vídeo all-in-one com ótimo custo-benefício, áudio e referências.',badges:['realismo','referências','vídeo'],availableInStudio:true},
  {modelId:'wan-3-0-prime',name:'WAN 3.0 Prime',mode:'VIDEO',videoSrc:showcaseVideo('Wan 3.0 prime.mp4'),sourceLabel:'IA Connect showcase',headline:'Qualidade premium para takes finais',description:'Modelo premium all-in-one com áudio nativo, referências multimodais e até 30s.',badges:['premium','referências','vídeo'],availableInStudio:true},
];

const AutoLoopPreview:React.FC<{item:ShowcaseItem}>=({item})=>{
 const ref=useRef<HTMLVideoElement|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const video=ref.current;if(!video)return;video.muted=true;video.defaultMuted=true;const tryPlay=()=>void video.play().catch(()=>{});tryPlay();video.addEventListener('canplay',tryPlay);return()=>video.removeEventListener('canplay',tryPlay)},[item.videoSrc]);
 if(failed)return <div className="absolute inset-0 grid place-items-center bg-[#050b12] px-4 text-center"><p className="text-[9px] font-semibold text-zinc-600">Prévia temporariamente indisponível</p></div>;
 return <video ref={ref} className="absolute inset-0 w-full h-full object-cover" src={item.videoSrc} autoPlay muted loop playsInline preload="metadata" disablePictureInPicture onError={()=>setFailed(true)}/>;
};

export const ModelShowcase:React.FC<{compact?:boolean;onTry?:(item:ShowcaseItem)=>void;title?:string;subtitle?:string}> = ({compact=false,onTry,title='Modelos em destaque',subtitle='Veja os resultados em movimento e entre direto no modelo certo.'}) => <section className="ia-model-showcase">
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-sky-300">Model discovery</p><h2 className={`${compact?'text-xl':'text-3xl sm:text-4xl'} mt-2 font-black tracking-[-.04em] text-white`}>{title}</h2><p className="mt-2 max-w-2xl text-[11px] sm:text-sm leading-relaxed text-zinc-500">{subtitle}</p></div></div>
  <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-5 gap-3">
    {SHOWCASE_MODELS.map(item=><article key={item.modelId} className="group overflow-hidden rounded-2xl border border-sky-300/[0.1] bg-[#07111b] hover:border-sky-300/[0.24] transition-[border-color,transform] duration-200 hover:-translate-y-0.5">
      <div className="relative aspect-video bg-[#050b12] overflow-hidden"><AutoLoopPreview item={item}/><div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#03080d]/75 via-transparent to-transparent"/><div className="absolute left-2 bottom-2 pointer-events-none"><span className="px-2 py-1 rounded-lg bg-[#03080d]/70 backdrop-blur border border-sky-300/[0.12] text-[8px] font-black text-white">{item.name}</span></div></div>
      <div className="p-3"><h3 className="text-[11px] font-black text-white leading-tight">{item.headline}</h3><p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500 line-clamp-2">{item.description}</p><div className="mt-2 flex gap-1 flex-wrap">{item.badges.slice(0,2).map(b=><span key={b} className="px-1.5 py-0.5 rounded-md border border-sky-300/[0.08] bg-sky-300/[0.03] text-[8px] font-semibold text-zinc-500">{b}</span>)}</div>{onTry&&<button onClick={()=>onTry(item)} className="mt-3 h-8 px-2.5 rounded-lg ia-primary text-[8px] font-black inline-flex items-center gap-1.5">Testar modelo<ArrowRight className="w-3 h-3"/></button>}</div>
    </article>)}
  </div>
</section>;
