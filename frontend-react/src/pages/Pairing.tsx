import React, { useState } from 'react';
import { api } from '../lib/SommOSAPI';

export default function Pairing() {
  const [dish, setDish] = useState('Grilled sea bass with lemon and herbs');
  const [ownerLikes, setOwnerLikes] = useState('Sancerre, Chablis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.getQuickPairing(dish, {}, ownerLikes.split(',').map(s => s.trim()).filter(Boolean));
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to get pairing');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <div className="toolbar" style={{ gap: 16 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Describe the dish" value={dish} onChange={(e) => setDish(e.target.value)} />
          <input className="input" style={{ flex: 1 }} placeholder="Owner likes (comma separated)" value={ownerLikes} onChange={(e) => setOwnerLikes(e.target.value)} />
          <button className="button" onClick={submit} disabled={loading}>{loading ? 'Recommending…' : 'Recommend'}</button>
        </div>
      </div>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {result && (
        <div className="panel" style={{ padding: 16 }}>
          <div className="card__title">Recommendations</div>
          <pre style={{ margin: 0 }}>
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


