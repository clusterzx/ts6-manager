import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionsApi } from '@/api/permissions.api';
import { useServerStore } from '@/stores/server.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import {
  Lock, Search, ChevronRight, ChevronDown, Shield, Users, Hash, User, Save,
  X, Check, Minus,
} from 'lucide-react';
import { toast } from 'sonner';

// Permission categories based on TS3 naming convention
const PERM_CATEGORIES: Record<string, string> = {
  b_virtualserver: 'Virtual Server',
  b_serverinstance: 'Server Instance',
  b_serverquery: 'Server Query',
  b_channel: 'Channel',
  b_client: 'Client',
  b_group: 'Group',
  b_ft: 'File Transfer',
  i_channel: 'Channel (Values)',
  i_group: 'Group (Values)',
  i_client: 'Client (Values)',
  i_ft: 'File Transfer (Values)',
  i_max: 'Limits',
  i_needed: 'Needed Powers',
};

function getCategoryKey(permsid: string): string {
  // Match longest prefix first
  const prefixes = Object.keys(PERM_CATEGORIES).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (permsid.startsWith(prefix)) return prefix;
  }
  return 'other';
}

type PermLayer = 'server-group' | 'channel-group' | 'channel' | 'client';

interface PermDef {
  permid: number;
  permsid: string;
  permdesc: string;
}

interface PermValue {
  permsid: string;
  permvalue: number;
  permnegated: number;
  permskip: number;
}

interface PendingChange {
  permsid: string;
  permvalue: number;
  permnegated: number;
  permskip: number;
  action: 'set' | 'remove';
}

const LAYERS: { key: PermLayer; label: string; icon: React.ElementType }[] = [
  { key: 'server-group', label: 'Server Groups', icon: Shield },
  { key: 'channel-group', label: 'Channel Groups', icon: Users },
  { key: 'channel', label: 'Channel', icon: Hash },
  { key: 'client', label: 'Client', icon: User },
];

export default function Permissions() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const qc = useQueryClient();

  const [layer, setLayer] = useState<PermLayer>('server-group');
  const [entityId, setEntityId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Map<string, PendingChange>>(new Map());

  // Fetch all permission definitions
  const { data: permDefs, isLoading: loadingDefs } = useQuery({
    queryKey: ['perm-defs', c, s],
    queryFn: () => permissionsApi.list(c!, s!),
    enabled: !!c && !!s,
  });

  // Fetch entity lists for selectors
  const { data: serverGroups } = useQuery({
    queryKey: ['server-groups', c, s],
    queryFn: () => permissionsApi.serverGroups(c!, s!),
    enabled: !!c && !!s && layer === 'server-group',
  });
  const { data: channelGroups } = useQuery({
    queryKey: ['channel-groups', c, s],
    queryFn: () => permissionsApi.channelGroups(c!, s!),
    enabled: !!c && !!s && layer === 'channel-group',
  });
  const { data: channels } = useQuery({
    queryKey: ['channels-for-perms', c, s],
    queryFn: () => permissionsApi.channels(c!, s!),
    enabled: !!c && !!s && layer === 'channel',
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-for-perms', c, s],
    queryFn: () => permissionsApi.clients(c!, s!),
    enabled: !!c && !!s && layer === 'client',
  });

  // Fetch current entity permissions
  const { data: entityPerms, isLoading: loadingPerms } = useQuery({
    queryKey: ['entity-perms', c, s, layer, entityId],
    queryFn: () => {
      if (!c || !s || !entityId) return [];
      switch (layer) {
        case 'server-group': return permissionsApi.serverGroupPerms(c, s, entityId);
        case 'channel-group': return permissionsApi.channelGroupPerms(c, s, entityId);
        case 'channel': return permissionsApi.channelPerms(c, s, entityId);
        case 'client': return permissionsApi.clientPerms(c, s, entityId);
      }
    },
    enabled: !!c && !!s && !!entityId,
  });

  // Reset entity when layer changes
  useEffect(() => { setEntityId(null); setChanges(new Map()); }, [layer]);

  // Parse permission definitions into categorized structure
  // TS WebQuery returns { permid, permname, permdesc } — NOT permsid
  const allPerms: PermDef[] = useMemo(() => {
    if (!permDefs || !Array.isArray(permDefs)) return [];
    return permDefs.map((p: any) => ({
      permid: Number(p.permid),
      permsid: p.permname || p.permsid || `permid_${p.permid}`,
      permdesc: p.permdesc || '',
    }));
  }, [permDefs]);

  // Build permid → permname lookup (entity perms only return numeric permid)
  const permIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of allPerms) {
      map.set(p.permid, p.permsid);
    }
    return map;
  }, [allPerms]);

  // Current perm values as map (keyed by permname/permsid)
  const currentPerms = useMemo(() => {
    const map = new Map<string, PermValue>();
    if (!entityPerms || !Array.isArray(entityPerms)) return map;
    for (const p of entityPerms) {
      // Entity perms may have permsid, permname, or only numeric permid
      const name = p.permsid || p.permname || permIdToName.get(Number(p.permid)) || `permid_${p.permid}`;
      map.set(name, {
        permsid: name,
        permvalue: Number(p.permvalue) || 0,
        permnegated: Number(p.permnegated) || 0,
        permskip: Number(p.permskip) || 0,
      });
    }
    return map;
  }, [entityPerms, permIdToName]);

  // Categorize permissions
  const categories = useMemo(() => {
    const catMap = new Map<string, PermDef[]>();
    const filtered = search
      ? allPerms.filter((p) => p.permsid.toLowerCase().includes(search.toLowerCase()) || p.permdesc.toLowerCase().includes(search.toLowerCase()))
      : allPerms;

    for (const perm of filtered) {
      const cat = getCategoryKey(perm.permsid);
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(perm);
    }
    return catMap;
  }, [allPerms, search]);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const getEffectiveValue = useCallback((permsid: string): PendingChange | null => {
    if (changes.has(permsid)) return changes.get(permsid)!;
    const current = currentPerms.get(permsid);
    if (current) return { ...current, action: 'set' };
    return null;
  }, [changes, currentPerms]);

  const setPermValue = useCallback((permsid: string, value: number, negated: number, skip: number) => {
    setChanges((prev) => {
      const next = new Map(prev);
      next.set(permsid, { permsid, permvalue: value, permnegated: negated, permskip: skip, action: 'set' });
      return next;
    });
  }, []);

  const removePerm = useCallback((permsid: string) => {
    setChanges((prev) => {
      const next = new Map(prev);
      if (currentPerms.has(permsid)) {
        next.set(permsid, { permsid, permvalue: 0, permnegated: 0, permskip: 0, action: 'remove' });
      } else {
        next.delete(permsid);
      }
      return next;
    });
  }, [currentPerms]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!c || !s || !entityId) return;
      const toSet = [...changes.values()].filter((ch) => ch.action === 'set');
      const toRemove = [...changes.values()].filter((ch) => ch.action === 'remove');

      for (const perm of toSet) {
        const data = { permsid: perm.permsid, permvalue: perm.permvalue, permnegated: perm.permnegated, permskip: perm.permskip };
        switch (layer) {
          case 'server-group': await permissionsApi.addServerGroupPerm(c, s, entityId, data); break;
          case 'channel-group': await permissionsApi.addChannelGroupPerm(c, s, entityId, data); break;
          case 'channel': await permissionsApi.addChannelPerm(c, s, entityId, data); break;
        }
      }
      for (const perm of toRemove) {
        const data = { permsid: perm.permsid };
        switch (layer) {
          case 'server-group': await permissionsApi.delServerGroupPerm(c, s, entityId, data); break;
          case 'channel-group': await permissionsApi.delChannelGroupPerm(c, s, entityId, data); break;
          case 'channel': await permissionsApi.delChannelPerm(c, s, entityId, data); break;
        }
      }
    },
    onSuccess: () => {
      toast.success('Permissions saved');
      setChanges(new Map());
      qc.invalidateQueries({ queryKey: ['entity-perms', c, s, layer, entityId] });
    },
    onError: () => toast.error('Failed to save permissions'),
  });

  if (!c || !s) return <EmptyState icon={Lock} title="No server selected" />;
  if (loadingDefs) return <PageLoader />;

  const entities = (() => {
    switch (layer) {
      case 'server-group':
        return (Array.isArray(serverGroups) ? serverGroups : []).map((g: any) => ({
          id: Number(g.sgid), name: g.name, type: Number(g.type),
        }));
      case 'channel-group':
        return (Array.isArray(channelGroups) ? channelGroups : []).map((g: any) => ({
          id: Number(g.cgid), name: g.name, type: Number(g.type),
        }));
      case 'channel':
        return (Array.isArray(channels) ? channels : []).map((ch: any) => ({
          id: Number(ch.cid), name: ch.channel_name, type: 0,
        }));
      case 'client':
        return (Array.isArray(clients) ? clients : [])
          .filter((cl: any) => String(cl.client_type) === '0')
          .map((cl: any) => ({
            id: Number(cl.clid), name: cl.client_nickname, type: 0,
          }));
      default: return [];
    }
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Permissions</h1>
        {changes.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono-data">{changes.size} change(s)</Badge>
            <Button variant="outline" size="sm" onClick={() => setChanges(new Map())}>
              <X className="h-3.5 w-3.5 mr-1" /> Discard
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        )}
      </div>

      {/* Layer Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        {LAYERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setLayer(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              layer === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Entity Selector */}
        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Select {LAYERS.find((l) => l.key === layer)?.label.replace(/s$/, '')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-2 space-y-0.5">
                {entities.map((ent: any) => (
                  <button
                    key={ent.id}
                    onClick={() => { setEntityId(ent.id); setChanges(new Map()); }}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between',
                      entityId === ent.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/50',
                    )}
                  >
                    <span className="truncate">{ent.name}</span>
                    <span className="text-[10px] font-mono-data text-muted-foreground ml-1">#{ent.id}</span>
                  </button>
                ))}
                {entities.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No entities found</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Permission Editor */}
        <Card className="col-span-9">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {entityId ? `Permissions` : 'Select an entity'}
              </CardTitle>
              {entityId && (
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search permissions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {!entityId ? (
                <div className="flex items-center justify-center h-[400px]">
                  <p className="text-sm text-muted-foreground">Select an entity from the left panel</p>
                </div>
              ) : loadingPerms ? (
                <div className="flex items-center justify-center h-[400px]">
                  <PageLoader />
                </div>
              ) : (
                <div className="px-3 pb-3">
                  {[...categories.entries()].map(([catKey, perms]) => (
                    <div key={catKey} className="mb-1">
                      <button
                        onClick={() => toggleCat(catKey)}
                        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded"
                      >
                        {expandedCats.has(catKey) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {PERM_CATEGORIES[catKey] || catKey}
                        <Badge variant="secondary" className="text-[9px] h-4 ml-1">{perms.length}</Badge>
                      </button>
                      {expandedCats.has(catKey) && (
                        <div className="ml-4 border-l border-border/50 pl-2">
                          {/* Header */}
                          <div className="grid grid-cols-12 gap-2 px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-5">Permission</div>
                            <div className="col-span-2 text-center">Value</div>
                            <div className="col-span-1 text-center">Skip</div>
                            <div className="col-span-1 text-center">Negate</div>
                            <div className="col-span-3"></div>
                          </div>
                          {perms.map((perm) => {
                            const effective = getEffectiveValue(perm.permsid);
                            const isSet = effective !== null && effective.action !== 'remove';
                            const isChanged = changes.has(perm.permsid);
                            const isBoolean = perm.permsid.startsWith('b_');

                            return (
                              <div
                                key={perm.permsid}
                                className={cn(
                                  'grid grid-cols-12 gap-2 px-2 py-1 rounded text-xs items-center group',
                                  isChanged && 'bg-primary/5',
                                  isSet ? 'text-foreground' : 'text-muted-foreground',
                                )}
                              >
                                <div className="col-span-5 truncate" title={perm.permdesc || perm.permsid}>
                                  <span className="font-mono-data text-[11px]">{perm.permsid}</span>
                                </div>
                                <div className="col-span-2 flex justify-center">
                                  {isBoolean ? (
                                    <button
                                      onClick={() => {
                                        if (isSet) removePerm(perm.permsid);
                                        else setPermValue(perm.permsid, 1, 0, 0);
                                      }}
                                      className={cn(
                                        'h-5 w-5 rounded border flex items-center justify-center transition-colors',
                                        isSet
                                          ? 'bg-primary border-primary text-primary-foreground'
                                          : 'border-border hover:border-primary/50',
                                      )}
                                    >
                                      {isSet && <Check className="h-3 w-3" />}
                                    </button>
                                  ) : (
                                    <Input
                                      type="number"
                                      className="h-6 w-20 text-xs text-center font-mono-data px-1"
                                      value={effective?.permvalue ?? ''}
                                      placeholder="—"
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) {
                                          setPermValue(perm.permsid, val, effective?.permnegated || 0, effective?.permskip || 0);
                                        } else if (e.target.value === '') {
                                          removePerm(perm.permsid);
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  {!isBoolean && (
                                    <button
                                      onClick={() => {
                                        if (!isSet) return;
                                        const newSkip = (effective?.permskip || 0) ? 0 : 1;
                                        setPermValue(perm.permsid, effective?.permvalue || 0, effective?.permnegated || 0, newSkip);
                                      }}
                                      className={cn(
                                        'h-4 w-4 rounded border flex items-center justify-center text-[9px] transition-colors',
                                        isSet && effective?.permskip
                                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                          : 'border-border/50',
                                      )}
                                      title="Skip"
                                    >
                                      {isSet && effective?.permskip ? 'S' : ''}
                                    </button>
                                  )}
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  {!isBoolean && (
                                    <button
                                      onClick={() => {
                                        if (!isSet) return;
                                        const newNeg = (effective?.permnegated || 0) ? 0 : 1;
                                        setPermValue(perm.permsid, effective?.permvalue || 0, newNeg, effective?.permskip || 0);
                                      }}
                                      className={cn(
                                        'h-4 w-4 rounded border flex items-center justify-center text-[9px] transition-colors',
                                        isSet && effective?.permnegated
                                          ? 'bg-destructive/20 border-destructive text-destructive'
                                          : 'border-border/50',
                                      )}
                                      title="Negate"
                                    >
                                      {isSet && effective?.permnegated ? 'N' : ''}
                                    </button>
                                  )}
                                </div>
                                <div className="col-span-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isSet && (
                                    <button
                                      onClick={() => removePerm(perm.permsid)}
                                      className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      title="Remove permission"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                  )}
                                  {isChanged && (
                                    <span className="text-[9px] text-primary font-mono-data">modified</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {categories.size === 0 && (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-sm text-muted-foreground">No permissions match your search</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
