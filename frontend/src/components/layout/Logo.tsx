import { Icon } from '@/components/ui/Icon';

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow shrink-0">
        <Icon name="dumbbell" size={20} className="text-white" strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-extrabold text-navy-900 tracking-tight">FIT CLUB</span>
          <span className="text-[10px] font-bold text-brand-600 tracking-widest">AI PLATFORM</span>
        </div>
      )}
    </div>
  );
}
