import { useMemo, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { CompanyRow } from '../../appwrite/types';

interface CompanyAutocompleteProps {
  companies: CompanyRow[];
  selectedIds: string[];
  onChange: (companyIds: string[]) => void;
  disabled?: boolean;
}

export function CompanyAutocomplete({
  companies,
  selectedIds,
  onChange,
  disabled = false,
}: CompanyAutocompleteProps) {
  const { t } = useLingui();
  const [query, setQuery] = useState('');

  const selectedCompanies = useMemo(
    () => companies.filter((company) => selectedIds.includes(company.$id)),
    [companies, selectedIds],
  );

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return companies
      .filter((company) => !selectedIds.includes(company.$id))
      .filter((company) => company.name.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [companies, query, selectedIds]);

  function addCompany(companyId: string) {
    if (selectedIds.includes(companyId)) return;
    onChange([...selectedIds, companyId]);
    setQuery('');
  }

  function removeCompany(companyId: string) {
    onChange(selectedIds.filter((id) => id !== companyId));
  }

  return (
    <div className="company-autocomplete">
      <div className="company-chip-row">
        {selectedCompanies.map((company) => (
          <span key={company.$id} className="company-chip">
            {company.name}
            <button
              type="button"
              className="company-chip-remove"
              disabled={disabled}
              onClick={() => removeCompany(company.$id)}
              aria-label={t`${company.name} verwijderen`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={t`Zoek bedrijf…`}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className="company-autocomplete-list" role="listbox">
          {suggestions.map((company) => (
            <li key={company.$id}>
              <button type="button" disabled={disabled} onClick={() => addCompany(company.$id)}>
                {company.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && suggestions.length === 0 && (
        <p className="text-muted company-autocomplete-empty">{t`Geen bedrijf gevonden.`}</p>
      )}
    </div>
  );
}
