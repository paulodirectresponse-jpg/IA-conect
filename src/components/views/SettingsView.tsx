import React, { useState } from 'react';
import { User, ShieldCheck, Key, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';

export const SettingsView: React.FC = () => {
  const { profile, isAdmin, claimBootstrapAdmin, logout } = useAuth();
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const handleClaimAdmin = async () => {
    setBootstrapLoading(true);
    setBootstrapMessage(null);
    setBootstrapError(null);
    try {
      await claimBootstrapAdmin(bootstrapSecret.trim() || undefined);
      setBootstrapMessage('Permissões de Administrador concedidas com sucesso!');
    } catch (err: any) {
      setBootstrapError(err.message || 'Falha ao reivindicar bootstrap de administrador.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Configurações da Conta
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Gerenciamento de credenciais, permissões de acesso e identificação
        </p>
      </div>

      {/* Profile Details Card */}
      <Card id="settings-profile-card" title="Perfil do Usuário">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">Nome de Exibição</span>
            <span className="font-semibold text-zinc-900 text-sm">{profile?.display_name || '—'}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">E-mail Cadastrado</span>
            <span className="font-semibold text-zinc-900 text-sm">{profile?.email || '—'}</span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">Identificador de Usuário (UID)</span>
            <span className="font-mono text-zinc-700 bg-zinc-100 px-2 py-1 rounded text-[11px] select-all block break-all">
              {profile?.user_id || '—'}
            </span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">Papel no Sistema (Role)</span>
            <div className="flex items-center gap-2">
              <Badge variant={isAdmin ? 'warning' : 'neutral'}>
                {profile?.role || 'USER'}
              </Badge>
              {isAdmin && <span className="text-[11px] text-zinc-500 font-medium">Acesso Total ao Painel</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Admin Bootstrap Helper Section */}
      {!isAdmin && (
        <Card
          id="settings-bootstrap-card"
          title="Bootstrap Administrativo"
          subtitle="Procedimento de configuração inicial da plataforma"
        >
          <div className="space-y-3 text-xs text-zinc-600">
            <p className="leading-relaxed">
              Caso você seja o responsável técnico ou o administrador inicial desta instância e nenhum administrador tenha sido designado ainda, você pode acionar o bootstrap do primeiro admin abaixo.
            </p>

            <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg space-y-2">
              <label className="block text-[11px] font-semibold text-zinc-700">
                Segredo Técnico de Bootstrap (Opcional)
              </label>
              <input
                id="bootstrap-secret-input"
                type="password"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="Informe se configurado no servidor (ADMIN_BOOTSTRAP_SECRET)"
                className="w-full p-2 bg-white border border-zinc-300 rounded text-xs text-zinc-900 font-mono"
              />
              <span className="text-[10px] text-zinc-500 block leading-tight">
                <strong>Nota de Segurança:</strong> O segredo de bootstrap é um token técnico de provisionamento do servidor, não a senha da sua conta de usuário.
              </span>
            </div>

            {bootstrapMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bootstrapMessage}</span>
              </div>
            )}

            {bootstrapError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{bootstrapError}</span>
              </div>
            )}

            <Button
              id="claim-admin-btn"
              variant="outline"
              size="sm"
              isLoading={bootstrapLoading}
              onClick={handleClaimAdmin}
              icon={<ShieldCheck className="w-4 h-4 text-amber-600" />}
            >
              Reivindicar Primeiro Administrador (Bootstrap)
            </Button>
          </div>
        </Card>
      )}

      {/* Security & Session */}
      <Card id="settings-session-card" title="Sessão & Segurança">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">Encerrar Sessão</h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Desconectar com segurança deste dispositivo
            </p>
          </div>
          <Button
            id="settings-logout-btn"
            variant="danger"
            size="sm"
            onClick={logout}
            icon={<LogOut className="w-4 h-4" />}
          >
            Sair da Conta
          </Button>
        </div>
      </Card>
    </div>
  );
};
