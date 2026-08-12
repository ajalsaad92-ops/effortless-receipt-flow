import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Toaster } from '@/components/ui/sonner';
import type { QueryClient } from '@tanstack/react-query';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AirScreen Clone',
      },
      {
        name: 'description',
        content: 'Professional Screen Mirroring and Casting receiver',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-emerald-500/30">
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            AS
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            AirScreen
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
          <Link to="/" className="hover:text-emerald-400 transition-colors [&.active]:text-emerald-400">Home</Link>
          <Link to="/how-to" className="hover:text-emerald-400 transition-colors [&.active]:text-emerald-400">Help</Link>
          <Link to="/settings" className="hover:text-emerald-400 transition-colors [&.active]:text-emerald-400">Settings</Link>
        </nav>
      </header>

      <main className="pt-20">
        <Outlet />
      </main>

      <Toaster position="bottom-right" theme="dark" closeButton />
      {process.env.NODE_ENV === 'development' && <TanStackRouterDevtools position="bottom-left" />}
    </div>
  );
}
