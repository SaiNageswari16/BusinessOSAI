import { Icon } from '@/components/ui/Icon';

interface DashboardHeaderProps {
  userName?: string;
  gymName?: string;
  branchName?: string;
}

export function DashboardHeader({
  userName = 'YASHWANTH',
  gymName = 'Fit Club Elite',
  branchName = 'Indiranagar',
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2">
          GOOD MORNING, {userName.toUpperCase()} 👋
        </h1>
        <p className="text-xs sm:text-sm text-navy-500 font-medium mt-0.5">
          Here&apos;s what&apos;s happening at <span className="font-semibold text-navy-700">{gymName} {branchName}</span> today.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Icon name="plus" size={16} />
          <span>Quick Action</span>
          <Icon name="chevron-down" size={14} className="opacity-80" />
        </button>
      </div>
    </div>
  );
}
