import { useMemo, useState } from 'react';
import { useChannels, useCreateChannel, useDeleteChannel, useEditChannel, useMoveChannel } from '@/hooks/use-channels';
import { useClients } from '@/hooks/use-clients';
import { useServerStore } from '@/stores/server.store';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Hash, Plus, Trash2, Pencil, ChevronRight, ChevronDown, Users, Lock, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChannelNode {
  cid: number;
  pid: number;
  channel_name: string;
  channel_topic: string;
  total_clients: number;
  channel_flag_permanent: number;
  channel_flag_password: number;
  channel_codec_quality: number;
  children: ChannelNode[];
}

interface ClientInfo {
  clid: number;
  cid: number;
  client_nickname: string;
  client_type: string;
  client_away: number;
  client_input_muted: number;
}

function buildTree(channels: any[]): ChannelNode[] {
  const normalized = channels.map((ch) => ({
    ...ch,
    cid: Number(ch.cid),
    pid: Number(ch.pid),
    total_clients: Number(ch.total_clients) || 0,
    channel_flag_permanent: Number(ch.channel_flag_permanent) || 0,
    channel_flag_password: Number(ch.channel_flag_password) || 0,
    channel_codec_quality: Number(ch.channel_codec_quality) || 0,
    channel_topic: ch.channel_topic || '',
  }));
  const map = new Map<number, ChannelNode>();
  const roots: ChannelNode[] = [];
  normalized.forEach((ch) => map.set(ch.cid, { ...ch, children: [] }));
  normalized.forEach((ch) => {
    const node = map.get(ch.cid)!;
    if (ch.pid === 0) roots.push(node);
    else map.get(ch.pid)?.children.push(node);
  });
  return roots;
}

function ClientEntry({ client, depth }: { client: ClientInfo; depth: number }) {
  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-2 text-xs text-muted-foreground"
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
    >
      <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-mono-data text-primary shrink-0">
        {client.client_nickname?.[0]?.toUpperCase() || '?'}
      </div>
      <span className="truncate">{client.client_nickname}</span>
      {client.client_away === 1 && <Badge variant="warning" className="text-[8px] px-1 py-0 h-3.5">Away</Badge>}
      {client.client_input_muted === 1 && !client.client_away && <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">Muted</Badge>}
    </div>
  );
}

interface TreeNodeProps {
  node: ChannelNode;
  depth?: number;
  isAdmin: boolean;
  clientsByChannel: Map<number, ClientInfo[]>;
  onDelete: (cid: number, name: string) => void;
  onEdit: (node: ChannelNode) => void;
  onDrop: (draggedCid: number, targetCid: number) => void;
  draggedCid: number | null;
  setDraggedCid: (cid: number | null) => void;
}

function ChannelTreeNode({ node, depth = 0, isAdmin, clientsByChannel, onDelete, onEdit, onDrop, draggedCid, setDraggedCid }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [dropOver, setDropOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const clients = clientsByChannel.get(node.cid) || [];
  const hasContent = hasChildren || clients.length > 0;
  const isSpacer = node.channel_name.startsWith('[spacer') || node.channel_name.startsWith('[*spacer');

  if (isSpacer) {
    return (
      <div className="py-0.5" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        <div className="border-t border-border/40 my-1" />
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(node.cid));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCid(node.cid);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCid && draggedCid !== node.cid) {
      setDropOver(true);
    }
  };

  const handleDragLeave = () => setDropOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    const cidStr = e.dataTransfer.getData('text/plain');
    const cid = Number(cidStr);
    if (cid && cid !== node.cid) {
      onDrop(cid, node.cid);
    }
  };

  const handleDragEnd = () => setDraggedCid(null);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded-sm hover:bg-muted/30 transition-colors group text-sm',
          isAdmin && 'cursor-grab active:cursor-grabbing',
          dropOver && 'bg-primary/10 ring-1 ring-primary/40',
          draggedCid === node.cid && 'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable={isAdmin}
        onDragStart={isAdmin ? handleDragStart : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {hasContent ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-muted rounded">
            {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <Hash className="h-3.5 w-3.5 text-primary/70 shrink-0" />

        <span className="truncate flex-1">{node.channel_name}</span>

        <span className="text-[10px] font-mono-data text-muted-foreground/50 shrink-0">#{node.cid}</span>

        {isAdmin && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(node)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(node.cid, node.channel_name)}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-1">
          {node.channel_flag_password === 1 && <Lock className="h-3 w-3 text-amber-400/60" />}
          {(node.total_clients > 0 || clients.length > 0) && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono-data">
              <Users className="h-3 w-3" />
              {clients.length || node.total_clients}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {clients.map((client) => (
            <ClientEntry key={client.clid} client={client} depth={depth + 1} />
          ))}
          {node.children.map((child) => (
            <ChannelTreeNode
              key={child.cid}
              node={child}
              depth={depth + 1}
              isAdmin={isAdmin}
              clientsByChannel={clientsByChannel}
              onDelete={onDelete}
              onEdit={onEdit}
              onDrop={onDrop}
              draggedCid={draggedCid}
              setDraggedCid={setDraggedCid}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function Channels() {
  const { selectedConfigId, selectedSid } = useServerStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const { data: channelData, isLoading: channelsLoading } = useChannels();
  const { data: clientData } = useClients();
  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();
  const editChannel = useEditChannel();
  const moveChannel = useMoveChannel();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ cid: number; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<ChannelNode | null>(null);
  const [editForm, setEditForm] = useState({ channel_name: '', channel_topic: '', channel_password: '' });
  const [newName, setNewName] = useState('');
  const [draggedCid, setDraggedCid] = useState<number | null>(null);

  const tree = useMemo(() => {
    if (!channelData || !Array.isArray(channelData)) return [];
    return buildTree(channelData);
  }, [channelData]);

  const clientsByChannel = useMemo(() => {
    const map = new Map<number, ClientInfo[]>();
    if (!clientData || !Array.isArray(clientData)) return map;
    for (const c of clientData) {
      if (String(c.client_type) !== '0') continue;
      const cid = Number(c.cid);
      const entry: ClientInfo = {
        clid: Number(c.clid),
        cid,
        client_nickname: c.client_nickname || '?',
        client_type: String(c.client_type),
        client_away: Number(c.client_away) || 0,
        client_input_muted: Number(c.client_input_muted) || 0,
      };
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(entry);
    }
    return map;
  }, [clientData]);

  if (!selectedConfigId || !selectedSid) return <EmptyState icon={Hash} title="No server selected" />;
  if (channelsLoading) return <PageLoader />;

  const handleCreate = () => {
    if (!newName.trim()) return;
    createChannel.mutate({ channel_name: newName, channel_flag_permanent: 1 }, {
      onSuccess: () => { toast.success('Channel created'); setShowCreate(false); setNewName(''); },
      onError: () => toast.error('Failed to create channel'),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteChannel.mutate(deleteTarget.cid, {
      onSuccess: () => { toast.success('Channel deleted'); setDeleteTarget(null); },
      onError: () => toast.error('Failed to delete channel'),
    });
  };

  const handleEditOpen = (node: ChannelNode) => {
    setEditTarget(node);
    setEditForm({ channel_name: node.channel_name, channel_topic: node.channel_topic || '', channel_password: '' });
  };

  const handleEditSave = () => {
    if (!editTarget || !editForm.channel_name.trim()) return;
    const data: any = { channel_name: editForm.channel_name };
    if (editForm.channel_topic !== undefined) data.channel_topic = editForm.channel_topic;
    if (editForm.channel_password) data.channel_password = editForm.channel_password;
    editChannel.mutate({ cid: editTarget.cid, data }, {
      onSuccess: () => { toast.success('Channel updated'); setEditTarget(null); },
      onError: () => toast.error('Failed to update channel'),
    });
  };

  const handleDrop = (draggedCid: number, targetCid: number) => {
    moveChannel.mutate({ cid: draggedCid, data: { cpid: targetCid } }, {
      onSuccess: () => toast.success('Channel moved'),
      onError: () => toast.error('Failed to move channel'),
    });
  };

  const totalClients = clientsByChannel.size > 0
    ? Array.from(clientsByChannel.values()).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Channels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {Array.isArray(channelData) ? channelData.length : 0} channels · {totalClients} clients online
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Channel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Channel Tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-0">
              {tree.map((node) => (
                <ChannelTreeNode
                  key={node.cid}
                  node={node}
                  isAdmin={isAdmin}
                  clientsByChannel={clientsByChannel}
                  onDelete={(cid, name) => setDeleteTarget({ cid, name })}
                  onEdit={handleEditOpen}
                  onDrop={handleDrop}
                  draggedCid={draggedCid}
                  setDraggedCid={setDraggedCid}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Channel Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New Channel" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createChannel.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Channel Name</Label>
              <Input value={editForm.channel_name} onChange={(e) => setEditForm({ ...editForm, channel_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Topic</Label>
              <Input value={editForm.channel_topic} onChange={(e) => setEditForm({ ...editForm, channel_topic: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={editForm.channel_password} onChange={(e) => setEditForm({ ...editForm, channel_password: e.target.value })} placeholder="Leave empty to keep current" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editForm.channel_name.trim() || editChannel.isPending}>
              {editChannel.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Channel"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        loading={deleteChannel.isPending}
      />
    </div>
  );
}
