import type { Role } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export const navConfig: Record<Role, NavItem[]> = {
  super_admin: [
    { label: 'Overview', path: '/super-admin', icon: 'layout-dashboard' },
    { label: 'Organizations', path: '/super-admin/gyms', icon: 'building-2' },
    { label: 'Global Users', path: '/super-admin/users', icon: 'users' },
    { label: 'SaaS Plans', path: '/super-admin/plans', icon: 'credit-card' },
    { label: 'Feature Controls', path: '/super-admin/features', icon: 'toggle-left' },
    { label: 'AI Platform', path: '/super-admin/ai-engine', icon: 'sparkles' },
    { label: 'Devices', path: '/super-admin/devices', icon: 'monitor' },
    { label: 'Audit Logs', path: '/super-admin/audit-logs', icon: 'shield-check' },
    { label: 'Support Desk', path: '/super-admin/support', icon: 'message-square' },
    { label: 'Settings', path: '/super-admin/settings', icon: 'settings' },
  ],
  owner: [
    { label: 'Executive Overview', path: '/owner', icon: 'layout-grid' },
    { label: 'Customers', path: '/owner/customers', icon: 'users' },
    { label: 'Memberships', path: '/owner/memberships', icon: 'credit-card' },
    { label: 'Attendance', path: '/owner/attendance', icon: 'calendar-check' },
    { label: 'Trainers', path: '/owner/trainers', icon: 'user-cog' },
    { label: 'HRMS', path: '/owner/hrms', icon: 'users' },
    { label: 'Brochures / Flyers', path: '/owner/brochures', icon: 'file-text' },
    { label: 'Nutrition', path: '/owner/nutrition', icon: 'apple' },
    { label: 'Sales & CRM', path: '/owner/crm', icon: 'trending-up' },
    { label: 'POS', path: '/owner/pos', icon: 'credit-card' },
    { label: 'Inventory', path: '/owner/inventory', icon: 'package' },
    { label: 'Payments', path: '/owner/payments', icon: 'indian-rupee' },
    { label: 'CCTV', path: '/owner/cctv', icon: 'cctv' },
    { label: 'Biometrics', path: '/owner/biometrics', icon: 'fingerprint' },
    { label: 'Body Composition', path: '/owner/body-composition', icon: 'ruler' },
    { label: 'Reports', path: '/owner/reports', icon: 'file-bar-chart' },
    { label: 'Multi-Branch', path: '/owner/multi-branch', icon: 'git-branch' },
    { label: 'Settings', path: '/owner/settings', icon: 'settings' },
  ],
  trainer: [
    { label: 'Dashboard', path: '/trainer', icon: 'layout-dashboard' },
    { label: 'My Customers', path: '/trainer/customers', icon: 'users' },
    { label: 'Nutrition', path: '/trainer/nutrition', icon: 'apple' },
    { label: 'Progress', path: '/trainer/progress', icon: 'trending-up' },
    { label: 'Attendance', path: '/trainer/attendance', icon: 'calendar-check' },
    { label: 'Messages', path: '/trainer/messages', icon: 'message-square' },
    { label: 'AI Coach', path: '/trainer/ai-coach', icon: 'sparkles' },
    { label: 'Profile', path: '/trainer/profile', icon: 'user' },
  ],
  customer: [
    { label: 'Home', path: '/app', icon: 'home' },
    { label: 'Workouts', path: '/app/workouts', icon: 'dumbbell' },
    { label: 'Nutrition', path: '/app/nutrition', icon: 'apple' },
    { label: 'Food Scanner', path: '/app/food-scanner', icon: 'scan-line' },
    { label: 'AI Coach', path: '/app/ai-coach', icon: 'sparkles' },
    { label: 'AI Transformation', path: '/app/transformation', icon: 'wand-2' },
    { label: 'Profile', path: '/app/profile', icon: 'user' },
  ],
};

export const roleHomePath: Record<Role, string> = {
  super_admin: '/super-admin',
  owner: '/owner',
  trainer: '/trainer',
  customer: '/app',
};

export function getNavItems(role: Role): NavItem[] {
  let items = navConfig[role] || [];
  if (role === 'owner') {
    const posDisabled = localStorage.getItem('fitclub_enable_pos') === 'false';
    const inventoryDisabled = localStorage.getItem('fitclub_enable_inventory') === 'false';

    if (posDisabled) {
      items = items.filter((item) => item.path !== '/owner/pos' && item.label !== 'POS');
    }
    if (inventoryDisabled) {
      items = items.filter((item) => item.path !== '/owner/inventory' && item.label !== 'Inventory');
    }
  }
  return items;
}

export function notifyModuleVisibilityChanged() {
  window.dispatchEvent(new Event('fitclub_modules_changed'));
}

