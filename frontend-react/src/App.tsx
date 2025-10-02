import { useEffect, useState } from 'react';
import './App.css';
import { api } from './lib/SommOSAPI';

type HealthResponse = { success: boolean; data?: any; error?: any };

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.healthCheck();
      setHealth(res as HealthResponse);
    } catch (e: any) {
      setError(e?.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <h1>SommOS React</h1>
      <p>Backend proxy: <code>/api</code> → <code>localhost:3001</code></p>
      <button onClick={checkHealth} disabled={loading}>
        {loading ? 'Checking…' : 'Re-check health'}
      </button>
      <div style={{ marginTop: 16 }}>
        {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
        {health && (
          <pre style={{ background: '#111', color: '#eee', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
{JSON.stringify(health, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
