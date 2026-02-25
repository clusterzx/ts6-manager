import { useDashboard } from '@/hooks/use-dashboard';
import { useServerStore } from '@/stores/server.store';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { WidgetManagerModal } from '@/components/widget/WidgetManagerModal';
import { formatBytes, formatUptime } from '@/lib/utils';
import { Users, Activity, Clock, Hash, ArrowDownToLine, ArrowUpFromLine, Wifi, Server, LayoutGrid } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from 'react';

interface StatsCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accentColor?: string;
}

function StatsCard({ icon: Icon, label, value, sub, accentColor = 'text-primary' }: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold font-mono-data ${accentColor}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2.5">
            <Icon className={`h-5 w-5 ${accentColor}`} />
          </div>
        </div>
      </CardContent>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent ${accentColor === 'text-primary' ? 'via-primary/50' : accentColor === 'text-emerald-400' ? 'via-emerald-500/50' : accentColor === 'text-amber-400' ? 'via-amber-500/50' : 'via-violet-500/50'} to-transparent`} />
    </Card>
  );
}

export default function Dashboard() {
  const { selectedConfigId, selectedSid } = useServerStore();
  const { data, isLoading, error } = useDashboard();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [bandwidthHistory, setBandwidthHistory] = useState<any[]>([]);
  const [showWidgets, setShowWidgets] = useState(false);

  // Build bandwidth history from periodic data
  useEffect(() => {
    if (data) {
      setBandwidthHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            in: data.bandwidth.incoming,
            out: data.bandwidth.outgoing,
          },
        ];
        return next.slice(-30); // Keep last 30 data points
      });
    }
  }, [data]);

  if (!selectedConfigId || !selectedSid) {
    return (
      <EmptyState
        icon={Server}
        title="No server selected"
        description="Select a server connection from the header to view the dashboard."
      />
    );
  }

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <EmptyState
        icon={Wifi}
        title="Connection failed"
        description="Could not connect to the TeamSpeak server. Check your connection settings."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{data.serverName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="success" className="font-mono-data text-[10px]">ONLINE</Badge>
            <span className="text-xs text-muted-foreground font-mono-data">{data.version} / {data.platform}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowWidgets(true)}>
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Widgets
            </Button>
          )}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-mono-data uppercase tracking-widest">Live Monitoring</p>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
              <span className="text-[10px] text-emerald-400 font-mono-data">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          label="Online Users"
          value={data.onlineUsers}
          sub={`of ${data.maxClients} slots`}
          accentColor="text-primary"
        />
        <StatsCard
          icon={Hash}
          label="Channels"
          value={data.channelCount}
          accentColor="text-violet-400"
        />
        <StatsCard
          icon={Clock}
          label="Uptime"
          value={formatUptime(data.uptime)}
          accentColor="text-emerald-400"
        />
        <StatsCard
          icon={Activity}
          label="Ping"
          value={`${parseFloat(String(data.ping || 0)).toFixed(1)}ms`}
          sub={`Loss: ${(parseFloat(String(data.packetloss || 0)) * 100).toFixed(2)}%`}
          accentColor="text-amber-400"
        />
      </div>

      {/* Bandwidth + Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bandwidth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Bandwidth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {bandwidthHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bandwidthHistory}>
                    <defs>
                      <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(186, 72%, 42%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(186, 72%, 42%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(280, 55%, 60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(280, 55%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215, 16%, 50%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 16%, 50%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} width={60} />
                    <ReTooltip
                      contentStyle={{ background: 'hsl(218, 28%, 10%)', border: '1px solid hsl(215, 22%, 14%)', borderRadius: '6px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(213, 20%, 85%)' }}
                      formatter={(value: number, name: string) => [formatBytes(value) + '/s', name === 'in' ? 'Download' : 'Upload']}
                    />
                    <Area type="monotone" dataKey="in" stroke="hsl(186, 72%, 42%)" fill="url(#inGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="out" stroke="hsl(280, 55%, 60%)" fill="url(#outGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground font-mono-data">
                  Collecting data...
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2 text-xs">
                <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">In:</span>
                <span className="font-mono-data text-primary">{formatBytes(data.bandwidth.incoming)}/s</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <ArrowUpFromLine className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-muted-foreground">Out:</span>
                <span className="font-mono-data text-violet-400">{formatBytes(data.bandwidth.outgoing)}/s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Server Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">User Slots</span>
                <span className="font-mono-data">{data.onlineUsers} / {data.maxClients}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  style={{ width: `${Math.min((data.onlineUsers / data.maxClients) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono-data">
                {((data.onlineUsers / data.maxClients) * 100).toFixed(1)}% utilized
              </p>
            </div>

            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Server Version</span>
                <span className="font-mono-data text-foreground">{data.version?.split(' ')[0]}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-mono-data text-foreground">{data.platform}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Channels</span>
                <span className="font-mono-data text-foreground">{data.channelCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono-data text-emerald-400">{formatUptime(data.uptime)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WidgetManagerModal open={showWidgets} onOpenChange={setShowWidgets} />
    </div>
  );
}
