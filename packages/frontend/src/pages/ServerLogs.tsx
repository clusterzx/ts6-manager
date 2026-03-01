import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-destructive bg-destructive/10 border-destructive/20',
  WARNING: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  INFO: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  DEBUG: 'text-muted-foreground bg-muted/50 border-border/50',
};

function parseLevel(line: string): string {
  if (line.includes('|ERROR')) return 'ERROR';
  if (line.includes('|WARNING')) return 'WARNING';
  if (line.includes('|INFO')) return 'INFO';
  if (line.includes('|DEBUG')) return 'DEBUG';
  return 'INFO';
}

export default function ServerLogs() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const [lines, setLines] = useState('100');
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['logs', c, s, lines],
    queryFn: () => logsApi.get(c!, s!, parseInt(lines)),
    enabled: !!c && !!s,
  });

  const logs = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    return raw
      .map((entry: any) => {
        const line = typeof entry === 'string' ? entry : entry.l || entry.msg || JSON.stringify(entry);
        return { raw: line, level: parseLevel(line) };
      })
      .filter((entry) => {
        if (levelFilter !== 'ALL' && entry.level !== levelFilter) return false;
        if (filter && !entry.raw.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      });
  }, [data, filter, levelFilter]);

  if (!c || !s) return <EmptyState icon={ScrollText} title="No server selected" />;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Server Logs</h1>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4 mr-1', isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter logs..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="DEBUG">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lines} onValueChange={setLines}>
          <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 lines</SelectItem>
            <SelectItem value="100">100 lines</SelectItem>
            <SelectItem value="250">250 lines</SelectItem>
            <SelectItem value="500">500 lines</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="p-3 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">No log entries found.</p>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5 group hover:bg-muted/10 rounded px-1">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-mono-data uppercase tracking-wider mt-0.5', LEVEL_COLORS[entry.level] || LEVEL_COLORS.INFO)}>
                    {entry.level.slice(0, 3)}
                  </span>
                  <span className="text-xs font-mono-data text-muted-foreground leading-relaxed break-all">
                    {entry.raw}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">{logs.length} entries shown</p>
    </div>
  );
}
