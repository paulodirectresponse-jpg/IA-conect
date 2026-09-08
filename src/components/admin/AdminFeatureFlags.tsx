import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, Lock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { FeatureFlag } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminFeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  // Toggle modal state
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [targetState, setTargetState] = useState(false);
  const [reason, setReason] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = async () => {
    try {
      setLoading(true);
      const res = await adminService.listFeatureFlags();
      setFlags(res);
    } catch (err) {
      console.error('Falha ao carregar feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleInitiateToggle = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setTargetState(!flag.is_enabled);
    setReason('');
    setError(null);
    setModalOpen(true);
  };

  const handleConfirmToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlag) return;
    setError(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setError('A justificativa é obrigatória para a trilha de auditoria.');
      return;
    }

    setSaveLoading(true);
    try {
      await adminService.toggleFeatureFlag(selectedFlag.flag_key, targetState, reason);
      setModalOpen(false);
      loadFlags();
    } catch (err: any) {
      setError(err.message || 'Falha ao alterar estado da flag.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Feature Flags & Governança de Módulos</h2>
        <p className="text-xs text-zinc-500">Ativação granular de capacidades e recursos com registro em auditoria</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-8 text-center text-xs text-zinc-400">Carregando feature flags...</div>
        ) : (
          flags.map((f) => (
            <Card key={f.flag_key} id={`flag-card-${f.flag_key}`} className="bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 text-sm">{f.name}</span>
                    {f.is_private && (
                      <Badge variant="neutral" className="text-[10px]">
                        <Lock className="w-2.5 h-2.5 text-zinc-400" />
                        Privada (Admin Only)
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{f.description}</p>
                  <span className="text-[10px] font-mono text-zinc-400 block pt-1">{f.flag_key}</span>
                </div>

                <button
                  id={`btn-toggle-flag-${f.flag_key}`}
                  type="button"
                  onClick={() => handleInitiateToggle(f)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    f.is_enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-400 hover:text-zinc-600'
                  }`}
                  title={f.is_enabled ? 'Clique para desativar' : 'Clique para ativar'}
                >
                  {f.is_enabled ? (
                    <ToggleRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        id="flag-toggle-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={targetState ? 'Ativar Feature Flag' : 'Desativar Feature Flag'}
        description={selectedFlag?.name}
      >
        <form onSubmit={handleConfirmToggle} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <span className="font-semibold text-zinc-900 block mb-1">
              Novo Estado: {targetState ? 'ATIVADO (Habilitado)' : 'DESATIVADO (Bloqueado)'}
            </span>
            <p className="text-zinc-500">
              Esta alteração entra em vigor imediatamente para todos os clientes conectados.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">
              Justificativa Obrigatória (Auditoria)
            </label>
            <textarea
              id="flag-reason-textarea"
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Habilitação controlada para validação em ambiente de staging..."
              className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-none"
            />
          </div>

          <Button
            id="confirm-flag-toggle-btn"
            type="submit"
            variant={targetState ? 'primary' : 'danger'}
            size="md"
            isLoading={saveLoading}
            className="w-full"
          >
            Confirmar Alteração da Flag
          </Button>
        </form>
      </Modal>
    </div>
  );
};
