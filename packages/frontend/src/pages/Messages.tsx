import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Mail, Plus, Trash2, Eye } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

export default function Messages() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['messages', c, s], queryFn: () => messagesApi.list(c!, s!), enabled: !!c && !!s });
  const deleteMutation = useMutation({ mutationFn: (msgid: number) => messagesApi.delete(c!, s!, msgid), onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', c, s] }) });
  const sendMutation = useMutation({ mutationFn: (data: any) => messagesApi.send(c!, s!, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', c, s] }); toast.success('Message sent'); } });

  const [showCompose, setShowCompose] = useState(false);
  const [showView, setShowView] = useState<any>(null);
  const [toCluid, setToCluid] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const messages = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'senderName', header: 'From', cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'subject', header: 'Subject' },
    { accessorKey: 'timestamp', header: 'Date', cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
    { accessorKey: 'flag_read', header: 'Status', cell: ({ getValue }) => (
      <span className={`text-xs px-1.5 py-0.5 rounded ${getValue() ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary font-medium'}`}>
        {getValue() ? 'Read' : 'Unread'}
      </span>
    )},
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowView(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
            deleteMutation.mutate(row.original.msgid, { onSuccess: () => toast.success('Message deleted') });
          }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [deleteMutation]);

  if (!c || !s) return <EmptyState icon={Mail} title="No server selected" />;
  if (isLoading) return <PageLoader />;

  const handleSend = () => {
    sendMutation.mutate({ cluid: toCluid, subject, message: body }, {
      onSuccess: () => { setShowCompose(false); setToCluid(''); setSubject(''); setBody(''); },
      onError: () => toast.error('Failed to send message'),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Offline Messages</h1>
        <Button size="sm" onClick={() => setShowCompose(true)}><Plus className="h-4 w-4 mr-1" /> Compose</Button>
      </div>

      <DataTable columns={columns} data={messages} searchKey="subject" searchPlaceholder="Search messages..." />

      {/* View Message Dialog */}
      <Dialog open={!!showView} onOpenChange={() => setShowView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{showView?.subject || 'Message'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>From: <span className="text-foreground font-medium">{showView?.senderName}</span></span>
              <span className="text-border">|</span>
              <span>{showView?.timestamp && timeAgo(showView.timestamp)}</span>
            </div>
            <div className="rounded-md bg-muted/30 border border-border p-3 text-sm min-h-[100px] whitespace-pre-wrap">
              {showView?.message || showView?.subject || 'No content'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Recipient Client UID</Label><Input value={toCluid} onChange={(e) => setToCluid(e.target.value)} placeholder="Client unique ID" /></div>
            <div><Label className="text-xs">Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" /></div>
            <div><Label className="text-xs">Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body..." rows={5} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!toCluid || !subject}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
