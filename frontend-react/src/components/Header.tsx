import React from 'react';

interface HeaderProps {
  active: string;
  onChange: (key: string) => void;
}

const TABS: Array<{ key: string; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'pairing', label: 'Quick Pairing' }
];

export function Header({ active, onChange }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
        <div className="brand">
          <div className="brand__logo">S</div>
          <div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>SommOS</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yacht Wine Management</div>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="Primary">
          {TABS.map(t => (
            <button
              key={t.key}
              className="tab"
              role="tab"
              aria-selected={active === t.key}
              onClick={() => onChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Header;


