import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { useCreateProject } from './hooks';
import type { CompanyRow } from '../../appwrite/types';

interface NewProjectDialogProps {
  enabledCompanyIds: string[];
  companyById: (id: string) => CompanyRow | undefined;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

export function NewProjectDialog({
  enabledCompanyIds,
  companyById,
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const { t } = useLingui();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    enabledCompanyIds[0] ?? '',
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedCompany = companyById(selectedCompanyId || enabledCompanyIds[0] || '');
  const createProject = useCreateProject(
    selectedCompany?.$id ?? '',
    selectedCompany?.teamId ?? '',
  );

  const isMultiCompany = enabledCompanyIds.length > 1;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t`Vul een projectnaam in.`);
      return;
    }
    if (!selectedCompany) {
      setError(t`Selecteer een geldig bedrijf.`);
      return;
    }
    try {
      const project = await createProject.mutateAsync(name.trim());
      onCreated?.(project.$id);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Aanmaken mislukt.`);
    }
  }

  return (
    <Modal title={t`Nieuw project`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        {isMultiCompany && (
          <label>
            <Trans>Bedrijf</Trans>
            <select
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
            >
              {enabledCompanyIds.map((id) => (
                <option key={id} value={id}>
                  {companyById(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <Trans>Projectnaam</Trans>
          <input
            autoFocus
            type="text"
            placeholder={t`Nieuw project…`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-accent"
            disabled={createProject.isPending || !name.trim() || !selectedCompany}
          >
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
