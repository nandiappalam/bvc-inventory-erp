import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import RefreshIcon from '@mui/icons-material/Refresh';
import FactoryIcon from '@mui/icons-material/Factory';
import PrintIcon from '@mui/icons-material/Print';
import { printHtml } from '../../utils/printHelper';

const OutsideProcessingReport = () => {
  const navigate = useNavigate();
  const [outpasses, setOutpasses] = useState([]);
  const [inpasses, setInpasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [opRes, ipRes] = await Promise.all([
        api('/outpasses'),
        api('/inpasses')
      ]);
      if (opRes?.success) setOutpasses(opRes.data || []);
      if (ipRes?.success) setInpasses(ipRes.data || []);
    } catch (e) {
      console.error('Error fetching outside processing report data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Mill-wise Aggregations
  const millStats = {};
  outpasses.forEach(op => {
    const mill = op.party_name || 'Other Outside Mill';
    if (!millStats[mill]) {
      millStats[mill] = {
        mill_name: mill,
        total_outpasses: 0,
        dispatched_kg: 0,
        returned_kg: 0,
        pending_kg: 0,
        charges: 0,
        outpasses_list: []
      };
    }
    const dis = parseFloat(op.total_weight) || 0;
    const ret = parseFloat(op.returned_weight) || 0;
    const pen = Math.max(0, dis - ret);
    const chg = parseFloat(op.estimated_charges) || 0;

    millStats[mill].total_outpasses += 1;
    millStats[mill].dispatched_kg += dis;
    millStats[mill].returned_kg += ret;
    millStats[mill].pending_kg += pen;
    millStats[mill].charges += chg;
    millStats[mill].outpasses_list.push(op);
  });

  const millList = Object.values(millStats);
  const totalDispatched = millList.reduce((s, m) => s + m.dispatched_kg, 0);
  const totalReturned = millList.reduce((s, m) => s + m.returned_kg, 0);
  const totalPending = millList.reduce((s, m) => s + m.pending_kg, 0);
  const totalCharges = millList.reduce((s, m) => s + m.charges, 0);
  const overallYield = totalDispatched > 0 ? ((totalReturned / totalDispatched) * 100).toFixed(1) : 0;

  const handlePrintReport = () => {
    const rows = millList.map((m, i) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${m.mill_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${m.total_outpasses}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #1e3a8a;">${m.dispatched_kg.toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #047857;">${m.returned_kg.toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: ${m.pending_kg > 0 ? '#b45309' : '#64748b'};">${m.pending_kg.toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${m.dispatched_kg > 0 ? ((m.returned_kg / m.dispatched_kg) * 100).toFixed(1) : 0}%</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">₹${m.charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 900px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 22px;">BHARANI VEL CHEMICALS / BVC AGRO</h1>
          <p style="margin: 3px 0; font-size: 13px; color: #475569;">External Mill Outside Processing & Custody Audit Report</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">#</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Mill / Processor</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Outpasses</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Dispatched</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Returned</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Pending Outside</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Yield %</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Processing Charges</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">TOTAL:</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #1e3a8a;">${totalDispatched.toFixed(2)} kg</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #047857;">${totalReturned.toFixed(2)} kg</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #b45309;">${totalPending.toFixed(2)} kg</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${overallYield}%</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printHtml(html);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AssessmentIcon className="text-indigo-600" />
            Outside Processing & Mill Custody Report
          </h1>
          <p className="text-xs text-slate-500">
            Real-time material custody, external mill processing performance, and recovery yield audit
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/entry/outpass-display')}
            className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition flex items-center gap-1"
          >
            <LocalShippingIcon fontSize="small" /> Outpass Register
          </button>
          <button
            type="button"
            onClick={() => navigate('/entry/inpass-display')}
            className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1"
          >
            <CallReceivedIcon fontSize="small" /> Inpass Receipts
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
          >
            <PrintIcon fontSize="small" /> Print Report
          </button>
          <button
            type="button"
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Refresh"
          >
            <RefreshIcon fontSize="small" />
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 block">Total Material Dispatched</span>
          <span className="text-2xl font-extrabold text-blue-700 mt-1 block">
            {totalDispatched.toFixed(0)} <span className="text-sm font-semibold">KG</span>
          </span>
          <span className="text-[11px] text-slate-400">Total outpassed weight</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 block">Processed Material Returned</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {totalReturned.toFixed(0)} <span className="text-sm font-semibold">KG</span>
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">{overallYield}% Overall Yield</span>
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs font-medium text-amber-800 block">Pending at External Mills</span>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block">
            {totalPending.toFixed(0)} <span className="text-sm font-semibold">KG</span>
          </span>
          <span className="text-[11px] text-amber-700 font-bold">Outside Processing Stock</span>
        </div>

        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 shadow-sm">
          <span className="text-xs font-medium text-indigo-800 block">Total Processing Charges</span>
          <span className="text-2xl font-extrabold text-indigo-900 mt-1 block">
            ₹{totalCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-indigo-700 font-semibold">Contractor fees</span>
        </div>
      </div>

      {/* Mill Performance Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <FactoryIcon fontSize="small" className="text-blue-600" />
            Mill-Wise Processing & Recovery Performance
          </h2>
          <span className="text-xs text-slate-500 font-semibold">{millList.length} External Mills</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 min-w-[200px]">External Mill Name</th>
                <th className="p-3 text-center">Total Outpasses</th>
                <th className="p-3 text-right">Dispatched Input</th>
                <th className="p-3 text-right">Returned Output</th>
                <th className="p-3 text-right">Pending at Mill</th>
                <th className="p-3 text-right">Recovery Yield %</th>
                <th className="p-3 text-right">Est. Charges</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    Loading outside processing audit data...
                  </td>
                </tr>
              ) : millList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    No outside processing records registered yet.
                  </td>
                </tr>
              ) : (
                millList.map((m, idx) => {
                  const yieldPct = m.dispatched_kg > 0 ? ((m.returned_kg / m.dispatched_kg) * 100).toFixed(1) : 0;
                  const isPending = m.pending_kg > 0.5;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-center font-medium text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{m.mill_name}</td>
                      <td className="p-3 text-center font-semibold text-slate-700">{m.total_outpasses}</td>
                      <td className="p-3 text-right font-bold text-blue-900 whitespace-nowrap">
                        {m.dispatched_kg.toFixed(2)} kg
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-800 whitespace-nowrap">
                        {m.returned_kg.toFixed(2)} kg
                      </td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">
                        <span className={isPending ? 'text-amber-700 font-extrabold' : 'text-slate-400'}>
                          {m.pending_kg.toFixed(2)} kg
                        </span>
                      </td>
                      <td className="p-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                        {yieldPct}%
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-900 whitespace-nowrap">
                        ₹{m.charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {isPending ? 'PROCESSING AT MILL' : 'ALL RETURNED'}
                        </span>
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
  );
};

export default OutsideProcessingReport;
