import React from'react';
import{useReducedMotion}from'motion/react';
import{ArrowRight,BookOpen,Image as ImageIcon,Layers3,Sparkles,Video,Wallet,Zap}from'lucide-react';
import{BrandMark}from'../common/BrandMark.js';
import{ViewportVideo}from'../common/ViewportVideo.js';
import{ModelShowcase,ShowcaseItem,showcaseVideo}from'../workspace/ModelShowcase.js';

interface Props{onLogin:()=>void;onStart:()=>void;}
const media=(key:string)=>`https://hzjyhhenajbjxkwkmzdg.supabase.co/functions/v1/showcase-media?key=${key}`;
const heroVideo=showcaseVideo('Hero.mp4');

type GalleryItem={key:string;label:string;ratio:number};
const galleryRows:GalleryItem[][]=[
 [{key:'product',label:'Produto & publicidade',ratio:5/4},{key:'character',label:'Personagens realistas',ratio:4/5},{key:'cgi',label:'CGI surreal',ratio:16/9},{key:'architecture',label:'Arquitetura & interiores',ratio:16/9}],
 [{key:'fashion',label:'Moda & editorial',ratio:4/5},{key:'toy',label:'3D & estilizado',ratio:1},{key:'anime',label:'Anime & ilustração',ratio:16/9},{key:'scifi',label:'Arte conceitual & sci-fi',ratio:16/9}],
];

const GalleryCard:React.FC<{item:GalleryItem}>=({item})=><figure className="ia-landing-gallery-card group relative min-w-0 overflow-hidden" style={{aspectRatio:item.ratio}}>
 <img src={media(item.key)} alt={item.label} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover"/>
 <figcaption className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5 pt-14"><p className="text-[11px] font-semibold text-white">{item.label}</p></figcaption>
</figure>;

const Feature:React.FC<{icon:any;title:string;text:string}>=({icon:Icon,title,text})=><article className="ia-landing-feature">
 <Icon className="ia-landing-feature-icon"/>
 <h3>{title}</h3>
 <p>{text}</p>
</article>;

export const LandingPageView:React.FC<Props>=({onLogin,onStart})=>{
 const reduceMotion=useReducedMotion();
 const startFromModel=(item:ShowcaseItem)=>{sessionStorage.setItem('ia-connect:last-showcase-model',item.modelId);onStart()};
 return <div className="ia-landing min-h-screen overflow-x-hidden text-white">
  <header className="ia-landing-header fixed inset-x-0 top-0 z-50">
   <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
    <BrandMark/>
    <nav className="hidden items-center gap-7 text-[12px] font-medium text-zinc-400 md:flex">
     <a href="#models">Modelos</a>
     <a href="#gallery">Explorar</a>
     <a href="#how">Como funciona</a>
    </nav>
    <div className="flex items-center gap-2">
     <button onClick={onLogin} className="ia-landing-link-button h-10 px-4 text-[12px] font-semibold">Entrar</button>
     <button onClick={onStart} className="ia-primary h-10 rounded-[10px] px-4 text-[12px] font-bold">Começar agora</button>
    </div>
   </div>
  </header>

  <main>
   <section className="px-3 pt-[82px] sm:px-5 sm:pt-[92px]">
    <div className="ia-landing-hero relative mx-auto max-w-7xl overflow-hidden">
     <ViewportVideo src={heroVideo} poster="/enterprise/visuals/planet-hero-wide-v1.webp" eager playWhenVisible={!reduceMotion} muted loop playsInline aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center"/>
     <div className="ia-landing-hero-overlay absolute inset-0"/>
     <div className="relative z-10 flex min-h-[590px] items-end sm:min-h-[660px]">
      <div className="w-full px-5 pb-8 pt-24 sm:px-8 sm:pb-10 lg:px-12 lg:pb-12">
       <div className="max-w-4xl">
        <h1 className="ia-landing-hero-title">Crie imagens e vídeos com as melhores IAs.</h1>
        <p className="ia-landing-hero-copy">Escolha modelos, use referências, veja o preço antes de gerar e mantenha tudo organizado em um único estúdio.</p>
        <div className="mt-7 flex flex-wrap gap-3">
         <button onClick={onStart} className="ia-primary inline-flex h-12 items-center gap-2 rounded-[11px] px-6 text-sm font-bold">Começar agora<ArrowRight className="w-4 h-4"/></button>
         <button onClick={()=>document.getElementById('models')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth'})} className="ia-landing-secondary h-12 rounded-[11px] px-5 text-[12px] font-semibold">Explorar modelos</button>
        </div>
       </div>
       <div className="ia-landing-proof">
        <span><Layers3/>Vários modelos</span>
        <span><Wallet/>Preço antes de gerar</span>
        <span><Zap/>Pague pelo uso</span>
       </div>
      </div>
     </div>
    </div>
   </section>

   <section id="models" className="ia-landing-section px-5 py-20">
    <div className="mx-auto max-w-7xl"><ModelShowcase onTry={startFromModel} title="Tecnologia de ponta para grandes ideias" subtitle="Compare estética, movimento e capacidade dos modelos antes de entrar no estúdio."/></div>
   </section>

   <section id="gallery" className="ia-landing-gallery-section overflow-hidden py-20">
    <div className="mx-auto max-w-7xl px-5">
     <div className="grid gap-5 lg:grid-cols-[1fr_.72fr] lg:items-end">
      <h2 className="ia-landing-section-title">Veja o que é possível criar.</h2>
      <p className="ia-landing-section-copy">Fotografia de produto, personagens, moda, CGI, arquitetura, ilustração e conceitos visuais em diferentes modelos e linguagens.</p>
     </div>
    </div>
    <div className="mt-9 w-full space-y-2 px-2 sm:space-y-3 sm:px-4 lg:px-5">
     <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:hidden">{galleryRows.flat().map(item=><GalleryCard key={item.key} item={item}/>)}</div>
     {galleryRows.map((row,rowIndex)=><div key={rowIndex} className="hidden gap-3 lg:grid" style={{gridTemplateColumns:row.map(item=>`${item.ratio}fr`).join(' ')}}>{row.map(item=><GalleryCard key={item.key} item={item}/>)}</div>)}
    </div>
   </section>

   <section className="ia-landing-section px-5 py-20">
    <div className="mx-auto max-w-7xl">
     <div className="max-w-2xl">
      <h2 className="ia-landing-section-title">Ferramentas para criar, iterar e continuar.</h2>
      <p className="ia-landing-section-copy mt-3">Um fluxo único para sair da ideia, testar modelos, organizar referências e continuar produzindo.</p>
     </div>
     <div className="ia-landing-features">
      <Feature icon={ImageIcon} title="Gerador de imagens" text="Crie, edite e reutilize referências sem quebrar o fluxo."/>
      <Feature icon={Video} title="Gerador de vídeos" text="Transforme prompts, imagens e referências em movimento."/>
      <Feature icon={BookOpen} title="Biblioteca" text="Organize personagens, produtos, estilos e arquivos em um só lugar."/>
      <Feature icon={Sparkles} title="Fluxo contínuo" text="Gere novamente, baixe e leve uma criação para o próximo passo."/>
     </div>
    </div>
   </section>

   <section id="how" className="ia-landing-how px-5 py-20">
    <div className="mx-auto max-w-7xl">
     <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
      <div>
       <h2 className="ia-landing-section-title">Sem complicação entre a ideia e o resultado.</h2>
       <p className="ia-landing-section-copy mt-3">Escolha o modelo, configure com clareza e gere sabendo o custo antes de confirmar.</p>
      </div>
      <div className="grid gap-7 md:grid-cols-3">
       {[['1','Escolha','Encontre o modelo certo para a estética e o tipo de geração.'],['2','Configure','Use prompt, referências e parâmetros com preço visível.'],['3','Crie','Gere, salve, reutilize e baixe dentro do mesmo fluxo.']].map(([n,t,d])=><div key={n} className="ia-landing-step">
        <span>{n}</span>
        <h3>{t}</h3>
        <p>{d}</p>
       </div>)}
      </div>
     </div>
    </div>
   </section>

   <section className="px-5 py-20">
    <div className="ia-landing-cta mx-auto max-w-6xl">
     <div>
      <h2>Você escolhe. Você controla.</h2>
      <p>Sem assinatura por modelo. Adicione saldo quando precisar, saiba o custo antes de gerar e use seus créditos no seu ritmo.</p>
     </div>
     <button onClick={onStart} className="ia-primary h-11 rounded-[10px] px-5 text-[12px] font-bold whitespace-nowrap">Começar agora</button>
    </div>
   </section>
  </main>

  <footer className="ia-landing-footer px-5 py-8">
   <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row"><BrandMark/><p className="text-[10px] text-zinc-600">IA Connect · AI Studio</p></div>
  </footer>
 </div>;
};
