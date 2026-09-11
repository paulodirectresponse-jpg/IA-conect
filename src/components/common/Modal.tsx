import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export interface ModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  id,
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  const enter = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };
  const exit = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 6 };
  const initial = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 6 };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.001 : 0.16 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            initial={initial}
            animate={enter}
            exit={exit}
            transition={{ duration: reduceMotion ? 0.001 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`ia-surface relative z-10 w-full ${widthClasses[maxWidth]} p-5 sm:p-6 shadow-[var(--ia-shadow-overlay)]`}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--ia-line)]">
              <div className="min-w-0">
                <h3 id={`${id}-title`} className="ia-section-title">{title}</h3>
                {description && <p className="ia-compact mt-1">{description}</p>}
              </div>
              <button
                id={`${id}-close-button`}
                onClick={onClose}
                className="ia-control w-9 h-9 shrink-0 grid place-items-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
