import { Outlet } from 'react-router-dom';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col min-w-0">
      <Topbar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 animate-fade-in w-full max-w-[1700px] mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
