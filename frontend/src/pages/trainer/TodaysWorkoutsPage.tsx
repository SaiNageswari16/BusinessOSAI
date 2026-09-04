import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import type { Member } from '@/types';
import { cn } from '@/utils/cn';

export function TodaysWorkoutsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.workouts.todaySessions()
      .then((data: any[]) => {
        if (data && Array.isArray(data)) {
          const avatars = ['from-brand-400 to-brand-600', 'from-success-400 to-success-600', 'from-warning-400 to-warning-600', 'from-ai-400 to-ai-600'];
          const formatted = data.map((s, idx) => ({
            id: s.id || `sess_${idx}`,
            time: s.time || '09:00 AM',
            name: s.name || 'Gym Member',
            type: s.type || 'Full Body Workout',
            duration: s.duration || '45 min',
            status: (s.status || 'upcoming').toLowerCase(),
            avatar: avatars[idx % avatars.length],
          }));
          setSessions(formatted);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const upcomingCount = sessions.filter((s) => s.status === 'upcoming').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Today's Workouts" breadcrumb={['Trainer', "Today's Workouts"]} actions={<button className="btn-primary"><Icon name="plus" size={16} /> Schedule Session</button>} />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Total Sessions</span><div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Icon name="calendar" size={16} className="text-brand-600" /></div></div><div className="text-2xl font-bold text-navy-900">{sessions.length}</div><div className="text-xs text-navy-400 mt-1">scheduled today</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Completed</span><div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center"><Icon name="check-circle" size={16} className="text-success-600" /></div></div><div className="text-2xl font-bold text-success-600">{completedCount}</div><div className="text-xs text-navy-400 mt-1">sessions done</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Upcoming</span><div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center"><Icon name="clock" size={16} className="text-warning-600" /></div></div><div className="text-2xl font-bold text-warning-600">{upcomingCount}</div><div className="text-xs text-navy-400 mt-1">remaining today</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Total Duration</span><div className="w-8 h-8 rounded-lg bg-ai-50 flex items-center justify-center"><Icon name="timer" size={16} className="text-ai-600" /></div></div><div className="text-2xl font-bold text-navy-900">{sessions.length * 45}m</div><div className="text-xs text-navy-400 mt-1">of training</div></div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-base font-bold text-navy-900 mb-4">Session Timeline</h3>
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <div key={s.id || i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-navy-50 transition-colors group">
              <div className="text-center w-16 shrink-0">
                <div className="text-sm font-bold text-navy-900">{s.time.split(' ')[0]}</div>
                <div className="text-xs text-navy-400">{s.time.split(' ')[1]}</div>
              </div>
              <div className="w-px h-12 bg-navy-200" />
              <div className={cn('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold shrink-0', s.avatar)}>{s.name.split(' ').map((n: string) => n[0]).join('')}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-navy-900">{s.name}</div>
                <div className="text-xs text-navy-400">{s.type} · {s.duration}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={s.status === 'completed' ? 'success' : 'brand'} dot>{s.status}</Badge>
                <button className="btn-secondary text-xs py-2 opacity-0 group-hover:opacity-100 transition-opacity">Start</button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && !loading && (
            <div className="text-xs text-navy-400 text-center py-6">No scheduled sessions for today</div>
          )}
        </div>
      </div>
    </div>
  );
}
