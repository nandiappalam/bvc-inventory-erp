import React, { useState, useEffect } from 'react';
import './GrainsCreation.css';
import api from '../services/api.js';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Import modular entry components
import { EntryTopFrame, EntryItemsTable, EntryActions, EntrySection } from './entry';

const GrainsCreation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    s_no: '1',
    flour_mill: '',
    date: today,
    remarks: ''
  });

  const [inputItems, setInputItems] = useState([
    { item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0, rate: '' }
  ]);

  const [outputItems, setOutputItems] = useState([
    { item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }
  ]);

  const [wastageItems, setWastageItems] = useState([
    { item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }
  ]);

  // Food Safety Management System (FSMS - CCP / OPRP / Verification) state
  const [ccpData, setCcpData] = useState({
    ccpRequired: true,
    ccpCategory: 'Sortex Machine / Sieving',
    criticalLimit: '5.5 g/MT',
    actualReading: '0.0',
    unit: 'g/MT',
    status: 'Pass',
    correctiveAction: '',
    checkedBy: 'QC Inspector',
    checkedDateTime: new Date().toISOString().slice(0, 16)
  });

  const [oprpData, setOprpData] = useState([]);

  const [verificationData, setVerificationData] = useState({
    operator: 'Operator 1',
    shift: 'Shift-A (06:00 AM - 02:00 PM)',
    productionIncharge: 'Production Incharge',
    qcTechnologist: 'QC Technologist J.V.N.',
    qaManager: 'QA Manager',
    finalApproval: 'APPROVED',
    remarks: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isEditMode, setIsEditMode] = useState(false);
  const [recordId, setRecordId] = useState(null);

  // Work Order Slip Integration
  const [linkedWorkOrder, setLinkedWorkOrder] = useState(null);
  const [woModalOpen, setWoModalOpen] = useState(false);
  const [workOrdersList, setWorkOrdersList] = useState([]);
  const [loadingWo, setLoadingWo] = useState(false);

  // Auto-sync OPRP table rows with Input and Output Items so operator enters nothing twice
  useEffect(() => {
    const autoOprpRows = [];
    
    inputItems.forEach(inItem => {
      if (inItem.item_name) {
        autoOprpRows.push({
          date: formData.date || today,
          material: inItem.item_name,
          rmFg: 'RM',
          lotNo: inItem.lot_no || 'Pending',
          quantity: inItem.qty || 0,
          alp: true,
          g: true,
          checkedBy: ccpData.checkedBy || 'QC Inspector',
          remarks: 'Raw Material Lot Inspected'
        });
      }
    });

    outputItems.forEach(outItem => {
      if (outItem.item_name) {
        autoOprpRows.push({
          date: formData.date || today,
          material: outItem.item_name,
          rmFg: 'FG',
          lotNo: outItem.lot_no || 'Auto-Allocated',
          quantity: outItem.qty || 0,
          alp: true,
          g: true,
          checkedBy: ccpData.checkedBy || 'QC Inspector',
          remarks: 'Finished Good Batch Inspected'
        });
      }
    });

    if (autoOprpRows.length > 0) {
      setOprpData(prev => {
        if (prev.length === 0) return autoOprpRows;
        return autoOprpRows.map((newRow, i) => ({
          ...newRow,
          alp: prev[i]?.alp !== undefined ? prev[i].alp : true,
          g: prev[i]?.g !== undefined ? prev[i].g : true,
          remarks: prev[i]?.remarks || newRow.remarks
        }));
      });
    }
  }, [inputItems, outputItems, formData.date]);

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      setRecordId(id);
      setLoading(true);
      api(`/grains/${id}`)
        .then(grain => {
          if (grain && grain.id) {
            setFormData({
              s_no: String(grain.s_no || grain.id),
              flour_mill: grain.flour_mill || '',
              date: grain.date ? grain.date.split('T')[0] : today,
              remarks: grain.remarks || ''
            });

            if (grain.inputItems && grain.inputItems.length > 0) {
              setInputItems(grain.inputItems.map(item => ({
                item_name: item.itemName,
                item_id: item.itemId || item.item_id || '',
                lot_no: item.lotNo,
                weight: String(item.weight || ''),
                qty: String(item.qty || ''),
                rate: String(item.rate || ''),
                total_wt: parseFloat(item.totalWt) || 0
              })));
            }
            if (grain.outputItems && grain.outputItems.length > 0) {
              setOutputItems(grain.outputItems.map(item => ({
                item_name: item.itemName,
                item_id: item.itemId || item.item_id || '',
                lot_no: item.lotNo,
                weight: String(item.weight || ''),
                qty: String(item.qty || ''),
                total_wt: parseFloat(item.totalWt) || 0
              })));
            }
            if (grain.wastageItems && grain.wastageItems.length > 0) {
              setWastageItems(grain.wastageItems.map(item => ({
                item_name: item.itemName,
                item_id: item.itemId || item.item_id || '',
                lot_no: item.lotNo,
                weight: String(item.weight || ''),
                qty: String(item.qty || ''),
                total_wt: parseFloat(item.totalWt) || 0,
                category: item.category || 'Select CCP / Equipment Category'
              })));
            }

            if (grain.ccp) {
              const sanitizeCcpCategory = (cat) => {
                if (!cat || typeof cat !== 'string' || cat.trim() === '' || cat.trim().startsWith('-')) {
                  return 'Sortex Machine / Sieving';
                }
                return cat.trim();
              };
              const sanitizeStatus = (st) => {
                if (!st || typeof st !== 'string' || st.trim() === '' || st.trim().startsWith('-')) {
                  return 'PASS';
                }
                const upper = st.trim().toUpperCase();
                if (upper === 'FAIL') return 'FAIL';
                if (upper === 'PENDING') return 'PENDING';
                return 'PASS';
              };
              
              setCcpData({
                ccpRequired: grain.ccp.ccp_required === 1,
                ccpCategory: sanitizeCcpCategory(grain.ccp.ccp_category),
                criticalLimit: grain.ccp.critical_limit || '5.5 g/MT',
                actualReading: String(grain.ccp.actual_reading !== undefined && grain.ccp.actual_reading !== null ? grain.ccp.actual_reading : '0.0'),
                unit: grain.ccp.unit || 'g/MT',
                status: sanitizeStatus(grain.ccp.status),
                correctiveAction: grain.ccp.corrective_action || '',
                checkedBy: grain.ccp.checked_by || 'QC Inspector',
                checkedDateTime: grain.ccp.checked_date_time ? new Date(grain.ccp.checked_date_time).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
              });
            }

            if (grain.oprp && grain.oprp.length > 0) {
              setOprpData(grain.oprp.map(o => ({
                date: o.date || today,
                material: o.material,
                rmFg: o.rm_fg,
                lotNo: o.lot_number,
                quantity: o.quantity,
                alp: o.alp === 1,
                g: o.g === 1,
                checkedBy: o.checked_by || 'QC Inspector',
                remarks: o.remarks || ''
              })));
            }

            if (grain.verification) {
              const sanitizeShift = (sh) => {
                if (!sh || typeof sh !== 'string' || sh.trim() === '' || sh.trim().startsWith('-')) {
                  return 'Shift-A (06:00 AM - 02:00 PM)';
                }
                if (sh.trim() === 'Shift-A') return 'Shift-A (06:00 AM - 02:00 PM)';
                if (sh.trim() === 'Shift-B') return 'Shift-B (02:00 PM - 10:00 PM)';
                if (sh.trim() === 'Shift-C') return 'Shift-C (10:00 PM - 06:00 AM)';
                return sh.trim();
              };
              const sanitizeApproval = (app) => {
                if (!app || typeof app !== 'string' || app.trim() === '' || app.trim().startsWith('-')) {
                  return 'APPROVED';
                }
                const upper = app.trim().toUpperCase();
                if (upper === 'REJECTED') return 'REJECTED';
                if (upper === 'PENDING') return 'PENDING';
                return 'APPROVED';
              };

              setVerificationData({
                operator: grain.verification.operator || 'Operator 1',
                shift: sanitizeShift(grain.verification.shift),
                productionIncharge: grain.verification.production_incharge || 'Production Incharge',
                qcTechnologist: grain.verification.qc_technologist || 'QC Technologist J.V.N.',
                qaManager: grain.verification.qa_manager || 'QA Manager',
                finalApproval: sanitizeApproval(grain.verification.final_approval),
                remarks: grain.verification.remarks || ''
              });
            }
          } else {
            setMessage('Failed to load grind creation record.');
            setMessageType('error');
          }
        })
        .catch(err => {
          console.error('Error loading grind creation:', err);
          setMessage('Error loading record: ' + err.message);
          setMessageType('error');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setIsEditMode(false);
      setRecordId(null);
      setFormData({
        s_no: '1',
        flour_mill: '',
        date: today,
        remarks: ''
      });
      setInputItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
      setOutputItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
      setWastageItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0, category: 'Select CCP / Equipment Category' }]);
      
      // Auto-fetch next S.No when creating a new record
      api('/grains/next-sno')
        .then(async (res) => {
          const sno = res?.next_sno ?? res?.s_no ?? res?.data?.s_no ?? res?.next_s_no;
          if (sno) {
            setFormData(prev => ({ ...prev, s_no: String(sno) }));
          } else {
            const fallbackSno = await api.getNextSNo('/grains');
            setFormData(prev => ({ ...prev, s_no: String(fallbackSno) }));
          }
        })
        .catch(async () => {
          try {
            const fallbackSno = await api.getNextSNo('/grains');
            setFormData(prev => ({ ...prev, s_no: String(fallbackSno) }));
          } catch (e) {}
        });
    }
  }, [id]);

  // Apply Work Order Data into Grind creation form
  const applyWorkOrderData = (wo) => {
    if (!wo) return;
    setLinkedWorkOrder(wo);
    setFormData(prev => ({
      ...prev,
      flour_mill: wo.work_unit || prev.flour_mill,
      date: wo.date || prev.date,
      remarks: `Work Order: ${wo.work_order_no || wo.id}${wo.remarks ? ' - ' + wo.remarks : ''}`,
      work_order_id: wo.id,
      work_order_no: wo.work_order_no || `WO-${wo.id}`
    }));

    // Input Items
    const rawInputList = (Array.isArray(wo.input_items) && wo.input_items.length > 0) ? wo.input_items : (wo.items || []);
    if (rawInputList.length > 0) {
      const formattedInput = rawInputList.map(it => ({
        item_name: it.item_name || '',
        lot_no: it.lot_no || '',
        weight: it.weight !== undefined && it.weight !== null ? String(it.weight) : '',
        qty: it.input_qty !== undefined && it.input_qty !== null ? String(it.input_qty) : (it.qty !== undefined ? String(it.qty) : ''),
        total_wt: parseFloat(it.kgs) || (parseFloat(it.weight || 0) * parseFloat(it.input_qty || it.qty || 0)) || 0,
        rate: it.rate ? String(it.rate) : '',
        supplier_name: it.supplier || it.supplier_name || ''
      }));
      setInputItems(formattedInput.length > 0 ? formattedInput : [{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
    }

    // Output Items
    if (Array.isArray(wo.output_items) && wo.output_items.length > 0) {
      const formattedOutput = wo.output_items.map(it => ({
        item_name: it.output_item || it.item_name || wo.product || '',
        lot_no: it.fg_lot_no || it.lot_no || '',
        weight: it.weight !== undefined && it.weight !== null ? String(it.weight) : '',
        qty: it.expected_qty !== undefined && it.expected_qty !== null ? String(it.expected_qty) : (it.qty ? String(it.qty) : ''),
        total_wt: parseFloat(it.output_kgs || it.total_wt) || (parseFloat(it.weight || 0) * parseFloat(it.expected_qty || it.qty || 0)) || 0
      }));
      setOutputItems(formattedOutput);
    } else if (Array.isArray(wo.items) && wo.items.length > 0) {
      const formattedOutput = wo.items.map(it => ({
        item_name: it.output_item || wo.product || '',
        lot_no: it.fg_lot_no || '',
        weight: it.output_weight !== undefined && it.output_weight !== null ? String(it.output_weight) : (it.weight ? String(it.weight) : ''),
        qty: it.output_qty !== undefined && it.output_qty !== null ? String(it.output_qty) : '',
        total_wt: parseFloat(it.output_kgs) || (parseFloat(it.output_weight || it.weight || 0) * parseFloat(it.output_qty || 0)) || 0
      }));
      setOutputItems(formattedOutput.length > 0 ? formattedOutput : [{ item_name: wo.product || '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
    } else {
      // Single product
      setOutputItems([{
        item_name: wo.product || '',
        lot_no: '',
        weight: '',
        qty: wo.expected_output_qty ? String(wo.expected_output_qty) : '',
        total_wt: parseFloat(wo.expected_output_wt) || 0
      }]);
    }

    // Wastage Items pre-loaded from slip breakdown
    if (Array.isArray(wo.wastage_items) && wo.wastage_items.length > 0) {
      const formattedWastage = wo.wastage_items.map(w => ({
        item_name: w.item_name || `Wastage - ${w.category || 'Rejection'}`,
        lot_no: w.lot_no || 'WST-01',
        weight: w.weight !== undefined && w.weight !== null ? String(w.weight) : '1',
        qty: w.qty !== undefined && w.qty !== null ? String(w.qty) : (w.total_wt ? String(w.total_wt) : '0'),
        total_wt: parseFloat(w.total_wt) || (parseFloat(w.weight || 1) * parseFloat(w.qty || 0)) || 0,
        category: w.category || 'Rejection of Wastage'
      }));
      setWastageItems(formattedWastage);
    } else {
      const wastageRows = [];
      if (parseFloat(wo.rejection_wt) > 0) {
        wastageRows.push({
          item_name: 'Wastage - Rejection',
          lot_no: 'REJ-01',
          weight: '1',
          qty: String(wo.rejection_wt || 0),
          total_wt: parseFloat(wo.rejection_wt || 0),
          category: 'Rejection of Wastage'
        });
      }
      if (parseFloat(wo.elevator_wt) > 0) {
        wastageRows.push({
          item_name: 'Wastage - Elevator Waste',
          lot_no: 'ELE-01',
          weight: '1',
          qty: String(wo.elevator_wt || 0),
          total_wt: parseFloat(wo.elevator_wt || 0),
          category: 'Destoner / Cleaner'
        });
      }
      if (parseFloat(wo.waste_flour_wt) > 0) {
        wastageRows.push({
          item_name: 'Wastage - Waste Flour',
          lot_no: 'WF-01',
          weight: '1',
          qty: String(wo.waste_flour_wt || 0),
          total_wt: parseFloat(wo.waste_flour_wt || 0),
          category: 'Sortex Machine / Sieving'
        });
      }
      if (parseFloat(wo.sieve_flour_wt) > 0) {
        wastageRows.push({
          item_name: 'Wastage - Sieve Flour',
          lot_no: 'SF-01',
          weight: '1',
          qty: String(wo.sieve_flour_wt || 0),
          total_wt: parseFloat(wo.sieve_flour_wt || 0),
          category: 'Sortex Machine / Sieving'
        });
      }
      if (parseFloat(wo.other_wastage_wt) > 0) {
        wastageRows.push({
          item_name: 'Wastage - Other / Dust',
          lot_no: 'OTH-01',
          weight: '1',
          qty: String(wo.other_wastage_wt || 0),
          total_wt: parseFloat(wo.other_wastage_wt || 0),
          category: 'Destoner / Cleaner'
        });
      }

      if (wastageRows.length > 0) {
        setWastageItems(wastageRows);
      }
    }

    setMessage(`Loaded Work Order Slip ${wo.work_order_no || wo.id} for "${wo.product}" successfully.`);
    setMessageType('success');
  };

  // Check URL params for work_order_id
  const workOrderIdParam = searchParams.get('work_order_id') || searchParams.get('wo_id') || searchParams.get('wo');
  useEffect(() => {
    if (workOrderIdParam && !id) {
      setLoading(true);
      api(`/work-orders/${workOrderIdParam}`)
        .then(res => {
          if (res?.success && res.data) {
            applyWorkOrderData(res.data);
          }
        })
        .catch(err => console.error('Error fetching work order by URL param:', err))
        .finally(() => setLoading(false));
    }
  }, [workOrderIdParam, id]);

  const openWorkOrderModal = async () => {
    setWoModalOpen(true);
    setLoadingWo(true);
    try {
      const res = await api('/work-orders');
      if (res?.success) {
        setWorkOrdersList(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching work orders:', err);
    } finally {
      setLoadingWo(false);
    }
  };

  const handleSelectWorkOrder = (wo) => {
    applyWorkOrderData(wo);
    setWoModalOpen(false);
  };

  const clearWorkOrderLink = () => {
    setLinkedWorkOrder(null);
    setFormData(prev => ({
      ...prev,
      work_order_id: null,
      work_order_no: null
    }));
    setMessage('Unlinked Work Order Slip.');
    setMessageType('info');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInputItemChange = (index, field, value) => {
    setInputItems(prevItems => {
      const newItems = [...prevItems];
      const previousLotNo = newItems[index].lot_no;

      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      const currentLotNo = newItems[index].lot_no;

      // If lot_no changed, let's auto-fill the weight, qty, rate, and total weight!
      if (currentLotNo !== previousLotNo) {
        const selectedLotNo = currentLotNo;
        const availableLots = newItems[index].available_lots || [];
        const matchedLot = availableLots.find(l => l.lot_no === selectedLotNo);
        if (matchedLot) {
          const lotWeight = parseFloat(matchedLot.per_unit_weight ?? matchedLot.weight ?? 0);
          const lotQty = parseFloat(matchedLot.available_qty || matchedLot.remaining_quantity || 0);
          const lotRate = parseFloat(matchedLot.rate || matchedLot.purchase_rate || matchedLot.cost || matchedLot.purchase_cost || 0);
          newItems[index].weight = lotWeight;
          newItems[index].qty = lotQty;
          if (lotRate > 0) {
            newItems[index].rate = lotRate;
          }
          newItems[index].total_wt = lotWeight * lotQty;
        }
      }

      // Recalculate totals
      const weightVal = parseFloat(newItems[index].weight) || 0;
      const qtyVal = parseFloat(newItems[index].qty) || 0;
      newItems[index].total_wt = weightVal * qtyVal;

      return newItems;
    });
  };

  const handleOutputItemChange = (index, field, value) => {
    setOutputItems(prevItems => {
      const newItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      // Recalculate total_wt
      const weightVal = parseFloat(newItems[index].weight) || 0;
      const qtyVal = parseFloat(newItems[index].qty) || 0;
      newItems[index].total_wt = weightVal * qtyVal;

      return newItems;
    });
  };

  const handleWastageItemChange = (index, field, value) => {
    setWastageItems(prevItems => {
      const newItems = [...prevItems];
      if (field === '__batch__' && typeof value === 'object') {
        newItems[index] = { ...newItems[index], ...value };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      // Recalculate total_wt
      const weightVal = parseFloat(newItems[index].weight) || 0;
      const qtyVal = parseFloat(newItems[index].qty) || 0;
      newItems[index].total_wt = weightVal * qtyVal;

      return newItems;
    });
  };

  const handleSave = async () => {
    // Validate mandatory corrective action if CCP status is Fail
    if (ccpData.status === 'Fail' && (!ccpData.correctiveAction || ccpData.correctiveAction.trim() === '')) {
      setMessage('Corrective action is MANDATORY when CCP Status is FAIL.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const endpoint = isEditMode ? `grains/${recordId}` : 'grains';
      const method = isEditMode ? 'PUT' : 'POST';

      const result = await api(endpoint, { 
        method: method, 
        body: { 
          formData: {
            sNo: formData.s_no,
            flourMill: formData.flour_mill,
            date: formData.date,
            remarks: formData.remarks,
            operator: verificationData.operator,
            workOrderId: formData.work_order_id,
            workOrderNo: formData.work_order_no
          }, 
          inputItems: inputItems.map(item => ({
            itemName: item.item_name,
            lotNo: item.lot_no,
            weight: parseFloat(item.weight) || 0,
            qty: parseFloat(item.qty) || 0,
            totalWt: parseFloat(item.total_wt) || 0,
            rate: parseFloat(item.rate) || 0,
            wagesKg: 0,
            totalWages: 0
          })), 
          outputItems: outputItems.map(item => ({
            itemName: item.item_name,
            lotNo: item.lot_no,
            weight: parseFloat(item.weight) || 0,
            qty: parseFloat(item.qty) || 0,
            totalWt: parseFloat(item.total_wt) || 0
          })),
          wastageItems: wastageItems.map(item => ({
            itemName: item.item_name,
            lotNo: item.lot_no,
            weight: parseFloat(item.weight) || 0,
            qty: parseFloat(item.qty) || 0,
            totalWt: parseFloat(item.total_wt) || 0,
            category: item.category || ''
          })),
          ccp: ccpData,
          oprp: oprpData,
          verification: verificationData
        } 
      });

      if (result && result.success) {
        setMessage(isEditMode ? 'Grind creation updated successfully!' : 'Grind creation saved successfully!');
        setMessageType('success');
        if (!isEditMode) {
          setFormData({ s_no: '1', flour_mill: '', date: today, remarks: '' });
          setInputItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
          setOutputItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0 }]);
          setWastageItems([{ item_name: '', lot_no: '', weight: '', qty: '', total_wt: 0, category: 'Select CCP / Equipment Category' }]);
          api('/grains/next-sno')
            .then(res => {
              if (res?.next_sno) {
                setFormData(prev => ({ ...prev, s_no: String(res.next_sno) }));
              }
            })
            .catch(err => console.error('Failed to load next grains S.No:', err));
        }
        setTimeout(() => {
          setMessage('');
          navigate('/entry/grind-display');
        }, 1500);
      } else {
        setMessage(result?.message || 'Error saving grind creation');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error saving grind:', error);
      setMessage('Error saving grind creation: ' + error.message);
      setMessageType('error');
    }
    setLoading(false);
  };

  const topFrameFields = [
    { name: 'date', label: 'Date', type: 'date', value: formData.date, col: 1 },
    { name: 'flour_mill', label: 'Flour Mill', type: 'masterSelect', masterType: 'flour_mills', col: 2 },
    { name: 'remarks', label: 'Remarks', type: 'text', value: formData.remarks, col: 3 }
  ];

  const inputColumns = [
    { key: 'item_name', title: 'Item Name', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'lotSelect' },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true },
    { key: 'rate', title: 'RM Cost (₹/Qty)', type: 'number' }
  ];

  const outputColumns = [
    { key: 'item_name', title: 'Output Item (FG)', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No', type: 'text', readOnly: true },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true }
  ];

  const wastageColumns = [
    { key: 'item_name', title: 'Wastage Item Name', type: 'masterSelect', masterType: 'items' },
    { 
      key: 'category', 
      title: 'CCP Category / Equipment', 
      type: 'select', 
      options: [
        'Select CCP / Equipment Category',
        'Insect Remover Rejection',
        'Sortex Machine / Sieving',
        'Magnet / Metal Detector',
        'Destoner / Cleaner',
        'Rejection of Wastage',
        'General Wastage'
      ] 
    },
    { key: 'lot_no', title: 'Lot No', type: 'text', readOnly: true },
    { key: 'weight', title: 'Weight', type: 'number' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'total_wt', title: 'Total Wt', readOnly: true }
  ];

  const handleInputRowChange = (rowIndex, key, value) => {
    handleInputItemChange(rowIndex, key, value);
  };

  const handleOutputRowChange = (rowIndex, key, value) => {
    handleOutputItemChange(rowIndex, key, value);
  };

  const handleWastageRowChange = (rowIndex, key, value) => {
    handleWastageItemChange(rowIndex, key, value);
  };

  const addInputRow = (newRow = {}) => {
    setInputItems(prev => [...prev, newRow]);
  };

  const addOutputRow = (newRow = {}) => {
    setOutputItems(prev => [...prev, newRow]);
  };

  const addWastageRow = (newRow = {}) => {
    setWastageItems(prev => [...prev, newRow]);
  };

  const deleteInputRow = (index) => {
    if (inputItems.length > 1) {
      setInputItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const deleteOutputRow = (index) => {
    if (outputItems.length > 1) {
      setOutputItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const deleteWastageRow = (index) => {
    if (wastageItems.length > 1) {
      setWastageItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="window">
      {/* Top Title & Work Order Slip Link Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div className="screen-title" style={{ margin: 0 }}>Grind Creation</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={openWorkOrderModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: linkedWorkOrder ? '#15803d' : '#1e40af',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            📋 {linkedWorkOrder ? `Work Order: ${linkedWorkOrder.work_order_no || linkedWorkOrder.id}` : 'Load from Work Order Slip'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/entry/work-order-slip-create')}
            style={{
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '7px 12px',
              borderRadius: '6px',
              fontWeight: '500',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Create New Slip
          </button>
        </div>
      </div>

      {/* Linked Work Order Info Banner */}
      {linkedWorkOrder && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          padding: '10px 14px',
          marginBottom: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: '#166534'
        }}>
          <div>
            <strong>🔗 Linked to Work Order Slip:</strong> <span style={{ fontWeight: 'bold' }}>{linkedWorkOrder.work_order_no || linkedWorkOrder.id}</span>
            <span style={{ margin: '0 8px', color: '#86efac' }}>|</span>
            <strong>Target Product:</strong> {linkedWorkOrder.product}
            <span style={{ margin: '0 8px', color: '#86efac' }}>|</span>
            <strong>Work Unit:</strong> {linkedWorkOrder.work_unit}
          </div>
          <button
            type="button"
            onClick={clearWorkOrderLink}
            style={{
              background: 'none',
              border: '1px solid #86efac',
              borderRadius: '4px',
              padding: '3px 8px',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✕ Unlink
          </button>
        </div>
      )}

      {message && <div className={`message ${messageType}`}>{message}</div>}

      {/* Work Order Selection Modal */}
      {woModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Select Work Order Slip for Grinding</h3>
              <button
                type="button"
                onClick={() => setWoModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {loadingWo ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading Work Order Slips...</div>
            ) : workOrdersList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <p>No Work Order Slips found. Create a Work Order Slip first before grinding.</p>
                <button
                  type="button"
                  onClick={() => { setWoModalOpen(false); navigate('/entry/work-order-slip-create'); }}
                  style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
                >
                  + Create Work Order Slip
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>WO Slip No</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Work Unit</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Input Bags</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrdersList.map(wo => (
                      <tr key={wo.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{wo.work_order_no || `WO-${wo.id}`}</td>
                        <td style={{ padding: '10px' }}>{wo.date}</td>
                        <td style={{ padding: '10px' }}>{wo.work_unit}</td>
                        <td style={{ padding: '10px', fontWeight: '600' }}>{wo.product}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{wo.total_input_qty || 0}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: wo.status === 'COMPLETED' ? '#dcfce7' : '#dbeafe',
                            color: wo.status === 'COMPLETED' ? '#166534' : '#1e40af'
                          }}>
                            {wo.status || 'ISSUED'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectWorkOrder(wo)}
                            style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Load Into Form ➜
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <EntryTopFrame 
        fields={topFrameFields} 
        data={formData} 
        onChange={handleFormChange}
      />

      <EntrySection title="Input Items">
        <EntryItemsTable 
          columns={inputColumns}
          data={inputItems}
          onRowChange={handleInputRowChange}
          onAddRow={addInputRow}
          onDeleteRow={deleteInputRow}
          showActions={true}
          lotMode="select"
        />
      </EntrySection>

      <EntrySection title="Output Items">
        <EntryItemsTable 
          columns={outputColumns}
          data={outputItems}
          onRowChange={handleOutputRowChange}
          onAddRow={addOutputRow}
          onDeleteRow={deleteOutputRow}
          showActions={true}
          lotMode="auto"
        />
      </EntrySection>

      <EntrySection title="Wastage Items">
        <EntryItemsTable 
          columns={wastageColumns}
          data={wastageItems}
          onRowChange={handleWastageRowChange}
          onAddRow={addWastageRow}
          onDeleteRow={deleteWastageRow}
          showActions={true}
          lotMode="auto-wastage"
        />
      </EntrySection>

      {/* Real-time Material Yield & Wastage Analytics */}
      {(() => {
        const totalInputBags = inputItems.reduce((acc, x) => acc + (parseFloat(x.qty) || 0), 0);
        const totalInputWt = inputItems.reduce((acc, x) => acc + (parseFloat(x.total_wt) || 0), 0);
        
        // Calculate total RM input cost per Qty wise
        const totalInputCost = inputItems.reduce((acc, x) => {
          const qty = parseFloat(x.qty) || 0;
          const rate = parseFloat(x.rate || x.purchase_rate || x.cost || 0);
          return acc + (qty * rate);
        }, 0);

        const avgRmCostPerQty = totalInputBags > 0 ? (totalInputCost / totalInputBags) : 0;
        const avgRmCostPerKg = totalInputWt > 0 ? (totalInputCost / totalInputWt) : 0;

        const totalOutputBags = outputItems.reduce((acc, x) => acc + (parseFloat(x.qty) || 0), 0);
        const totalOutputWt = outputItems.reduce((acc, x) => acc + (parseFloat(x.total_wt) || 0), 0);

        const totalWastageBags = wastageItems.reduce((acc, x) => acc + (parseFloat(x.qty) || 0), 0);
        const totalWastageWt = wastageItems.reduce((acc, x) => acc + (parseFloat(x.total_wt) || 0), 0);

        const shortcomingWt = totalInputWt - (totalOutputWt + totalWastageWt);

        const inputPct = totalInputWt > 0 ? 100 : 0;
        const outputPct = totalInputWt > 0 ? (totalOutputWt / totalInputWt) * 100 : 0;
        const wastagePct = totalInputWt > 0 ? (totalWastageWt / totalInputWt) * 100 : 0;
        const shortcomingPct = totalInputWt > 0 ? (shortcomingWt / totalInputWt) * 100 : 0;

        // Calculate RM Cost Losses KG-wise as requested by user
        const wastageLossAmount = totalWastageWt * avgRmCostPerKg;
        const shortcomingLossAmount = (shortcomingWt > 0 ? shortcomingWt : 0) * avgRmCostPerKg;
        const totalRmLossAmount = wastageLossAmount + shortcomingLossAmount;

        return (
          <div style={{
            marginTop: '25px',
            padding: '20px',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontFamily: 'sans-serif',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Grind Material Balance & Yield Summary
              </h3>
              {totalInputCost > 0 && (
                <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  RM Purchase Cost: ₹{avgRmCostPerQty.toFixed(2)} / qty
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
              {/* Total Input Material */}
              <div style={{ padding: '12px', backgroundColor: '#e0e7ff', borderRadius: '6px', borderLeft: '4px solid #4f46e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#4338ca', fontWeight: '700', textTransform: 'uppercase' }}>TOTAL INPUT MATERIAL</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3730a3', backgroundColor: '#c7d2fe', padding: '2px 6px', borderRadius: '4px' }}>
                    {inputPct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e1b4b', marginTop: '6px' }}>
                  {totalInputBags.toFixed(0)} bags / {totalInputWt.toFixed(2)} kg
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#3730a3', marginTop: '6px', borderTop: '1px dashed #a5b4fc', paddingTop: '4px' }}>
                  RM Cost: ₹{totalInputCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Finished Goods Output */}
              <div style={{ padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px', borderLeft: '4px solid #16a34a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700', textTransform: 'uppercase' }}>FINISHED GOODS OUTPUT</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534', backgroundColor: '#bbf7d0', padding: '2px 6px', borderRadius: '4px' }}>
                    {outputPct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#064e3b', marginTop: '6px' }}>
                  {totalOutputBags.toFixed(0)} bags / {totalOutputWt.toFixed(2)} kg
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', marginTop: '6px', borderTop: '1px dashed #86efac', paddingTop: '4px' }}>
                  Yield Share: {outputPct.toFixed(2)}%
                </div>
              </div>

              {/* Process Wastage */}
              <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', borderLeft: '4px solid #dc2626' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>PROCESS WASTAGE</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b', backgroundColor: '#fecaca', padding: '2px 6px', borderRadius: '4px' }}>
                    {wastagePct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#7f1d1d', marginTop: '6px' }}>
                  {totalWastageBags.toFixed(0)} bags / {totalWastageWt.toFixed(2)} kg
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', marginTop: '6px', borderTop: '1px dashed #fca5a5', paddingTop: '4px' }}>
                  Wastage Amount: ₹{wastageLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Shortcoming / Loss */}
              <div style={{ padding: '12px', backgroundColor: '#ffedd5', borderRadius: '6px', borderLeft: '4px solid #f97316' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '700', textTransform: 'uppercase' }}>SHORTCOMING / LOSS</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9a3412', backgroundColor: '#fed7aa', padding: '2px 6px', borderRadius: '4px' }}>
                    {shortcomingPct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#7c2d12', marginTop: '6px' }}>
                  {shortcomingWt.toFixed(2)} kg
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#9a3412', marginTop: '6px', borderTop: '1px dashed #fdba74', paddingTop: '4px' }}>
                  Loss Amount: ₹{shortcomingLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Total RM Loss Summary Banner */}
            <div style={{
              marginTop: '15px',
              padding: '10px 14px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '6px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              fontSize: '13px'
            }}>
              <span style={{ fontWeight: '600', color: '#9f1239' }}>
                Total RM Wastage & Shortcoming Loss:
              </span>
              <span style={{ fontWeight: 'bold', color: '#881337', fontSize: '14px' }}>
                {(totalWastageWt + shortcomingWt).toFixed(2)} kg = ₹{totalRmLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        );
      })()}

      {/* 1. Critical Control Point (CCP) Monitoring Card */}
      <EntrySection title="Critical Control Point (CCP) Monitoring - ISO 22000 FSMS">
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>CCP Required?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', fontSize: '13px', fontWeight: '600' }}>
                <input 
                  type="checkbox" 
                  checked={ccpData.ccpRequired}
                  onChange={(e) => setCcpData(prev => ({ ...prev, ccpRequired: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                />
                Active CCP Monitoring
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>CCP Category / Equipment</label>
              <select 
                value={
                  (ccpData.ccpCategory && ccpData.ccpCategory.includes('Sortex') && ccpData.ccpCategory.includes('Sieving')) ? 'Sortex Machine / Sieving' :
                  (ccpData.ccpCategory === 'Sortex Machine') ? 'Sortex Machine' :
                  (ccpData.ccpCategory && ccpData.ccpCategory.toLowerCase().includes('end level')) ? 'Sortex Machine (End Level)' :
                  (ccpData.ccpCategory || 'Sortex Machine / Sieving')
                }
                onChange={(e) => setCcpData(prev => ({ ...prev, ccpCategory: e.target.value }))}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  backgroundColor: '#ffffff', 
                  color: '#1e293b',
                  minHeight: '38px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="Sortex Machine / Sieving">Sortex Machine / Sieving</option>
                <option value="Sortex Machine">Sortex Machine</option>
                <option value="Sortex Machine (End Level)">Sortex Machine (End Level)</option>
                <option value="Insect Remover Rejection">Insect Remover Rejection</option>
                <option value="Magnet Separator">Magnet Separator</option>
                <option value="Metal Detector">Metal Detector</option>
                <option value="Moisture & Temp Analyzer">Moisture & Temp Analyzer</option>
                <option value="Destoner Cleanliness">Destoner Cleanliness</option>
                {ccpData.ccpCategory && ![
                  'Sortex Machine / Sieving', 'Sortex Machine', 'Sortex Machine (End Level)', 'Sortex machine at end level',
                  'Insect Remover Rejection', 'Magnet Separator', 'Metal Detector',
                  'Moisture & Temp Analyzer', 'Destoner Cleanliness'
                ].includes(ccpData.ccpCategory) && (
                  <option value={ccpData.ccpCategory}>{ccpData.ccpCategory}</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Critical Limit Standard</label>
              <input 
                type="text" 
                value={ccpData.criticalLimit}
                onChange={(e) => setCcpData(prev => ({ ...prev, criticalLimit: e.target.value }))}
                placeholder="e.g. 5.5 g/MT"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Actual Test Reading</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  value={ccpData.actualReading}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCcpData(prev => ({
                      ...prev,
                      actualReading: e.target.value,
                      status: val > 10 ? 'Fail' : 'Pass'
                    }));
                  }}
                  placeholder="0.0"
                  style={{ width: '70%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
                <input 
                  type="text" 
                  value={ccpData.unit}
                  onChange={(e) => setCcpData(prev => ({ ...prev, unit: e.target.value }))}
                  style={{ width: '30%', padding: '8px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '16px', alignItems: 'flex-start' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Inspection Status</label>
              <select 
                value={
                  (ccpData.status && ccpData.status.toUpperCase() === 'FAIL') ? 'FAIL' :
                  (ccpData.status && ccpData.status.toUpperCase() === 'PENDING') ? 'PENDING' :
                  'PASS'
                }
                onChange={(e) => setCcpData(prev => ({ ...prev, status: e.target.value }))}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  fontSize: '13px',
                  fontWeight: 'bold',
                  minHeight: '38px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  backgroundColor: (ccpData.status && (ccpData.status.toUpperCase() === 'PASS' || ccpData.status.toUpperCase().includes('COMPLIAN') || ccpData.status.toUpperCase() === 'OK')) ? '#dcfce7' : (ccpData.status && ccpData.status.toUpperCase() === 'FAIL') ? '#fee2e2' : '#fef3c7',
                  color: (ccpData.status && (ccpData.status.toUpperCase() === 'PASS' || ccpData.status.toUpperCase().includes('COMPLIAN') || ccpData.status.toUpperCase() === 'OK')) ? '#15803d' : (ccpData.status && ccpData.status.toUpperCase() === 'FAIL') ? '#b91c1c' : '#d97706',
                  border: (ccpData.status && (ccpData.status.toUpperCase() === 'PASS' || ccpData.status.toUpperCase().includes('COMPLIAN') || ccpData.status.toUpperCase() === 'OK')) ? '1px solid #86efac' : '1px solid #fca5a5'
                }}
              >
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
                <option value="PENDING">PENDING</option>
                {ccpData.status && !['PASS', 'FAIL', 'PENDING', 'Pass', 'Fail', 'Pending'].includes(ccpData.status) && (
                  <option value={ccpData.status}>{String(ccpData.status).toUpperCase()}</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: ccpData.status === 'Fail' ? '#b91c1c' : '#475569', marginBottom: '6px' }}>
                Corrective Action {ccpData.status === 'Fail' && <span style={{ color: '#dc2626' }}>* (MANDATORY IF FAIL)</span>}
              </label>
              <input 
                type="text" 
                value={ccpData.correctiveAction}
                onChange={(e) => setCcpData(prev => ({ ...prev, correctiveAction: e.target.value }))}
                placeholder={ccpData.status === 'Fail' ? "Mandatory corrective action details required..." : "Optional notes or adjustments..."}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: ccpData.status === 'Fail' ? '2px solid #ef4444' : '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  fontSize: '13px' 
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Checked By</label>
              <input 
                type="text" 
                value={ccpData.checkedBy}
                onChange={(e) => setCcpData(prev => ({ ...prev, checkedBy: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Checked Date & Time</label>
              <input 
                type="datetime-local" 
                value={ccpData.checkedDateTime}
                onChange={(e) => setCcpData(prev => ({ ...prev, checkedDateTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          </div>
        </div>
      </EntrySection>

      {/* 2. Operational Prerequisite Program (OPRP) Monitoring Card */}
      <EntrySection title="Operational Prerequisite Program (OPRP) Monitoring">
        <div style={{ padding: '12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
            Auto-populated from active Raw Materials & Finished Goods in this Grind Voucher. Check ALP (Cleaning) and G (Grinding Condition).
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Date</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Material Name</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Type</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Lot No</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Qty (Bags)</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>ALP Gram (g)</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold', textAlign: 'center' }}>ALP Check</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold', textAlign: 'center' }}>G Check</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Inspector</th>
                <th style={{ padding: '8px 10px', color: '#334155', fontWeight: 'bold' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {oprpData.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                    Select or enter Input/Output items above to generate OPRP verification rows automatically.
                  </td>
                </tr>
              ) : (
                oprpData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px' }}>{row.date}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '600', color: '#1e293b' }}>{row.material}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        backgroundColor: row.rmFg === 'RM' ? '#e0e7ff' : '#dcfce7',
                        color: row.rmFg === 'RM' ? '#3730a3' : '#166534'
                      }}>
                        {row.rmFg}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{row.lotNo}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '600' }}>{row.quantity}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="number" 
                        step="any"
                        value={row.alpGram || row.alp_gram || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setOprpData(prev => prev.map((item, i) => i === idx ? { ...item, alpGram: val } : item));
                        }}
                        placeholder="0.0"
                        style={{ width: '70px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={row.alp} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setOprpData(prev => prev.map((item, i) => i === idx ? { ...item, alp: val } : item));
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={row.g} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setOprpData(prev => prev.map((item, i) => i === idx ? { ...item, g: val } : item));
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="text" 
                        value={row.checkedBy} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setOprpData(prev => prev.map((item, i) => i === idx ? { ...item, checkedBy: val } : item));
                        }}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="text" 
                        value={row.remarks} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setOprpData(prev => prev.map((item, i) => i === idx ? { ...item, remarks: val } : item));
                        }}
                        placeholder="Observation notes..."
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </EntrySection>

      {/* 3. Production Verification Section */}
      <EntrySection title="Production & FSMS Verification Sign-Off">
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Operator In-Charge</label>
              <input 
                type="text" 
                value={verificationData.operator}
                onChange={(e) => setVerificationData(prev => ({ ...prev, operator: e.target.value }))}
                placeholder="Operator Name"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Production Shift</label>
              <select 
                value={
                  (verificationData.shift === 'Shift-A' || verificationData.shift === 'Shift-A (06:00 AM - 02:00 PM)') ? 'Shift-A (06:00 AM - 02:00 PM)' :
                  (verificationData.shift === 'Shift-B' || verificationData.shift === 'Shift-B (02:00 PM - 10:00 PM)') ? 'Shift-B (02:00 PM - 10:00 PM)' :
                  (verificationData.shift === 'Shift-C' || verificationData.shift === 'Shift-C (10:00 PM - 06:00 AM)') ? 'Shift-C (10:00 PM - 06:00 AM)' :
                  (verificationData.shift || 'Shift-A (06:00 AM - 02:00 PM)')
                }
                onChange={(e) => setVerificationData(prev => ({ ...prev, shift: e.target.value }))}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  backgroundColor: '#ffffff', 
                  color: '#1e293b',
                  minHeight: '38px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="Shift-A (06:00 AM - 02:00 PM)">Shift-A (06:00 AM - 02:00 PM)</option>
                <option value="Shift-B (02:00 PM - 10:00 PM)">Shift-B (02:00 PM - 10:00 PM)</option>
                <option value="Shift-C (10:00 PM - 06:00 AM)">Shift-C (10:00 PM - 06:00 AM)</option>
                <option value="General & Over Time">General & Over Time</option>
                <option value="General">General</option>
                <option value="Over Time">Over Time</option>
                {verificationData.shift && ![
                  'Shift-A (06:00 AM - 02:00 PM)', 'Shift-A',
                  'Shift-B (02:00 PM - 10:00 PM)', 'Shift-B',
                  'Shift-C (10:00 PM - 06:00 AM)', 'Shift-C',
                  'General & Over Time', 'General', 'Over Time'
                ].includes(verificationData.shift) && (
                  <option value={verificationData.shift}>{verificationData.shift}</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Production Incharge Sign</label>
              <input 
                type="text" 
                value={verificationData.productionIncharge}
                onChange={(e) => setVerificationData(prev => ({ ...prev, productionIncharge: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>QC Technologist</label>
              <input 
                type="text" 
                value={verificationData.qcTechnologist}
                onChange={(e) => setVerificationData(prev => ({ ...prev, qcTechnologist: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>QA Manager Sign</label>
              <input 
                type="text" 
                value={verificationData.qaManager}
                onChange={(e) => setVerificationData(prev => ({ ...prev, qaManager: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Final Approval Status</label>
              <select 
                value={
                  (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'REJECTED') ? 'REJECTED' :
                  (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'PENDING') ? 'PENDING' :
                  'APPROVED'
                }
                onChange={(e) => setVerificationData(prev => ({ ...prev, finalApproval: e.target.value }))}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  fontSize: '13px',
                  fontWeight: 'bold',
                  minHeight: '38px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  backgroundColor: (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'APPROVED') ? '#dcfce7' : (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'REJECTED') ? '#fee2e2' : '#fef3c7',
                  color: (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'APPROVED') ? '#15803d' : (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'REJECTED') ? '#b91c1c' : '#d97706',
                  border: (verificationData.finalApproval && verificationData.finalApproval.toUpperCase() === 'APPROVED') ? '1px solid #86efac' : '1px solid #cbd5e1'
                }}
              >
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
                {verificationData.finalApproval && !['APPROVED', 'Approved', 'PENDING', 'Pending', 'REJECTED', 'Rejected'].includes(verificationData.finalApproval) && (
                  <option value={verificationData.finalApproval}>{String(verificationData.finalApproval).toUpperCase()}</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Verification Remarks</label>
              <input 
                type="text" 
                value={verificationData.remarks}
                onChange={(e) => setVerificationData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Final verification notes or approval authorization..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>
      </EntrySection>

      <EntryActions 
        onSave={handleSave}
        saving={loading}
        saveText="Save"
      />
    </div>
  );
};

export default GrainsCreation;
