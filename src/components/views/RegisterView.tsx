import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { authService } from '../../services/authService.js';
import { BrandMark } from '../common/BrandMark.js';

interface RegisterViewProps { onSwitchToLogin: () => void; onSuccess?: () => void; }

export const RegisterView: React.FC<RegisterViewProps> = ({ onSwitchToLogin, onSuccess }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (password.length < 6) return setError('A senha deve conter no mínimo 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas digitadas não coincidem.');
    setLoading(true);
    try { await authService.register(email, password, displayName); onSuccess?.(); }
    catch (err: any) {
      let msg = err.message || 'Falha ao registrar conta.';
      if (msg.includes('email-already-in-use')) msg = 'Este e-mail já está cadastrado.';
      else if (msg.includes('invalid-email')) msg = 'O formato do e-mail é inválido.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const fieldClass='w-full h-11 pl-9 pr-3 rounded-xl bg-sky-300/[0.025] border border-sky-300/[0.10] text-sm text-white placeholder:text-zinc-700 outline-none focus:border-sky-300/40 focus:ring-2 focus:ring-sky-400/10';

  return <div className="ia-auth ia-auth-register min-h-screen bg-[radial-gradient(circle_at_24%_9%,rgba(25,184,255,.14),transparent_30%),radial-gradient(circle_at_77%_88%,rgba(82,119,255,.12),transparent_28%),#050a10] flex items-center justify-center p-5 text-zinc-100"><div className="w-full max-w-[430px]"><div className="mb-7 flex justify-center"><BrandMark/></div><div className="ia-auth-card rounded-[22px] p-6 sm:p-7"><div className="mb-6"><h1 className="text-xl font-bold tracking-tight text-white">Criar sua conta</h1><p className="mt-1 text-xs text-zinc-500">Entre no ecossistema IA Connect.</p></div>{error&&<div className="mb-4 rounded-xl border border-rose-400/15 bg-rose-500/[0.08] px-3 py-2.5 text-[11px] text-rose-300">{error}</div>}<form onSubmit={handleSubmit} className="space-y-3.5"><div><label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Nome</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="text" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Seu nome" className={fieldClass}/></div></div><div><label className="block text-[10px] font-semibold text-zinc-400 mb-1.5">E-mail</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" className={fieldClass}/></div></div><div><label className="block text-[10px] font-semibold text-zinc-400 mb-1.5">Senha</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" className={fieldClass}/></div></div><div><label className="block text-[10px] font-semibold text-zinc-400 mb-1.5">Confirmar senha</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600"/><input type="password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repita a senha" className={fieldClass}/></div></div><button type="submit" disabled={loading} className="ia-primary w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading?'Criando conta...':'Criar conta'} {!loading&&<ArrowRight className="w-4 h-4"/>}</button></form><div className="mt-6 pt-5 border-t border-sky-300/[0.07] text-center"><p className="text-[11px] text-zinc-600">Já possui cadastro? <button onClick={onSwitchToLogin} className="font-semibold text-sky-300 hover:text-sky-200">Fazer login</button></p></div></div></div></div>;
};