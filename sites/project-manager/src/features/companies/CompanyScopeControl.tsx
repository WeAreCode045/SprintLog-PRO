import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useLingui } from '@lingui/react/macro';
import { useCompanyScope } from './CompanyScopeContext';

/** Top-right company enable control: inline checkboxes for clients, dropdown for staff. */
export function CompanyScopeControl() {
  const { t } = useLingui();
  const {
    isStaff,
    availableCompanies,
    enabledCompanyIds,
    setCompanyEnabled,
    scopeReady,
  } = useCompanyScope();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!scopeReady || availableCompanies.length <= 1) return null;

  const enabledCount = enabledCompanyIds.length;

  if (!isStaff) {
    return (
      <div className="company-scope-control company-scope-control--inline" aria-label={t`Bedrijven`}>
        {availableCompanies.map((company) => {
          const checked = enabledCompanyIds.includes(company.$id);
          return (
            <label key={company.$id} className="company-scope-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setCompanyEnabled(company.$id, event.target.checked)}
              />
              <span>{company.name}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="company-scope-control company-scope-control--dropdown" ref={rootRef}>
      <button
        type="button"
        className="company-scope-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <Building2 size={16} aria-hidden />
        <span>
          {t`Klanten`} ({enabledCount}/{availableCompanies.length})
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="company-scope-menu" role="listbox" aria-multiselectable>
          {availableCompanies.map((company) => {
            const checked = enabledCompanyIds.includes(company.$id);
            return (
              <label key={company.$id} className="company-scope-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setCompanyEnabled(company.$id, event.target.checked)}
                />
                <span>{company.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
