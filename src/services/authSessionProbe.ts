import{onAuthStateChanged}from'firebase/auth';
import{auth}from'../config/firebase.js';

export function probeAuthenticatedSession(timeoutMs=5000):Promise<boolean>{
  return new Promise((resolve)=>{
    let settled=false;
    const finish=(value:boolean)=>{
      if(settled)return;
      settled=true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const unsubscribe=onAuthStateChanged(auth,(user)=>finish(Boolean(user)),()=>finish(false));
    const timer=window.setTimeout(()=>finish(Boolean(auth.currentUser)),timeoutMs);
  });
}
