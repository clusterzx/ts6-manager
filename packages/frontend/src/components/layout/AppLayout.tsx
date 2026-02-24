import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/auth.store';
import { Toaster } from 'sonner';

export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto grid-bg">
          <div className="p-5 fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-popover text-popover-foreground border-border',
        }}
      />
    </div>
  );
}
