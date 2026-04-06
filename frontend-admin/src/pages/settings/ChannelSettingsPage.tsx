import React, { useEffect, useState } from 'react';
import { QrCode, Download, Plus, Trash2, Save, Truck, ShoppingBag, Clock, DollarSign } from 'lucide-react';
import type { Restaurant, DeliveryHour } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const ChannelSettingsPage: React.FC = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingQR, setGeneratingQR] = useState<'delivery' | 'takeaway' | null>(null);
  const [qrPreview, setQrPreview] = useState<{ channel: string; qrDataUrl: string; qrUrl: string } | null>(null);

  // Local editable state
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [deliveryMinutes, setDeliveryMinutes] = useState('30');
  const [deliveryHours, setDeliveryHours] = useState<DeliveryHour[]>([]);
  const [takeawayEnabled, setTakeawayEnabled] = useState(false);
  const [takeawayFee, setTakeawayFee] = useState('0');

  const fetchRestaurant = async () => {
    try {
      const res = await api.get('/restaurants/me/info');
      const r: Restaurant = res.data.data;
      setRestaurant(r);
      setDeliveryEnabled(r.settings.delivery?.enabled ?? false);
      setDeliveryFee(String(r.settings.delivery?.fee ?? 0));
      setDeliveryMinutes(String(r.settings.delivery?.estimatedMinutes ?? 30));
      setDeliveryHours(r.settings.delivery?.hours ?? []);
      setTakeawayEnabled(r.settings.takeaway?.enabled ?? false);
      setTakeawayFee(String(r.settings.takeaway?.fee ?? 0));
    } catch {
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurant(); }, []);

  const addHour = () => {
    setDeliveryHours((prev) => [
      ...prev,
      { dayOfWeek: 1, openTime: '09:00', closeTime: '22:00' },
    ]);
  };

  const updateHour = (index: number, field: keyof DeliveryHour, value: string | number) => {
    setDeliveryHours((prev) =>
      prev.map((h, i) => i === index ? { ...h, [field]: value } : h)
    );
  };

  const removeHour = (index: number) => {
    setDeliveryHours((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/restaurants/me/channels', {
        delivery: {
          enabled: deliveryEnabled,
          fee: parseFloat(deliveryFee) || 0,
          estimatedMinutes: parseInt(deliveryMinutes) || 30,
          hours: deliveryHours,
        },
        takeaway: {
          enabled: takeawayEnabled,
          fee: parseFloat(takeawayFee) || 0,
        },
      });
      toast.success('Configuración guardada');
      fetchRestaurant();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const generateQR = async (channel: 'delivery' | 'takeaway') => {
    setGeneratingQR(channel);
    try {
      const res = await api.post(`/restaurants/me/channels/${channel}/qr`);
      const { qrDataUrl, qrUrl } = res.data.data;
      setQrPreview({ channel, qrDataUrl, qrUrl });
      fetchRestaurant();
      toast.success('QR generado');
    } catch {
      toast.error('Error al generar QR');
    } finally {
      setGeneratingQR(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Canales de pedido</h1>
          <p className="text-slate-500 text-sm">Configura delivery y para llevar</p>
        </div>
        <Button variant="primary" size="sm" icon={<Save size={14} />} loading={saving} onClick={handleSave}>
          Guardar cambios
        </Button>
      </div>

      {/* Delivery */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Delivery</p>
              <p className="text-xs text-slate-500">Pedidos a domicilio</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className={cn('px-5 py-5 space-y-5 transition-opacity', !deliveryEnabled && 'opacity-40 pointer-events-none')}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <DollarSign size={13} className="text-slate-400" />
                Cargo adicional
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Tiempo estimado (min)
              </label>
              <Input
                type="number"
                min="0"
                value={deliveryMinutes}
                onChange={(e) => setDeliveryMinutes(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          {/* Hours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">Horarios de atención</p>
              <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={addHour}>
                Agregar
              </Button>
            </div>
            {deliveryHours.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                Sin horarios configurados — abierto todo el tiempo
              </p>
            ) : (
              <div className="space-y-2">
                {deliveryHours.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                    <select
                      value={h.dayOfWeek}
                      onChange={(e) => updateHour(i, 'dayOfWeek', parseInt(e.target.value))}
                      className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {DAY_NAMES.map((d, idx) => (
                        <option key={idx} value={idx}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={h.openTime}
                      onChange={(e) => updateHour(i, 'openTime', e.target.value)}
                      className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-slate-400 text-xs">–</span>
                    <input
                      type="time"
                      value={h.closeTime}
                      onChange={(e) => updateHour(i, 'closeTime', e.target.value)}
                      className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button onClick={() => removeHour(i)} className="p-1 text-slate-300 hover:text-red-400 ml-auto">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QR */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Código QR de Delivery</p>
            <div className="flex items-center gap-3">
              {restaurant?.settings.delivery?.qrToken ? (
                <>
                  <code className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-xl flex-1 truncate">
                    {restaurant.settings.delivery.qrUrl}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<QrCode size={14} />}
                    onClick={() => generateQR('delivery')}
                    loading={generatingQR === 'delivery'}
                  >
                    Ver / Nuevo
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<QrCode size={14} />}
                  onClick={() => generateQR('delivery')}
                  loading={generatingQR === 'delivery'}
                >
                  Generar QR
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Takeaway */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ShoppingBag size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Para Llevar</p>
              <p className="text-xs text-slate-500">Pedidos para recoger en local</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={takeawayEnabled}
              onChange={(e) => setTakeawayEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className={cn('px-5 py-5 space-y-5 transition-opacity', !takeawayEnabled && 'opacity-40 pointer-events-none')}>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <DollarSign size={13} className="text-slate-400" />
              Cargo adicional
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={takeawayFee}
              onChange={(e) => setTakeawayFee(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* QR */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Código QR de Para Llevar</p>
            <div className="flex items-center gap-3">
              {restaurant?.settings.takeaway?.qrToken ? (
                <>
                  <code className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-xl flex-1 truncate">
                    {restaurant.settings.takeaway.qrUrl}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<QrCode size={14} />}
                    onClick={() => generateQR('takeaway')}
                    loading={generatingQR === 'takeaway'}
                  >
                    Ver / Nuevo
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<QrCode size={14} />}
                  onClick={() => generateQR('takeaway')}
                  loading={generatingQR === 'takeaway'}
                >
                  Generar QR
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR preview modal */}
      <Modal
        isOpen={!!qrPreview}
        onClose={() => setQrPreview(null)}
        title={`QR ${qrPreview?.channel === 'delivery' ? 'Delivery' : 'Para Llevar'}`}
        size="sm"
      >
        {qrPreview && (
          <div className="flex flex-col items-center gap-4 py-2">
            <img
              src={qrPreview.qrDataUrl}
              alt="QR"
              className="w-48 h-48 rounded-xl border border-slate-100"
            />
            <p className="text-xs text-slate-400 text-center break-all max-w-xs font-mono">
              {qrPreview.qrUrl}
            </p>
            <a
              href={qrPreview.qrDataUrl}
              download={`qr-${qrPreview.channel}.png`}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium"
            >
              <Download size={14} />
              Descargar imagen
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
};
