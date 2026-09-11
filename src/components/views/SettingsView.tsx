import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const SettingsView: React.FC = () => {
  const { profile, isAdmin, claimBootstrapAdmin, logout } = useAuth();
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const handleClaimAdmin = async () => {
    setBootstrapLoading(true); setBootstrapMessage(null); setBootstrapError(null);
    try { await claimBootstrapAdmin(bootstrapSecret.trim() || undefined); setBootstrapMessage('Permissões administrativas concedidas.'); }
    catch (err: any) { setBootstrapError(err.message || 'Falha ao reivindicar bootstrap de administrador.'); }
    finally { setBootstrapLoading(false); }
  };

  const initial = profile?.display_name?.charAt(0).toUpperCase() || 'U';
  const panel = 'ia-operate-panel rounded-2xl';

  return (
    <div className="ia-settings max-w-5xl mx-auto space-y-6">
      <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300">Conta</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Perfil e configurações</h1><p className="mt-1 text-xs text-zinc-600">Gerencie sua identidade, segurança e permissões do studio.</p></div>

      <div className={`${panel} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 p-[1px]"><div className="w-full h-full rounded-2xl bg-[#0d1117] flex items-center justify-center text-lg font-black text-white">{initial}</div></div>
          <div className="min-w-0 flex-1"><h2 className="text-base font-bold text-white truncate">{profile?.display_name || 'Usuário'}</h2><p className="text-[11px] text-zinc-500 truncate">{profile?.email}</p></div>
          <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400"><ShieldCheck className="w-3 h-3 text-emerald-400"/>{profile?.role || 'USER'}</div>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5"><div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500"><UserRound className="w-3.5 h-3.5"/> Identidade</div><p className="mt-2 text-[11px] font-medium text-zinc-300">{profile?.display_name || '—'}</p><p className="mt-0.5 text-[10px] text-zinc-600">{profile?.email || '—'}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5"><div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500"><Fingerprint className="w-3.5 h-3.5"/> Identificador</div><p className="mt-2 text-[10px] font-mono text-zinc-400 break-all select-all">{profile?.user_id || '—'}</p></div>
        </div>
      </div>

      {!isAdmin && (
        <div className={`${panel} p-5`}>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-400"/><h2 className="text-sm font-bold text-white">Bootstrap administrativo</h2></div>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Use apenas no provisionamento inicial da plataforma.</p>
          <input type="password" value={bootstrapSecret} onChange={(e) => setBootstrapSecret(e.target.value)} placeholder="ADMIN_BOOTSTRAP_SECRET (opcional)" className="mt-4 w-full h-10 px-3 rounded-xl border border-white/[0.07] bg-white/[0.03] text-xs text-zinc-300 font-mono outline-none focus:border-sky-400/30"/>
          {bootstrapMessage && <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] px-3 py-2.5 text-[10px] text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5"/>{bootstrapMessage}</div>}
          {bootstrapError && <div className="mt-3 rounded-xl border border-rose-400/10 bg-rose-400/[0.06] px-3 py-2.5 text-[10px] text-rose-300 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5"/>{bootstrapError}</div>}
          <button disabled={bootstrapLoading} onClick={handleClaimAdmin} className="mt-3 h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[10px] font-semibold text-zinc-300 hover:bg-white/[0.07] disabled:opacity-50">{bootstrapLoading ? 'Processando...' : 'Reivindicar primeiro administrador'}</button>
        </div>
      )}

      <div className={`${panel} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}><div><h2 className="text-sm font-bold text-white">Sessão e segurança</h2><p className="mt-1 text-[10px] text-zinc-600">Encerre o acesso com segurança neste dispositivo.</p></div><button onClick={logout} className="h-9 px-3.5 rounded-xl border border-rose-400/10 bg-rose-500/[0.06] text-[10px] font-semibold text-rose-300 hover:bg-rose-500/[0.1] flex items-center justify-center gap-1.5"><LogOut className="w-3.5 h-3.5"/> Sair da conta</button></div>
    </div>
  );
};
