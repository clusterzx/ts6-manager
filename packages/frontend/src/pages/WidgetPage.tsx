import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { WidgetData } from '@ts6/common';
import { WidgetRenderer } from '@/components/widget/WidgetRenderer';

export default function WidgetPage() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    document.title = 'TS Server Widget';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const { data, isLoading, error } = useQuery<WidgetData>({
    queryKey: ['widget', token],
    queryFn: () => axios.get(`/api/widget/${token}/data`).then((r) => r.data),
    enabled: !!token,
    refetchInterval: 30_000,
    retry: 3,
  });

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f1117', color: '#8b949e',
        fontFamily: "'Segoe UI', sans-serif", fontSize: '13px',
      }}>
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f1117', color: '#8b949e',
        fontFamily: "'Segoe UI', sans-serif", fontSize: '13px',
      }}>
        Widget not available
      </div>
    );
  }

  return <WidgetRenderer data={data} />;
}
