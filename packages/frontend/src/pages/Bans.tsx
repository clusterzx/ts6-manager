import { useState, useMemo } from 'react';
import { useBans, useAddBan, useDeleteBan } from '@/hooks/use-bans';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function Bans() {
  const { selectedConfigId, selectedSid } = useServerStore();
  const { data, isLoading } = useBans();
  const addBan = useAddBan();
  const deleteBan = useDeleteBan();
  const [showAdd, setShowAdd] = useState(false);
  const [banType, setBanType] = useState<'ip' | 'name' | 'uid'>('ip');
  const [banValue, setBanValue] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('3600');

  const bans = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'lastnickname', header: 'Last Nickname', cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'ip', header: 'IP', cell: ({ getValue }) => <span className="font-mono-data text-xs">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'uid', header: 'UID', cell: ({ getValue }) => <span className="font-mono-data text-xs truncate max-w-[120px] block">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'duration', header: 'Duration', cell: ({ getValue }) => <span className="font-mono-data text-xs">{formatDuration(getValue() as number)}</span> },
    { accessorKey: 'created', header: 'Created', cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
    { accessorKey: 'invokername', header: 'By', cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) || '-'}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
          deleteBan.mutate(row.original.banid, { onSuccess: () => toast.success('Ban removed') });
        }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [deleteBan]);

  if (!selectedConfigId || !selectedSid) return <EmptyState icon={Ban} title="No server selected" />;
  if (isLoading) return <PageLoader />;

  const handleAdd = () => {
    const params: any = { time: parseInt(banDuration), banreason: banReason };
    params[banType] = banValue;
    addBan.mutate(params, {
      onSuccess: () => { toast.success('Ban added'); setShowAdd(false); setBanValue(''); setBanReason(''); },
      onError: () => toast.error('Failed to add ban'),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bans</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add Ban</Button>
      </div>

      <DataTable columns={columns} data={bans} searchKey="lastnickname" searchPlaceholder="Search bans..." />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ban</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Ban Type</Label>
              <Select value={banType} onValueChange={(v: any) => setBanType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="name">Name (Regex)</SelectItem>
                  <SelectItem value="uid">Unique ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Value</Label><Input value={banValue} onChange={(e) => setBanValue(e.target.value)} placeholder={banType === 'ip' ? '192.168.1.*' : banType === 'name' ? '.*bad.*' : 'unique-id'} /></div>
            <div><Label className="text-xs">Reason</Label><Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Ban reason" /></div>
            <div>
              <Label className="text-xs">Duration</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">1 Hour</SelectItem>
                  <SelectItem value="86400">1 Day</SelectItem>
                  <SelectItem value="604800">1 Week</SelectItem>
                  <SelectItem value="2592000">30 Days</SelectItem>
                  <SelectItem value="0">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!banValue}>Add Ban</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
