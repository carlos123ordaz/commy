import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSocket } from '../../hooks/useSocket';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/mesas': 'Gestión de Mesas',
  '/qr': 'Generador de QR',
  '/menu': 'Menú',
  '/pedidos': 'Pedidos en Vivo',
  '/cocina': 'Panel de Cocina',
  '/staff': 'Staff',
  '/configuracion': 'Configuración',
  '/notificaciones': 'Notificaciones',
  '/sa/restaurantes': 'Restaurantes',
  '/sa/dashboard': 'Super Admin Dashboard',
};

export const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
  const location = useLocation();
  useSocket();
  const { permission, requestPermission } = usePushNotifications();

  const title = pageTitles[location.pathname] || 'Commy';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onMenuToggle={() => setCollapsed(!collapsed)}
          title={title}
          notifPermission={permission}
          onRequestNotifPermission={requestPermission}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
