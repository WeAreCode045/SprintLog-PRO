import { useLingui } from '@lingui/react/macro';
import { CheckboxFilterDropdown } from './CheckboxFilterDropdown';
import type { ProjectRow } from '../appwrite/types';

interface ProjectFilterDropdownProps {
  projects: ProjectRow[];
  excludedIds: Set<string>;
  onToggle: (projectId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function ProjectFilterDropdown({
  projects,
  excludedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
}: ProjectFilterDropdownProps) {
  const { t } = useLingui();
  const options = projects.map((p) => ({ id: p.$id, label: p.name }));

  return (
    <CheckboxFilterDropdown
      options={options}
      excludedIds={excludedIds}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onSelectNone={onSelectNone}
      labelPlural={t`projecten`}
    />
  );
}
