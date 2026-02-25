import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWidgets, useCreateWidget, useUpdateWidget, useDeleteWidget, useRegenerateWidgetToken } from '@/hooks/use-widgets';
import { useQuery } from '@tanstack/react-query';
import { serversApi } from '@/api/servers.api';
import type { WidgetConfig, WidgetTheme, ServerConfig } from '@ts6/common';
import { WIDGET_THEME_LABELS } from '@ts6/common';
import { Copy, ExternalLink, Plus, Trash2, Pencil, RefreshCw, ArrowLeft, Code2, Image } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewState = 'list' | 'create' | 'edit' | 'embed';

const THEME_OPTIONS = Object.entries(WIDGET_THEME_LABELS) as [WidgetTheme, string][];

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

export function WidgetManagerModal({ open, onOpenChange }: Props) {
  const { data: widgets = [], isLoading } = useWidgets();
  const { data: servers = [] } = useQuery<ServerConfig[]>({ queryKey: ['servers'], queryFn: serversApi.list });
  const createWidget = useCreateWidget();
  const updateWidget = useUpdateWidget();
  const deleteWidget = useDeleteWidget();
  const regenerateToken = useRegenerateWidgetToken();

  const [view, setView] = useState<ViewState>('list');
  const [editTarget, setEditTarget] = useState<WidgetConfig | null>(null);
  const [embedTarget, setEmbedTarget] = useState<WidgetConfig | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [serverConfigId, setServerConfigId] = useState<number>(0);
  const [virtualServerId, setVirtualServerId] = useState(1);
  const [theme, setTheme] = useState<WidgetTheme>('dark');
  const [showChannelTree, setShowChannelTree] = useState(true);
  const [showClients, setShowClients] = useState(true);
  const [maxChannelDepth, setMaxChannelDepth] = useState(5);

  const resetForm = () => {
    setName('');
    setServerConfigId(servers[0]?.id ?? 0);
    setVirtualServerId(1);
    setTheme('dark');
    setShowChannelTree(true);
    setShowClients(true);
    setMaxChannelDepth(5);
  };

  const openCreate = () => {
    resetForm();
    setServerConfigId(servers[0]?.id ?? 0);
    setView('create');
  };

  const openEdit = (w: WidgetConfig) => {
    setEditTarget(w);
    setName(w.name);
    setTheme(w.theme);
    setShowChannelTree(w.showChannelTree);
    setShowClients(w.showClients);
    setMaxChannelDepth(w.maxChannelDepth);
    setView('edit');
  };

  const openEmbed = (w: WidgetConfig) => {
    setEmbedTarget(w);
    setView('embed');
  };

  const handleCreate = async () => {
    if (!name.trim() || !serverConfigId) return;
    await createWidget.mutateAsync({
      name: name.trim(),
      serverConfigId,
      virtualServerId,
      theme,
      showChannelTree,
      showClients,
      maxChannelDepth,
    });
    setView('list');
  };

  const handleUpdate = async () => {
    if (!editTarget || !name.trim()) return;
    await updateWidget.mutateAsync({
      id: editTarget.id,
      data: { name: name.trim(), theme, showChannelTree, showClients, maxChannelDepth },
    });
    setView('list');
  };

  const handleDelete = async (id: number) => {
    await deleteWidget.mutateAsync(id);
  };

  const handleRegenerate = async (w: WidgetConfig) => {
    await regenerateToken.mutateAsync(w.id);
    if (embedTarget?.id === w.id) {
      // Refresh embed target with new token
      const updated = widgets.find(x => x.id === w.id);
      if (updated) setEmbedTarget(updated);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setView('list'); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view !== 'list' && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setView('list')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {view === 'list' && 'Server Widgets'}
            {view === 'create' && 'Create Widget'}
            {view === 'edit' && 'Edit Widget'}
            {view === 'embed' && 'Embed Code'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="space-y-3">
              <Button size="sm" onClick={openCreate} disabled={servers.length === 0}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New Widget
              </Button>

              {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

              {widgets.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No widgets yet. Create one to embed your server status on external sites.
                </p>
              )}

              {widgets.map((w) => (
                <div key={w.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{w.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {WIDGET_THEME_LABELS[w.theme] || w.theme}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Server: {(w as any).serverConfig?.name || `#${w.serverConfigId}`} | VS {w.virtualServerId}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEmbed(w)}>
                      <Code2 className="h-3 w-3 mr-1" /> Embed
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`/widget/${w.token}`, '_blank')}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`/api/widget/${w.token}/image.svg`, '_blank')}>
                      <Image className="h-3 w-3 mr-1" /> SVG
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(w)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleDelete(w.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CREATE / EDIT VIEW */}
          {(view === 'create' || view === 'edit') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server Widget" />
              </div>

              {view === 'create' && (
                <>
                  <div className="space-y-2">
                    <Label>Server</Label>
                    <Select value={String(serverConfigId)} onValueChange={(v) => setServerConfigId(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Select server" /></SelectTrigger>
                      <SelectContent>
                        {servers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Virtual Server ID</Label>
                    <Input type="number" min={1} value={virtualServerId} onChange={(e) => setVirtualServerId(Number(e.target.value))} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={theme} onValueChange={(v) => setTheme(v as WidgetTheme)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label>Show Channel Tree</Label>
                <Switch checked={showChannelTree} onCheckedChange={setShowChannelTree} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Clients</Label>
                <Switch checked={showClients} onCheckedChange={setShowClients} />
              </div>

              <div className="space-y-2">
                <Label>Max Channel Depth: {maxChannelDepth}</Label>
                <Slider min={1} max={10} step={1} value={[maxChannelDepth]} onValueChange={([v]) => setMaxChannelDepth(v)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setView('list')}>Cancel</Button>
                <Button onClick={view === 'create' ? handleCreate : handleUpdate} disabled={!name.trim()}>
                  {view === 'create' ? 'Create' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* EMBED VIEW */}
          {view === 'embed' && embedTarget && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{embedTarget.name}</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRegenerate(embedTarget)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate Token
                </Button>
              </div>

              <Tabs defaultValue="iframe">
                <TabsList className="w-full">
                  <TabsTrigger value="iframe" className="flex-1">iFrame</TabsTrigger>
                  <TabsTrigger value="image" className="flex-1">Image URLs</TabsTrigger>
                  <TabsTrigger value="bbcode" className="flex-1">BBCode</TabsTrigger>
                </TabsList>

                <TabsContent value="iframe" className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Paste this into your website HTML:</Label>
                  <div className="relative">
                    <code className="block bg-muted rounded-md p-3 text-xs font-mono break-all leading-relaxed">
                      {`<iframe src="${origin}/widget/${embedTarget.token}" width="420" height="600" frameborder="0" scrolling="auto" style="border-radius:8px;border:none;"></iframe>`}
                    </code>
                    <Button
                      size="icon" variant="ghost"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => copyText(`<iframe src="${origin}/widget/${embedTarget.token}" width="420" height="600" frameborder="0" scrolling="auto" style="border-radius:8px;border:none;"></iframe>`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">SVG (scalable, best quality):</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted rounded-md p-2 text-xs font-mono break-all">
                        {`${origin}/api/widget/${embedTarget.token}/image.svg`}
                      </code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => copyText(`${origin}/api/widget/${embedTarget.token}/image.svg`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">PNG (for forums / signatures):</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted rounded-md p-2 text-xs font-mono break-all">
                        {`${origin}/api/widget/${embedTarget.token}/image.png`}
                      </code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => copyText(`${origin}/api/widget/${embedTarget.token}/image.png`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">HTML img tag:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted rounded-md p-2 text-xs font-mono break-all">
                        {`<img src="${origin}/api/widget/${embedTarget.token}/image.png" alt="TeamSpeak Server" />`}
                      </code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => copyText(`<img src="${origin}/api/widget/${embedTarget.token}/image.png" alt="TeamSpeak Server" />`)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="bbcode" className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Forum BBCode (uses PNG):</Label>
                  <div className="relative">
                    <code className="block bg-muted rounded-md p-3 text-xs font-mono break-all">
                      {`[img]${origin}/api/widget/${embedTarget.token}/image.png[/img]`}
                    </code>
                    <Button
                      size="icon" variant="ghost"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => copyText(`[img]${origin}/api/widget/${embedTarget.token}/image.png[/img]`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
