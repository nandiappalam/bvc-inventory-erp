import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';

// SVG Icon Helpers to avoid external dependency issues
const PackageIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const XIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const MapPinIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LayersIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const HistoryIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DollarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const Package = PackageIcon;
const RefreshCw = RefreshIcon;
const X = XIcon;
const MapPin = MapPinIcon;
const Layers = LayersIcon;
const History = HistoryIcon;
const DollarSign = DollarIcon;
const ShieldAlert = ({ className = "w-5 h-5" }) => (
  <svg className={className} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ShieldAlertIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default function ItemStockDetailsModal({ isOpen, onClose, itemName, itemId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('godowns'); // 'godowns', 'lots', 'movements'
  const [error, setError] = useState(null);

  const identifier = itemName || itemId;

  useEffect(() => {
    if (isOpen && identifier) {
      fetchItemDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, identifier]);

  const fetchItemDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api(`/masters/item-stock-details/${encodeURIComponent(identifier)}`);
      if (res && res.success && res.data) {
        setData(res.data);
      } else if (res && res.data) {
        setData(res.data);
      } else {
        setError('Could not load item stock details');
      }
    } catch (err) {
      console.error('Error loading item stock details:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const item = data?.item || {};
  const summary = data?.summary || {};
  const godowns = data?.godowns || [];
  const lots = data?.lots || [];
  const movements = data?.movements || [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-md">
              <Package className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {item.item_name || identifier}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-500/30 text-blue-100 rounded-full border border-blue-400/30">
                  {item.item_code || 'ITM-MASTER'}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Group: <strong className="text-white">{item.item_group || item.type || 'General'}</strong> | Unit: <strong className="text-white">{item.unit || 'kg'}</strong> | Std Wt: <strong className="text-white">{item.weight || 50} kg</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchItemDetails}
              disabled={loading}
              className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600">Fetching live stock records & godown balances...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center space-x-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Top Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Qty</span>
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {Number(summary.totalAvailableQty || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{item.unit || 'Bags'}</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Weight</span>
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {Number(summary.totalWeight || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">kg</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Valuation</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-emerald-700">
                    ₹ {Number(summary.totalValuation || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Lots</span>
                    <MapPin className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {summary.activeLotsCount || 0} <span className="text-xs font-normal text-slate-500">Tracked</span>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="border-b border-slate-200 flex space-x-6">
                <button
                  onClick={() => setActiveTab('godowns')}
                  className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'godowns'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Godown Wise Stock ({godowns.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('lots')}
                  className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'lots'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Active Stock Lots ({lots.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('movements')}
                  className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'movements'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Recent Ledger Movements ({movements.length})</span>
                </button>
              </div>

              {/* Tab 1: Godown Breakdown */}
              {activeTab === 'godowns' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Godown Location</th>
                        <th className="p-3 text-right">Available Qty</th>
                        <th className="p-3 text-right">Total Weight (kg)</th>
                        <th className="p-3 text-right">Avg Rate (₹)</th>
                        <th className="p-3 text-right">Stock Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {godowns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No stock balance recorded in any godown for this item.
                          </td>
                        </tr>
                      ) : (
                        godowns.map((g, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-semibold text-slate-900 flex items-center space-x-2">
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                              <span>{g.godown_name || 'Main Godown'}</span>
                            </td>
                            <td className="p-3 text-right font-bold text-blue-700">
                              {Number(g.available_qty || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-medium text-slate-700">
                              {Number(g.total_weight || 0).toLocaleString()} kg
                            </td>
                            <td className="p-3 text-right text-slate-600">
                              ₹ {Number(g.avg_rate || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600">
                              ₹ {Number((g.available_qty || 0) * (g.avg_rate || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Active Lots */}
              {activeTab === 'lots' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Lot Number</th>
                        <th className="p-3">Godown Location</th>
                        <th className="p-3 text-right">Original Qty</th>
                        <th className="p-3 text-right">Remaining Qty</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-center">QC Status</th>
                        <th className="p-3 text-center">Unloading</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {lots.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            No active stock lots found for this item.
                          </td>
                        </tr>
                      ) : (
                        lots.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-indigo-700">
                              {l.lot_no}
                            </td>
                            <td className="p-3 font-medium text-slate-700">
                              {l.godown_name}
                            </td>
                            <td className="p-3 text-right text-slate-500">
                              {l.quantity}
                            </td>
                            <td className="p-3 text-right font-bold text-blue-700">
                              {l.remaining_quantity}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              ₹ {Number(l.rate || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                String(l.qc_status).toUpperCase().includes('ACCEPT') || String(l.qc_status).toUpperCase().includes('PASS')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {l.qc_status || 'ACCEPTED'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                String(l.unloading_status).toUpperCase() === 'UNLOADED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {l.unloading_status || 'UNLOADED'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Recent Movements */}
              {activeTab === 'movements' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Transaction Type</th>
                        <th className="p-3">Lot No</th>
                        <th className="p-3">Godown</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Weight (kg)</th>
                        <th className="p-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {movements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            No ledger movements found for this item.
                          </td>
                        </tr>
                      ) : (
                        movements.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                              {m.date || '—'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.type === 'Purchase' || m.qty > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {m.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-indigo-700">
                              {m.lot_no || '—'}
                            </td>
                            <td className="p-3 text-slate-700">
                              {m.godown_name || 'Main Godown'}
                            </td>
                            <td className={`p-3 text-right font-bold ${m.qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {m.qty >= 0 ? `+${m.qty}` : m.qty}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              {m.weight ? `${m.weight} kg` : '—'}
                            </td>
                            <td className="p-3 text-right font-medium text-slate-900">
                              ₹ {Number(m.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          <p className="text-xs text-slate-500">
            Real-time multi-godown inventory audit & lot balance trace
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
