import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Layers,
  Plus,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Download,
  Lock,
  Sparkles,
  Edit3,
  Cpu,
  Activity,
  Zap,
  Radio,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';

import WarehouseCanvas from './WarehouseCanvas';
import LiveLogTerminal from './LiveLogTerminal';
import { SoundEffects } from '../utils/soundEffects';

const API_BASE_URL = 'http://localhost:8000';

export default function SmartPicking({ masterReferences = [] }) {
  const [activeLayoutMode, setActiveLayoutMode] = useState('example');
  const [layoutData, setLayoutData] = useState(null);
  const [blockedAisles, setBlockedAisles] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Available inventory references
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

  // Optimization Result State
  const [pickingResult, setPickingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Custom Layout Builder State
  const [customLayoutName, setCustomLayoutName] = useState('Mi Almacén Personalizado 1');
  const [customAislesCount, setCustomAislesCount] = useState(4);
  const [customLocationsCount, setCustomLocationsCount] = useState(40);

  // Sound Toggle State
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Log Terminal State
  const [logs, setLogs] = useState([]);

  // AGV Simulation & Real-Time Telemetry State
  const [controlMode, setControlMode] = useState('auto'); // 'auto' | 'manual'
  const [agvState, setAgvState] = useState({
    x: 2,
    y: 0,
    status: 'IDLE', // 'IDLE' | 'MOVING' | 'STOPPED_PICKING' | 'COMPLETED' | 'MANUAL' | 'EMERGENCY_STOP'
    mode: 'auto',
    batteryPct: 100,
    speedMps: 1.2,
    currentWaypointIdx: 0,
    location: null
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const simulationTimerRef = useRef(null);

  // Helper for adding logs with timestamp
  const addLog = (message, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  // Fetch initial example layout
  useEffect(() => {
    fetchExampleLayout();
    addLog('Sistema WMS Logística 2026 inicializado. Carro AGV posicionado en Zona Inferior de Entrada (x:2, y:0).', 'INFO');
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
    setBlockedAisles((prev) => {
      const isBlocked = prev.includes(aisleName);
      const next = isBlocked ? prev.filter((a) => a !== aisleName) : [...prev, aisleName];
      addLog(`Pasillo ${aisleName} ${isBlocked ? 'desbloqueado' : 'bloqueado por mantenimiento/operador'}.`, isBlocked ? 'INFO' : 'WARN');
      return next;
    });
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
    addLog(`SKU '${selectedSku}' x${selectedQty} agregado a la lista de solicitud.`, 'ACTION');
  };

  const handleRemoveRequestItem = (skuToRemove) => {
    setRequestItems(requestItems.filter((item) => item.sku !== skuToRemove));
    addLog(`SKU '${skuToRemove}' eliminado de la solicitud.`, 'INFO');
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
        addLog(`Ruta de picking optimizada generada. Total ítems: ${data.total_items}. Ahorro estimado: ${data.distance_comparison.distance_saved_m}m.`, 'SUCCESS');
      } else {
        const msg = data.message || data.detail?.message || 'Error al generar la lista de despacho.';
        setErrorMsg(msg);
        addLog(`Error al generar ruta: ${msg}`, 'ERROR');
      }
    } catch (err) {
      setErrorMsg('Error de conexión con la API de picking inteligente.');
      addLog('Error de conexión con la API FastAPI de picking.', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  // Start Realtime AGV Automatic Route Animation Loop
  const handleStartRouteAnimation = () => {
    if (!pickingResult || !pickingResult.route_waypoints || pickingResult.route_waypoints.length === 0) {
      addLog('Genera primero una lista de despacho para iniciar la simulación animada.', 'WARN');
      return;
    }

    if (isSimulating) {
      // Stop current simulation
      if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
      setIsSimulating(false);
      setAgvState((prev) => ({ ...prev, status: 'IDLE' }));
      addLog('Simulación animada cancelada por el operador.', 'WARN');
      return;
    }

    const waypoints = pickingResult.route_waypoints;
    setIsSimulating(true);

    if (soundEnabled) SoundEffects.playStart();
    addLog('🚀 INICIO DE RUTA AUTOMÁTICA AGV. Vehículo partiendo de Zona Inferior de Despacho (x:2, y:0).', 'ACTION');

    let currentIdx = 0;

    const runWaypointStep = (idx) => {
      if (idx >= waypoints.length) {
        // Route Completed
        setAgvState((prev) => ({
          ...prev,
          x: 2,
          y: 0,
          status: 'COMPLETED',
          currentWaypointIdx: waypoints.length - 1
        }));
        setIsSimulating(false);
        if (soundEnabled) SoundEffects.playComplete();
        addLog('🏁 RUTA COMPLETADA EXITOSAMENTE. Vehículo AGV retornado a Zona Inferior de Despacho.', 'SUCCESS');
        return;
      }

      const wp = waypoints[idx];
      currentIdx = idx;

      // Update AGV Position & Moving state
      setAgvState((prev) => ({
        ...prev,
        x: wp.x,
        y: wp.y,
        status: wp.type === 'PICK' ? 'STOPPED_PICKING' : 'MOVING',
        currentWaypointIdx: idx,
        location: wp.location || null,
        batteryPct: Math.max(15, prev.batteryPct - 1)
      }));

      if (wp.type === 'START') {
        addLog(`Punto 0: Salida desde ${wp.zone}`, 'INFO');
        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), 1000);
      } else if (wp.type === 'PICK') {
        addLog(`🛑 PARADA #${wp.step}: Llegada a Ubicación #${wp.location} (${wp.aisle}, ${wp.rack}). ${wp.label}.`, 'ACTION');
        addLog(`⏱️ Estado Estático: Ejecutando tiempo de recogida en ${wp.color.toUpperCase()} (${wp.dwell_time_ms}ms)...`, 'INFO');

        // Play zone-specific sound effect
        if (soundEnabled) {
          if (wp.color === 'orange') SoundEffects.playArrivalOrange();
          else if (wp.color === 'red') SoundEffects.playArrivalRed();
          else if (wp.color === 'yellow') SoundEffects.playArrivalYellow();
          else SoundEffects.playArrivalStandard();
        }

        // Auto-check picked item in list table
        const matchingItemIdx = pickingResult.dispatch_list.findIndex((i) => String(i.location_number) === String(wp.location));
        if (matchingItemIdx >= 0) {
          const updatedList = [...pickingResult.dispatch_list];
          updatedList[matchingItemIdx].picked = true;
          setPickingResult((prev) => ({ ...prev, dispatch_list: updatedList }));
          addLog(`📦 Ítem SKU ${wp.sku} recolectado correctamente en Nivel ${wp.chosen_level}.`, 'SUCCESS');
        }

        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), wp.dwell_time_ms || 1200);
      } else if (wp.type === 'END') {
        addLog(`Retornando a Despacho Inferior...`, 'INFO');
        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), 1000);
      }
    };

    runWaypointStep(0);
  };

  // Manual Control Handler (D-Pad Navigation)
  const handleManualMove = (dx, dy, dirName) => {
    if (controlMode !== 'manual') return;

    const newX = Math.max(0, Math.min(14, agvState.x + dx));
    const newY = Math.max(0, Math.min(15, agvState.y + dy));

    setAgvState((prev) => ({
      ...prev,
      x: newX,
      y: newY,
      status: 'MANUAL',
      batteryPct: Math.max(10, prev.batteryPct - 1)
    }));

    if (soundEnabled) SoundEffects.playManualStep();
    addLog(`Control Manual AGV: Movimiento ${dirName} a posición (x:${newX}, y:${newY}).`, 'MANUAL');
  };

  // Manual Pick Action
  const handleManualPickAction = () => {
    if (soundEnabled) SoundEffects.playArrivalYellow();
    addLog(`Recogida manual ejecutada en posición actual (x:${agvState.x}, y:${agvState.y}).`, 'SUCCESS');
  };

  // Emergency Stop Handler
  const handleEmergencyStop = () => {
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
    setIsSimulating(false);
    setAgvState((prev) => ({ ...prev, status: 'EMERGENCY_STOP' }));
    if (soundEnabled) SoundEffects.playAlert();
    addLog('🚨 PARADA DE EMERGENCIA ACTIVADA POR EL OPERADOR.', 'ERROR');
  };

  // Reset AGV Position
  const handleResetAGV = () => {
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
    setIsSimulating(false);
    setAgvState({
      x: 2,
      y: 0,
      status: 'IDLE',
      mode: controlMode,
      batteryPct: 100,
      speedMps: 1.2,
      currentWaypointIdx: 0,
      location: null
    });
    addLog('AGV reiniciado a posición por defecto: Zona Inferior (x:2, y:0). Batería 100%.', 'INFO');
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
        color: i % 5 === 0 ? 'orange' : (i % 7 === 0 ? 'red' : 'slate'),
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
        addLog(`Layout personalizado '${customLayoutName}' activado exitosamente.`, 'SUCCESS');
      }
    } catch (err) {
      console.error('Error al guardar layout personalizado:', err);
    } finally {
      setLoading(false);
    }
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
      addLog('Lista de despacho exportada a CSV.', 'ACTION');
    } catch (err) {
      console.error('Error al exportar CSV:', err);
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
            <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl border border-blue-400/30 shadow-lg">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Picking Inteligente & Vehículo AGV — WMS 2026</h2>
              <p className="text-xs text-slate-400">
                Simulación interactiva en tiempo real del vehículo autónomo (Arduino/AGV) con trazado dinámico y audio.
              </p>
            </div>
          </div>
        </div>

        {/* Layout Mode Selector */}
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

      {/* AGV SIMULATION DASHBOARD CONTROL BAR */}
      <div className="bg-slate-800 border border-slate-700 p-5 rounded-3xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-5">
        {/* Left Status & Telemetry Indicators */}
        <div className="flex flex-wrap items-center gap-4 text-xs w-full lg:w-auto">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-900 rounded-2xl border border-slate-700">
            <button
              onClick={() => {
                setControlMode('auto');
                setAgvState((prev) => ({ ...prev, mode: 'auto' }));
                addLog('Modo de Control cambiado a AUTOMÁTICO.', 'INFO');
              }}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                controlMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Modo Automático
            </button>
            <button
              onClick={() => {
                setControlMode('manual');
                setAgvState((prev) => ({ ...prev, mode: 'manual' }));
                addLog('Modo de Control cambiado a MANUAL (Controles D-Pad).', 'WARN');
              }}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                controlMode === 'manual'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Modo Manual
            </button>
          </div>

          {/* Real-time Telemetry Pills */}
          <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-2 rounded-2xl border border-slate-700">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400 font-bold">Estado:</span>
            <span className="font-black text-white">{agvState.status}</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-2 rounded-2xl border border-slate-700">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 font-bold">Batería:</span>
            <span className="font-black text-emerald-400">{agvState.batteryPct}%</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-2 rounded-2xl border border-slate-700">
            <span className="text-amber-400 font-black">📍</span>
            <span className="text-slate-400 font-bold">Posición:</span>
            <span className="font-black text-amber-300">({agvState.x}, {agvState.y})</span>
          </div>
        </div>

        {/* Right Action Control Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {controlMode === 'auto' ? (
            <button
              onClick={handleStartRouteAnimation}
              disabled={!pickingResult}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg disabled:opacity-40 ${
                isSimulating
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {isSimulating ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isSimulating ? 'Pausar / Detener Ruta' : 'Iniciar Ruta Animada'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-500/30">
                Usa el D-Pad abajo para mover el AGV
              </span>
            </div>
          )}

          <button
            onClick={handleEmergencyStop}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" /> Parada Emergencia
          </button>

          <button
            onClick={handleResetAGV}
            className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-600"
            title="Reiniciar AGV a Zona Inferior"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MANUAL CONTROL D-PAD (Only visible in Manual Mode) */}
      {controlMode === 'manual' && (
        <div className="bg-slate-800/90 border border-indigo-500/40 p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 animate-fadeIn">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> Control Manual Telemétrico (D-Pad AGV)
            </h4>
            <p className="text-xs text-slate-400">
              Controla manualmente el movimiento del vehículo en la cuadrícula de pasillos e interactúa con los racks.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Direct Directional D-Pad */}
            <div className="grid grid-cols-3 gap-1.5 w-36 h-36 bg-slate-900 p-2 rounded-2xl border border-slate-700">
              <div />
              <button
                onClick={() => handleManualMove(0, 1, 'NORTE ▲')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />

              <button
                onClick={() => handleManualMove(-3, 0, 'OESTE ◄')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleManualPickAction}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md"
              >
                PICK
              </button>
              <button
                onClick={() => handleManualMove(3, 0, 'ESTE ►')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              <div />
              <button
                onClick={() => handleManualMove(0, -1, 'SUR ▼')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <div />
            </div>
          </div>
        </div>
      )}

      {/* WAREHOUSE CANVAS GRAPHIC WITH ANIMATED AGV */}
      <WarehouseCanvas
        layoutData={layoutData}
        routeWaypoints={pickingResult?.route_waypoints || []}
        blockedAisles={blockedAisles}
        onToggleBlockAisle={handleToggleBlockAisle}
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
        agvPos={agvState}
        isSimulating={isSimulating}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      {/* LIVE LOG TERMINAL */}
      <LiveLogTerminal
        logs={logs}
        onClearLogs={() => setLogs([])}
        agvState={agvState}
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
                          onChange={() => {
                            const updated = [...pickingResult.dispatch_list];
                            updated[idx].picked = !updated[idx].picked;
                            setPickingResult({ ...pickingResult, dispatch_list: updated });
                          }}
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
