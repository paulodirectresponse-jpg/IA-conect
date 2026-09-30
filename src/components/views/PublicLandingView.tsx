import React,{useEffect,useRef,useState}from'react';
import { showcaseVideoUrl } from '../../utils/showcaseMedia.js';

interface Props{onLogin:()=>void;onStart:()=>void;includeShell?:boolean;}

const video=showcaseVideoUrl;

const models=[
 {name:'Kling 3.0',file:'Kling.mp4',poster:'/model-covers/kling-3-0.webp',headline:'Personagens, acting e movimento cinematográfico',description:'Movimento natural, direção de câmera e takes com acabamento cinematográfico.'},
 {name:'Omni Flash',file:'Omni flash.mp4',poster:'/model-covers/google-omni-flash.webp',headline:'Vídeo multimodal com velocidade e qualidade',description:'Transforme texto, imagem e referências em um fluxo de criação multimodal.'},
 {name:'Seedance 2.5',file:'Seedance 2.5.mp4',poster:'/model-covers/seedance-2-5.webp',headline:'Cenas longas e consistência visual',description:'Geração cinematográfica multimodal com áudio nativo e referências densas.'},
 {name:'WAN 3.0',file:'Wan 3.0.mp4',poster:'/model-covers/wan-3-0.webp',headline:'Realismo cinematográfico e referências',description:'Vídeo all-in-one com ótimo custo-benefício, áudio e referências.'},
 {name:'WAN 3.0 Prime',file:'Wan 3.0 prime.mp4',poster:'/model-covers/wan-3-0-prime.webp',headline:'Qualidade premium para takes finais',description:'Modelo premium all-in-one com áudio nativo, referências multimodais e até 30s.'},
];

const gallery=[
 {key:'product',label:'Produto & publicidade',fallback:'/starter-ideas/product-premium.svg'},
 {key:'character',label:'Personagens realistas',fallback:'/starter-ideas/character.svg'},
 {key:'cgi',label:'CGI surreal',fallback:'/starter-ideas/cgi-concept.svg'},
 {key:'architecture',label:'Arquitetura & interiores',fallback:'/starter-ideas/architecture.svg'},
 {key:'fashion',label:'Moda & editorial',fallback:'/starter-ideas/product-premium.svg'},
 {key:'toy',label:'3D & estilizado',fallback:'/starter-ideas/image-to-video.svg'},
 {key:'anime',label:'Anime & ilustração',fallback:'/starter-ideas/character.svg'},
 {key:'scifi',label:'Arte conceitual & sci-fi',fallback:'/starter-ideas/cinematic-video.svg'},
] as const;

function useNearViewport<T extends Element>(rootMargin='80px 0px'){
 const ref=useRef<T|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{const node=ref.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setReady(true);return}
  const observer=new IntersectionObserver((entries)=>{if(entries[0]?.isIntersecting){setReady(true);observer.disconnect()}},{rootMargin,threshold:.01});
  observer.observe(node);return()=>observer.disconnect();
 },[rootMargin]);
 return{ref,ready};
}

const DeferredVideo:React.FC<{src:string;className?:string;poster?:string;name:string}>=({src,className,poster,name})=>{
 const[requested,setRequested]=useState(false),[failed,setFailed]=useState(false);
 if(requested&&!failed)return <video autoPlay controls muted playsInline preload="none" src={src} poster={poster} aria-label={`Prévia em vídeo de ${name}`} onError={()=>setFailed(true)} className={className}/>;
 return <button type="button" onClick={()=>{if(failed)setFailed(false);setRequested(true)}} aria-label={failed?`Tentar carregar a prévia de ${name} novamente`:`Assistir prévia de ${name}`} className="public-preview-trigger">
  {poster&&<img src={poster} alt="" decoding="async" className="public-model-video"/>}
  <span className="public-preview-action">{failed?'Tentar novamente':'▶  Assistir prévia'}</span>
 </button>;
};

const GalleryPreview:React.FC<{item:(typeof gallery)[number]}>=({item})=>{
 const{ref,ready}=useNearViewport<HTMLImageElement>();
 return <>
  <img ref={ref} src={ready?item.fallback:undefined} alt={`Prévia ilustrativa: ${item.label}`} decoding="async"/>
  {ready&&<span className="public-gallery-fallback">Prévia ilustrativa</span>}
 </>;
};

const Mark:React.FC=()=> <div className="public-brand"><picture><source srcSet="/brand/ia-connect-logo-oficial-v1.avif" type="image/avif"/><source srcSet="/brand/ia-connect-logo-oficial-v1.webp" type="image/webp"/><img src="/brand/ia-connect-logo-oficial.png" width="96" height="32" alt="IA Connect" decoding="async"/></picture><div><strong>IA Connect</strong><span>AI Studio</span></div></div>;

export const PublicLandingView:React.FC<Props>=({onLogin,onStart,includeShell=true})=><div className="public-page public-page-tail">
 {includeShell&&<header className="public-header"><div className="public-wrap public-header-inner"><Mark/><nav><a href="#models">Modelos</a><a href="#gallery">Explorar</a><a href="#how">Como funciona</a></nav><div className="public-header-actions"><button className="public-link" onClick={onLogin}>Entrar</button><button className="public-primary" onClick={onStart}>Começar agora</button></div></div></header>}
 <main>
  {includeShell&&<section className="public-hero-shell"><div className="public-wrap public-hero">
   <img src="/enterprise/visuals/planet-hero-wide-v1.webp" alt="" aria-hidden="true" fetchPriority="high" decoding="async" className="public-hero-poster"/>
   <div className="public-hero-overlay"/>
   <div className="public-hero-content"><div className="public-hero-copy"><h1>Crie imagens e vídeos com as melhores IAs.</h1><p>Escolha modelos, use referências, veja o preço antes de gerar e mantenha tudo organizado em um único estúdio.</p><div className="public-hero-actions"><button className="public-primary public-primary-lg" onClick={onStart}>Começar agora <span aria-hidden="true">→</span></button><a className="public-secondary" href="#models">Explorar modelos</a></div></div><div className="public-proof"><span>Vários modelos</span><span>Preço antes de gerar</span><span>Pague pelo uso</span></div></div>
  </div></section>}

  <section id="models" className="public-section"><div className="public-wrap"><div className="public-heading"><h2>Tecnologia de ponta para grandes ideias</h2><p>Compare estética, movimento e capacidade dos modelos antes de entrar no estúdio.</p></div><div className="public-model-grid">{models.map(item=><article key={item.name} className="public-model-card"><div className="public-model-media"><DeferredVideo src={video(item.file)} poster={item.poster} name={item.name} className="public-model-video"/><span>{item.name}</span></div><div className="public-model-body"><h3>{item.headline}</h3><p>{item.description}</p><button onClick={onStart}>Testar modelo <span aria-hidden="true">→</span></button></div></article>)}</div></div></section>

  <section id="gallery" className="public-gallery-section"><div className="public-wrap"><div className="public-heading public-heading-split"><h2>Veja o que é possível criar.</h2><p>Fotografia de produto, personagens, moda, CGI, arquitetura, ilustração e conceitos visuais em diferentes modelos e linguagens.</p></div><div className="public-gallery">{gallery.map(item=><figure key={item.key}><GalleryPreview item={item}/><figcaption>{item.label}</figcaption></figure>)}</div></div></section>

  <section className="public-section"><div className="public-wrap"><div className="public-heading"><h2>Ferramentas para criar, iterar e continuar.</h2><p>Um fluxo único para sair da ideia, testar modelos, organizar referências e continuar produzindo.</p></div><div className="public-features"><article><b>01</b><h3>Gerador de imagens</h3><p>Crie, edite e reutilize referências sem quebrar o fluxo.</p></article><article><b>02</b><h3>Gerador de vídeos</h3><p>Transforme prompts, imagens e referências em movimento.</p></article><article><b>03</b><h3>Biblioteca</h3><p>Organize personagens, produtos, estilos e arquivos em um só lugar.</p></article><article><b>04</b><h3>Fluxo contínuo</h3><p>Gere novamente, baixe e leve uma criação para o próximo passo.</p></article></div></div></section>

  <section id="how" className="public-how"><div className="public-wrap public-how-grid"><div className="public-heading"><h2>Sem complicação entre a ideia e o resultado.</h2><p>Escolha o modelo, configure com clareza e gere sabendo o custo antes de confirmar.</p></div><div className="public-steps">{[['1','Escolha','Encontre o modelo certo para a estética e o tipo de geração.'],['2','Configure','Use prompt, referências e parâmetros com preço visível.'],['3','Crie','Gere, salve, reutilize e baixe dentro do mesmo fluxo.']].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>

  <section className="public-section"><div className="public-wrap"><div className="public-cta"><div><h2>Você escolhe. Você controla.</h2><p>Sem assinatura por modelo. Adicione saldo quando precisar, saiba o custo antes de gerar e use seus créditos no seu ritmo.</p></div><button className="public-primary" onClick={onStart}>Começar agora</button></div></div></section>
 </main>
 <footer className="public-footer"><div className="public-wrap public-footer-inner"><Mark/><p>IA Connect · AI Studio</p></div></footer>
</div>;
