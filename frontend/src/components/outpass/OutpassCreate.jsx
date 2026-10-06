import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { printHtml } from '../../utils/printHelper';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FactoryIcon from '@mui/icons-material/Factory';

const PURPOSES = [
  'Outside Processing',
  'Job Work',
  'Repair',
  'Maintenance',
  'Sample',
  'Customer Return',
  'Supplier Return',
  'Transfer',
  'Other'
];

const ITEM_TYPES = [
  'RM',
  'WIP',
  'Processed Material',
  'FG',
  'Packaging Material',
  'Spare',
  'Equipment',
  'Sample',
  'Other'
];

const REFERENCE_TYPES = [
  'Grind',
  'Purchase',
  'Papad',
  'Sales',
  'Work Order',
  'Maintenance',
  'Sample',
  'Direct / General'
];

const OutpassCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refTypeParam = searchParams.get('ref_type') || searchParams.get('reference_type');
  const refIdParam = searchParams.get('ref_id') || searchParams.get('reference_id');
  const grindIdParam = searchParams.get('grind_id');

  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    outpass_no: '',
    date: today,
    purpose: 'Outside Processing',
    item_type: 'RM',
    reference_type: refTypeParam || (grindIdParam ? 'Grind' : 'Grind'),
    reference_id: refIdParam || grindIdParam || '',
    reference_no: '',
    party_type: 'Flour Mill',
    party_id: '',
    party_name: '',
    from_location: 'Inside Factory (Main Godown)',
    from_godown_id: 1,
    from_godown_name: 'PJ Main Godown',
    destination: '',
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    transporter: '',
    expected_return_date: '',
    processing_rate_kg: '',
    remarks: ''
  });

  const [items, setItems] = useState([
    {
      item_name: '',
      lot_no: '',
      qty: '',
      weight: '50',
      total_weight: 0,
      uom: 'KG',
      rate: '',
      amount: 0,
      godown_id: 1,
      godown_name: 'PJ',
      reason: 'Outside Processing Grinding'
    }
  ]);

  const [millsList, setMillsList] = useState([]);
  const [itemsMasterList, setItemsMasterList] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [godownsList, setGodownsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Load next outpass number & master lists
  useEffect(() => {
    // 1. Fetch next Outpass No
    api('/outpasses/next-no')
      .then(res => {
        if (res?.outpass_no) {
          setFormData(prev => ({ ...prev, outpass_no: res.outpass_no }));
        }
      })
      .catch(err => console.error('Error fetching next outpass no:', err));

    // 2. Fetch Flour Mills Master
    api('/masters/flour-mills')
      .then(res => {
        if (Array.isArray(res)) setMillsList(res);
        else if (res?.data && Array.isArray(res.data)) setMillsList(res.data);
      })
      .catch(() => {});

    // 3. Fetch Items Master
    api('/masters/items')
      .then(res => {
        if (Array.isArray(res)) setItemsMasterList(res);
        else if (res?.data && Array.isArray(res.data)) setItemsMasterList(res.data);
      })
      .catch(() => {});

    // 4. Fetch Available Stock Lots
    api('/stock/lots')
      .then(res => {
        if (Array.isArray(res)) setAvailableLots(res);
        else if (res?.data && Array.isArray(res.data)) setAvailableLots(res.data);
      })
      .catch(() => {});

    // 5. Fetch Godowns
    api('/masters/godowns')
      .then(res => {
        if (Array.isArray(res)) setGodownsList(res);
        else if (res?.data && Array.isArray(res.data)) setGodownsList(res.data);
      })
      .catch(() => {});
  }, []);

  // Pre-fill from Grind if referenced
  useEffect(() => {
    const targetGrindId = grindIdParam || (refTypeParam === 'Grind' ? refIdParam : null);
    if (targetGrindId) {
      setLoading(true);
      api(`/grains/${targetGrindId}`)
        .then(g => {
          if (g && g.id) {
            setFormData(prev => ({
              ...prev,
              reference_type: 'Grind',
              reference_id: g.id,
              reference_no: `GRIND-${g.s_no || g.id}`,
              party_name: g.external_mill_name || g.flour_mill || prev.party_name,
              destination: g.external_mill_name || g.flour_mill || prev.destination,
              processing_rate_kg: g.processing_charge_per_kg ? String(g.processing_charge_per_kg) : prev.processing_rate_kg,
              remarks: `Dispatched against Grind #${g.s_no || g.id}${g.remarks ? ' - ' + g.remarks : ''}`
            }));

            // Pre-fill items from Grind input items
            if (g.inputItems && g.inputItems.length > 0) {
              const prefilled = g.inputItems.map(it => ({
                item_name: it.itemName || it.item_name || '',
                lot_no: it.lotNo || it.lot_no || '',
                qty: String(it.qty || ''),
                weight: String(it.weight || 50),
                total_weight: parseFloat(it.totalWt || it.total_wt) || (parseFloat(it.qty || 0) * parseFloat(it.weight || 50)),
                uom: 'KG',
                rate: String(it.rate || 0),
                amount: (parseFloat(it.qty || 0) * parseFloat(it.rate || 0)),
                godown_id: 1,
                godown_name: 'PJ',
                reason: 'Outside Processing Grinding'
              }));
              setItems(prefilled);
            }
          }
        })
        .catch(err => console.error('Error pre-filling grind for outpass:', err))
        .finally(() => setLoading(false));
    }
  }, [grindIdParam, refIdParam, refTypeParam]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'party_name' && !prev.destination) {
        updated.destination = value;
      }
      return updated;
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'item_name') {
        // Auto-match lots for this item
        const matching = availableLots.find(l => (l.item_name || '').toLowerCase() === (value || '').toLowerCase() && (parseFloat(l.remaining_quantity) > 0));
        if (matching) {
          updated[index].lot_no = matching.lot_no;
          updated[index].weight = String(matching.weight || 50);
          updated[index].qty = String(matching.remaining_quantity || '');
          updated[index].rate = String(matching.rate || '');
        }
      }

      if (field === 'lot_no') {
        const matchingLot = availableLots.find(l => l.lot_no === value);
        if (matchingLot) {
          if (!updated[index].item_name) updated[index].item_name = matchingLot.item_name;
          updated[index].weight = String(matchingLot.weight || 50);
          updated[index].qty = String(matchingLot.remaining_quantity || '');
          updated[index].rate = String(matchingLot.rate || '');
        }
      }

      const q = parseFloat(updated[index].qty) || 0;
      const w = parseFloat(updated[index].weight) || 50;
      const r = parseFloat(updated[index].rate) || 0;

      updated[index].total_weight = Number((q * w).toFixed(2));
      updated[index].amount = Number((q * r).toFixed(2));

      return updated;
    });
  };

  const addRow = () => {
    setItems(prev => [
      ...prev,
      {
        item_name: '',
        lot_no: '',
        qty: '',
        weight: '50',
        total_weight: 0,
        uom: 'KG',
        rate: '',
        amount: 0,
        godown_id: 1,
        godown_name: 'PJ',
        reason: 'Outside Processing'
      }
    ]);
  };

  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalQty = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
  const totalWeight = items.reduce((s, it) => s + (parseFloat(it.total_weight) || 0), 0);
  const processingRate = parseFloat(formData.processing_rate_kg) || 0;
  const estimatedCharges = Number((totalWeight * processingRate).toFixed(2));

  const handleSave = async (andPrint = false) => {
    const validItems = items.filter(it => it.item_name && parseFloat(it.qty) > 0);
    if (validItems.length === 0) {
      setMessage('Please enter at least one valid item with quantity.');
      setMessageType('error');
      return;
    }

    if (!formData.party_name) {
      setMessage('Please enter or select the Party / Mill name.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        formData: {
          ...formData,
          total_qty: totalQty,
          total_weight: totalWeight,
          estimated_charges: estimatedCharges
        },
        items: validItems
      };

      const res = await api('/outpasses', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setMessage(res.message || 'Outpass issued successfully!');
        setMessageType('success');

        if (andPrint) {
          triggerPrintGatePass({
            ...payload.formData,
            outpass_no: res.data?.outpass_no || formData.outpass_no,
            items: validItems
          });
        }

        setTimeout(() => {
          navigate('/entry/outpass-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving Outpass');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error creating outpass:', err);
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const triggerPrintGatePass = (data) => {
    const rowsHtml = (data.items || []).map((it, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e293b;">${it.item_name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${it.lot_no || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${it.qty}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${it.weight} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #1e3a8a;">${(parseFloat(it.total_weight) || 0).toFixed(2)} kg</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${it.reason || 'Outside Processing'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 850px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase;">BHARANI VEL CHEMICALS / BVC AGRO</h1>
          <p style="margin: 3px 0; font-size: 13px; color: #475569;">Factory & Works • Material Movement Control System</p>
          <div style="display: inline-block; background: #1e3a8a; color: #ffffff; padding: 4px 18px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 6px; letter-spacing: 1px;">
            MATERIAL GATE OUTPASS (DELIVERY CHALLAN)
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px;">
          <div>
            <p style="margin: 3px 0;"><strong>Outpass No:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #1e3a8a;">${data.outpass_no}</span></p>
            <p style="margin: 3px 0;"><strong>Date:</strong> ${data.date}</p>
            <p style="margin: 3px 0;"><strong>Purpose:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${data.purpose}</span></p>
            <p style="margin: 3px 0;"><strong>Reference:</strong> ${data.reference_type} (${data.reference_no || 'N/A'})</p>
            <p style="margin: 3px 0;"><strong>From Location:</strong> ${data.from_location}</p>
          </div>
          <div>
            <p style="margin: 3px 0;"><strong>External Mill / Party:</strong> <strong style="color: #0f172a;">${data.party_name}</strong></p>
            <p style="margin: 3px 0;"><strong>Destination:</strong> ${data.destination || '-'}</p>
            <p style="margin: 3px 0;"><strong>Vehicle No:</strong> <span style="font-family: monospace; font-weight: bold;">${data.vehicle_no || 'N/A'}</span></p>
            <p style="margin: 3px 0;"><strong>Driver:</strong> ${data.driver_name || '-'} ${data.driver_phone ? `(${data.driver_phone})` : ''}</p>
            <p style="margin: 3px 0;"><strong>Transporter:</strong> ${data.transporter || 'Self / Own'}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">S.No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Item Description</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Lot / Batch No</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 70px;">Quantity</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 70px;">Unit Wt</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">Total Weight</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Process Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">TOTAL:</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${totalQty}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;"></td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #1e3a8a; font-size: 14px;">${totalWeight.toFixed(2)} kg</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;"></td>
            </tr>
          </tfoot>
        </table>

        ${processingRate > 0 ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between;">
            <span><strong>Processing Rate Agreed:</strong> ₹${processingRate}/kg</span>
            <span><strong>Estimated Processing Charges:</strong> ₹${estimatedCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ` : ''}

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #1e40af; margin-bottom: 25px;">
          <strong>Custody Declaration:</strong> This material is moving out of the factory premises strictly for external processing / jobwork. Ownership remains with BVC Agro. Processed output and by-products shall be returned with corresponding Inpass.
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center; font-size: 11px; margin-top: 35px;">
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Prepared By</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Factory In-Charge</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Security Gate Out</div>
          <div style="border-top: 1px solid #64748b; padding-top: 5px;">Driver / Receiver Signature</div>
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
            onClick={() => navigate('/entry/outpass-display')}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Back to Outpass List"
          >
            <ArrowBackIcon />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <LocalShippingIcon className="text-blue-600" />
              Issue Material Gate Outpass
            </h1>
            <p className="text-xs text-slate-500">
              Universal material outward dispatch for outside mill grinding, jobwork, repair, or movement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/entry/outpass-display')}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Outpass Register
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <PrintIcon fontSize="small" /> Save & Print Gate Pass
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <SaveIcon fontSize="small" /> Save Outpass
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

      {/* Custody Rule Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-3.5 rounded-r-lg flex items-start gap-3 text-xs text-blue-900">
        <InfoOutlinedIcon className="text-blue-600 flex-shrink-0 mt-0.5" fontSize="small" />
        <div>
          <span className="font-bold">Inventory Custody Tracking:</span> Material dispatched via Outpass is <strong>not consumed</strong>.
          It moves from <em>Factory Available Stock</em> to <em>Outside Processing Stock</em>. Physical ownership is preserved until the processed output returns via <strong>Inpass</strong>.
        </div>
      </div>

      {/* Basic Information Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2 flex items-center gap-2">
          <FactoryIcon fontSize="small" className="text-blue-600" /> Outpass Movement Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Outpass No</label>
            <input
              type="text"
              name="outpass_no"
              value={formData.outpass_no}
              onChange={handleFormChange}
              placeholder="OP-00001"
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 font-mono font-bold text-blue-700 focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dispatch Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Purpose *</label>
            <select
              name="purpose"
              value={formData.purpose}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-blue-500 font-medium"
            >
              {PURPOSES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Item Category</label>
            <select
              name="item_type"
              value={formData.item_type}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-blue-500 font-medium"
            >
              {ITEM_TYPES.map(it => (
                <option key={it} value={it}>{it}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reference Module</label>
            <select
              name="reference_type"
              value={formData.reference_type}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-blue-500 font-medium"
            >
              {REFERENCE_TYPES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reference Doc / Grind No</label>
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleFormChange}
              placeholder="e.g. GRIND-00045 / PO-12"
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">External Mill / Party Name *</label>
            <div className="relative">
              <input
                type="text"
                name="party_name"
                list="mill-suggestions"
                value={formData.party_name}
                onChange={handleFormChange}
                placeholder="Select or enter external mill / party"
                className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500 font-semibold text-slate-800"
              />
              <datalist id="mill-suggestions">
                {millsList.map((m, idx) => (
                  <option key={idx} value={m.flourmill || m.name || m.mill_name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Destination Location</label>
            <input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleFormChange}
              placeholder="External mill premises / city"
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
            <input
              type="text"
              name="vehicle_no"
              value={formData.vehicle_no}
              onChange={handleFormChange}
              placeholder="TN-01-AB-1234"
              className="w-full px-3 py-2 border rounded-lg font-mono focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Driver Name & Phone</label>
            <div className="grid grid-cols-2 gap-1">
              <input
                type="text"
                name="driver_name"
                value={formData.driver_name}
                onChange={handleFormChange}
                placeholder="Driver Name"
                className="w-full px-2 py-2 border rounded-lg focus:outline-blue-500"
              />
              <input
                type="text"
                name="driver_phone"
                value={formData.driver_phone}
                onChange={handleFormChange}
                placeholder="Mobile No"
                className="w-full px-2 py-2 border rounded-lg focus:outline-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
            <input
              type="text"
              name="transporter"
              value={formData.transporter}
              onChange={handleFormChange}
              placeholder="Transporter Name / Own"
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Expected Return Date</label>
            <input
              type="date"
              name="expected_return_date"
              value={formData.expected_return_date}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Processing Rate (₹ / KG)</label>
            <input
              type="number"
              step="0.01"
              name="processing_rate_kg"
              value={formData.processing_rate_kg}
              onChange={handleFormChange}
              placeholder="e.g. 3.00"
              className="w-full px-3 py-2 border rounded-lg font-bold text-indigo-700 focus:outline-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">Remarks / Special Instructions</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleFormChange}
              placeholder="e.g. Fine grinding required, sortex by-product return"
              className="w-full px-3 py-2 border rounded-lg focus:outline-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Dispatched Items Table */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Dispatched Material / Items
          </h2>
          <button
            type="button"
            onClick={addRow}
            className="text-xs px-2.5 py-1.5 font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition"
          >
            <AddCircleOutlineIcon fontSize="small" /> Add Item Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 min-w-[200px]">Item Name *</th>
                <th className="p-2.5 min-w-[130px]">Lot / Batch No</th>
                <th className="p-2.5 w-24 text-right">Quantity (Bags)</th>
                <th className="p-2.5 w-24 text-right">Unit Wt (kg)</th>
                <th className="p-2.5 w-28 text-right">Total Wt (kg)</th>
                <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                <th className="p-2.5 w-28 text-right">Amount (₹)</th>
                <th className="p-2.5 min-w-[120px]">From Godown</th>
                <th className="p-2.5 min-w-[140px]">Reason / Process</th>
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
                      list={`items-list-${idx}`}
                      value={row.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      placeholder="Type or select item"
                      className="w-full px-2 py-1.5 border rounded focus:outline-blue-500 font-medium text-slate-800"
                    />
                    <datalist id={`items-list-${idx}`}>
                      {itemsMasterList.map((m, i) => (
                        <option key={i} value={m.item_name} />
                      ))}
                    </datalist>
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      list={`lot-list-${idx}`}
                      value={row.lot_no}
                      onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                      placeholder="Lot No"
                      className="w-full px-2 py-1.5 border rounded font-mono font-medium focus:outline-blue-500"
                    />
                    <datalist id={`lot-list-${idx}`}>
                      {availableLots.filter(l => !row.item_name || (l.item_name || '').toLowerCase() === row.item_name.toLowerCase()).map((l, i) => (
                        <option key={i} value={l.lot_no}>{l.lot_no} (Avail: {l.remaining_quantity} bags)</option>
                      ))}
                    </datalist>
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="any"
                      value={row.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border rounded text-right font-bold focus:outline-blue-500"
                    />
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="any"
                      value={row.weight}
                      onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                      placeholder="50"
                      className="w-full px-2 py-1.5 border rounded text-right focus:outline-blue-500"
                    />
                  </td>
                  <td className="p-2.5 text-right font-bold text-blue-800">
                    {row.total_weight ? `${row.total_weight.toFixed(2)} kg` : '0.00 kg'}
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="any"
                      value={row.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 border rounded text-right focus:outline-blue-500"
                    />
                  </td>
                  <td className="p-2.5 text-right font-semibold text-slate-800">
                    ₹{(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5">
                    <select
                      value={row.godown_id}
                      onChange={(e) => {
                        const sel = godownsList.find(g => String(g.id) === e.target.value);
                        handleItemChange(idx, 'godown_id', e.target.value);
                        if (sel) handleItemChange(idx, 'godown_name', sel.godown_name);
                      }}
                      className="w-full px-2 py-1.5 border rounded bg-white text-xs focus:outline-blue-500"
                    >
                      <option value="1">PJ Main Godown</option>
                      <option value="2">Cold Storage Godown</option>
                      {godownsList.map(g => (
                        <option key={g.id} value={g.id}>{g.godown_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={row.reason}
                      onChange={(e) => handleItemChange(idx, 'reason', e.target.value)}
                      placeholder="Reason / Notes"
                      className="w-full px-2 py-1.5 border rounded focus:outline-blue-500"
                    />
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

        {/* Totals & Fee Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t text-xs">
          <div className="bg-slate-50 border rounded-lg p-3">
            <span className="text-slate-500 block">Total Dispatched Bags</span>
            <span className="text-lg font-bold text-slate-800">{totalQty} Bags</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="text-blue-700 block font-medium">Total Dispatched Weight</span>
            <span className="text-xl font-extrabold text-blue-900">{totalWeight.toFixed(2)} KG</span>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <span className="text-indigo-700 block font-medium">
              Estimated Jobwork Charges {processingRate > 0 ? `(@ ₹${processingRate}/KG)` : ''}
            </span>
            <span className="text-xl font-extrabold text-indigo-900">
              ₹{estimatedCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutpassCreate;
