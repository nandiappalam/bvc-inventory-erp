import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { printInpassDocument } from '../../utils/movementPrintTemplates';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FactCheckIcon from '@mui/icons-material/FactCheck';

const OUTPUT_TYPES = [
  { value: 'PROCESSED_OUTPUT', label: 'Processed Output (Finished Good)', color: '#166534' },
  { value: 'BYPRODUCT', label: 'By-product (Broken/Bran/Husk)', color: '#0369a1' },
  { value: 'PROCESS_LOSS', label: 'Process Loss (Normal Grinding Loss)', color: '#b45309' },
  { value: 'REJECTED', label: 'Rejected (Quality Rejection)', color: '#991b1b' },
  { value: 'SHORTAGE', label: 'Shortage / Transit Loss', color: '#6b21a8' }
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

  // Fallback godowns deduplication
  const availableGodowns = godownsList.length > 0
    ? godownsList
    : [
        { id: 1, godown_name: 'PJ Main Factory Godown' },
        { id: 2, godown_name: 'BTS Cold Storage Facility' }
      ];

  // Apply selected Outpass details
  const applyOutpassData = (op) => {
    if (!op) return;
    setSelectedOutpassData(op);

    const firstItem = (op.items && op.items[0]) || {};
    const inputWeight = parseFloat(op.total_weight) || 0;
    const ratePerKg = op.processing_rate_kg != null && op.processing_rate_kg !== '' ? String(op.processing_rate_kg) : '';

    setFormData(prev => ({
      ...prev,
      outpass_id: op.id,
      outpass_no: op.outpass_no,
      reference_type: op.reference_type || 'Grind',
      reference_id: op.reference_id || '',
      reference_no: op.reference_no || ('OP-' + op.outpass_no),
      party_id: op.party_id || '',
      party_name: op.party_name || '',
      vehicle_no: op.vehicle_no || prev.vehicle_no,
      driver_name: op.driver_name || prev.driver_name,
      processing_charge_per_kg: ratePerKg || prev.processing_charge_per_kg,
      to_godown_id: op.from_godown_id || prev.to_godown_id || 1,
      to_godown_name: op.from_godown_name || prev.to_godown_name || 'PJ Main Factory Godown',
      remarks: `Received against Outpass #${op.outpass_no} (${op.party_name || 'Outside Mill'})`
    }));

    // Pre-populate recommended output split:
    // 1. Processed Output (94% yield)
    // 2. By-product (4% yield)
    // 3. Process Loss (2% yield)
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
        godown_id: op.from_godown_id || 1,
        godown_name: op.from_godown_name || 'PJ',
        remarks: 'Main Processed Yield'
      },
      {
        item_name: `${opItemName.replace(/RM\s*|Raw\s*/gi, '').trim()} By-product / Broken`,
        original_item_name: opItemName,
        original_lot_no: opLotNo,
        lot_no: '',
        output_type: 'BYPRODUCT',
        qty: estByproductKg > 0 ? String(Math.round(estByproductKg / 50)) : '1',
        weight: '40',
        total_weight: estByproductKg > 0 ? estByproductKg : 40,
        uom: 'KG',
        rate: '',
        amount: 0,
        qc_status: 'PASS',
        godown_id: op.from_godown_id || 1,
        godown_name: op.from_godown_name || 'PJ',
        remarks: 'Mill By-product Recovery'
      },
      {
        item_name: 'Grinding / Milling Loss',
        original_item_name: opItemName,
        original_lot_no: opLotNo,
        lot_no: 'LOSS',
        output_type: 'PROCESS_LOSS',
        qty: '0',
        weight: '0',
        total_weight: estLossKg > 0 ? estLossKg : 10,
        uom: 'KG',
        rate: '0',
        amount: 0,
        qc_status: 'PASS',
        godown_id: op.from_godown_id || 1,
        godown_name: op.from_godown_name || 'PJ',
        remarks: 'Normal Process Loss'
      }
    ]);
  };

  const handleOutpassSelect = (e) => {
    const opId = e.target.value;
    if (!opId) {
      setSelectedOutpassData(null);
      setFormData(prev => ({
        ...prev,
        outpass_id: '',
        outpass_no: '',
        party_name: '',
        vehicle_no: '',
        driver_name: '',
        processing_charge_per_kg: '',
        remarks: ''
      }));
      return;
    }

    // Immediately update outpass_id in formData so select field reflects choice instantly
    setFormData(prev => ({
      ...prev,
      outpass_id: opId
    }));

    const matchedOp = pendingOutpasses.find(op => String(op.id) === String(opId));
    if (matchedOp) {
      applyOutpassData(matchedOp);
      api(`/outpasses/${matchedOp.id}`).then(res => {
        if (res?.success && res.data) {
          applyOutpassData(res.data);
        }
      }).catch(() => {});
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
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };

      if (field === 'qty' || field === 'weight') {
        const q = parseFloat(field === 'qty' ? value : row.qty) || 0;
        const w = parseFloat(field === 'weight' ? value : row.weight) || 50;
        row.total_weight = q * w;
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
        godown_id: formData.to_godown_id || 1,
        godown_name: formData.to_godown_name || 'PJ',
        remarks: ''
      }
    ]);
  };

  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Mass Balance Computations
  const inputWeight = selectedOutpassData ? (parseFloat(selectedOutpassData.total_weight) || 0) : 1000;
  
  const outputWeight = items
    .filter(it => it.output_type === 'PROCESSED_OUTPUT')
    .reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0);

  const byproductWeight = items
    .filter(it => it.output_type === 'BYPRODUCT')
    .reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0);

  const lossWeight = items
    .filter(it => it.output_type === 'PROCESS_LOSS')
    .reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0);

  const totalAccountedWeight = outputWeight + byproductWeight + lossWeight;
  const discrepancyWeight = Number((inputWeight - totalAccountedWeight).toFixed(2));
  const hasDiscrepancy = Math.abs(discrepancyWeight) > 0.05;

  const yieldPercent = inputWeight > 0 ? ((outputWeight / inputWeight) * 100).toFixed(2) : '0.00';
  const lossPercent = inputWeight > 0 ? ((lossWeight / inputWeight) * 100).toFixed(2) : '0.00';

  const totalBags = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
  const totalReceivedWeight = items.reduce((sum, it) => sum + (parseFloat(it.total_weight) || 0), 0);

  const chargeRate = parseFloat(formData.processing_charge_per_kg) || 0;
  const totalProcessingCharges = chargeRate * outputWeight;

  const handleSave = async (andPrint = false) => {
    if (!formData.outpass_id && !formData.outpass_no) {
      if (!window.confirm('No linked Outpass selected. Are you sure you want to issue a standalone Inpass?')) {
        return;
      }
    }

    if (hasDiscrepancy && discrepancyWeight > 0 && !formData.discrepancy_reason) {
      alert(`Mass balance shortfall of ${discrepancyWeight} KG detected!\n\nPlease enter a mandatory discrepancy reason.`);
      return;
    }

    const validItems = items.filter(it => it.item_name && (parseFloat(it.qty) > 0 || parseFloat(it.total_weight) > 0));
    if (validItems.length === 0) {
      alert('Please enter at least one received item row with quantity / weight.');
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
          total_weight: totalReceivedWeight,
          total_qty: totalBags,
          discrepancy_weight: discrepancyWeight,
          yield_percent: yieldPercent,
          total_processing_charges: totalProcessingCharges
        },
        items: validItems
      };

      const res = await api('/inpasses', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setMessage(res.message || 'Inpass created & stock received successfully!');
        setMessageType('success');

        const savedInpass = {
          ...payload.formData,
          inpass_no: res.data?.inpass_no || formData.inpass_no,
          items: validItems
        };

        if (andPrint) {
          printInpassDocument(savedInpass, 'ORIGINAL STORE COPY');
        }

        setTimeout(() => {
          navigate('/entry/inpass-display');
        }, 1200);
      } else {
        setMessage(res?.message || 'Error saving Inpass');
        setMessageType('error');
      }
    } catch (err) {
      console.error('Error creating inpass:', err);
      setMessage('Error: ' + err.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', background: '#f0f6ff', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <style>{`
        .inpass-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .inpass-grid-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .inpass-grid-4 {
            grid-template-columns: 1fr;
          }
        }
        .inpass-field {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .inpass-label {
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
        .inpass-input, .inpass-select {
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
        .inpass-input:focus, .inpass-select:focus {
          border-color: #059669 !important;
          box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15) !important;
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
        background: 'linear-gradient(135deg, #059669 0%, #1f4fb2 100%)',
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
            onClick={() => navigate('/entry/inpass-display')}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Back to Inpass Register"
          >
            <ArrowBackIcon style={{ fontSize: '22px' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <CallReceivedIcon style={{ fontSize: '24px' }} />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Receive Material Gate Inpass (Processed Goods Note)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#ffffff', color: '#059669', fontWeight: 'bold', padding: '7px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            onClick={() => navigate('/entry/inpass-display')}
          >
            Inpass Register
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#0288d1', color: '#ffffff', fontWeight: 'bold', padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => handleSave(true)}
            disabled={loading}
          >
            <PrintIcon style={{ fontSize: '16px', marginRight: '5px' }} /> Save & Print Goods Note
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ backgroundColor: '#059669', color: '#ffffff', fontWeight: 'bold', padding: '7px 18px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => handleSave(false)}
            disabled={loading}
          >
            <SaveIcon style={{ fontSize: '16px', marginRight: '5px' }} /> Receive Into Stock
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

      {/* Mass-Balance KPI Audit Dashboard */}
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
          borderBottom: '2px solid #059669',
          paddingBottom: '8px',
          marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>
            <FactCheckIcon style={{ fontSize: '20px' }} />
            <span>1. Mass-Balance & Processing Yield Audit</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
            <span>Milling Recovery Yield: <strong style={{ color: '#059669', fontSize: '14px' }}>{yieldPercent}%</strong></span>
            <span>Grinding Loss: <strong style={{ color: '#b45309', fontSize: '14px' }}>{lossPercent}%</strong></span>
          </div>
        </div>

        {/* 5 Tiles KPI Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          fontSize: '12px'
        }}>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Dispatched Outpass RM</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '2px', display: 'block' }}>
              {inputWeight.toFixed(2)} <span style={{ fontSize: '12px' }}>KG</span>
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>100.00% Dispatched</span>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '10px' }}>
            <span style={{ color: '#166534', fontWeight: 600, display: 'block' }}>Processed Output FG</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d', marginTop: '2px', display: 'block' }}>
              {outputWeight.toFixed(2)} <span style={{ fontSize: '12px' }}>KG</span>
            </span>
            <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>{yieldPercent}% FG Recovery</span>
          </div>

          <div style={{ background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: '4px', padding: '10px' }}>
            <span style={{ color: '#0369a1', fontWeight: 600, display: 'block' }}>By-product Received</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0288d1', marginTop: '2px', display: 'block' }}>
              {byproductWeight.toFixed(2)} <span style={{ fontSize: '12px' }}>KG</span>
            </span>
            <span style={{ fontSize: '11px', color: '#0288d1' }}>Broken / Bran / Husk</span>
          </div>

          <div style={{ background: '#fffbebfb', border: '1px solid #fde68a', borderRadius: '4px', padding: '10px' }}>
            <span style={{ color: '#b45309', fontWeight: 600, display: 'block' }}>Process Loss Accounted</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706', marginTop: '2px', display: 'block' }}>
              {lossWeight.toFixed(2)} <span style={{ fontSize: '12px' }}>KG</span>
            </span>
            <span style={{ fontSize: '11px', color: '#b45309' }}>Normal Grinding Loss</span>
          </div>

          <div style={{
            background: hasDiscrepancy ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${hasDiscrepancy ? '#fca5a5' : '#86efac'}`,
            borderRadius: '4px',
            padding: '10px'
          }}>
            <span style={{ color: hasDiscrepancy ? '#991b1b' : '#166534', fontWeight: 600, display: 'block' }}>
              {hasDiscrepancy ? 'Mass Discrepancy' : 'Balance Status'}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: hasDiscrepancy ? '#dc2626' : '#15803d', marginTop: '2px', display: 'block' }}>
              {hasDiscrepancy ? `${discrepancyWeight} KG` : '✓ Balanced'}
            </span>
            <span style={{ fontSize: '11px', color: hasDiscrepancy ? '#b91c1c' : '#166534', fontWeight: 600 }}>
              {hasDiscrepancy ? 'Unaccounted Shortage' : 'Input = Output + Loss'}
            </span>
          </div>
        </div>

        {/* Shortage Discrepancy Warning Box */}
        {hasDiscrepancy && (
          <div style={{
            marginTop: '14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            padding: '12px 14px',
            color: '#991b1b',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <WarningAmberIcon style={{ color: '#dc2626', fontSize: '20px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '13px' }}>Mass-Balance Discrepancy Warning ({discrepancyWeight} KG Shortage):</strong>
              <p style={{ margin: '3px 0 8px 0' }}>
                Total returned weight ({totalAccountedWeight.toFixed(2)} KG) is less than the outpassed input ({inputWeight.toFixed(2)} KG).
                A mandatory discrepancy reason / mill explanation is required for approval.
              </p>
              <input
                type="text"
                name="discrepancy_reason"
                value={formData.discrepancy_reason}
                onChange={handleFormChange}
                placeholder="Enter mandatory reason for shortage (e.g. Excessive moisture loss, transit dust loss, or mill spill)"
                className="inpass-input"
                style={{
                  border: '1.5px solid #dc2626 !important',
                  backgroundColor: '#ffffff !important',
                  fontWeight: 'bold',
                  color: '#991b1b !important'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Receipt Details Card - Clean 4-Column Aligned Grid */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#059669',
          borderBottom: '2px solid #059669',
          paddingBottom: '8px',
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          2. Receipt Details & Linked Outpass Information
        </div>

        <div className="inpass-grid-4">
          {/* Row 1 */}
          <div className="inpass-field col-span-1">
            <label className="inpass-label">Inpass No</label>
            <input
              type="text"
              name="inpass_no"
              value={formData.inpass_no}
              onChange={handleFormChange}
              placeholder="IP-00001"
              className="inpass-input"
              style={{
                backgroundColor: '#f8fafc !important',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#059669 !important'
              }}
            />
          </div>

          <div className="inpass-field col-span-1">
            <label className="inpass-label">Receipt Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleFormChange}
              className="inpass-input"
            />
          </div>

          <div className="inpass-field col-span-2">
            <label className="inpass-label" style={{ color: '#1e3a8a' }}>Reference Dispatched Outpass *</label>
            <select
              value={String(formData.outpass_id || '')}
              onChange={handleOutpassSelect}
              className="inpass-select"
              style={{
                border: '1.5px solid #1f4fb2 !important',
                backgroundColor: '#f0f4ff !important',
                fontWeight: 'bold',
                color: '#1e3a8a !important'
              }}
            >
              <option value="">-- Select Dispatched Outpass --</option>
              {pendingOutpasses.map(op => (
                <option key={op.id} value={String(op.id)}>
                  {op.outpass_no} • {op.party_name} ({op.total_weight} KG, Pending: {op.pending_weight || op.total_weight} KG)
                </option>
              ))}
            </select>
          </div>

          {/* Row 2 */}
          <div className="inpass-field col-span-1">
            <label className="inpass-label">External Mill / Party</label>
            <input
              type="text"
              name="party_name"
              value={formData.party_name}
              onChange={handleFormChange}
              placeholder="External Mill Name"
              className="inpass-input"
              style={{
                backgroundColor: '#f8fafc !important',
                fontWeight: 'bold',
                color: '#0f172a !important'
              }}
            />
          </div>

          <div className="inpass-field col-span-1">
            <label className="inpass-label">Receiving Godown</label>
            <select
              name="to_godown_id"
              value={String(formData.to_godown_id || '1')}
              onChange={(e) => {
                const gId = e.target.value;
                const sel = availableGodowns.find(g => String(g.id) === String(gId));
                setFormData(prev => ({
                  ...prev,
                  to_godown_id: gId,
                  to_godown_name: sel ? (sel.print_name || sel.godown_name) : prev.to_godown_name
                }));
              }}
              className="inpass-select"
            >
              {availableGodowns.map(g => (
                <option key={g.id} value={String(g.id)}>
                  {g.print_name || g.godown_name}
                </option>
              ))}
            </select>
          </div>

          <div className="inpass-field col-span-1">
            <label className="inpass-label">Inward Vehicle No</label>
            <input
              type="text"
              name="vehicle_no"
              value={formData.vehicle_no}
              onChange={handleFormChange}
              placeholder="TN-01-AB-1234"
              className="inpass-input"
              style={{
                fontFamily: 'monospace',
                fontWeight: 'bold'
              }}
            />
          </div>

          <div className="inpass-field col-span-1">
            <label className="inpass-label">Processing Rate (₹ / KG)</label>
            <input
              type="number"
              step="0.01"
              name="processing_charge_per_kg"
              value={formData.processing_charge_per_kg}
              onChange={handleFormChange}
              placeholder="e.g. 3.00"
              className="inpass-input"
              style={{
                fontWeight: 'bold',
                color: '#059669 !important'
              }}
            />
          </div>

          {/* Row 3 */}
          <div className="inpass-field col-span-3">
            <label className="inpass-label">Inward Remarks / Quality Notes</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleFormChange}
              placeholder="Notes on return condition, packing, or moisture test result"
              className="inpass-input"
            />
          </div>

          <div className="inpass-field col-span-1">
            <label className="inpass-label" style={{ color: '#059669' }}>Quality Check</label>
            <label style={{
              boxSizing: 'border-box',
              width: '100%',
              height: '38px',
              padding: '0 12px',
              border: '1px solid #a7f3d0',
              borderRadius: '6px',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              margin: 0
            }}>
              <input
                type="checkbox"
                id="qc_required"
                name="qc_required"
                checked={formData.qc_required}
                onChange={handleFormChange}
                style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer', margin: 0 }}
              />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', whiteSpace: 'nowrap' }}>
                QC Inspection Required
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Received Output Breakdown Table */}
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
          borderBottom: '2px solid #059669',
          paddingBottom: '8px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            3. Received Output, By-Products & Loss Breakdown
          </span>
          <button
            type="button"
            onClick={addRow}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AddCircleOutlineIcon style={{ fontSize: '16px' }} /> Add Output Row
          </button>
        </div>

        {/* Table Container */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#059669', color: '#ffffff' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', minWidth: '180px' }}>Item Description *</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '180px' }}>Output Classification *</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '140px' }}>Allocated Lot No</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '100px' }}>Bags (Qty)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '90px' }}>Unit Wt (kg)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', width: '120px' }}>Total Weight</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', width: '95px' }}>QC Status</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '150px' }}>Stock Godown</th>
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
                      list={`inpass-items-${idx}`}
                      value={row.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      placeholder="e.g. Processed Flour"
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
                    <datalist id={`inpass-items-${idx}`}>
                      {itemsMasterList.map((m, i) => (
                        <option key={i} value={m.item_name || m.name} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <select
                      value={row.output_type}
                      onChange={(e) => handleItemChange(idx, 'output_type', e.target.value)}
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '4px 6px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        color: OUTPUT_TYPES.find(o => o.value === row.output_type)?.color || '#0f172a'
                      }}
                    >
                      {OUTPUT_TYPES.map(ot => (
                        <option key={ot.value} value={ot.value}>{ot.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="text"
                      value={row.lot_no}
                      onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                      placeholder="Auto-Allocated"
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
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <input
                      type="number"
                      step="any"
                      value={row.total_weight}
                      onChange={(e) => handleItemChange(idx, 'total_weight', e.target.value)}
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '32px',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#059669',
                        fontSize: '13px'
                      }}
                    />
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                    <select
                      value={row.qc_status}
                      onChange={(e) => handleItemChange(idx, 'qc_status', e.target.value)}
                      style={{
                        boxSizing: 'border-box',
                        height: '32px',
                        padding: '4px 6px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: '#059669'
                      }}
                    >
                      <option value="PASS">PASS</option>
                      <option value="PENDING">PENDING</option>
                      <option value="REJECT">REJECT</option>
                    </select>
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    <select
                      value={String(row.godown_id || '1')}
                      onChange={(e) => {
                        const gid = e.target.value;
                        const sel = availableGodowns.find(g => String(g.id) === String(gid));
                        setItems(prev => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            godown_id: gid,
                            godown_name: sel ? (sel.print_name || sel.godown_name) : copy[idx].godown_name
                          };
                          return copy;
                        });
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
                        <option key={g.id} value={String(g.id)}>
                          {g.print_name || g.godown_name}
                        </option>
                      ))}
                    </select>
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

        {/* Financial Processing Charges Note */}
        {totalProcessingCharges > 0 && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '4px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px'
          }}>
            <div>
              <strong style={{ color: '#1e40af', fontSize: '13px' }}>External Processing Jobwork Charges:</strong>
              <span style={{ color: '#475569', marginLeft: '6px' }}>
                {outputWeight.toFixed(2)} KG Processed Output × ₹{chargeRate}/KG
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#1f4fb2' }}>
                ₹{totalProcessingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                Payable to {formData.party_name || 'Mill'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InpassCreate;
