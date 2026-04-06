import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, User, Clock, Truck, ShoppingBag, AlertCircle, UserCircle2, Users, ChevronRight } from 'lucide-react';
import { api } from '../config/api';
import { useSessionStore } from '../store/sessionStore';
import type { Restaurant } from '../types';
import { formatCurrency } from '../utils/cn';
import toast from 'react-hot-toast';
import { AddressPickerModal } from '../components/AddressPickerModal';

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

type ChannelType = 'delivery' | 'takeaway';
type Step = 'choose' | 'form';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const ChannelLandingPage: React.FC = () => {
  const { channelType, token } = useParams<{ channelType: ChannelType; token: string }>();
  const navigate = useNavigate();

  const { setChannelSession, googleCustomer, setGoogleCustomer, updateGoogleCustomerProfile } = useSessionStore();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [step, setStep] = useState<Step>('choose');
  const [isGuest, setIsGuest] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !channelType) return;
    api
      .get(`/restaurants/channel/${channelType}/${token}`)
      .then((res) => setRestaurant(res.data.data))
      .catch(() => setError('QR no válido o restaurante no disponible'))
      .finally(() => setLoading(false));
  }, [token, channelType]);

  // Render Google Sign-In button
  useEffect(() => {
    if (!restaurant || step !== 'choose' || googleCustomer || !GOOGLE_CLIENT_ID) return;

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
  }, [restaurant, step, googleCustomer]);

  const handleGoogleCredential = async (response: { credential: string }) => {
    if (!restaurant) return;
    setGoogleLoading(true);
    try {
      const res = await api.post('/auth/customer/google', {
        credential: response.credential,
        restaurantId: restaurant._id,
      });
      const { customer, token: customerToken } = res.data.data;
      setGoogleCustomer({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        picture: customer.picture,
        token: customerToken,
        phone: customer.phone,
        address: customer.address,
      });
      // Pre-fill form with saved data
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setIsGuest(false);
      setStep('form');
    } catch {
      toast.error('Error al iniciar sesión con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleContinueAsGoogle = () => {
    if (!googleCustomer) return;
    setName(googleCustomer.name || '');
    setPhone(googleCustomer.phone || '');
    setAddress(googleCustomer.address || '');
    setIsGuest(false);
    setStep('form');
  };

  const handleContinueAsGuest = () => {
    setName('');
    setPhone('');
    setAddress('');
    setIsGuest(true);
    setStep('form');
  };

  const isDelivery = channelType === 'delivery';
  const channelConfig = restaurant
    ? isDelivery
      ? restaurant.settings.delivery
      : restaurant.settings.takeaway
    : null;

  const canSubmit = name.trim().length > 0
    && (!isDelivery || (phone.trim().length > 0 && address.trim().length > 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !restaurant || !token || !channelType) return;
    setSubmitting(true);
    try {
      // If signed in with Google, save updated profile data if changed
      if (!isGuest && googleCustomer) {
        const phoneChanged = phone.trim() !== (googleCustomer.phone || '');
        const addressChanged = address.trim() !== (googleCustomer.address || '');
        if (phoneChanged || addressChanged) {
          try {
            await api.patch(
              '/customers/me',
              {
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
                ...(addressCoords ? { coordinates: addressCoords } : {}),
              },
              { headers: { Authorization: `Bearer ${googleCustomer.token}` } }
            );
            updateGoogleCustomerProfile({ phone: phone.trim(), address: address.trim() });
          } catch {
            // Non-blocking — continue even if profile save fails
          }
        }
      }

      const customerInfo = isDelivery
        ? { name: name.trim(), phone: phone.trim(), address: address.trim(), ...(addressCoords ? { coordinates: addressCoords } : {}) }
        : { name: name.trim() };

      setChannelSession({
        channelToken: token,
        channelType,
        channelRestaurantId: restaurant._id,
        customerInfo,
      });

      navigate(`/channel/${channelType}/${token}/menu`);
    } catch {
      toast.error('Error al iniciar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !restaurant || !channelConfig) {
    return (
      <div className="app-container items-center justify-center px-6" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">{error || 'Canal no disponible'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col min-h-screen max-w-md mx-auto"
      >
        {/* Header */}
        <div className="bg-white px-5 py-6 shadow-sm">
          <div className="flex items-center gap-4">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt={restaurant.name} className="w-14 h-14 rounded-2xl object-cover" />
            ) : (
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
                {isDelivery ? <Truck size={24} className="text-primary-600" /> : <ShoppingBag size={24} className="text-primary-600" />}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{restaurant.name}</h1>
              <p className="text-sm text-slate-500">
                {isDelivery ? '🛵 Pedido a domicilio' : '🥡 Para llevar'}
              </p>
            </div>
          </div>

          {/* Channel info */}
          <div className="mt-4 flex flex-wrap gap-2">
            {channelConfig.fee > 0 && (
              <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200 font-medium">
                +{formatCurrency(channelConfig.fee)} cargo adicional
              </span>
            )}
            {isDelivery && 'estimatedMinutes' in channelConfig && channelConfig.estimatedMinutes > 0 && (
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 font-medium flex items-center gap-1">
                <Clock size={11} />
                ~{(channelConfig as { estimatedMinutes: number }).estimatedMinutes} min
              </span>
            )}
          </div>

          {/* Delivery hours */}
          {isDelivery && 'hours' in channelConfig && (channelConfig as { hours: { dayOfWeek: number; openTime: string; closeTime: string }[] }).hours.length > 0 && (
            <div className="mt-3 bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Horario de delivery</p>
              <div className="space-y-1">
                {(channelConfig as { hours: { dayOfWeek: number; openTime: string; closeTime: string }[] }).hours.map((h) => (
                  <div key={h.dayOfWeek} className="flex justify-between text-xs text-slate-600">
                    <span className="font-medium">{DAY_NAMES[h.dayOfWeek]}</span>
                    <span>{h.openTime} – {h.closeTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose login method */}
            {step === 'choose' && (
              <motion.div
                key="choose"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <h2 className="font-semibold text-slate-900 text-center mb-1">¿Cómo querés continuar?</h2>
                <p className="text-xs text-slate-500 text-center mb-5">
                  Con Google recordamos tus datos para la próxima vez.
                </p>

                {/* Already signed in with Google */}
                {googleCustomer ? (
                  <>
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
                    <button
                      onClick={handleContinueAsGoogle}
                      className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors mb-3"
                    >
                      Continuar como {googleCustomer.name.split(' ')[0]}
                    </button>
                  </>
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
                  onClick={handleContinueAsGuest}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Users size={16} className="text-slate-400" />
                  Continuar como invitado
                </button>
              </motion.div>
            )}

            {/* Step 2: Data form */}
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
              >
                {/* Google user badge */}
                {!isGuest && googleCustomer && (
                  <div className="mb-4 p-3 rounded-xl bg-primary-50 border border-primary-100 flex items-center gap-3">
                    {googleCustomer.picture ? (
                      <img
                        src={googleCustomer.picture}
                        alt={googleCustomer.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle2 size={32} className="text-primary-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{googleCustomer.name}</p>
                      <p className="text-xs text-slate-500 truncate">{googleCustomer.email}</p>
                    </div>
                    <button
                      onClick={() => setStep('choose')}
                      className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isGuest && (
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2"
                    >
                      ← Volver
                    </button>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <User size={14} className="inline mr-1.5 text-slate-500" />
                      Tu nombre *
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="¿Cómo te llamas?"
                      required
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  {isDelivery && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          <Phone size={14} className="inline mr-1.5 text-slate-500" />
                          Teléfono *
                        </label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Tu número de contacto"
                          required
                          type="tel"
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          <MapPin size={14} className="inline mr-1.5 text-slate-500" />
                          Dirección de entrega *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAddressPicker(true)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm bg-white text-left flex items-center gap-2 hover:border-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <MapPin size={15} className={address ? 'text-primary-500' : 'text-slate-400'} />
                          <span className={`flex-1 truncate ${address ? 'text-slate-800' : 'text-slate-400'}`}>
                            {address || 'Seleccionar en el mapa...'}
                          </span>
                          <ChevronRight size={15} className="text-slate-400 shrink-0" />
                        </button>
                        {!isGuest && googleCustomer && (phone || address) && (
                          <p className="text-xs text-slate-400 mt-1.5">
                            Podés editar estos datos y se guardarán para la próxima vez.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {submitting ? 'Cargando...' : 'Ver menú →'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Address picker modal */}
      {showAddressPicker && (
        <AddressPickerModal
          initialAddress={address}
          onConfirm={(addr, coords) => {
            setAddress(addr);
            setAddressCoords(coords);
            setShowAddressPicker(false);
          }}
          onClose={() => setShowAddressPicker(false)}
        />
      )}
    </div>
  );
};
