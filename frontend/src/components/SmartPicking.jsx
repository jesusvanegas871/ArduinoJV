import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Plus,
  Play,
  Square,
  AlertTriangle,
  Sparkles,
  Edit3,
  Cpu,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Navigation,
  RefreshCw,
  Volume2,
  Radio,
  CheckCircle2,
  XCircle,
  Send,
  FastForward
} from 'lucide-react';

import WarehouseCanvas from './WarehouseCanvas';
import LiveLogTerminal from './LiveLogTerminal';
import { SoundEffects } from '../utils/soundEffects';

const API_BASE_URL = 'http://localhost:8000';

export default function SmartPicking() {
  const [activeLayoutMode, setActiveLayoutMode] = useState('example');
  const [layoutData, setLayoutData] = useState(null);
  const [blockedAisles, setBlockedAisles] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Pre-loaded Manual Rack List (No SKUs, only direct layout racks/coordinates)
  const [rackSequence, setRackSequence] = useState([4, 7, 21, 25, 41, 44, 49, 55, 60]);
  const [newLocationInput, setNewLocationInput] = useState(1);

  // Calculated Route Results
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Custom Layout Builder State
  const [customLayoutName, setCustomLayoutName] = useState('Mi Almacén Personalizado 1');
  const [customAislesCount, setCustomAislesCount] = useState(4);
  const [customLocationsCount, setCustomLocationsCount] = useState(40);

  // Sound Toggle State
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live Log Terminal State
  const [logs, setLogs] = useState([]);

  // AGV Simulation & Telemetry State
  const [controlMode, setControlMode] = useState('auto'); // 'auto' | 'manual'
  const [agvState, setAgvState] = useState({
    x: 0,
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

  // AGV Real Hardware Connection State (USB Serial Arduino)
  const [agvPorts, setAgvPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [agvHardwareStatus, setAgvHardwareStatus] = useState({
    connected: false,
    port: null,
    mode: 'IDLE',
    last_event: 'NINGUNO'
  });
  const [agvSpeed, setAgvSpeed] = useState(180);
  const [hardwareBusy, setHardwareBusy] = useState(false);
  const [hardwareMsg, setHardwareMsg] = useState(null);

  // Helper for adding logs with timestamp
  const addLog = (message, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  // Initial setup: Fetch layout, default route & serial ports
  useEffect(() => {
    fetchExampleLayout();
    fetchAgvPorts();
    fetchAgvHardwareStatus();
    addLog('Sistema WMS Logística 2026 inicializado. Carro AGV preparado en Zona Inferior de Entrada/Despacho (x:0, y:0).', 'INFO');
  }, []);

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

  // Hardware Serial API Calls
  const fetchAgvPorts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/ports`);
      if (res.ok) {
        const data = await res.json();
        setAgvPorts(data.ports || []);
        if (data.ports && data.ports.length > 0 && !selectedPort) {
          setSelectedPort(data.ports[0].port);
        }
      }
    } catch (err) {
      console.error('Error al consultar puertos serie:', err);
    }
  };

  const fetchAgvHardwareStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/status`);
      if (res.ok) {
        const data = await res.json();
        setAgvHardwareStatus(data.status || {});
      }
    } catch (err) {
      console.error('Error al consultar estado del AGV real:', err);
    }
  };

  const handleConnectAgv = async () => {
    if (!selectedPort) {
      setHardwareMsg('Por favor seleccione un puerto serie.');
      return;
    }
    setHardwareBusy(true);
    setHardwareMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: selectedPort, baudrate: 115200 })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHardwareMsg(data.message);
        addLog(`🔌 CONEXIÓN AGV REAL: ${data.message}`, 'SUCCESS');
        await fetchAgvHardwareStatus();
      } else {
        const err = data.detail || data.message || 'Error al conectar puerto serie.';
        setHardwareMsg(err);
        addLog(`Error de conexión serial: ${err}`, 'ERROR');
      }
    } catch (err) {
      setHardwareMsg('Error de conexión con el backend.');
    } finally {
      setHardwareBusy(false);
    }
  };

  const handleDisconnectAgv = async () => {
    setHardwareBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/disconnect`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setHardwareMsg(data.message);
        addLog('🔌 DESCONEXIÓN AGV REAL: Puerto serie cerrado.', 'WARN');
        await fetchAgvHardwareStatus();
      }
    } catch (err) {
      console.error('Error al desconectar AGV:', err);
    } finally {
      setHardwareBusy(false);
    }
  };

  const handleSendManualCommand = async (command) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, speed: agvSpeed })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog(`🎮 Comando Manual AGV Real: M:${command} (Velocidad: ${agvSpeed})`, 'ACTION');
        fetchAgvHardwareStatus();
      }
    } catch (err) {
      console.error('Error al enviar comando manual:', err);
    }
  };

  const handleBeepAgv = async (duration_ms = 300) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/beep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_ms })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) SoundEffects.playArrivalYellow();
        addLog(`🔊 Pitido activado en AGV Real (${duration_ms} ms).`, 'SUCCESS');
      }
    } catch (err) {
      console.error('Error al emitir pitido:', err);
    }
  };

  const handleSendRouteToAgv = async () => {
    if (!routeResult || !routeResult.route_waypoints || routeResult.route_waypoints.length === 0) {
      setHardwareMsg('No hay una ruta calculada para enviar.');
      return;
    }
    setHardwareBusy(true);
    setHardwareMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/route/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_waypoints: routeResult.route_waypoints })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHardwareMsg(data.message);
        addLog(`🚀 RUTA ENVIADA AL AGV REAL: Comandos [${data.commands.join(', ')}]`, 'ACTION');
        fetchAgvHardwareStatus();
      } else {
        const err = data.detail || data.message || 'Error al enviar ruta al AGV.';
        setHardwareMsg(err);
        addLog(`Error al enviar ruta al AGV Real: ${err}`, 'ERROR');
      }
    } catch (err) {
      setHardwareMsg('Error al comunicar con el backend.');
    } finally {
      setHardwareBusy(false);
    }
  };

  const handleContinueAgvRoute = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/route/continue`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog('▶️ Reanudando ruta en AGV Real (Comando CONTINUE sent).', 'ACTION');
        fetchAgvHardwareStatus();
      }
    } catch (err) {
      console.error('Error en CONTINUE:', err);
    }
  };

  const handleStopAgvRoute = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agv/route/stop`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog('🛑 Ruta detenida en AGV Real (Comando STOP sent).', 'WARN');
        fetchAgvHardwareStatus();
      }
    } catch (err) {
      console.error('Error en STOP:', err);
    }
  };

  // Keyboard Event Handlers for Manual Control (WASD / Arrow Keys)
  const isKeyPressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en un input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (!agvHardwareStatus.connected) return;
      if (isKeyPressedRef.current) return;

      let cmd = null;
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') cmd = 'F';
      else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') cmd = 'B';
      else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') cmd = 'L';
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') cmd = 'R';

      if (cmd) {
        isKeyPressedRef.current = true;
        handleSendManualCommand(cmd);
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (!agvHardwareStatus.connected) return;

      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
      if (keys.includes(e.key)) {
        isKeyPressedRef.current = false;
        handleSendManualCommand('S');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [agvHardwareStatus.connected, agvSpeed]);

  // Fetch or calculate route when rack sequence or blocked aisles change
  const handleCalculateRoute = async (sequenceToUse = rackSequence) => {
    if (!sequenceToUse || sequenceToUse.length === 0) {
      setRouteResult(null);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/picking/manual-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_numbers: sequenceToUse,
          layout_id: activeLayoutMode === 'example' ? 'EXAMPLE_HACKATHON_2026' : 'CUSTOM_LAYOUT',
          blocked_aisles: blockedAisles
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRouteResult(data);
        addLog(`Ruta de racks optimizada calculada. Total paradas: ${data.total_stops}. Recorrido total: ${data.distance_comparison.optimized_sequence_distance_m}m.`, 'SUCCESS');
      } else {
        const msg = data.message || data.detail?.errors?.join(' ') || data.detail?.message || data.errors?.join(' ') || 'Error al calcular la ruta manual.';
        setErrorMsg(msg);
        addLog(`Error al calcular ruta: ${msg}`, 'ERROR');
      }
    } catch (err) {
      setErrorMsg('Error de conexión con la API de rutas.');
      addLog('Error al conectar con la API FastAPI.', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCalculateRoute(rackSequence);
  }, [rackSequence, blockedAisles, activeLayoutMode]);

  // Toggle Aisle Block
  const handleToggleBlockAisle = (aisleName) => {
    setBlockedAisles((prev) => {
      const isBlocked = prev.includes(aisleName);
      const next = isBlocked ? prev.filter((a) => a !== aisleName) : [...prev, aisleName];
      addLog(`Pasillo ${aisleName} ${isBlocked ? 'desbloqueado' : 'bloqueado por mantenimiento/operador'}.`, isBlocked ? 'INFO' : 'WARN');
      return next;
    });
  };

  // Editing methods for Manual Control Panel
  const handleAddLocationToSequence = () => {
    const locNum = Number(newLocationInput);
    if (!locNum || locNum < 1 || locNum > (layoutData?.total_locations || 60)) {
      addLog(`Número de ubicación invalido: #${newLocationInput}`, 'WARN');
      return;
    }
    setRackSequence((prev) => [...prev, locNum]);
    addLog(`Ubicación #${locNum} agregada al panel de control de ruta.`, 'ACTION');
  };

  const handleRemoveLocationFromSequence = (indexToRemove) => {
    setRackSequence((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    addLog(`Parada #${indexToRemove + 1} eliminada de la lista de ruta.`, 'INFO');
  };

  const handleMoveLocationInSequence = (index, direction) => {
    const newSeq = [...rackSequence];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newSeq.length) return;
    const temp = newSeq[index];
    newSeq[index] = newSeq[targetIdx];
    newSeq[targetIdx] = temp;
    setRackSequence(newSeq);
    addLog(`Secuencia de paradas actualizada (${index + 1} ↔ ${targetIdx + 1}).`, 'INFO');
  };

  const handleResetToDefaultSequence = () => {
    const defaultSeq = [4, 7, 21, 25, 41, 44, 49, 55, 60];
    setRackSequence(defaultSeq);
    addLog('Secuencia de ruta restablecida a los Racks por defecto con sus niveles de prioridad (Amarillo, Naranja, Rojo).', 'INFO');
  };

  // Start Realtime AGV Route Animation Loop
  const handleStartRouteAnimation = async () => {
    if (!routeResult || !routeResult.route_waypoints || routeResult.route_waypoints.length === 0) {
      await handleCalculateRoute();
    }

    if (isSimulating) {
      if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
      setIsSimulating(false);
      setAgvState((prev) => ({ ...prev, status: 'IDLE' }));
      addLog('Simulación animada detenida por el operador.', 'WARN');
      return;
    }

    const waypoints = routeResult?.route_waypoints || [];
    if (waypoints.length === 0) {
      addLog('No hay waypoints de ruta disponibles.', 'WARN');
      return;
    }

    setIsSimulating(true);
    if (soundEnabled) SoundEffects.playStart();
    addLog('🚀 INICIO DE RECORRIDO INTERACTIVO AGV. Partiendo desde Zona Inferior de Entrada / Despacho (x:0, y:0).', 'ACTION');

    const runWaypointStep = (idx) => {
      if (idx >= waypoints.length) {
        setAgvState((prev) => ({
          ...prev,
          x: 0,
          y: 0,
          status: 'COMPLETED',
          currentWaypointIdx: waypoints.length - 1
        }));
        setIsSimulating(false);
        if (soundEnabled) SoundEffects.playComplete();
        addLog('🏁 RECORRIDO COMPLETADO EXITOSAMENTE. Vehículo AGV retornado a Zona Inferior de Entrada/Despacho.', 'SUCCESS');
        return;
      }

      const wp = waypoints[idx];

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
        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), 800);
      } else if (wp.type === 'TRANSIT') {
        addLog(`↔ TRÁNSITO POR PASILLO: ${wp.label}`, 'INFO');
        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), 400);
      } else if (wp.type === 'PICK') {
        addLog(`🛑 PARADA #${wp.step}: Llegada a ${wp.label} (${wp.aisle}). Operación de recogida en nivel de prioridad...`, 'ACTION');

        if (soundEnabled) {
          SoundEffects.playArrivalForColor(wp.color);
        }

        // Auto mark stop as processed in UI list
        if (routeResult && routeResult.route_list) {
          const updatedList = [...routeResult.route_list];
          const matchIdx = updatedList.findIndex((i) => i.location_number === wp.location);
          if (matchIdx >= 0) {
            updatedList[matchIdx].visited = true;
            setRouteResult((prev) => ({ ...prev, route_list: updatedList }));
          }
        }

        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), wp.dwell_time_ms || 1200);
      } else if (wp.type === 'END') {
        addLog(`Retornando a Punto de Partida / Despacho Inferior...`, 'INFO');
        simulationTimerRef.current = setTimeout(() => runWaypointStep(idx + 1), 900);
      }
    };

    runWaypointStep(0);
  };

  // Manual D-Pad Movement for Virtual Canvas AGV
  const handleManualMove = (dx, dy, dirName) => {
    if (controlMode !== 'manual') return;

    const newX = Math.max(0, Math.min(12, agvState.x + dx));
    const newY = Math.max(0, Math.min(15, agvState.y + dy));

    setAgvState((prev) => ({
      ...prev,
      x: newX,
      y: newY,
      status: 'MANUAL',
      batteryPct: Math.max(10, prev.batteryPct - 1)
    }));

    if (soundEnabled) SoundEffects.playManualStep();
    addLog(`Control Manual AGV Virtual: Movimiento ${dirName} a posición (x:${newX}, y:${newY}).`, 'MANUAL');
  };

  const handleManualPickAction = () => {
    if (soundEnabled) SoundEffects.playArrivalYellow();
    addLog(`Acción de recogida manual ejecutada en coordenadas (x:${agvState.x}, y:${agvState.y}).`, 'SUCCESS');
  };

  const handleEmergencyStop = () => {
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
    setIsSimulating(false);
    setAgvState((prev) => ({ ...prev, status: 'EMERGENCY_STOP' }));
    if (soundEnabled) SoundEffects.playAlert();
    addLog('🚨 PARADA DE EMERGENCIA ACTIVADA POR EL OPERADOR.', 'ERROR');
  };

  const handleResetAGV = () => {
    if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
    setIsSimulating(false);
    setAgvState({
      x: 0,
      y: 0,
      status: 'IDLE',
      mode: controlMode,
      batteryPct: 100,
      speedMps: 1.2,
      currentWaypointIdx: 0,
      location: null
    });
    addLog('AGV reiniciado a posición por defecto: Zona Inferior de Entrada/Despacho (x:0, y:0). Batería 100%.', 'INFO');
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
              <h2 className="text-xl font-black text-white">Panel de Control & Simulación AGV — WMS 2026</h2>
              <p className="text-xs text-slate-400">
                Simulación interactiva y control por hardware serie de un carro autónomo (AGV seguidor de línea).
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

      {/* PANEL DE CONEXIÓN Y CONTROL DEL AGV REAL (ARDUINO USB SERIAL) */}
      <div className="bg-slate-800 border border-emerald-500/30 p-5 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Conexión AGV Real (Arduino USB Serial)
              </h3>
              <p className="text-xs text-slate-400">
                Conecte el carrito seguidor de línea por USB y contrólelo en modo manual o mediante rutas.
              </p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-700">
            <span className={`w-3 h-3 rounded-full ${agvHardwareStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-slate-500'}`} />
            <div className="text-xs">
              <span className="text-slate-400 block font-bold">Estado Hardware:</span>
              <span className={`font-black ${agvHardwareStatus.connected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {agvHardwareStatus.connected ? `CONECTADO (${agvHardwareStatus.port})` : 'DESCONECTADO'}
              </span>
            </div>
          </div>
        </div>

        {/* Port Selector and Connect Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Puerto Serie (USB Arduino)
            </label>
            <div className="flex gap-2">
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={agvHardwareStatus.connected}
                className="flex-1 bg-slate-900 border border-slate-700 text-xs font-bold text-white rounded-xl p-2.5 outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                {agvPorts.length === 0 ? (
                  <option value="">No hay puertos detectados</option>
                ) : (
                  agvPorts.map((p, idx) => (
                    <option key={idx} value={p.port}>
                      {p.port} — {p.description}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={fetchAgvPorts}
                disabled={hardwareBusy || agvHardwareStatus.connected}
                className="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl border border-slate-600 disabled:opacity-50"
                title="Actualizar lista de puertos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            {!agvHardwareStatus.connected ? (
              <button
                onClick={handleConnectAgv}
                disabled={hardwareBusy || !selectedPort}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Conectar Arduino
              </button>
            ) : (
              <button
                onClick={handleDisconnectAgv}
                disabled={hardwareBusy}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Desconectar
              </button>
            )}
          </div>

          <div>
            <button
              onClick={() => handleBeepAgv(300)}
              disabled={!agvHardwareStatus.connected}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4" /> Activar Pitido (Buzzer)
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {hardwareMsg && (
          <div className="p-3 bg-slate-900 border border-slate-700 text-xs font-bold text-emerald-300 rounded-xl flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{hardwareMsg}</span>
          </div>
        )}

        {/* REAL HARDWARE MANUAL CONTROLS & ROUTE ACTIONS (Only when connected) */}
        {agvHardwareStatus.connected && (
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-700/60 pb-3">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" /> Controles Manuales en Tiempo Real (Teclado WASD / Flechas)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Presione una tecla para enviar comando y suelte para detener ('S'). Failsafe activo a 500ms.
                </p>
              </div>

              {/* Speed Slider */}
              <div className="flex items-center space-x-3 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-[11px] font-bold text-slate-300">Velocidad Base:</span>
                <input
                  type="range"
                  min="80"
                  max="255"
                  value={agvSpeed}
                  onChange={(e) => setAgvSpeed(Number(e.target.value))}
                  className="w-24 accent-emerald-500"
                />
                <span className="text-xs font-black text-emerald-400">{agvSpeed}</span>
              </div>
            </div>

            {/* D-Pad Manual Control Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* On-screen D-Pad */}
              <div className="grid grid-cols-3 gap-1.5 w-36 h-36 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                <div />
                <button
                  onMouseDown={() => handleSendManualCommand('F')}
                  onMouseUp={() => handleSendManualCommand('S')}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
                  title="Adelante (F)"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <div />

                <button
                  onMouseDown={() => handleSendManualCommand('L')}
                  onMouseUp={() => handleSendManualCommand('S')}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
                  title="Izquierda (L)"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSendManualCommand('S')}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md"
                  title="Parar (S)"
                >
                  STOP
                </button>
                <button
                  onMouseDown={() => handleSendManualCommand('R')}
                  onMouseUp={() => handleSendManualCommand('S')}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
                  title="Derecha (R)"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div />
                <button
                  onMouseDown={() => handleSendManualCommand('B')}
                  onMouseUp={() => handleSendManualCommand('S')}
                  className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-bold shadow-md"
                  title="Atrás (B)"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
                <div />
              </div>

              {/* Hardware Route Dispatch Commands */}
              <div className="flex-1 space-y-2 border-l border-slate-700/60 pl-4">
                <h5 className="text-xs font-black text-white uppercase tracking-wider">
                  Ejecución de Ruta en el AGV Real
                </h5>
                <p className="text-[11px] text-slate-400">
                  Envíe los waypoints calculados al microcontrolador para inicio autónomo seguidor de línea.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleSendRouteToAgv}
                    disabled={hardwareBusy || !routeResult}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Enviar ruta al AGV Real
                  </button>

                  <button
                    onClick={handleContinueAgvRoute}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <FastForward className="w-4 h-4" /> Continuar (Tras PICK)
                  </button>

                  <button
                    onClick={handleStopAgvRoute}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
                  >
                    <Square className="w-4 h-4 fill-white" /> Parar / Abortar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                addLog('Modo de Control cambiado a AUTOMÁTICO (Siguiente Ruta Precargada).', 'INFO');
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
            <span className="text-slate-400 font-bold">Estado AGV:</span>
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
              disabled={loading}
              className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg ${
                isSimulating
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {isSimulating ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isSimulating ? 'Detener Recorrido' : 'Iniciar Recorrido AGV'}</span>
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
            className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" /> Parada Emergencia
          </button>

          <button
            onClick={handleResetAGV}
            className="px-3.5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-600"
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
        routeWaypoints={routeResult?.route_waypoints || []}
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

      {/* PANEL DE CONTROL MANUAL DE COORDENADAS / RACKS (SIN SKU NI INVENTARIO REAL) */}
      <div className="bg-slate-800/90 border border-slate-700/80 p-6 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              Panel de Control Manual de Coordenadas & Racks
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Ruta precargada por defecto con los Racks del layout actual y sus colores/niveles de prioridad.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefaultSequence}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-600 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Restablecer Racks Precargados
            </button>

            <button
              onClick={handleStartRouteAnimation}
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" />
              Iniciar Recorrido
            </button>
          </div>
        </div>

        {/* Priority Color Badges Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-yellow-950/40 border border-yellow-500/40 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50" />
              <div>
                <span className="font-extrabold text-yellow-300 block">Amarillo (Nivel 1)</span>
                <span className="text-[10px] text-slate-400">Picking manual a primer nivel</span>
              </div>
            </div>
            <span className="text-xs font-black text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-lg border border-yellow-500/30">
              {routeResult?.route_list?.filter((r) => r.color === 'yellow').length || 0} Racks
            </span>
          </div>

          <div className="p-3 bg-orange-950/40 border border-orange-500/40 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
              <div>
                <span className="font-extrabold text-orange-300 block">Naranja (Niveles 1 y 2)</span>
                <span className="text-[10px] text-slate-400">Acceso dual a ambos niveles</span>
              </div>
            </div>
            <span className="text-xs font-black text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/30">
              {routeResult?.route_list?.filter((r) => r.color === 'orange').length || 0} Racks
            </span>
          </div>

          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <div>
                <span className="font-extrabold text-red-300 block">Rojo (Nivel 2)</span>
                <span className="text-[10px] text-slate-400">Nivel superior de altura</span>
              </div>
            </div>
            <span className="text-xs font-black text-red-400 bg-red-500/20 px-2 py-0.5 rounded-lg border border-red-500/30">
              {routeResult?.route_list?.filter((r) => r.color === 'red').length || 0} Racks
            </span>
          </div>
        </div>

        {/* Add New Rack Input Row */}
        <div className="flex flex-col sm:flex-row items-end gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Agregar Ubicación / Rack por Número (1 - 60)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={newLocationInput}
              onChange={(e) => setNewLocationInput(e.target.value)}
              className="w-full text-xs font-bold text-white bg-slate-900 p-2.5 rounded-xl border border-slate-700 outline-none focus:border-blue-500"
              placeholder="Ingrese número de rack (ej. 12)"
            />
          </div>

          <button
            onClick={handleAddLocationToSequence}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Agregar a la Ruta
          </button>
        </div>

        {/* Error Message Display */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-semibold rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Editable Rack Sequence Table */}
        {routeResult && routeResult.route_list && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Lista de Racks Asignados para Recorrido ({routeResult.route_list.length} Paradas):
              </span>
              {routeResult.distance_comparison && (
                <div className="text-right space-y-1">
                  <div className={`text-xs font-extrabold ${routeResult.distance_comparison.is_globally_optimal ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {routeResult.distance_comparison.is_globally_optimal
                      ? 'Ruta mínima verificada (búsqueda exacta)'
                      : 'Ruta estimada (heurística; no garantiza el mínimo global)'}:
                    {' '}{routeResult.distance_comparison.optimized_sequence_distance_m} m
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    Secuencia inicial: {routeResult.distance_comparison.original_sequence_distance_m} m ·{' '}
                    Ahorro: {routeResult.distance_comparison.distance_saved_m} m
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    Pasillo: 1,0 m · bloque de 2 cubos: 2,1 m · largo por cubo: 2,4 m ·{' '}
                    {routeResult.distance_comparison.optimization_method || 'Optimización de recorrido'}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-700/80">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-extrabold text-[10px] border-b border-slate-700">
                  <tr>
                    <th className="p-3">Orden</th>
                    <th className="p-3">Ubicación #</th>
                    <th className="p-3">Identificador Rack</th>
                    <th className="p-3">Pasillo</th>
                    <th className="p-3">Cuadrante</th>
                    <th className="p-3">Nivel de Prioridad / Color</th>
                    <th className="p-3 text-right">Acciones de Edición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-medium bg-slate-900/30">
                  {routeResult.route_list.map((item, idx) => {
                    let badgeClass = 'bg-slate-700 text-slate-300';
                    if (item.color === 'yellow') badgeClass = 'bg-yellow-500 text-slate-900 font-black';
                    else if (item.color === 'orange') badgeClass = 'bg-orange-500 text-white font-black';
                    else if (item.color === 'red') badgeClass = 'bg-red-500 text-white font-black';

                    return (
                      <tr key={idx} className="hover:bg-slate-700/30 transition-all">
                        <td className="p-3 font-black text-blue-400">#{item.pick_order || idx + 1}</td>
                        <td className="p-3 font-extrabold text-white">Ubicación #{item.location_number}</td>
                        <td className="p-3 font-bold text-slate-200">{item.rack}</td>
                        <td className="p-3">{item.aisle}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{item.quadrant}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase shadow-sm ${badgeClass}`}>
                            {item.color.toUpperCase()} — {item.level_display}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleMoveLocationInSequence(idx, -1)}
                              disabled={idx === 0}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-30"
                              title="Mover arriba"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveLocationInSequence(idx, 1)}
                              disabled={idx === routeResult.route_list.length - 1}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-30"
                              title="Mover abajo"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveLocationFromSequence(idx)}
                              className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg border border-rose-800/40"
                              title="Eliminar parada"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
