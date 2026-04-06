import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, MapPin, AlertCircle, UserCircle2, Users } from 'lucide-react';
import { api } from '../config/api';
import type { TableInfo } from '../types';
import { useSessionStore } from '../store/sessionStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

type AuthStep = 'choose' | 'guest-form';

export const TableLandingPage: React.FC = () => {
  const { tableToken } = useParams<{ tableToken: string }>();
  const navigate = useNavigate();
  const {
    sessionId,
    alias: storedAlias,
    googleCustomer,
    setSession,
    setOrder,
    setAlias,
    setGoogleCustomer,
  } = useSessionStore();

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<AuthStep>('choose');
  const [alias, setAliasInput] = useState(storedAlias || '');
  const [joining, setJoining] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tableToken) { setError('QR inválido'); setLoading(false); return; }

    api.get(`/tables/token/${tableToken}`)
      .then((res) => {
        setTableInfo(res.data.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Mesa no encontrada o QR inválido');
        setLoading(false);
      });
  }, [tableToken]);

  // Render Google Sign-In button once we have the table info and GSI loaded
  useEffect(() => {
    if (!tableInfo || step !== 'choose' || !GOOGLE_CLIENT_ID) return;

    const initGSI = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 280,
        text: 'signin_with',
        locale: 'es',
      });
    };

    if (window.google) {
      initGSI();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initGSI();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableInfo, step]);

  const handleGoogleCredential = async (response: { credential: string }) => {
    if (!tableInfo) return;
    setGoogleLoading(true);
    try {
      const res = await api.post('/auth/customer/google', {
        credential: response.credential,
        restaurantId: tableInfo.restaurant._id,
      });
      const { customer, token } = res.data.data;
      setGoogleCustomer({ id: customer.id, name: customer.name, email: customer.email, picture: customer.picture, token });
      // Immediately join with the Google name as alias
      await joinTable(customer.name, true);
    } catch {
      toast.error('Error al iniciar sesión con Google');
      setGoogleLoading(false);
    }
  };

  const joinTable = async (aliasOverride?: string, fromGoogle = false) => {
    if (!tableInfo || !tableToken) return;
    if (!fromGoogle) setJoining(true);

    try {
      const finalAlias = aliasOverride ?? (alias.trim() || undefined);
      if (finalAlias && !fromGoogle) setAlias(finalAlias);

      setSession({ sessionId, alias: finalAlias, tableToken, tableInfo });

      const res = await api.post('/orders/join-table', {
        tableToken,
        sessionId,
        alias: finalAlias,
      });

      setOrder(res.data.data.order);
      navigate(`/mesa/${tableToken}/menu`);
    } catch {
      toast.error('Error al unirse a la mesa. Intenta de nuevo.');
    } finally {
      setJoining(false);
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center animate-pulse">
            <UtensilsCrossed size={28} className="text-primary-600" />
          </div>
          <p className="text-slate-500 text-sm">Cargando mesa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container items-center justify-center p-8" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Mesa no encontrada</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <p className="text-slate-400 text-xs mt-4">Escanea el QR nuevamente o pide ayuda al personal</p>
        </div>
      </div>
    );
  }

  const restaurant = tableInfo?.restaurant;

  return (
    <div
      className="app-container"
      style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 50%, #E0E7FF 100%)' }}
    >
      <div className="flex flex-col items-center px-6 pt-14 pb-8 flex-1">
        {/* Brand */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-200 mb-4">
            <UtensilsCrossed size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{restaurant?.name}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              <span>{tableInfo?.zone || 'Mesa'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
              <span className="font-semibold text-primary-700 text-base">{tableInfo?.name}</span>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ─── Step 1: Choose login method ─── */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="w-full max-w-xs"
            >
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="font-semibold text-slate-900 text-center mb-1">¿Cómo querés ingresar?</h2>
                <p className="text-xs text-slate-500 text-center mb-5">
                  Con Google guardamos tus datos para recordarte.
                </p>

                {/* Already signed in with Google */}
                {googleCustomer ? (
                  <div className="mb-4 p-3 rounded-xl bg-primary-50 border border-primary-100 flex items-center gap-3">
                    {googleCustomer.picture ? (
                      <img
                        src={googleCustomer.picture}
                        alt={googleCustomer.name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle2 size={36} className="text-primary-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{googleCustomer.name}</p>
                      <p className="text-xs text-slate-500 truncate">{googleCustomer.email}</p>
                    </div>
                  </div>
                ) : null}

                {/* Google Sign-In button (rendered by GSI) or already-logged-in continue */}
                {googleCustomer ? (
                  <button
                    onClick={() => joinTable(googleCustomer.name, true)}
                    disabled={googleLoading || joining}
                    className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-70 mb-3"
                  >
                    {googleLoading || joining ? 'Entrando...' : `Continuar como ${googleCustomer.name.split(' ')[0]}`}
                  </button>
                ) : (
                  <div className="mb-3">
                    {GOOGLE_CLIENT_ID ? (
                      <div
                        ref={googleBtnRef}
                        className="w-full flex justify-center"
                        style={{ minHeight: 44 }}
                      />
                    ) : (
                      <div className="w-full py-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Google OAuth no configurado
                      </div>
                    )}
                    {googleLoading && (
                      <p className="text-center text-xs text-slate-400 mt-2 animate-pulse">Verificando con Google...</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">o</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <button
                  onClick={() => setStep('guest-form')}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Users size={16} className="text-slate-400" />
                  Continuar como invitado
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Guest alias form ─── */}
          {step === 'guest-form' && (
            <motion.div
              key="guest"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-xs"
            >
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <button
                  onClick={() => setStep('choose')}
                  className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1"
                >
                  ← Volver
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <Users size={18} className="text-primary-600" />
                  <h2 className="font-semibold text-slate-900">¿Cómo te llamas?</h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Tus compañeros podrán ver qué pediste. Es opcional.
                </p>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinTable()}
                  placeholder="Ej: Carlos, Ana, Mesa 3..."
                  maxLength={30}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 mb-4"
                  autoFocus
                />
                <button
                  onClick={() => joinTable()}
                  disabled={joining}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-70 mb-3"
                >
                  {joining ? 'Entrando...' : 'Ver el menú 🍽️'}
                </button>
                <button
                  onClick={() => joinTable(undefined)}
                  disabled={joining}
                  className="w-full text-slate-400 py-2 text-sm hover:text-slate-600 transition-colors"
                >
                  Continuar sin nombre
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-slate-400 mt-8 text-center">
          Commy • Sistema de pedidos digital
        </p>
      </div>
    </div>
  );
};
