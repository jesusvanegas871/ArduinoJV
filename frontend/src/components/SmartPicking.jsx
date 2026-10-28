import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Download,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
  Edit3
} from 'lucide-react';

import WarehouseCanvas from './WarehouseCanvas';

const API_BASE_URL = 'http://localhost:8000';

export default function SmartPicking({ masterReferences = [] }) {
  const [activeLayoutMode, setActiveLayoutMode] = useState('example'); // 'example' | 'custom'
  const [layoutData, setLayoutData] = useState(null);
  const [blockedAisles, setBlockedAisles] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Fallback references if masterReferences is empty
  const availableReferences = masterReferences.length > 0 ? masterReferences : [
    { sku: '200040', description: 'Slot nut IPM-VN-05-12/M5-ST', stock: 100 },
    { sku: '300026', description: 'Solenoid coil MSFG-24/42-50/60', stock: 150 },
    { sku: '300027', description: 'Solenoid coil MSFW-110-50/60', stock: 200 }
  ];

  // Pick List Request State
  const [requestItems, setRequestItems] = useState([
    { sku: availableReferences[0]?.sku || '200040', quantity: 2 },
    { sku: availableReferences[1]?.sku || '300026', quantity: 5 }
  ]);
  const [selectedSku, setSelectedSku] = useState(availableReferences[0]?.sku || '');
  const [selectedQty, setSelectedQty] = useState(1);

  // Pick Optimization Result State
  const [pickingResult, setPickingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Custom Layout Builder State
  const [customLayoutName, setCustomLayoutName] = useState('Mi Almacén Personalizado 1');
  const [customAislesCount, setCustomAislesCount] = useState(4);
  const [customLocationsCount, setCustomLocationsCount] = useState(40);

  // Fetch Example Layout on initial load
  useEffect(() => {
    fetchExampleLayout();
  }, []);

  useEffect(() => {
    if (availableReferences.length > 0 && !selectedSku) {
      setSelectedSku(availableReferences[0].sku);
    }
  }, [availableReferences]);

  const fetchExampleLayout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/picking/example-layout`);
      if (res.ok) {
        const data = await res.json();
        setLayoutData(data);
      }
    } catch (err) {
      console.error('Error al cargar layout de ejemplo:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Aisle Block
  const handleToggleBlockAisle = (aisleName) => {
    setBlockedAisles((prev) =>
      prev.includes(aisleName)
        ? prev.filter((a) => a !== aisleName)
        : [...prev, aisleName]
    );
  };

  // Add SKU to request items
  const handleAddSkuToRequest = () => {
    if (!selectedSku) return;
    const existingIdx = requestItems.findIndex((item) => item.sku === selectedSku);
    if (existingIdx >= 0) {
      const updated = [...requestItems];
      updated[existingIdx].quantity += Number(selectedQty);
      setRequestItems(updated);
    } else {
      setRequestItems([...requestItems, { sku: selectedSku, quantity: Number(selectedQty) }]);
    }
  };

  const handleRemoveRequestItem = (skuToRemove) => {
    setRequestItems(requestItems.filter((item) => item.sku !== skuToRemove));
  };

  // Run Pick Optimization
  const handleGeneratePicking = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/picking/optimize-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_items: requestItems,
          layout_id: activeLayoutMode === 'example' ? 'EXAMPLE_HACKATHON_2026' : 'CUSTOM_LAYOUT',
          blocked_aisles: blockedAisles
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPickingResult(data);
      } else {
        setErrorMsg(data.message || data.detail?.message || 'Error al generar la lista de despacho.');
        if (data.errors) {
          setErrorMsg(data.errors.join(' | '));
        }
      }
    } catch (err) {
      setErrorMsg('Error de conexión con la API de picking inteligente.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Picked Checkbox
  const handleTogglePicked = (orderIdx) => {
    if (!pickingResult) return;
    const updatedList = [...pickingResult.dispatch_list];
    updatedList[orderIdx].picked = !updatedList[orderIdx].picked;
    setPickingResult({ ...pickingResult, dispatch_list: updatedList });
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!pickingResult || !pickingResult.dispatch_list) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/picking/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_list: pickingResult.dispatch_list })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lista_de_despacho_ordenada.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    }
  };

  // Save Custom Layout
  const handleSaveCustomLayout = async () => {
    setLoading(true);
    const customLocations = {};
    for (let i = 1; i <= customLocationsCount; i++) {
      const aisleNum = ((i - 1) % customAislesCount) + 1;
      customLocations[String(i)] = {
        id: String(i),
        number: i,
        rack: `R${aisleNum}-Custom`,
        aisle: `Pasillo ${aisleNum}`,
        aisle_number: aisleNum,
        quadrant: `Cuadrante Custom ${(i % 2) + 1}`,
        color: i % 5 === 0 ? 'orange' : 'slate',
        levels: [1],
        description: 'Ubicación Personalizada',
        grid_x: aisleNum * 3,
        grid_y: i,
        assigned_skus: []
      };
    }

    const customPayload = {
      layout_id: `CUSTOM_${Date.now()}`,
      name: customLayoutName,
      is_custom: true,
      total_locations: customLocationsCount,
      aisles_count: customAislesCount,
      locations: customLocations
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/picking/custom-layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPayload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLayoutData(customPayload);
        setActiveLayoutMode('custom');
      }
    } catch (err) {
      console.error('Error al guardar layout personalizado:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = pickingResult?.dispatch_list?.length || 0;
  const pickedCount = pickingResult?.dispatch_list?.filter((i) => i.picked).length || 0;
  const progressPct = totalItems > 0 ? Math.round((pickedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800 border border-slate-700/80 p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Picking Inteligente — Tarea 6</h2>
              <p className="text-xs text-slate-400">
                Optimización de rutas de recolección en almacén y diseño personalizado de layout.
              </p>
            </div>
          </div>
        </div>

        {/* 2 MAIN BUTTONS */}
        <div className="flex items-center p-1.5 bg-slate-900/90 rounded-2xl border border-slate-700/80">
          <button
            onClick={() => {
              setActiveLayoutMode('example');
              fetchExampleLayout();
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeLayoutMode === 'example'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Layout de Ejemplo</span>
          </button>

          <button
            onClick={() => setActiveLayoutMode('custom')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeLayoutMode === 'custom'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4 text-indigo-300" />
            <span>Crear mi Layout</span>
          </button>
        </div>
      </div>

      {/* CUSTOM LAYOUT DESIGNER DRAWER */}
      {activeLayoutMode === 'custom' && (
        <div className="bg-slate-800 border border-indigo-500/30 p-6 rounded-3xl space-y-4 shadow-xl">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-400" /> Diseñador de Layout Personalizado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block font-bold mb-1">Nombre del Almacén</label>
              <input
                type="text"
                value={customLayoutName}
                onChange={(e) => setCustomLayoutName(e.target.value)}
                className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
              />
            </div>
            <div>
              <label className="text-slate-400 block font-bold mb-1">Cantidad de Pasillos</label>
              <input
                type="number"
                value={customAislesCount}
                onChange={(e) => setCustomAislesCount(e.target.value)}
                className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
              />
            </div>
            <div>
              <label className="text-slate-400 block font-bold mb-1">Total Ubicaciones</label>
              <input
                type="number"
                value={customLocationsCount}
                onChange={(e) => setCustomLocationsCount(e.target.value)}
                className="w-full bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-white font-bold"
              />
            </div>
          </div>
          <button
            onClick={handleSaveCustomLayout}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20"
          >
            Guardar y Aplicar Layout Personalizado
          </button>
        </div>
      )}

      {/* WAREHOUSE CANVAS GRAPHIC */}
      <WarehouseCanvas
        layoutData={layoutData}
        routeWaypoints={pickingResult?.route_waypoints || []}
        blockedAisles={blockedAisles}
        onToggleBlockAisle={handleToggleBlockAisle}
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
      />

      {/* PICKING REQUEST BUILDER PANEL */}
      <div className="bg-slate-800/90 border border-slate-700/80 p-6 rounded-3xl shadow-xl space-y-4">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-blue-400" />
          Generador de Solicitud de Picking
        </h3>

        {/* Input Selector Row with Fixed Styling */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Seleccionar SKU de Inventario Maestro ({availableReferences.length} disponibles)
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full text-xs font-bold text-white bg-slate-900 p-3 rounded-xl border border-slate-700 focus:border-blue-500 outline-none cursor-pointer"
            >
              {availableReferences.map((ref) => (
                <option key={ref.sku} value={ref.sku} className="bg-slate-900 text-white py-2">
                  {ref.sku} — {ref.description} (Stock: {ref.stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Cantidad a Recoger
            </label>
            <input
              type="number"
              min="1"
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
              className="w-full text-xs font-bold text-white bg-slate-900 p-2.5 rounded-xl border border-slate-700 outline-none"
            />
          </div>

          <button
            onClick={handleAddSkuToRequest}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-slate-600"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            Agregar a la Lista
          </button>
        </div>

        {/* Current Pick List Queue */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Items en Solicitud ({requestItems.length}):
            </span>
            <button
              onClick={handleGeneratePicking}
              disabled={loading || requestItems.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              Generar Lista de Despacho Ordenada
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {requestItems.map((item, idx) => (
              <span
                key={idx}
                className="bg-slate-800 text-slate-200 border border-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-2"
              >
                <span>{item.sku}</span>
                <span className="bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded text-[10px]">
                  x{item.quantity}
                </span>
                <button
                  onClick={() => handleRemoveRequestItem(item.sku)}
                  className="text-slate-400 hover:text-rose-400 ml-1 font-black"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message Display */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* OPTIMIZED PICKING RESULTS */}
      {pickingResult && pickingResult.dispatch_list && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700/80 p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Comparativa de Recorrido de Picking
                </h3>
                <p className="text-xs text-slate-400">
                  Comparación entre el recorrido secuencial original y la ruta optimizada por S-Shape.
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Download className="w-4 h-4" />
                Exportar Lista CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Recorrido Original</span>
                <span className="text-2xl font-black text-slate-300">
                  {pickingResult.distance_comparison.original_sequence_distance_m} metros
                </span>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-2xl border border-blue-500/40">
                <span className="text-blue-400 block text-[10px] font-bold uppercase">Recorrido Optimizado</span>
                <span className="text-2xl font-black text-emerald-400">
                  {pickingResult.distance_comparison.optimized_sequence_distance_m} metros
                </span>
              </div>

              <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40">
                <span className="text-emerald-300 block text-[10px] font-bold uppercase">Distancia Ahorrada</span>
                <span className="text-2xl font-black text-white">
                  {pickingResult.distance_comparison.distance_saved_m} metros
                </span>
              </div>
            </div>
          </div>

          {/* Ordered Dispatch List Table */}
          <div className="bg-slate-800 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">Lista de Despacho Ordenada</h3>
                <p className="text-xs text-slate-400">
                  Progreso de recolección: {pickedCount} de {totalItems} ítems recogidos ({progressPct}%)
                </p>
              </div>

              <div className="w-48 bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-extrabold text-[10px] border-b border-slate-700">
                  <tr>
                    <th className="p-3">Recogido</th>
                    <th className="p-3">Orden</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Cantidad</th>
                    <th className="p-3">Ubicación</th>
                    <th className="p-3">Pasillo</th>
                    <th className="p-3">Rack</th>
                    <th className="p-3">Nivel Recogida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-medium">
                  {pickingResult.dispatch_list.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-700/30 transition-all ${
                        item.picked ? 'opacity-50 bg-slate-900/40' : ''
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={item.picked || false}
                          onChange={() => handleTogglePicked(idx)}
                          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-black text-blue-400">#{item.pick_order}</td>
                      <td className="p-3 font-extrabold text-white">{item.sku}</td>
                      <td className="p-3 text-slate-300">{item.description}</td>
                      <td className="p-3 font-bold text-amber-300">x{item.quantity}</td>
                      <td className="p-3 font-extrabold text-white">Ubicación #{item.location_number}</td>
                      <td className="p-3">{item.aisle}</td>
                      <td className="p-3">{item.rack}</td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: item.color_hex || '#334155' }}
                        >
                          {item.level_display}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}