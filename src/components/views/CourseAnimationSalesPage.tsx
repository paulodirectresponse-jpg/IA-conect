import React,{useEffect,useMemo,useRef,useState}from'react';
import{onAuthStateChanged,User as FirebaseUser}from'firebase/auth';
import{ArrowRight,Check,CheckCircle2,ChevronDown,Clock3,Copy,Film,Layers,Loader2,Lock,Mail,MonitorPlay,ShieldCheck,Sparkles,User,X,Zap}from'lucide-react';
import{auth}from'../../config/firebase.js';
import{authService}from'../../services/authService.js';
import{CourseOffer,courseSalesClient}from'../../services/courseSalesClient.js';
import{PaymentRecord}from'../../types/index.js';
import{BrandMark}from'../common/BrandMark.js';
import'../../styles/course-sales.css';

const FALLBACK_OFFER:CourseOffer={
 course_id:'animacao-3d-ia',
 version:1,
 title:'Do Zero à Animação 3D com IA',
 subtitle:'Crie sua primeira animação 3D com inteligência artificial sem dominar animação, modelagem ou Blender.',
 price_brl_cents:2990,
 currency:'BRL',
 checkout_enabled:true,
};

const media=(key:string)=>`https://hzjyhhenajbjxkwkmzdg.supabase.co/functions/v1/showcase-media?key=${key}`;
const terminal=(status?:string)=>['CONFIRMED','FAILED','EXPIRED'].includes(String(status||''));
const brl=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.max(0,cents)/100);

function track(name:string,properties:Record<string,unknown>={}){
 if(typeof window==='undefined')return;
 const detail={event:`course_${name}`,course_id:'animacao-3d-ia',...properties};
 const dataLayer=(window as any).dataLayer;
 if(Array.isArray(dataLayer))dataLayer.push(detail);
 window.dispatchEvent(new CustomEvent('ia:course-funnel',{detail}));
}

function setMeta(name:string,content:string,property=false){
 let el=document.head.querySelector(`meta[${property?'property':'name'}="${name}"]`)as HTMLMetaElement|null;
 if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',name);document.head.appendChild(el)}
 el.content=content;
}

const lessons=[
 {n:'01',title:'Planejamento',count:'2 aulas',text:'Ideia, referência, direção visual e storyboard simples antes de gerar.'},
 {n:'02',title:'Criação visual',count:'3 aulas',text:'Personagem, cenários, enquadramentos e consistência entre as cenas.'},
 {n:'03',title:'Animação',count:'3 aulas',text:'Imagem para vídeo, movimento, câmera, correções e seleção dos melhores takes.'},
 {n:'04',title:'Finalização',count:'2 aulas',text:'Voz, trilha, montagem, acabamento e exportação da animação final.'},
];

const faqs=[
 ['Eu preciso saber Blender ou modelagem 3D?','Não. O treinamento foi estruturado para quem quer começar pela criação com IA, sem depender de uma formação prévia em modelagem, rigging ou animação tradicional.'],
 ['Nunca fiz uma animação. Consigo acompanhar?','Sim. O projeto é construído do começo ao fim e cada etapa existe para levar você da ideia ao primeiro resultado sem presumir experiência anterior.'],
 ['A animação completa fica pronta em 30 minutos?','O desafio de cerca de 30 minutos se refere ao primeiro teste simples em movimento. O projeto completo de 30 segundos a 1 minuto, com várias cenas e acabamento, naturalmente exige mais tempo.'],
 ['O curso serve para quem já trabalha com vídeo ou design?','Sim. Para editores, creators, designers e profissionais de conteúdo, o treinamento funciona como uma nova habilidade que pode ser adicionada ao repertório criativo e ao portfólio.'],
 ['Posso comprar para meu filho?','O conteúdo também pode ser interessante para jovens que gostam de criação e tecnologia. Para menores de idade, recomendamos que a compra e o uso das ferramentas sejam acompanhados por um responsável.'],
 ['Como funciona o pagamento?','O checkout usa Pix com processamento pelo Mercado Pago. A confirmação é automática e a compra fica vinculada à conta usada no checkout.'],
];

export const CourseAnimationSalesPage:React.FC=()=>{
 const[offer,setOffer]=useState<CourseOffer>(FALLBACK_OFFER);
 const[offerError,setOfferError]=useState('');
 const[user,setUser]=useState<FirebaseUser|null>(auth.currentUser);
 const[accessActive,setAccessActive]=useState(false);
 const[checkoutOpen,setCheckoutOpen]=useState(false);
 const[authMode,setAuthMode]=useState<'register'|'login'>('register');
 const[name,setName]=useState('');
 const[email,setEmail]=useState('');
 const[password,setPassword]=useState('');
 const[confirmPassword,setConfirmPassword]=useState('');
 const[authLoading,setAuthLoading]=useState(false);
 const[authError,setAuthError]=useState('');
 const[payment,setPayment]=useState<PaymentRecord|null>(null);
 const[creating,setCreating]=useState(false);
 const[paymentError,setPaymentError]=useState('');
 const[copied,setCopied]=useState(false);
 const[now,setNow]=useState(Date.now());
 const confirmedTracked=useRef(false);
 const vslUrl=String(offer.vsl_url||(import.meta as any).env?.VITE_COURSE_VSL_URL||'').trim();
 const directVideo=/\.(mp4|webm)(\?|$)/i.test(vslUrl);

 useEffect(()=>{
  const oldTitle=document.title,oldDescription=document.head.querySelector('meta[name="description"]')?.getAttribute('content')||'';
  document.title='Animação 3D com IA | IA Connect';
  setMeta('description','Aprenda a criar sua primeira animação 3D com inteligência artificial do zero, sem precisar dominar Blender, modelagem ou animação tradicional.');
  setMeta('og:title','Do Zero à Animação 3D com IA | IA Connect',true);
  setMeta('og:description','Um treinamento prático para sair da ideia e construir uma animação 3D completa com IA.',true);
  let canonical=document.head.querySelector('link[rel="canonical"]')as HTMLLinkElement|null;
  const oldCanonical=canonical?.href||'';
  if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}
  canonical.href=`${window.location.origin}/curso/animacao-3d`;
  track('page_view',{path:window.location.pathname});
  return()=>{document.title=oldTitle;setMeta('description',oldDescription);if(canonical&&oldCanonical)canonical.href=oldCanonical};
 },[]);

 useEffect(()=>{courseSalesClient.getOffer().then(setOffer).catch((e:any)=>setOfferError(e?.message||'Oferta temporariamente indisponível.'))},[]);
 useEffect(()=>onAuthStateChanged(auth,(next)=>{setUser(next);if(next){courseSalesClient.getAccess().then(r=>setAccessActive(r.active)).catch(()=>{})}else setAccessActive(false)}),[]);
 useEffect(()=>{if(!payment||terminal(payment.status))return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[payment?.payment_id,payment?.status]);
 useEffect(()=>{
  if(!payment||terminal(payment.status))return;
  let cancelled=false,timer:number|undefined;
  const poll=async()=>{try{const next=await courseSalesClient.getPayment(payment.payment_id);if(cancelled)return;setPayment(next);if(next.status==='CONFIRMED'){setAccessActive(true);if(!confirmedTracked.current){confirmedTracked.current=true;track('purchase_confirmed',{payment_id:next.payment_id,value:next.amount_cents/100,currency:'BRL'})}return}if(!terminal(next.status))timer=window.setTimeout(poll,2500)}catch{if(!cancelled)timer=window.setTimeout(poll,3500)}};
  timer=window.setTimeout(poll,1800);
  return()=>{cancelled=true;if(timer)window.clearTimeout(timer)};
 },[payment?.payment_id,payment?.status]);

 const remaining=useMemo(()=>payment?.expires_at?Math.max(0,Math.floor((Date.parse(payment.expires_at)-now)/1000)):0,[payment?.expires_at,now]);
 const remainingText=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;

 const openCheckout=(source:string)=>{
  track('checkout_open',{source,price_cents:offer.price_brl_cents});
  setCheckoutOpen(true);setPaymentError('');setAuthError('');
 };

 const handleAuth=async(e:React.FormEvent)=>{
  e.preventDefault();setAuthError('');
  if(authMode==='register'){
   if(password.length<6)return setAuthError('A senha precisa ter pelo menos 6 caracteres.');
   if(password!==confirmPassword)return setAuthError('As senhas não coincidem.');
   if(!name.trim())return setAuthError('Informe seu nome.');
  }
  setAuthLoading(true);
  try{
   if(authMode==='register')await authService.register(email.trim(),password,name.trim());
   else await authService.login(email.trim(),password);
   setUser(auth.currentUser);
   track('auth_complete',{mode:authMode});
  }catch(err:any){
   let msg=err?.message||'Não foi possível autenticar.';
   if(msg.includes('email-already-in-use'))msg='Este e-mail já possui conta. Entre para continuar.';
   if(msg.includes('invalid-credential')||msg.includes('wrong-password')||msg.includes('user-not-found'))msg='E-mail ou senha incorretos.';
   setAuthError(msg);
  }finally{setAuthLoading(false)}
 };

 const createPix=async()=>{
  setCreating(true);setPaymentError('');confirmedTracked.current=false;
  try{
   const created=await courseSalesClient.createCheckout();
   setPayment(created);track('pix_created',{payment_id:created.payment_id,value:created.amount_cents/100,currency:'BRL'});
   if(created.status==='CONFIRMED'){setAccessActive(true);confirmedTracked.current=true;track('purchase_confirmed',{payment_id:created.payment_id,value:created.amount_cents/100,currency:'BRL'})}
  }catch(err:any){setPaymentError(err?.message||'Não foi possível gerar o Pix.')}finally{setCreating(false)}
 };

 const copyPix=async()=>{if(!payment?.pix_code)return;await navigator.clipboard.writeText(payment.pix_code);setCopied(true);track('pix_copy',{payment_id:payment.payment_id});window.setTimeout(()=>setCopied(false),1600)};

 return <div className="course-page">
  <header className="course-header">
   <div className="course-wrap course-header-inner">
    <a href="/" aria-label="IA Connect"><BrandMark compact/></a>
    <div className="course-header-proof"><ShieldCheck/><span>Checkout seguro via Mercado Pago</span></div>
    <button className="course-header-cta" onClick={()=>openCheckout('header')}>Quero começar <ArrowRight/></button>
   </div>
  </header>

  <main>
   <section className="course-hero">
    <div className="course-glow course-glow-a"/><div className="course-glow course-glow-b"/>
    <div className="course-wrap course-hero-grid">
     <div className="course-hero-copy">
      <div className="course-kicker"><Sparkles/> TREINAMENTO PRÁTICO · ANIMAÇÃO 3D COM IA</div>
      <h1>Você não precisa ser animador 3D para <em>criar uma animação 3D.</em></h1>
      <p>Aprenda o processo que transforma uma ideia em personagem, cenas, movimento e uma animação final de aproximadamente <strong>30 segundos a 1 minuto</strong> — mesmo começando do zero.</p>
      <div className="course-hero-actions">
       <button className="course-primary course-primary-lg" onClick={()=>openCheckout('hero')}>Quero criar minha primeira animação <ArrowRight/></button>
       <div className="course-price-inline"><strong>{brl(offer.price_brl_cents)}</strong><span>pagamento único via Pix</span></div>
      </div>
      <div className="course-proof-row"><span><Check/>10 aulas objetivas</span><span><Check/>Projeto do início ao fim</span><span><Check/>Sem Blender como pré-requisito</span></div>
      {offerError&&<div className="course-soft-warning">{offerError}</div>}
     </div>
     <div className="course-hero-art" aria-hidden="true">
      <div className="course-art-card course-art-main"><img src={media('toy')} alt=""/><div><span>PROJETO FINAL</span><b>Da ideia ao movimento</b></div></div>
      <div className="course-art-card course-art-small course-art-small-a"><img src={media('character')} alt=""/></div>
      <div className="course-art-card course-art-small course-art-small-b"><img src={media('cgi')} alt=""/></div>
      <div className="course-art-orbit"><span>IDEIA</span><i/><span>CENA</span><i/><span>MOVIMENTO</span></div>
     </div>
    </div>
   </section>

   {vslUrl&&<section className="course-vsl-section" id="vsl">
    <div className="course-wrap">
     <div className="course-section-heading course-heading-center"><span>VEJA O PROCESSO</span><h2>Antes de decidir, veja como a ideia vira uma animação.</h2><p>Assista à apresentação e entenda o método, o projeto e o que você vai construir dentro do treinamento.</p></div>
     <div className="course-vsl-shell">
      {directVideo
       ?<video controls playsInline preload="metadata" src={vslUrl} onPlay={()=>track('vsl_play')} onEnded={()=>track('vsl_complete')}/>
       :<iframe src={vslUrl} title="Apresentação do curso de animação 3D com IA" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/>}
     </div>
     <div className="course-vsl-cta"><button className="course-primary" onClick={()=>openCheckout('vsl')}>Quero entrar no treinamento <ArrowRight/></button></div>
    </div>
   </section>}

   <section className="course-contrast">
    <div className="course-wrap">
     <div className="course-section-heading"><span>A QUEBRA DE CRENÇA</span><h2>Você não precisa aprender o pipeline inteiro do 3D antes de criar algo que se move.</h2><p>O curso não tenta transformar você em modelador, rigger ou animador tradicional. Ele ensina um workflow de direção com IA para você construir e corrigir a peça.</p></div>
     <div className="course-contrast-grid">
      <article className="course-contrast-card is-muted"><div className="course-card-label">O CAMINHO QUE ASSUSTA QUEM ESTÁ COMEÇANDO</div><h3>Meses de técnica antes do primeiro resultado.</h3><div className="course-steps-list"><span>Modelagem</span><span>Texturização</span><span>Rigging</span><span>Keyframes</span><span>Iluminação</span><span>Render</span></div></article>
      <article className="course-contrast-card is-active"><div className="course-card-label">O CAMINHO DO TREINAMENTO</div><h3>Você aprende a dirigir a criação com IA.</h3><div className="course-flow"><span>Ideia</span><ArrowRight/><span>Personagem</span><ArrowRight/><span>Cenas</span><ArrowRight/><span>Movimento</span><ArrowRight/><span>Final</span></div><p>Você continua tomando decisões criativas. A diferença é que a IA assume parte pesada da execução.</p></article>
     </div>
    </div>
   </section>

   <section className="course-speed">
    <div className="course-wrap course-speed-grid">
     <div className="course-speed-number"><span>DESAFIO INICIAL</span><strong>~30</strong><b>minutos</b></div>
     <div className="course-speed-copy"><span>RESULTADO RÁPIDO</span><h2>Não espere meses para descobrir se você consegue.</h2><p>A meta das primeiras etapas é colocar uma <strong>animação simples em movimento em cerca de 30 minutos</strong>. Depois, você usa o mesmo raciocínio para construir o projeto completo com mais cenas, consistência e acabamento.</p><div className="course-note"><Clock3/>O projeto final de 30s–1min exige mais tempo. O objetivo dos ~30 minutos é conquistar o primeiro resultado simples e remover a barreira de começar.</div></div>
    </div>
   </section>

   <section className="course-result">
    <div className="course-wrap">
     <div className="course-section-heading course-heading-center"><span>NÃO É UM CURSO PARA COLECIONAR AULAS</span><h2>Você entra para terminar alguma coisa.</h2><p>As aulas acompanham o mesmo projeto do planejamento à exportação. O resultado é uma peça que você consegue mostrar, analisar e refazer.</p></div>
     <div className="course-result-grid">
      {[['character','01','Personagem'],['architecture','02','Cena'],['toy','03','Direção visual'],['cgi','04','Resultado']].map(([key,n,label])=><figure key={key}><img src={media(key)} alt={label}/><figcaption><span>{n}</span><b>{label}</b></figcaption></figure>)}
     </div>
    </div>
   </section>

   <section className="course-angles">
    <div className="course-wrap">
     <div className="course-section-heading"><span>UMA HABILIDADE. VÁRIOS MOTIVOS PARA APRENDER.</span><h2>O valor não está só em “mexer com IA”. Está no que você passa a conseguir criar.</h2></div>
     <div className="course-angle-grid">
      <article><Zap/><h3>Comece sem saber 3D</h3><p>Você não precisa se tornar animador técnico antes de produzir seu primeiro projeto.</p></article>
      <article><Film/><h3>Produza acima da sua estrutura</h3><p>Crie sozinho peças que visualmente parecem exigir uma operação muito maior.</p></article>
      <article><Layers/><h3>Aprenda uma habilidade aplicável</h3><p>Primeiro aprenda a criar. Depois você decide se usa em portfólio, conteúdo ou projetos profissionais.</p></article>
      <article><MonitorPlay/><h3>Transforme tela em criação</h3><p>Para pais e jovens criativos, a tecnologia deixa de ser apenas consumo e passa a ser ferramenta de construção.</p></article>
     </div>
    </div>
   </section>

   <section className="course-curriculum">
    <div className="course-wrap">
     <div className="course-section-heading course-heading-split"><div><span>4 MÓDULOS · 10 AULAS</span><h2>Curto para terminar. Completo para criar.</h2></div><p>Sem aulas de preenchimento. Cada vídeo existe porque move o mesmo projeto um passo à frente.</p></div>
     <div className="course-curriculum-grid">{lessons.map(item=><article key={item.n}><div className="course-module-top"><span>{item.n}</span><b>{item.count}</b></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </div>
   </section>

   <section className="course-who">
    <div className="course-wrap course-who-grid">
     <div className="course-section-heading"><span>PARA QUEM É</span><h2>Se uma dessas frases parece com você, o curso foi desenhado para reduzir sua distância até o primeiro projeto.</h2></div>
     <div className="course-who-list">
      <div><CheckCircle2/><span><b>“Sempre achei 3D interessante, mas complexo demais.”</b> Comece pela direção com IA.</span></div>
      <div><CheckCircle2/><span><b>“Quero aprender uma habilidade que possa ter aplicação prática.”</b> Você aprende a criar a peça — sem promessa de dinheiro fácil.</span></div>
      <div><CheckCircle2/><span><b>“Já edito, crio conteúdo ou trabalho com design.”</b> Adicione uma nova linguagem ao seu repertório.</span></div>
      <div><CheckCircle2/><span><b>“Quero que meu filho use tecnologia para criar.”</b> O conteúdo pode ser acompanhado em conjunto por um responsável.</span></div>
     </div>
    </div>
   </section>

   <section className="course-offer" id="oferta">
    <div className="course-wrap course-offer-grid">
     <div className="course-offer-copy"><span>OFERTA DE ENTRADA</span><h2>Uma habilidade nova custa menos que uma noite pedindo delivery.</h2><p>Entre no treinamento, acompanhe o projeto inteiro e descubra na prática se animação 3D com IA faz sentido para você.</p><div className="course-offer-list"><div><Check/>4 módulos objetivos</div><div><Check/>10 aulas práticas</div><div><Check/>Projeto guiado de 30s–1min</div><div><Check/>Compra vinculada à sua conta</div><div><Check/>Pagamento seguro via Pix</div></div></div>
     <div className="course-checkout-card">
      <div className="course-checkout-badge">ACESSO AO TREINAMENTO</div>
      <h3>{offer.title}</h3>
      <p>Da ideia à animação final, sem exigir domínio prévio de 3D tradicional.</p>
      <div className="course-checkout-price"><span>pagamento único</span><strong>{brl(offer.price_brl_cents)}</strong><small>via Pix</small></div>
      <button className="course-primary course-primary-block" disabled={!offer.checkout_enabled} onClick={()=>openCheckout('offer')}>{offer.checkout_enabled?'Quero começar agora':'Inscrições indisponíveis'} {offer.checkout_enabled&&<ArrowRight/>}</button>
      <div className="course-secure"><ShieldCheck/><span>Processamento seguro pelo Mercado Pago. Confirmação automática.</span></div>
     </div>
    </div>
   </section>

   <section className="course-faq">
    <div className="course-wrap">
     <div className="course-section-heading"><span>DÚVIDAS ANTES DE ENTRAR</span><h2>Perguntas frequentes.</h2></div>
     <div className="course-faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<ChevronDown/></summary><p>{a}</p></details>)}</div>
    </div>
   </section>

   <section className="course-final">
    <div className="course-wrap course-final-box"><div><span>COMECE PELO PRIMEIRO PROJETO</span><h2>Você não precisa dominar 3D. Precisa começar a dirigir a criação.</h2><p>Faça o curso, construa sua primeira peça e leve o processo para as próximas ideias.</p></div><div className="course-final-action"><strong>{brl(offer.price_brl_cents)}</strong><button className="course-primary course-primary-lg" onClick={()=>openCheckout('final')}>Quero criar minha primeira animação <ArrowRight/></button></div></div>
   </section>
  </main>

  <footer className="course-footer"><div className="course-wrap"><BrandMark compact/><p>IA Connect · Treinamento de Animação 3D com IA</p></div></footer>

  <div className="course-mobile-bar"><div><span>Pagamento único</span><strong>{brl(offer.price_brl_cents)}</strong></div><button onClick={()=>openCheckout('mobile_sticky')}>Quero começar <ArrowRight/></button></div>

  {checkoutOpen&&<div className="course-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCheckoutOpen(false)}}>
   <div className="course-modal" role="dialog" aria-modal="true" aria-label="Checkout do curso">
    <div className="course-modal-head"><div><span>CHECKOUT SEGURO</span><h2>{offer.title}</h2></div><button onClick={()=>setCheckoutOpen(false)} aria-label="Fechar"><X/></button></div>
    <div className="course-modal-summary"><div><b>Treinamento completo</b><span>4 módulos · 10 aulas · projeto guiado</span></div><strong>{brl(offer.price_brl_cents)}</strong></div>

    {accessActive?<div className="course-checkout-success"><div className="course-success-icon"><CheckCircle2/></div><h3>Seu acesso já está confirmado.</h3><p>Esta compra está vinculada à sua conta do IA Connect.</p><button className="course-primary course-primary-block" onClick={()=>setCheckoutOpen(false)}>Continuar</button></div>
    :!user?<div className="course-auth-step">
      <div className="course-auth-tabs"><button className={authMode==='register'?'is-active':''} onClick={()=>{setAuthMode('register');setAuthError('')}}>Criar conta</button><button className={authMode==='login'?'is-active':''} onClick={()=>{setAuthMode('login');setAuthError('')}}>Já tenho conta</button></div>
      <p className="course-auth-note">Sua compra fica vinculada à conta para liberar o acesso automaticamente após o pagamento.</p>
      {authError&&<div className="course-error">{authError}</div>}
      <form onSubmit={handleAuth}>
       {authMode==='register'&&<label><span>Nome</span><div><User/><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Seu nome"/></div></label>}
       <label><span>E-mail</span><div><Mail/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com"/></div></label>
       <label><span>Senha</span><div><Lock/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Mínimo de 6 caracteres"/></div></label>
       {authMode==='register'&&<label><span>Confirmar senha</span><div><Lock/><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required placeholder="Repita a senha"/></div></label>}
       <button className="course-primary course-primary-block" disabled={authLoading}>{authLoading?<><Loader2 className="course-spin"/>Aguarde...</>:<>Continuar para o pagamento <ArrowRight/></>}</button>
      </form>
     </div>
    :!payment?<div className="course-payment-start">
      <div className="course-payment-user"><CheckCircle2/><div><b>Conta pronta</b><span>{user.email}</span></div></div>
      <div className="course-payment-method"><div className="course-pix-mark">PIX</div><div><b>Pix · confirmação automática</b><span>O código expira em aproximadamente 30 minutos.</span></div><Check/></div>
      {paymentError&&<div className="course-error">{paymentError}</div>}
      <button className="course-primary course-primary-block" disabled={creating} onClick={createPix}>{creating?<><Loader2 className="course-spin"/>Gerando Pix...</>:<>Gerar Pix de {brl(offer.price_brl_cents)} <ArrowRight/></>}</button>
      <div className="course-modal-security"><ShieldCheck/>Processamento financeiro pelo Mercado Pago. O IA Connect não recebe sua senha bancária.</div>
     </div>
    :payment.status==='CONFIRMED'?<div className="course-checkout-success"><div className="course-success-icon"><CheckCircle2/></div><h3>Pagamento confirmado.</h3><p>Seu acesso ao treinamento foi vinculado à conta <b>{user.email}</b>.</p><button className="course-primary course-primary-block" onClick={()=>setCheckoutOpen(false)}>Continuar</button></div>
    :payment.status==='FAILED'||payment.status==='EXPIRED'?<div className="course-checkout-success is-error"><div className="course-success-icon"><X/></div><h3>{payment.status==='EXPIRED'?'Este Pix expirou.':'O pagamento não foi concluído.'}</h3><p>Você pode gerar um novo código sem perder sua conta ou a oferta.</p><button className="course-primary course-primary-block" onClick={()=>{setPayment(null);setPaymentError('')}}>Gerar outro Pix</button></div>
    :<div className="course-pix-step">
      <div className="course-pix-status"><span>Aguardando pagamento</span><b><Clock3/>{remainingText}</b></div>
      {payment.pix_qr_code_base64&&<img className="course-qr" src={payment.pix_qr_code_base64.startsWith('data:')?payment.pix_qr_code_base64:`data:image/png;base64,${payment.pix_qr_code_base64}`} alt="QR Code Pix"/>}
      <p>Abra o app do seu banco, escaneie o QR Code ou copie o código Pix abaixo.</p>
      {payment.pix_code&&<div className="course-pix-code"><code>{payment.pix_code}</code><button onClick={copyPix}>{copied?<CheckCircle2/>:<Copy/>}{copied?'Copiado':'Copiar'}</button></div>}
      <div className="course-pix-wait"><Loader2 className="course-spin"/><span>Estamos verificando automaticamente. Não feche esta janela.</span></div>
     </div>}
   </div>
  </div>}
 </div>;
};
