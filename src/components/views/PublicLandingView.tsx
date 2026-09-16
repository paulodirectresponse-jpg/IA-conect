import React,{useEffect,useRef,useState}from'react';

interface Props{onLogin:()=>void;onStart:()=>void;}

const storage='https://hzjyhhenajbjxkwkmzdg.supabase.co/storage/v1/object/public/ia-conect-assets/showcase';
const video=(name:string)=>`${storage}/${encodeURIComponent(name)}`;
const media=(key:string)=>`https://hzjyhhenajbjxkwkmzdg.supabase.co/functions/v1/showcase-media?key=${key}`;

const models=[
 {name:'Kling 3.0',file:'Kling.mp4',headline:'Personagens, acting e movimento cinematográfico',description:'Movimento natural, direção de câmera e takes com acabamento cinematográfico.'},
 {name:'Omni Flash',file:'Omni flash.mp4',headline:'Vídeo multimodal com velocidade e qualidade',description:'Transforme texto, imagem e referências em um fluxo de criação multimodal.'},
 {name:'Seedance 2.5',file:'Seedance 2.5.mp4',headline:'Cenas longas e consistência visual',description:'Geração cinematográfica multimodal com áudio nativo e referências densas.'},
 {name:'WAN 3.0',file:'Wan 3.0.mp4',headline:'Realismo cinematográfico e referências',description:'Vídeo all-in-one com ótimo custo-benefício, áudio e referências.'},
 {name:'WAN 3.0 Prime',file:'Wan 3.0 prime.mp4',headline:'Qualidade premium para takes finais',description:'Modelo premium all-in-one com áudio nativo, referências multimodais e até 30s.'},
];

const gallery=[
 ['product','Produto & publicidade'],['character','Personagens realistas'],['cgi','CGI surreal'],['architecture','Arquitetura & interiores'],
 ['fashion','Moda & editorial'],['toy','3D & estilizado'],['anime','Anime & ilustração'],['scifi','Arte conceitual & sci-fi'],
] as const;

function useNearViewport<T extends Element>(rootMargin='80px 0px'){
 const ref=useRef<T|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{const node=ref.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setReady(true);return}
  const observer=new IntersectionObserver((entries)=>{if(entries[0]?.isIntersecting){setReady(true);observer.disconnect()}},{rootMargin,threshold:.01});
  observer.observe(node);return()=>observer.disconnect();
 },[rootMargin]);
 return{ref,ready};
}

const DeferredImage:React.FC<React.ImgHTMLAttributes<HTMLImageElement>&{src:string}>=({src,...props})=>{
 const{ref,ready}=useNearViewport<HTMLImageElement>();
 return <img {...props} ref={ref} src={ready?src:undefined}/>;
};

const DeferredVideo:React.FC<{src:string;className?:string;poster?:string}>=({src,className,poster})=>{
 const{ref,ready}=useNearViewport<HTMLVideoElement>('0px'),[failed,setFailed]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el||!ready||failed)return;const play=()=>{if(document.hidden){el.pause();return}void el.play().catch(()=>{})};play();document.addEventListener('visibilitychange',play);return()=>{document.removeEventListener('visibilitychange',play);el.pause()}},[ready,failed]);
 if(failed)return <div className="public-model-video public-media-fallback">Prévia indisponível</div>;
 return <video ref={ref} src={ready?src:undefined} poster={poster} muted loop playsInline preload={ready?'metadata':'none'} onError={()=>setFailed(true)} className={className}/>;
};

const Mark:React.FC=()=> <div className="public-brand"><picture><source srcSet="/brand/ia-connect-logo-oficial-v1.avif" type="image/avif"/><source srcSet="/brand/ia-connect-logo-oficial-v1.webp" type="image/webp"/><img src="/brand/ia-connect-logo-oficial.png" width="96" height="32" alt="IA Connect" decoding="async"/></picture><div><strong>IA Connect</strong><span>AI Studio</span></div></div>;

const HeroVideo:React.FC=()=>{
 const[ready,setReady]=useState(false),[canPlay,setCanPlay]=useState(false);
 useEffect(()=>{let timer:number|undefined;const start=()=>{const ric=(window as any).requestIdleCallback;if(typeof ric==='function')ric(()=>setReady(true),{timeout:1800});else timer=window.setTimeout(()=>setReady(true),500)};if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});return()=>{window.removeEventListener('load',start);if(timer)window.clearTimeout(timer)}},[]);
 return <video src={ready?video('Hero.mp4'):undefined} muted loop playsInline preload={ready?'metadata':'none'} onCanPlay={()=>setCanPlay(true)} autoPlay={ready} aria-hidden="true" className={`public-hero-video ${canPlay?'is-ready':''}`}/>;
};

export const PublicLandingView:React.FC<Props>=({onLogin,onStart})=><div className="public-page">
 <header className="public-header"><div className="public-wrap public-header-inner"><Mark/><nav><a href="#models">Modelos</a><a href="#gallery">Explorar</a><a href="#how">Como funciona</a></nav><div className="public-header-actions"><button className="public-link" onClick={onLogin}>Entrar</button><button className="public-primary" onClick={onStart}>Começar agora</button></div></div></header>
 <main>
  <section className="public-hero-shell"><div className="public-wrap public-hero">
   <img src="/enterprise/visuals/planet-hero-wide-v1.webp" alt="" aria-hidden="true" fetchPriority="high" decoding="async" className="public-hero-poster"/>
   <HeroVideo/><div className="public-hero-overlay"/>
   <div className="public-hero-content"><div className="public-hero-copy"><h1>Crie imagens e vídeos com as melhores IAs.</h1><p>Escolha modelos, use referências, veja o preço antes de gerar e mantenha tudo organizado em um único estúdio.</p><div className="public-hero-actions"><button className="public-primary public-primary-lg" onClick={onStart}>Começar agora <span aria-hidden="true">→</span></button><a className="public-secondary" href="#models">Explorar modelos</a></div></div><div className="public-proof"><span>Vários modelos</span><span>Preço antes de gerar</span><span>Pague pelo uso</span></div></div>
  </div></section>

  <section id="models" className="public-section"><div className="public-wrap"><div className="public-heading"><h2>Tecnologia de ponta para grandes ideias</h2><p>Compare estética, movimento e capacidade dos modelos antes de entrar no estúdio.</p></div><div className="public-model-grid">{models.map(item=><article key={item.name} className="public-model-card"><div className="public-model-media"><DeferredVideo src={video(item.file)} className="public-model-video"/><span>{item.name}</span></div><div className="public-model-body"><h3>{item.headline}</h3><p>{item.description}</p><button onClick={onStart}>Testar modelo <span aria-hidden="true">→</span></button></div></article>)}</div></div></section>

  <section id="gallery" className="public-gallery-section"><div className="public-wrap"><div className="public-heading public-heading-split"><h2>Veja o que é possível criar.</h2><p>Fotografia de produto, personagens, moda, CGI, arquitetura, ilustração e conceitos visuais em diferentes modelos e linguagens.</p></div><div className="public-gallery">{gallery.map(([key,label])=><figure key={key}><DeferredImage src={media(key)} alt={label} decoding="async"/><figcaption>{label}</figcaption></figure>)}</div></div></section>

  <section className="public-section"><div className="public-wrap"><div className="public-heading"><h2>Ferramentas para criar, iterar e continuar.</h2><p>Um fluxo único para sair da ideia, testar modelos, organizar referências e continuar produzindo.</p></div><div className="public-features"><article><b>01</b><h3>Gerador de imagens</h3><p>Crie, edite e reutilize referências sem quebrar o fluxo.</p></article><article><b>02</b><h3>Gerador de vídeos</h3><p>Transforme prompts, imagens e referências em movimento.</p></article><article><b>03</b><h3>Biblioteca</h3><p>Organize personagens, produtos, estilos e arquivos em um só lugar.</p></article><article><b>04</b><h3>Fluxo contínuo</h3><p>Gere novamente, baixe e leve uma criação para o próximo passo.</p></article></div></div></section>

  <section id="how" className="public-how"><div className="public-wrap public-how-grid"><div className="public-heading"><h2>Sem complicação entre a ideia e o resultado.</h2><p>Escolha o modelo, configure com clareza e gere sabendo o custo antes de confirmar.</p></div><div className="public-steps">{[['1','Escolha','Encontre o modelo certo para a estética e o tipo de geração.'],['2','Configure','Use prompt, referências e parâmetros com preço visível.'],['3','Crie','Gere, salve, reutilize e baixe dentro do mesmo fluxo.']].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>

  <section className="public-section"><div className="public-wrap"><div className="public-cta"><div><h2>Você escolhe. Você controla.</h2><p>Sem assinatura por modelo. Adicione saldo quando precisar, saiba o custo antes de gerar e use seus créditos no seu ritmo.</p></div><button className="public-primary" onClick={onStart}>Começar agora</button></div></div></section>
 </main>
 <footer className="public-footer"><div className="public-wrap public-footer-inner"><Mark/><p>IA Connect · AI Studio</p></div></footer>
</div>;
