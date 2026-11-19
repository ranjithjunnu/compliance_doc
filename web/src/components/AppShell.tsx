// The frame around every screen: left menu, top bar with company and user, and the page.
import { useState, type ReactNode } from 'react'
import type { Me } from '../lib/types'
import { Button } from './ui'

interface NavItem {
  id: string
  label: string
  adminOnly?: boolean
}

// Grouped the way people work: daily work first, then setup, rules and reporting.
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Work',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'cases', label: 'Cases' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'approvals', label: 'Approvals' },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'workers', label: 'Workers' },
      { id: 'checks', label: 'Checks' },
    ],
  },
  {
    label: 'Rules',
    items: [
      { id: 'packs', label: 'Compliance packs' },
      { id: 'controls', label: 'Controls' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { id: 'dashboards', label: 'Dashboards' },
      { id: 'reports', label: 'Reports' },
      { id: 'audit', label: 'Audit log', adminOnly: true },
    ],
  },
  {
    label: 'Company',
    items: [
      { id: 'setup', label: 'Setup', adminOnly: true },
      { id: 'integrations', label: 'Integrations', adminOnly: true },
      { id: 'settings', label: 'Settings', adminOnly: true },
    ],
  },
]

export function AppShell({
  me,
  current,
  onNavigate,
  onSignOut,
  children,
}: {
  me: Me
  current: string
  onNavigate: (id: string) => void
  onSignOut: () => void
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const go = (id: string) => {
    onNavigate(id)
    setMenuOpen(false)
  }

  return (
    <div className={`shell${menuOpen ? ' shell-menu-open' : ''}`}>
      <aside className="sidebar" aria-label="Main menu">
        <div className="sidebar-brand">
          <span className="logo-mark" aria-hidden="true">
            A
          </span>
          <span className="logo-word">Aegis</span>
        </div>
        <nav className="nav">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.adminOnly || me.user.is_admin)
            if (!items.length) return null
            return (
              <div key={group.label} className="nav-group">
                <p className="nav-group-label">{group.label}</p>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item${current === item.id ? ' nav-item-active' : ''}`}
                    aria-current={current === item.id ? 'page' : undefined}
                    onClick={() => go(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>
      <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost btn-sm menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
          <div className="topbar-company">
            <span className="topbar-company-name">{me.tenant.name}</span>
            {me.demo ? <span className="tag">Demo data</span> : null}
          </div>
          <div className="topbar-user">
            <div className="topbar-user-text">
              <span className="topbar-user-name">{me.user.name}</span>
              <span className="topbar-user-role">{me.user.role_label}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
