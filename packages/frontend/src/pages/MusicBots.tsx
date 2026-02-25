import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useMusicBots, useCreateMusicBot, useUpdateMusicBot, useDeleteMusicBot,
  useStartMusicBot, useStopMusicBot, useMusicBotState,
  usePlaySong, usePausePlayback, useResumePlayback, useStopPlayback,
  useSkipTrack, usePreviousTrack, useSeek, useSetVolume,
  useEnqueue, useLoadPlaylist, useRemoveFromQueue, useClearQueue,
  useSetShuffle, useSetRepeat,
} from '@/hooks/use-music-bots';
import { useSongs, useUploadSong, useDeleteSong, useYouTubeSearch, useYouTubeDownload, useYouTubeInfo, useYouTubeDownloadBatch } from '@/hooks/use-music-library';
import { useRadioStations, useRadioPresets, useCreateRadioStation, useDeleteRadioStation, usePlayRadio } from '@/hooks/use-radio-stations';
import { usePlaylists, usePlaylist, useCreatePlaylist, useDeletePlaylist, useAddSongToPlaylist, useRemoveSongFromPlaylist } from '@/hooks/use-playlists';
import { useServers } from '@/hooks/use-servers';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Music, Plus, Trash2, Play, Pause, SkipForward, SkipBack, Square,
  Volume2, VolumeX, Upload, Search, Download, ListMusic, Shuffle,
  Repeat, Repeat1, Power, PowerOff, RefreshCw, Pencil, X, Loader2,
  Youtube, FileAudio, Link, GripVertical, Music2, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/utils';
import type { MusicBotSummary, PlaybackState, SongInfo, PlaylistSummary, PlaylistDetail, YouTubeSearchResult, RadioStationInfo, RadioPreset } from '@ts6/common';

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const statusColors: Record<string, string> = {
  stopped: 'bg-zinc-500',
  starting: 'bg-amber-500 animate-pulse',
  connected: 'bg-emerald-500',
  playing: 'bg-emerald-500 animate-pulse',
  paused: 'bg-amber-500',
  error: 'bg-red-500',
};

// ─── Bot Player Card ─────────────────────────────────────────────────────────

function BotPlayerCard({ bot, onEdit, onDelete, onPlay }: {
  bot: MusicBotSummary;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
}) {
  const startBot = useStartMusicBot();
  const stopBot = useStopMusicBot();
  const { data: state } = useMusicBotState(
    bot.status !== 'stopped' ? bot.id : null,
  ) as { data: PlaybackState | undefined };

  const pausePlayback = usePausePlayback();
  const resumePlayback = useResumePlayback();
  const stopPlayback = useStopPlayback();
  const skipTrack = useSkipTrack();
  const previousTrack = usePreviousTrack();
  const setVolume = useSetVolume();
  const seekMut = useSeek();
  const shuffleMut = useSetShuffle();
  const repeatMut = useSetRepeat();

  // Local drag state so sliders don't snap back during interaction
  const [draggingSeek, setDraggingSeek] = useState<number | null>(null);
  const [draggingVolume, setDraggingVolume] = useState<number | null>(null);

  const isRunning = bot.status !== 'stopped' && bot.status !== 'error';
  const isPlaying = state?.status === 'playing';
  const isPaused = state?.status === 'paused';
  const isStreaming = state?.isStreaming ?? false;

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-2 w-2 rounded-full shrink-0 ${statusColors[bot.status] || 'bg-zinc-500'}`} />
            <CardTitle className="text-sm font-medium truncate">{bot.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] capitalize">{bot.status}</Badge>
          <Badge variant="outline" className="text-[10px]">{bot.nickname}</Badge>
          {bot.serverConfig && (
            <Badge variant="secondary" className="text-[10px]">{bot.serverConfig.name}</Badge>
          )}
        </div>

        {/* Play button when connected but idle */}
        {isRunning && !state?.nowPlaying && (
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onPlay}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Play Song...
          </Button>
        )}

        {/* Now Playing */}
        {state?.nowPlaying && (
          <div className="rounded-md bg-muted/50 p-2.5 space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              {isStreaming ? <Radio className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <Music2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{state.nowPlaying.title}</p>
                {state.nowPlaying.artist && (
                  <p className="text-[10px] text-muted-foreground truncate">{state.nowPlaying.artist}</p>
                )}
              </div>
              {isStreaming && (
                <Badge variant="destructive" className="text-[9px] shrink-0 animate-pulse">LIVE</Badge>
              )}
            </div>
            {/* Progress bar (hidden for streams) */}
            {!isStreaming && (
              <div className="space-y-1">
                <Slider
                  value={[draggingSeek ?? state.position ?? 0]}
                  max={state.duration || 1}
                  step={1}
                  onValueChange={([val]) => setDraggingSeek(val)}
                  onValueCommit={([val]) => { seekMut.mutate({ botId: bot.id, seconds: val }); setDraggingSeek(null); }}
                  className="cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatTime(draggingSeek ?? state.position)}</span>
                  <span>{formatTime(state.duration)}</span>
                </div>
              </div>
            )}
            {/* Controls */}
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => shuffleMut.mutate({ botId: bot.id, enabled: !state.shuffle })}
              >
                <Shuffle className={`h-3.5 w-3.5 ${state.shuffle ? 'text-primary' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => previousTrack.mutate(bot.id)}
              >
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              {isPlaying ? (
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => pausePlayback.mutate(bot.id)}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => resumePlayback.mutate(bot.id)}
                >
                  <Play className="h-4 w-4 ml-0.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => skipTrack.mutate(bot.id)}
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => {
                  const modes = ['off', 'track', 'queue'] as const;
                  const idx = modes.indexOf(state.repeat);
                  repeatMut.mutate({ botId: bot.id, mode: modes[(idx + 1) % 3] });
                }}
              >
                {state.repeat === 'track' ? (
                  <Repeat1 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Repeat className={`h-3.5 w-3.5 ${state.repeat === 'queue' ? 'text-primary' : ''}`} />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Volume */}
        {isRunning && (
          <div className="flex items-center gap-2">
            <VolumeX className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[draggingVolume ?? state?.volume ?? bot.volume]}
              max={100}
              step={1}
              onValueChange={([val]) => setDraggingVolume(val)}
              onValueCommit={([val]) => { setVolume.mutate({ botId: bot.id, volume: val }); setDraggingVolume(null); }}
              className="flex-1"
            />
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground w-7 text-right">{draggingVolume ?? state?.volume ?? bot.volume}%</span>
          </div>
        )}

        {/* Queue preview */}
        {state?.queue && state.queue.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Queue ({state.queue.length})</p>
            <div className="space-y-0.5 max-h-24 overflow-y-auto">
              {state.queue.slice(0, 5).map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 text-[10px] py-0.5">
                  <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                  <span className="truncate flex-1">{item.title}</span>
                  <span className="text-muted-foreground">{formatTime(item.duration)}</span>
                </div>
              ))}
              {state.queue.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">+{state.queue.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Start/Stop */}
        <div className="flex items-center gap-1.5 pt-1">
          {isRunning ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs flex-1"
                onClick={() => stopBot.mutate(bot.id, { onSuccess: () => toast.success('Bot stopped') })}
                disabled={stopBot.isPending}
              >
                <PowerOff className="h-3 w-3 mr-1" /> Stop
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs"
                onClick={onPlay}
              >
                <Music2 className="h-3 w-3 mr-1" /> Play...
              </Button>
              {state?.nowPlaying && (
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => stopPlayback.mutate(bot.id)}
                >
                  <Square className="h-3 w-3 mr-1" /> Stop Audio
                </Button>
              )}
            </>
          ) : (
            <Button variant="default" size="sm" className="h-7 text-xs flex-1"
              onClick={() => startBot.mutate(bot.id, {
                onSuccess: () => toast.success('Bot started'),
                onError: () => toast.error('Failed to start bot'),
              })}
              disabled={startBot.isPending}
            >
              <Power className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Play Song Dialog ─────────────────────────────────────────────────────────

function PlaySongDialog({ botId, onClose, onPlaySong, onEnqueue, onLoadPlaylist }: {
  botId: number | null;
  onClose: () => void;
  onPlaySong: (songId: number) => void;
  onEnqueue: (songId: number) => void;
  onLoadPlaylist: (playlistId: number) => void;
}) {
  const { selectedConfigId } = useServerStore();
  const { data: servers } = useServers();
  const [serverId, setServerId] = useState<number | null>(selectedConfigId);
  const configId = serverId || selectedConfigId;
  const { data: songs } = useSongs(configId);
  const { data: playlists } = usePlaylists();
  const [tab, setTab] = useState<'songs' | 'playlists'>('songs');
  const [filter, setFilter] = useState('');

  const serverList = Array.isArray(servers) ? servers : [];
  const songList = (Array.isArray(songs) ? songs : []) as SongInfo[];
  const playlistList = (Array.isArray(playlists) ? playlists : []) as PlaylistSummary[];

  const filtered = filter
    ? songList.filter((s) => s.title.toLowerCase().includes(filter.toLowerCase()) || (s.artist || '').toLowerCase().includes(filter.toLowerCase()))
    : songList;

  return (
    <Dialog open={botId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Play Music</DialogTitle>
          <DialogDescription>Select a song or playlist to play on this bot.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Button variant={tab === 'songs' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => setTab('songs')}
          >
            <FileAudio className="h-3 w-3 mr-1" /> Songs
          </Button>
          <Button variant={tab === 'playlists' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => setTab('playlists')}
          >
            <ListMusic className="h-3 w-3 mr-1" /> Playlists
          </Button>
          <div className="flex-1" />
          {tab === 'songs' && (
            <Select value={String(configId || '')} onValueChange={(v) => setServerId(parseInt(v))}>
              <SelectTrigger className="w-36 h-7 text-xs"><SelectValue placeholder="Server..." /></SelectTrigger>
              <SelectContent>
                {serverList.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {tab === 'songs' && (
          <>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter songs..."
              className="h-8 text-xs"
            />
            <ScrollArea className="flex-1 max-h-[400px] mt-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No songs found. Upload songs in the Library tab first.</p>
              ) : filtered.map((song) => (
                <div key={song.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{song.title}</p>
                    {song.artist && <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(song.duration)}</span>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="default" size="sm" className="h-6 text-[10px] px-2"
                      onClick={() => onPlaySong(song.id)}
                    >
                      <Play className="h-3 w-3 mr-0.5" /> Play
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                      onClick={() => onEnqueue(song.id)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> Queue
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </>
        )}

        {tab === 'playlists' && (
          <ScrollArea className="flex-1 max-h-[400px]">
            {playlistList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No playlists. Create one in the Playlists tab.</p>
            ) : playlistList.map((pl) => (
              <div key={pl.id} className="flex items-center gap-2 py-2 px-2 hover:bg-muted/30 transition-colors rounded group">
                <ListMusic className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{pl.name}</p>
                  <p className="text-[10px] text-muted-foreground">{pl.songCount} song{pl.songCount !== 1 ? 's' : ''}</p>
                </div>
                <Button variant="default" size="sm" className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onLoadPlaylist(pl.id)}
                >
                  <Play className="h-3 w-3 mr-0.5" /> Load & Play
                </Button>
              </div>
            ))}
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bots Tab ────────────────────────────────────────────────────────────────

function BotsTab() {
  const { data, isLoading } = useMusicBots();
  const { data: servers } = useServers();
  const { selectedConfigId } = useServerStore();
  const createBot = useCreateMusicBot();
  const updateBot = useUpdateMusicBot();
  const deleteBot = useDeleteMusicBot();
  const playSong = usePlaySong();
  const enqueueSong = useEnqueue();
  const loadPlaylist = useLoadPlaylist();

  const [showCreate, setShowCreate] = useState(false);
  const [editBot, setEditBot] = useState<MusicBotSummary | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showPlayDialog, setShowPlayDialog] = useState<number | null>(null);

  // Create form
  const [form, setForm] = useState({
    name: '', serverConfigId: '', nickname: 'MusicBot', serverPassword: '', defaultChannel: '', channelPassword: '', volume: 50, autoStart: false,
  });

  const bots = Array.isArray(data) ? data : [];
  const serverList = Array.isArray(servers) ? servers : [];

  if (isLoading) return <PageLoader />;

  const handleCreate = () => {
    const configId = parseInt(form.serverConfigId);
    if (!configId) { toast.error('Please select a server'); return; }
    createBot.mutate({
      name: form.name,
      serverConfigId: configId,
      nickname: form.nickname || 'MusicBot',
      serverPassword: form.serverPassword || undefined,
      defaultChannel: form.defaultChannel || undefined,
      channelPassword: form.channelPassword || undefined,
      volume: form.volume,
      autoStart: form.autoStart,
    }, {
      onSuccess: () => { toast.success('Music bot created'); setShowCreate(false); resetForm(); },
      onError: () => toast.error('Failed to create bot'),
    });
  };

  const handleUpdate = () => {
    if (!editBot) return;
    updateBot.mutate({ id: editBot.id, data: {
      name: form.name,
      nickname: form.nickname,
      serverPassword: form.serverPassword || undefined,
      defaultChannel: form.defaultChannel || undefined,
      channelPassword: form.channelPassword || undefined,
      volume: form.volume,
      autoStart: form.autoStart,
    }}, {
      onSuccess: () => { toast.success('Bot updated'); setEditBot(null); },
      onError: () => toast.error('Failed to update bot'),
    });
  };

  const resetForm = () => setForm({ name: '', serverConfigId: '', nickname: 'MusicBot', serverPassword: '', defaultChannel: '', channelPassword: '', volume: 50, autoStart: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{bots.length} music bot{bots.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Bot
        </Button>
      </div>

      {bots.length === 0 ? (
        <EmptyState icon={Music} title="No music bots yet" description="Create your first voice bot to play music on your TeamSpeak server." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots.map((bot: MusicBotSummary) => (
            <BotPlayerCard
              key={bot.id}
              bot={bot}
              onEdit={() => {
                setForm({
                  name: bot.name,
                  serverConfigId: String(bot.serverConfigId),
                  nickname: bot.nickname,
                  serverPassword: bot.serverPassword || '',
                  defaultChannel: bot.defaultChannel || '',
                  channelPassword: bot.channelPassword || '',
                  volume: bot.volume,
                  autoStart: bot.autoStart,
                });
                setEditBot(bot);
              }}
              onDelete={() => setDeleteId(bot.id)}
              onPlay={() => setShowPlayDialog(bot.id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || editBot !== null} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditBot(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBot ? 'Edit Music Bot' : 'New Music Bot'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Music Bot" />
            </div>
            {!editBot && (
              <div>
                <Label className="text-xs">Server</Label>
                <Select value={form.serverConfigId} onValueChange={(v) => setForm({ ...form, serverConfigId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select server..." /></SelectTrigger>
                  <SelectContent>
                    {serverList.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.host})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Nickname</Label>
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="MusicBot" />
            </div>
            <div>
              <Label className="text-xs">Server Password</Label>
              <Input type="password" value={form.serverPassword} onChange={(e) => setForm({ ...form, serverPassword: e.target.value })} placeholder="Leave empty if none" />
            </div>
            <div>
              <Label className="text-xs">Default Channel</Label>
              <Input value={form.defaultChannel} onChange={(e) => setForm({ ...form, defaultChannel: e.target.value })} placeholder="Channel name or ID (optional)" />
            </div>
            <div>
              <Label className="text-xs">Channel Password</Label>
              <Input type="password" value={form.channelPassword} onChange={(e) => setForm({ ...form, channelPassword: e.target.value })} placeholder="Leave empty if none" />
            </div>
            <div>
              <Label className="text-xs">Volume ({form.volume}%)</Label>
              <Slider value={[form.volume]} max={100} step={1} onValueChange={([v]) => setForm({ ...form, volume: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.autoStart} onCheckedChange={(v) => setForm({ ...form, autoStart: v })} />
              <Label className="text-xs">Auto-start on server startup</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditBot(null); }}>Cancel</Button>
            <Button onClick={editBot ? handleUpdate : handleCreate} disabled={!form.name || (!editBot && !form.serverConfigId) || createBot.isPending || updateBot.isPending}>
              {editBot ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Music Bot?"
        description="This will permanently delete this music bot and disconnect it from the server."
        onConfirm={() => {
          if (deleteId) deleteBot.mutate(deleteId, { onSuccess: () => { toast.success('Bot deleted'); setDeleteId(null); } });
        }}
        destructive
      />

      {/* Play Song Dialog */}
      <PlaySongDialog
        botId={showPlayDialog}
        onClose={() => setShowPlayDialog(null)}
        onPlaySong={(songId) => {
          if (showPlayDialog) {
            playSong.mutate({ botId: showPlayDialog, songId }, {
              onSuccess: () => { toast.success('Playing'); setShowPlayDialog(null); },
              onError: () => toast.error('Failed to play song'),
            });
          }
        }}
        onEnqueue={(songId) => {
          if (showPlayDialog) {
            enqueueSong.mutate({ botId: showPlayDialog, songId }, {
              onSuccess: () => toast.success('Added to queue'),
              onError: () => toast.error('Failed to enqueue'),
            });
          }
        }}
        onLoadPlaylist={(playlistId) => {
          if (showPlayDialog) {
            loadPlaylist.mutate({ botId: showPlayDialog, playlistId, clearFirst: true }, {
              onSuccess: () => { toast.success('Playlist loaded'); setShowPlayDialog(null); },
              onError: () => toast.error('Failed to load playlist'),
            });
          }
        }}
      />
    </div>
  );
}

// ─── Library Tab ─────────────────────────────────────────────────────────────

function LibraryTab() {
  const { selectedConfigId } = useServerStore();
  const { data: servers } = useServers();
  const [libServerId, setLibServerId] = useState<number | null>(selectedConfigId);
  const configId = libServerId || selectedConfigId;

  const { data: songs, isLoading } = useSongs(configId);
  const uploadSong = useUploadSong();
  const deleteSong = useDeleteSong();
  const ytSearch = useYouTubeSearch();
  const ytDownload = useYouTubeDownload();

  const ytInfo = useYouTubeInfo();
  const ytBatchDownload = useYouTubeDownloadBatch();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);
  const [showYt, setShowYt] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [urlInfo, setUrlInfo] = useState<{ type: 'video' | 'playlist'; items: YouTubeSearchResult[] } | null>(null);
  const [selectedUrlIds, setSelectedUrlIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  const serverList = Array.isArray(servers) ? servers : [];
  const songList = (Array.isArray(songs) ? songs : []) as SongInfo[];
  const filtered = filter
    ? songList.filter((s) => s.title.toLowerCase().includes(filter.toLowerCase()) || (s.artist || '').toLowerCase().includes(filter.toLowerCase()))
    : songList;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !configId) return;
    Array.from(files).forEach((file) => {
      const formData = new FormData();
      formData.append('file', file);
      uploadSong.mutate({ configId, formData }, {
        onSuccess: () => toast.success(`Uploaded: ${file.name}`),
        onError: () => toast.error(`Failed to upload: ${file.name}`),
      });
    });
    e.target.value = '';
  };

  const handleYtSearch = () => {
    if (!searchQuery.trim() || !configId) return;
    ytSearch.mutate({ configId, query: searchQuery }, {
      onSuccess: (data: any) => {
        setYtResults(Array.isArray(data) ? data : data?.results || []);
        setShowYt(true);
      },
      onError: () => toast.error('YouTube search failed'),
    });
  };

  const handleYtDownload = (url: string) => {
    if (!configId) return;
    ytDownload.mutate({ configId, url }, {
      onSuccess: () => toast.success('Download started'),
      onError: () => toast.error('Download failed'),
    });
  };

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'youtube': return <Youtube className="h-3 w-3" />;
      case 'url': return <Link className="h-3 w-3" />;
      default: return <FileAudio className="h-3 w-3" />;
    }
  };

  const handleLoadUrl = () => {
    if (!ytUrl.trim() || !configId) return;
    ytInfo.mutate({ configId, url: ytUrl }, {
      onSuccess: (data: any) => {
        setUrlInfo(data);
        if (data.type === 'playlist') {
          setSelectedUrlIds(new Set(data.items.map((i: any) => i.id)));
        }
      },
      onError: () => toast.error('Failed to load URL info'),
    });
  };

  const handleBatchDownload = () => {
    if (!configId || !urlInfo) return;
    const ids = Array.from(selectedUrlIds);
    const urls = ids.map((id) => `https://youtube.com/watch?v=${id}`);
    setBatchProgress(`Downloading 0/${urls.length}...`);
    ytBatchDownload.mutate({ configId, urls }, {
      onSuccess: (data: any) => {
        setBatchProgress(null);
        toast.success(`Downloaded ${data.downloaded}/${data.total} songs`);
        if (data.errors?.length) toast.error(`${data.errors.length} failed`);
        setUrlInfo(null);
        setYtUrl('');
      },
      onError: () => { setBatchProgress(null); toast.error('Batch download failed'); },
    });
  };

  const toggleUrlSelect = (id: string) => {
    setSelectedUrlIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!configId) {
    return <EmptyState icon={Music} title="Select a server" description="Choose a server to manage its music library." />;
  }

  return (
    <div className="space-y-4">
      {/* Server selector + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={String(configId)} onValueChange={(v) => setLibServerId(parseInt(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Server..." /></SelectTrigger>
          <SelectContent>
            {serverList.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter songs..."
          className="w-48"
        />
        <input ref={fileInputRef} type="file" accept="audio/*" multiple hidden onChange={handleUpload} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadSong.isPending}>
          <Upload className="h-4 w-4 mr-1" /> {uploadSong.isPending ? 'Uploading...' : 'Upload'}
        </Button>
      </div>

      {/* YouTube URL / Playlist Paste */}
      <Card className="border-dashed">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                placeholder="Paste YouTube URL or Playlist URL..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleLoadUrl} disabled={ytInfo.isPending || !ytUrl.trim()}>
              {ytInfo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4 mr-1" />}
              Load
            </Button>
            {urlInfo && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setUrlInfo(null); setYtUrl(''); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* URL Info Results */}
          {urlInfo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {urlInfo.type === 'playlist' ? `Playlist (${urlInfo.items.length} videos)` : 'Single Video'}
                </Badge>
                {urlInfo.type === 'playlist' && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]"
                      onClick={() => setSelectedUrlIds(new Set(urlInfo.items.map((i) => i.id)))}
                    >
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]"
                      onClick={() => setSelectedUrlIds(new Set())}
                    >
                      Deselect All
                    </Button>
                    <Button variant="default" size="sm" className="h-7 text-xs"
                      onClick={handleBatchDownload}
                      disabled={selectedUrlIds.size === 0 || ytBatchDownload.isPending}
                    >
                      {ytBatchDownload.isPending ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {batchProgress || 'Downloading...'}</>
                      ) : (
                        <><Download className="h-3 w-3 mr-1" /> Download {selectedUrlIds.size} Selected</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              <ScrollArea className="max-h-60">
                {urlInfo.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded transition-colors ${
                      urlInfo.type === 'playlist'
                        ? `cursor-pointer ${selectedUrlIds.has(item.id) ? 'bg-primary/10' : 'hover:bg-muted/50'}`
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => urlInfo.type === 'playlist' && toggleUrlSelect(item.id)}
                  >
                    {urlInfo.type === 'playlist' && (
                      <input
                        type="checkbox"
                        checked={selectedUrlIds.has(item.id)}
                        onChange={() => toggleUrlSelect(item.id)}
                        className="shrink-0 accent-primary"
                      />
                    )}
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" className="h-8 w-12 rounded object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">{item.artist} - {formatTime(item.duration)}</p>
                    </div>
                    {urlInfo.type === 'video' && (
                      <Button variant="default" size="sm" className="h-7 text-xs shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleYtDownload(`https://youtube.com/watch?v=${item.id}`); }}
                        disabled={ytDownload.isPending}
                      >
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* YouTube Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleYtSearch()}
            placeholder="Search YouTube..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleYtSearch} disabled={ytSearch.isPending || !searchQuery.trim()}>
          {ytSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4 mr-1" />}
          Search
        </Button>
      </div>

      {/* YouTube Results */}
      {showYt && ytResults.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">YouTube Results ({ytResults.length})</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowYt(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-60">
              {ytResults.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors">
                  {r.thumbnail && (
                    <img src={r.thumbnail} alt="" className="h-10 w-14 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">{r.artist} - {formatTime(r.duration)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0"
                    onClick={() => handleYtDownload(`https://youtube.com/watch?v=${r.id}`)}
                    disabled={ytDownload.isPending}
                  >
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Song List */}
      {isLoading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState icon={Music} title="No songs yet" description="Upload audio files or download from YouTube to build your library." />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>Title</span>
            <span className="w-20 text-right">Duration</span>
            <span className="w-16 text-center">Source</span>
            <span className="w-16 text-right">Size</span>
            <span className="w-16" />
          </div>
          <ScrollArea className="max-h-[400px]">
            {filtered.map((song) => (
              <div key={song.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 py-2 hover:bg-muted/30 transition-colors items-center border-t border-border/50">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{song.title}</p>
                  {song.artist && <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>}
                </div>
                <span className="text-xs text-muted-foreground w-20 text-right">{formatTime(song.duration)}</span>
                <span className="w-16 flex justify-center">
                  <Badge variant="outline" className="text-[9px] gap-1">{sourceIcon(song.source)} {song.source}</Badge>
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">{song.fileSize ? formatBytes(song.fileSize) : '-'}</span>
                <div className="w-16 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(song.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Song?"
        description="This will permanently remove this song from the library."
        onConfirm={() => {
          if (deleteId && configId) deleteSong.mutate({ configId, songId: deleteId }, {
            onSuccess: () => { toast.success('Song deleted'); setDeleteId(null); },
          });
        }}
        destructive
      />
    </div>
  );
}

// ─── Playlists Tab ───────────────────────────────────────────────────────────

function PlaylistsTab() {
  const { selectedConfigId } = useServerStore();
  const { data, isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const addSong = useAddSongToPlaylist();
  const removeSong = useRemoveSongFromPlaylist();

  const { data: songs } = useSongs(selectedConfigId);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAddSong, setShowAddSong] = useState(false);
  const [songFilter, setSongFilter] = useState('');

  const { data: detail } = usePlaylist(selectedId) as { data: PlaylistDetail | undefined };

  const playlists = (Array.isArray(data) ? data : []) as PlaylistSummary[];
  const songList = (Array.isArray(songs) ? songs : []) as SongInfo[];
  const playlistSongIds = new Set((detail?.songs || []).map((s: any) => s.id));
  const availableSongs = songList.filter((s) => !playlistSongIds.has(s.id) && (!songFilter || s.title.toLowerCase().includes(songFilter.toLowerCase())));

  const handleCreate = () => {
    createPlaylist.mutate({ name: newName }, {
      onSuccess: () => { toast.success('Playlist created'); setShowCreate(false); setNewName(''); },
      onError: () => toast.error('Failed to create playlist'),
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Playlist
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Playlist list */}
        <div className="space-y-1.5">
          {playlists.length === 0 ? (
            <EmptyState icon={ListMusic} title="No playlists" description="Create a playlist to organize your songs." />
          ) : playlists.map((pl) => (
            <div
              key={pl.id}
              className={`flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-colors ${
                selectedId === pl.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
              }`}
              onClick={() => setSelectedId(pl.id)}
            >
              <ListMusic className={`h-4 w-4 shrink-0 ${selectedId === pl.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{pl.name}</p>
                <p className="text-[10px] text-muted-foreground">{pl.songCount} song{pl.songCount !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); setDeleteId(pl.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Playlist detail */}
        {selectedId && detail ? (
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{detail.name}</CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddSong(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Songs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {detail.songs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No songs in this playlist</div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  {detail.songs.map((song: any, i: number) => (
                    <div key={song.id} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors border-t border-border/50">
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{song.title}</p>
                        {song.artist && <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatTime(song.duration)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeSong.mutate({ playlistId: selectedId, songId: song.id }, {
                          onSuccess: () => toast.success('Song removed'),
                        })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center text-xs text-muted-foreground py-16">
            Select a playlist to view its songs
          </div>
        )}
      </div>

      {/* Create Playlist Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Playlist</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Playlist"
              onKeyDown={(e) => e.key === 'Enter' && newName && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName || createPlaylist.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Song Dialog */}
      <Dialog open={showAddSong} onOpenChange={setShowAddSong}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Songs to Playlist</DialogTitle></DialogHeader>
          <Input
            value={songFilter}
            onChange={(e) => setSongFilter(e.target.value)}
            placeholder="Filter songs..."
          />
          <ScrollArea className="max-h-72">
            {availableSongs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No songs available. Upload songs to the library first.</p>
            ) : availableSongs.map((song) => (
              <div key={song.id} className="flex items-center gap-2 py-1.5 hover:bg-muted/30 transition-colors rounded px-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{song.title}</p>
                  {song.artist && <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>}
                </div>
                <Button variant="outline" size="sm" className="h-6 text-[10px] shrink-0"
                  onClick={() => {
                    if (selectedId) addSong.mutate({ playlistId: selectedId, songId: song.id }, {
                      onSuccess: () => toast.success('Song added'),
                    });
                  }}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Add
                </Button>
              </div>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSong(false); setSongFilter(''); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Playlist?"
        description="This will permanently delete this playlist."
        onConfirm={() => {
          if (deleteId) deletePlaylist.mutate(deleteId, {
            onSuccess: () => {
              toast.success('Playlist deleted');
              if (selectedId === deleteId) setSelectedId(null);
              setDeleteId(null);
            },
          });
        }}
        destructive
      />
    </div>
  );
}

// ─── Radio Tab ───────────────────────────────────────────────────────────────

function RadioTab() {
  const { selectedConfigId } = useServerStore();
  const { data: servers } = useServers();
  const [serverId, setServerId] = useState<number | null>(selectedConfigId);
  const configId = serverId || selectedConfigId;

  const { data: stations, isLoading } = useRadioStations(configId);
  const { data: presets } = useRadioPresets(configId);
  const createStation = useCreateRadioStation();
  const deleteStation = useDeleteRadioStation();
  const playRadio = usePlayRadio();

  const { data: bots } = useMusicBots();
  const runningBots = (Array.isArray(bots) ? bots : []).filter(
    (b: MusicBotSummary) => b.status !== 'stopped' && b.status !== 'error'
  );

  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', url: '', genre: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const serverList = Array.isArray(servers) ? servers : [];
  const stationList = (Array.isArray(stations) ? stations : []) as RadioStationInfo[];
  const presetList = (Array.isArray(presets) ? presets : []) as RadioPreset[];

  // Auto-select first running bot
  useEffect(() => {
    if (!selectedBotId && runningBots.length > 0) {
      setSelectedBotId(runningBots[0].id);
    }
  }, [runningBots, selectedBotId]);

  const handleAddStation = () => {
    if (!configId || !addForm.name || !addForm.url) return;
    createStation.mutate({
      configId,
      data: { name: addForm.name, url: addForm.url, genre: addForm.genre || undefined },
    }, {
      onSuccess: () => { toast.success('Station added'); setShowAdd(false); setAddForm({ name: '', url: '', genre: '' }); },
      onError: () => toast.error('Failed to add station'),
    });
  };

  const handleAddPreset = (preset: RadioPreset) => {
    if (!configId) return;
    createStation.mutate({
      configId,
      data: { name: preset.name, url: preset.url, genre: preset.genre },
    }, {
      onSuccess: () => toast.success(`Added: ${preset.name}`),
      onError: () => toast.error(`Failed to add: ${preset.name}`),
    });
  };

  const handlePlay = (stationId: number) => {
    if (!selectedBotId) {
      toast.error('Select a running bot first');
      return;
    }
    playRadio.mutate({ botId: selectedBotId, stationId }, {
      onSuccess: () => toast.success('Playing radio'),
      onError: () => toast.error('Failed to play radio'),
    });
  };

  if (!configId) {
    return <EmptyState icon={Radio} title="Select a server" description="Choose a server to manage radio stations." />;
  }

  return (
    <div className="space-y-4">
      {/* Server + Bot selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={String(configId)} onValueChange={(v) => setServerId(parseInt(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Server..." /></SelectTrigger>
          <SelectContent>
            {serverList.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        <Label className="text-xs text-muted-foreground">Play on:</Label>
        <Select
          value={selectedBotId ? String(selectedBotId) : ''}
          onValueChange={(v) => setSelectedBotId(parseInt(v))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={runningBots.length === 0 ? 'No running bots' : 'Select bot...'} />
          </SelectTrigger>
          <SelectContent>
            {runningBots.map((b: MusicBotSummary) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => setShowPresets(true)}>
          <Radio className="h-4 w-4 mr-1" /> Presets
        </Button>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Station
        </Button>
      </div>

      {runningBots.length === 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-500">Start a music bot first to play radio stations.</p>
        </div>
      )}

      {/* Station List */}
      {isLoading ? <PageLoader /> : stationList.length === 0 ? (
        <EmptyState icon={Radio} title="No radio stations" description="Add stations manually or from presets to start streaming." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {stationList.map((station) => (
            <Card key={station.id} className="group hover:border-primary/30 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Radio className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{station.name}</p>
                  {station.genre && (
                    <Badge variant="outline" className="text-[9px] mt-0.5">{station.genre}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePlay(station.id)}
                    disabled={!selectedBotId || playRadio.isPending}
                  >
                    <Play className="h-4 w-4 ml-0.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteId(station.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Station Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Radio Station</DialogTitle>
            <DialogDescription>Add a custom internet radio station by providing its stream URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Station name" />
            </div>
            <div>
              <Label className="text-xs">Stream URL</Label>
              <Input value={addForm.url} onChange={(e) => setAddForm({ ...addForm, url: e.target.value })} placeholder="https://stream.example.com/live" />
            </div>
            <div>
              <Label className="text-xs">Genre (optional)</Label>
              <Input value={addForm.genre} onChange={(e) => setAddForm({ ...addForm, genre: e.target.value })} placeholder="Pop, Rock, Electronic..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddStation} disabled={!addForm.name || !addForm.url || createStation.isPending}>
              Add Station
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presets Dialog */}
      <Dialog open={showPresets} onOpenChange={setShowPresets}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Radio Presets</DialogTitle>
            <DialogDescription>Add popular radio stations with one click.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[400px]">
            {presetList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No presets available.</p>
            ) : presetList.map((preset, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2 hover:bg-muted/50 transition-colors rounded">
                <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{preset.name}</p>
                  <p className="text-[10px] text-muted-foreground">{preset.genre}</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs shrink-0"
                  onClick={() => handleAddPreset(preset)}
                  disabled={createStation.isPending}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPresets(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Radio Station?"
        description="This will remove this station from your list."
        onConfirm={() => {
          if (deleteId && configId) deleteStation.mutate({ configId, id: deleteId }, {
            onSuccess: () => { toast.success('Station removed'); setDeleteId(null); },
          });
        }}
        destructive
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MusicBots() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Music Bots</h1>
        </div>
      </div>

      <Tabs defaultValue="bots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bots"><Music2 className="h-3.5 w-3.5 mr-1.5" /> Bots</TabsTrigger>
          <TabsTrigger value="library"><FileAudio className="h-3.5 w-3.5 mr-1.5" /> Library</TabsTrigger>
          <TabsTrigger value="playlists"><ListMusic className="h-3.5 w-3.5 mr-1.5" /> Playlists</TabsTrigger>
          <TabsTrigger value="radio"><Radio className="h-3.5 w-3.5 mr-1.5" /> Radio</TabsTrigger>
        </TabsList>

        <TabsContent value="bots"><BotsTab /></TabsContent>
        <TabsContent value="library"><LibraryTab /></TabsContent>
        <TabsContent value="playlists"><PlaylistsTab /></TabsContent>
        <TabsContent value="radio"><RadioTab /></TabsContent>
      </Tabs>
    </div>
  );
}
