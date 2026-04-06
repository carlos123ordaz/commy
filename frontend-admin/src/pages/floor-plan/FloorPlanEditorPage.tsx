import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, Plus, Trash2, ArrowLeft, Loader2, AlertTriangle,
  Square, Circle, RectangleHorizontal, Pencil, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { TableNode } from '../../components/floor-plan/TableNode';
import { api } from '../../config/api';
import type {
  FloorPlanResponse, FloorDecoration, TableLayoutPosition, DecorationItemType, ZoneLayout,
} from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function getDefaultLayout(index: number, total: number): TableLayoutPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  return {
    x: 80 + (index % cols) * 170,
    y: 80 + Math.floor(index / cols) * 150,
    width: 120, height: 90, rotation: 0, shape: 'rounded',
  };
}

async function fetchFloorPlan(): Promise<FloorPlanResponse> {
  const res = await api.get('/floor-plan');
  return res.data.data;
}

// ─── constants ────────────────────────────────────────────────────────────────

const DECO_TYPES: { type: DecorationItemType; emoji: string; label: string; defaultW: number; defaultH: number }[] = [
  { type: 'bar',      emoji: '🍺', label: 'Barra',   defaultW: 160, defaultH: 50 },
  { type: 'entrance', emoji: '🚪', label: 'Entrada', defaultW: 80,  defaultH: 20 },
  { type: 'wall',     emoji: '🧱', label: 'Pared',   defaultW: 240, defaultH: 18 },
  { type: 'plant',    emoji: '🌿', label: 'Jardín',  defaultW: 80,  defaultH: 80 },
  { type: 'label',    emoji: '📍', label: 'Label',   defaultW: 100, defaultH: 40 },
];

// ─── wall tile ────────────────────────────────────────────────────────────────

function WallTile({ selected, width, height }: { selected: boolean; width: number; height: number }) {
  const s = Math.max(8, Math.min(16, Math.min(width, height) / 2));
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 3, cursor: 'move',
      backgroundImage: `repeating-linear-gradient(-45deg,#64748b 0px,#64748b ${s * 0.35}px,#334155 ${s * 0.35}px,#334155 ${s}px)`,
      border: `2px solid ${selected ? '#94a3b8' : '#475569'}`,
      boxShadow: selected ? '0 0 0 1px #94a3b8' : 'none',
    }} />
  );
}

// ─── canvas resize handles ────────────────────────────────────────────────────

interface CanvasResizeHandlesProps {
  onResizeW: (delta: number) => void;
  onResizeH: (delta: number) => void;
}

function CanvasResizeHandles({ onResizeW, onResizeH }: CanvasResizeHandlesProps) {
  function makeDragHandler(axis: 'w' | 'h') {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let last = axis === 'w' ? e.clientX : e.clientY;

      function onMove(ev: MouseEvent) {
        const cur = axis === 'w' ? ev.clientX : ev.clientY;
        const delta = cur - last;
        last = cur;
        if (axis === 'w') onResizeW(delta);
        else onResizeH(delta);
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = axis === 'w' ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    };
  }

  function makeCornerHandler() {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let lastX = e.clientX;
      let lastY = e.clientY;

      function onMove(ev: MouseEvent) {
        onResizeW(ev.clientX - lastX);
        onResizeH(ev.clientY - lastY);
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
    };
  }

  return (
    <>
      {/* Right edge */}
      <div
        onMouseDown={makeDragHandler('w')}
        style={{
          position: 'absolute', right: -5, top: '20%', bottom: '20%', width: 10,
          cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div style={{ width: 4, height: 40, background: '#475569', borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* Bottom edge */}
      <div
        onMouseDown={makeDragHandler('h')}
        style={{
          position: 'absolute', bottom: -5, left: '20%', right: '20%', height: 10,
          cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div style={{ height: 4, width: 40, background: '#475569', borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* Bottom-right corner */}
      <div
        onMouseDown={makeCornerHandler()}
        style={{
          position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
          cursor: 'nwse-resize', zIndex: 10,
          background: '#475569', borderRadius: 3, opacity: 0.8,
        }}
      />
    </>
  );
}

// ─── editor state ─────────────────────────────────────────────────────────────

interface EditorTable {
  tableId: string;
  name: string;
  zone?: string;
  capacity: number;
  layout: TableLayoutPosition;
}

// ─── main component ──────────────────────────────────────────────────────────

export function FloorPlanEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const floorQuery = useQuery({ queryKey: ['floor-plan'], queryFn: fetchFloorPlan, staleTime: 30_000 });

  // All tables (positions per table)
  const [tables, setTables] = useState<EditorTable[]>([]);
  // Per-zone layout configs
  const [zoneLayouts, setZoneLayouts] = useState<ZoneLayout[]>([]);
  // Active zone tab
  const [activeZone, setActiveZone] = useState<string>('');
  // Selected element id
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Zone rename state
  const [renamingZone, setRenamingZone] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── Init from server ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!floorQuery.data || initialized) return;
    const { tables: rawTables, layout } = floorQuery.data;
    const total = rawTables.length;

    setTables(rawTables.map((t, idx) => ({
      tableId: t._id,
      name: t.name,
      zone: t.zone,
      capacity: t.capacity,
      layout: t.layout ?? getDefaultLayout(idx, total),
    })));

    // Build zone layouts: merge server data with zones derived from tables
    const tableZones = [...new Set(rawTables.map((t) => t.zone).filter(Boolean) as string[])];
    const serverLayouts = layout?.zoneLayouts ?? [];

    const mergedLayouts: ZoneLayout[] = tableZones.map((z) => {
      const existing = serverLayouts.find((sl) => sl.zoneName === z);
      return existing ?? { zoneName: z, canvasWidth: 1000, canvasHeight: 700, decorations: [] };
    });

    // Add any layouts that have no tables yet (pure decoration zones)
    for (const sl of serverLayouts) {
      if (!mergedLayouts.find((ml) => ml.zoneName === sl.zoneName)) {
        mergedLayouts.push(sl);
      }
    }

    setZoneLayouts(mergedLayouts);
    setActiveZone(mergedLayouts[0]?.zoneName ?? '');
    setInitialized(true);
  }, [floorQuery.data, initialized]);

  // ── Current zone helpers ───────────────────────────────────────────────────

  const activeZoneLayout = useMemo(
    () => zoneLayouts.find((z) => z.zoneName === activeZone) ?? null,
    [zoneLayouts, activeZone]
  );

  const updateActiveZone = useCallback((patch: Partial<ZoneLayout>) => {
    setZoneLayouts((prev) => prev.map((z) => (z.zoneName === activeZone ? { ...z, ...patch } : z)));
  }, [activeZone]);

  // Tables visible on current zone
  const zoneTables = useMemo(
    () => tables.filter((t) => t.zone === activeZone),
    [tables, activeZone]
  );

  // ── Canvas resize ──────────────────────────────────────────────────────────

  const MIN_CANVAS = 300;

  const handleResizeW = useCallback((delta: number) => {
    setZoneLayouts((prev) => prev.map((z) =>
      z.zoneName === activeZone
        ? { ...z, canvasWidth: Math.max(MIN_CANVAS, z.canvasWidth + delta) }
        : z
    ));
  }, [activeZone]);

  const handleResizeH = useCallback((delta: number) => {
    setZoneLayouts((prev) => prev.map((z) =>
      z.zoneName === activeZone
        ? { ...z, canvasHeight: Math.max(MIN_CANVAS, z.canvasHeight + delta) }
        : z
    ));
  }, [activeZone]);

  // ── Table drag/resize ──────────────────────────────────────────────────────

  const updateTableLayout = useCallback((tableId: string, patch: Partial<TableLayoutPosition>) => {
    setTables((prev) => prev.map((t) =>
      t.tableId === tableId ? { ...t, layout: { ...t.layout, ...patch } } : t
    ));
  }, []);

  // ── Decoration management ──────────────────────────────────────────────────

  const addDecoration = useCallback((type: DecorationItemType, label: string) => {
    const dt = DECO_TYPES.find((d) => d.type === type)!;
    const newDeco: FloorDecoration = {
      id: genId(), type, label, x: 80, y: 80,
      width: dt.defaultW, height: dt.defaultH, color: '#475569', zIndex: 1,
    };
    updateActiveZone({ decorations: [...(activeZoneLayout?.decorations ?? []), newDeco] });
  }, [activeZoneLayout, updateActiveZone]);

  const updateDecoration = useCallback((id: string, patch: Partial<FloorDecoration>) => {
    setZoneLayouts((prev) => prev.map((z) =>
      z.zoneName === activeZone
        ? { ...z, decorations: z.decorations.map((d) => (d.id === id ? { ...d, ...patch } : d)) }
        : z
    ));
  }, [activeZone]);

  const deleteDecoration = useCallback((id: string) => {
    setZoneLayouts((prev) => prev.map((z) =>
      z.zoneName === activeZone
        ? { ...z, decorations: z.decorations.filter((d) => d.id !== id) }
        : z
    ));
    setSelectedId((s) => (s === id ? null : s));
  }, [activeZone]);

  // ── Zone management ────────────────────────────────────────────────────────

  const addZone = useCallback(() => {
    const name = `Zona ${zoneLayouts.length + 1}`;
    const newZone: ZoneLayout = { zoneName: name, canvasWidth: 1000, canvasHeight: 700, decorations: [] };
    setZoneLayouts((prev) => [...prev, newZone]);
    setActiveZone(name);
  }, [zoneLayouts.length]);

  const deleteZone = useCallback((zoneName: string) => {
    if (zoneLayouts.length <= 1) { toast.error('Debe haber al menos una zona'); return; }
    setZoneLayouts((prev) => {
      const next = prev.filter((z) => z.zoneName !== zoneName);
      if (activeZone === zoneName) setActiveZone(next[0]?.zoneName ?? '');
      return next;
    });
  }, [zoneLayouts.length, activeZone]);

  const commitRename = useCallback((oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) { setRenamingZone(null); return; }
    if (zoneLayouts.find((z) => z.zoneName === newName)) {
      toast.error('Ya existe una zona con ese nombre');
      return;
    }
    setZoneLayouts((prev) => prev.map((z) => (z.zoneName === oldName ? { ...z, zoneName: newName } : z)));
    if (activeZone === oldName) setActiveZone(newName);
    setRenamingZone(null);
  }, [renameValue, zoneLayouts, activeZone]);

  // ── Selected element ───────────────────────────────────────────────────────

  const selectedTable = useMemo(() => tables.find((t) => t.tableId === selectedId), [tables, selectedId]);
  const selectedDeco = useMemo(
    () => activeZoneLayout?.decorations.find((d) => d.id === selectedId),
    [activeZoneLayout, selectedId]
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tablePositions = tables.map((t) => ({ tableId: t.tableId, ...t.layout }));
      return api.put('/floor-plan', {
        tablePositions,
        layout: { background: 'default', zoneLayouts },
      });
    },
    onSuccess: () => {
      toast.success('Plano guardado');
      queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
    },
    onError: () => toast.error('Error al guardar'),
  });

  // ── Loading / error ────────────────────────────────────────────────────────

  if (floorQuery.isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 size={28} className="animate-spin mr-3" /> Cargando editor…
      </div>
    );
  }

  if (floorQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p>Error al cargar los datos.</p>
      </div>
    );
  }

  const cw = activeZoneLayout?.canvasWidth ?? 1000;
  const ch = activeZoneLayout?.canvasHeight ?? 700;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">
      {/* ── Top toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700/50 flex-wrap gap-y-2">
        <button
          onClick={() => navigate('/salon')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="w-px h-5 bg-slate-700" />

        {/* Zone tabs */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-lg">
          {zoneLayouts.map((z) => (
            <button
              key={z.zoneName}
              onClick={() => { setActiveZone(z.zoneName); setSelectedId(null); }}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                activeZone === z.zoneName
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              )}
            >
              {z.zoneName}
            </button>
          ))}
          <button
            onClick={addZone}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded-md text-xs transition-colors whitespace-nowrap"
          >
            <Plus size={12} /> Nueva zona
          </button>
        </div>

        <div className="w-px h-5 bg-slate-700 hidden md:block" />

        {/* Add decorations */}
        {DECO_TYPES.map((d) => (
          <button
            key={d.type}
            onClick={() => addDecoration(d.type, d.label)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            title={`Agregar ${d.label}`}
          >
            <span>{d.emoji}</span>
            <span className="hidden lg:inline">{d.label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Canvas size label */}
        {activeZoneLayout && (
          <span className="text-xs text-slate-600 hidden md:block font-mono">
            {cw} × {ch}
          </span>
        )}

        {/* Save */}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: zone manager */}
        <div className="w-48 flex-shrink-0 bg-slate-900/60 border-r border-slate-700/40 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zonas</span>
            <button onClick={addZone} className="p-1 rounded text-slate-500 hover:text-primary-400 hover:bg-slate-700 transition-colors" title="Nueva zona">
              <Plus size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {zoneLayouts.map((z) => (
              <div
                key={z.zoneName}
                className={cn(
                  'group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors',
                  activeZone === z.zoneName ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
                onClick={() => { setActiveZone(z.zoneName); setSelectedId(null); }}
              >
                {renamingZone === z.zoneName ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(z.zoneName); if (e.key === 'Escape') setRenamingZone(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-slate-800 border border-primary-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none min-w-0"
                    />
                    <button onClick={(e) => { e.stopPropagation(); commitRename(z.zoneName); }} className="text-emerald-400 hover:text-emerald-300 p-0.5"><Check size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setRenamingZone(null); }} className="text-slate-500 hover:text-white p-0.5"><X size={11} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-medium truncate">{z.zoneName}</span>
                    <span className="text-[10px] text-slate-600 mr-1">
                      {tables.filter((t) => t.zone === z.zoneName).length}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingZone(z.zoneName); setRenameValue(z.zoneName); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-white transition-opacity"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteZone(z.zoneName); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Zone stats */}
          {activeZoneLayout && (
            <div className="px-3 py-2 border-t border-slate-700/40 space-y-1">
              <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Canvas activo</p>
              <p className="text-xs text-slate-400 font-mono">{cw} × {ch} px</p>
              <p className="text-[10px] text-slate-600">{zoneTables.length} mesas · {activeZoneLayout.decorations.length} elementos</p>
            </div>
          )}
        </div>

        {/* Center: canvas */}
        <div className="flex-1 overflow-auto bg-slate-950 p-6">
          {activeZoneLayout ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {/* Canvas */}
              <div
                className="rounded-xl"
                style={{
                  width: cw, height: ch, position: 'relative',
                  background: 'radial-gradient(ellipse at 60% 40%,#1e293b 0%,#0f172a 100%)',
                  boxShadow: '0 0 0 1px rgba(148,163,184,0.08),0 24px 64px rgba(0,0,0,0.6)',
                }}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
              >
                {/* Grid */}
                <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.2 }} width={cw} height={ch}>
                  <defs>
                    <pattern id="edGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="0.8" fill="#475569" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#edGrid)" />
                </svg>

                {/* Decorations */}
                {activeZoneLayout.decorations.map((deco) => {
                  const dt = DECO_TYPES.find((d) => d.type === deco.type);
                  const isWall = deco.type === 'wall';
                  return (
                    <Rnd
                      key={deco.id}
                      position={{ x: deco.x, y: deco.y }}
                      size={{ width: deco.width, height: deco.height }}
                      onDragStop={(_e, d) => updateDecoration(deco.id, { x: d.x, y: d.y })}
                      onResizeStop={(_e, _dir, ref, _delta, pos) => {
                        updateDecoration(deco.id, {
                          x: pos.x, y: pos.y,
                          width: parseInt((ref as HTMLElement).style.width),
                          height: parseInt((ref as HTMLElement).style.height),
                        });
                      }}
                      dragGrid={[10, 10]}
                      resizeGrid={[10, 10]}
                      minWidth={isWall ? 20 : 40}
                      minHeight={isWall ? 10 : 40}
                      style={{ zIndex: 1 }}
                      onClick={() => setSelectedId(deco.id)}
                    >
                      {isWall ? (
                        <WallTile selected={selectedId === deco.id} width={deco.width} height={deco.height} />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          backgroundColor: '#33415522',
                          border: `1.5px solid ${selectedId === deco.id ? '#94a3b8' : '#33415566'}`,
                          borderRadius: 8, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', cursor: 'move', gap: 2,
                        }}>
                          <span style={{ fontSize: 22, lineHeight: 1 }}>{dt?.emoji}</span>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{deco.label ?? dt?.label}</span>
                        </div>
                      )}
                    </Rnd>
                  );
                })}

                {/* Tables */}
                {zoneTables.map((table) => (
                  <Rnd
                    key={table.tableId}
                    position={{ x: table.layout.x, y: table.layout.y }}
                    size={{ width: table.layout.width, height: table.layout.height }}
                    onDragStop={(_e, d) => { updateTableLayout(table.tableId, { x: d.x, y: d.y }); setSelectedId(table.tableId); }}
                    onResizeStop={(_e, _dir, ref, _delta, pos) => {
                      updateTableLayout(table.tableId, {
                        x: pos.x, y: pos.y,
                        width: parseInt((ref as HTMLElement).style.width),
                        height: parseInt((ref as HTMLElement).style.height),
                      });
                      setSelectedId(table.tableId);
                    }}
                    dragGrid={[10, 10]}
                    resizeGrid={[10, 10]}
                    minWidth={60} minHeight={60}
                    style={{ zIndex: 2 }}
                  >
                    <TableNode
                      name={table.name}
                      capacity={table.capacity}
                      shape={table.layout.shape}
                      status="free"
                      hasAlert={false}
                      selected={selectedId === table.tableId}
                      onClick={() => setSelectedId(table.tableId)}
                      editorMode
                    />
                  </Rnd>
                ))}

                {zoneTables.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-slate-700 text-sm">Sin mesas en esta zona</p>
                  </div>
                )}
              </div>

              {/* Canvas resize handles */}
              <CanvasResizeHandles onResizeW={handleResizeW} onResizeH={handleResizeH} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600">
              <p>Crea una zona para empezar</p>
            </div>
          )}
        </div>

        {/* Right: properties */}
        <div className="w-56 flex-shrink-0 bg-slate-900 border-l border-slate-700/50 overflow-y-auto p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Propiedades</p>

          {/* Table */}
          {selectedTable && (
            <div className="space-y-3">
              <p className="text-white font-semibold">{selectedTable.name}</p>
              <PropRow label="X" value={`${Math.round(selectedTable.layout.x)}px`} />
              <PropRow label="Y" value={`${Math.round(selectedTable.layout.y)}px`} />
              <PropRow label="Ancho" value={`${Math.round(selectedTable.layout.width)}px`} />
              <PropRow label="Alto" value={`${Math.round(selectedTable.layout.height)}px`} />
              <div>
                <p className="text-xs text-slate-400 mb-2">Forma</p>
                <div className="flex gap-2">
                  {(['rect', 'rounded', 'circle'] as const).map((s) => (
                    <ShapeBtn key={s} shape={s} active={selectedTable.layout.shape === s}
                      onClick={() => updateTableLayout(selectedTable.tableId, { shape: s })} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Decoration */}
          {selectedDeco && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {selectedDeco.type !== 'wall' && <span>{DECO_TYPES.find((d) => d.type === selectedDeco.type)?.emoji}</span>}
                <p className="text-white font-semibold">{DECO_TYPES.find((d) => d.type === selectedDeco.type)?.label}</p>
              </div>
              <PropRow label="Ancho" value={`${Math.round(selectedDeco.width)}px`} />
              <PropRow label="Alto"  value={`${Math.round(selectedDeco.height)}px`} />
              {selectedDeco.type !== 'wall' && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Texto</p>
                  <input
                    value={selectedDeco.label ?? ''}
                    onChange={(e) => updateDecoration(selectedDeco.id, { label: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}
              {selectedDeco.type === 'wall' && (
                <p className="text-xs text-slate-600 leading-relaxed">Arrastra los bordes para estirar la pared.</p>
              )}
              <button
                onClick={() => deleteDecoration(selectedDeco.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          )}

          {!selectedTable && !selectedDeco && (
            <div className="text-center py-6 text-slate-600 text-xs leading-relaxed">
              <p>Haz clic en una mesa</p>
              <p>o elemento para editar.</p>
            </div>
          )}

          <div className="mt-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700/40 text-xs text-slate-500 space-y-1.5">
            <p className="font-medium text-slate-400">Ayuda</p>
            <p>• Arrastra mesas y elementos</p>
            <p>• Estira las esquinas para redimensionar</p>
            <p>• Arrastra el borde del canvas ▶ ▼ para agrandarlo</p>
            <p>• Renombra zonas con ✏️</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-mono text-slate-200">{value}</span>
    </div>
  );
}

function ShapeBtn({ shape, active, onClick }: { shape: 'rect' | 'rounded' | 'circle'; active: boolean; onClick: () => void }) {
  const icons = { rect: <Square size={13} />, rounded: <RectangleHorizontal size={13} />, circle: <Circle size={13} /> };
  return (
    <button
      onClick={onClick}
      className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center transition-colors',
        active ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
    >
      {icons[shape]}
    </button>
  );
}
