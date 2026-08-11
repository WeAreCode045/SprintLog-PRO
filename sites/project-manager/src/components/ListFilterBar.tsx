import type { ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';

interface ListFilterBarProps {
  children: ReactNode;
  className?: string;
}

export function ListFilterBar({ children, className }: ListFilterBarProps) {
  return <div className={`list-filter-bar ${className ?? ''}`.trim()}>{children}</div>;
}

interface SortControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
}

export function SortControl<T extends string>({ value, onChange, options, label }: SortControlProps<T>) {
  const { t } = useLingui();
  const resolvedLabel = label ?? t`Sorteren`;
  return (
    <label className="sort-control">
      <span>{resolvedLabel}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
