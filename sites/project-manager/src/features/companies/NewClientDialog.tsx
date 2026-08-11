import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { useCreateCompany } from './hooks';

interface NewClientDialogProps {
  onClose: () => void;
  onCreated: (companyId: string) => void;
}

export function NewClientDialog({ onClose, onCreated }: NewClientDialogProps) {
  const { t } = useLingui();
  const [name, setName] = useState('');
  const createCompany = useCreateCompany();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const company = await createCompany.mutateAsync({ name: name.trim() });
    onCreated(company.$id);
  }

  return (
    <Modal title={t`Nieuwe klant`} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          <Trans>Klantnaam</Trans>
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={createCompany.isPending || !name.trim()}>
            <Trans>Aanmaken</Trans>
          </button>
          <button type="button" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
