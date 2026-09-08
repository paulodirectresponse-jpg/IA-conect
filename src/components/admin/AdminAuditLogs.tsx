import React, { useEffect, useState } from 'react';
import { ShieldCheck, Filter, RefreshCw, Eye, Calendar } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { AuditLog } from '../../types/index.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await adminService.listAuditLogs(entityType);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Falha ao listar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityType]);

  const handleOpenDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Trilha de Auditoria Imutável</h2>
          <p className="text-xs text-zinc-500">Histórico criptográfico de todas as alterações administrativas e financeiras</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            id="audit-filter-entity"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="p-2 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900"
          >
            <option value="">Todas as Entidades</option>
            <option value="WALLET">WALLET (Ajustes de Saldo)</option>
            <option value="USER">USER (Status & Papéis)</option>
            <option value="PRICING">PRICING (Matriz de Preços)</option>
            <option value="FEATURE_FLAG">FEATURE_FLAG (Chaves)</option>
            <option value="PROVIDER">PROVIDER (Provedores)</option>
            <option value="MODEL">MODEL (Modelos)</option>
            <option value="PROMOTION">PROMOTION (Promoções)</option>
          </select>

          <Button
            id="btn-refresh-audit-logs"
            variant="outline"
            size="sm"
            onClick={loadLogs}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar ({total})
          </Button>
        </div>
      </div>

      <Card id="admin-audit-card">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Carregando registros de auditoria...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">Nenhum evento registrado ainda.</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-medium">
                  <th className="py-3 px-4 sm:px-6">Data / Hora</th>
                  <th className="py-3 px-4">Administrador</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Entidade</th>
                  <th className="py-3 px-4">Justificativa</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Comparar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4 sm:px-6 text-zinc-600 whitespace-nowrap tabular-nums">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900 whitespace-nowrap">
                      {log.admin_email}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="neutral">{log.action}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-700">{log.entity_type}</td>
                    <td className="py-3 px-4 max-w-xs text-zinc-600 truncate" title={log.reason}>
                      {log.reason}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <Button
                        id={`btn-view-audit-${log.log_id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetail(log)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Antes / Depois
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        id="audit-detail-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Detalhes da Auditoria"
        description={`Log ID: ${selectedLog?.log_id}`}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <div>
                <span className="text-zinc-500 block">Autor:</span>
                <span className="font-semibold text-zinc-900">{selectedLog.admin_email}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Ação Executada:</span>
                <span className="font-semibold text-zinc-900">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Entidade Alvo:</span>
                <span className="font-mono text-zinc-900">
                  {selectedLog.entity_type} ({selectedLog.entity_id})
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Data e Hora:</span>
                <span className="text-zinc-900">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div>
              <span className="font-semibold text-zinc-900 block mb-1">Justificativa do Autor:</span>
              <p className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 italic">
                "{selectedLog.reason}"
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-semibold text-zinc-900 block mb-1">Estado ANTES:</span>
                <pre className="p-3 bg-zinc-900 text-zinc-100 rounded-lg overflow-x-auto text-[11px] font-mono max-h-48">
                  {JSON.stringify(selectedLog.before || { status: 'INITIAL' }, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-zinc-900 block mb-1">Estado DEPOIS:</span>
                <pre className="p-3 bg-zinc-900 text-emerald-400 rounded-lg overflow-x-auto text-[11px] font-mono max-h-48">
                  {JSON.stringify(selectedLog.after || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
