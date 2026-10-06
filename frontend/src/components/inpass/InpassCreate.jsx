import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FactCheckIcon from '@mui/icons-material/FactCheck';

const OUTPUT_TYPES = [
  { value: 'PROCESSED_OUTPUT', label: 'Processed Output (Finished Good)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'BYPRODUCT', label: 'By-product (Broken/Bran/Husk)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'PROCESS_LOSS', label: 'Process Loss (Normal Grinding Loss)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'REJECTED', label: 'Rejected (Quality Rejection)', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { value: 'SHORTAGE', label: 'Shortage / Transit Loss', color: 'text-purple-700 bg-purple-50 border-purple-200' }
];

const InpassCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const outpassIdParam = searchParams.get('outpass_id') || searchParams.get('outpass');
  const grindIdParam = searchParams.get('grind_id');

  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    inpass_no: '',
    date: today,
    outpass_id: '',
    outpass_no: '',
    reference_type: 'Grind',
    reference_id: '',
    reference_no: '',
    party_id: '',
    party_name: '',
    vehicle_no: '',
    driver_name: '',
    received_by: 'Admin',
    to_godown_id: 1,
    to_godown_name: 'PJ Main Factory Godown',
    qc_required: true,
    qc_status: 'QC_PENDING',
    processing_charge_per_kg: '',
    discrepancy_reason: '',
    remarks: ''
  });

  const [pendingOutpasses, setPendingOutpasses] = useState([]);
  const [selectedOutpassData, setSelectedOutpassData] = useState(null);
  const [itemsMasterList, setItemsMasterList] = useState([]);
  const [godownsList, setGodownsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const [items, setItems] = useState([
    {
      item_name: 'Processed Flour / Rice',
      original_item_name: '',
      original_lot_no: '',
      lot_no: '',
      output_type: 'PROCESSED_OUTPUT',
      qty: '',
      weight: '50',
      total_weight: 0,
      uom: 'KG',
      rate: '',
      amount: 0,
      qc_status: 'PASS',
      godown_id: 1,
      godown_name: 'PJ',
      remarks: 'External Mill Processed Output'
    }
  ]);

  // Initial data loading
  useEffect(() => {
    // 1. Fetch next Inpass No
    api('/inpasses/next-no')
      .then(res => {
        if (res?.inpass_no) {
          setFormData(prev => ({ ...prev, inpass_no: res.inpass_no }));
        }
      })
      .catch(err => console.error('Error fetching inpass next-no:', err));

    // 2. Fetch Pending Outpasses
    api('/outpasses/pending-return')
      .then(res => {
        if (res?.success) {
          setPendingOutpasses(res.data || []);
        }
      })
      .catch(err => console.error('Error fetching pending outpasses:', err));

    // 3. Fetch Items Master
    api('/masters/items')
      .then(res => {
        if (Array.isArray(res)) setItemsMasterList(res);
        else if (res?.data && Array.isArray(res.data)) setItemsMasterList(res.data);
      })
      .catch(() => {});

    // 4. Fetch Godowns
    api('/masters/godowns')
      .then(res => {
        if (Array.isArray(res)) setGodownsList(res);
        else if (res?.data && Array.isArray(res.data)) setGodownsList(res.data);
      })
      .catch(() => {});
  }, []);

  // When outpassIdParam is present, auto-select that outpass
  useEffect(() => {
    if (outpassIdParam) {
      api(`/outpasses/${outpassIdParam}`)
        .then(res => {
          if (res?.success && res.data) {
            applyOutpassData(res.data);
          }
        })
        .catch(err => console.error('Error loading outpass by param:', err));
    }
  }, [outpassIdParam]);

  // Pre-load from Grind if grind_id param given
  useEffect(() => {
    if (grindIdParam && !outpassIdParam) {
      api(`/grains/${grindIdParam}`)
        .then(g => {
          if (g && g.outpass_id) {
            api(`/outpasses/${g.outpass_id}`).then(res => {
              if (res?.success && res.data) applyOutpassData(res.data);
            });
          }
        })
        .catch(() => {});
    }
  }, [grindIdParam, outpassIdParam]);

  // Apply selected Outpass details
  const applyOutpassData = (op) => {
    if (!op) return;
    setSelectedOutpassData(op);

    const firstItem = (op.items && op.items[0]) || {};
    const inputWeight = parseFloat(op.total_weight) || 0;
    const ratePerKg = op.processing_rate_kg ? String(op.processing_rate_kg) : '';

    setFormData(prev => ({
      ...prev,
      outpass_id: op.id,
      outpass_no: op.outpass_no,
      reference_type: op.reference_type || 'Grind',
      reference_id: op.reference_id || '',
      reference_no: op.reference_no || '',
      party_name: op.party_name || '',
      vehicle_no: op.vehicle_no || prev.vehicle_no,
      driver_name: op.driver_name || prev.driver_name,
      processing_charge_per_kg: ratePerKg || prev.processing_charge_per_kg,
      remarks: `Received against Outpass #${op.outpass_no} (${op.party_name || 'Outside Mill'})`
    }));

    // Pre-populate recommended output split:
    // 1. Processed Output (e.g. 94% yield)
    // 2. By-product (e.g. 4% yield)
    // 3. Process Loss (e.g. 2% yield)
    const estOutputKg = inputWeight > 0 ? Number((inputWeight * 0.94).toFixed(2)) : 0;
    const estByproductKg = inputWeight > 0 ? Number((inputWeight * 0.04).toFixed(2)) : 0;
    const estLossKg = inputWeight > 0 ? Number((inputWeight * 0.02).toFixed(2)) : 0;

    const opItemName = firstItem.item_name || 'RM Grain';
    const opLotNo = firstItem.lot_no || '';

    setItems([
      {
        item_name: `Processed ${opItemName.replace(/RM\s*|Raw\s*/gi, '').trim() || 'Flour'}`,
        original_item_name: opItemName,
        original_lot_no: opLotNo,
        lot_no: '',
        output_type: 'PROCESSED_OUTPUT',
        qty: estOutputKg > 0 ? String(Math.round(estOutputKg / 50)) : '19',
        weight: '50',
        total_weight: estOutputKg > 0 ? estOutputKg : 950,
        uom: 'KG',
        rate: '',
        amount: 0,
        qc_status: 'PASS',
        godown_id: 1,
        godown_name: 'PJ',
        remarks: 'Main Processed Yield'
      },
      {
        item_name: `${opItemName.replace(/RM\s*|Raw\s*/gi, '').trim()} By-product / Broken`,
        original_item_name: opItemName,
        original_lot_no: opLotNo,
        lot_no: '',
        output_type: 'BYPRODUCT',
        qty: estByproductKg > 0 ? String(Math.max(1, Math.round(estByproductKg / 50))) : '1',
        weight: '40',
        total_weight: estByproductKg > 0 ? estByproductKg : 40,
        uom: 'KG',
        rate: '',
        amount: 0,
        qc_status: 'PASS',
        godown_id: 1,
        godown_name: 'PJ',
        remarks: 'External Mill By-product'
      },
      {
        item_name: 'Grinding Process Loss',
        original_item_name: opItemName,
        original_lot_no: opLotNo,
        lot_no: '-',
        output_type: 'PROCESS_LOSS',
        qty: '1',
        weight: String(estLossKg || 10),
        total_weight: estLossKg > 0 ? estLossKg : 10,
        uom: 'KG',
        rate: '0',
        amount: 0,
        qc_status: 'PASS',
        godown_id: 1,
        godown_name: 'PJ',
        remarks: 'External Processing Loss'
      }
    ]);
  };

  const handleOutpassSelect = (e) => {
    const opId = e.target.value;
    if (!opId) {
      setSelectedOutpassData(null);
      setFormData(prev => ({ ...prev, outpass_id: '', outpass_no: '' }));
      return;
    }
    const matched = pendingOutpasses.find(op => String(op.id) === String(opId));
    if (matched) {
      applyOutpassData(matched);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      const q = parseFloat(updated[index].qty) || 0;
      const w = parseFloat(updated[index].weight) || 50;
      const r = parseFloat(updated[index].rate) || 0;

      if (field === 'total_weight') {
        updated[index].total_weight = parseFloat(value) || 0;
      } else {
        updated[index].total_weight = Number((q * w).toFixed(2));
      }
      updated[index].amount = Number((q * r).toFixed(2));

      return updated;
    });
  };

  const addRow = () => {
    setItems(prev => [
      ...prev,
      {
        item_name: '',
        original_item_name: selectedOutpassData?.items?.[0]?.item_name || '',
        original_lot_no: selectedOutpassData?.items?.[0]?.lot_no || '',
        lot_no: '',
        output_type: 'PROCESSED_OUTPUT',
        qty: '',
        weight: '50',
        total_weight: 0,
        uom: 'KG',
        rate: '',
        amount: 0,
        qc_status: 'PASS',
        godown_id: 1,
        godown_name: 'PJ',
        remarks: ''
      }
    ]);
  };

  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Mass Balance & Processing Calculations
  const inputWeight = selectedOutpassData ? (parseFloat(selectedOutpassData.total_weight) || 0) : 1000;

  const outputWeight = items
    .filter(it => it.output_type === 'PROCESSED_OUTPUT')
    .reduce((s, it) => s + (parseFloat(it.total_weight) || 0), 0);

  const byproductWeight = items
    .filter(it => it.output_type === 'BYPRODUCT')
    .reduce((s, it) => s + (parseFloat(it.total_weight) || 0), 0);

  const lossWeight = items
    .filter(it => it.output_type === 'PROCESS_LOSS' || it.output_type === 'SHORTAGE' || it.output_type === 'REJECTED')
    .reduce((s, it) => s + (parseFloat(it.total_weight) || 0), 0);

  const totalAccountedWeight = outputWeight + byproductWeight + lossWeight;
  const discrepancyWeight = Number(Math.max(0, inputWeight - totalAccountedWeight).toFixed(2));
  const hasDiscrepancy = discrepancyWeight > 1.0; // 1 kg tolerance

  const yieldPercent = inputWeight > 0 ? Number(((outputWeight / inputWeight) * 100).toFixed(2)) : 0;
  const lossPercent = inputWeight > 0 ? Number((((lossWeight + discrepancyWeight) / inputWeight) * 100).toFixed(2)) : 0;

  const chargeRate = parseFloat(formData.processing_charge_per_kg) || 0;
  const totalProcessingCharges = Number((outputWeight * chargeRate).toFixed(2));

  const handleSave = async (andPrint = false) => {
    const validItems = items.filter(it => it.item_name && (parseFloat(it.total_weight) > 0 || parseFloat(it.qty) > 0));
    if (validItems.length === 0) {
      setMessage('Please enter at least one valid output item.');
      setMessageType('error');
      return;
    }

    if (hasDiscrepancy && (!formData.discrepancy_reason || formData.discrepancy_reason.trim() === '')) {
      setMessage(`Mass Balance Alert: There is an unaccounted shortage of ${discrepancyWeight} KG. Please state the discrepancy reason before saving.`);
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        formData: {
          ...formData,
          input_weight: inputWeight,
          output_weight: outputWeight,
          byproduct_weight: byproductWeight,
          loss_weight: lossWeight,
          discrepancy_weight: discrepancyWeight,
          yield_percent: yieldPercent,
          loss_percent: lossPercent,
          total_processing_charges: totalProcessingCharges
        },
        items: validItems
      };

      const res = await api('/inpasses', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setMessage(res.message || 'Inpass recorded and processed material received into factory stock successfully!');
        setMessageType('success');

        if (andPrint) {
          triggerPrintReceiptNote({
            ...payload.formData,
            inpass_no: res.data?.inpass_no || formData.inpass_no,
            items: validItems
          });
        }

        setTimeout(() => {
          navigate('/entry/inpass-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error recording inpass');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error recording inpass:', err);
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const triggerPrintReceiptNote = (data) => {
    const rowsHtml = (data.items || []).map((it, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e293b;">${it.item_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; text-transform: uppercase;">${it.output_type}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${it.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${it.qty || 0}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #047857;">${(parseFloat(it.total_weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;"><span style="color: #047857; font-weight: bold;">${it.qc_status || 'PASS'}</span></td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 850px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #047857; font-size: 24px; text-transform: uppercase;">BHARANI VEL CHEMICALS / BVC AGRO</h1>
          <p style="margin: 3px 0; font-size: 13px; color: #475569;">Factory Inward Goods Receipt • External Mill Return System</p>
          <div style="display: inline-block; background: #047857; color: #ffffff; padding: 4px 18px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 6px; letter-spacing: 1px;">
            MATERIAL INPASS / PROCESSED GOODS INWARD NOTE
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px;">
          <div>
            <p style="margin: 3px 0;"><strong>Inpass No:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #047857;">${data.inpass_no}</span></p>
            <p style="margin: 3px 0;"><strong>Date:</strong> ${data.date}</p>
            <p style="margin: 3px 0;"><strong>Ref Outpass:</strong> <span style="font-family: monospace; font-weight: bold; color: #2563eb;">${data.outpass_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Ref Module:</strong> ${data.reference_type} (${data.reference_no || 'N/A'})</p>
          </div>
          <div>
            <p style="margin: 3px 0;"><strong>External Mill / Party:</strong> <strong>${data.party_name}</strong></p>
            <p style="margin: 3px 0;"><strong>Vehicle No:</strong> <span style="font-family: monospace; font-weight: bold;">${data.vehicle_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Received By:</strong> ${data.received_by || 'Admin'}</p>
            <p style="margin: 3px 0;"><strong>Receiving Godown:</strong> ${data.to_godown_name || 'PJ Main Godown'}</p>
          </div>
        </div>

        <!-- Mass Balance Summary Box -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 13px; text-transform: uppercase;">Mass-Balance & Yield Verification</h4>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div><span style="color: #64748b;">Dispatched Input:</span> <strong style="display: block; font-size: 14px;">${inputWeight.toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">Processed FG:</span> <strong style="display: block; font-size: 14px; color: #047857;">${outputWeight.toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">By-product:</span> <strong style="display: block; font-size: 14px; color: #2563eb;">${byproductWeight.toFixed(2)} kg</strong></div>
            <div><span style="color: #64748b;">Yield Ratio:</span> <strong style="display: block; font-size: 14px; color: #047857;">${yieldPercent}%</strong></div>
          </div>
          ${discrepancyWeight > 0 ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #b91c1c;">
              <strong>Unaccounted Shortage:</strong> ${discrepancyWeight} kg — <em>Reason: ${data.discrepancy_reason || 'N/A'}</em>
            </div>
          ` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #047857; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Received Material</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Output Category</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Allocated Lot</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 60px;">Bags</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Weight (kg)</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 70px;">QC Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${totalProcessingCharges > 0 ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between;">
            <span><strong>Processing Fee Rate:</strong> ₹${chargeRate}/kg</span>
            <span><strong>Total Processing Charges Payable:</strong> ₹${totalProcessingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; margin-top: 40px;">
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Security Gate Inward</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">QC Verification Officer</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Godown In-Charge Receipt</div>
        </div>
      </div>
    `;

    printHtml(html);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/entry/inpass-display')}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Back to Inpass List"
          >
            <ArrowBackIcon />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CallReceivedIcon className="text-emerald-600" />
              Receive Material Gate Inpass
            </h1>
            <p className="text-xs text-slate-500">
              Receive processed goods from external mill, validate mass-balance, and credit factory stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/entry/inpass-display')}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Inpass Register
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <PrintIcon fontSize="small" /> Save & Print Goods Note
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <SaveIcon fontSize="small" /> Receive Into Stock
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${
          messageType === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message}
        </div>
      )}

      {/* Mass-Balance Validation Card */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <FactCheckIcon className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Mass-Balance & Processing Validation
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Yield %:</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              {yieldPercent}%
            </span>
            <span className="text-xs font-semibold text-slate-500 ml-2">Loss %:</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
              {lossPercent}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-50 border rounded-lg p-3">
            <span className="text-slate-500 block">Outpass Dispatched RM</span>
            <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">{inputWeight.toFixed(2)} KG</span>
            <span className="text-[11px] text-slate-400">100% Dispatched</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <span className="text-emerald-700 block font-medium">Processed Output FG</span>
            <span className="text-lg font-extrabold text-emerald-900 mt-0.5 block">{outputWeight.toFixed(2)} KG</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{yieldPercent}% Recovery</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="text-blue-700 block font-medium">By-product Received</span>
            <span className="text-lg font-extrabold text-blue-900 mt-0.5 block">{byproductWeight.toFixed(2)} KG</span>
            <span className="text-[11px] text-blue-600 font-semibold">Broken / Bran</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <span className="text-amber-700 block font-medium">Process Loss Accounted</span>
            <span className="text-lg font-extrabold text-amber-900 mt-0.5 block">{lossWeight.toFixed(2)} KG</span>
            <span className="text-[11px] text-amber-600 font-semibold">Grinding loss</span>
          </div>

          <div className={`p-3 rounded-lg border ${
            hasDiscrepancy
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <span className="block font-medium">
              {hasDiscrepancy ? 'Mass Discrepancy' : 'Balance Status'}
            </span>
            <span className="text-lg font-extrabold mt-0.5 block">
              {hasDiscrepancy ? `${discrepancyWeight} KG` : 'Balanced'}
            </span>
            <span className="text-[11px] font-semibold">
              {hasDiscrepancy ? 'Unaccounted Shortage' : 'Input = Output + Loss'}
            </span>
          </div>
        </div>

        {hasDiscrepancy && (
          <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex items-start gap-3 text-xs text-rose-900">
            <WarningAmberIcon className="text-rose-600 mt-0.5 flex-shrink-0" fontSize="small" />
            <div className="flex-1 space-y-1">
              <span className="font-bold">Mass-Balance Discrepancy Warning ({discrepancyWeight} KG):</span>
              <p>
                The returned material ({totalAccountedWeight.toFixed(2)} KG) is less than the outpassed input ({inputWeight.toFixed(2)} KG).
                A mandatory discrepancy reason / mill explanation is required.
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  name="discrepancy_reason"
                  value={formData.discrepancy_reason}
                  onChange={handleFormChange}
                  placeholder="Enter reason for shortage (e.g. Excessive moisture loss, transit dust loss, or mill spill)"
                  className="w-full px-3 py-1.5 border border-rose-300 rounded bg-white font-medium text-rose-900 focus:outline-rose-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inpass Header Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">
          Receipt Details & Outpass Link
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inpass No</label>
            <input
              type="text"
              name="inpass_no"
              value={formData.inpass_no}
              onChange={handleFormChange}
              placeholder="IP-00001"
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 font-mono font-bold text-emerald-700 focus:outline-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Receipt Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Reference Outpass *</label>
            <select
              value={formData.outpass_id}
              onChange={handleOutpassSelect}
              className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-blue-800 focus:outline-emerald-500"
            >
              <option value="">-- Select Dispatched Outpass --</option>
              {pendingOutpasses.map(op => (
                <option key={op.id} value={op.id}>
                  {op.outpass_no} • {op.party_name} ({op.total_weight} KG, Pending: {op.pending_weight || op.total_weight} KG)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">External Mill / Party</label>
            <input
              type="text"
              name="party_name"
              value={formData.party_name}
              onChange={handleFormChange}
              placeholder="External Mill Name"
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Receiving Godown</label>
            <select
              name="to_godown_id"
              value={formData.to_godown_id}
              onChange={(e) => {
                const sel = godownsList.find(g => String(g.id) === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  to_godown_id: e.target.value,
                  to_godown_name: sel ? sel.godown_name : prev.to_godown_name
                }));
              }}
              className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-emerald-500"
            >
              <option value="1">PJ Main Factory Godown</option>
              <option value="2">Cold Storage Godown</option>
              {godownsList.map(g => (
                <option key={g.id} value={g.id}>{g.godown_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
            <input
              type="text"
              name="vehicle_no"
              value={formData.vehicle_no}
              onChange={handleFormChange}
              placeholder="TN-01-AB-1234"
              className="w-full px-3 py-2 border rounded-lg font-mono focus:outline-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Processing Rate (₹ / KG)</label>
            <input
              type="number"
              step="0.01"
              name="processing_charge_per_kg"
              value={formData.processing_charge_per_kg}
              onChange={handleFormChange}
              placeholder="e.g. 3.00"
              className="w-full px-3 py-2 border rounded-lg font-bold text-indigo-700 focus:outline-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleFormChange}
              placeholder="Notes on return condition, packing, or test result"
              className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="qc_required"
              name="qc_required"
              checked={formData.qc_required}
              onChange={handleFormChange}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <label htmlFor="qc_required" className="font-semibold text-slate-800">
              QC Inspection Required
            </label>
          </div>
        </div>
      </div>

      {/* Received Items Table */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Received Output, By-Products & Loss Breakdown
          </h2>
          <button
            type="button"
            onClick={addRow}
            className="text-xs px-2.5 py-1.5 font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition"
          >
            <AddCircleOutlineIcon fontSize="small" /> Add Output Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 min-w-[200px]">Item Description *</th>
                <th className="p-2.5 min-w-[170px]">Output Classification *</th>
                <th className="p-2.5 min-w-[120px]">Allocated Lot No</th>
                <th className="p-2.5 w-24 text-right">Quantity (Bags)</th>
                <th className="p-2.5 w-24 text-right">Unit Wt (kg)</th>
                <th className="p-2.5 w-28 text-right">Total Wt (kg)</th>
                <th className="p-2.5 w-24 text-center">QC Status</th>
                <th className="p-2.5 min-w-[120px]">Godown</th>
                <th className="p-2.5 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="p-2.5 text-center font-medium text-slate-400">{idx + 1}</td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      list={`inpass-items-${idx}`}
                      value={row.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      placeholder="e.g. Processed Flour"
                      className="w-full px-2 py-1.5 border rounded focus:outline-emerald-500 font-semibold text-slate-800"
                    />
                    <datalist id={`inpass-items-${idx}`}>
                      {itemsMasterList.map((m, i) => (
                        <option key={i} value={m.item_name} />
                      ))}
                    </datalist>
                  </td>
                  <td className="p-2.5">
                    <select
                      value={row.output_type}
                      onChange={(e) => handleItemChange(idx, 'output_type', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded bg-white font-semibold text-slate-700 focus:outline-emerald-500"
                    >
                      {OUTPUT_TYPES.map(ot => (
                        <option key={ot.value} value={ot.value}>{ot.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={row.lot_no}
                      onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                      placeholder="Auto-Allocated"
                      className="w-full px-2 py-1.5 border rounded font-mono focus:outline-emerald-500"
                    />
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="any"
                      value={row.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border rounded text-right font-bold focus:outline-emerald-500"
                    />
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="any"
                      value={row.weight}
                      onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                      placeholder="50"
                      className="w-full px-2 py-1.5 border rounded text-right focus:outline-emerald-500"
                    />
                  </td>
                  <td className="p-2.5 text-right font-bold text-emerald-800">
                    <input
                      type="number"
                      step="any"
                      value={row.total_weight}
                      onChange={(e) => handleItemChange(idx, 'total_weight', e.target.value)}
                      className="w-24 px-1.5 py-1.5 border rounded text-right font-bold text-emerald-800 focus:outline-emerald-500"
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <select
                      value={row.qc_status}
                      onChange={(e) => handleItemChange(idx, 'qc_status', e.target.value)}
                      className="px-2 py-1 border rounded bg-white text-xs font-bold text-emerald-700"
                    >
                      <option value="PASS">PASS</option>
                      <option value="PENDING">PENDING</option>
                      <option value="REJECT">REJECT</option>
                    </select>
                  </td>
                  <td className="p-2.5">
                    <select
                      value={row.godown_id}
                      onChange={(e) => {
                        const sel = godownsList.find(g => String(g.id) === e.target.value);
                        handleItemChange(idx, 'godown_id', e.target.value);
                        if (sel) handleItemChange(idx, 'godown_name', sel.godown_name);
                      }}
                      className="w-full px-2 py-1.5 border rounded bg-white text-xs"
                    >
                      <option value="1">PJ Main Godown</option>
                      <option value="2">Cold Storage Godown</option>
                      {godownsList.map(g => (
                        <option key={g.id} value={g.id}>{g.godown_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={items.length <= 1}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                      title="Remove row"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Charges Calculation */}
        {totalProcessingCharges > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3.5 flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-indigo-900 block">External Processing Charges:</span>
              <span className="text-slate-600">
                {outputWeight.toFixed(2)} KG Processed Output × ₹{chargeRate}/KG
              </span>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-indigo-900">
                ₹{totalProcessingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500 block">Payable to {formData.party_name || 'Mill'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InpassCreate;
