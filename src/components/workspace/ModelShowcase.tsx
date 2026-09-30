import React,{useState}from 'react';
import { ArrowRight,Play } from 'lucide-react';
import { showcaseVideoUrl } from '../../utils/showcaseMedia.js';
export interface ShowcaseItem {
  modelId:string;
  name:string;
  mode:'VIDEO'|'IMAGE';
  videoSrc:string;
  posterSrc:string;
  sourceLabel:string;
  headline:string;
  description:string;
  badges:string[];
  availableInStudio:boolean;
}

export const SHOWCASE_MODELS:ShowcaseItem[]=[
  {modelId:'kling-3-0',name:'Kling 3.0',mode:'VIDEO',videoSrc:showcaseVideoUrl('Kling.mp4'),posterSrc:'/model-covers/kling-3-0.webp',sourceLabel:'IA Connect showcase',headline:'Personagens, acting e movimento cinematográfico',description:'Movimento natural, direção de câmera e takes com acabamento cinematográfico.',badges:['cinematográfico','personagens','vídeo'],availableInStudio:true},
  {modelId:'google-omni-flash',name:'Omni Flash',mode:'VIDEO',videoSrc:showcaseVideoUrl('Omni flash.mp4'),posterSrc:'/model-covers/google-omni-flash.webp',sourceLabel:'IA Connect showcase',headline:'Vídeo multimodal com velocidade e qualidade',description:'Transforme texto, imagem e referências em um fluxo de criação multimodal.',badges:['multimodal','áudio','vídeo'],availableInStudio:true},
  {modelId:'seedance-2-5',name:'Seedance 2.5',mode:'VIDEO',videoSrc:showcaseVideoUrl('Seedance 2.5.mp4'),posterSrc:'/model-covers/seedance-2-5.webp',sourceLabel:'IA Connect showcase',headline:'Cenas longas e consistência visual',description:'Geração cinematográfica multimodal com áudio nativo e referências densas.',badges:['consistência','cenas','vídeo'],availableInStudio:true},
  {modelId:'wan-3-0',name:'WAN 3.0',mode:'VIDEO',videoSrc:showcaseVideoUrl('Wan 3.0.mp4'),posterSrc:'/model-covers/wan-3-0.webp',sourceLabel:'IA Connect showcase',headline:'Realismo cinematográfico e referências',description:'Vídeo all-in-one com ótimo custo-benefício, áudio e referências.',badges:['realismo','referências','vídeo'],availableInStudio:true},
  {modelId:'wan-3-0-prime',name:'WAN 3.0 Prime',mode:'VIDEO',videoSrc:showcaseVideoUrl('Wan 3.0 prime.mp4'),posterSrc:'/model-covers/wan-3-0-prime.webp',sourceLabel:'IA Connect showcase',headline:'Qualidade premium para takes finais',description:'Modelo premium all-in-one com áudio nativo, referências multimodais e até 30s.',badges:['premium','referências','vídeo'],availableInStudio:true},
];

const OnDemandPreview:React.FC<{item:ShowcaseItem}>=({item})=>{
 const[requested,setRequested]=useState(false),[failed,setFailed]=useState(false);
 if(requested&&!failed)return <video autoPlay controls muted playsInline preload="none" src={item.videoSrc} poster={item.posterSrc} aria-label={`Prévia em vídeo de ${item.name}`} onError={()=>setFailed(true)} className="absolute inset-0 h-full w-full object-cover"/>;
 return <button type="button" onClick={()=>{if(failed)setFailed(false);setRequested(true)}} aria-label={`Assistir prévia de ${item.name}`} className="ia-model-showcase-preview absolute inset-0 h-full w-full">
  <img src={item.posterSrc} alt={`Prévia de ${item.name}`} decoding="async" className="absolute inset-0 h-full w-full object-cover"/>
  <span className="ia-model-showcase-preview-action"><Play className="h-4 w-4 fill-current"/>{failed?'Tentar novamente':'Assistir prévia'}</span>
 </button>;
};

export const ModelShowcase:React.FC<{compact?:boolean;onTry?:(item:ShowcaseItem)=>void;title?:string;subtitle?:string}> = ({compact=false,onTry,title='Modelos em destaque',subtitle='Veja os resultados em movimento e entre direto no modelo certo.'}) => <section className={`ia-model-showcase ${compact?'is-compact':''}`}>
  <div className="ia-model-showcase-header">
    <div className="min-w-0">
      <h2 className="ia-model-showcase-title">{title}</h2>
      <p className="ia-model-showcase-subtitle">{subtitle}</p>
    </div>
  </div>
  <div className="ia-model-showcase-grid">
    {SHOWCASE_MODELS.map(item=><article key={item.modelId} className="ia-model-showcase-card group">
      <div className="ia-model-showcase-media">
        <OnDemandPreview item={item}/>
        <div className="ia-model-showcase-media-shade"/>
        <div className="ia-model-showcase-model-name">{item.name}</div>
      </div>
      <div className="ia-model-showcase-body">
        <h3>{item.headline}</h3>
        <p>{item.description}</p>
        <div className="ia-model-showcase-badges">{item.badges.slice(0,2).map(b=><span key={b}>{b}</span>)}</div>
        {onTry&&<button onClick={()=>onTry(item)} className="ia-model-showcase-cta">Testar modelo<ArrowRight className="w-3.5 h-3.5"/></button>}
      </div>
    </article>)}
  </div>
</section>;
