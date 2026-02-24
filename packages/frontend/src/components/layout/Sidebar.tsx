import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Server, Hash, Users, Shield, ShieldCheck,
  Lock, Ban, KeyRound, FolderOpen, MessageSquareWarning, Mail,
  ScrollText, Settings, Bot, Cpu, ChevronLeft, ChevronRight, Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/servers', icon: Server, label: 'Virtual Servers', adminOnly: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/channels', icon: Hash, label: 'Channels' },
      { to: '/clients', icon: Users, label: 'Clients' },
      { to: '/server-groups', icon: Shield, label: 'Server Groups', adminOnly: true },
      { to: '/channel-groups', icon: ShieldCheck, label: 'Channel Groups', adminOnly: true },
      { to: '/permissions', icon: Lock, label: 'Permissions', adminOnly: true },
    ],
  },
  {
    label: 'Security',
    adminOnly: true,
    items: [
      { to: '/bans', icon: Ban, label: 'Bans', adminOnly: true },
      { to: '/tokens', icon: KeyRound, label: 'Tokens', adminOnly: true },
    ],
  },
  {
    label: 'Content',
    adminOnly: true,
    items: [
      { to: '/files', icon: FolderOpen, label: 'Files', adminOnly: true },
      { to: '/complaints', icon: MessageSquareWarning, label: 'Complaints', adminOnly: true },
      { to: '/messages', icon: Mail, label: 'Messages', adminOnly: true },
    ],
  },
  {
    label: 'System',
    adminOnly: true,
    items: [
      { to: '/logs', icon: ScrollText, label: 'Server Logs', adminOnly: true },
      { to: '/instance', icon: Cpu, label: 'Instance', adminOnly: true },
    ],
  },
  {
    label: 'Automation',
    adminOnly: true,
    items: [
      { to: '/bots', icon: Bot, label: 'Bot Flows', adminOnly: true },
      { to: '/music-bots', icon: Music, label: 'Music Bots', adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative',
          sidebarCollapsed ? 'w-16' : 'w-56',
        )}
      >
        {/* Logo area */}
        <div className={cn('flex items-center h-14 px-4 border-b border-sidebar-border', sidebarCollapsed && 'justify-center px-0')}>
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-xs font-mono-data">TS</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-sidebar-accent-foreground">TS6</span>
                <span className="text-sm text-sidebar-foreground ml-1">Manager</span>
              </div>
            </div>
          ) : (
            <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-xs font-mono-data">TS</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {navSections
              .filter((section) => !(section as any).adminOnly || isAdmin)
              .map((section, si) => {
              const visibleItems = section.items.filter((item) => !(item as any).adminOnly || isAdmin);
              if (visibleItems.length === 0) return null;
              return (
              <div key={section.label}>
                {si > 0 && <Separator className="my-2 bg-sidebar-border" />}
                {!sidebarCollapsed && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                    {section.label}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150',
                        sidebarCollapsed && 'justify-center px-0 py-2',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </NavLink>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return link;
                })}
              </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Settings + Collapse */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <NavLink
            to="/settings"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors',
              sidebarCollapsed && 'justify-center px-0 py-2',
              location.pathname.startsWith('/settings') && 'bg-sidebar-accent text-sidebar-accent-foreground',
            )}
          >
            <Settings className="h-4 w-4" />
            {!sidebarCollapsed && <span>Settings</span>}
          </NavLink>

          <button
            onClick={toggleSidebar}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full',
              sidebarCollapsed && 'justify-center px-0 py-2',
            )}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
