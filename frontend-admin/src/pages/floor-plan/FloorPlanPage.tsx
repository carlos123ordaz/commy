import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Settings, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useFloorPlan } from '../../hooks/useFloorPlan';
import { TableNode } from '../../components/floor-plan/TableNode';
import { TableDetailPanel } from '../../components/floor-plan/TableDetailPanel';
import { FloorLegend } from '../../components/floor-plan/FloorLegend';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

// ─── Wall / decoration overlays ─────────────────────────────────────────────

const DECO_ICONS: Record<string, string> = { bar: '🍺', entrance: '🚪', label: '📍', plant: '🌿' };

function DecorationOverlay({ decorations }: {
  decorations: { id: string; type: string; x: number; y: number; width: number; height: number; label?: string; color?: string }[];
}) {
  return (
    <>
      {decorations.map((d) => {
        if (d.type === 'wall') {
          const s = Math.max(8, Math.min(16, Math.min(d.width, d.height) / 2));
          return (
            <div key={d.id} style={{
              position: 'absolute', left: d.x, top: d.y, width: d.width, height: d.height,
              backgroundImage: `repeating-linear-gradient(-45deg,#64748b 0px,#64748b ${s * 0.35}px,#334155 ${s * 0.35}px,#334155 ${s}px)`,
              border: '2px solid #475569', borderRadius: 3, pointerEvents: 'none',
            }} />
          );
        }
        return (
          <div key={d.id} style={{
            position: 'absolute', left: d.x, top: d.y, width: d.width, height: d.height,
            backgroundColor: (d.color ?? '#334155') + '33',
            border: `1px solid ${d.color ?? '#475569'}66`,
            borderRadius: 8, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{DECO_ICONS[d.type] ?? '📌'}</span>
            {d.label && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, userSelect: 'none' }}>{d.label}</span>}
          </div>
        );
      })}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FloorPlanPage() {
  const navigate = useNavigate();
  const { tables, layout, zoneNames, isLoading, isError, refetch } = useFloorPlan();

  // Active zone tab ('all' shows all tables, or a specific zone name)
  const [activeZone, setActiveZone] = useState<string>('');

  // Default to first zone once data loads
  useEffect(() => {
    if (zoneNames.length > 0 && !activeZone) {
      setActiveZone(zoneNames[0]);
    }
  }, [zoneNames, activeZone]);

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Current zone layout config
  const activeZoneLayout = useMemo(() => {
    if (activeZone === 'all' || !layout?.zoneLayouts) return null;
    return layout.zoneLayouts.find((z) => z.zoneName === activeZone) ?? null;
  }, [activeZone, layout]);

  const canvasW = activeZoneLayout?.canvasWidth ?? 1200;
  const canvasH = activeZoneLayout?.canvasHeight ?? 800;
  const zoneDecorations = activeZoneLayout?.decorations ?? [];

  // Tables to display
  const displayedTables = useMemo(
    () => tables.filter((t) => t.zone === activeZone),
    [tables, activeZone]
  );

  const selectedTable = useMemo(() => tables.find((t) => t._id === selectedId) ?? null, [tables, selectedId]);

  // Stats for current view
  const viewStats = useMemo(() => {
    const free = displayedTables.filter((t) => t.liveStatus === 'free').length;
    const alerts = displayedTables.filter((t) => t.hasAlert).length;
    return { free, occupied: displayedTables.length - free, alerts, total: displayedTables.length };
  }, [displayedTables]);

  // ── Zoom / pan ────────────────────────────────────────────────────────────

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setZoom((prev) => {
      const next = clampZoom(prev * (e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP));
      const ratio = next / prev;
      setPan((p) => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-table-node]')) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    setPan((p) => ({ x: p.x + e.clientX - lastMouseRef.current.x, y: p.y + e.clientY - lastMouseRef.current.y }));
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const stopPan = useCallback((e: React.MouseEvent) => {
    isPanningRef.current = false;
    (e.currentTarget as HTMLElement).style.cursor = '';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const centerLayout = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const z = Math.min((clientWidth - 80) / canvasW, (clientHeight - 80) / canvasH, 1);
    setZoom(z);
    setPan({ x: (clientWidth - canvasW * z) / 2, y: (clientHeight - canvasH * z) / 2 });
  }, [canvasW, canvasH]);

  useEffect(() => {
    if (!isLoading) centerLayout();
  }, [isLoading, activeZone, centerLayout]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 size={28} className="animate-spin mr-3" /> Cargando plano…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p>Error al cargar el plano.</p>
        <button onClick={refetch} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">
      {/* ── Zone tabs + toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700/50 overflow-x-auto">
        {/* Zone tabs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {zoneNames.map((z) => (
            <ZoneTab key={z} active={activeZone === z} onClick={() => setActiveZone(z)}>
              {z}
            </ZoneTab>
          ))}
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 flex-shrink-0">
          <IconBtn title="Alejar" onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}><ZoomOut size={14} /></IconBtn>
          <span className="text-xs text-slate-400 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <IconBtn title="Acercar" onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}><ZoomIn size={14} /></IconBtn>
        </div>
        <IconBtn title="Centrar" onClick={centerLayout}><Maximize2 size={14} /></IconBtn>
        <IconBtn title="Actualizar" onClick={refetch}><RefreshCw size={14} /></IconBtn>
        <button
          onClick={() => navigate('/salon/editor')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
        >
          <Settings size={13} /> Editar plano
        </button>
      </div>

      {/* ── Canvas + detail panel ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden cursor-grab"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
            <div
              className="relative"
              style={{
                width: canvasW,
                height: canvasH,
                background: 'radial-gradient(ellipse at 60% 40%,#1e293b 0%,#0f172a 100%)',
                boxShadow: '0 0 0 1px rgba(148,163,184,0.08)',
                borderRadius: 12,
              }}
            >
              {/* Grid */}
              <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25 }} width={canvasW} height={canvasH}>
                <defs>
                  <pattern id="opDots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="#475569" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#opDots)" />
              </svg>

              {/* Zone decorations */}
              <DecorationOverlay decorations={zoneDecorations} />

              {/* Tables */}
              {displayedTables.map((table) => (
                <div
                  key={table._id}
                  data-table-node="true"
                  style={{
                    position: 'absolute',
                    left: table.layout.x,
                    top: table.layout.y,
                    width: table.layout.width,
                    height: table.layout.height,
                    transform: table.layout.rotation ? `rotate(${table.layout.rotation}deg)` : undefined,
                  }}
                >
                  <TableNode
                    name={table.name}
                    zone={undefined}
                    capacity={table.capacity}
                    shape={table.layout.shape}
                    status={table.liveStatus}
                    hasAlert={table.hasAlert}
                    alertType={table.alertType}
                    orderStatus={table.activeOrder?.status}
                    orderTotal={table.activeOrder?.total}
                    selected={selectedId === table._id}
                    onClick={() => setSelectedId(table._id === selectedId ? null : table._id)}
                  />
                </div>
              ))}

              {displayedTables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-slate-600 text-sm">Sin mesas en esta zona</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedTable && (
          <div className="w-72 flex-shrink-0">
            <TableDetailPanel table={selectedTable} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      <FloorLegend stats={viewStats} />
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function ZoneTab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
        active ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors">
      {children}
    </button>
  );
}
