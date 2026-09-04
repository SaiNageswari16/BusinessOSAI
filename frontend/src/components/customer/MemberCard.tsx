import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import type { CustomerProfile } from '@/types/customer';

export function MemberCard({ profile }: { profile: CustomerProfile }) {
  const qrData = `FITCLUB:${profile.member_code}:${profile.id}`;

  return (
    <div className="card p-6 bg-gradient-to-br from-navy-900 via-brand-900 to-navy-950 text-white relative overflow-hidden shadow-2xl border border-brand-500/20">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.5) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(168,85,247,0.3) 0%, transparent 50%)',
        }}
      />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
            {profile.profile_image ? (
              <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-brand-300">
                {profile.full_name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono tracking-widest text-brand-300 uppercase font-bold">DIGITAL MEMBER ID</span>
              <Badge variant="success" dot>Active</Badge>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{profile.full_name}</h2>
            <div className="text-xs text-navy-300 font-mono mt-0.5">ID: {profile.member_code}</div>
            <div className="text-xs text-brand-200 mt-1 font-medium">{profile.membership?.plan_name || 'Standard Plan'}</div>
          </div>
        </div>

        {/* Dynamic QR Code Badge */}
        <div className="flex flex-col items-center bg-white/10 backdrop-blur border border-white/20 p-3 rounded-2xl shrink-0">
          <div className="w-20 h-20 bg-white p-1.5 rounded-xl flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 100 100" className="w-full h-full text-navy-950">
              <rect x="0" y="0" width="30" height="30" fill="currentColor" />
              <rect x="5" y="5" width="20" height="20" fill="white" />
              <rect x="10" y="10" width="10" height="10" fill="currentColor" />

              <rect x="70" y="0" width="30" height="30" fill="currentColor" />
              <rect x="75" y="5" width="20" height="20" fill="white" />
              <rect x="80" y="10" width="10" height="10" fill="currentColor" />

              <rect x="0" y="70" width="30" height="30" fill="currentColor" />
              <rect x="5" y="75" width="20" height="20" fill="white" />
              <rect x="10" y="80" width="10" height="10" fill="currentColor" />

              <rect x="40" y="10" width="10" height="10" fill="currentColor" />
              <rect x="40" y="40" width="20" height="20" fill="currentColor" />
              <rect x="70" y="50" width="10" height="20" fill="currentColor" />
              <rect x="20" y="40" width="10" height="10" fill="currentColor" />
              <rect x="50" y="70" width="20" height="10" fill="currentColor" />
              <rect x="80" y="80" width="10" height="10" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[10px] font-mono text-brand-200 mt-1.5 tracking-wider uppercase flex items-center gap-1">
            <Icon name="qr-code" size={10} /> Scan Check-In
          </span>
        </div>
      </div>
    </div>
  );
}
