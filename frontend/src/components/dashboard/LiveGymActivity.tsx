import { Icon } from '@/components/ui/Icon';
import type { LiveActivityItem } from '@/types/dashboard';

interface LiveGymActivityProps {
  activity: LiveActivityItem[];
}

export function LiveGymActivity({ activity }: LiveGymActivityProps) {
  const getIcon = (type: LiveActivityItem['type']) => {
    switch (type) {
      case 'checkin':
        return { name: 'scan-face', color: 'text-blue-600 bg-blue-50' };
      case 'membership':
        return { name: 'credit-card', color: 'text-purple-600 bg-purple-50' };
      case 'payment':
        return { name: 'indian-rupee', color: 'text-emerald-600 bg-emerald-50' };
      case 'body_scan':
        return { name: 'scale', color: 'text-teal-600 bg-teal-50' };
      case 'workout':
        return { name: 'dumbbell', color: 'text-amber-600 bg-amber-50' };
      default:
        return { name: 'activity', color: 'text-navy-600 bg-navy-50' };
    }
  };

  const itemsToRender = activity || [];

  return (
    <div className="card p-5 bg-white border border-navy-100/80 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-extrabold text-navy-900 tracking-wider uppercase">LIVE GYM ACTIVITY</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>

        {itemsToRender.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-navy-400">
            No check-in or activity events recorded today yet.
          </div>
        ) : (
          <div className="space-y-3">
            {itemsToRender.map((item, index) => {
              const iconMeta = getIcon(item.type);
              const avatarUrl = `https://images.unsplash.com/photo-${1534528741775 + index * 1000}?auto=format&fit=crop&w=80&q=80`;

              return (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-navy-50/60 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={avatarUrl}
                        alt={item.title}
                        className="w-9 h-9 rounded-full object-cover border border-navy-100 shadow-xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=2563EB&color=fff`;
                        }}
                      />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${iconMeta.color} flex items-center justify-center text-[9px] shadow-2xs border border-white`}>
                        <Icon name={iconMeta.name} size={10} />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-navy-900 group-hover:text-brand-600 transition-colors">{item.title}</h4>
                      <p className="text-[11px] font-medium text-navy-500">{item.description}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-navy-400 shrink-0">{item.time}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-navy-100 text-center">
        <button className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1">
          View All Activity <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
