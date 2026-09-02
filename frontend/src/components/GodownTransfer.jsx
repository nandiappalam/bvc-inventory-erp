import React, { useState, useEffect } from 'react';
import {
  CompareArrows as TransferIcon,
  Refresh as RefreshIcon,
  AddCircleOutline as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  GetApp as ExportIcon,
  Business as GodownIcon,
  Inventory as ItemIcon
} from '@mui/icons-material';
import { printHtml } from '../utils/printHelper';

const GodownTransfer = () => {
  const [godowns, setGodowns] = useState([]);
  const [godownItems, setGodownItems] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form State
  const [formData, setFormData] = useState({
    s_no: 'TRF-1',
    transfer_date: new Date().toISOString().split('T')[0],
    from_godown_id: '',
    from_godown_name: '',
    to_godown_id: '',
    to_godown_name: '',
    item_name: '',
    lot_no: '',
    qty: '',
    weight: '',
    remarks: ''
  });

  const fetchNextSNo = async () => {
    try {
      const res = await fetch('/api/godown-transfers/next-sno');
      const data = await res.json();
      if (data && data.next_s_no) {
        setFormData(prev => ({ ...prev, s_no: data.next_s_no }));
      }
    } catch (e) {
      console.error('Error fetching next transfer s_no:', e);
    }
  };

  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  // Fetch Godown Master List
  useEffect(() => {
    fetch('/api/masters/godown_master')
      .then(res => res.json())
      .then(result => {
        const list = Array.isArray(result) ? result : (result.data || []);
        if (Array.isArray(list)) {
          setGodowns(list);
        }
      })
      .catch(err => console.error('Error fetching godown master:', err));

    fetchTransfers();
    fetchNextSNo();
  }, []);

  // Fetch all transfer entries
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/godown-transfers');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (Array.isArray(list)) {
        setTransfers(list);
      }
    } catch (err) {
      console.error('Error fetching godown transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle From Godown Change
  const handleFromGodownChange = async (godownId) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    const gName = selectedG ? selectedG.godown_name : '';

    setFormData(prev => ({
      ...prev,
      from_godown_id: godownId,
      from_godown_name: gName,
      item_name: '',
      lot_no: '',
      qty: '',
      weight: ''
    }));

    setSelectedItemDetails(null);

    if (!godownId) {
      setGodownItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await fetch(`/api/godown-transfers/godown-items/${godownId}`);
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setGodownItems(data.items);
      } else {
        setGodownItems([]);
      }
    } catch (err) {
      console.error('Error fetching items for godown:', err);
      setGodownItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle Item Select
  const handleItemChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setFormData(prev => ({ ...prev, item_name: '', lot_no: '', qty: '', weight: '' }));
      setSelectedItemDetails(null);
      return;
    }

    // val is stringified item object or item_name|lot_no
    const [iName, lNo] = val.split('||');
    const matched = godownItems.find(i => i.item_name === iName && i.lot_no === lNo);

    if (matched) {
      setSelectedItemDetails(matched);
      setFormData(prev => ({
        ...prev,
        item_name: matched.item_name,
        lot_no: matched.lot_no || 'LOT-GENERAL',
        qty: matched.balance_qty || 1,
        weight: (matched.balance_qty * (matched.unit_weight || 1)) || 1
      }));
    } else {
      setFormData(prev => ({ ...prev, item_name: val }));
    }
  };

  // Handle To Godown Select
  const handleToGodownChange = (godownId) => {
    const selectedG = godowns.find(g => String(g.id) === String(godownId));
    setFormData(prev => ({
      ...prev,
      to_godown_id: godownId,
      to_godown_name: selectedG ? selectedG.godown_name : ''
    }));
  };

  // Handle Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.from_godown_id || !formData.to_godown_id) {
      setMessage({ type: 'error', text: 'Please select both From Godown and To Godown' });
      return;
    }

    if (formData.from_godown_id === formData.to_godown_id) {
      setMessage({ type: 'error', text: 'From Godown and To Godown cannot be the same' });
      return;
    }

    if (!formData.item_name) {
      setMessage({ type: 'error', text: 'Please select an item to transfer' });
      return;
    }

    if (!formData.qty || parseFloat(formData.qty) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid transfer quantity' });
      return;
    }

    try {
      const res = await fetch('/api/godown-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Godown transfer recorded successfully!' });
        // Reset form
        setFormData({
          s_no: '',
          transfer_date: new Date().toISOString().split('T')[0],
          from_godown_id: '',
          from_godown_name: '',
          to_godown_id: '',
          to_godown_name: '',
          item_name: '',
          lot_no: '',
          qty: '',
          weight: '',
          remarks: ''
        });
        fetchNextSNo();
        setGodownItems([]);
        setSelectedItemDetails(null);
        fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Error recording transfer' });
      }
    } catch (err) {
      console.error('Error submitting godown transfer:', err);
      setMessage({ type: 'error', text: 'Network error recording transfer' });
    }
  };

  // Handle Delete Transfer
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transfer entry?')) return;

    try {
      const res = await fetch(`/api/godown-transfers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Transfer entry deleted successfully' });
        fetchTransfers();
      }
    } catch (err) {
      console.error('Error deleting transfer:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'S.No,Transfer Date,From Godown,To Godown,Item Name,Lot No,Quantity,Weight (Kg),Remarks\n';
    transfers.forEach(t => {
      csv += `"${t.s_no}","${t.transfer_date}","${t.from_godown_name}","${t.to_godown_name}","${t.item_name}","${t.lot_no}",${t.qty},${t.weight},"${t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Godown_Transfers_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
  };

  // Print List
  const handlePrint = () => {
    let printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; color: #1e3a8a; margin-bottom: 5px;">Godown to Godown Transfer Register</h2>
        <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">Generated on: ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">S.No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Date</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">From Godown</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">To Godown</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Lot No</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Qty</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Weight (Kg)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Remarks</th>
            </tr>
          </thead>
          <tbody>
    `;

    transfers.forEach((t, idx) => {
      printContent += `
        <tr>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${t.s_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.transfer_date}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold;">${t.from_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: bold; color: #2563eb;">${t.to_godown_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.item_name}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.lot_no}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${t.qty}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">${t.weight}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${t.remarks || '-'}</td>
        </tr>
      `;
    });

    printContent += `
          </tbody>
        </table>
      </div>
    `;

    printHtml(printContent, 'Godown_Transfers_Report');
  };

  const filteredTransfers = transfers.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      (t.s_no || '').toLowerCase().includes(term) ||
      (t.from_godown_name || '').toLowerCase().includes(term) ||
      (t.to_godown_name || '').toLowerCase().includes(term) ||
      (t.item_name || '').toLowerCase().includes(term) ||
      (t.lot_no || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <TransferIcon className="text-blue-600 w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-800">Godown to Godown Item Transfer</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">Transfer items and stock lots seamlessly between different Godown storage locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransfers}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
          >
            <ExportIcon className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <PrintIcon className="w-4 h-4" />
            Print Register
          </button>
        </div>
      </div>

      {/* Message Toast */}
      {message.text && (
        <div className={`p-4 rounded-xl border font-medium text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Entry Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <AddIcon className="text-blue-600" />
          Create New Stock Transfer Entry
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* S.No */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Transfer S.No</label>
              <input
                type="text"
                value={formData.s_no}
                onChange={(e) => setFormData(prev => ({ ...prev, s_no: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Transfer Date</label>
              <input
                type="date"
                value={formData.transfer_date}
                onChange={(e) => setFormData(prev => ({ ...prev, transfer_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* From Godown */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">From Godown (Source)</label>
              <select
                value={formData.from_godown_id}
                onChange={(e) => handleFromGodownChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                required
              >
                <option value="">-- Select Source Godown --</option>
                {godowns.map(g => (
                  <option key={g.id} value={g.id}>
                    📍 {g.godown_name} ({g.area || 'Factory'})
                  </option>
                ))}
              </select>
            </div>

            {/* To Godown */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">To Godown (Destination)</label>
              <select
                value={formData.to_godown_id}
                onChange={(e) => handleToGodownChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                required
              >
                <option value="">-- Select Destination Godown --</option>
                {godowns
                  .filter(g => String(g.id) !== String(formData.from_godown_id))
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      🚚 {g.godown_name} ({g.area || 'Storage'})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Item Dropdown */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Select Item from {formData.from_godown_name || 'Godown'} {loadingItems ? '(Loading items...)' : ''}
              </label>
              <select
                value={formData.item_name && formData.lot_no ? `${formData.item_name}||${formData.lot_no}` : ''}
                onChange={handleItemChange}
                disabled={!formData.from_godown_id || loadingItems}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold disabled:bg-slate-100 disabled:cursor-not-allowed"
                required
              >
                <option value="">
                  {!formData.from_godown_id 
                    ? '⚠️ Please select From Godown first' 
                    : godownItems.length === 0 
                      ? 'No items found in this Godown' 
                      : '-- Select Item to Transfer --'}
                </option>
                {godownItems.map((item, idx) => (
                  <option key={idx} value={`${item.item_name}||${item.lot_no}`}>
                    📦 {item.item_name} | Lot: {item.lot_no} | Available Qty: {item.balance_qty} | Wt: {item.total_weight} Kg
                  </option>
                ))}
              </select>
            </div>

            {/* Lot No */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Lot / Batch No</label>
              <input
                type="text"
                value={formData.lot_no}
                onChange={(e) => setFormData(prev => ({ ...prev, lot_no: e.target.value }))}
                placeholder="Lot No"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Transfer Quantity</label>
              <input
                type="number"
                step="any"
                value={formData.qty}
                onChange={(e) => setFormData(prev => ({ ...prev, qty: e.target.value }))}
                placeholder="Qty"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Weight */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Transfer Weight (Kg)</label>
              <input
                type="number"
                step="any"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                placeholder="Weight in Kg"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Remarks / Vehicle / Notes</label>
              <input
                type="text"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Driver name or transfer reason"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <TransferIcon className="w-5 h-5" />
                Submit Stock Transfer
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Display Page Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-base">Godown Transfer Entries Register</h3>
          
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter transfers..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 text-center">S.No</th>
                <th className="py-3 px-4">Transfer Date</th>
                <th className="py-3 px-4">From Godown</th>
                <th className="py-3 px-4">To Godown</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Lot No</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Weight (Kg)</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400 italic">
                    No godown transfers recorded yet.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{item.s_no}</td>
                    <td className="py-3 px-4">{item.transfer_date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.from_godown_name}</td>
                    <td className="py-3 px-4 font-semibold text-blue-700">{item.to_godown_name}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{item.item_name}</td>
                    <td className="py-3 px-4 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded inline-block my-2">{item.lot_no}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{item.qty}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{item.weight}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{item.remarks || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete transfer"
                      >
                        <DeleteIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GodownTransfer;
