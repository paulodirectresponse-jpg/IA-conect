import React,{Suspense,lazy,useEffect,useState}from'react';
import{PublicLandingView}from'./components/views/PublicLandingView.js';

type PublicView='landing'|'login'|'register';

const LoginView=lazy(()=>Promise.all([
 import('./styles/fullAppStyles.js'),
 import('./components/views/LoginView.js'),
]).then(([,m])=>({default:m.LoginView})));

const RegisterView=lazy(()=>Promise.all([
 import('./styles/fullAppStyles.js'),
 import('./components/views/RegisterView.js'),
]).then(([,m])=>({default:m.RegisterView})));

const AuthenticatedApp=lazy(()=>import('./App.js').then(m=>({default:m.default})));
const CourseAnimationSalesPage=lazy(()=>import('./components/views/CourseAnimationSalesPage.js').then(m=>({default:m.CourseAnimationSalesPage})));

const LoadingCard=()=> <div className="public-auth-loading"><div className="public-auth-spinner"/><span>Carregando acesso seguro</span></div>;

export default function PublicApp(){
 const[view,setView]=useState<PublicView>('landing');
 const[authenticated,setAuthenticated]=useState(false);
 const isCourseRoute=typeof window!=='undefined'&&/^\/curso\/animacao-3d\/?$/.test(window.location.pathname);

 useEffect(()=>{
  const applyAction=(action:string)=>{if(action==='login')setView('login');else if(action==='register')setView('register')};
  const onAction=(event:Event)=>applyAction(String((event as CustomEvent<string>).detail||''));
  const pending=String((window as any).__IA_PUBLIC_ACTION__||'');
  if(pending){(window as any).__IA_PUBLIC_ACTION__='';applyAction(pending)}
  window.addEventListener('ia:public-action',onAction);
  return()=>window.removeEventListener('ia:public-action',onAction);
 },[]);

 useEffect(()=>{
  const shell=document.getElementById('public-shell');
  if(shell)shell.hidden=isCourseRoute||authenticated||view!=='landing';
 },[authenticated,view,isCourseRoute]);

 useEffect(()=>{
  if(authenticated||view!=='landing')return;
  const shell=document.getElementById('public-shell');
  const host=shell?.querySelector('.public-hero');
  if(!host)return;
  let video:HTMLVideoElement|null=null;
  const start=()=>{
    if(video)return;
    video=document.createElement('video');
    video.className='public-hero-video is-ready';
    video.src='https://hzjyhhenajbjxkwkmzdg.supabase.co/storage/v1/object/public/ia-conect-assets/showcase/Hero.mp4';
    video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';
    const overlay=host.querySelector('.public-hero-overlay');
    host.insertBefore(video,overlay||null);
    void video.play().catch(()=>{});
    window.removeEventListener('pointerdown',start);
    window.removeEventListener('keydown',start);
    window.removeEventListener('scroll',start);
  };
  window.addEventListener('pointerdown',start,{once:true});
  window.addEventListener('keydown',start,{once:true});
  window.addEventListener('scroll',start,{once:true,passive:true});
  return()=>{
    window.removeEventListener('pointerdown',start);
    window.removeEventListener('keydown',start);
    window.removeEventListener('scroll',start);
    if(video){video.pause();video.remove();video=null}
  };
 },[authenticated,view]);

 useEffect(()=>{
  let cancelled=false,timer:number|undefined;
  const probe=()=>{timer=window.setTimeout(()=>{void import('./services/authSessionProbe.js').then(m=>m.probeAuthenticatedSession()).then((ok)=>{if(!cancelled&&ok)setAuthenticated(true)}).catch(()=>{})},0)};
  if(document.readyState==='complete')probe();
  else window.addEventListener('load',probe,{once:true});
  return()=>{cancelled=true;window.removeEventListener('load',probe);if(timer)window.clearTimeout(timer)};
 },[]);

 if(isCourseRoute)return <Suspense fallback={<LoadingCard/>}><CourseAnimationSalesPage/></Suspense>;
 if(authenticated)return <Suspense fallback={<LoadingCard/>}><AuthenticatedApp onSignedOut={()=>{setAuthenticated(false);setView('landing')}}/></Suspense>;
 if(view==='login')return <Suspense fallback={<LoadingCard/>}><LoginView onSwitchToRegister={()=>setView('register')} onSuccess={()=>setAuthenticated(true)}/></Suspense>;
 if(view==='register')return <Suspense fallback={<LoadingCard/>}><RegisterView onSwitchToLogin={()=>setView('login')} onSuccess={()=>setAuthenticated(true)}/></Suspense>;
 return <PublicLandingView includeShell={false} onLogin={()=>setView('login')} onStart={()=>setView('register')}/>;
}
