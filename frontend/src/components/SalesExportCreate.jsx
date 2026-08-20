import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import './SalesExportCreate.css';

// Import modular entry components
import { 
  EntryTopFrame, 
  EntryItemsTable, 
  EntryTotalsRow, 
  EntryActions 
} from './entry';

/**
 * SalesExportCreate - Export Sales Creation (Invoice)
 */
const SalesExportCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [formData, setFormData] = useState({
    billNo: '',
    date: new Date().toISOString().split('T')[0],
    orderNoDt: '',
    disPort: '',
    destCountry: '',
    finalDestin: '',
    sender: '',
    netWt: '',
    advance: '',
    exporter: '',
    consignee: '',
    buyerOther: '',
    otherRef: '',
    preCarriage: '',
    vesselFltNo: '',
    consignedTo: '',
    grossWt: '',
    sign: '',
    placeOfRcpt: '',
    loadingPort: '',
    originCountry: '',
    deliveryTerms: '',
    paymentTerms: '',
    purTransport: '',
    driver: '',
    lorryNo: '',
    remarks: ''
  });

  const [items, setItems] = useState([{}]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // Load record if editId is provided or fetch next bill_no if new
  useEffect(() => {
    const loadData = async () => {
      if (editId) {
        setLoading(true);
        try {
          const res = await api(`/sales-export-orders/${editId}`);
          if (res) {
            setFormData({
              billNo: String(res.bill_no || ''),
              date: res.date ? res.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              orderNoDt: res.order_no_dt || '',
              disPort: res.dis_port || '',
              destCountry: res.dest_country || '',
              finalDestin: res.final_destin || '',
              sender: String(res.sender || ''),
              netWt: String(res.net_wt || ''),
              advance: String(res.advance || ''),
              exporter: String(res.exporter || ''),
              consignee: String(res.consignee || ''),
              buyerOther: res.buyer_other || '',
              otherRef: res.other_ref || '',
              preCarriage: res.pre_carriage || '',
              vesselFltNo: res.vessel_flt_no || '',
              consignedTo: String(res.consigned_to || ''),
              grossWt: String(res.gross_wt || ''),
              sign: res.sign || '',
              placeOfRcpt: res.place_of_rcpt || '',
              loadingPort: res.loading_port || '',
              originCountry: res.origin_country || '',
              deliveryTerms: res.delivery_terms || '',
              paymentTerms: res.payment_terms || '',
              purTransport: String(res.pur_transport || ''),
              driver: res.driver || '',
              lorryNo: res.lorry_no || '',
              remarks: res.remarks || ''
            });

            if (Array.isArray(res.items) && res.items.length > 0) {
              setItems(res.items.map(it => ({
                item_id: it.item_id || it.itemId || '',
                description: it.description || it.item_name || '',
                item_name: it.description || it.item_name || '',
                containerNo: it.container_no || '',
                kindOfPackage: it.kind_of_package || '',
                lotNo: it.lot_no || '',
                qty: String(it.qty || ''),
                weight: String(it.weight || it.per_unit_weight || ''),
                qtyInKg: String(it.qty_in_kg || ''),
                mfdExpDt: it.mfd_exp_dt ? String(it.mfd_exp_dt).substring(0, 10) : '',
                usdRate: String(it.usd_rate || ''),
                convRate: String(it.conv_rate || ''),
                usdAmt: String(it.usd_amt || ''),
                inrAmt: String(it.inr_amt || '')
              })));
            }
          }
        } catch (err) {
          console.error('Error fetching export sales record:', err);
          setMessage('Error loading export sales record');
          setMessageType('error');
        } finally {
          setLoading(false);
        }
      } else {
        try {
          const nextRes = await api('/sales-export-orders/next-sno');
          if (nextRes && nextRes.success) {
            setFormData(prev => ({ ...prev, billNo: String(nextRes.next_sno) }));
          }
        } catch (err) {
          console.error('Error fetching next bill_no:', err);
        }
      }
    };

    loadData();
  }, [editId]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        updatedItems[index] = { ...updatedItems[index], ...value };
      } else {
        updatedItems[index] = { ...updatedItems[index], [field]: value };
      }

      // Automatic calculations for export invoice
      const qty = parseFloat(updatedItems[index].qty) || 0;
      const weight = parseFloat(updatedItems[index].weight || updatedItems[index].per_unit_weight || 0);

      if (weight > 0) {
        updatedItems[index].weight = weight;
      }

      // Auto-calculate total weight in kg
      if (qty > 0 && weight > 0) {
        updatedItems[index].qtyInKg = (qty * weight).toFixed(2);
      }

      const usdRate = parseFloat(updatedItems[index].usdRate) || 0;
      const convRate = parseFloat(updatedItems[index].convRate) || 0;

      const usdAmt = qty * usdRate;
      updatedItems[index].usdAmt = usdAmt ? usdAmt.toFixed(2) : '';
      updatedItems[index].inrAmt = usdAmt && convRate ? (usdAmt * convRate).toFixed(2) : '';

      return updatedItems;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, {}]);
  }, []);

  const removeItem = useCallback((index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  }, [items.length]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!formData.date || !formData.billNo) {
        setMessage('Date and Bill No are required');
        setMessageType('error');
        setLoading(false);
        return;
      }

      // Map field keys to match database format in payload
      const transformedItems = items.map(item => ({
        containerNo: item.containerNo || '',
        kindOfPackage: item.kindOfPackage || '',
        description: item.description || '',
        qtyInKg: parseFloat(item.qtyInKg) || 0,
        mfdExpDt: item.mfdExpDt || '',
        lotNo: item.lotNo || '',
        qty: parseFloat(item.qty) || 0,
        usdRate: parseFloat(item.usdRate) || 0,
        convRate: parseFloat(item.convRate) || 0,
        usdAmt: parseFloat(item.usdAmt) || 0,
        inrAmt: parseFloat(item.inrAmt) || 0
      }));

      const payload = {
        formData: {
          ...formData,
          is_order: 0 // Sales Export Invoice
        },
        items: transformedItems
      };

      let result;
      if (editId) {
        result = await api(`/sales-export-orders/${editId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        result = await api('/sales-export-orders', {
          method: 'POST',
          body: payload
        });
      }

      if (result && result.success) {
        setMessage(editId ? 'Export Sales updated successfully!' : 'Export Sales saved successfully!');
        setMessageType('success');
        setTimeout(() => {
          setMessage('');
          navigate('/entry/sales-export-display');
        }, 1000);
      } else {
        setMessage(result?.message || 'Error saving Export Sales');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving Export Sales:', error);
      setMessage('Error saving Export Sales: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const topFrameFields = [
    // Col 1
    { name: 'billNo', label: 'Bill No', type: 'text', readOnly: true, col: 1 },
    { name: 'date', label: 'Date', type: 'date', col: 1 },
    { name: 'orderNoDt', label: 'Order No/Dt', type: 'text', col: 1 },
    { name: 'disPort', label: 'Dis Port', type: 'text', col: 1 },
    { name: 'destCountry', label: 'Dest. Country', type: 'text', col: 1 },
    { name: 'finalDestin', label: 'Final Destin', type: 'text', col: 1 },
    { name: 'sender', label: 'Sender', type: 'masterSelect', masterType: 'senders', col: 1 },
    { name: 'netWt', label: 'Net Wt', type: 'number', col: 1 },
    { name: 'advance', label: 'Advance', type: 'number', col: 1 },

    // Col 2
    { name: 'exporter', label: 'Exporter', type: 'masterSelect', masterType: 'senders', col: 2 },
    { name: 'consignee', label: 'Consignee', type: 'masterSelect', masterType: 'consignees', col: 2 },
    { name: 'buyerOther', label: 'Buyer (Other)', type: 'text', col: 2 },
    { name: 'otherRef', label: 'Other Ref', type: 'text', col: 2 },
    { name: 'preCarriage', label: 'Pre Carriage', type: 'text', col: 2 },
    { name: 'vesselFltNo', label: 'Vessel/Flt No', type: 'text', col: 2 },
    { name: 'consignedTo', label: 'Consigned To', type: 'masterSelect', masterType: 'consignees', col: 2 },
    { name: 'grossWt', label: 'Gross Wt', type: 'number', col: 2 },
    { name: 'sign', label: 'Sign', type: 'text', col: 2 },

    // Col 3
    { name: 'placeOfRcpt', label: 'Place Of Rcpt', type: 'text', col: 3 },
    { name: 'loadingPort', label: 'Loading Port', type: 'text', col: 3 },
    { name: 'originCountry', label: 'Origin Country', type: 'text', col: 3 },
    { name: 'deliveryTerms', label: 'Delivery Terms', type: 'text', col: 3 },
    { name: 'paymentTerms', label: 'Payment Terms', type: 'text', col: 3 },
    { name: 'purTransport', label: 'Pur. Transport', type: 'masterSelect', masterType: 'transports', col: 3 },
    { name: 'driver', label: 'Driver', type: 'text', col: 3 },
    { name: 'lorryNo', label: 'Lorry No.', type: 'text', col: 3 },
    { name: 'remarks', label: 'Remarks', type: 'textarea', col: 3 }
  ];

  const itemColumns = [
    { key: 'containerNo', title: 'Container No', type: 'text' },
    { key: 'kindOfPackage', title: 'Kind of Package', type: 'text' },
    { key: 'description', title: 'Item Description', type: 'masterSelect', masterType: 'items' },
    { key: 'lotNo', title: 'Lot No', type: 'lotSelect' },
    { key: 'qty', title: 'Qty (Bxs)', type: 'number' },
    { key: 'weight', title: 'Wt/Box (kg)', type: 'number' },
    { key: 'qtyInKg', title: 'Total Qty (kg)', type: 'number', readOnly: true },
    { key: 'mfdExpDt', title: 'MFD/Exp Dt', type: 'date' },
    { key: 'usdRate', title: 'USD Rate', type: 'number' },
    { key: 'convRate', title: 'Conv Rate', type: 'number' },
    { key: 'usdAmt', title: 'USD Amt', readOnly: true },
    { key: 'inrAmt', title: 'INR Amt', readOnly: true }
  ];

  return (
    <div className="window">
      <div className="screen-title">{editId ? 'Edit Export Sales' : 'Export Sales Creation'}</div>

      {message && <div className={`alert ${messageType}`}>{message}</div>}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleInputChange}
        columns={3}
      />

      <EntryItemsTable 
        columns={itemColumns}
        data={items}
        onRowChange={handleItemChange}
        onAddRow={addItem}
        onDeleteRow={removeItem}
        showActions={true}
        lotMode="select"
      />

      <EntryTotalsRow 
        totals={[
          { label: 'Total Qty', value: items.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0), isAmount: false },
          { label: 'Total USD', value: items.reduce((sum, r) => sum + (parseFloat(r.usdAmt) || 0), 0), isAmount: true },
          { label: 'Total INR', value: items.reduce((sum, r) => sum + (parseFloat(r.inr_amt || r.inrAmt) || 0), 0), isAmount: true }
        ]} 
      />

      <EntryActions 
        onSave={handleSubmit}
        saving={loading}
        saveText={editId ? "Update Export Sales" : "Save Export Sales"}
      />
    </div>
  );
};

export default SalesExportCreate;
