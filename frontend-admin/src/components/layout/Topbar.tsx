import React, { useState, useEffect, useRef } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { api } from '../../config/api';
import type { Notification } from '../../types';
import { cn } from '../../utils/cn';

const SEEN_KEY = 'notif_seen_ids';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {/* ignore */}
}

interface TopbarProps {
  onMenuToggle: () => void;
  title?: string;
  notifPermission?: 'default' | 'granted' | 'denied';
  onRequestNotifPermission?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuToggle, title, notifPermission, onRequestNotifPermission }) => {
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocketStore();
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load persisted unresolved notifications on mount
  useEffect(() => {
    api.get<{ data: Notification[] }>('/notifications').then((res) => {
      const data = res.data.data ?? [];
      const seenIds = getSeenIds();
      const unseen = data.filter((n) => !seenIds.has(n._id));
      setNotifications(data.slice(0, 10));
      setNotifCount(unseen.length);
    }).catch(() => {/* ignore */});
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 9)]);
      setNotifCount((c) => c + 1);
    };
    const handleResolved = ({ notificationId }: { notificationId: string }) => {
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      // Remove from seen cache so it doesn't linger
      const seenIds = getSeenIds();
      seenIds.delete(notificationId);
      saveSeenIds([...seenIds]);
    };
    socket.on('notification:new', handleNew);
    socket.on('notification:resolved', handleResolved);
    return () => {
      socket.off('notification:new', handleNew);
      socket.off('notification:resolved', handleResolved);
    };
  }, [socket]);

  const typeLabel: Record<string, string> = {
    call_waiter: 'Llamada de mozo',
    request_bill: 'Solicitud de cuenta',
    assistance: 'Asistencia',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        {title && <h1 className="text-base font-semibold text-slate-900">{title}</h1>}
      </div>

      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>

        {/* Notifications */}
        <div className="relative" ref={popupRef}>
          <button
            onClick={() => {
              if (notifPermission === 'default' && onRequestNotifPermission) {
                onRequestNotifPermission();
                return;
              }
              const next = !notifOpen;
              setNotifOpen(next);
              if (next) {
                setNotifCount(0);
                saveSeenIds(notifications.map((n) => n._id));
              }
            }}
            title={notifPermission === 'default' ? 'Habilitar notificaciones' : notifPermission === 'denied' ? 'Notificaciones bloqueadas' : undefined}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Bell size={20} className={notifPermission === 'denied' ? 'text-slate-300' : undefined} />
            {notifCount > 0 && notifPermission === 'granted' && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse-ring">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
            {notifPermission === 'default' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-100 shadow-xl z-50">
              <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm">Notificaciones</p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">Sin notificaciones</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n._id} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {typeLabel[n.type] || n.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(n.table as { name: string })?.name || 'Mesa'} {n.alias && `• ${n.alias}`}
                          </p>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 text-xs font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-900 leading-none">{user?.username}</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
