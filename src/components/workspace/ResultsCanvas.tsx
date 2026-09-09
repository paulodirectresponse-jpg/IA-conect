import React from 'react';
import { Generation, WorkspacePreset } from '../../types/index.js';
import { CreationGallery } from './CreationGallery.js';

interface Props {
  lastSavedTime: string | null;
  validating: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  onOpenPresets: () => void;
  presets: WorkspacePreset[];
  onApplyPreset: (preset: WorkspacePreset) => void;
  prompt: string;
  hasReferences: boolean;
  onRestoreGeneration?: (generation: Generation) => void;
}

export const ResultsCanvas: React.FC<Props> = ({ lastSavedTime, onRestoreGeneration }) => (
  <CreationGallery
    defaultFilter="VIDEO"
    title="Minhas criações"
    subtitle={lastSavedTime ? `Projeto salvo ${lastSavedTime}` : 'Vídeos, imagens e histórico do seu studio.'}
    onRestoreGeneration={onRestoreGeneration}
  />
);