import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/SommOSAPI';

type InventoryItem = {
  id: number;
  name: string;
  year?: number;
  region?: string;
  wine_type?: string;
  total_stock?: number;
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = 20;
  const offset = page * limit;

  const params = useMemo(() => ({
    search: query || undefined,
    wine_type: type || undefined,
    region: region || undefined,
    limit,
    offset
  }), [query, type, region, limit, offset]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWines(params as any);
      const data = (res as any)?.data || [];
      const meta = (res as any)?.meta || {};
      setItems(data);
      setTotal(meta.total || data.length);
    } catch (e: any) {
      setError(e?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [params.search, params.wine_type, params.region, params.limit, params.offset]);

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
        <div className="toolbar">
          <input className="input" placeholder="Search wines" value={query} onChange={(e) => { setPage(0); setQuery(e.target.value); }} />
          <select className="select" value={type} onChange={(e) => { setPage(0); setType(e.target.value); }}>
            <option value="">All Types</option>
            <option>Red</option>
            <option>White</option>
            <option>Rosé</option>
            <option>Sparkling</option>
            <option>Dessert</option>
            <option>Fortified</option>
          </select>
          <input className="input" placeholder="Region" value={region} onChange={(e) => { setPage(0); setRegion(e.target.value); }} />
          <button className="button" onClick={() => { setPage(0); load(); }} disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
        </div>
      </div>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="panel" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Type</th>
              <th>Region</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td>{it.year ?? '-'}</td>
                <td>{it.wine_type ?? '-'}</td>
                <td>{it.region ?? '-'}</td>
                <td>{it.total_stock ?? 0}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No results.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="button secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>Prev</button>
        <div style={{ color: 'var(--muted)' }}>Page {page + 1}</div>
        <button className="button secondary" onClick={() => setPage((p) => p + 1)} disabled={loading || items.length < limit}>Next</button>
      </div>
    </div>
  );
}


