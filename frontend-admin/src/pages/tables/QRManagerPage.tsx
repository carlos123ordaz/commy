import React, { useEffect, useState } from 'react';
import { QrCode, Download, FileDown, RefreshCw, Check, Eye } from 'lucide-react';
import type { Table } from '../../types';
import { api } from '../../config/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TableStatusBadge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';

export const QRManagerPage: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewTable, setPreviewTable] = useState<(Table & { qrDataUrl?: string }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.data);
    } catch { toast.error('Error al cargar mesas'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTables(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === tables.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tables.map((t) => t._id)));
    }
  };

  const previewQR = async (table: Table) => {
    setPreviewLoading(true);
    setPreviewTable(table);
    try {
      const res = await api.get(`/tables/${table._id}/qr`);
      setPreviewTable({ ...table, qrDataUrl: res.data.data.qrDataUrl });
    } catch { toast.error('Error al generar QR'); }
    finally { setPreviewLoading(false); }
  };

  const regenerateQR = async (tableId: string) => {
    try {
      await api.post(`/tables/${tableId}/regenerate-qr`);
      toast.success('QR regenerado');
      fetchTables();
    } catch { toast.error('Error al regenerar QR'); }
  };

  const exportPDF = async (all = false) => {
    setExporting(true);
    try {
      let res;
      if (all) {
        res = await api.get('/tables/export-all-pdf', { responseType: 'blob' });
      } else {
        res = await api.post('/tables/export-pdf', { tableIds: [...selected] }, { responseType: 'blob' });
      }
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-codes-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch { toast.error('Error al exportar PDF'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Generador de QR</h1>
          <p className="text-slate-500 text-sm">Gestiona los códigos QR de cada mesa</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<FileDown size={16} />}
            disabled={selected.size === 0}
            loading={exporting}
            onClick={() => exportPDF(false)}
          >
            Exportar selección ({selected.size})
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={16} />}
            loading={exporting}
            onClick={() => exportPDF(true)}
          >
            Exportar todos
          </Button>
        </div>
      </div>

      {/* Select all */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-5 py-3 shadow-sm">
        <input
          type="checkbox"
          checked={selected.size === tables.length && tables.length > 0}
          onChange={toggleAll}
          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        />
        <span className="text-sm text-slate-600">
          {selected.size === 0 ? 'Seleccionar todas las mesas' : `${selected.size} mesa${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}`}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => {
            const isSelected = selected.has(table._id);
            return (
              <div
                key={table._id}
                className={`bg-white rounded-xl border-2 transition-all shadow-sm ${
                  isSelected ? 'border-primary-400 bg-primary-50/30' : 'border-slate-100'
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleSelect(table._id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{table.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{table.qrUrl}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <TableStatusBadge status={table.status} />
                      {table.zone && <span className="text-xs text-slate-400">{table.zone}</span>}
                    </div>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => previewQR(table)}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                      title="Ver QR"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => regenerateQR(table._id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                      title="Regenerar QR"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Preview Modal */}
      <Modal
        isOpen={!!previewTable}
        onClose={() => setPreviewTable(null)}
        title={`QR - ${previewTable?.name}`}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 py-2">
          {previewLoading ? (
            <div className="w-48 h-48 skeleton rounded-xl" />
          ) : previewTable?.qrDataUrl ? (
            <img src={previewTable.qrDataUrl} alt="QR" className="w-48 h-48 rounded-xl border border-slate-100" />
          ) : (
            <div className="w-48 h-48 bg-slate-50 rounded-xl flex items-center justify-center">
              <QrCode size={48} className="text-slate-300" />
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold text-slate-900">{previewTable?.name}</p>
            {previewTable?.zone && <p className="text-sm text-slate-500">{previewTable.zone}</p>}
            <p className="text-xs text-slate-400 mt-1 font-mono break-all max-w-xs">{previewTable?.qrUrl}</p>
          </div>
          {previewTable?.qrDataUrl && (
            <a
              href={previewTable.qrDataUrl}
              download={`qr-${previewTable.name}.png`}
              className="btn-primary btn text-sm"
            >
              <Download size={14} />
              Descargar imagen
            </a>
          )}
        </div>
      </Modal>
    </div>
  );
};
