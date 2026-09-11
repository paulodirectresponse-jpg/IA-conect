import React from'react';
import{ArrowRight,BookOpen,Image as ImageIcon,Layers3,Sparkles,Video,Wallet,Zap}from'lucide-react';
import{BrandMark}from'../common/BrandMark.js';
import{ModelShowcase,ShowcaseItem,showcaseVideo}from'../workspace/ModelShowcase.js';

interface Props{onLogin:()=>void;onStart:()=>void;}
const media=(key:string)=>`https://hzjyhhenajbjxkwkmzdg.supabase.co/functions/v1/showcase-media?key=${key}`;
const heroVideo=showcaseVideo('Hero.mp4');

type GalleryItem={key:string;label:string;ratio:number};
const galleryRows:GalleryItem[][]=[
 [{key:'product',label:'Produto & publicidade',ratio:5/4},{key:'character',label:'Personagens realistas',ratio:4/5},{key:'cgi',label:'CGI surreal',ratio:16/9},{key:'architecture',label:'Arquitetura & interiores',ratio:16/9}],
 [{key:'fashion',label:'Fashion & editorial',ratio:4/5},{key:'toy',label:'3D & estilizado',ratio:1},{key:'anime',label:'Anime & ilustração',ratio:16/9},{key:'scifi',label:'Concept art & sci-fi',ratio:16/9}],
];

const GalleryCard:React.FC<{item:GalleryItem}>=({item})=><figure className="ia-landing-gallery-card group relative min-w-0 overflow-hidden" style={{aspectRatio:item.ratio}}>
 <img src={media(item.key)} alt={item.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>
 <figcaption className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-12"><p className="text-[10px] font-black text-white">{item.label}</p></figcaption>
</figure>;

const Feature:React.FC<{icon:any;title:string;text:string}>=({icon:Icon,title,text})=><article className="ia-landing-feature">
 <div className="ia-landing-feature-icon"><Icon className="w-4.5 h-4.5"/></div>
 <h3 className="mt-4 text-[14px] font-black text-white">{title}</h3>
 <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{text}</p>
</article>;

export const LandingPageView:React.FC<Props>=({onLogin,onStart})=>{
 const startFromModel=(item:ShowcaseItem)=>{sessionStorage.setItem('ia-connect:last-showcase-model',item.modelId);onStart()};
 return <div className="ia-landing min-h-screen overflow-x-hidden text-white">
  <header className="ia-landing-header fixed inset-x-0 top-0 z-50">
   <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
    <BrandMark/>
    <nav className="hidden items-center gap-7 text-[11px] font-semibold text-zinc-500 md:flex">
     <a href="#models">Modelos</a>
     <a href="#gallery">Explorar</a>
     <a href="#how">Como funciona</a>
    </nav>
    <div className="flex items-center gap-2">
     <button onClick={onLogin} className="ia-landing-link-button h-9 px-3.5 text-[11px] font-semibold">Entrar</button>
     <button onClick={onStart} className="ia-primary h-9 rounded-xl px-4 text-[11px] font-black">Começar agora</button>
    </div>
   </div>
  </header>

  <main>
   <section className="px-4 pt-20 sm:px-5 sm:pt-24">
    <div className="ia-landing-hero relative mx-auto max-w-7xl overflow-hidden">
     <video src={heroVideo} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center"/>
     <div className="ia-landing-hero-overlay absolute inset-0"/>
     <div className="relative z-10 flex min-h-[600px] sm:min-h-[660px] items-end">
      <div className="w-full px-5 pb-8 pt-24 sm:px-8 sm:pb-10 lg:px-12 lg:pb-12">
       <div className="max-w-4xl">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-sky-300">Creative AI Studio</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[.95] tracking-[-.055em] sm:text-6xl lg:text-[74px]">Crie imagens e vídeos com <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-400">as melhores IAs.</span></h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-white/82 sm:text-base">Escolha modelos, use referências, veja o preço antes de gerar e mantenha tudo organizado em um único studio.</p>
        <div className="mt-7 flex flex-wrap gap-3">
         <button onClick={onStart} className="ia-primary h-12 rounded-xl px-6 text-sm font-black inline-flex items-center gap-2">Começar agora<ArrowRight className="w-4 h-4"/></button>
         <button onClick={()=>document.getElementById('models')?.scrollIntoView({behavior:'smooth'})} className="ia-landing-secondary h-12 rounded-xl px-5 text-[12px] font-bold">Explorar modelos</button>
        </div>
       </div>
       <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-[10px] font-semibold text-white/60">
        <span className="inline-flex items-center gap-2"><Layers3 className="w-3.5 h-3.5 text-sky-300"/>Vários modelos</span>
        <span className="inline-flex items-center gap-2"><Wallet className="w-3.5 h-3.5 text-sky-300"/>Preço antes de gerar</span>
        <span className="inline-flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-sky-300"/>Pague pelo uso</span>
       </div>
      </div>
     </div>
    </div>
   </section>

   <section id="models" className="ia-landing-section px-5 py-16">
    <div className="mx-auto max-w-7xl"><ModelShowcase onTry={startFromModel} title="Tecnologia de ponta para grandes ideias" subtitle="Compare estética, movimento e capacidade dos modelos antes de entrar no studio."/></div>
   </section>

   <section id="gallery" className="ia-landing-gallery-section overflow-hidden py-16">
    <div className="mx-auto max-w-7xl px-5">
     <p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-300">Da realidade à imaginação</p>
     <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_.7fr] lg:items-end">
      <h2 className="text-3xl font-black tracking-[-.04em] sm:text-5xl">Veja o que é possível criar.</h2>
      <p className="text-[12px] leading-relaxed text-zinc-500 sm:text-sm">Fotografia de produto, personagens, moda, CGI, arquitetura, ilustração e conceitos visuais em diferentes modelos e linguagens.</p>
     </div>
    </div>
    <div className="mt-8 w-full space-y-2 px-2 sm:space-y-3 sm:px-4 lg:px-5">
     <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:hidden">{galleryRows.flat().map(item=><GalleryCard key={item.key} item={item}/>)}</div>
     {galleryRows.map((row,rowIndex)=><div key={rowIndex} className="hidden gap-3 lg:grid" style={{gridTemplateColumns:row.map(item=>`${item.ratio}fr`).join(' ')}}>{row.map(item=><GalleryCard key={item.key} item={item}/>)}</div>)}
    </div>
   </section>

   <section className="ia-landing-section px-5 py-16">
    <div className="mx-auto max-w-7xl">
     <div className="max-w-2xl">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-300">Um fluxo, várias possibilidades</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Ferramentas para criar, iterar e continuar.</h2>
     </div>
     <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Feature icon={ImageIcon} title="Gerador de imagens" text="Crie, edite e reutilize referências sem quebrar o fluxo."/>
      <Feature icon={Video} title="Gerador de vídeos" text="Transforme prompts, imagens e referências em movimento."/>
      <Feature icon={BookOpen} title="Biblioteca" text="Organize personagens, produtos, estilos e assets em um só lugar."/>
      <Feature icon={Sparkles} title="Fluxo contínuo" text="Regere, baixe e leve uma criação para o próximo passo."/>
     </div>
    </div>
   </section>

   <section id="how" className="ia-landing-how px-5 py-16">
    <div className="mx-auto max-w-7xl">
     <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
      <div>
       <p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-300">Como funciona</p>
       <h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Sem complicação entre a ideia e o resultado.</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
       {[['1','Escolha','Encontre o modelo certo para a estética e o tipo de geração.'],['2','Configure','Use prompt, referências e parâmetros com preço visível.'],['3','Crie','Gere, salve, reutilize e baixe dentro do mesmo fluxo.']].map(([n,t,d])=><div key={n} className="ia-landing-step">
        <span>{n}</span>
        <h3 className="mt-4 text-[13px] font-black">{t}</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{d}</p>
       </div>)}
      </div>
     </div>
    </div>
   </section>

   <section className="px-5 py-16">
    <div className="ia-landing-cta mx-auto max-w-6xl">
     <div>
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-sky-300">Mais liberdade</p>
      <h2 className="mt-2 text-3xl font-black">Você escolhe. Você controla.</h2>
      <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-zinc-500 sm:text-sm">Sem assinatura por modelo. Adicione saldo quando precisar, saiba o custo antes de gerar e use seus créditos no seu ritmo.</p>
     </div>
     <button onClick={onStart} className="ia-primary h-11 rounded-xl px-5 text-[11px] font-black whitespace-nowrap">Começar agora</button>
    </div>
   </section>
  </main>

  <footer className="ia-landing-footer px-5 py-8">
   <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row"><BrandMark/><p className="text-[9px] text-zinc-700">IA Connect · Creative AI Studio</p></div>
  </footer>
 </div>;
};
