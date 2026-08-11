import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** Rendered inline with the title, right-aligned (e.g. CompanyScopeControl). */
  actions?: ReactNode;
  /** Rendered below the title, left-aligned. */
  description?: ReactNode;
  /** Rendered inline with the description, right-aligned (e.g. PageBreadcrumb). */
  breadcrumb?: ReactNode;
  /** Rendered on its own row below the description, e.g. a tab bar. */
  tabs?: ReactNode;
}

/** Standard page/tab header: title+actions row, then description+breadcrumb row, then
 * an optional tabs row — the same three-row shape every page and subtab uses. */
export function PageHeader({ title, actions, description, breadcrumb, tabs }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-title-row">
        <h1 className="page-header-title">{title}</h1>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {(description || breadcrumb) && (
        <div className="page-header-desc-row">
          <div className="page-header-description">{description}</div>
          {breadcrumb && <div className="page-breadcrumb page-breadcrumb--compact">{breadcrumb}</div>}
        </div>
      )}
      {tabs && <div className="page-header-tabs-row">{tabs}</div>}
    </div>
  );
}
