import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { printOutpassDocument } from '../../utils/movementPrintTemplates';
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
    from_godown_name: 'PJ Main Factory Godown',
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

    // 2. Fetch Flour Mills & Suppliers
    Promise.all([
      api('/masters/flour_mills'),
      api('/masters/suppliers'),
      api('/masters/papad_companies')
    ]).then(([millsRes, suppRes, papadRes]) => {
      const combined = [];
      const seen = new Set();

      const addItems = (list, defaultType) => {
        const arr = Array.isArray(list) ? list : (list?.data && Array.isArray(list.data) ? list.data : []);
        arr.forEach(item => {
          const name = (item.flourmill || item.name || item.supplier_name || item.mill_name || item.print_name || '').trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            combined.push({
              id: item.id || name,
              name: name,
              area: item.area || item.location || '',
              address: item.address || item.address1 || '',
              phone: item.phone || item.mobile || item.mobile1 || item.phone_off || '',
              wages_kg: item.wages_kg || 0,
              type: defaultType
            });
          }
        });
      };

      addItems(millsRes, 'Flour Mill');
      addItems(suppRes, 'Supplier / Vendor');
      addItems(papadRes, 'Papad Company');

      // If empty, add standard default mills
      if (combined.length === 0) {
        combined.push(
          { id: '1', name: 'BVC Flour Mill', area: 'Madurai', wages_kg: 2.5, type: 'Flour Mill' },
          { id: '2', name: 'Sri Amman Modern Mill', area: 'Virudhunagar', wages_kg: 3.0, type: 'Flour Mill' },
          { id: '3', name: 'Standard Mill Unit 2', area: 'Industrial Estate', wages_kg: 2.75, type: 'Flour Mill' }
        );
      }

      setMillsList(combined);
    }).catch(() => {});

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

  // Deduplicated Godowns
  const availableGodowns = godownsList.length > 0
    ? godownsList
    : [
        { id: 1, godown_name: 'PJ Main Factory Godown' },
        { id: 2, godown_name: 'BTS Cold Storage Facility' }
      ];

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'party_name' && !prev.destination) {
        const matched = millsList.find(m => m.name.toLowerCase() === value.trim().toLowerCase());
        if (matched && (matched.area || matched.address)) {
          updated.destination = matched.area || matched.address;
        }
      }
      return updated;
    });
  };

  const handlePartySelect = (selectedName) => {
    const matched = millsList.find(m => m.name.toLowerCase() === selectedName.trim().toLowerCase());
    setFormData(prev => ({
      ...prev,
      party_name: selectedName,
      party_id: matched?.id || '',
      destination: matched && (matched.area || matched.address) ? (matched.area || matched.address) : prev.destination,
      processing_rate_kg: matched && matched.wages_kg ? String(matched.wages_kg) : prev.processing_rate_kg
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const row = { ...copy[index] };

      if (field === 'lot_no') {
        // Clean any datalist helper label that the browser may have inserted
        const cleanLot = value.split(' (')[0].split(' •')[0].split(' -')[0].trim();
        row.lot_no = cleanLot;

        const matchedLot = availableLots.find(l => String(l.lot_no).toLowerCase() === cleanLot.toLowerCase());
        if (matchedLot) {
          if (!row.item_name) row.item_name = matchedLot.item_name || '';
          if (matchedLot.unit_weight || matchedLot.weight) {
            row.weight = String(matchedLot.unit_weight || matchedLot.weight);
          }
          if (matchedLot.rate || matchedLot.cost) {
            row.rate = String(matchedLot.rate || matchedLot.cost);
          }
          if (matchedLot.remaining_quantity && (!row.qty || parseFloat(row.qty) === 0)) {
            row.qty = String(matchedLot.remaining_quantity);
          }
          if (matchedLot.godown_id) {
            row.godown_id = matchedLot.godown_id;
            row.godown_name = matchedLot.godown || matchedLot.godown_name || 'PJ';
          }
        }
      } else {
        row[field] = value;
      }

      if (field === 'item_name') {
        const matchedLot = availableLots.find(l => (l.item_name || '').toLowerCase() === value.toLowerCase());
        if (matchedLot && !row.lot_no) {
          row.lot_no = matchedLot.lot_no;
          if (matchedLot.unit_weight || matchedLot.weight) {
            row.weight = String(matchedLot.unit_weight || matchedLot.weight);
          }
        }
      }

      if (field === 'qty' || field === 'weight' || field === 'rate' || field === 'lot_no') {
        const q = parseFloat(row.qty) || 0;
        const w = parseFloat(row.weight) || 50;
        const r = parseFloat(row.rate) || 0;

        row.total_weight = q * w;
        row.amount = q * r;
      }

      copy[index] = row;
      return copy;
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
        godown_id: formData.from_godown_id || 1,
        godown_name: formData.from_godown_name || 'PJ',
        reason: formData.purpose || 'Outside Processing'
      }
    ]);
  };

  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Computations
  const totalQty = items.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0);
  const totalWeight = items.reduce((acc, it) => acc + (parseFloat(it.total_weight) || 0), 0);
  const totalAmount = items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
  const processingRate = parseFloat(formData.processing_rate_kg) || 0;
  const estimatedCharges = processingRate * totalWeight;

  const handleSave = async (andPrint = false) => {
    if (!formData.party_name) {
      alert('Please select or enter External Mill / Party Name');
      return;
    }

    const validItems = items.filter(it => it.item_name && (parseFloat(it.qty) > 0 || parseFloat(it.total_weight) > 0));
    if (validItems.length === 0) {
      alert('Please enter at least one item with valid name and quantity / weight');
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
          total_amount: totalAmount,
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

        const savedOutpass = {
          ...payload.formData,
          outpass_no: res.data?.outpass_no || formData.outpass_no,
          items: validItems
        };

        if (andPrint) {
          printOutpassDocument(savedOutpass, 'ORIGINAL STORE COPY');
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

  return (
    <div style={{ padding: '16px', background: '#f0f6ff', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <style>{`
        .outpass-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .outpass-grid-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .outpass-grid-4 {
            grid-template-columns: 1fr;
          }
        }
        .outpass-field {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .outpass-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
          height: 18px;
          line-height: 18px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .outpass-input, .outpass-select {
          box-sizing: border-box !important;
          width: 100% !important;
          height: 38px !important;
          padding: 8px 12px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .outpass-input:focus, .outpass-select:focus {
          border-color: #1f4fb2 !important;
          box-shadow: 0 0 0 2px rgba(31, 79, 178, 0.15) !important;
        }
        .col-span-1 { grid-column: span 1; }
        .col-span-2 { grid-column: span 2; }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }
        @media (max-width: 1024px) {
          .col-span-3, .col-span-4 { grid-column: span 2; }
        }
        @media (max-width: 640px) {
          .col-span-1, .col-span-2, .col-span-3, .col-span-4 { grid-column: span 1; }
        }
      `}</style>
      
      {/* Screen Title Header */}
      <div className="screen-title" style={{
        background: 'linear-gradient(135deg, #1f4fb2 0%, #0d9488 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '6px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/entry/outpass-display')}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Back to Outpass List"
          >
            <ArrowBackIcon style={{ fontSize: '22px' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <LocalShippingIcon style={{ fontSize: '24px' }} />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Issue Material Gate Outpass (Delivery Challan)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#1f4fb2', fontWeight: 'bold', padding: '7px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            onClick={() => navigate('/entry/outpass-display')}
          >
            Outpass Register
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#0288d1', color: '#ffffff', fontWeight: 'bold', padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => handleSave(true)}
            disabled={loading}
          >
            <PrintIcon style={{ fontSize: '16px', marginRight: '5px' }} /> Save & Print Gate Pass
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#1976d2', color: '#ffffff', fontWeight: 'bold', padding: '7px 18px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => handleSave(false)}
            disabled={loading}
          >
            <SaveIcon style={{ fontSize: '16px', marginRight: '5px' }} /> Save Outpass
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '4px',
          fontWeight: 600,
          fontSize: '13px',
          backgroundColor: messageType === 'success' ? '#dcfce7' : '#fee2e2',
          color: messageType === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${messageType === 'success' ? '#86efac' : '#fca5a5'}`
        }}>
          {message}
        </div>
      )}

      {/* Custody Rule Banner */}
      <div style={{
        backgroundColor: '#eff6ff',
        borderLeft: '4px solid #1f4fb2',
        border: '1px solid #bfdbfe',
        borderRadius: '6px',
        padding: '10px 14px',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#1e3a8a',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <InfoOutlinedIcon style={{ color: '#1f4fb2', fontSize: '20px', flexShrink: 0 }} />
        <div>
          <strong>Inventory Custody Tracking:</strong> Material dispatched via Outpass is <strong>not consumed</strong>.
          It moves from <em>Factory Available Stock</em> to <em>Outside Processing Stock</em>. Physical ownership is preserved until the processed output returns via <strong>Inpass</strong>.
        </div>
      </div>

      {/* Movement Information Card - Clean 4-Column Aligned Grid */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#1f4fb2',
          borderBottom: '2px solid #1f4fb2',
          paddingBottom: '8px',
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <FactoryIcon style={{ fontSize: '18px' }} />
          <span>1. Outpass Movement & Destination Details</span>
        </div>

        <div className="outpass-grid-4">
          {/* Row 1 */}
          <div className="outpass-field col-span-1">
            <label className="outpass-label">Outpass No</label>
            <input
              type="text"
              name="outpass_no"
              value={formData.outpass_no}
              onChange={handleFormChange}
              placeholder="OP-00001"
              className="outpass-input"
              style={{
                backgroundColor: '#f8fafc !important',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#1f4fb2 !important'
              }}
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Dispatch Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleFormChange}
              className="outpass-input"
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Purpose / Movement Mode *</label>
            <select
              name="purpose"
              value={formData.purpose}
              onChange={handleFormChange}
              className="outpass-select"
              style={{ fontWeight: 600 }}
            >
              {PURPOSES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Item Category</label>
            <select
              name="item_type"
              value={formData.item_type}
              onChange={handleFormChange}
              className="outpass-select"
              style={{ fontWeight: 600 }}
            >
              {ITEM_TYPES.map(it => (
                <option key={it} value={it}>{it}</option>
              ))}
            </select>
          </div>

          {/* Row 2 */}
          <div className="outpass-field col-span-1">
            <label className="outpass-label">Reference Module</label>
            <select
              name="reference_type"
              value={formData.reference_type}
              onChange={handleFormChange}
              className="outpass-select"
              style={{ fontWeight: 600 }}
            >
              {REFERENCE_TYPES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Reference Doc / Grind No</label>
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleFormChange}
              placeholder="e.g. GRIND-00045 / PO-12"
              className="outpass-input"
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label" style={{ color: '#1e40af' }}>External Mill / Party Name *</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                name="party_name"
                list="mill-suggestions"
                value={formData.party_name}
                onChange={(e) => handlePartySelect(e.target.value)}
                placeholder="Select or enter external mill"
                className="outpass-input"
                style={{
                  border: '1.5px solid #1f4fb2 !important',
                  fontWeight: 'bold',
                  color: '#0f172a !important'
                }}
              />
              <datalist id="mill-suggestions">
                {millsList.map((m, idx) => (
                  <option key={idx} value={m.name} label={`${m.name} (${m.area || m.type || 'Mill'})`} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Destination Location / City</label>
            <input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleFormChange}
              placeholder="External mill premises / area"
              className="outpass-input"
            />
          </div>

          {/* Row 3 */}
          <div className="outpass-field col-span-1">
            <label className="outpass-label">From Dispatch Godown</label>
            <select
              name="from_godown_id"
              value={String(formData.from_godown_id || '1')}
              onChange={(e) => {
                const gId = e.target.value;
                const sel = availableGodowns.find(g => String(g.id) === String(gId));
                setFormData(prev => ({
                  ...prev,
                  from_godown_id: gId,
                  from_godown_name: sel ? (sel.print_name || sel.godown_name) : prev.from_godown_name
                }));
              }}
              className="outpass-select"
            >
              {availableGodowns.map(g => (
                <option key={g.id} value={String(g.id)}>
                  {g.print_name || g.godown_name}
                </option>
              ))}
            </select>
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Vehicle No</label>
            <input
              type="text"
              name="vehicle_no"
              value={formData.vehicle_no}
              onChange={handleFormChange}
              placeholder="TN-01-AB-1234"
              className="outpass-input"
              style={{
                fontFamily: 'monospace',
                fontWeight: 'bold'
              }}
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Driver Name</label>
            <input
              type="text"
              name="driver_name"
              value={formData.driver_name}
              onChange={handleFormChange}
              placeholder="Driver Name"
              className="outpass-input"
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Driver Mobile No</label>
            <input
              type="text"
              name="driver_phone"
              value={formData.driver_phone}
              onChange={handleFormChange}
              placeholder="Mobile No (10 digits)"
              className="outpass-input"
            />
          </div>

          {/* Row 4 */}
          <div className="outpass-field col-span-1">
            <label className="outpass-label">Transporter Name</label>
            <input
              type="text"
              name="transporter"
              value={formData.transporter}
              onChange={handleFormChange}
              placeholder="Transporter Name / Own"
              className="outpass-input"
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Expected Return Date</label>
            <input
              type="date"
              name="expected_return_date"
              value={formData.expected_return_date}
              onChange={handleFormChange}
              className="outpass-input"
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Agreed Processing Rate (₹ / KG)</label>
            <input
              type="number"
              step="0.01"
              name="processing_rate_kg"
              value={formData.processing_rate_kg}
              onChange={handleFormChange}
              placeholder="e.g. 3.00"
              className="outpass-input"
              style={{
                fontWeight: 'bold',
                color: '#1f4fb2 !important'
              }}
            />
          </div>

          <div className="outpass-field col-span-1">
            <label className="outpass-label">Remarks / Special Instructions</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleFormChange}
              placeholder="e.g. Fine grinding, sortex return expected"
              className="outpass-input"
            />
          </div>
        </div>
      </div>

      {/* Dispatched Items Section Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #1f4fb2',
          paddingBottom: '8px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f4fb2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            2. Dispatched Material & Item Breakdown
          </span>
          <button
            type="button"
            onClick={addRow}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: '#eff6ff',
              color: '#1f4fb2',
              border: '1px solid #bfdbfe',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AddCircleOutlineIcon style={{ fontSize: '16px' }} /> Add Item Row
          </button>
        </div>

        {/* Table Container */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#1f4fb2', color: '#ffffff' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', minWidth: '180px' }}>Item Name *</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '140px' }}>Lot / Batch No</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '100px' }}>Bags (Qty)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '90px' }}>Unit Wt (kg)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '120px' }}>Total Weight</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '110px' }}>Amount (₹)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '150px' }}>From Godown</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', minWidth: '150px' }}>Reason / Process</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', width: '50px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                    {idx + 1}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="text"
                      list={`items-list-${idx}`}
                      value={row.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      placeholder="Type or select item"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        color: '#0f172a'
                      }}
                    />
                    <datalist id={`items-list-${idx}`}>
                      {itemsMasterList.map((m, i) => (
                        <option key={i} value={m.item_name || m.name} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="text"
                      list={`lot-list-${idx}`}
                      value={row.lot_no}
                      onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                      placeholder="Lot No"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}
                    />
                    <datalist id={`lot-list-${idx}`}>
                      {availableLots
                        .filter(l => !row.item_name || (l.item_name || '').toLowerCase() === row.item_name.toLowerCase())
                        .map((l, i) => (
                          <option key={i} value={l.lot_no} label={`${l.lot_no} • ${l.remaining_quantity} bags (${l.godown || 'Main Godown'})`} />
                        ))}
                    </datalist>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="number"
                      step="any"
                      value={row.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      placeholder="0"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        textAlign: 'right',
                        fontWeight: 'bold'
                      }}
                    />
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="number"
                      step="any"
                      value={row.weight}
                      onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                      placeholder="50"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#1f4fb2', fontSize: '13px' }}>
                    {row.total_weight ? `${row.total_weight.toFixed(2)} kg` : '0.00 kg'}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="number"
                      step="any"
                      value={row.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      placeholder="0.00"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                    ₹{(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <select
                      value={String(row.godown_id || '1')}
                      onChange={(e) => {
                        const gid = e.target.value;
                        const sel = availableGodowns.find(g => String(g.id) === String(gid));
                        handleItemChange(idx, 'godown_id', gid);
                        if (sel) handleItemChange(idx, 'godown_name', sel.print_name || sel.godown_name);
                      }}
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '4px 6px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}
                    >
                      {availableGodowns.map(g => (
                        <option key={g.id} value={String(g.id)}>{g.print_name || g.godown_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="text"
                      value={row.reason}
                      onChange={(e) => handleItemChange(idx, 'reason', e.target.value)}
                      placeholder="Process / Reason"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px'
                      }}
                    />
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={items.length <= 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: items.length <= 1 ? '#cbd5e1' : '#dc2626',
                        cursor: items.length <= 1 ? 'not-allowed' : 'pointer'
                      }}
                      title="Remove row"
                    >
                      <DeleteOutlineIcon style={{ fontSize: '18px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '2px solid #1f4fb2'
        }}>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 14px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Dispatched Quantity</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{totalQty} Bags</span>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '10px 14px' }}>
            <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, display: 'block' }}>Total Dispatched Net Weight</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#1f4fb2' }}>
              {totalWeight.toFixed(2)} <span style={{ fontSize: '12px' }}>KG</span>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'normal', marginLeft: '6px' }}>({(totalWeight / 1000).toFixed(3)} MT)</span>
            </span>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '10px 14px' }}>
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, display: 'block' }}>
              Estimated Jobwork Processing Charges {processingRate > 0 ? `(@ ₹${processingRate}/KG)` : ''}
            </span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>
              ₹{estimatedCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutpassCreate;
