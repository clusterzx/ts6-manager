import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/stores/auth.store';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Lazy-loaded pages
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const VirtualServers = lazy(() => import('@/pages/VirtualServers'));
const Channels = lazy(() => import('@/pages/Channels'));
const Clients = lazy(() => import('@/pages/Clients'));
const ServerGroups = lazy(() => import('@/pages/ServerGroups'));
const ChannelGroups = lazy(() => import('@/pages/ChannelGroups'));
const Permissions = lazy(() => import('@/pages/Permissions'));
const Bans = lazy(() => import('@/pages/Bans'));
const Tokens = lazy(() => import('@/pages/Tokens'));
const Files = lazy(() => import('@/pages/Files'));
const Complaints = lazy(() => import('@/pages/Complaints'));
const Messages = lazy(() => import('@/pages/Messages'));
const ServerLogs = lazy(() => import('@/pages/ServerLogs'));
const Instance = lazy(() => import('@/pages/Instance'));
const BotList = lazy(() => import('@/pages/BotList'));
const BotEditor = lazy(() => import('@/pages/BotEditor'));
const MusicBots = lazy(() => import('@/pages/MusicBots'));
const MusicRequests = lazy(() => import('@/pages/MusicRequests'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const WidgetPage = lazy(() => import('@/pages/WidgetPage'));
const SetupPage = lazy(() => import('@/pages/SetupPage'));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/widget/:token" element={<WidgetPage />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/servers" element={<AdminRoute><VirtualServers /></AdminRoute>} />
              <Route path="/channels" element={<Channels />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/server-groups" element={<AdminRoute><ServerGroups /></AdminRoute>} />
              <Route path="/channel-groups" element={<AdminRoute><ChannelGroups /></AdminRoute>} />
              <Route path="/permissions" element={<AdminRoute><Permissions /></AdminRoute>} />
              <Route path="/bans" element={<AdminRoute><Bans /></AdminRoute>} />
              <Route path="/tokens" element={<AdminRoute><Tokens /></AdminRoute>} />
              <Route path="/files" element={<AdminRoute><Files /></AdminRoute>} />
              <Route path="/complaints" element={<AdminRoute><Complaints /></AdminRoute>} />
              <Route path="/messages" element={<AdminRoute><Messages /></AdminRoute>} />
              <Route path="/logs" element={<AdminRoute><ServerLogs /></AdminRoute>} />
              <Route path="/instance" element={<AdminRoute><Instance /></AdminRoute>} />
              <Route path="/music-requests" element={<AdminRoute><MusicRequests /></AdminRoute>} />
              <Route path="/bots" element={<AdminRoute><BotList /></AdminRoute>} />
              <Route path="/bots/:botId" element={<AdminRoute><BotEditor /></AdminRoute>} />
              <Route path="/music-bots" element={<AdminRoute><MusicBots /></AdminRoute>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
