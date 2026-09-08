import React from 'react';
import { FolderOpen, UploadCloud } from 'lucide-react';
import { Card } from '../common/Card.js';
import { EmptyState } from '../common/EmptyState.js';

export const AssetsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Biblioteca de Assets
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Vídeos e imagens gerados e mídias de referência para prompts
        </p>
      </div>

      <Card id="assets-container-card">
        <EmptyState
          id="empty-assets-view"
          icon={<FolderOpen className="w-6 h-6" />}
          title="Nenhum asset armazenado"
          description="Os arquivos multimídia resultantes de gerações e referências com @ serão organizados aqui com metadados de resolução, tamanho e formato na Etapa 2."
        />
      </Card>
    </div>
  );
};
