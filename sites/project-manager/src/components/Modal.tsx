import type { ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const { t } = useLingui();
  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <div className="app-modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t`Sluiten`}>
            ✕
          </button>
        </div>
        <div className="app-modal-body">{children}</div>
      </div>
    </div>
  );
}
