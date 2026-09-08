import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/authService.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';

interface LoginViewProps {
  onSwitchToRegister: () => void;
  onSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onSwitchToRegister,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isResetMode) {
        await authService.resetPassword(email);
        setResetSent(true);
      } else {
        await authService.login(email, password);
        onSuccess?.();
      }
    } catch (err: any) {
      let msg = err.message || 'Falha ao autenticar.';
      if (msg.includes('USER_SUSPENDED') || msg.toLowerCase().includes('suspens')) {
        msg = 'Sua conta está suspensa. Entre em contato com o suporte para mais informações.';
      } else if (msg.includes('invalid-credential') || msg.includes('user-not-found') || msg.includes('wrong-password')) {
        msg = 'E-mail ou senha incorretos.';
      } else if (msg.includes('too-many-requests')) {
        msg = 'Muitas tentativas sem sucesso. Aguarde alguns instantes.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 text-zinc-50 font-bold text-lg mb-3 shadow-xs">
            AI
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Plataforma de Geração IA
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isResetMode
              ? 'Digite seu e-mail para redefinir a senha'
              : 'Acesse seu painel com segurança e rastreabilidade total'}
          </p>
        </div>

        <Card id="login-card" className="shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium leading-relaxed">
              {error}
            </div>
          )}

          {resetSent ? (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">E-mail de recuperação enviado!</h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                Verifique sua caixa de entrada ({email}) para prosseguir com a nova senha.
              </p>
              <Button
                id="back-to-login-btn"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsResetMode(false);
                  setResetSent(false);
                }}
              >
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                  />
                </div>
              </div>

              {!isResetMode && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsResetMode(true)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 font-medium cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password-input"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                    />
                  </div>
                </div>
              )}

              <Button
                id="login-submit-button"
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                className="w-full mt-2"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {isResetMode ? 'Enviar Link de Redefinição' : 'Entrar na Plataforma'}
              </Button>

              {isResetMode && (
                <button
                  type="button"
                  onClick={() => setIsResetMode(false)}
                  className="w-full text-center text-xs text-zinc-500 hover:text-zinc-800 py-1 font-medium cursor-pointer"
                >
                  Cancelar e retornar
                </button>
              )}
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-500">
              Não possui uma conta?{' '}
              <button
                id="switch-to-register-btn"
                onClick={onSwitchToRegister}
                className="font-semibold text-zinc-900 hover:underline cursor-pointer"
              >
                Criar conta gratuita
              </button>
            </p>
          </div>
        </Card>

        <div className="mt-6 text-center text-[11px] text-zinc-400">
          Segurança Avançada, Arquitetura e Ledger Financeiro Imutável
        </div>
      </div>
    </div>
  );
};
