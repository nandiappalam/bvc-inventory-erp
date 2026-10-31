import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Box, Grid, Typography, CircularProgress, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { createMaster, invalidateMasterCache } from '../../services/masterservice.js';
import api from '../../services/api.js';

export const MASTER_CONFIGS = {
  suppliers: {
    title: 'Create New Supplier',
    table: 'suppliers',
    key: 'suppliers',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Supplier Name', required: true, fullWidth: true },
      { name: 'phone', label: 'Mobile / Phone', required: false },
      { name: 'contact_person', label: 'Contact Person', required: false },
      { name: 'city', label: 'City', required: false },
      { name: 'state', label: 'State', required: false },
      { name: 'address', label: 'Address', required: false, multiline: true, fullWidth: true },
      { name: 'gst_no', label: 'GSTIN / TIN', required: false },
      { name: 'email', label: 'Email', required: false }
    ]
  },
  customers: {
    title: 'Create New Customer',
    table: 'customers',
    key: 'customers',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Customer Name', required: true, fullWidth: true },
      { name: 'phone', label: 'Mobile / Phone', required: false },
      { name: 'contact_person', label: 'Contact Person', required: false },
      { name: 'city', label: 'City', required: false },
      { name: 'state', label: 'State', required: false },
      { name: 'address', label: 'Address', required: false, multiline: true, fullWidth: true },
      { name: 'gst_no', label: 'GSTIN / TIN', required: false },
      { name: 'email', label: 'Email', required: false }
    ]
  },
  godowns: {
    title: 'Create New Godown',
    table: 'godowns',
    key: 'godowns',
    labelField: 'godown_name',
    fields: [
      { name: 'godown_name', label: 'Godown Name', required: true, fullWidth: true },
      { name: 'location', label: 'Location / City', required: false },
      { name: 'capacity_bags', label: 'Capacity (Bags)', required: false, type: 'number' },
      { name: 'incharge', label: 'Godown Incharge Name', required: false },
      { name: 'address', label: 'Full Address', required: false, multiline: true, fullWidth: true }
    ]
  },
  weights: {
    title: 'Enter New Weight Master',
    table: 'weights',
    key: 'weights',
    labelField: 'displayName',
    fields: [
      { name: 'weight_val', label: 'Weight Value', required: true, type: 'number', placeholder: 'e.g. 75' },
      { name: 'uom', label: 'Unit (UOM)', required: true, type: 'select', options: ['KG', 'MT', 'BAG', 'GRAMS'], defaultValue: 'KG' },
      { name: 'weight_name', label: 'Display Name / Alias', required: false, placeholder: 'Auto-generated e.g. 75 KG' },
      { name: 'description', label: 'Notes / Description', required: false, fullWidth: true }
    ]
  },
  items: {
    title: 'Create New Item',
    table: 'items',
    key: 'items',
    labelField: 'item_name',
    fields: [
      { name: 'item_name', label: 'Item Name', required: true, fullWidth: true },
      { name: 'item_code', label: 'Item Code / SKU', required: false, placeholder: 'Auto-generated e.g. ITM-001' },
      { name: 'item_group', label: 'Item Group', required: false, defaultValue: 'General' },
      { name: 'type', label: 'Item Type', required: false, type: 'select', options: ['RM', 'FG', 'SFG', 'PACKAGING', 'GENERAL'], defaultValue: 'RM' },
      { name: 'unit', label: 'Standard UOM', required: false, type: 'select', options: ['KG', 'BAG', 'MT', 'NOS'], defaultValue: 'KG' },
      { name: 'weight', label: 'Standard Bag Weight (KG)', required: false, type: 'number', defaultValue: '50' }
    ]
  },
  transports: {
    title: 'Create New Transporter',
    table: 'transports',
    key: 'transports',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Transporter Name', required: true, fullWidth: true },
      { name: 'phone', label: 'Contact Number / Mobile', required: false },
      { name: 'lorry_no', label: 'Default Vehicle / Lorry No', required: false },
      { name: 'address', label: 'Office Address', required: false, multiline: true, fullWidth: true },
      { name: 'gst_no', label: 'GSTIN', required: false }
    ]
  },
  workers: {
    title: 'Register New Loadman / Worker',
    table: 'workers',
    key: 'workers',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Loadman / Worker Name', required: true, fullWidth: true, placeholder: 'e.g. ' },
      { name: 'category', label: 'Role Category', required: true, type: 'select', options: ['LOADMAN', 'UNLOAD_WORKER', 'HELPER', 'LABOUR', 'EXTERNAL_MILL'], defaultValue: 'LOADMAN' },
      { name: 'phone', label: 'Mobile Number', required: false, placeholder: 'e.g. 9842112345' },
      { name: 'per_kg_amount', label: 'Per KG Method Amount', type: 'number', defaultValue: 0 },
      { name: 'period_duration', label: 'Amount Period Duration', type: 'text', placeholder: 'e.g. Weekly, Monthly' },
      { name: 'payment_mode', label: 'Preferred Payment Mode', required: false, type: 'select', options: ['CASH', 'BANK', 'UPI'], defaultValue: 'CASH' },
      { name: 'upi_id', label: 'UPI / Bank Details', required: false, fullWidth: true }
    ]
  },
  loadman: {
    title: 'Register New Loadman Team / Worker',
    table: 'workers',
    key: 'loadman',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Loadman / Team Name', required: true, fullWidth: true, placeholder: 'e.g. ' },
      { name: 'category', label: 'Role Category', required: true, type: 'select', options: ['LOADMAN', 'UNLOAD_WORKER', 'HELPER', 'LABOUR'], defaultValue: 'LOADMAN' },
      { name: 'phone', label: 'Mobile Number', required: false, placeholder: 'e.g. 9842112345' },
      { name: 'per_kg_amount', label: 'Per KG Method Amount', type: 'number', defaultValue: 0 },
      { name: 'period_duration', label: 'Amount Period Duration', type: 'text', placeholder: 'e.g. Weekly, Monthly' },
      { name: 'payment_mode', label: 'Preferred Payment Mode', required: false, type: 'select', options: ['CASH', 'BANK', 'UPI'], defaultValue: 'CASH' },
      { name: 'upi_id', label: 'UPI / Bank Details', required: false, fullWidth: true }
    ]
  },
  drivers: {
    title: 'Register New Driver',
    table: 'drivers',
    key: 'drivers',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Driver Full Name', required: true, fullWidth: true },
      { name: 'phone', label: 'Mobile Number', required: false },
      { name: 'notes', label: 'License No / Notes', required: false, fullWidth: true },
      { name: 'payment_mode', label: 'Preferred Payment Mode', required: false, type: 'select', options: ['CASH', 'BANK', 'UPI'], defaultValue: 'CASH' }
    ]
  },
  flour_mills: {
    title: 'Create New Flour Mill',
    table: 'flour_mills',
    key: 'flour_mills',
    labelField: 'flourmill',
    fields: [
      { name: 'flourmill', label: 'Flour Mill Name', required: true, fullWidth: true },
      { name: 'contact_person', label: 'Contact Person', required: false },
      { name: 'mobile', label: 'Mobile Number', required: false },
      { name: 'address', label: 'Mill Address', required: false, multiline: true, fullWidth: true },
      { name: 'gst_no', label: 'GSTIN', required: false }
    ]
  },
  papad_companies: {
    title: 'Create New Papad Company',
    table: 'papad_companies',
    key: 'papad_companies',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Papad Company Name', required: true, fullWidth: true },
      { name: 'contact_person', label: 'Contact Person', required: false },
      { name: 'mobile', label: 'Mobile Number', required: false },
      { name: 'address', label: 'Company Address', required: false, multiline: true, fullWidth: true },
      { name: 'email', label: 'Email', required: false }
    ]
  },
  senders: {
    title: 'Create New Sender Group',
    table: 'senders',
    key: 'senders',
    labelField: 'sender_name',
    fields: [
      { name: 'sender_name', label: 'Sender Name', required: true, fullWidth: true },
      { name: 'group_name', label: 'Sender Group', required: false },
      { name: 'phone', label: 'Phone', required: false },
      { name: 'address', label: 'Address', required: false, multiline: true, fullWidth: true }
    ]
  },
  consignees: {
    title: 'Create New Consignee Group',
    table: 'consignees',
    key: 'consignees',
    labelField: 'consignee_name',
    fields: [
      { name: 'consignee_name', label: 'Consignee Name', required: true, fullWidth: true },
      { name: 'group_name', label: 'Consignee Group', required: false },
      { name: 'phone', label: 'Phone', required: false },
      { name: 'gst_no', label: 'GSTIN', required: false },
      { name: 'address', label: 'Address', required: false, multiline: true, fullWidth: true }
    ]
  },
  areas: {
    title: 'Create New Area Master',
    table: 'areas',
    key: 'areas',
    labelField: 'area_name',
    fields: [
      { name: 'area_name', label: 'Area Name', required: true, fullWidth: true },
      { name: 'pincode', label: 'Pincode', required: false },
      { name: 'city', label: 'City', required: false }
    ]
  },
  cities: {
    title: 'Create New City Master',
    table: 'cities',
    key: 'cities',
    labelField: 'city_name',
    fields: [
      { name: 'city_name', label: 'City Name', required: true, fullWidth: true },
      { name: 'state', label: 'State', required: false, defaultValue: 'Tamil Nadu' },
      { name: 'pincode', label: 'Pincode', required: false }
    ]
  },
  item_groups: {
    title: 'Create New Item Group',
    table: 'item_groups',
    key: 'item_groups',
    labelField: 'group_name',
    fields: [
      { name: 'group_name', label: 'Item Group Name', required: true, fullWidth: true },
      { name: 'description', label: 'Description', required: false, multiline: true, fullWidth: true }
    ]
  },
  vehicles: {
    title: 'Register New Vehicle Master',
    table: 'vehicles',
    key: 'vehicles',
    labelField: 'vehicle_no',
    fields: [
      { name: 'vehicle_no', label: 'Vehicle / Lorry No', required: true, fullWidth: true, placeholder: 'e.g. TN-59-AB-1234' },
      { name: 'vehicle_type', label: 'Vehicle Type', required: false, type: 'select', options: ['Lorry', 'Container', 'Pickup', 'Trailer', 'Mini Truck', 'Other'], defaultValue: 'Lorry' },
      { name: 'transporter_name', label: 'Transporter Name', required: false },
      { name: 'driver_name', label: 'Driver Name', required: false },
      { name: 'phone', label: 'Contact Phone', required: false }
    ]
  },
  deductions: {
    title: 'Create New Deduction Master',
    table: 'deduction_purchase',
    key: 'deductions',
    labelField: 'ded_name',
    fields: [
      { name: 'ded_name', label: 'Deduction Name', required: true, fullWidth: true, placeholder: 'e.g. Moisture Deduction, Brokerage, Quality Cut' },
      { name: 'ded_code', label: 'Deduction Code', required: false, placeholder: 'Auto-generated or e.g. DED-01' },
      { name: 'type', label: 'Type (Add / Less)', required: true, type: 'select', options: ['Less', 'Add'], defaultValue: 'Less' },
      { name: 'calc_type', label: 'Calculation Type', required: true, type: 'select', options: ['Percentage', 'Amount'], defaultValue: 'Percentage' },
      { name: 'ded_value', label: 'Default Value', required: false, type: 'number', defaultValue: '0', placeholder: 'e.g. 1.5% or ₹100' },
      { name: 'account_head', label: 'Account Head / Remarks', required: false, fullWidth: true }
    ]
  },
  deduction_purchase: {
    title: 'Create New Purchase Deduction Master',
    table: 'deduction_purchase',
    key: 'deduction_purchase',
    labelField: 'ded_name',
    fields: [
      { name: 'ded_name', label: 'Deduction Name', required: true, fullWidth: true, placeholder: 'e.g. Moisture Deduction, Brokerage, Quality Cut' },
      { name: 'ded_code', label: 'Deduction Code', required: false, placeholder: 'Auto-generated or e.g. DED-01' },
      { name: 'type', label: 'Type (Add / Less)', required: true, type: 'select', options: ['Less', 'Add'], defaultValue: 'Less' },
      { name: 'calc_type', label: 'Calculation Type', required: true, type: 'select', options: ['Percentage', 'Amount'], defaultValue: 'Percentage' },
      { name: 'ded_value', label: 'Default Value', required: false, type: 'number', defaultValue: '0', placeholder: 'e.g. 1.5% or ₹100' },
      { name: 'account_head', label: 'Account Head / Remarks', required: false, fullWidth: true }
    ]
  },
  deduction_sales: {
    title: 'Create New Sales Deduction Master',
    table: 'deduction_sales',
    key: 'deduction_sales',
    labelField: 'ded_name',
    fields: [
      { name: 'ded_name', label: 'Deduction Name', required: true, fullWidth: true, placeholder: 'e.g. Cash Discount, Trade Rebate' },
      { name: 'ded_code', label: 'Deduction Code', required: false, placeholder: 'Auto-generated or e.g. DED-S01' },
      { name: 'ded_type', label: 'Type (Add / Less)', required: true, type: 'select', options: ['Less', 'Add'], defaultValue: 'Less' },
      { name: 'calc_type', label: 'Calculation Type', required: true, type: 'select', options: ['Percentage', 'Amount'], defaultValue: 'Percentage' },
      { name: 'ded_value', label: 'Default Value', required: false, type: 'number', defaultValue: '0' },
      { name: 'account_head', label: 'Account Head / Remarks', required: false, fullWidth: true }
    ]
  },
  sign: {
    title: 'Create New Signature',
    table: 'sign_master',
    key: 'sign',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Signer Name', required: true, fullWidth: true },
      { name: 'designation', label: 'Designation', required: false },
      { name: 'signature_image', label: 'Signature Image (Base64/URL)', required: false, multiline: true, fullWidth: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], defaultValue: 'Active' }
    ]
  },
  terms: {
    title: 'Create New Terms',
    table: 'terms_master',
    key: 'terms',
    labelField: 'term_name',
    fields: [
      { name: 'term_name', label: 'Term Name', required: true, fullWidth: true },
      { name: 'description', label: 'Description', required: false, multiline: true, fullWidth: true }
    ]
  }
};

export const normalizeMasterType = (rawType) => {
  if (!rawType) return 'suppliers';
  let k = String(rawType).trim().toLowerCase();
  if (k.endsWith('_master')) k = k.replace(/_master$/, '');
  if (k === 'supplier' || k === 'suppliers' || k === 'supplier_id' || k === 'suppliername') return 'suppliers';
  if (k === 'customer' || k === 'customers' || k === 'customer_id' || k === 'customername' || k === 'exporter' || k === 'buyer') return 'customers';
  if (k === 'godown' || k === 'godowns' || k === 'godown_id' || k === 'godown_from' || k === 'godown_to' || k === 'from_godown' || k === 'to_godown') return 'godowns';
  if (k === 'weight' || k === 'weights' || k === 'weightmaster' || k === 'weight_id' || k === 'wt') return 'weights';
  if (k === 'item' || k === 'items' || k === 'item_id') return 'items';
  if (k === 'transport' || k === 'transports' || k === 'transporter' || k === 'transporters' || k === 'transport_id') return 'transports';
  if (k === 'worker' || k === 'workers' || k === 'loadman' || k === 'loadmen' || k === 'loadman_team' || k === 'loadman_name' || k === 'operational_parties') return 'workers';
  if (k === 'driver' || k === 'drivers') return 'drivers';
  if (k === 'flour_mill' || k === 'flour_mills' || k === 'flourmill') return 'flour_mills';
  if (k === 'papad_company' || k === 'papad_companies' || k === 'papadcomp') return 'papad_companies';
  if (k === 'sign' || k === 'signs' || k === 'sign_id' || k === 'signid') return 'sign';
  if (k === 'term' || k === 'terms') return 'terms';
  if (k === 'sender' || k === 'senders') return 'senders';
  if (k === 'consignee' || k === 'consignees') return 'consignees';
  if (k === 'area' || k === 'areas') return 'areas';
  if (k === 'city' || k === 'cities') return 'cities';
  if (k === 'item_group' || k === 'item_groups') return 'item_groups';
  if (k === 'vehicle' || k === 'vehicles') return 'vehicles';
  if (k === 'deduction' || k === 'deductions' || k === 'deduction_purchase' || k === 'purchase_deductions') return 'deductions';
  if (k === 'deduction_sales' || k === 'sales_deductions') return 'deduction_sales';
  return k;
};

export const getCreateLabel = (rawType) => {
  const rawLower = String(rawType || '').toLowerCase();
  if (rawLower.includes('loadman')) return '+ Enter Loadman Manually';
  if (rawLower.includes('worker')) return '+ Enter Worker Manually';
  const norm = normalizeMasterType(rawType);
  if (norm === 'weights' || norm === 'weight') return '+ Enter Weight Manually';
  if (norm === 'godowns' || norm === 'godown') return '+ Enter Godown Manually';
  if (norm === 'suppliers' || norm === 'supplier') return '+ Enter Supplier Manually';
  if (norm === 'customers' || norm === 'customer') return '+ Enter Customer Manually';
  if (norm === 'items' || norm === 'item') return '+ Enter Item Manually';
  if (norm === 'transports' || norm === 'transport' || norm === 'transporter') return '+ Enter Transporter Manually';
  if (norm === 'workers' || norm === 'worker') return '+ Enter Worker Manually';
  if (norm === 'drivers' || norm === 'driver') return '+ Enter Driver Manually';
  if (norm === 'flour_mills' || norm === 'flour_mill') return '+ Enter Flour Mill Manually';
  if (norm === 'papad_companies' || norm === 'papad_company') return '+ Enter Papad Company Manually';
  if (norm === 'senders' || norm === 'sender') return '+ Enter Sender Manually';
  if (norm === 'consignees' || norm === 'consignee') return '+ Enter Consignee Manually';
  if (norm === 'areas' || norm === 'area') return '+ Enter Area Manually';
  if (norm === 'cities' || norm === 'city') return '+ Enter City Manually';
  if (norm === 'item_groups' || norm === 'item_group') return '+ Enter Item Group Manually';
  if (norm === 'vehicles' || norm === 'vehicle') return '+ Enter Vehicle Manually';
  if (norm === 'deductions' || norm === 'deduction' || norm === 'deduction_purchase' || norm === 'deduction_sales') return '+ Enter Deduction Manually';
  const pretty = norm.replace(/_/g, ' ').replace(/s$/, '');
  const capitalized = pretty.charAt(0).toUpperCase() + pretty.slice(1);
  return `+ Enter ${capitalized} Manually`;
};

export const InlineMasterModal = ({ open, onClose, masterType, initialName = '', onSuccess }) => {
  const normType = normalizeMasterType(masterType);
  const config = MASTER_CONFIGS[normType] || MASTER_CONFIGS.suppliers;

  const [formState, setFormState] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      const initial = {};
      (config.fields || []).forEach(f => {
        initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
      });
      // Pre-fill primary name field if initialName provided
      const nameField = config.fields[0]?.name || 'name';
      if (initialName && !initial[nameField]) {
        initial[nameField] = initialName;
      }
      setFormState(initial);
    }
  }, [open, masterType, initialName]);

  const handleFieldChange = (name, value) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setError('');
    // Validation
    for (const f of config.fields) {
      if (f.required && (!formState[f.name] || String(formState[f.name]).trim() === '')) {
        setError(`${f.label} is required`);
        return;
      }
    }

    setLoading(true);
    try {
      let createdRecord = null;
      let newId = null;

      if (normType === 'weights') {
        const wtVal = Number(formState.weight_val || formState.weight || 0);
        const uomVal = formState.uom || 'KG';
        const displayName = formState.weight_name || `${wtVal} ${uomVal}`;
        const payload = {
          weight_val: wtVal,
          weight: wtVal,
          uom: uomVal,
          unit: uomVal,
          weight_name: displayName,
          name: displayName,
          printname: displayName,
          status: 'Active',
          description: formState.description || `${wtVal} ${uomVal}`
        };
        const res = await createMaster('weights', payload);
        if (res && (res.id || res.success)) {
          newId = res.id;
          createdRecord = { id: newId, weight: wtVal, weight_val: wtVal, kg: wtVal, uom: uomVal, name: displayName, printname: displayName, label: displayName, value: displayName };
        } else {
          throw new Error(res?.message || res?.error || 'Failed to save weight master');
        }
      } else if (normType === 'workers' || normType === 'drivers' || normType === 'loadman') {
        const roleCategory = normType === 'drivers' ? 'DRIVER' : (formState.category || 'LOADMAN');
        const payload = {
          name: formState.name,
          category: roleCategory,
          party_category: roleCategory,
          phone: formState.phone || '',
          whatsapp_number: formState.phone || '',
          default_payment_mode: formState.payment_mode || 'CASH',
          payment_mode: formState.payment_mode || 'CASH',
          upi_id: formState.upi_id || '',
          notes: formState.notes || '',
          is_active: 1
        };
        const res = await api('/operational-charges/parties', { method: 'POST', body: payload });
        if (res && (res.data?.id || res.id || res.success)) {
          newId = res.data?.id || res.id;
          createdRecord = {
            ...(res.data || {}),
            id: newId,
            name: formState.name,
            worker_name: formState.name,
            label: formState.name,
            value: formState.name,
            category: payload.category
          };
        } else {
          throw new Error(res?.error || res?.message || 'Failed to save worker/loadman master');
        }
      } else if (normType === 'deductions' || normType === 'deduction_purchase' || normType === 'deduction_sales') {
        const dedName = formState.ded_name || formState.name || 'New Deduction';
        const payload = {
          ...formState,
          ded_code: formState.ded_code || `DED-${Date.now().toString().slice(-5)}`,
          ded_name: dedName,
          name: dedName,
          print_name: formState.print_name || dedName,
          type: formState.type || formState.ded_type || 'Less',
          ded_type: formState.type || formState.ded_type || 'Less',
          calc_type: formState.calc_type || 'Percentage',
          calculation_type: formState.calc_type || 'Percentage',
          ded_value: parseFloat(formState.ded_value || formState.deduction_value || 0),
          deduction_value: parseFloat(formState.ded_value || formState.deduction_value || 0),
          status: 'Active'
        };
        const res = await createMaster(config.table, payload);
        if (res && (res.id || res.success)) {
          newId = res.id;
          createdRecord = res.data || { id: newId, idVal: newId, ...payload, ded_name: dedName, name: dedName, label: dedName, value: newId };
        } else {
          throw new Error(res?.message || res?.error || 'Failed to save deduction master');
        }
      } else {
        // Standard master table POST
        const res = await createMaster(config.table, formState);
        if (res && (res.id || res.success)) {
          newId = res.id;
          const primaryName = formState[config.fields[0]?.name] || 'New Record';
          createdRecord = res.data || { id: newId, idVal: newId, name: primaryName, [config.labelField]: primaryName, label: primaryName, value: primaryName };
        } else {
          throw new Error(res?.message || res?.error || `Failed to save ${config.title}`);
        }
      }

      invalidateMasterCache(normType);
      invalidateMasterCache(config.table);
      invalidateMasterCache('workers');
      invalidateMasterCache('loadman');
      invalidateMasterCache('operational_parties');

      if (onSuccess) {
        onSuccess(newId, createdRecord || formState);
      }
      onClose();
    } catch (err) {
      console.error(`Error creating ${normType}:`, err);
      setError(err.message || 'Failed to save record. Please check the inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth id="inline-master-dialog">
      <DialogTitle sx={{ fontWeight: 800, bgcolor: '#1e3a8a', color: '#ffffff', py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon /> {config.title}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontWeight: 600 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2}>
          {config.fields.map((f) => (
            <Grid item xs={12} sm={f.fullWidth ? 12 : 6} key={f.name}>
              {f.type === 'select' ? (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={f.label + (f.required ? ' *' : '')}
                  value={formState[f.name] || f.defaultValue || ''}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                >
                  {(f.options || []).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  type={f.type || 'text'}
                  label={f.label + (f.required ? ' *' : '')}
                  placeholder={f.placeholder || ''}
                  value={formState[f.name] || ''}
                  onChange={(e) => handleFieldChange(f.name, e.target.value)}
                  multiline={f.multiline}
                  rows={f.multiline ? 2 : 1}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{ bgcolor: '#1e3a8a', fontWeight: 700, px: 3 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? 'Saving...' : `Save ${config.title.replace(/^Create New\s*|^Register New\s*|^Enter New\s*/i, '')}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InlineMasterModal;
