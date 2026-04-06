import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { TableLandingPage } from './pages/TableLandingPage';
import { MenuPage } from './pages/MenuPage';
import { ChannelLandingPage } from './pages/ChannelLandingPage';
import { ChannelMenuPage } from './pages/ChannelMenuPage';
import './index.css';

function NotFoundPage() {
  return (
    <div className="app-container items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="text-center px-8">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-slate-500 text-sm">Escanea el QR de tu mesa para comenzar</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/mesa/:tableToken" element={<TableLandingPage />} />
        <Route path="/mesa/:tableToken/menu" element={<MenuPage />} />
        {/* Delivery & Takeaway channel routes */}
        <Route path="/channel/:channelType/:token" element={<ChannelLandingPage />} />
        <Route path="/channel/:channelType/:token/menu" element={<ChannelMenuPage />} />
        <Route path="/" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            borderRadius: '14px',
            background: '#1E293B',
            color: '#F8FAFC',
            padding: '12px 16px',
            maxWidth: '320px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#F8FAFC' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#F8FAFC' } },
        }}
      />
    </BrowserRouter>
  );
}
