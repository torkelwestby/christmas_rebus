// app/ideas/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import IdeaList from '@/components/IdeaList';

type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
};



export default function IdeasPage() {
  const { isAuthenticated, username, isAdmin} = useAuth();
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [offset, setOffset] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchIdeas = async () => {
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      // Add sort parameter to get newest first
      const res = await fetch(`${baseUrl}/api/ideas?max=100&sort=desc`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      
      const data = await res.json();
      
      // Sort by createdTime (newest first)
      const sortedRecords = (data?.records || []).sort((a: AirtableRecord, b: AirtableRecord) => {
        const timeA = new Date(a.createdTime).getTime();
        const timeB = new Date(b.createdTime).getTime();
        return timeB - timeA; // Newest first
      });
      
      setRecords(sortedRecords);
      setOffset(typeof data?.offset === 'string' ? data.offset : undefined);
    } catch (e) {
      console.error('Error fetching ideas:', e);
      setError('Kunne ikke laste ideer. Prøv å laste siden på nytt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchIdeas();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto container-padding py-8 sm:py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-700">Laster idéoversikt…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[900px] mx-auto container-padding py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold mb-2">Kunne ikke laste ideer</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchIdeas}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto container-padding py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Idéoversikt</h1>
        <p className="text-gray-600">{isAdmin ? 'Søk, filtrer og rediger ideer • Sortert etter nyeste først' : 'Søk og filtrer ideer • Sortert etter nyeste først'}</p>
      </div>

      <IdeaList 
        initialRecords={records} 
        initialOffset={offset} 
        onRefresh={fetchIdeas}
        currentUsername={username}
      />
    </div>
  );
}