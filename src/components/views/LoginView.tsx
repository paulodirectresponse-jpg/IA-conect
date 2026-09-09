import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/authService.js';
import { BrandMark } from '../common/BrandMark.js';

interface LoginViewProps { onSwitchToRegister: () => void; onSuccess?: () => void; }

export const LoginView: React.FC<LoginViewProps> = ({ onSwitchToRegister, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      if (isResetMode) { await authService.resetPassword(email); setResetSent(true); }
      else { await authService.login(email, password); onSuccess?.(); }
    } catch (err: any) {
      let msg = err.message || 'Falha ao autenticar.';
      if (msg.includes('USER_SUSPENDED') || msg.toLowerCase().includes('suspens')) msg = 'Sua conta está suspensa. Entre em contato com o suporte.';
      else if (msg.includes('invalid-credential') || msg.includes('user-not-found') || msg.includes('wrong-password')) msg = 'E-mail ou senha incorretos.';
      else if (msg.includes('too-many-requests')) msg = 'Muitas tentativas sem sucesso. Aguarde alguns instantes.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const fieldClass='w-full h-11 pl-9 pr-3 rounded-xl bg-sky-300/[0.025] border border-sky-300/[0.10] text-sm text-white placeholder:text-zinc-700 outline-none focus:border-sky-300/40 focus:ring-2 focus:ring-sky-400/10';

  return <div className="min-h-screen bg-[radial-gradient(circle_at_25%_10%,rgba(25,184,255,.14),transparent_30%),radial-gradient(circle_at_76%_88%,rgba(82,119,255,.12),transparent_28%),#050a10] flex items-center justify-center p-5 text-zinc-100"><div className="w-full max-w-[420px]"><div className="mb-7 flex justify-center"><BrandMark/></div><div className="rounded-[22px] border border-sky-300/[0.10] bg-[#08131e]/96 backdrop-blur-xl p-6 sm:p-7 shadow-[0_30px_100px_rgba(0,0,0,.45)]"><div className="mb-6"><h1 className="text-xl font-bold tracking-tight text-white">{isResetMode?'Recuperar acesso':'Bem-vindo de volta'}</h1><p className="mt-1 text-xs text-zinc-500">{isResetMode?'Enviaremos um link seguro para o seu e-mail.':'Entre no seu creative studio.'}</p></div>{error&&<div className="mb-4 rounded-xl border border-rose-400/15 bg-rose-500/[0.08] px-3 py-2.5 text-[11px] text-rose-300">{error}</div>}{resetSent?<div className="text-center py-4"><div className="w-11 h-11 rounded-2xl bg-sky-300/[0.08] text-sky-300 border border-sky-300/[0.12] flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-5 h-5"/></div><h3 className="text-sm font-semibold text-white">Link enviado</h3><p className="text-xs text-zinc-500 mt-1 mb-5">Confira {email} para redefinir sua senha.</p><button onClick={()=>{setIsResetMode(false);setResetSent(false)}} className="w-full py-2.5 rounded-xl border border-sky-300/[0.10] bg-sky-300/[0.03] text-xs font-semibold hover:bg-sky-300/[0.07]">Voltar ao login</button></div>:<form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-[10px] font-semibold text-zinc-400 mb-1.5">E-mail</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" className={fieldClass}/></div></div>{!isResetMode&&<div><div className="flex items-center justify-between mb-1.5"><label className="text-[10px] font-semibold text-zinc-400">Senha</label><button type="button" onClick={()=>setIsResetMode(true)} className="text-[10px] font-medium text-sky-300 hover:text-sky-200">Esqueceu a senha?</button></div><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className={fieldClass}/></div></div>}<button type="submit" disabled={loading} className="ia-primary w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading?'Aguarde...':isResetMode?'Enviar link':'Entrar'} {!loading&&<ArrowRight className="w-4 h-4"/>}</button>{isResetMode&&<button type="button" onClick={()=>setIsResetMode(false)} className="w-full text-[10px] text-zinc-500 hover:text-zinc-300">Cancelar</button>}</form>}<div className="mt-6 pt-5 border-t border-sky-300/[0.07] text-center"><p className="text-[11px] text-zinc-600">Ainda não possui conta? <button onClick={onSwitchToRegister} className="font-semibold text-sky-300 hover:text-sky-200">Criar conta</button></p></div></div><p className="mt-5 text-center text-[9px] uppercase tracking-[0.16em] text-zinc-700">IA Connect · Creative AI Studio</p></div></div>;
};