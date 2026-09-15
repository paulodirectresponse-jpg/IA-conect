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
    catch (err: any) { setBootstrapError(err.message || 'Não foi possível concluir a configuração inicial de administrador.'); }
    finally { setBootstrapLoading(false); }
  };

  const initial = profile?.display_name?.charAt(0).toUpperCase() || 'U';
  const panel = 'ia-operate-panel rounded-[14px]';

  return (
    <div className="ia-settings max-w-5xl mx-auto space-y-7">
      <header className="ia-view-header">
        <h1 className="ia-view-title">Perfil e configurações</h1>
        <p className="ia-view-description">Gerencie sua identidade, segurança e permissões do estúdio.</p>
      </header>

      <section className={`${panel} ia-settings-profile p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="ia-settings-avatar">{initial}</div>
          <div className="min-w-0 flex-1"><h2 className="text-[16px] font-semibold tracking-[-.015em] text-white truncate">{profile?.display_name || 'Usuário'}</h2><p className="mt-1 text-[12px] text-zinc-500 truncate">{profile?.email}</p></div>
          <div className="ia-settings-role"><ShieldCheck className="w-3.5 h-3.5"/>{profile?.role || 'USER'}</div>
        </div>
        <div className="ia-settings-details mt-6 grid grid-cols-1 md:grid-cols-2">
          <div><div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500"><UserRound className="w-3.5 h-3.5"/> Identidade</div><p className="mt-2 text-[12px] font-medium text-zinc-300">{profile?.display_name || '—'}</p><p className="mt-1 text-[11px] text-zinc-600">{profile?.email || '—'}</p></div>
          <div><div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500"><Fingerprint className="w-3.5 h-3.5"/> Identificador</div><p className="mt-2 text-[11px] font-mono text-zinc-400 break-all select-all">{profile?.user_id || '—'}</p></div>
        </div>
      </section>

      {!isAdmin && (
        <section className={`${panel} p-5 sm:p-6`}>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-400"/><h2 className="text-[14px] font-semibold text-white">Configuração administrativa inicial</h2></div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Use esta opção apenas na configuração inicial da plataforma.</p>
          <input type="password" aria-label="Chave de configuração administrativa" value={bootstrapSecret} onChange={(e) => setBootstrapSecret(e.target.value)} placeholder="ADMIN_BOOTSTRAP_SECRET (opcional)" className="mt-4 w-full h-11 px-3 rounded-[10px] border border-white/[0.07] bg-white/[0.03] text-xs text-zinc-300 font-mono outline-none focus:border-sky-400/30"/>
          {bootstrapMessage && <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] px-3 py-2.5 text-[11px] text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5"/>{bootstrapMessage}</div>}
          {bootstrapError && <div className="mt-3 rounded-xl border border-rose-400/10 bg-rose-400/[0.06] px-3 py-2.5 text-[11px] text-rose-300 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5"/>{bootstrapError}</div>}
          <button disabled={bootstrapLoading} onClick={handleClaimAdmin} className="ia-settings-secondary-action mt-3">{bootstrapLoading ? 'Processando...' : 'Ativar primeiro administrador'}</button>
        </section>
      )}

      <section className={`${panel} p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div><h2 className="text-[14px] font-semibold text-white">Sessão e segurança</h2><p className="mt-1.5 text-[11px] text-zinc-500">Encerre o acesso com segurança neste dispositivo.</p></div>
        <button onClick={logout} className="ia-settings-danger-action"><LogOut className="w-3.5 h-3.5"/> Sair da conta</button>
      </section>
    </div>
  );
};
