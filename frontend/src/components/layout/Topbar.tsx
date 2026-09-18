import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Logo } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { getNavItems } from '@/config/navigation';
import { cn } from '@/utils/cn';

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [items, setItems] = useState(() => (user ? getNavItems(user.role) : []));

  useEffect(() => {
    const updateItems = () => {
      if (user) setItems(getNavItems(user.role));
    };
    updateItems();
    window.addEventListener('fitclub_modules_changed', updateItems);
    window.addEventListener('storage', updateItems);
    return () => {
      window.removeEventListener('fitclub_modules_changed', updateItems);
      window.removeEventListener('storage', updateItems);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = user?.role
    ? user.role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Owner';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
      {/* Top Header Row */}
      <div className="h-16 flex items-center justify-between px-2.5 sm:px-3.5 lg:px-4 gap-4 border-b border-slate-100">
        {/* Left: Brand Logo & Gym Location Selector */}
        <div className="flex items-center gap-4 min-w-0">
          <Logo />

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors">
            <Icon name="map-pin" size={14} className="text-purple-600" />
            <span className="truncate max-w-[180px]">
              {user?.gymName && user?.branchName
                ? `${user.gymName} - ${user.branchName}`
                : user?.gymName || user?.branchName || 'Main Branch'}
            </span>
            <Icon name="chevron-down" size={12} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Icon
              name="search"
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search members, invoices, reports..."
              className="w-full pl-9 pr-12 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-400 shadow-2xs">
              ⌘K
            </span>
          </div>
        </div>

        {/* Right: Notifications & User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                setShowProfile(false);
              }}
              className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <Icon name="bell" size={19} />
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                12
              </span>
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl p-4 space-y-3 animate-slide-up z-50 shadow-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 uppercase">Notifications</span>
                  <Badge variant="brand">12 new</Badge>
                </div>
                {[
                  {
                    icon: 'alert-triangle',
                    title: 'High churn risk',
                    desc: '3 members need attention',
                    time: '5m ago',
                    color: 'text-rose-600 bg-rose-50',
                  },
                  {
                    icon: 'clock',
                    title: 'Membership expiring',
                    desc: '2 memberships expire this week',
                    time: '1h ago',
                    color: 'text-amber-600 bg-amber-50',
                  },
                  {
                    icon: 'indian-rupee',
                    title: 'Payment received',
                    desc: '₹18,000 from Vikram Singh',
                    time: '2h ago',
                    color: 'text-emerald-600 bg-emerald-50',
                  },
                ].map((n, i) => (
                  <div key={i} className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', n.color)}>
                      <Icon name={n.icon} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900">{n.title}</div>
                      <div className="text-[11px] font-medium text-slate-500">{n.desc}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfile(!showProfile);
                setShowNotifs(false);
              }}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              {user?.avatar || localStorage.getItem('fitclub_owner_avatar') ? (
                <img
                  src={user?.avatar || localStorage.getItem('fitclub_owner_avatar') || ''}
                  alt={user?.name || 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center border border-purple-200/80 shadow-2xs uppercase">
                  {(user?.name || 'Owner')
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'O'}
                </div>
              )}
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-extrabold text-slate-900">{user?.name || 'User'}</span>
                <span className="text-[10px] font-medium text-slate-400">{roleLabel}</span>
              </div>
              <Icon name="chevron-down" size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl p-2 animate-slide-up z-50 shadow-xl border border-slate-100">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <div className="text-xs font-extrabold text-slate-900">{user?.name || 'Yashwanth'}</div>
                  <div className="text-[11px] text-slate-400">{user?.email || 'owner@fitclub.ai'}</div>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate(user?.role === 'customer' ? '/app/profile' : `/${user?.role || 'owner'}/settings`);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2"
                >
                  <Icon name="user" size={14} />
                  <span>Profile & Account</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate(`/${user?.role || 'owner'}/settings`);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2"
                >
                  <Icon name="settings" size={14} />
                  <span>Settings</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-2"
                >
                  <Icon name="log-out" size={14} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Pill Navigation Bar (Layout Matching Image 2) */}
      <div className="w-full overflow-x-auto py-2 px-2.5 sm:px-3.5 lg:px-4 no-scrollbar bg-slate-50/40 border-t border-slate-100/80">
        <div className="flex items-center gap-2 min-w-max">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={
                item.path === '/owner' ||
                item.path === '/trainer' ||
                item.path === '/app' ||
                item.path === '/super-admin'
              }
              className={({ isActive }) =>
                cn(
                  'px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 transition-all duration-150 select-none shadow-2xs',
                  isActive
                    ? 'bg-purple-50 text-purple-700 border-purple-300 font-extrabold shadow-xs ring-1 ring-purple-300/50'
                    : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-950 font-bold hover:border-slate-300'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={item.icon}
                    size={15}
                    className={cn('shrink-0', isActive ? 'text-purple-700' : 'text-slate-500')}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
