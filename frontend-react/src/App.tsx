import { useState } from 'react';
import './styles/theme.css';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Pairing from './pages/Pairing';

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'pairing'>('dashboard');

  return (
    <div className="app-shell">
      <Header active={tab} onChange={(k) => setTab(k as any)} />
      <main>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'inventory' && <Inventory />}
        {tab === 'pairing' && <Pairing />}
      </main>
    </div>
  );
}
