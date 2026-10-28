import React, { useState } from 'react';
import { Play, FastForward, RotateCcw, Calendar, CheckCircle2, Lock, ShieldAlert, BarChart3, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function CycleCountManager({
  schedule,
  stats,
  currentWeek,
  onGenerateWeek,
  onSimulateYear,
  onReset,
  loading
}) {
  const [selectedWeekView, setSelectedWeekView] = useState(1);

  const selectedWeekData = schedule[selectedWeekView] || { week: selectedWeekView, count: 0, items: [] };

  // Generate chart data for week counts
  const chartData = Object.keys(schedule).map((wKey) => {
    const wNum = parseInt(wKey);
    return {
      week: `S${wNum}`,
      count: schedule[wNum] ? schedule[wNum].count : 0,
      isCurrent: wNum === currentWeek
    };
  });

  return (
    <div className="space-y-6">
      {/* Action Controls Bar */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Planificación y Conteo Cíclico Semanal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generación aleatoria distribuida en 52 semanas. Límite estricto de 5 conteos anuales por referencia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onGenerateWeek}
            disabled={loading || currentWeek >= 52}
            className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-600/20 transition-all border border-blue-400/30 active:scale-95"
          >
            <Play className="w-4 h-4 mr-2" />
            Generar Semana Aleatoria ({currentWeek < 52 ? `S${currentWeek + 1}` : 'Finalizado'})
          </button>

          <button
            onClick={onSimulateYear}
            disabled={loading}
            className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-all border border-emerald-400/30 active:scale-95"
          >
            <FastForward className="w-4 h-4 mr-2" />
            Simular Año Completo (52 Semanas)
          </button>

          <button
            onClick={onReset}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2.5 text-xs font-semibold text-slate-300 bg-slate-700/70 hover:bg-slate-700 hover:text-white rounded-xl transition-all border border-slate-600 active:scale-95"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Distribución Semanal de Conteos (52 Semanas)
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Semana actual: <strong className="text-blue-400">{currentWeek} / 52</strong>
          </span>
        </div>

        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="week" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={3} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
                formatter={(value) => [`${value} referencias`, 'A contar']}
                labelFormatter={(label) => `Semana ${label}`}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Week Selector & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weeks Grid Selector */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Selector de Semanas
            </h3>
            <span className="text-xs text-slate-400">Haz clic para inspeccionar</span>
          </div>

          <div className="grid grid-cols-6 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {Array.from({ length: 52 }, (_, i) => i + 1).map((wNum) => {
              const weekInfo = schedule[wNum];
              const count = weekInfo ? weekInfo.count : 0;
              const isSelected = selectedWeekView === wNum;
              const isPassed = wNum <= currentWeek;

              return (
                <button
                  key={wNum}
                  onClick={() => setSelectedWeekView(wNum)}
                  className={`p-2 rounded-xl text-center flex flex-col items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105 font-bold'
                      : isPassed
                      ? 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-750'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono opacity-80">S{wNum}</span>
                  <span className="text-xs font-bold mt-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Week Detail Table */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedWeekView(Math.max(1, selectedWeekView - 1))}
                disabled={selectedWeekView <= 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Detalle de Asignación: Semana {selectedWeekView}</span>
                  {selectedWeekView <= currentWeek && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase font-bold">
                      Programado / Ejecutado
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Total de referencias asignadas para contar: <strong>{selectedWeekData.items.length}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedWeekView(Math.min(52, selectedWeekView + 1))}
                disabled={selectedWeekView >= 52}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Items assigned for the week */}
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-700">
                  <th className="py-3 px-4">SKU / Referencia</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Clase</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4 text-center">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-xs">
                {selectedWeekData.items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Hash className="w-8 h-8 text-slate-500 stroke-1" />
                        <p className="font-medium text-slate-300">No hay referencias programadas para la Semana {selectedWeekView}.</p>
                        <p className="text-[11px] text-slate-500">Usa el botón "Generar Semana Aleatoria" o "Simular Año Completo" para asignar conteos.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  selectedWeekData.items.map((item) => {
                    const isMaxedOut = item.counts_completed === 5 || item.is_blocked;

                    return (
                      <tr key={item.sku} className="hover:bg-slate-750/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-medium truncate max-w-xs" title={item.description}>
                          {item.description}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {item.location}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isMaxedOut ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <Lock className="w-3 h-3" />
                              <span>5/5 (Bloqueado)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              <span>{item.counts_completed}/5 Conteos</span>
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
        </div>
      </div>
    </div>
  );
}
