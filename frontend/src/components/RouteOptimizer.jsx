import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Truck,
  Navigation,
  DollarSign,
  Clock,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Layers,
  Info,
  RefreshCw,
  Compass,
  ArrowRight
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

export default function RouteOptimizer() {
  const [satellites, setSatellites] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('ACACIAS');
  const [selectedVehicle, setSelectedVehicle] = useState('CAMION_C2');
  const [cargoWeight, setCargoWeight] = useState(5000);
  const [isDemoData, setIsDemoData] = useState(false);

  const [loading, setLoading] = useState(false);
  const [routeResults, setRouteResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch initial satellites & vehicles
  useEffect(() => {
    fetchSatellites();
  }, []);

  const fetchSatellites = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/logistics/satellites`);
      if (res.ok) {
        const data = await res.json();
        setSatellites(data.satellites || []);
        setVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error('Error al cargar destinos satélite:', err);
    }
  };

  const handleCalculateRoutes = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/logistics/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: selectedDestination,
          cargo_weight_kg: Number(cargoWeight),
          vehicle_type: selectedVehicle,
          is_demo_data: isDemoData
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRouteResults(data);
      } else {
        setErrorMsg(data.detail || 'Error al calcular rutas.');
      }
    } catch (err) {
      setErrorMsg('Error de conexión con la API de optimización de rutas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (satellites.length > 0) {
      handleCalculateRoutes();
    }
  }, [satellites, isDemoData]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-800 border border-slate-700/80 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Rutas de Distribución — Tarea 5</h2>
                <p className="text-xs text-slate-400">
                  Cálculo y comparación de rutas óptimas desde el Almacén Central (Villavicencio) hacia satélites.
                </p>
              </div>
            </div>
          </div>

          {/* Real Data vs Demo Data Toggle */}
          <div className="flex items-center space-x-3 p-2 bg-slate-900/80 rounded-2xl border border-slate-700/80">
            <span className="text-xs font-bold text-slate-300 ml-2">Modo de Datos:</span>
            <button
              onClick={() => setIsDemoData(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                !isDemoData
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DATOS REALES
            </button>
            <button
              onClick={() => setIsDemoData(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                isDemoData
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DEMOSTRACIÓN
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Origin (Fixed Villavicencio) */}
        <div className="bg-slate-800 border border-slate-700/80 p-4 rounded-2xl shadow-lg space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            Origen (Almacén Central)
          </label>
          <div className="text-sm font-bold text-white bg-slate-900/60 p-2.5 rounded-xl border border-slate-700">
            Villavicencio (Meta)
          </div>
        </div>

        {/* Destination Satellite Selector */}
        <div className="bg-slate-800 border border-slate-700/80 p-4 rounded-2xl shadow-lg space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            Destino Satélite
          </label>
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="w-full text-sm font-bold text-white bg-slate-900/90 p-2.5 rounded-xl border border-slate-700 focus:border-blue-500 outline-none"
          >
            {satellites.map((sat) => (
              <option key={sat.id} value={sat.id}>
                {sat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle Selection */}
        <div className="bg-slate-800 border border-slate-700/80 p-4 rounded-2xl shadow-lg space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-indigo-400" />
            Perfil de Vehículo
          </label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full text-sm font-bold text-white bg-slate-900/90 p-2.5 rounded-xl border border-slate-700 focus:border-blue-500 outline-none"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cargo Weight & Action Button */}
        <div className="bg-slate-800 border border-slate-700/80 p-4 rounded-2xl shadow-lg space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Peso Carga (Kg)
            </label>
            <span className="text-xs font-bold text-blue-400">
              {(cargoWeight / 1000).toFixed(1)} Ton
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={cargoWeight}
              onChange={(e) => setCargoWeight(e.target.value)}
              className="w-full text-sm font-bold text-white bg-slate-900/90 p-2 rounded-xl border border-slate-700 focus:border-blue-500 outline-none"
              placeholder="5000"
            />
            <button
              onClick={handleCalculateRoutes}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Data Source Indicator Banner */}
      {routeResults && (
        <div
          className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            routeResults.is_demo_data
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                routeResults.is_demo_data ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span>FUENTE DE DATOS UTILIZADA: {routeResults.data_type}</span>
          </div>
          <span className="text-[11px] opacity-80">
            {routeResults.is_demo_data
              ? 'Escenario simulado de contingencias y obras'
              : 'Red vial nacional verificada Meta / Orinoquía 2026'}
          </span>
        </div>
      )}

      {/* Capacity Warning Banner */}
      {routeResults && routeResults.capacity_warning && (
        <div className="p-4 bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs font-semibold rounded-2xl flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <span>{routeResults.capacity_warning}</span>
        </div>
      )}

      {/* Comparative Alternatives Table */}
      {routeResults && routeResults.alternatives && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Tabla Comparativa de Rutas Alternativas
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {routeResults.alternatives.length} Alternativas Calculadas
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {routeResults.alternatives.map((alt, idx) => (
              <div
                key={idx}
                className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4 hover:border-blue-500/40 transition-all"
              >
                {/* Alternative Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-white">{alt.label}</h4>
                      <p className="text-xs text-slate-400 font-medium">Estrategia: {alt.strategy}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alt.capacity_ok ? (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Capacidad OK
                      </span>
                    ) : (
                      <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Sobrecapacidad
                      </span>
                    )}

                    {alt.weight_restriction_ok ? (
                      <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-extrabold px-3 py-1 rounded-full">
                        Vía Habilitada
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-extrabold px-3 py-1 rounded-full">
                        Restricción de Peso
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Distancia Total</span>
                    <span className="text-base font-black text-white">{alt.total_distance_km} km</span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Tiempo Estimado</span>
                    <span className="text-base font-black text-indigo-400">{alt.formatted_time}</span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Costo Flete/Combustible</span>
                    <span className="text-base font-black text-slate-200">
                      ${alt.transport_cost_cop.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Peajes ({alt.tolls_count})</span>
                    <span className="text-base font-black text-amber-400">
                      ${alt.tolls_cost_cop.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="bg-blue-950/40 p-3 rounded-2xl border border-blue-500/30 col-span-2 md:col-span-1">
                    <span className="text-blue-300 block text-[10px] font-bold uppercase">Costo Total Logístico</span>
                    <span className="text-base font-black text-emerald-400">
                      ${alt.total_cost_cop.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

                {/* Legs Breakdown */}
                <div className="space-y-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[11px] font-extrabold text-slate-300 block">Tramos y Estado de la Vía:</span>
                  {alt.legs.map((leg, lIdx) => (
                    <div key={lIdx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 gap-1">
                      <div className="flex items-center space-x-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="font-bold text-white">{leg.via_name}</span>
                        <span className="text-slate-400">({leg.distance_km} km, {leg.time_hours} hrs)</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="text-slate-400">Estado: {leg.road_status}</span>
                        {leg.tolls_count > 0 && (
                          <span className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded-md font-semibold">
                            {leg.tolls_count} Peaje (${leg.tolls_cost_cop.toLocaleString('es-CO')})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Justification Box */}
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/80 space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-blue-400">
                    <Info className="w-4 h-4" />
                    <span>Justificación Técnica de Selección:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {alt.justification}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
