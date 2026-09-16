import{onAuthStateChanged}from'firebase/auth';
import{auth}from'../config/firebase.js';

export function probeAuthenticatedSession(timeoutMs=5000):Promise<boolean>{
 return new Promise((resolve)=>{
  let settled=false,timer:number|undefined,unsubscribe=()=>{};
  const finish=(value:boolean)=>{
   if(settled)return;
   settled=true;
   if(timer)window.clearTimeout(timer);
   unsubscribe();
   resolve(value);
  };
  unsubscribe=onAuthStateChanged(auth,(user)=>finish(Boolean(user)),()=>finish(false));
  timer=window.setTimeout(()=>finish(Boolean(auth.currentUser)),timeoutMs);
 });
}
