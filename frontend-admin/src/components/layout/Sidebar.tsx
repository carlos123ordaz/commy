import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, QrCode, UtensilsCrossed, ShoppingBag,
  ChefHat, Users, Settings, LogOut, Building2, Table2,
  ChevronLeft, ChevronRight, Bell, LayoutGrid, History,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../config/api';
import toast from 'react-hot-toast';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/salon', icon: <LayoutGrid size={20} />, label: 'Salón', roles: ['owner', 'cashier', 'waiter'] },
  { to: '/mesas', icon: <Table2 size={20} />, label: 'Mesas' },
  { to: '/qr', icon: <QrCode size={20} />, label: 'Códigos QR' },
  { to: '/menu', icon: <UtensilsCrossed size={20} />, label: 'Menú' },
  { to: '/pedidos', icon: <ShoppingBag size={20} />, label: 'Pedidos Live', roles: ['owner', 'cashier', 'waiter'] },
  { to: '/historial', icon: <History size={20} />, label: 'Historial', roles: ['owner', 'cashier'] },
  { to: '/clientes', icon: <Users size={20} />, label: 'Clientes', roles: ['owner', 'cashier'] },
  { to: '/cocina', icon: <ChefHat size={20} />, label: 'Cocina', roles: ['owner', 'cashier', 'kitchen'] },
  { to: '/notificaciones', icon: <Bell size={20} />, label: 'Notificaciones' },
  { to: '/staff', icon: <Users size={20} />, label: 'Staff', roles: ['owner'] },
  { to: '/configuracion', icon: <Settings size={20} />, label: 'Configuración', roles: ['owner'] },
];

const superAdminItems: NavItem[] = [
  { to: '/sa/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard SA' },
  { to: '/sa/restaurantes', icon: <Building2 size={20} />, label: 'Restaurantes' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    logout();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  const items = user?.role === 'superadmin' ? superAdminItems : navItems;
  const visibleItems = items.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        'bg-sidebar h-screen flex flex-col transition-all duration-300 z-50',
        // Mobile: fixed overlay drawer; Desktop: relative in-flow
        'fixed inset-y-0 left-0 lg:relative',
        // Mobile slide in/out; Desktop always visible
        collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0',
        // Width: collapsed desktop = icons only, otherwise full
        collapsed ? 'w-60 lg:w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-lg tracking-tight">Commy</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">
            {user?.role === 'superadmin' ? 'Super Admin' : 'Menú'}
          </p>
        )}
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer text-sm font-medium',
                isActive
                  ? 'text-white bg-primary-600'
                  : 'text-slate-400 hover:text-white hover:bg-white/10',
                collapsed && 'justify-center'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <p className="text-xs font-medium text-white capitalize">{user.role}</p>
        </div>
      )}

      {/* Logout */}
      <div className="px-2 pb-4">
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>

      {/* Toggle button - desktop only */}
      <button
        onClick={onToggle}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center shadow-sm text-slate-500 hover:text-primary-600 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
};
