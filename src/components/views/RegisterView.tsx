import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { authService } from '../../services/authService.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';

interface RegisterViewProps {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onSwitchToLogin,
  onSuccess,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      await authService.register(email, password, displayName);
      onSuccess();
    } catch (err: any) {
      let msg = err.message || 'Falha ao registrar conta.';
      if (msg.includes('email-already-in-use')) {
        msg = 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
      } else if (msg.includes('invalid-email')) {
        msg = 'O formato do e-mail é inválido.';
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
            Criar Nova Conta
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Inicie sua jornada na plataforma de geração de conteúdo
          </p>
        </div>

        <Card id="register-card" className="shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="register-name-input"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="register-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>

            <Button
              id="register-submit-button"
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Criar Conta e Acessar
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-500">
              Já possui cadastro?{' '}
              <button
                id="switch-to-login-btn"
                onClick={onSwitchToLogin}
                className="font-semibold text-zinc-900 hover:underline cursor-pointer"
              >
                Fazer login
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
