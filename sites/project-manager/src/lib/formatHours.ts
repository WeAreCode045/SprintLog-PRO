import { t } from '@lingui/core/macro';

export function formatHours(hours: number | null | undefined): string {
  const value = hours ?? 0;
  const rounded = value % 1 === 0 ? value : value.toFixed(2);
  return `${rounded} ${t`u`}`;
}
