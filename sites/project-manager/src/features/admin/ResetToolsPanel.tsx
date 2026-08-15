import { useEffect, useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CompanyRow } from '../../appwrite/types';
import type { AdminDataResetPreviewItem, AdminDataResetType } from '../../lib/functions';
import { useProjects } from '../projects/hooks';
import { adminDataResetPreview } from './api';
import { ResetConfirmDialog } from './ResetConfirmDialog';
import { useAdminDataReset } from './hooks';

type ResetFilterScope = 'company' | 'companyProject';

interface ResetActionConfig {
  id: AdminDataResetType;
  title: string;
  description: string;
  filterScope: ResetFilterScope;
}

export function ResetToolsPanel({ companies }: { companies: CompanyRow[] }) {
  const { t } = useLingui();
  const [companyId, setCompanyId] = useState(() => companies[0]?.$id ?? '');
  const { data: projects = [] } = useProjects(companyId);
  const resetMutation = useAdminDataReset();
  const [projectId, setProjectId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorActionId, setErrorActionId] = useState<AdminDataResetType | null>(null);
  const [successActionId, setSuccessActionId] = useState<AdminDataResetType | null>(null);
  const [pendingAction, setPendingAction] = useState<ResetActionConfig | null>(null);
  const [previewItems, setPreviewItems] = useState<AdminDataResetPreviewItem[]>([]);
  const [previewLoadingActionId, setPreviewLoadingActionId] = useState<AdminDataResetType | null>(null);

  const selectedCompany = companies.find((company) => company.$id === companyId);
  const selectedProject = projects.find((project) => project.$id === projectId);

  useEffect(() => {
    if (companies.length === 0) {
      setCompanyId('');
      return;
    }
    if (!companies.some((company) => company.$id === companyId)) {
      setCompanyId(companies[0].$id);
      setProjectId('');
    }
  }, [companies, companyId]);

  const actions: ResetActionConfig[] = useMemo(
    () => [
      {
        id: 'invoicing',
        title: t`Reset facturatie`,
        description: t`Verwijdert alle facturen zodat goedgekeurde uren opnieuw gefactureerd kunnen worden.`,
        filterScope: 'companyProject',
      },
      {
        id: 'approvedHours',
        title: t`Reset goedgekeurde uren`,
        description: t`Maakt alle goedgekeurde uren weer beschikbaar voor goedkeuring.`,
        filterScope: 'companyProject',
      },
      {
        id: 'bookedHours',
        title: t`Reset geboekte uren`,
        description: t`Verwijdert alle geboekte uren op taken.`,
        filterScope: 'companyProject',
      },
      {
        id: 'projects',
        title: t`Reset projecten`,
        description: t`Verwijdert projecten en gekoppelde data (taken, uren, discussies, bestanden).`,
        filterScope: 'companyProject',
      },
      {
        id: 'tasks',
        title: t`Reset taken`,
        description: t`Verwijdert alle taken voor het geselecteerde filter.`,
        filterScope: 'companyProject',
      },
    ],
    [t],
  );

  function formatResetSuccess(
    action: ResetActionConfig,
    result: {
      deletedInvoices?: number;
      releasedEntries?: number;
      unapprovedEntries?: number;
      deletedEntries?: number;
      deletedProjects?: number;
      deletedTasks?: number;
    },
  ) {
    switch (action.id) {
      case 'invoicing':
        return t`Facturatie gereset: ${result.deletedInvoices ?? 0} facturen verwijderd, ${result.releasedEntries ?? 0} uren vrijgegeven.`;
      case 'approvedHours':
        return t`${result.unapprovedEntries ?? 0} goedgekeurde uren teruggezet.`;
      case 'bookedHours':
        return t`${result.deletedEntries ?? 0} geboekte uren verwijderd.`;
      case 'projects':
        return t`${result.deletedProjects ?? 0} project(en) verwijderd.`;
      case 'tasks':
        return t`${result.deletedTasks ?? 0} taken verwijderd.`;
      default: {
        const _exhaustive: never = action.id;
        return _exhaustive;
      }
    }
  }

  async function handleResetClick(action: ResetActionConfig) {
    if (!companyId || !selectedCompany) {
      setErrorActionId(action.id);
      setErrorMessage(t`Selecteer eerst een bedrijf.`);
      return;
    }

    setErrorActionId(null);
    setErrorMessage(null);
    setSuccessActionId(null);
    setSuccessMessage(null);
    setPreviewLoadingActionId(action.id);
    try {
      const preview = await adminDataResetPreview({
        resetType: action.id,
        companyId,
        projectId: projectId || undefined,
      });
      setPreviewItems(preview.items ?? []);
      setPendingAction(action);
    } catch (err) {
      setErrorActionId(action.id);
      setErrorMessage(err instanceof Error ? err.message : t`Preview laden mislukt.`);
    } finally {
      setPreviewLoadingActionId(null);
    }
  }

  async function handleConfirmReset() {
    if (!pendingAction || !companyId || !selectedCompany) return;

    setErrorActionId(null);
    setErrorMessage(null);
    setSuccessActionId(null);
    setSuccessMessage(null);
    try {
      const result = await resetMutation.mutateAsync({
        resetType: pendingAction.id,
        companyId,
        projectId: projectId || undefined,
      });
      setSuccessActionId(pendingAction.id);
      setSuccessMessage(formatResetSuccess(pendingAction, result));
      setPendingAction(null);
      setPreviewItems([]);
    } catch (err) {
      setErrorActionId(pendingAction.id);
      setErrorMessage(err instanceof Error ? err.message : t`Reset mislukt.`);
    }
  }

  function closeConfirmDialog() {
    if (resetMutation.isPending) return;
    setPendingAction(null);
    setPreviewItems([]);
  }

  return (
    <div className="admin-reset-tools">
      <div className="admin-reset-filters filter-bar">
        <div className="filter-group">
          <label htmlFor="admin-reset-company">
            <span><Trans>Bedrijf</Trans></span>
            <select
              id="admin-reset-company"
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setProjectId('');
              }}
            >
              {companies.map((company) => (
                <option key={company.$id} value={company.$id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-group">
          <label htmlFor="admin-reset-project">
            <span><Trans>Project</Trans></span>
            <select
              id="admin-reset-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">{t`Alle projecten`}</option>
              {projects.map((project) => (
                <option key={project.$id} value={project.$id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-reset-actions">
        {actions.map((action) => {
          const isPreviewLoading = previewLoadingActionId === action.id;
          const isResetting = resetMutation.isPending && pendingAction?.id === action.id;
          return (
          <section key={action.id} className="admin-reset-card report-card">
            <div className="admin-reset-card-body">
              <h3>{action.title}</h3>
              <p className="admin-reset-card-description">{action.description}</p>
              <p className="admin-reset-card-filter-hint">
                <Trans>Filter: bedrijf{action.filterScope === 'companyProject' ? ', optioneel project' : ''}</Trans>
              </p>
              {errorActionId === action.id && errorMessage ? (
                <p className="form-error">{errorMessage}</p>
              ) : null}
              {successActionId === action.id && successMessage ? (
                <p className="save-confirmation">{successMessage}</p>
              ) : null}
            </div>
            <div className="admin-reset-card-actions">
              <button
                type="button"
                className="btn-danger"
                disabled={isPreviewLoading || isResetting || Boolean(previewLoadingActionId) || !companyId}
                onClick={() => void handleResetClick(action)}
              >
                {isPreviewLoading ? <Trans>Laden…</Trans> : <Trans>Uitvoeren</Trans>}
              </button>
            </div>
          </section>
          );
        })}
      </div>

      {pendingAction && selectedCompany ? (
        <ResetConfirmDialog
          title={pendingAction.title}
          companyName={selectedCompany.name}
          projectName={selectedProject?.name}
          items={previewItems}
          isPending={resetMutation.isPending}
          onClose={closeConfirmDialog}
          onConfirm={() => void handleConfirmReset()}
        />
      ) : null}
    </div>
  );
}
