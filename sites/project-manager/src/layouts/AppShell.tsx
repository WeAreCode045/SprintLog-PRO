import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen, LogOut, X, User, ChevronUp } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

/** @deprecated Legacy workspace switcher sentinel — kept for import compatibility. */
export const ADMIN_WORKSPACE = '__admin__';

export interface AppShellNavItem {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
}

export interface AppShellNavSection {
  title?: string;
  items: AppShellNavItem[];
}

export interface AppShellProps {
  navItems?: AppShellNavItem[];
  navSections?: AppShellNavSection[];
  userEmail: string;
  userName?: string;
  onLogout: () => void;
  children?: ReactNode;
}

function NavItems({
  items,
  collapsed,
  onNavigate,
}: {
  items: AppShellNavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);

  return (
    <>
      {items.map((item) => (
        <div
          key={item.to}
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredTo(item.to)}
          onMouseLeave={() => setHoveredTo(null)}
        >
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'active' : '')}
            style={collapsed ? { justifyContent: 'center', padding: '0.6rem', position: 'relative' } : undefined}
          >
            {item.icon ? <span className="sidebar-nav-icon">{item.icon}</span> : null}
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
          {collapsed && hoveredTo === item.to && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginLeft: '10px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: '#fff',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              {item.label}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export function AppShell({
  navItems = [],
  navSections,
  userEmail,
  userName,
  onLogout,
  children,
}: AppShellProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const sections: AppShellNavSection[] =
    navSections ?? (navItems.length > 0 ? [{ items: navItems }] : []);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const displayName = userName || userEmail;

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <aside
        className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}
        style={{ width: collapsed ? '70px' : '260px', transition: 'width 0.2s ease', padding: collapsed ? '1.25rem 0.5rem' : '1.25rem 1rem', position: 'relative', overflow: 'visible' }}
      >
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', padding: '0 0.4rem 1.25rem', position: 'relative' }}>
          <div className="sidebar-logo" style={{ padding: 0, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="sidebar-logo-badge">SL</span>
            {!collapsed && <span className="sidebar-logo-text">SprintLog Pro</span>}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? t`Zijbalk uitklappen` : t`Zijbalk inklappen`}
            style={collapsed ? {
              position: 'absolute',
              top: '0.75rem',
              right: '-32px',
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              width: 'auto',
              height: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--sidebar-bg)',
              cursor: 'pointer',
              zIndex: 50,
              boxShadow: 'none',
              padding: '0.2rem'
            } : { display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent', color: 'var(--sidebar-text)', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            title={t`Sluiten`}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {sections.map((section, index) => (
            <div key={section.title ?? `section-${index}`} className="sidebar-nav-section">
              {!collapsed && section.title ? <div className="sidebar-nav-section-title">{section.title}</div> : null}
              <NavItems items={section.items} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div ref={userMenuRef} style={{ position: 'relative', width: '100%' }}>
            {userMenuOpen && (
              <div
                style={
                  collapsed
                    ? {
                        position: 'absolute',
                        bottom: 0,
                        left: 'calc(100% + 0.5rem)',
                        minWidth: '180px',
                        background: 'var(--sidebar-bg)',
                        border: '1px solid var(--sidebar-active-bg)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        padding: '0.35rem',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }
                    : {
                        position: 'absolute',
                        bottom: 'calc(100% + 0.5rem)',
                        left: 0,
                        right: 0,
                        background: 'var(--sidebar-bg)',
                        border: '1px solid var(--sidebar-active-bg)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        padding: '0.35rem',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }
                }
              >
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setMobileOpen(false);
                    navigate('/app/account');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--sidebar-text-strong, #fff)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  <User size={15} />
                  <span><Trans>Profiel bewerken</Trans></span>
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--sidebar-text-strong, #fff)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={15} />
                  <span><Trans>Uitloggen</Trans></span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              title={displayName}
              style={
                collapsed
                  ? {
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '0.6rem',
                      width: '100%',
                    }
                  : {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      gap: '0.5rem',
                    }
              }
            >
              {collapsed ? (
                <User size={18} />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <User size={16} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                      }}
                    >
                      {displayName}
                    </span>
                  </div>
                  <ChevronUp
                    size={14}
                    style={{
                      flexShrink: 0,
                      transform: userMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </>
              )}
            </button>
          </div>
          {!collapsed && <LanguageSwitcher />}
        </div>
      </aside>

      <div className="app-main">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-topbar-menu"
            onClick={() => setMobileOpen(true)}
            title={t`Menu`}
          >
            <Menu size={20} />
          </button>
          <span className="sidebar-logo-badge">SL</span>
        </div>
        <div className="page">
          {children ?? <Outlet />}
        </div>
      </div>
    </div>
  );
}
