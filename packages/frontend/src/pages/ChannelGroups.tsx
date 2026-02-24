import { useChannelGroups } from '@/hooks/use-groups';
import { useServerStore } from '@/stores/server.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck } from 'lucide-react';

export default function ChannelGroups() {
  const { selectedConfigId, selectedSid } = useServerStore();
  const { data, isLoading } = useChannelGroups();

  if (!selectedConfigId || !selectedSid) return <EmptyState icon={ShieldCheck} title="No server selected" />;
  if (isLoading) return <PageLoader />;

  const groups = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Channel Groups</h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Groups ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {groups.map((g: any) => (
                <div key={g.cgid} className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono-data">CGID: {g.cgid}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono-data">Type: {g.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
