import React, { useState, useEffect } from 'react';
import {
  Boxes,
  RotateCcw,
  CheckCircle2,
  Lock,
  Calendar,
  Layers,
  AlertCircle,
  TrendingUp,
  BarChart2,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  Truck,
  Navigation,
  Compass
} from 'lucide-react';

import InventoryTable from './components/InventoryTable';
import CycleCountManager from './components/CycleCountManager';
import RouteOptimizer from './components/RouteOptimizer';
import SmartPicking from './components/SmartPicking';

const API_BASE_URL = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'cycle' | 'logistics'
  const [logisticsSubTab, setLogisticsSubTab] = useState('routes'); // 'routes' | 'picking'

  const [references, setReferences] = useState([]);
  const [stats, setStats] = useState({
    total_items: 0,
    completed_items: 0,
    blocked_items: 0,
    in_progress_items: 0,
    pending_items: 0,
    total_scheduled_counts: 0,
    max_total_counts: 0,
    completion_percentage: 0,
    current_week: 0,
    total_weeks: 52
  });
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Fetch initial inventory and schedule from backend
  const fetchInventoryAndSchedule = async () => {
    setLoading(true);
    try {
      const invRes = await fetch(`${API_BASE_URL}/api/inventory`);
      if (invRes.ok) {
        const data = await invRes.json();
        setReferences(data.references || []);
        if (data.stats) setStats(data.stats);
      }

      const schedRes = await fetch(`${API_BASE_URL}/api/cycle-count/schedule`);
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedule(schedData.schedule || {});
      }
    } catch (err) {
      console.error('Error al conectar con la API:', err);
      setMessage({ type: 'error', text: 'No se pudo conectar con el servidor backend Python.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryAndSchedule();
  }, []);

  // Upload Excel handler
  const handleUploadExcel = async (file) => {
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload-excel`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReferences(data.references || []);
        if (data.stats) setStats(data.stats);
        setMessage({ type: 'success', text: data.message });
        await fetchInventoryAndSchedule();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Error al procesar el archivo Excel.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al enviar el archivo Excel al servidor.' });
    } finally {
      setLoading(false);
    }
  };

  // Generate next week cycle count
  const handleGenerateWeek = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cycle-count/generate-week`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stats) setStats(data.stats);
        setMessage({ type: 'success', text: data.message });
        await fetchInventoryAndSchedule();
      } else {
        setMessage({ type: 'error', text: data.message || 'No se pudo generar la semana.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de comunicación con el backend.' });
    } finally {
      setLoading(false);
    }
  };

  // Simulate full 52 weeks
  const handleSimulateYear = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cycle-count/simulate-year`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stats) setStats(data.stats);
        setMessage({ type: 'success', text: 'Simulación completa de 52 semanas realizada exitosamente.' });
        await fetchInventoryAndSchedule();
      } else {
        setMessage({ type: 'error', text: 'Error durante la simulación anual.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al conectar con la API de simulación.' });
    } finally {
      setLoading(false);
    }
  };

  // Reset cycle counting history
  const handleReset = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cycle-count/reset`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stats) setStats(data.stats);
        setMessage({ type: 'info', text: 'Conteo cíclico reiniciado a la semana 0.' });
        await fetchInventoryAndSchedule();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al reiniciar el sistema.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Header Banner */}
      <header className="bg-slate-800/90 border-b border-slate-700/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <Boxes className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-white tracking-tight">WMS LOGÍSTICA 2026</h1>
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
                  Sistema Integral WMS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Hackatón Logística 2026 — Inventario, Conteo Cíclico & Optimización Logística
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center p-1.5 bg-slate-900/90 rounded-2xl border border-slate-700/80 gap-1">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Maestro de Inventario ({references.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('cycle')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'cycle'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Conteo Cíclico</span>
            </button>

            <button
              onClick={() => setActiveTab('logistics')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'logistics'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4 text-indigo-300" />
              <span>Optimización Logística</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner Alert Message */}
        {message && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg transition-all ${
              message.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : message.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Global KPI Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Total Referencias</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">{stats.total_items}</div>
            <p className="text-[11px] text-slate-400">Desde Excel Maestro</p>
          </div>

          <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Conteos Programados</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {stats.total_scheduled_counts} / {stats.max_total_counts}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${stats.completion_percentage}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Items Bloqueados</span>
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{stats.blocked_items}</div>
            <p className="text-[11px] text-slate-400">Alcanzaron exactamente 5/5</p>
          </div>

          <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Semana Actual</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-400">
              S{stats.current_week} <span className="text-xs font-normal text-slate-400">/ 52</span>
            </div>
            <p className="text-[11px] text-slate-400">Progreso anual</p>
          </div>
        </div>

        {/* LOGISTICS SUB-NAVIGATION IF LOGISTICS TAB ACTIVE */}
        {activeTab === 'logistics' && (
          <div className="flex items-center space-x-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 w-fit">
            <button
              onClick={() => setLogisticsSubTab('routes')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
                logisticsSubTab === 'routes'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Rutas de Distribución (Tarea 5)</span>
            </button>

            <button
              onClick={() => setLogisticsSubTab('picking')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
                logisticsSubTab === 'picking'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Picking Inteligente (Tarea 6)</span>
            </button>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'inventory' ? (
          <InventoryTable
            references={references}
            stats={stats}
            onUploadExcel={handleUploadExcel}
            loading={loading}
          />
        ) : activeTab === 'cycle' ? (
          <CycleCountManager
            schedule={schedule}
            stats={stats}
            currentWeek={stats.current_week}
            onGenerateWeek={handleGenerateWeek}
            onSimulateYear={handleSimulateYear}
            onReset={handleReset}
            loading={loading}
          />
        ) : logisticsSubTab === 'routes' ? (
          <RouteOptimizer />
        ) : (
          <SmartPicking masterReferences={references} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-12 text-center text-xs text-slate-500">
        <p>Hackatón Logística 2026 — Núcleo de Software WMS para Conteo Cíclico & Optimización Logística con Python FastAPI & React JSX</p>
      </footer>
    </div>
  );
}
