import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { TablesPage } from '../pages/tables/TablesPage';
import { QRManagerPage } from '../pages/tables/QRManagerPage';
import { MenuPage } from '../pages/menu/MenuPage';
import { OrdersLivePage } from '../pages/orders/OrdersLivePage';
import { KitchenPage } from '../pages/kitchen/KitchenPage';
import { StaffPage } from '../pages/staff/StaffPage';
import { RestaurantsPage } from '../pages/superadmin/RestaurantsPage';
import { FloorPlanPage } from '../pages/floor-plan/FloorPlanPage';
import { FloorPlanEditorPage } from '../pages/floor-plan/FloorPlanEditorPage';
import { ChannelSettingsPage } from '../pages/settings/ChannelSettingsPage';
import { OrderHistoryPage } from '../pages/orders/OrderHistoryPage';
import { CustomersPage } from '../pages/customers/CustomersPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function NotificationsPage() {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-lg font-medium">Notificaciones</p>
      <p className="text-sm mt-1">Las alertas en tiempo real aparecen en la campana de la topbar</p>
    </div>
  );
}


export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="salon" element={<FloorPlanPage />} />
        <Route path="salon/editor" element={<FloorPlanEditorPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="qr" element={<QRManagerPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="pedidos" element={<OrdersLivePage />} />
        <Route path="historial" element={<OrderHistoryPage />} />
        <Route
          path="clientes"
          element={
            <RoleRoute roles={['owner', 'cashier']}>
              <CustomersPage />
            </RoleRoute>
          }
        />
        <Route path="cocina" element={<KitchenPage />} />
        <Route path="notificaciones" element={<NotificationsPage />} />
        <Route
          path="staff"
          element={
            <RoleRoute roles={['owner', 'superadmin']}>
              <StaffPage />
            </RoleRoute>
          }
        />
        <Route path="configuracion" element={
          <RoleRoute roles={['owner']}>
            <ChannelSettingsPage />
          </RoleRoute>
        } />
        <Route
          path="sa/restaurantes"
          element={
            <RoleRoute roles={['superadmin']}>
              <RestaurantsPage />
            </RoleRoute>
          }
        />
        <Route
          path="sa/dashboard"
          element={
            <RoleRoute roles={['superadmin']}>
              <DashboardPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
