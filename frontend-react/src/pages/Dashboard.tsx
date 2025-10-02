import React, { useEffect, useState } from 'react';
import { api } from '../lib/SommOSAPI';

type Health = { success: boolean; status: string; data?: any };
type Activity = Array<{ id: string; title: string; details: string; timestamp: string }>;

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [activity, setActivity] = useState<Activity>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const h = await api.healthCheck();
      setHealth(h as Health);
      const act = await api.getRecentActivity(10);
      if ((act as any)?.data) setActivity((act as any).data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="row">
        <div className="card">
          <div className="card__title">System Health</div>
          {loading && <div className="spinner" />}
          {error && <div className="error">{error}</div>}
          {health && (
            <div className="row">
              <div className="stat">
                <div className="stat__value">{health.status === 'healthy' ? 'Healthy' : 'Degraded'}</div>
                <div className="badge">API</div>
              </div>
              <div>
                <pre style={{ margin: 0, background: 'transparent', color: 'var(--muted)' }}>
{JSON.stringify(health.data || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card__title">Recent Activity</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {activity.map(item => (
              <div key={item.id} className="panel" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{item.details}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{new Date(item.timestamp).toLocaleString()}</div>
              </div>
            ))}
            {activity.length === 0 && <div style={{ color: 'var(--muted)' }}>No recent activity.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}


