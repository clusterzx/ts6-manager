import { useQuery } from '@tanstack/react-query';
import { musicRequestsApi } from '@/api/music-requests.api';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Music, ExternalLink, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function MusicRequests() {
    const { selectedConfigId: c } = useServerStore();

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['music-requests', c],
        queryFn: () => musicRequestsApi.list(c!),
        enabled: !!c,
    });

    if (!c) return <EmptyState icon={Music} title="No server selected" />;
    if (isLoading) return <PageLoader />;

    return (
        <div className="space-y-4 h-full flex flex-col max-w-5xl mx-auto">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <Music className="w-5 h-5 text-primary" /> Music Request History
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        History of songs requested via the <code className="text-xs bg-muted px-1 rounded text-primary">!play</code> command on this server.
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col border border-border rounded-lg bg-card shadow-sm relative">
                {requests.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <EmptyState
                            icon={Music}
                            title="No music requests yet"
                            description="When users request songs using the !play command, they will appear here as a history log."
                        />
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="p-4 grid gap-3">
                            {requests.map((req) => (
                                <a
                                    key={req.id}
                                    href={req.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl",
                                        "bg-muted/30 border border-border/50 shadow-sm",
                                        "hover:bg-muted/50 hover:border-border hover:shadow-md",
                                        "transition-all duration-200 group"
                                    )}
                                >
                                    {/* Icon or Thumbnail Placeholder */}
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                        <Music className="w-4 h-4 text-primary" />
                                    </div>

                                    {/* Content Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[15px] truncate group-hover:text-primary transition-colors">
                                            {req.title}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/80">
                                            <span className="flex items-center gap-1.5 font-mono-data">
                                                <Clock className="w-3.5 h-3.5" />
                                                Requested {formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Clickable Action */}
                                    <div className="pl-4 pr-2 shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
