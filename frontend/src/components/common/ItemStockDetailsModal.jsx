import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api.js';

// SVG Icon Helpers
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

const ShieldAlertIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const InfoIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShoppingBagIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ItemStockDetailsModal({ isOpen, onClose, itemName, itemId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'godowns', 'lots', 'purchases', 'movements', 'quality'
  const [error, setError] = useState(null);

  const rawIdentifier = itemName || itemId || '';
  const identifier = typeof rawIdentifier === 'object' 
    ? (rawIdentifier.item_name || rawIdentifier.name || rawIdentifier.id || '') 
    : String(rawIdentifier).trim();

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch item details when modal opens or identifier changes
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
        setError('Could not load item stock details from database');
      }
    } catch (err) {
      console.error('Error loading item stock details:', err);
      setError(err.message || 'Error connecting to database server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const item = data?.item || {};
  const summary = data?.summary || {};
  const godowns = data?.godowns || [];
  const lots = data?.lots || [];
  const purchases = data?.purchases || [];
  const movements = data?.movements || [];
  const quality = data?.quality || {};

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 sm:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)'
        }}
      >
        
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-400 shadow-sm">
              <PackageIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <h2 className="text-lg font-bold text-white tracking-tight m-0">
                  {item.item_name || identifier}
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-600/30 text-blue-200 rounded-md border border-blue-400/30 font-mono">
                  {item.item_code || 'ITM-001'}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-400/30">
                  {item.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 m-0 flex items-center space-x-2">
                <span>Category: <strong className="text-white">{item.category || item.type || 'Raw Material'}</strong></span>
                <span>·</span>
                <span>Stock Type: <strong className="text-white">{item.type || 'RM'}</strong></span>
                <span>·</span>
                <span>Unit: <strong className="text-white">{item.unit || 'Bags'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchItemDetails}
              disabled={loading}
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
              title="Refresh Live Data"
            >
              <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
              title="Close (Esc)"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex space-x-2 overflow-x-auto shrink-0">
          {[
            { id: 'overview', label: '📌 Overview & Info', icon: InfoIcon },
            { id: 'godowns', label: `Godowns (${godowns.length})`, icon: MapPinIcon },
            { id: 'lots', label: `Lot Register (${lots.length})`, icon: LayersIcon },
            { id: 'purchases', label: `Purchases (${purchases.length})`, icon: ShoppingBagIcon },
            { id: 'movements', label: `Movements (${movements.length})`, icon: HistoryIcon },
            { id: 'quality', label: 'QC Details', icon: CheckCircleIcon }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshIcon className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Fetching item information and database stock records...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center space-x-3">
              <ShieldAlertIcon className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          ) : (
            <>
              {/* STOCK SUMMARY CARDS (Always visible at top) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Stock</span>
                  <span className="text-base font-extrabold text-slate-900 block mt-1 font-mono tabular-nums">
                    {Number(summary.totalStock || summary.totalAvailableQty || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{item.unit || 'Bags'}</span>
                  </span>
                </div>

                <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-blue-700 block">Available Stock</span>
                  <span className="text-base font-extrabold text-blue-800 block mt-1 font-mono tabular-nums">
                    {Number(summary.availableStock || summary.totalAvailableQty || 0).toLocaleString()} <span className="text-xs font-normal text-blue-600">{item.unit || 'Bags'}</span>
                  </span>
                </div>

                <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-amber-700 block">Reserved Stock</span>
                  <span className="text-base font-extrabold text-amber-800 block mt-1 font-mono tabular-nums">
                    {Number(summary.reservedStock || 0).toLocaleString()} <span className="text-xs font-normal text-amber-600">{item.unit || 'Bags'}</span>
                  </span>
                </div>

                <div className="bg-rose-50/80 p-3 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-rose-700 block">QC-Hold Stock</span>
                  <span className="text-base font-extrabold text-rose-800 block mt-1 font-mono tabular-nums">
                    {Number(summary.qcHoldStock || 0).toLocaleString()} <span className="text-xs font-normal text-rose-600">{item.unit || 'Bags'}</span>
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Godowns</span>
                  <span className="text-base font-extrabold text-indigo-700 block mt-1 font-mono tabular-nums">
                    {summary.godownCount || godowns.length || 0}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Lots</span>
                  <span className="text-base font-extrabold text-emerald-700 block mt-1 font-mono tabular-nums">
                    {summary.lotCount || lots.length || 0}
                  </span>
                </div>
              </div>

              {/* TAB 1: OVERVIEW & ITEM INFORMATION */}
              {(activeTab === 'overview') && (
                <div className="space-y-5 animate-fadeIn">
                  {/* SECTION 1 — Item Information Two-Column Aligned Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center space-x-2">
                      <InfoIcon className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                        Section 1 — Master Item Information
                      </h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Item Name</span>
                        <strong className="text-slate-900 font-bold">{item.item_name || identifier}</strong>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Item Code</span>
                        <strong className="text-blue-700 font-mono">{item.item_code || 'ITM-001'}</strong>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Alias Name</span>
                        <span className="text-slate-800">{item.print_name || item.alias_name || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Category</span>
                        <span className="text-slate-800 font-semibold">{item.category || item.item_group || 'General'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Stock Type</span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold">{item.type || 'Raw Material'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Base Unit</span>
                        <span className="text-slate-800 font-bold">{item.unit || 'Bags'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Weight / Pack Size</span>
                        <span className="text-slate-800 font-mono">{item.weight || 50} kg</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Item Status</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">{item.status || 'Active'}</span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK GODOWN & LOT PREVIEW */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center justify-between">
                        <span>Godown Balances</span>
                        <button onClick={() => setActiveTab('godowns')} className="text-blue-600 hover:underline text-[11px]">View All →</button>
                      </h4>
                      {godowns.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">No godown stock recorded.</p>
                      ) : (
                        <div className="space-y-2">
                          {godowns.slice(0, 3).map((g, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="font-medium text-slate-800">{g.godown_name}</span>
                              <span className="font-mono font-bold text-blue-700">{Number(g.available_qty || 0).toLocaleString()} {item.unit || 'Bags'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center justify-between">
                        <span>Active Lots</span>
                        <button onClick={() => setActiveTab('lots')} className="text-blue-600 hover:underline text-[11px]">View All →</button>
                      </h4>
                      {lots.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">No active lots recorded.</p>
                      ) : (
                        <div className="space-y-2">
                          {lots.slice(0, 3).map((l, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                              <div>
                                <span className="font-mono font-bold text-indigo-700">{l.lot_no}</span>
                                <span className="text-[10px] text-slate-500 block">{l.supplier_name}</span>
                              </div>
                              <span className="font-mono font-bold text-emerald-700">{Number(l.available_qty || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GODOWN-WISE STOCK TABLE */}
              {activeTab === 'godowns' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs animate-fadeIn">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      Section 3 — Godown-wise Stock Breakdown
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {godowns.length} location{godowns.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Godown Location</th>
                          <th className="px-4 py-3 text-right">Total Stock</th>
                          <th className="px-4 py-3 text-right">Available Qty</th>
                          <th className="px-4 py-3 text-right">Reserved Qty</th>
                          <th className="px-4 py-3 text-right">Hold Qty</th>
                          <th className="px-4 py-3 text-right">Valuation (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {godowns.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No godown inventory recorded for this item.
                            </td>
                          </tr>
                        ) : (
                          godowns.map((g, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900 flex items-center space-x-2">
                                <MapPinIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                <span>{g.godown_name || 'Main Godown'}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                                {Number(g.total_stock || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-extrabold text-blue-700">
                                {Number(g.available_qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-700">
                                {Number(g.reserved_qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-700">
                                {Number(g.hold_qty || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                ₹{Number(g.valuation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: LOT-WISE STOCK */}
              {activeTab === 'lots' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs animate-fadeIn">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      Section 4 — Lot-wise Stock Register
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {lots.length} active lot{lots.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Lot No.</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Inward Date</th>
                          <th className="px-4 py-3">Godown</th>
                          <th className="px-4 py-3 text-right">Available Qty</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {lots.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No active lots found for this item.
                            </td>
                          </tr>
                        ) : (
                          lots.map((l, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                                {l.lot_no}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {l.supplier_name || 'Primary Supplier'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {l.inward_date || '—'}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {l.godown_name || 'Main Godown'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-extrabold text-blue-700">
                                {Number(l.available_qty || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{item.unit || 'Bags'}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  String(l.status).toLowerCase() === 'active'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {l.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: PURCHASE DETAILS */}
              {activeTab === 'purchases' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs animate-fadeIn">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      Section 5 — Purchase & Inward Transaction Details
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {purchases.length} purchase record{purchases.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Purchase No.</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Lot No.</th>
                          <th className="px-4 py-3 text-right">Quantity</th>
                          <th className="px-4 py-3 text-right">Rate (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {purchases.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No purchase transaction records found for this item.
                            </td>
                          </tr>
                        ) : (
                          purchases.map((p, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.date || '—'}</td>
                              <td className="px-4 py-3 font-mono font-bold text-blue-700">{p.purchase_no || '—'}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{p.supplier_name || 'Primary Supplier'}</td>
                              <td className="px-4 py-3 font-mono text-indigo-700">{p.lot_no || '—'}</td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                +{Number(p.quantity || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                                ₹{Number(p.rate || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: STOCK MOVEMENT HISTORY */}
              {activeTab === 'movements' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs animate-fadeIn">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      Section 6 — Stock Movement & Audit Trail History
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {movements.length} transaction{movements.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Transaction Type</th>
                          <th className="px-4 py-3">Reference No.</th>
                          <th className="px-4 py-3">Lot No.</th>
                          <th className="px-4 py-3">Godown</th>
                          <th className="px-4 py-3 text-right">Inward</th>
                          <th className="px-4 py-3 text-right">Outward</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {movements.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                              No stock movement records found.
                            </td>
                          </tr>
                        ) : (
                          movements.map((m, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{m.date || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  m.inward_qty > 0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {m.type || 'Movement'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-medium text-slate-800">{m.reference_no || '—'}</td>
                              <td className="px-4 py-3 font-mono text-indigo-700">{m.lot_no || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{m.godown_name || 'Main Godown'}</td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                {m.inward_qty > 0 ? `+${m.inward_qty}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-rose-700">
                                {m.outward_qty > 0 ? `-${m.outward_qty}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                                {Number(m.balance || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: QUALITY DETAILS */}
              {activeTab === 'quality' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs animate-fadeIn p-5 space-y-4">
                  <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      Section 7 — Quality Control & Inspection Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium block">QC Status</span>
                      <span className="text-sm font-bold text-emerald-700 mt-1 block font-mono">
                        {quality.qc_status || 'ACCEPTED (PASS)'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium block">QC Hold Quantity</span>
                      <span className="text-sm font-bold text-amber-700 mt-1 block font-mono">
                        {Number(quality.qc_hold_qty || 0).toLocaleString()} {item.unit || 'Bags'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium block">Rejected Quantity</span>
                      <span className="text-sm font-bold text-rose-700 mt-1 block font-mono">
                        {Number(quality.rejected_qty || 0).toLocaleString()} {item.unit || 'Bags'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium block">Released / Approved Quantity</span>
                      <span className="text-sm font-bold text-blue-700 mt-1 block font-mono">
                        {Number(quality.released_qty || summary.availableStock || 0).toLocaleString()} {item.unit || 'Bags'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 sm:col-span-2">
                      <span className="text-slate-500 font-medium block">Quality Reference / Certificate</span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                        {quality.qc_reference || 'QC-LAB-CERT-2026'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            BVC ERP Live Inventory & Traceability Audit System
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
