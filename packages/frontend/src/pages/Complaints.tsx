import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { complaintsApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { MessageSquareWarning } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { timeAgo } from '@/lib/utils';

export default function Complaints() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const { data, isLoading } = useQuery({ queryKey: ['complaints', c, s], queryFn: () => complaintsApi.list(c!, s!), enabled: !!c && !!s });

  const complaints = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'fname', header: 'From' },
    { accessorKey: 'tname', header: 'About' },
    { accessorKey: 'message', header: 'Message' },
    { accessorKey: 'timestamp', header: 'When', cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
  ], []);

  if (!c || !s) return <EmptyState icon={MessageSquareWarning} title="No server selected" />;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Complaints</h1>
      <DataTable columns={columns} data={complaints} searchKey="message" searchPlaceholder="Search complaints..." />
    </div>
  );
}
