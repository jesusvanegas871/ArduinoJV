import React, { useState, useMemo } from 'react';
import { Search, Filter, Lock, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldAlert, ArrowUpDown } from 'lucide-react';

export default function InventoryTable({ references, stats, onUploadExcel, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('sku');
  const [sortDirection, setSortDirection] = useState('asc');

  // Handle file drop / upload
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUploadExcel(e.target.files[0]);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredReferences = useMemo(() => {
    return references.filter((item) => {
      const matchesSearch =
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === 'ALL' || item.category === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === 'BLOCKED') {
        matchesStatus = item.is_blocked || item.counts_completed === 5;
      } else if (statusFilter === 'IN_PROGRESS') {
        matchesStatus = item.counts_completed > 0 && item.counts_completed < 5;
      } else if (statusFilter === 'PENDING') {
        matchesStatus = item.counts_completed === 0;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [references, searchTerm, categoryFilter, statusFilter, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      {/* Upload & Filters Toolbar */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción o ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Clase ABC:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-800">Todas</option>
              <option value="A" className="bg-slate-800">Clase A</option>
              <option value="B" className="bg-slate-800">Clase B</option>
              <option value="C" className="bg-slate-800">Clase C</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-xs text-slate-400 font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-800">Todos</option>
              <option value="PENDING" className="bg-slate-800">Pendiente (0/5)</option>
              <option value="IN_PROGRESS" className="bg-slate-800">En Conteo (1-4/5)</option>
              <option value="BLOCKED" className="bg-slate-800">Bloqueado (5/5)</option>
            </select>
          </div>

          {/* Excel Upload Button */}
          <label className="relative inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-95 border border-blue-400/30">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span>Cargar Excel Maestro</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {/* Main Reference Table */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-400 text-xs font-semibold tracking-wider uppercase select-none">
                <th onClick={() => handleSort('sku')} className="py-4 px-6 cursor-pointer hover:text-slate-200 transition-colors">
                  <div className="flex items-center space-x-1">
                    <span>SKU / Referencia</span>
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                  </div>
                </th>
                <th onClick={() => handleSort('description')} className="py-4 px-6 cursor-pointer hover:text-slate-200 transition-colors">
                  <div className="flex items-center space-x-1">
                    <span>Descripción</span>
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                  </div>
                </th>
                <th onClick={() => handleSort('category')} className="py-4 px-6 cursor-pointer hover:text-slate-200 transition-colors text-center">
                  <span>Clase ABC</span>
                </th>
                <th onClick={() => handleSort('location')} className="py-4 px-6 cursor-pointer hover:text-slate-200 transition-colors">
                  <span>Ubicación</span>
                </th>
                <th onClick={() => handleSort('stock')} className="py-4 px-6 cursor-pointer hover:text-slate-200 transition-colors text-right">
                  <span>Stock Actual</span>
                </th>
                <th className="py-4 px-6 text-center">Progreso Cíclico</th>
                <th className="py-4 px-6 text-center">Estado de Bloqueo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-sm">
              {filteredReferences.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ShieldAlert className="w-10 h-10 text-slate-500 stroke-1" />
                      <p className="font-medium text-slate-300">No se encontraron referencias para el filtro aplicado.</p>
                      <p className="text-xs text-slate-500">Prueba con otro término de búsqueda o limpia los filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReferences.map((item) => {
                  const isBlocked = item.is_blocked || item.counts_completed === 5;
                  const countPercentage = (item.counts_completed / 5) * 100;

                  return (
                    <tr
                      key={item.sku}
                      className={`hover:bg-slate-750/50 transition-colors ${
                        isBlocked ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-semibold text-blue-400">
                        {item.sku}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-200 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            item.category === 'A'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : item.category === 'B'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                          }`}
                        >
                          Clase {item.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-300 font-mono text-xs">
                        {item.location}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-200">
                        {item.stock.toLocaleString()} unidades
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center space-y-1.5 w-32 mx-auto">
                          <div className="flex justify-between w-full text-xs">
                            <span className="text-slate-400 font-medium">Conteos:</span>
                            <span className="font-bold font-mono text-slate-200">
                              {item.counts_completed}/5
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isBlocked
                                  ? 'bg-amber-500'
                                  : item.counts_completed > 0
                                  ? 'bg-blue-500'
                                  : 'bg-slate-700'
                              }`}
                              style={{ width: `${countPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isBlocked ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-inner">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Bloqueado (Max 5)</span>
                          </span>
                        ) : item.counts_completed > 0 ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                            <span>Activo ({5 - item.counts_completed} restantes)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-700/40 text-slate-400 border border-slate-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Pendiente</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-900/60 px-6 py-3 border-t border-slate-700/80 flex justify-between items-center text-xs text-slate-400">
          <span>Mostrando {filteredReferences.length} de {references.length} referencias</span>
          <span>SISTEMA DE GESTIÓN DE ALMACÉN (WMS) v1.0</span>
        </div>
      </div>
    </div>
  );
}
