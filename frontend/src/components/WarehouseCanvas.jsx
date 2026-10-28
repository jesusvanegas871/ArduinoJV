import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Layers, AlertTriangle, Lock, ShieldAlert, CheckCircle2, Cpu, Zap, Radio, Play, Square, Navigation, Activity } from 'lucide-react';

export default function WarehouseCanvas({
  layoutData,
  routeWaypoints = [],
  blockedAisles = [],
  onToggleBlockAisle,
  selectedLocation,
  onSelectLocation,
  agvPos = { x: 2, y: 0, status: 'IDLE', mode: 'auto', currentWaypointIdx: 0, location: null },
  isSimulating = false,
  soundEnabled = true,
  onToggleSound
}) {
  const containerRef = useRef(null);
  const aisleRefs = useRef({});
  const rackRefs = useRef({});
  const topCorridorRef = useRef(null);
  const bottomCorridorRef = useRef(null);

  const [coordsMap, setCoordsMap] = useState({});

  // Group locations by Aisle for organized rendering
  const aisles = [1, 2, 3, 4];

  const locationsMap = layoutData?.locations || {};
  const locationList = Object.values(locationsMap);

  const locationsByAisle = useMemo(() => {
    const map = { 1: [], 2: [], 3: [], 4: [] };
    locationList.forEach((loc) => {
      const aNum = loc.aisle_number || 1;
      if (map[aNum]) {
        map[aNum].push(loc);
      }
    });
    aisles.forEach((aNum) => {
      map[aNum].sort((a, b) => a.grid_y - b.grid_y);
    });
    return map;
  }, [layoutData]);

  // Waypoint index lookup for visual pick order badges
  const pickOrderMap = useMemo(() => {
    const map = {};
    routeWaypoints.forEach((wp) => {
      if (wp.type === 'PICK' && wp.location) {
        if (!map[String(wp.location)]) {
          map[String(wp.location)] = [];
        }
        map[String(wp.location)].push(wp.step);
      }
    });
    return map;
  }, [routeWaypoints]);

  // Measures exact pixel centers of HTML elements relative to SVG container
  const updateMeasuredCoords = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const newMap = {};

    // Top Corridor (y=16) & Bottom Corridor (y=0) centers per Aisle (x=2, 5, 8, 11)
    const topRect = topCorridorRef.current?.getBoundingClientRect();
    const bottomRect = bottomCorridorRef.current?.getBoundingClientRect();

    aisles.forEach((aNum) => {
      const aisleEl = aisleRefs.current[aNum];
      if (aisleEl) {
        const aRect = aisleEl.getBoundingClientRect();
        const centerX = ((aRect.left + aRect.width / 2) - containerRect.left) / containerRect.width * 100;

        // Corridor Y coordinates
        let topY = 6;
        let bottomY = 94;

        if (topRect) {
          topY = ((topRect.top + topRect.height / 2) - containerRect.top) / containerRect.height * 100;
        }
        if (bottomRect) {
          bottomY = ((bottomRect.top + bottomRect.height / 2) - containerRect.top) / containerRect.height * 100;
        }

        // Key coordinates for aisle x with y=0 and y=16
        const xGrid = aNum === 1 ? 2 : (aNum === 2 ? 5 : (aNum === 3 ? 8 : 11));
        newMap[`${xGrid},0`] = { x: centerX, y: bottomY };
        newMap[`${xGrid},16`] = { x: centerX, y: topY };
      }
    });

    // Exact center coordinates for each rack (x, y)
    locationList.forEach((loc) => {
      const rackEl = rackRefs.current[loc.id || loc.number];
      if (rackEl) {
        const rRect = rackEl.getBoundingClientRect();
        const rX = ((rRect.left + rRect.width / 2) - containerRect.left) / containerRect.width * 100;
        const rY = ((rRect.top + rRect.height / 2) - containerRect.top) / containerRect.height * 100;
        newMap[`${loc.grid_x},${loc.grid_y}`] = { x: rX, y: rY };
      }
    });

    setCoordsMap(newMap);
  };

  useEffect(() => {
    updateMeasuredCoords();
    const handleResize = () => updateMeasuredCoords();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      updateMeasuredCoords();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [layoutData]);

  /**
   * Returns exact coordinate in percentage.
   * Fallback if dynamic measurement hasn't run yet.
   */
  const getCanvasCoordsPct = (gridX, gridY) => {
    const key = `${gridX},${gridY}`;
    if (coordsMap[key]) {
      return coordsMap[key];
    }

    // Mathematical fallback mapping
    let pctX = 12.5;
    if (gridX <= 3) pctX = 12.5;
    else if (gridX <= 6) pctX = 37.5;
    else if (gridX <= 9) pctX = 62.5;
    else pctX = 87.5;

    let pctY = 92;
    if (gridY === 0) pctY = 94;
    else if (gridY === 16) pctY = 6;
    else {
      pctY = 88 - (gridY * 5.2);
    }
    return { x: pctX, y: pctY };
  };

  // Build SVG Path Data string connecting waypoints orthogonally
  const svgPathD = useMemo(() => {
    if (!routeWaypoints || routeWaypoints.length < 2) return '';
    return routeWaypoints
      .map((wp, idx) => {
        const { x, y } = getCanvasCoordsPct(wp.x, wp.y);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [routeWaypoints, coordsMap]);

  // Current AGV position on canvas
  const agvCoords = getCanvasCoordsPct(agvPos.x, agvPos.y);

  // Determine current active waypoint for stop glow
  const currentWaypoint = routeWaypoints[agvPos.currentWaypointIdx] || null;

  if (!layoutData || !layoutData.locations) {
    return (
      <div className="p-8 text-center text-slate-400 font-semibold bg-slate-800 rounded-2xl border border-slate-700">
        Cargando diseño de almacén...
      </div>
    );
  }

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
            <span className="bg-blue-500/10 text-blue-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wide">
              Navegación Industrial Neón Precision
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Mapeo vehicular estricto por pasillos (cero cruces por centro de racks) y sincronización geométrica exacta.
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
            <span className="font-bold text-orange-300">Naranja: Doble Parada (Niv. 1 + 2)</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-red-500/30">
            <span className="w-3.5 h-3.5 rounded-md bg-red-500 shadow-sm shadow-red-500/50" />
            <span className="font-bold text-red-300">Rojo: Nivel 2 (Superior)</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-yellow-500/30">
            <span className="w-3.5 h-3.5 rounded-md bg-yellow-500 shadow-sm shadow-yellow-500/50" />
            <span className="font-bold text-yellow-300">Amarillo: Nivel 1 (Base)</span>
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
      <div
        ref={containerRef}
        className="relative bg-slate-950 p-6 rounded-2xl border border-slate-800 overflow-hidden min-w-[700px] select-none"
      >
        {/* SVG Neon Industrial Route Overlay Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {/* High-Tech Industrial Neon Gradient */}
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Glowing Drop Shadow Filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Animated Trajectory Path Line */}
          {svgPathD && (
            <>
              {/* Layer 1: Wide Background Glow Stroke */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
                filter="url(#neonGlow)"
              />

              {/* Layer 2: Main Solid Neon Line */}
              <path
                d={svgPathD}
                fill="none"
                stroke="url(#neonGradient)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#neonGlow)"
              />

              {/* Layer 3: Dynamic Animated Energy Flow Overlay */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.8"
                strokeDasharray="1.5 2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
                opacity="0.9"
              />
            </>
          )}

          {/* Waypoint Nodes and Turn Indicators */}
          {routeWaypoints.map((wp, i) => {
            const { x, y } = getCanvasCoordsPct(wp.x, wp.y);
            if (wp.type === 'START' || wp.type === 'END') return null;

            const isCurrentStop = agvPos.currentWaypointIdx === wp.step && isSimulating;

            if (wp.type === 'TRANSIT') {
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="0.8"
                  fill="#818cf8"
                  stroke="#38bdf8"
                  strokeWidth="0.3"
                />
              );
            }

            // PICK Stop Node
            return (
              <g key={i} className="transition-all duration-300">
                <circle
                  cx={x}
                  cy={y}
                  r={isCurrentStop ? "2.4" : "1.2"}
                  fill={isCurrentStop ? "#10b981" : "#818cf8"}
                  stroke="#ffffff"
                  strokeWidth="0.4"
                  filter="url(#neonGlow)"
                />
                {isCurrentStop && (
                  <circle
                    cx={x}
                    cy={y}
                    r="4.2"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="0.4"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* TOP PERIMETRAL CORRIDOR (y=16) */}
        <div
          ref={topCorridorRef}
          className="w-full bg-slate-900/60 border border-indigo-500/30 rounded-xl py-2 px-4 mb-4 flex items-center justify-between text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest border-dashed"
        >
          <div className="flex items-center space-x-2">
            <Navigation className="w-3.5 h-3.5 text-indigo-400" />
            <span>Corredor Perimetral Superior de Tránsito Vehicular (Pasillo Habilitado)</span>
          </div>
          <span className="text-[9px] bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/50">
            Paso Conector Sin Racks
          </span>
        </div>

        {/* 4 Aisles Grid Layout with Central Aisles */}
        <div className="grid grid-cols-4 gap-6 my-2">
          {aisles.map((aNum) => {
            const aisleName = `Pasillo ${aNum}`;
            const isBlocked = blockedAisles.includes(aisleName);
            const locs = locationsByAisle[aNum] || [];

            return (
              <div
                key={aNum}
                ref={(el) => (aisleRefs.current[aNum] = el)}
                className={`relative rounded-2xl p-3 border transition-all ${
                  isBlocked
                    ? 'bg-rose-950/20 border-rose-500/50'
                    : 'bg-slate-900/60 border-slate-800/80 shadow-lg'
                }`}
              >
                {/* Aisle Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    {aisleName}
                  </span>
                  {isBlocked && (
                    <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> BLOQUEADO
                    </span>
                  )}
                </div>

                {/* Rack Locations Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {locs.map((loc) => {
                    const pickOrders = pickOrderMap[String(loc.number)];
                    const isSelected = selectedLocation && selectedLocation.id === String(loc.number);
                    const isCurrentAgvLocation = agvPos.location === loc.number && agvPos.status === 'STOPPED_PICKING';

                    // Pick stop info if active
                    const isPickActive = currentWaypoint && currentWaypoint.type === 'PICK' && currentWaypoint.location === loc.number && isSimulating;

                    // Dynamic styling based on structured location colors
                    let bgColor = 'bg-slate-800/90 border-slate-700 text-slate-200';
                    let badgeColor = 'bg-slate-700 text-slate-300';

                    if (loc.color === 'orange') {
                      bgColor = 'bg-orange-950/70 border-orange-500/80 text-orange-200 shadow-orange-500/10';
                      badgeColor = 'bg-orange-500 text-white font-black';
                    } else if (loc.color === 'red') {
                      bgColor = 'bg-red-950/70 border-red-500/80 text-red-200 shadow-red-500/10';
                      badgeColor = 'bg-red-500 text-white font-black';
                    } else if (loc.color === 'yellow') {
                      bgColor = 'bg-yellow-950/70 border-yellow-500/80 text-yellow-200 shadow-yellow-200 font-bold';
                      badgeColor = 'bg-yellow-500 text-slate-900 font-black';
                    }

                    return (
                      <button
                        key={loc.id}
                        ref={(el) => (rackRefs.current[loc.id || loc.number] = el)}
                        onClick={() => onSelectLocation && onSelectLocation(loc)}
                        className={`relative p-3 rounded-xl border text-left transition-all duration-300 hover:scale-[1.03] ${bgColor} ${
                          isSelected ? 'ring-2 ring-blue-400 shadow-lg' : ''
                        } ${
                          isPickActive
                            ? 'ring-4 ring-emerald-400 animate-pulse bg-emerald-950/90 border-emerald-400 shadow-2xl shadow-emerald-500/50 scale-105'
                            : isCurrentAgvLocation
                            ? 'ring-4 ring-amber-400 bg-amber-950/80 border-amber-400'
                            : ''
                        }`}
                      >
                        {/* Synchronized Glowing Pick Target Marker */}
                        {isPickActive && (
                          <div className="absolute -top-3 -right-3 z-30 flex items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 border-2 border-white text-slate-900 font-black text-[10px] items-center justify-center shadow-2xl">
                              ✓
                            </span>
                          </div>
                        )}

                        {/* Pick Order Step Badges Overlay (Supports Double Stops) */}
                        {pickOrders && pickOrders.length > 0 && (
                          <div className="absolute -top-2 -left-2 flex items-center -space-x-1 z-20">
                            {pickOrders.map((pStep, sIdx) => (
                              <span
                                key={sIdx}
                                className="w-5 h-5 rounded-full bg-blue-600 text-white border border-slate-900 font-black text-[10px] flex items-center justify-center shadow-lg"
                                title={`Parada #${pStep}`}
                              >
                                #{pStep}
                              </span>
                            ))}
                          </div>
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

                        {/* Orange Double Stop Label Banner */}
                        {loc.color === 'orange' && (
                          <div className="mt-1.5 pt-1 border-t border-orange-500/30 text-[9px] text-orange-300 font-extrabold flex items-center justify-between">
                            <span>DOBLE PARADA</span>
                            <span className="text-[8px] bg-orange-900/80 px-1 rounded border border-orange-400/40">N1+N2</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM PERIMETRAL CORRIDOR (y=0) */}
        <div
          ref={bottomCorridorRef}
          className="w-full bg-slate-900/60 border border-blue-500/30 rounded-xl py-2 px-4 mt-4 mb-2 flex items-center justify-between text-[10px] text-blue-300 font-extrabold uppercase tracking-widest border-dashed"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Corredor Perimetral Inferior & Zona de Entrada / Despacho (Punto de Partida AGV)</span>
          </div>
          <span className="text-[9px] bg-blue-950 px-2 py-0.5 rounded border border-blue-800/50">
            Circulación Vehicular Exclusiva
          </span>
        </div>

        {/* Dynamic Animated AGV Vehicle Graphic (Industrial Micro-Chassis) */}
        <div
          className="absolute z-40 transition-all duration-500 ease-in-out transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${agvCoords.x}%`, top: `${agvCoords.y}%` }}
        >
          <div className="relative group">
            {/* AGV Vehicle Outer Chassis Graphic */}
            <div
              className={`w-12 h-12 rounded-2xl p-1.5 flex flex-col items-center justify-between shadow-2xl transition-all border ${
                agvPos.status === 'MOVING'
                  ? 'bg-blue-600 border-blue-300 ring-4 ring-blue-500/40 animate-pulse shadow-blue-500/50'
                  : agvPos.status === 'STOPPED_PICKING'
                  ? 'bg-emerald-600 border-emerald-300 ring-4 ring-emerald-500/50 shadow-emerald-500/50'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              {/* Front Status LEDs & Headlights */}
              <div className="flex items-center justify-between w-full px-1">
                <span className={`w-1.5 h-1.5 rounded-full ${agvPos.status === 'MOVING' ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
                <span className="text-[7px] font-black text-white tracking-widest">AGV-01</span>
                <span className={`w-1.5 h-1.5 rounded-full ${agvPos.status === 'STOPPED_PICKING' ? 'bg-amber-300 animate-ping' : 'bg-slate-400'}`} />
              </div>

              {/* Microcontroller / AGV Avatar Icon */}
              <div className="my-0.5">
                <Cpu className={`w-5 h-5 ${agvPos.status === 'MOVING' ? 'text-white' : (agvPos.status === 'STOPPED_PICKING' ? 'text-emerald-100' : 'text-blue-400')}`} />
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
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded-lg border border-slate-700 shadow-2xl flex items-center gap-1 z-50">
              <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {agvPos.status === 'MOVING'
                ? 'TRÁNSITO POR PASILLO...'
                : agvPos.status === 'STOPPED_PICKING'
                ? `RECOGIDA ${currentWaypoint?.chosen_level ? `NIVEL ${currentWaypoint.chosen_level}` : ''}...`
                : agvPos.status === 'COMPLETED'
                ? 'RECORRIDO FINALIZADO'
                : 'AGV LISTO (DESPACHO)'}
            </div>
          </div>
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
