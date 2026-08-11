import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  /** Omit on the final (current-page) item so it renders as plain text, not a link. */
  to?: string;
}

interface PageBreadcrumbProps {
  /** Renders inline (no wrapping element) so callers can embed it directly inside a
   * title container or any other flex row. Every item but the last is typically a link. */
  items: BreadcrumbItem[];
}

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Fragment>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="page-breadcrumb-sep" aria-hidden>
              •
            </span>
          )}
          {item.to ? (
            <Link to={item.to} className="page-breadcrumb-link">
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </Fragment>
      ))}
    </Fragment>
  );
}
