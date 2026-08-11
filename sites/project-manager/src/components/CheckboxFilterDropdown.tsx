import { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconChevronDown, IconChevronRight } from './icons';

export interface FilterOption<T extends string = string> {
  id: T;
  label: string;
}

export interface CheckboxFilterDropdownProps<T extends string = string> {
  options: FilterOption<T>[];
  excludedIds: Set<T>;
  onToggle: (id: T) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  labelPlural?: string;
  allLabel?: string;
  noneLabel?: string;
  getLabel?: (selectedCount: number, totalCount: number) => string;
}

export function CheckboxFilterDropdown<T extends string = string>({
  options,
  excludedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  labelPlural,
  allLabel,
  noneLabel,
  getLabel,
}: CheckboxFilterDropdownProps<T>) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedCount = options.length - excludedIds.size;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let label = '';
  if (getLabel) {
    label = getLabel(selectedCount, options.length);
  } else {
    const plural = labelPlural ?? t`items`;
    label =
      selectedCount === 0
        ? (noneLabel ?? t`Geen ${plural}`)
        : selectedCount === options.length
          ? (allLabel ?? t`Alle ${plural} (${options.length})`)
          : t`${selectedCount} van ${options.length} ${plural}`;
  }

  return (
    <div className="multiselect" ref={ref}>
      <button type="button" className="multiselect-trigger" onClick={() => setOpen((v) => !v)}>
        {label} <span className="multiselect-caret">{open ? <IconChevronDown /> : <IconChevronRight />}</span>
      </button>
      {open && (
        <div className="multiselect-panel" onClick={(e) => e.stopPropagation()}>
          <div className="multiselect-panel-actions">
            <button type="button" onClick={onSelectAll}>
              <Trans>Alles</Trans>
            </button>
            <button type="button" onClick={onSelectNone}>
              <Trans>Geen</Trans>
            </button>
          </div>
          <ul>
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!excludedIds.has(opt.id)}
                    onChange={() => onToggle(opt.id)}
                  />
                  <span className="multiselect-item-name">{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
