import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, Download, ShieldAlert, Cpu, Activity, Play } from 'lucide-react';

export default function LiveLogTerminal({ logs = [], onClearLogs, agvState = {} }) {
  const terminalEndRef = useRef(null);

  // Auto-scroll to bottom on new log entry
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleExportLogs = () => {
    if (!logs.length) return;
    const logText = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agv_live_logs_${Date.now()}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const getTagStyle = (type) => {
    switch (type) {
      case 'SUCCESS':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'WARN':
      case 'ALERT':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'ACTION':
      case 'MANUAL':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'INFO':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 font-mono">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
            <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              TERMINAL DE LOGS EN VIVO (AGV ARDUINO CORE)
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-[10px] text-slate-500">
              Monitoreo de telemetría, sensores, paradas de picking y estado de batería.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 text-[11px]">
          <button
            onClick={handleExportLogs}
            disabled={!logs.length}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" /> Exportar Logs
          </button>
          <button
            onClick={onClearLogs}
            disabled={!logs.length}
            className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-800 hover:border-rose-800/50 font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Limpiar
          </button>
        </div>
      </div>

      {/* Realtime AGV Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <div>
            <span className="text-slate-500 block text-[9px] font-bold uppercase">Estado AGV</span>
            <span className="font-extrabold text-indigo-300">{agvState.status || 'ESTÁTICO'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <div>
            <span className="text-slate-500 block text-[9px] font-bold uppercase">Modo de Control</span>
            <span className="font-extrabold text-blue-300">{agvState.mode === 'manual' ? 'MANUAL' : 'AUTOMÁTICO'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-emerald-400 font-black">⚡</span>
          <div>
            <span className="text-slate-500 block text-[9px] font-bold uppercase">Batería LiPo</span>
            <span className="font-extrabold text-emerald-400">{agvState.batteryPct ?? 100}%</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-amber-400 font-black">📍</span>
          <div>
            <span className="text-slate-500 block text-[9px] font-bold uppercase">Ubicación Actual</span>
            <span className="font-extrabold text-amber-300">
              ({agvState.x ?? 2}, {agvState.y ?? 0})
            </span>
          </div>
        </div>
      </div>

      {/* Log Console Output Area */}
      <div className="h-48 overflow-y-auto bg-slate-950 p-3 rounded-2xl border border-slate-900 text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs font-medium">
            &gt; Esperando eventos del sistema... Presiona "Iniciar Ruta" o usa el Modo Manual.
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start space-x-2 leading-relaxed animate-fadeIn">
              <span className="text-slate-500 text-[10px] font-bold flex-shrink-0">
                [{log.timestamp}]
              </span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase flex-shrink-0 ${getTagStyle(
                  log.type
                )}`}
              >
                {log.type}
              </span>
              <span className="text-slate-200 font-mono text-[11px] break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
