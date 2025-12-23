'use client';
import { useEffect, useRef, useState } from 'react';

type Idea = any; // erstatt med din type

const CACHE: { data?: Idea[]; ts?: number; inflight?: Promise<Idea[]> } = {};
const TTL_MS = 60_000;

async function fetchIdeas(): Promise<Idea[]> {
  const res = await fetch('/api/ideas?max=200', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch ideas');
  const json = await res.json();
  return json.records ?? [];
}

export function useIdeas() {
  const [data, setData] = useState<Idea[] | undefined>(CACHE.data);
  const [loading, setLoading] = useState(!CACHE.data);
  const [error, setError] = useState<string>('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    const fresh = CACHE.ts && Date.now() - CACHE.ts < TTL_MS;
    if (fresh && CACHE.data) { setData(CACHE.data); setLoading(false); return; }

    if (!CACHE.inflight) {
      CACHE.inflight = fetchIdeas()
        .then(d => { CACHE.data = d; CACHE.ts = Date.now(); return d; })
        .finally(() => { CACHE.inflight = undefined; });
    }

    setLoading(true);
    CACHE.inflight!
      .then(d => { if (mounted.current) { setData(d); setLoading(false); } })
      .catch(e => { if (mounted.current) { setError(String(e?.message ?? e)); setLoading(false); } });
  }, []);

  return { data, loading, error };
}
