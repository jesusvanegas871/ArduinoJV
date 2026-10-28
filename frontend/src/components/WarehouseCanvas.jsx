import React, { useMemo } from 'react';
import { Layers, AlertTriangle, Lock, ShieldAlert, CheckCircle2, Cpu, Zap, Radio, Play, Square } from 'lucide-react';

export default function WarehouseCanvas({
  layoutData,
  routeWaypoints = [],
  blockedAisles = [],
  onToggleBlockAisle,
  selectedLocation,
  onSelectLocation,
  agvPos = { x: 2, y: 0, status: 'IDLE', mode: 'auto', currentWaypointIdx: 0 },
  isSimulating = false,
  soundEnabled = true,
  onToggleSound
}) {
  if (!layoutData || !layoutData.locations) {
    return (
      <div className="p-8 text-center text-slate-400 font-semibold bg-slate-800 rounded-2xl border border-slate-700">
        Cargando diseño de almacén...
      </div>
    );
  }

  const locationsMap = layoutData.locations;
  const locationList = Object.values(locationsMap);

  // Group locations by Aisle for organized rendering
  const aisles = [1, 2, 3, 4];
  const locationsByAisle = { 1: [], 2: [], 3: [], 4: [] };

  locationList.forEach((loc) => {
    const aNum = loc.aisle_number || 1;
    if (locationsByAisle[aNum]) {
      locationsByAisle[aNum].push(loc);
    }
  });

  // Waypoint index lookup for visual pick order badges
  const pickOrderMap = useMemo(() => {
    const map = {};
    routeWaypoints.forEach((wp) => {
      if (wp.type === 'PICK' && wp.location) {
        map[String(wp.location)] = wp.step;
      }
    });
    return map;
  }, [routeWaypoints]);

  /**
   * Helper to compute SVG percentage coordinates for waypoints and AGV position.
   * Aisle 1 (x=2) -> ~12.5% X
   * Aisle 2 (x=5) -> ~37.5% X
   * Aisle 3 (x=8) -> ~62.5% X
   * Aisle 4 (x=11) -> ~87.5% X
   * y=0 (Entrance/Despacho) -> 92% Y
   * y=1..15 -> 84% Y down to 10% Y
   */
  const getCanvasCoordsPct = (gridX, gridY) => {
    let pctX = 12.5;
    if (gridX <= 3) pctX = 12.5;
    else if (gridX <= 6) pctX = 37.5;
    else if (gridX <= 9) pctX = 62.5;
    else pctX = 87.5;

    // Y coordinates 0 to 15
    const clampedY = Math.max(0, Math.min(15, gridY));
    let pctY = 92 - (clampedY * 5.3);
    return { x: pctX, y: pctY };
  };

  // Build SVG Path Data string (d attribute) connecting all waypoints
  const svgPathD = useMemo(() => {
    if (!routeWaypoints || routeWaypoints.length < 2) return '';
    return routeWaypoints
      .map((wp, idx) => {
        const { x, y } = getCanvasCoordsPct(wp.x, wp.y);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [routeWaypoints]);

  // Current AGV percentage position on canvas
  const agvCoords = getCanvasCoordsPct(agvPos.x, agvPos.y);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Top Controls & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              {layoutData.name || 'Layout de Almacén WMS 2026'}
            </h3>
            <span className="bg-blue-500/10 text-blue-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
              Mapa Interactivo en Tiempo Real
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Representación de pasillos, trazado dinámico de ruta animada y simulación AGV Arduino/AGV.
          </p>
        </div>

        {/* Structured Color Legend & Audio Toggle */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            onClick={onToggleSound}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${soundEnabled ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Audio {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-orange-500/30">
            <span className="w-3.5 h-3.5 rounded-md bg-orange-500 shadow-sm shadow-orange-500/50" />
            <span className="font-bold text-orange-300">Naranja (4, 25, 60): Niv. 1-2</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-red-500/30">
            <span className="w-3.5 h-3.5 rounded-md bg-red-500 shadow-sm shadow-red-500/50" />
            <span className="font-bold text-red-300">Rojo (41, 44, 49): Niv. 2</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-yellow-500/30">
            <span className="w-3.5 h-3.5 rounded-md bg-yellow-500 shadow-sm shadow-yellow-500/50" />
            <span className="font-bold text-yellow-300">Amarillo (7, 21, 55): Niv. 1</span>
          </div>
        </div>
      </div>

      {/* Aisle Blocker Controls */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/80 text-xs">
        <span className="font-bold text-slate-300 flex items-center gap-1 mr-2">
          <Lock className="w-4 h-4 text-amber-400" /> Simular Pasillos Bloqueados:
        </span>
        {aisles.map((aNum) => {
          const aisleName = `Pasillo ${aNum}`;
          const isBlocked = blockedAisles.includes(aisleName);
          return (
            <button
              key={aNum}
              onClick={() => onToggleBlockAisle && onToggleBlockAisle(aisleName)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                isBlocked
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 border border-rose-400'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {isBlocked ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
              {aisleName} {isBlocked ? '(Bloqueado)' : '(Libre)'}
            </button>
          );
        })}
      </div>

      {/* Interactive Layout Graphic Canvas */}
      <div className="relative bg-slate-950 p-6 rounded-2xl border border-slate-800 overflow-hidden min-w-[700px]">
        {/* SVG Route Traversal & Stop Overlay Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Animated Trajectory Path Line */}
          {svgPathD && (
            <>
              {/* Outer Glowing Path */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
              />
              {/* Pulsing Animated Dashed Path */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="0.8"
                strokeDasharray="2 1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
              />
            </>
          )}

          {/* Waypoint Stop Markers */}
          {routeWaypoints.map((wp, i) => {
            const { x, y } = getCanvasCoordsPct(wp.x, wp.y);
            if (wp.type === 'START' || wp.type === 'END') return null;
            const isCurrentStop = agvPos.currentWaypointIdx === wp.step && isSimulating;

            return (
              <g key={i} className="transition-all duration-300">
                <circle
                  cx={x}
                  cy={y}
                  r={isCurrentStop ? "2.2" : "1.4"}
                  fill={isCurrentStop ? "#10b981" : "#3b82f6"}
                  stroke="#ffffff"
                  strokeWidth="0.4"
                />
                {isCurrentStop && (
                  <circle
                    cx={x}
                    cy={y}
                    r="3.8"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="0.3"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Dynamic Animated AGV Vehicle Graphic (Arduino/AGV Avatar) */}
        <div
          className="absolute z-30 transition-all duration-500 ease-in-out transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${agvCoords.x}%`, top: `${agvCoords.y}%` }}
        >
          <div className="relative group">
            {/* AGV Vehicle Outer Chassis Graphic */}
            <div
              className={`w-12 h-12 rounded-2xl p-1.5 flex flex-col items-center justify-between shadow-2xl transition-all border ${
                agvPos.status === 'MOVING'
                  ? 'bg-blue-600 border-blue-300 ring-4 ring-blue-500/40 animate-pulse'
                  : agvPos.status === 'STOPPED_PICKING'
                  ? 'bg-amber-600 border-amber-300 ring-4 ring-amber-500/40'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              {/* Front Status LEDs & Headlights */}
              <div className="flex items-center justify-between w-full px-1">
                <span className={`w-1.5 h-1.5 rounded-full ${agvPos.status === 'MOVING' ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
                <span className="text-[7px] font-black text-white tracking-widest">AGV-01</span>
                <span className={`w-1.5 h-1.5 rounded-full ${agvPos.status === 'STOPPED_PICKING' ? 'bg-amber-300 animate-ping' : 'bg-slate-400'}`} />
              </div>

              {/* Arduino Microcontroller Chip Icon */}
              <div className="my-0.5">
                <Cpu className={`w-5 h-5 ${agvPos.status === 'MOVING' ? 'text-white' : 'text-blue-400'}`} />
              </div>

              {/* Bottom Wheels / Battery LED */}
              <div className="flex items-center justify-between w-full px-1">
                <span className="w-1 h-2 bg-slate-900 rounded-sm" />
                <span className="text-[8px] font-extrabold text-emerald-300">
                  {agvPos.batteryPct ?? 100}%
                </span>
                <span className="w-1 h-2 bg-slate-900 rounded-sm" />
              </div>
            </div>

            {/* Floating AGV Tooltip Badge */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {agvPos.status === 'MOVING'
                ? 'DESPLAZÁNDOSE...'
                : agvPos.status === 'STOPPED_PICKING'
                ? 'RECOGIENDO ÍTEM...'
                : agvPos.status === 'COMPLETED'
                ? 'RUTA FINALIZADA'
                : 'AGV LISTO (ENTRADA)'}
            </div>
          </div>
        </div>

        {/* 4 Aisles Grid Layout */}
        <div className="grid grid-cols-4 gap-6 pb-14">
          {aisles.map((aNum) => {
            const aisleName = `Pasillo ${aNum}`;
            const isBlocked = blockedAisles.includes(aisleName);
            const locs = locationsByAisle[aNum] || [];

            return (
              <div
                key={aNum}
                className={`relative rounded-2xl p-3 border transition-all ${
                  isBlocked
                    ? 'bg-rose-950/20 border-rose-500/50'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Aisle Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="text-xs font-black text-white">{aisleName}</span>
                  {isBlocked && (
                    <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> BLOQUEADO
                    </span>
                  )}
                </div>

                {/* Rack Locations Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {locs.map((loc) => {
                    const pickOrder = pickOrderMap[String(loc.number)];
                    const isSelected = selectedLocation && selectedLocation.id === String(loc.number);
                    const isCurrentAgvLocation = agvPos.location === loc.number && agvPos.status === 'STOPPED_PICKING';

                    // Dynamic styling based on structured location colors
                    let bgColor = 'bg-slate-800 border-slate-700 text-slate-200';
                    let badgeColor = 'bg-slate-700 text-slate-300';

                    if (loc.color === 'orange') {
                      bgColor = 'bg-orange-950/70 border-orange-500 text-orange-200 shadow-orange-500/10';
                      badgeColor = 'bg-orange-500 text-white font-black';
                    } else if (loc.color === 'red') {
                      bgColor = 'bg-red-950/70 border-red-500 text-red-200 shadow-red-500/10';
                      badgeColor = 'bg-red-500 text-white font-black';
                    } else if (loc.color === 'yellow') {
                      bgColor = 'bg-yellow-950/70 border-yellow-500 text-yellow-200 shadow-yellow-500/10';
                      badgeColor = 'bg-yellow-500 text-slate-900 font-black';
                    }

                    return (
                      <button
                        key={loc.id}
                        onClick={() => onSelectLocation && onSelectLocation(loc)}
                        className={`relative p-3 rounded-xl border text-left transition-all hover:scale-[1.03] ${bgColor} ${
                          isSelected ? 'ring-2 ring-blue-400 shadow-lg' : ''
                        } ${isCurrentAgvLocation ? 'ring-4 ring-amber-400 animate-pulse bg-amber-950/80' : ''}`}
                      >
                        {/* Pick Order Step Badge Overlay */}
                        {pickOrder && (
                          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white border-2 border-slate-900 font-black text-xs flex items-center justify-center shadow-lg z-20">
                            #{pickOrder}
                          </span>
                        )}

                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-black text-white">#{loc.number}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${badgeColor}`}>
                            {loc.levels.length > 1 ? 'Niv. 1-2' : `Niv. ${loc.levels[0]}`}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 font-medium truncate">
                          Rack {loc.rack}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Entrance / Exit Bottom Marker */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-blue-600/30 text-blue-300 text-[11px] font-black px-6 py-2 rounded-full border border-blue-500/40 uppercase tracking-wider flex items-center gap-2 shadow-2xl z-20">
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
          Zona Inferior de Entrada / Despacho (Punto de Partida AGV)
        </div>
      </div>

      {/* Selected Location Information Drawer */}
      {selectedLocation && (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: selectedLocation.color_hex || '#3b82f6' }}
              />
              Ubicación #{selectedLocation.number} ({selectedLocation.aisle}, {selectedLocation.quadrant})
            </h4>
            <button
              onClick={() => onSelectLocation(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar ×
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
            <div>
              <span className="text-slate-400 block font-bold">Niveles Habilitados:</span>
              <span className="font-extrabold text-white">
                {selectedLocation.levels ? selectedLocation.levels.join(', ') : '1'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Regla de Recogida:</span>
              <span className="font-semibold text-slate-200">
                {selectedLocation.picking_rule || 'Recogida estándar'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Descripción:</span>
              <span className="font-semibold text-slate-200">
                {selectedLocation.description}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
