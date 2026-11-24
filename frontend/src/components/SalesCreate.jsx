import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/api.js';
import { calculateLineTax, isInterState as checkInterState, normalizeStateCode, round2 } from '../services/taxService';
import { EntryTaxBillDetails } from './entry';
import { InlineMasterModal, getCreateLabel } from './common/InlineMasterModal.jsx';
import SalesDistributionWorkflow from './common/SalesDistributionWorkflow.jsx';
import { printOutpassDocument } from '../utils/movementPrintTemplates';
import './SalesCreate.css';

const TABS = [
  { id: 'all', num: '1–7', label: 'All Sections (1–7)' },
  { id: 'customer', num: '1', label: 'Customer & Invoice' },
  { id: 'items', num: '2', label: 'Items & Lots' },
  { id: 'weighment', num: '3', label: 'Weighment Box' },
  { id: 'transport', num: '4', label: 'Transport, Outpass & Freight' },
  { id: 'tax', num: '5', label: 'Charges, Tax & Deductions' },
  { id: 'payment', num: '6', label: 'Payment & Receipt' },
  { id: 'dispatch', num: '7', label: 'Dispatch & Documents' }
];

const PAYMENT_TERMS_OPTIONS = [
  'Immediate',
  '7 Days',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  'Advance'
];

const INDIAN_STATES = [
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Puducherry', code: '34' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  { name: 'Other Territory / Foreign', code: '96' }
];

const EMPTY_ROW = {
  item_id: '',
  product_code: '',
  item_name: '',
  category: 'FG',
  hsn_code: '',
  godown_id: '',
  godown_name: '',
  lot_no: '',
  parent_rm_lot_no: '',
  package_type: 'Bag',
  package_tare_wt: '0',
  uom: 'KG',
  weight: '50',
  qty: '',
  net_product_wt: '',
  rate: '',
  rate_type: 'Per Kg',
  disc: '0',
  tax_rate: '5',
  tax_type: 'Taxable',
  allocated_load_wt: '0',
  box: '0',
  amount: 0
};

function parseTermsDays(terms) {
  const s = String(terms || '').toLowerCase();
  if (!s || s.includes('immediate') || s.includes('advance') || s === '0') return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function addDaysIso(baseDate, days) {
  if (!baseDate) return '';
  const d = new Date(`${String(baseDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(baseDate).slice(0, 10);
  d.setUTCDate(d.getUTCDate() + (parseInt(days, 10) || 0));
  return d.toISOString().slice(0, 10);
}

function computeRowFinancials(row, formData, companyProfile) {
  const qty = Math.max(0, parseFloat(row.qty) || 0);
  const unitWt = Math.max(0, parseFloat(row.weight) || 0);
  const pkgTarePerUnit = Math.max(0, parseFloat(row.package_tare_wt) || 0);
  const explicitNetWt = parseFloat(row.net_product_wt);
  const netProductWt = Number.isFinite(explicitNetWt) && row.net_product_wt !== ''
    ? explicitNetWt
    : Number((qty * unitWt).toFixed(3));
  const rateType = row.rate_type || 'Per Kg';
  const billUnits = (String(rateType).toLowerCase() === 'per kg' && netProductWt > 0) ? netProductWt : qty;

  const calc = calculateLineTax({
    qty: billUnits,
    rate: parseFloat(row.rate) || 0,
    discPercent: parseFloat(row.disc) || 0,
    taxType: row.tax_type || 'Taxable',
    taxMode: formData.tax_type || 'Exclusive',
    gstRate: row.tax_rate !== '' && row.tax_rate !== undefined ? row.tax_rate : (formData.tax_percent || 5),
    hsnCode: row.hsn_code || '',
    companyState: companyProfile?.state || 'Tamil Nadu',
    companyStateCode: companyProfile?.state_code || '33',
    partyState: formData.party_state || companyProfile?.state || 'Tamil Nadu',
    partyStateCode: formData.party_state_code || normalizeStateCode(formData.party_state || companyProfile?.state || 'Tamil Nadu')
  });

  return {
    qty,
    unitWt,
    pkgTareTotal: Number((qty * pkgTarePerUnit).toFixed(3)),
    netProductWt,
    billUnits,
    ...calc
  };
}

const SalesCreate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const fromOrderId = searchParams.get('fromOrder');
  const isOrder = location.pathname.includes('order');

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [activeTab, setActiveTab] = useState('all');
  const showSection = useCallback((tabId) => activeTab === 'all' || activeTab === tabId, [activeTab]);

  const [lookups, setLookups] = useState({
    company: { name: 'BVC Exports Pvt Ltd', state: 'Tamil Nadu', state_code: '33', gst_number: '' },
    customers: [],
    items: [],
    godowns: [],
    transports: [],
    workers: [],
    weights: [],
    cashBankLedgers: [],
    deductions: [],
    nextOutpassNo: 'OP-00001',
    nextSalesNo: '1',
    nextOrderNo: '1'
  });
  const [availableLots, setAvailableLots] = useState([]);

  const [formData, setFormData] = useState({
    s_no: '',
    date: todayIso,
    financial_year: '',
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    stock_type: 'FG',
    pack_type: 'Pack',
    sales_category: 'Domestic',
    sales_order_ref: '',
    sales_order_id: '',
    customer_po_no: '',
    p_o_no: '',
    payment_terms: '15 Days',
    due_date: addDaysIso(todayIso, 15),
    delivery_date: todayIso,
    sales_person: '',
    tax_percent: 5,
    customer_id: '',
    customer_name: '',
    customer_code: '',
    customer_type: 'Regular',
    customer_gstin: '',
    party_state: 'Tamil Nadu',
    party_state_code: '33',
    place_of_supply: 'Tamil Nadu (33)',
    address: '',
    billing_address: '',
    shipping_address: '',
    contact_person: '',
    phone: '',
    email: '',
    credit_limit: 0,
    customer_outstanding: 0,
    godown_from_id: '',
    godown_from_name: '',
    weighment_mode: 'Manual Weighment',
    vehicle_gross_weight: '',
    vehicle_tare_weight: '',
    net_load_weight: 0,
    weighment_date: todayIso,
    weighment_time: '',
    weighbridge_name: '',
    weighment_slip_no: '',
    weighed_by: '',
    auto_outpass: true,
    outpass_id: '',
    outpass_no: '',
    outpass_status: '',
    loading_location: '',
    delivery_location: '',
    transport_mode: 'Third Party',
    transporter_id: '',
    pur_trans: '',
    transporter_gstin: '',
    lorry_no: '',
    vehicle_type: 'Truck',
    driver: '',
    driver_mobile: '',
    lr_no: '',
    lr_date: '',
    expected_delivery_date: '',
    actual_delivery_date: '',
    loadman_name: '',
    loadman_worker_id: '',
    loadman_rate_per_kg: '0.50',
    loadman_charges: 0,
    freight_type: 'Fixed',
    freight_rate: '',
    freight_amount: '',
    freight_paid_by: 'Buyer',
    recover_freight_on_invoice: false,
    freight_payment_status: 'Pending',
    freight_voucher_no: '',
    loading_charges_amt: '',
    other_charges: '',
    tcs_amount: '',
    round_off: '',
    payment_mode: 'Credit',
    received_amount: '',
    advance_adjusted: '',
    balance_receivable: 0,
    bank_account_id: '',
    bank_account_name: '',
    transaction_ref: '',
    payment_date: todayIso,
    receipt_voucher_no: '',
    dispatch_no: '',
    dispatch_datetime: '',
    dispatch_status: isOrder ? 'Sales Order' : 'Loaded',
    delivery_challan_no: '',
    eway_bill_no: '',
    eway_bill_validity: '',
    irn_no: '',
    ack_no: '',
    received_by: '',
    delivery_remarks: '',
    remarks: '',
    deduction: '',
    deduction_remarks: ''
  });

  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [selectedDeductions, setSelectedDeductions] = useState([
    { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
  ]);
  const [inlineModal, setInlineModal] = useState({ open: false, masterType: 'deduction_sales', rowIdx: null });
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLookupsAndLots = useCallback(async () => {
    try {
      const [lkRes, lotsRes] = await Promise.all([
        api('/sales/form-lookups'),
        api('/sales/available-lots')
      ]);
      if (lkRes && lkRes.success !== false) {
        const raw = lkRes.data || lkRes;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const normalized = {
            company: raw.company || { name: 'BVC Exports Pvt Ltd', state: 'Tamil Nadu', state_code: '33', gst_number: '' },
            customers: Array.isArray(raw.customers) ? raw.customers : [],
            items: Array.isArray(raw.items) ? raw.items : [],
            godowns: Array.isArray(raw.godowns) ? raw.godowns : [],
            transports: Array.isArray(raw.transports) ? raw.transports : [],
            workers: Array.isArray(raw.workers) ? raw.workers : [],
            weights: Array.isArray(raw.weights) ? raw.weights : [],
            cashBankLedgers: Array.isArray(raw.cashBankLedgers) ? raw.cashBankLedgers : [],
            deductions: Array.isArray(raw.deductions) ? raw.deductions : [],
            nextOutpassNo: raw.nextOutpassNo || 'OP-00001',
            nextSalesNo: raw.nextSalesNo || '1',
            nextOrderNo: raw.nextOrderNo || '1'
          };
          setLookups(normalized);
          if (!editId) {
            const defGodown = normalized.godowns[0];
            const nextSno = isOrder ? normalized.nextOrderNo : normalized.nextSalesNo;
            const cashBank = normalized.cashBankLedgers[0];
            setFormData((prev) => ({
              ...prev,
              s_no: String(nextSno || prev.s_no || '1'),
              outpass_no: isOrder ? '' : (prev.outpass_no || normalized.nextOutpassNo || 'OP-00001'),
              dispatch_status: isOrder ? 'Sales Order' : (prev.dispatch_status === 'Sales Order' ? 'Loaded' : prev.dispatch_status),
              godown_from_id: prev.godown_from_id || (defGodown?.id ? String(defGodown.id) : ''),
              godown_from_name: prev.godown_from_name || defGodown?.godown_name || '',
              loading_location: prev.loading_location || defGodown?.godown_name || 'Main Godown',
              bank_account_id: prev.bank_account_id || (cashBank?.id ? String(cashBank.id) : ''),
              bank_account_name: prev.bank_account_name || cashBank?.name || ''
            }));
          }
        }
      } else if (lkRes?.message) {
        setError(lkRes.message);
      }

      if (lotsRes && lotsRes.success !== false && Array.isArray(lotsRes.data)) {
        setAvailableLots(lotsRes.data);
      }
    } catch (err) {
      console.error('Error loading sales lookups:', err);
    }
  }, [editId, isOrder]);

  useEffect(() => {
    loadLookupsAndLots();
  }, [loadLookupsAndLots]);

  // Load existing sale when editing
  useEffect(() => {
    if (!editId) return;
    let mounted = true;
    const loadRecord = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api(`/sales/${editId}`);
        if (!mounted || !data || data.success === false) {
          if (mounted && data?.message) setError(data.message);
          return;
        }

        const saleDate = data.date ? String(data.date).substring(0, 10) : todayIso;
        setFormData((prev) => ({
          ...prev,
          s_no: data.s_no || '',
          date: saleDate,
          financial_year: data.financial_year || '',
          pay_type: data.pay_type || 'Credit',
          tax_type: data.tax_type || 'Exclusive',
          stock_type: data.stock_type || 'FG',
          pack_type: data.pack_type || 'Pack',
          sales_category: data.sales_category || 'Domestic',
          sales_order_ref: data.sales_order_ref || '',
          sales_order_id: data.sales_order_id || '',
          customer_po_no: data.customer_po_no || data.p_o_no || '',
          p_o_no: data.p_o_no || data.customer_po_no || '',
          payment_terms: data.payment_terms || '15 Days',
          due_date: data.due_date || addDaysIso(saleDate, 15),
          delivery_date: data.delivery_date || saleDate,
          sales_person: data.sales_person || '',
          tax_percent: data.tax_percent || 5,
          customer_id: data.customer_id ? String(data.customer_id) : (data.customer || ''),
          customer_name: data.customer || '',
          customer_code: data.customer_code || '',
          customer_type: data.customer_type || 'Regular',
          customer_gstin: data.customer_gstin || '',
          party_state: data.party_state || 'Tamil Nadu',
          party_state_code: data.party_state_code || '33',
          place_of_supply: data.place_of_supply || `${data.party_state || 'Tamil Nadu'} (${data.party_state_code || '33'})`,
          address: data.billing_address || data.address || '',
          billing_address: data.billing_address || data.address || '',
          shipping_address: data.shipping_address || data.delivery_location || data.billing_address || data.address || '',
          contact_person: data.contact_person || '',
          phone: data.phone || '',
          email: data.email || '',
          credit_limit: data.credit_limit || 0,
          customer_outstanding: data.customer_outstanding || 0,
          godown_from_id: data.godown_from_id ? String(data.godown_from_id) : prev.godown_from_id,
          godown_from_name: data.godown_from_name || prev.godown_from_name,
          weighment_mode: data.weighment_mode || 'Manual Weighment',
          vehicle_gross_weight: data.vehicle_gross_weight ? String(data.vehicle_gross_weight) : '',
          vehicle_tare_weight: data.vehicle_tare_weight ? String(data.vehicle_tare_weight) : '',
          net_load_weight: data.net_load_weight || 0,
          weighment_date: data.weighment_date || saleDate,
          weighment_time: data.weighment_time || '',
          weighbridge_name: data.weighbridge_name || '',
          weighment_slip_no: data.weighment_slip_no || '',
          weighed_by: data.weighed_by || '',
          auto_outpass: data.auto_outpass !== undefined ? Number(data.auto_outpass) === 1 : true,
          outpass_id: data.outpass_id || '',
          outpass_no: data.outpass_no || '',
          outpass_status: data.outpass_status || '',
          loading_location: data.loading_location || data.godown_from_name || '',
          delivery_location: data.delivery_location || data.shipping_address || '',
          transport_mode: data.transport_mode || 'Third Party',
          transporter_id: data.transporter_id ? String(data.transporter_id) : '',
          pur_trans: data.pur_trans || '',
          transporter_gstin: data.transporter_gstin || '',
          lorry_no: data.lorry_no || '',
          vehicle_type: data.vehicle_type || 'Truck',
          driver: data.driver || '',
          driver_mobile: data.driver_mobile || '',
          lr_no: data.lr_no || '',
          lr_date: data.lr_date || '',
          expected_delivery_date: data.expected_delivery_date || '',
          actual_delivery_date: data.actual_delivery_date || '',
          loadman_name: data.loadman_name || '',
          loadman_worker_id: data.loadman_worker_id ? String(data.loadman_worker_id) : '',
          loadman_rate_per_kg: data.loadman_rate_per_kg !== undefined ? String(data.loadman_rate_per_kg) : '0.50',
          loadman_charges: data.loadman_charges || 0,
          freight_type: data.freight_type || 'Fixed',
          freight_rate: data.freight_rate ? String(data.freight_rate) : '',
          freight_amount: data.freight_amount ? String(data.freight_amount) : '',
          freight_paid_by: data.freight_paid_by || 'Buyer',
          recover_freight_on_invoice: Number(data.recover_freight_on_invoice) === 1,
          freight_payment_status: data.freight_payment_status || 'Pending',
          freight_voucher_no: data.freight_voucher_no || '',
          loading_charges_amt: data.loading_charges_amt ? String(data.loading_charges_amt) : '',
          other_charges: data.other_charges ? String(data.other_charges) : '',
          tcs_amount: data.tcs_amount ? String(data.tcs_amount) : '',
          round_off: data.round_off ? String(data.round_off) : '',
          payment_mode: data.payment_mode || data.pay_type || 'Credit',
          received_amount: data.received_amount ? String(data.received_amount) : '',
          advance_adjusted: data.advance_adjusted ? String(data.advance_adjusted) : '',
          balance_receivable: data.balance_receivable || 0,
          bank_account_id: data.bank_account_id ? String(data.bank_account_id) : prev.bank_account_id,
          bank_account_name: data.bank_account_name || prev.bank_account_name,
          transaction_ref: data.transaction_ref || '',
          payment_date: data.payment_date || saleDate,
          receipt_voucher_no: data.receipt_voucher_no || '',
          dispatch_no: data.dispatch_no || '',
          dispatch_datetime: data.dispatch_datetime || '',
          dispatch_status: data.dispatch_status || 'Invoice Created',
          delivery_challan_no: data.delivery_challan_no || data.outpass_no || '',
          eway_bill_no: data.eway_bill_no || '',
          eway_bill_validity: data.eway_bill_validity || '',
          irn_no: data.irn_no || '',
          ack_no: data.ack_no || '',
          received_by: data.received_by || '',
          delivery_remarks: data.delivery_remarks || '',
          remarks: data.remarks || '',
          deduction: data.deduction || '',
          deduction_remarks: data.deduction_remarks || ''
        }));

        if (Array.isArray(data.deductions) && data.deductions.length > 0) {
          setSelectedDeductions(
            data.deductions.map((d) => ({
              deduction_id: String(d.deduction_id || d.id || ''),
              name: d.name || d.ded_name || '',
              type: String(d.type || 'LESS').toUpperCase() === 'ADD' ? 'ADD' : 'LESS',
              percent: d.percent !== undefined && d.percent !== null ? String(d.percent) : '',
              amount: d.amount !== undefined && d.amount !== null ? String(d.amount) : '',
              remarks: d.remarks || ''
            }))
          );
        }

        if (Array.isArray(data.items) && data.items.length > 0) {
          setRows(
            data.items.map((it) => ({
              item_id: it.item_id ? String(it.item_id) : '',
              product_code: it.product_code || '',
              item_name: it.item_name || '',
              category: it.category || data.stock_type || 'FG',
              hsn_code: it.hsn_code || '',
              godown_id: it.godown_id ? String(it.godown_id) : (data.godown_from_id ? String(data.godown_from_id) : ''),
              godown_name: it.godown_name || data.godown_from_name || '',
              lot_no: it.lot_no || '',
              parent_rm_lot_no: it.parent_rm_lot_no || '',
              package_type: it.package_type || 'Bag',
              package_tare_wt: String(it.package_tare_wt ?? 0),
              uom: it.uom || 'KG',
              weight: String(it.weight ?? 50),
              qty: String(it.qty ?? ''),
              net_product_wt: String(it.net_product_wt || it.total_wt || ''),
              rate: String(it.rate ?? ''),
              rate_type: it.rate_type || 'Per Kg',
              disc: String(it.disc_perc ?? it.disc ?? 0),
              tax_rate: String(it.gst_rate ?? it.tax_perc ?? it.tax_rate ?? 5),
              tax_type: it.tax_type || 'Taxable',
              allocated_load_wt: String(it.allocated_load_wt ?? 0),
              box: String(it.box ?? 0),
              amount: it.total_amt || 0
            }))
          );
        }
      } catch (err) {
        if (mounted) setError('Error loading sales record: ' + err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRecord();
    return () => {
      mounted = false;
    };
  }, [editId, todayIso]);

  // Customer selection -> fetch credit limit, outstanding, GSTIN, state & addresses
  const handleCustomerChange = useCallback(async (custKey) => {
    if (custKey === '__NEW_CUSTOMER__' || custKey === 'create_new') {
      setInlineModal({ open: true, masterType: 'customers', rowIdx: null });
      return;
    }
    const matched = (lookups.customers || []).find((c) => String(c.id) === String(custKey) || c.name === custKey);
    const keyToFetch = matched ? matched.id : custKey;
    setFormData((prev) => ({ ...prev, customer_id: String(keyToFetch || '') }));
    if (!keyToFetch) return;

    try {
      const res = await api(`/sales/customer-context/${encodeURIComponent(keyToFetch)}`);
      const ctx = res?.data;
      if (ctx) {
        setFormData((prev) => {
          const termsStr = ctx.limit_days > 0 ? `${ctx.limit_days} Days` : prev.payment_terms;
          return {
            ...prev,
            customer_id: String(ctx.id),
            customer_name: ctx.name,
            customer_code: ctx.customer_code || '',
            customer_type: ctx.customer_type || 'Regular',
            customer_gstin: ctx.gst_number || '',
            party_state: ctx.state || 'Tamil Nadu',
            party_state_code: ctx.state_code || '33',
            place_of_supply: `${ctx.state || 'Tamil Nadu'} (${ctx.state_code || '33'})`,
            address: ctx.billing_address || '',
            billing_address: ctx.billing_address || '',
            shipping_address: ctx.shipping_address || ctx.billing_address || '',
            delivery_location: prev.delivery_location || ctx.shipping_address || '',
            contact_person: ctx.contact_person || '',
            phone: ctx.mobile || '',
            email: ctx.email || '',
            credit_limit: Number(ctx.credit_limit || 0),
            customer_outstanding: Number(ctx.current_outstanding || 0),
            pur_trans: prev.pur_trans || ctx.transport || '',
            payment_terms: termsStr,
            due_date: addDaysIso(prev.date, parseTermsDays(termsStr))
          };
        });
      }
    } catch (err) {
      console.warn('Could not load customer context:', err.message);
    }
  }, [lookups.customers]);

  const handlePlaceOfSupplyChange = (val) => {
    const matchedState = INDIAN_STATES.find(s => `${s.name} (${s.code})` === val || s.name === val);
    const stateName = matchedState ? matchedState.name : val;
    const stateCode = matchedState ? matchedState.code : '33';
    setFormData(prev => ({
      ...prev,
      place_of_supply: `${stateName} (${stateCode})`,
      party_state: stateName,
      party_state_code: stateCode
    }));
  };

  // Live financial & weight summary derived strictly from state (zero infinite effect loops)
  const summary = useMemo(() => {
    const compState = lookups.company?.state || 'Tamil Nadu';
    const compCode = lookups.company?.state_code || '33';
    const isInterState = checkInterState(compState, formData.party_state, compCode, formData.party_state_code);
    const isWithoutTax = String(formData.tax_type || '').toLowerCase().includes('without');

    let totalQty = 0;
    let totalProductNetWt = 0;
    let totalPkgTareWt = 0;
    let grossAmt = 0;
    let discAmt = 0;
    let billAmt = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;
    let taxAmt = 0;
    let itemsTotalAmt = 0;
    const rateSummaryMap = {};

    const computedRows = rows.map((row) => {
      const c = computeRowFinancials(row, formData, lookups.company);
      totalQty += c.qty;
      totalProductNetWt += c.netProductWt;
      totalPkgTareWt += c.pkgTareTotal;
      grossAmt += c.grossAmount;
      discAmt += c.discAmount;
      billAmt += c.taxableAmount;
      cgstAmt += c.cgstAmount;
      sgstAmt += c.sgstAmount;
      igstAmt += c.igstAmount;
      taxAmt += c.totalTax;
      itemsTotalAmt += c.totalAmount;

      const rk = `${c.taxType}_${c.gstRate}%`;
      if (!rateSummaryMap[rk]) {
        rateSummaryMap[rk] = {
          taxType: c.taxType,
          gstRate: c.gstRate,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
          totalAmount: 0
        };
      }
      rateSummaryMap[rk].taxableAmount = round2(rateSummaryMap[rk].taxableAmount + c.taxableAmount);
      rateSummaryMap[rk].cgstAmount = round2(rateSummaryMap[rk].cgstAmount + c.cgstAmount);
      rateSummaryMap[rk].sgstAmount = round2(rateSummaryMap[rk].sgstAmount + c.sgstAmount);
      rateSummaryMap[rk].igstAmount = round2(rateSummaryMap[rk].igstAmount + c.igstAmount);
      rateSummaryMap[rk].totalTax = round2(rateSummaryMap[rk].totalTax + c.totalTax);
      rateSummaryMap[rk].totalAmount = round2(rateSummaryMap[rk].totalAmount + c.totalAmount);

      return c;
    });

    totalProductNetWt = Number(totalProductNetWt.toFixed(3));
    totalPkgTareWt = Number(totalPkgTareWt.toFixed(3));
    grossAmt = round2(grossAmt);
    discAmt = round2(discAmt);
    billAmt = round2(billAmt);
    cgstAmt = isWithoutTax || isInterState ? 0 : round2(cgstAmt);
    sgstAmt = isWithoutTax || isInterState ? 0 : round2(sgstAmt);
    igstAmt = isWithoutTax || !isInterState ? 0 : round2(igstAmt);
    taxAmt = isWithoutTax ? 0 : round2(taxAmt);
    itemsTotalAmt = round2(billAmt + taxAmt);

    // Deductions
    let addDed = 0;
    let lessDed = 0;
    selectedDeductions.forEach((d) => {
      const pct = parseFloat(d.percent) || 0;
      const amt = pct > 0 && billAmt > 0 ? round2((billAmt * pct) / 100) : (parseFloat(d.amount) || 0);
      if (amt <= 0) return;
      if (String(d.type || 'LESS').toUpperCase() === 'ADD') addDed += amt;
      else lessDed += amt;
    });
    const manualDed = parseFloat(formData.deduction) || 0;
    lessDed += manualDed;
    const netDeductionAmount = round2(lessDed - addDed);

    // Weighment calculations
    const vGross = Math.max(0, parseFloat(formData.vehicle_gross_weight) || 0);
    const vTare = Math.max(0, parseFloat(formData.vehicle_tare_weight) || 0);
    const netLoadWeight = (vGross > 0 || vTare > 0)
      ? Number(Math.max(0, vGross - vTare).toFixed(3))
      : Number((parseFloat(formData.net_load_weight) || 0).toFixed(3));
    const expectedLoadWt = Number((totalProductNetWt + totalPkgTareWt).toFixed(3));
    const weightVariance = netLoadWeight > 0 ? Number((netLoadWeight - expectedLoadWt).toFixed(3)) : 0;

    // Freight & extra charges
    const freightRateVal = parseFloat(formData.freight_rate) || 0;
    let freightAmt = parseFloat(formData.freight_amount) || 0;
    if (freightRateVal > 0 && formData.freight_type === 'Per Kg') {
      freightAmt = round2(freightRateVal * (totalProductNetWt || netLoadWeight || 0));
    } else if (freightRateVal > 0 && formData.freight_type === 'Per Bag') {
      freightAmt = round2(freightRateVal * totalQty);
    }
    const freightRecoveryAmt = (formData.freight_paid_by === 'Seller' && formData.recover_freight_on_invoice)
      ? round2(freightAmt)
      : 0;
    const loadingChargesAmt = Math.max(0, parseFloat(formData.loading_charges_amt) || 0);
    const otherCharges = Math.max(0, parseFloat(formData.other_charges) || 0);
    const tcsAmount = Math.max(0, parseFloat(formData.tcs_amount) || 0);
    const roundOff = round2(parseFloat(formData.round_off) || 0);

    const grandTotal = round2(Math.max(
      0,
      itemsTotalAmt + freightRecoveryAmt + loadingChargesAmt + otherCharges + tcsAmount + addDed - lessDed + roundOff
    ));

    const receivedAmt = isOrder ? 0 : Math.max(0, parseFloat(formData.received_amount) || 0);
    const advanceAdj = isOrder ? 0 : Math.max(0, parseFloat(formData.advance_adjusted) || 0);
    const balanceReceivable = round2(Math.max(0, grandTotal - receivedAmt - advanceAdj));

    const loadmanCharges = round2(totalProductNetWt * (parseFloat(formData.loadman_rate_per_kg) || 0));

    return {
      isInterState,
      isWithoutTax,
      computedRows,
      rateSummaries: Object.values(rateSummaryMap),
      totalQty: Number(totalQty.toFixed(3)),
      totalProductNetWt,
      totalPkgTareWt,
      expectedLoadWt,
      netLoadWeight,
      weightVariance,
      grossAmt,
      discAmt,
      discPercent: grossAmt > 0 ? round2((discAmt / grossAmt) * 100) : 0,
      billAmt,
      cgstAmt,
      sgstAmt,
      igstAmt,
      taxAmt,
      itemsTotalAmt,
      netDeductionAmount,
      freightAmt: round2(freightAmt),
      freightRecoveryAmt,
      loadingChargesAmt,
      otherCharges,
      tcsAmount,
      roundOff,
      grandTotal,
      receivedAmt,
      advanceAdj,
      balanceReceivable,
      loadmanCharges
    };
  }, [rows, formData, lookups.company, selectedDeductions, isOrder]);

  const creditExceeded = Boolean(
    !isOrder &&
    Number(formData.credit_limit) > 0 &&
    (Number(formData.customer_outstanding || 0) + summary.balanceReceivable) > Number(formData.credit_limit)
  );

  const handleFieldChange = (name, value) => {
    if (name === 'transporter_id' && (value === '__NEW_TRANSPORTER__' || value === 'create_new')) {
      setInlineModal({ open: true, masterType: 'transports', rowIdx: null });
      return;
    }
    if (name === 'loadman_worker_id' && (value === '__NEW_LOADMAN__' || value === 'create_new')) {
      setInlineModal({ open: true, masterType: 'loadman', rowIdx: null });
      return;
    }
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'payment_terms' || name === 'date') {
        const baseDate = name === 'date' ? value : prev.date;
        const terms = name === 'payment_terms' ? value : prev.payment_terms;
        next.due_date = addDaysIso(baseDate, parseTermsDays(terms));
      }
      if (name === 'party_state') {
        const code = normalizeStateCode(value);
        next.party_state_code = code;
        next.place_of_supply = `${value} (${code})`;
      }
      if (name === 'godown_from_id') {
        const gd = (lookups.godowns || []).find((g) => String(g.id) === String(value));
        next.godown_from_name = gd?.godown_name || '';
        next.loading_location = gd?.godown_name || next.loading_location;
      }
      if (name === 'transporter_id') {
        const tr = (lookups.transports || []).find((t) => String(t.id) === String(value));
        next.pur_trans = tr ? (tr.print_name || tr.name) : '';
      }
      if (name === 'bank_account_id') {
        const acc = (lookups.cashBankLedgers || []).find((a) => String(a.id) === String(value));
        next.bank_account_name = acc?.name || '';
      }
      if (name === 'loadman_worker_id') {
        const wk = (lookups.workers || []).find((w) => String(w.id) === String(value));
        if (wk) {
          next.loadman_name = wk.name || wk.worker_name || '';
          if (Number(wk.per_kg_amount) > 0) {
            next.loadman_rate_per_kg = String(wk.per_kg_amount);
          }
        }
      }
      if (name === 'freight_rate' || name === 'freight_type') {
        const rVal = parseFloat(name === 'freight_rate' ? value : prev.freight_rate) || 0;
        const fType = name === 'freight_type' ? value : prev.freight_type;
        if (rVal > 0 && fType === 'Per Kg') {
          next.freight_amount = String(round2(rVal * (summary.totalProductNetWt || summary.netLoadWeight || 0)));
        } else if (rVal > 0 && fType === 'Per Bag') {
          next.freight_amount = String(round2(rVal * summary.totalQty));
        }
      }
      if (name === 'freight_paid_by' && value === 'Buyer') {
        next.recover_freight_on_invoice = false;
      }
      return next;
    });
  };

  const handleRowFieldChange = (idx, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      const current = { ...updated[idx], [field]: value };

      if (field === 'item_id' || field === 'item_name') {
        const matched = (lookups.items || []).find(
          (it) => (field === 'item_id' ? String(it.id) === String(value) : it.item_name === value)
        );
        if (matched) {
          current.item_id = String(matched.id);
          current.item_name = matched.item_name;
          current.product_code = matched.item_code || '';
          current.hsn_code = matched.hsn_code || '';
          current.category = matched.stock_category || formData.stock_type || 'FG';
          current.uom = matched.unit || 'KG';
          current.weight = String(matched.weight || 50);
          current.tax_rate = String(matched.gst_rate ?? matched.tax ?? 5);
          current.lot_no = '';
          current.parent_rm_lot_no = '';
          if (current.qty) {
            current.net_product_wt = String(Number(((parseFloat(current.qty) || 0) * (parseFloat(current.weight) || 0)).toFixed(3)));
          }
        }
      } else if (field === 'lot_no') {
        const matchedLot = (availableLots || []).find(
          (l) =>
            l.lot_no === value &&
            (!current.item_name || String(l.item_name || '').toLowerCase() === String(current.item_name || '').toLowerCase())
        );
        if (matchedLot) {
          current.parent_rm_lot_no = matchedLot.parent_rm_lot_no || '';
          if (matchedLot.godown_id) {
            current.godown_id = String(matchedLot.godown_id);
            current.godown_name = matchedLot.godown_name || '';
          }
          if (matchedLot.unit_weight) {
            current.weight = String(matchedLot.unit_weight);
          }
          if (!current.rate && matchedLot.rate) {
            current.rate = String(matchedLot.rate);
          }
          if (current.qty) {
            current.net_product_wt = String(Number(((parseFloat(current.qty) || 0) * (parseFloat(current.weight) || 0)).toFixed(3)));
          }
        }
      } else if (field === 'godown_id') {
        const gd = (lookups.godowns || []).find((g) => String(g.id) === String(value));
        current.godown_name = gd?.godown_name || '';
      } else if (field === 'qty' || field === 'weight') {
        const q = parseFloat(field === 'qty' ? value : current.qty) || 0;
        const w = parseFloat(field === 'weight' ? value : current.weight) || 0;
        current.net_product_wt = q > 0 && w > 0 ? String(Number((q * w).toFixed(3))) : '';
      }

      updated[idx] = current;
      return updated;
    });
  };

  const addItemRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const splitItemRow = (idx) => {
    setRows((prev) => {
      const src = prev[idx];
      const clone = {
        ...src,
        lot_no: '',
        parent_rm_lot_no: '',
        qty: '',
        net_product_wt: '',
        allocated_load_wt: '0',
        amount: 0
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  };

  const deleteItemRow = (idx) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAllocateLoadWeights = () => {
    const netLoad = summary.netLoadWeight;
    if (!(netLoad > 0)) return;
    const baseWt = summary.totalProductNetWt > 0 ? summary.totalProductNetWt : summary.totalQty;
    if (!(baseWt > 0)) return;

    let running = 0;
    setRows((prev) =>
      prev.map((row, idx) => {
        const rowBase = summary.totalProductNetWt > 0
          ? (parseFloat(row.net_product_wt) || ((parseFloat(row.qty) || 0) * (parseFloat(row.weight) || 0)))
          : (parseFloat(row.qty) || 0);
        let alloc = 0;
        if (idx === prev.length - 1) {
          alloc = Number(Math.max(0, netLoad - running).toFixed(3));
        } else {
          alloc = Number(((rowBase / baseWt) * netLoad).toFixed(3));
          running += alloc;
        }
        return { ...row, allocated_load_wt: String(alloc) };
      })
    );
  };

  const handleAutoRoundOff = () => {
    const preRound = summary.grandTotal - summary.roundOff;
    const rounded = Math.round(preRound);
    const diff = Number((rounded - preRound).toFixed(2));
    handleFieldChange('round_off', String(diff));
  };

  const handleDeductionRowChange = (index, field, value) => {
    if (field === 'deduction_id' && (value === '__CREATE_NEW__' || value === 'create_new')) {
      setInlineModal({ open: true, masterType: 'deduction_sales', rowIdx: index });
      return;
    }
    setSelectedDeductions((prev) => {
      const updated = [...prev];
      const nextRow = { ...updated[index], [field]: value };
      if (field === 'deduction_id') {
        const ded = (lookups.deductions || []).find((d) => String(d.id) === String(value));
        if (ded) {
          const dVal = parseFloat(ded.ded_value) || 0;
          const optType = String(ded.ded_type || ded.type || ded.deduction_type || '').toUpperCase();
          const isAdd = optType === 'ADD' || optType === 'ADDITION' || (ded.ded_name && ded.ded_name.toLowerCase().includes('tcs'));
          const isPct = ded.ded_type === 'Percentage' || ded.calc_type === 'Percentage';
          nextRow.name = ded.ded_name || '';
          nextRow.type = isAdd ? 'ADD' : 'LESS';
          nextRow.percent = isPct ? String(dVal) : '';
          nextRow.amount = isPct ? ((summary.billAmt * dVal) / 100).toFixed(2) : String(dVal);
        }
      } else if (field === 'percent') {
        const pct = parseFloat(value) || 0;
        if (pct > 0) nextRow.amount = ((summary.billAmt * pct) / 100).toFixed(2);
      }
      updated[index] = nextRow;
      return updated;
    });
  };

  const handleInlineCreated = async (newId, createdRecord) => {
    const { masterType, rowIdx } = inlineModal;
    await loadLookupsAndLots();
    setInlineModal({ open: false, masterType: 'deduction_sales', rowIdx: null });

    const createdIdStr = newId ? String(newId) : (createdRecord?.id ? String(createdRecord.id) : '');
    if (masterType === 'customers' && (createdIdStr || createdRecord?.name)) {
      await handleCustomerChange(createdIdStr || createdRecord.name);
    } else if (masterType === 'transports' && (createdIdStr || createdRecord?.name)) {
      setFormData((prev) => ({
        ...prev,
        transporter_id: createdIdStr,
        pur_trans: createdRecord?.print_name || createdRecord?.name || prev.pur_trans,
        transporter_gstin: createdRecord?.gst_no || prev.transporter_gstin,
        lorry_no: prev.lorry_no || createdRecord?.lorry_no || ''
      }));
    } else if ((masterType === 'loadman' || masterType === 'workers') && (createdIdStr || createdRecord?.name)) {
      setFormData((prev) => ({
        ...prev,
        loadman_worker_id: createdIdStr,
        loadman_name: createdRecord?.name || createdRecord?.worker_name || prev.loadman_name,
        loadman_rate_per_kg: Number(createdRecord?.per_kg_amount) > 0
          ? String(createdRecord.per_kg_amount)
          : prev.loadman_rate_per_kg
      }));
    } else if (masterType === 'deduction_sales' && rowIdx !== null && createdRecord) {
      const dVal = parseFloat(createdRecord.ded_value ?? createdRecord.deduction_value ?? 0) || 0;
      const optType = String(createdRecord.ded_type || createdRecord.type || '').toUpperCase();
      const isAdd = optType === 'ADD' || optType === 'ADDITION';
      const isPct = String(createdRecord.calc_type || '').toLowerCase() === 'percentage';
      setSelectedDeductions((prev) => {
        const updated = [...prev];
        if (!updated[rowIdx]) return prev;
        updated[rowIdx] = {
          ...updated[rowIdx],
          deduction_id: createdIdStr,
          name: createdRecord.ded_name || createdRecord.name || '',
          type: isAdd ? 'ADD' : 'LESS',
          percent: isPct ? String(dVal) : '',
          amount: isPct ? ((summary.billAmt * dVal) / 100).toFixed(2) : String(dVal)
        };
        return updated;
      });
    } else if (masterType === 'items' && createdRecord) {
      const itemName = createdRecord.item_name || createdRecord.name || '';
      if (itemName) {
        setRows((prev) => {
          const emptyIdx = prev.findIndex((r) => !r.item_name);
          const newItemFields = {
            ...EMPTY_ROW,
            item_id: createdIdStr,
            item_name: itemName,
            product_code: createdRecord.item_code || '',
            hsn_code: createdRecord.hsn_code || '',
            uom: createdRecord.unit || 'KG',
            weight: String(createdRecord.weight || 50),
            tax_rate: String(createdRecord.gst_rate ?? createdRecord.tax ?? 5)
          };
          if (emptyIdx >= 0) {
            const copy = [...prev];
            copy[emptyIdx] = newItemFields;
            return copy;
          }
          return [...prev, newItemFields];
        });
      }
    }
  };

  const handleWorkflowImport = useCallback(async (sourceRecord) => {
    if (!sourceRecord) return;
    const custKey = sourceRecord.customer_id || sourceRecord.customer || '';

    // Fetch live customer context first so Sales Order overrides NEVER get overwritten asynchronously
    let ctx = null;
    if (custKey) {
      try {
        const res = await api(`/sales/customer-context/${encodeURIComponent(custKey)}`);
        ctx = res?.data || null;
      } catch (err) {
        console.warn('Could not load customer context during import:', err.message);
      }
    }

    const resolvedState =
      sourceRecord.party_state ||
      ctx?.state ||
      'Tamil Nadu';
    const resolvedStateCode =
      sourceRecord.party_state_code ||
      normalizeStateCode(resolvedState, ctx?.state_code || '33');
    const resolvedPos =
      sourceRecord.place_of_supply ||
      `${resolvedState} (${resolvedStateCode})`;

    setFormData((prev) => ({
      ...prev,
      // Keep newly generated Invoice No / Outpass No
      s_no: prev.s_no,
      outpass_no: prev.outpass_no,
      sales_order_id: isOrder ? prev.sales_order_id : (sourceRecord.id || prev.sales_order_id),
      sales_order_ref: isOrder
        ? (sourceRecord.bill_no ? `QTN-${sourceRecord.bill_no}` : prev.sales_order_ref)
        : (sourceRecord.s_no ? `SO-${sourceRecord.s_no}` : (sourceRecord.bill_no || prev.sales_order_ref)),
      customer_po_no: sourceRecord.customer_po_no || sourceRecord.p_o_no || prev.customer_po_no,
      p_o_no: sourceRecord.p_o_no || sourceRecord.customer_po_no || prev.p_o_no,
      // Customer Profile & Credit (Sales Order overrides Master Context)
      customer_id: sourceRecord.customer_id ? String(sourceRecord.customer_id) : (ctx?.id ? String(ctx.id) : String(custKey || prev.customer_id)),
      customer_name: sourceRecord.customer_name || (!/^\d+$/.test(String(sourceRecord.customer || '').trim()) ? sourceRecord.customer : '') || ctx?.name || prev.customer_name,
      customer_code: sourceRecord.customer_code || ctx?.customer_code || prev.customer_code,
      customer_type: sourceRecord.customer_type || ctx?.customer_type || prev.customer_type,
      customer_gstin: sourceRecord.customer_gstin || ctx?.gst_number || prev.customer_gstin,
      party_state: resolvedState,
      party_state_code: resolvedStateCode,
      place_of_supply: resolvedPos,
      address: sourceRecord.billing_address || sourceRecord.address || ctx?.billing_address || prev.address,
      billing_address: sourceRecord.billing_address || sourceRecord.address || ctx?.billing_address || prev.billing_address,
      shipping_address: sourceRecord.shipping_address || sourceRecord.delivery_location || ctx?.shipping_address || sourceRecord.billing_address || sourceRecord.address || prev.shipping_address,
      contact_person: sourceRecord.contact_person || ctx?.contact_person || prev.contact_person,
      phone: sourceRecord.phone || ctx?.mobile || prev.phone,
      email: sourceRecord.email || ctx?.email || prev.email,
      credit_limit: Number(ctx?.credit_limit ?? sourceRecord.credit_limit ?? prev.credit_limit ?? 0),
      customer_outstanding: Number(ctx?.current_outstanding ?? sourceRecord.customer_outstanding ?? prev.customer_outstanding ?? 0),
      // Invoice / Order Header & Terms
      sales_category: sourceRecord.sales_category || prev.sales_category,
      tax_type: sourceRecord.tax_type || prev.tax_type,
      stock_type: sourceRecord.stock_type || prev.stock_type || 'FG',
      pack_type: sourceRecord.pack_type || prev.pack_type,
      tax_percent: sourceRecord.tax_percent || prev.tax_percent,
      payment_terms: sourceRecord.payment_terms || prev.payment_terms,
      due_date: sourceRecord.due_date || addDaysIso(prev.date, parseTermsDays(sourceRecord.payment_terms || prev.payment_terms)),
      delivery_date: sourceRecord.delivery_date || prev.delivery_date,
      sales_person: sourceRecord.sales_person || prev.sales_person,
      godown_from_id: sourceRecord.godown_from_id ? String(sourceRecord.godown_from_id) : prev.godown_from_id,
      godown_from_name: sourceRecord.godown_from_name || prev.godown_from_name,
      // Weighment Box
      weighment_mode: sourceRecord.weighment_mode || prev.weighment_mode,
      vehicle_gross_weight: Number(sourceRecord.vehicle_gross_weight) > 0 ? String(sourceRecord.vehicle_gross_weight) : '',
      vehicle_tare_weight: Number(sourceRecord.vehicle_tare_weight) > 0 ? String(sourceRecord.vehicle_tare_weight) : '',
      net_load_weight: Number(sourceRecord.net_load_weight || 0),
      weighment_date: sourceRecord.weighment_date || prev.weighment_date,
      weighment_time: sourceRecord.weighment_time || prev.weighment_time,
      weighbridge_name: sourceRecord.weighbridge_name || prev.weighbridge_name,
      weighment_slip_no: sourceRecord.weighment_slip_no || prev.weighment_slip_no,
      weighed_by: sourceRecord.weighed_by || prev.weighed_by,
      // Transport, Outpass & Freight
      loading_location: sourceRecord.loading_location || sourceRecord.godown_from_name || prev.loading_location,
      delivery_location: sourceRecord.delivery_location || sourceRecord.shipping_address || ctx?.shipping_address || prev.delivery_location,
      transport_mode: sourceRecord.transport_mode || prev.transport_mode,
      transporter_id: sourceRecord.transporter_id ? String(sourceRecord.transporter_id) : prev.transporter_id,
      pur_trans: sourceRecord.transporter_name || sourceRecord.pur_trans || ctx?.transport || prev.pur_trans,
      transporter_gstin: sourceRecord.transporter_gstin || prev.transporter_gstin,
      lorry_no: sourceRecord.lorry_no || prev.lorry_no,
      vehicle_type: sourceRecord.vehicle_type || prev.vehicle_type,
      driver: sourceRecord.driver || prev.driver,
      driver_mobile: sourceRecord.driver_mobile || prev.driver_mobile,
      lr_no: sourceRecord.lr_no || prev.lr_no,
      lr_date: sourceRecord.lr_date || prev.lr_date,
      expected_delivery_date: sourceRecord.expected_delivery_date || sourceRecord.delivery_date || prev.expected_delivery_date,
      loadman_name: sourceRecord.loadman_name || prev.loadman_name,
      loadman_worker_id: sourceRecord.loadman_worker_id ? String(sourceRecord.loadman_worker_id) : prev.loadman_worker_id,
      loadman_rate_per_kg: sourceRecord.loadman_rate_per_kg !== undefined && sourceRecord.loadman_rate_per_kg !== null ? String(sourceRecord.loadman_rate_per_kg) : prev.loadman_rate_per_kg,
      loadman_charges: Number(sourceRecord.loadman_charges || 0),
      freight_type: sourceRecord.freight_type || prev.freight_type,
      freight_rate: Number(sourceRecord.freight_rate) > 0 ? String(sourceRecord.freight_rate) : '',
      freight_amount: Number(sourceRecord.freight_amount) > 0 ? String(sourceRecord.freight_amount) : '',
      freight_paid_by: sourceRecord.freight_paid_by || prev.freight_paid_by,
      recover_freight_on_invoice: Number(sourceRecord.recover_freight_on_invoice) === 1 || sourceRecord.recover_freight_on_invoice === true,
      freight_payment_status: sourceRecord.freight_payment_status || prev.freight_payment_status,
      // Additional Charges & Manual Deduction
      loading_charges_amt: Number(sourceRecord.loading_charges_amt) > 0 ? String(sourceRecord.loading_charges_amt) : '',
      other_charges: Number(sourceRecord.other_charges) > 0 ? String(sourceRecord.other_charges) : '',
      tcs_amount: Number(sourceRecord.tcs_amount) > 0 ? String(sourceRecord.tcs_amount) : '',
      round_off: Number(sourceRecord.round_off) !== 0 ? String(sourceRecord.round_off) : '',
      deduction: Number(sourceRecord.deduction) > 0 ? String(sourceRecord.deduction) : '',
      deduction_remarks: sourceRecord.deduction_remarks || '',
      // Payment & Dispatch defaults appropriate for Invoice (NEVER copy 'Sales Order' dispatch_status)
      pay_type: sourceRecord.pay_type || prev.pay_type,
      payment_mode: sourceRecord.payment_mode || sourceRecord.pay_type || prev.payment_mode,
      bank_account_id: sourceRecord.bank_account_id ? String(sourceRecord.bank_account_id) : prev.bank_account_id,
      bank_account_name: sourceRecord.bank_account_name || prev.bank_account_name,
      dispatch_status: isOrder ? 'Sales Order' : (prev.auto_outpass ? 'Loaded' : 'Invoice Created'),
      eway_bill_no: sourceRecord.eway_bill_no || prev.eway_bill_no,
      eway_bill_validity: sourceRecord.eway_bill_validity || prev.eway_bill_validity,
      remarks: sourceRecord.remarks
        ? `Ref: ${sourceRecord.bill_no || `SO-${sourceRecord.s_no || sourceRecord.id}`}. ${sourceRecord.remarks}`.trim()
        : `Ref: ${sourceRecord.bill_no || `SO-${sourceRecord.s_no || sourceRecord.id}`}`
    }));

    if (Array.isArray(sourceRecord.deductions) && sourceRecord.deductions.length > 0) {
      setSelectedDeductions(
        sourceRecord.deductions.map((d) => ({
          deduction_id: String(d.deduction_id || d.id || ''),
          name: d.name || d.ded_name || '',
          type: String(d.type || 'LESS').toUpperCase() === 'ADD' ? 'ADD' : 'LESS',
          percent: d.percent !== undefined && d.percent !== null ? String(d.percent) : '',
          amount: d.amount !== undefined && d.amount !== null ? String(d.amount) : '',
          remarks: d.remarks || ''
        }))
      );
    }

    if (Array.isArray(sourceRecord.items) && sourceRecord.items.length > 0) {
      setRows(
        sourceRecord.items.map((it) => ({
          ...EMPTY_ROW,
          item_id: it.item_id ? String(it.item_id) : '',
          product_code: it.product_code || '',
          item_name: it.item_name || it.description || '',
          category: it.category || sourceRecord.stock_type || 'FG',
          hsn_code: it.hsn_code || '',
          godown_id: it.godown_id ? String(it.godown_id) : (sourceRecord.godown_from_id ? String(sourceRecord.godown_from_id) : ''),
          godown_name: it.godown_name || sourceRecord.godown_from_name || '',
          lot_no: it.lot_no || '',
          parent_rm_lot_no: it.parent_rm_lot_no || '',
          package_type: it.package_type || 'Bag',
          package_tare_wt: String(it.package_tare_wt ?? 0),
          uom: it.uom || 'KG',
          weight: String(parseFloat(it.weight) || 50),
          qty: String(it.qty ?? ''),
          net_product_wt: String(it.net_product_wt || it.total_wt || ((Number(it.qty) || 0) * (parseFloat(it.weight) || 50))),
          rate: String(it.rate ?? ''),
          rate_type: it.rate_type || 'Per Kg',
          disc: String(it.disc_perc ?? it.disc ?? 0),
          tax_rate: String(it.gst_rate ?? it.tax_perc ?? it.tax_rate ?? it.tax ?? 5),
          tax_type: it.tax_type || 'Taxable',
          allocated_load_wt: String(it.allocated_load_wt ?? 0),
          box: String(it.box ?? 0),
          amount: it.total_amt || 0
        }))
      );
    }
    setSuccess('Source Sales Order imported cleanly with all customer, weighment, transport, freight, and item details.');
    setTimeout(() => setSuccess(''), 3500);
  }, [isOrder]);

  // Support direct conversion link /entry/sales-create?fromOrder=<id>
  useEffect(() => {
    if (!fromOrderId || editId || isOrder) return;
    let active = true;
    api(`/sales/${fromOrderId}`)
      .then((res) => {
        if (active && res && res.success !== false && res.id) {
          handleWorkflowImport(res);
        }
      })
      .catch((err) => console.warn('Failed loading fromOrderId:', err.message));
    return () => { active = false; };
  }, [fromOrderId, editId, isOrder, handleWorkflowImport]);

  const handlePrintLinkedOutpass = async () => {
    if (!formData.outpass_id && !formData.outpass_no) return;
    try {
      const res = await api(`/outpasses/${formData.outpass_id || formData.outpass_no}`);
      if (res?.data) {
        printOutpassDocument(res.data, 'ORIGINAL - STORE COPY');
      }
    } catch (err) {
      setError('Could not load linked outpass for printing: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError('');
    setSuccess('');

    if (!formData.customer_id && !formData.customer_name) {
      setError('Please select a Customer in Tab 1 before saving.');
      setActiveTab('customer');
      return;
    }

    const validRows = rows.filter((r) => r.item_name && String(r.item_name).trim() !== '');
    if (validRows.length === 0) {
      setError('Please add at least one valid Item in Tab 2.');
      setActiveTab('items');
      return;
    }

    setLoading(true);
    try {
      const payloadItems = validRows.map((row, idx) => {
        const rIdx = rows.indexOf(row);
        const c = summary.computedRows[rIdx] || computeRowFinancials(row, formData, lookups.company);
        return {
          s_no: idx + 1,
          item_id: row.item_id || null,
          product_code: row.product_code || '',
          itemName: row.item_name,
          item_name: row.item_name,
          category: row.category || formData.stock_type || 'FG',
          hsn_code: row.hsn_code || '',
          godown_id: row.godown_id || formData.godown_from_id || null,
          godown_name: row.godown_name || formData.godown_from_name || '',
          lotNo: row.lot_no || '',
          lot_no: row.lot_no || '',
          parent_rm_lot_no: row.parent_rm_lot_no || '',
          package_type: row.package_type || 'Bag',
          package_tare_wt: parseFloat(row.package_tare_wt) || 0,
          uom: row.uom || 'KG',
          weight: c.unitWt,
          qty: c.qty,
          totalWt: c.netProductWt,
          net_product_wt: c.netProductWt,
          allocated_load_wt: parseFloat(row.allocated_load_wt) || 0,
          rate: parseFloat(row.rate) || 0,
          rate_type: row.rate_type || 'Per Kg',
          disc: parseFloat(row.disc) || 0,
          discPerc: parseFloat(row.disc) || 0,
          disc_amount: c.discAmount,
          taxable_amount: c.taxableAmount,
          tax: parseFloat(row.tax_rate) || 0,
          taxPerc: parseFloat(row.tax_rate) || 0,
          tax_type: row.tax_type || 'Taxable',
          amount: c.totalAmount,
          totalAmt: c.totalAmount,
          box: parseFloat(row.box) || 0
        };
      });

      const validDeductions = selectedDeductions.filter(
        (d) => (d.deduction_id && String(d.deduction_id).trim() !== '') || (d.name && String(d.name).trim() !== '') || parseFloat(d.amount) > 0
      );

      const payload = {
        formData: {
          ...formData,
          customer: formData.customer_id || formData.customer_name,
          is_order: isOrder ? 1 : 0,
          auto_outpass: !isOrder && formData.auto_outpass ? 1 : 0,
          vehicle_gross_weight: parseFloat(formData.vehicle_gross_weight) || 0,
          vehicle_tare_weight: parseFloat(formData.vehicle_tare_weight) || 0,
          net_load_weight: summary.netLoadWeight,
          package_tare_weight: summary.totalPkgTareWt,
          product_net_weight: summary.totalProductNetWt,
          freight_amount: summary.freightAmt,
          freight_recovery_amt: summary.freightRecoveryAmt,
          recover_freight_on_invoice: formData.recover_freight_on_invoice ? 1 : 0,
          loading_charges_amt: summary.loadingChargesAmt,
          other_charges: summary.otherCharges,
          tcs_amount: summary.tcsAmount,
          round_off: summary.roundOff,
          loadman_charges: summary.loadmanCharges,
          gross_amt: summary.grossAmt,
          disc_percent: summary.discPercent,
          disc_amount: summary.discAmt,
          bill_amt: summary.billAmt,
          tax_amt: summary.taxAmt,
          cgst_amt: summary.cgstAmt,
          sgst_amt: summary.sgstAmt,
          igst_amt: summary.igstAmt,
          total_amt: summary.itemsTotalAmt,
          deduction_amount: summary.netDeductionAmount,
          grand_total: summary.grandTotal,
          received_amount: summary.receivedAmt,
          advance_adjusted: summary.advanceAdj,
          balance_receivable: summary.balanceReceivable,
          selectedDeductions: validDeductions
        },
        items: payloadItems,
        totals: {
          totalQty: summary.totalQty,
          totalWeight: summary.totalProductNetWt,
          baseAmount: summary.billAmt,
          taxAmount: summary.taxAmt,
          netAmount: summary.itemsTotalAmt,
          grandTotal: summary.grandTotal
        }
      };

      const res = editId
        ? await api(`/sales/${editId}`, { method: 'PUT', body: payload })
        : await api('/entries/sale', { method: 'POST', body: payload });

      if (res && res.success) {
        const outpassNote = res.outpass_no ? ` · Outpass ${res.outpass_no} Ready` : '';
        const recNote = res.receipt_voucher_no ? ` · Receipt ${res.receipt_voucher_no}` : '';
        setSuccess(`${isOrder ? 'Sales Order' : 'Sales Invoice'} saved (${res.voucher_no || `#${res.s_no}`})${outpassNote}${recNote}`);
        setTimeout(() => {
          navigate(isOrder ? '/entry/sales-order-display' : '/entry/sales-display');
        }, 900);
      } else {
        setError(res?.message || 'Unable to save sales record.');
      }
    } catch (err) {
      setError(err.message || 'Error saving sales record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="window" style={{ padding: '14px 18px 36px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <SalesDistributionWorkflow
        currentModule={isOrder ? 'sales_order' : 'sales'}
        onImportRecord={handleWorkflowImport}
        importButtonText={isOrder ? 'Import from Quotation' : 'Import from Sales Order'}
      />

      {/* Top Header Strip */}
      <div style={ui.headerCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate(isOrder ? '/entry/sales-order-display' : '/entry/sales-display')}
            style={ui.backBtn}
          >
            ← Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {editId ? (isOrder ? 'Update Sales Order' : 'Update Sales Invoice') : (isOrder ? 'New Sales Order' : 'New Sales Invoice & Outpass')}
              </h2>
              <span style={{ ...ui.badge, backgroundColor: isOrder ? '#fef3c7' : '#dbeafe', color: isOrder ? '#92400e' : '#1e40af' }}>
                {isOrder ? `SO #${formData.s_no || 'NEW'}` : `INV #${formData.s_no || 'NEW'}`}
              </span>
              {!isOrder && formData.auto_outpass && (
                <span style={{ ...ui.badge, backgroundColor: '#dcfce7', color: '#166534' }}>
                  🚚 Outpass: {formData.outpass_no || lookups.nextOutpassNo}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {lookups.company?.name} · {summary.isWithoutTax ? 'Without Tax' : (summary.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isOrder && formData.outpass_id && (
            <button type="button" onClick={handlePrintLinkedOutpass} style={ui.secondaryBtn}>
              🚚 Print Outpass ({formData.outpass_no})
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setConfirmState({
                open: true,
                title: 'Reset Sales Form?',
                message: 'Clear all entered items and details on this screen?',
                onConfirm: () => {
                  setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                  window.location.reload();
                }
              })
            }
            style={ui.secondaryBtn}
          >
            ↻ Reset
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirmState({
                open: true,
                title: 'Discard Changes?',
                message: 'Leave this screen and return to the register without saving?',
                onConfirm: () => {
                  setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                  navigate(isOrder ? '/entry/sales-order-display' : '/entry/sales-display');
                }
              })
            }
            style={ui.secondaryBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            style={ui.primaryBtn}
          >
            {loading ? 'Saving...' : (isOrder ? 'Save Sales Order' : 'Save Invoice & Outpass')}
          </button>
        </div>
      </div>

      {/* Persistent KPI Strip */}
      <div style={ui.kpiGrid}>
        <div style={ui.kpiCard}>
          <span style={ui.kpiLabel}>Total Bags / Qty</span>
          <span style={ui.kpiValue}>{summary.totalQty.toLocaleString('en-IN')}</span>
          <span style={ui.kpiSub}>{rows.filter((r) => r.item_name).length} Item Line(s)</span>
        </div>
        <div style={ui.kpiCard}>
          <span style={ui.kpiLabel}>Product Net Wt</span>
          <span style={ui.kpiValue}>{summary.totalProductNetWt.toLocaleString('en-IN')} KG</span>
          <span style={ui.kpiSub}>Pkg Tare: {summary.totalPkgTareWt.toLocaleString('en-IN')} KG</span>
        </div>
        <div style={ui.kpiCard}>
          <span style={ui.kpiLabel}>Weighbridge Net Load</span>
          <span style={ui.kpiValue}>{summary.netLoadWeight.toLocaleString('en-IN')} KG</span>
          <span style={{ ...ui.kpiSub, color: Math.abs(summary.weightVariance) > 5 ? '#b45309' : '#059669' }}>
            {summary.netLoadWeight > 0 ? `Var: ${summary.weightVariance > 0 ? '+' : ''}${summary.weightVariance} KG` : formData.weighment_mode}
          </span>
        </div>
        <div style={ui.kpiCard}>
          <span style={ui.kpiLabel}>Taxable + GST</span>
          <span style={ui.kpiValue}>₹{summary.billAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span style={ui.kpiSub}>Tax: ₹{summary.taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style={ui.kpiCard}>
          <span style={ui.kpiLabel}>Freight & Charges</span>
          <span style={ui.kpiValue}>₹{summary.freightAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span style={ui.kpiSub}>
            {formData.freight_paid_by} {summary.freightRecoveryAmt > 0 ? '(Recovered)' : ''}
          </span>
        </div>
        <div style={{ ...ui.kpiCard, backgroundColor: '#1e3a8a', color: '#ffffff', borderColor: '#1e3a8a' }}>
          <span style={{ ...ui.kpiLabel, color: '#bfdbfe' }}>Grand Total / Bal Due</span>
          <span style={{ ...ui.kpiValue, color: '#ffffff' }}>
            ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span style={{ ...ui.kpiSub, color: '#e0e7ff' }}>
            Due: ₹{summary.balanceReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {error && <div className="alert error" style={{ margin: '0 0 12px 0' }}>{error}</div>}
      {success && <div className="alert success" style={{ margin: '0 0 12px 0' }}>{success}</div>}
      {creditExceeded && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', fontSize: '13px', fontWeight: 600 }}>
          Credit Limit Advisory: Customer Outstanding (₹{Number(formData.customer_outstanding).toLocaleString('en-IN')}) + This Balance (₹{summary.balanceReceivable.toLocaleString('en-IN')}) exceeds Credit Limit (₹{Number(formData.credit_limit).toLocaleString('en-IN')}).
        </div>
      )}

      {/* Tab Navigation Bar */}
      <div style={ui.tabBar}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                ...ui.tabBtn,
                backgroundColor: active ? '#1e40af' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                borderColor: active ? '#1e40af' : '#cbd5e1'
              }}
            >
              <span style={{ ...ui.tabNum, backgroundColor: active ? '#ffffff' : '#e2e8f0', color: active ? '#1e40af' : '#334155' }}>
                {t.num}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* TAB 1: Customer & Invoice Details */}
        {showSection('customer') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 1 · CUSTOMER &amp; {isOrder ? 'SALES ORDER' : 'INVOICE'} DETAILS</span>
              <span style={ui.sectionBannerSub}>Billing, shipping, GSTIN, place of supply &amp; payment terms</span>
            </div>
            <div style={ui.twoColGrid}>
              <div style={ui.subCard}>
                <div style={ui.subTitleRow}>
                  <h3 style={ui.subTitle}>1A. Customer Profile & Credit</h3>
                  <button
                    type="button"
                    onClick={() => setInlineModal({ open: true, masterType: 'customers', rowIdx: null })}
                    style={ui.miniAddBtn}
                  >
                    + New Customer
                  </button>
                </div>

                <div style={ui.formGrid2}>
                  <div style={ui.fieldFull}>
                    <label style={ui.label}>Select Customer *</label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      style={ui.input}
                    >
                      <option value="">-- Choose Customer --</option>
                      <option value="__NEW_CUSTOMER__" style={{ fontWeight: 'bold', color: '#1d4ed8' }}>+ Enter Customer manually / New Customer</option>
                      {(lookups.customers || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.gst_number ? ` (${c.gst_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={ui.label}>Customer Code</label>
                    <input type="text" value={formData.customer_code} onChange={(e) => handleFieldChange('customer_code', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Customer Type</label>
                    <select value={formData.customer_type} onChange={(e) => handleFieldChange('customer_type', e.target.value)} style={ui.input}>
                      <option value="Regular">Regular / Registered</option>
                      <option value="Composition">Composition</option>
                      <option value="Unregistered">Unregistered</option>
                      <option value="Export / SEZ">Export / SEZ</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Customer GSTIN</label>
                    <input type="text" value={formData.customer_gstin} onChange={(e) => handleFieldChange('customer_gstin', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Customer State</label>
                    <input type="text" value={formData.party_state} onChange={(e) => handleFieldChange('party_state', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Contact Person</label>
                    <input type="text" value={formData.contact_person} onChange={(e) => handleFieldChange('contact_person', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Mobile / Phone</label>
                    <input type="text" value={formData.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Credit Limit (₹)</label>
                    <input type="text" readOnly value={`₹${Number(formData.credit_limit || 0).toLocaleString('en-IN')}`} style={{ ...ui.input, backgroundColor: '#f8fafc' }} />
                  </div>
                  <div>
                    <label style={ui.label}>Live Outstanding (₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${Number(formData.customer_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      style={{ ...ui.input, backgroundColor: '#f8fafc', fontWeight: 700, color: creditExceeded ? '#b91c1c' : '#0f172a' }}
                    />
                  </div>
                  <div style={ui.fieldFull}>
                    <label style={ui.label}>Billing Address</label>
                    <textarea rows={2} value={formData.billing_address} onChange={(e) => handleFieldChange('billing_address', e.target.value)} style={ui.textarea} />
                  </div>
                  <div style={ui.fieldFull}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ ...ui.label, marginBottom: 0 }}>Shipping Address</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('shipping_address', formData.billing_address)}
                        style={{ border: 'none', background: 'none', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Copy Billing Address
                      </button>
                    </div>
                    <textarea rows={2} value={formData.shipping_address} onChange={(e) => handleFieldChange('shipping_address', e.target.value)} style={ui.textarea} />
                  </div>
                </div>
              </div>

              <div style={ui.subCard}>
                <h3 style={ui.subTitle}>1B. {isOrder ? 'Sales Order' : 'Invoice'} Header & Terms</h3>
                <div style={ui.formGrid2}>
                  <div>
                    <label style={ui.label}>{isOrder ? 'Order No' : 'Invoice No'}</label>
                    <input type="text" value={formData.s_no} onChange={(e) => handleFieldChange('s_no', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Date *</label>
                    <input type="date" value={formData.date} onChange={(e) => handleFieldChange('date', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Sales Category</label>
                    <select value={formData.sales_category} onChange={(e) => handleFieldChange('sales_category', e.target.value)} style={ui.input}>
                      <option value="Domestic">Domestic</option>
                      <option value="Export">Export / LUT</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Tax Mode</label>
                    <select value={formData.tax_type} onChange={(e) => handleFieldChange('tax_type', e.target.value)} style={ui.input}>
                      <option value="Exclusive">Exclusive (Add GST)</option>
                      <option value="Inclusive">Inclusive (GST Included)</option>
                      <option value="Without Tax">Without Tax (0%)</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Stock Category</label>
                    <select value={formData.stock_type} onChange={(e) => handleFieldChange('stock_type', e.target.value)} style={ui.input}>
                      <option value="FG">FG (Finished Goods)</option>
                      <option value="RM">RM (Raw Material)</option>
                      <option value="Vacuum">Vacuum Pack</option>
                      <option value="All">All Stock Categories</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Pack Mode</label>
                    <select value={formData.pack_type} onChange={(e) => handleFieldChange('pack_type', e.target.value)} style={ui.input}>
                      <option value="Pack">Pack / Bag</option>
                      <option value="Bulk">Bulk</option>
                      <option value="Loose">Loose</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Customer PO No</label>
                    <input type="text" value={formData.customer_po_no} onChange={(e) => handleFieldChange('customer_po_no', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Sales Order Ref</label>
                    <input type="text" value={formData.sales_order_ref} onChange={(e) => handleFieldChange('sales_order_ref', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Payment Terms</label>
                    <select value={formData.payment_terms} onChange={(e) => handleFieldChange('payment_terms', e.target.value)} style={ui.input}>
                      {PAYMENT_TERMS_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Due Date</label>
                    <input type="date" value={formData.due_date} onChange={(e) => handleFieldChange('due_date', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Delivery Date</label>
                    <input type="date" value={formData.delivery_date} onChange={(e) => handleFieldChange('delivery_date', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Sales Person</label>
                    <input type="text" value={formData.sales_person} onChange={(e) => handleFieldChange('sales_person', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Place of Supply</label>
                    <select
                      value={formData.place_of_supply}
                      onChange={(e) => handlePlaceOfSupplyChange(e.target.value)}
                      style={ui.input}
                    >
                      <option value="">-- Select State & Code --</option>
                      {INDIAN_STATES.map((st) => {
                        const val = `${st.name} (${st.code})`;
                        return (
                          <option key={st.code} value={val}>{val}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Default Dispatch Godown</label>
                    <select value={formData.godown_from_id} onChange={(e) => handleFieldChange('godown_from_id', e.target.value)} style={ui.input}>
                      <option value="">-- Select Godown --</option>
                      {(lookups.godowns || []).map((g) => (
                        <option key={g.id} value={g.id}>{g.godown_name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={ui.fieldFull}>
                    <label style={ui.label}>Remarks / Instructions</label>
                    <textarea rows={2} value={formData.remarks} onChange={(e) => handleFieldChange('remarks', e.target.value)} style={ui.textarea} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Items & Lot Allocation */}
        {showSection('items') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 2 · ITEM LINES, GODOWNS &amp; LOT ALLOCATION</span>
              <span style={ui.sectionBannerSub}>Product selection, FIFO / manual lot allocation &amp; line taxes</span>
            </div>
            <div style={ui.subTitleRow}>
              <div>
                <h3 style={ui.subTitle}>2. Item Lines, Godowns & Lot Allocation</h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Select item & lot to auto-fill godown balance and parent RM genealogy. Use Split Lot to fulfill one product from multiple lots.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setInlineModal({ open: true, masterType: 'items', rowIdx: null })}
                  style={ui.miniAddBtn}
                >
                  + New Item Master
                </button>
                <button type="button" onClick={addItemRow} style={ui.primarySmallBtn}>
                  + Add Item Row
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '2020px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                    <th style={{ ...ui.th, minWidth: '44px', width: '44px', textAlign: 'center' }}>#</th>
                    <th style={{ ...ui.th, minWidth: '230px' }}>Item Name</th>
                    <th style={{ ...ui.th, minWidth: '165px' }}>Godown</th>
                    <th style={{ ...ui.th, minWidth: '230px' }}>Lot No (Live Bal)</th>
                    <th style={{ ...ui.th, minWidth: '135px' }}>Parent RM Lot</th>
                    <th style={{ ...ui.th, minWidth: '100px' }}>Qty</th>
                    <th style={{ ...ui.th, minWidth: '95px' }}>Unit Wt</th>
                    <th style={{ ...ui.th, minWidth: '105px' }}>Pkg Tare/U</th>
                    <th style={{ ...ui.th, minWidth: '125px' }}>Net Prod Wt</th>
                    <th style={{ ...ui.th, minWidth: '115px' }}>Rate (₹)</th>
                    <th style={{ ...ui.th, minWidth: '125px' }}>Rate Type</th>
                    <th style={{ ...ui.th, minWidth: '88px' }}>Disc%</th>
                    <th style={{ ...ui.th, minWidth: '94px' }}>GST%</th>
                    <th style={{ ...ui.th, minWidth: '132px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ ...ui.th, minWidth: '105px', textAlign: 'right' }}>Load Wt</th>
                    <th style={{ ...ui.th, minWidth: '120px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows || []).map((row, idx) => {
                    const calc = summary.computedRows[idx] || { taxableAmount: 0, totalAmount: 0, netProductWt: 0 };
                    const matchingLots = (availableLots || []).filter(
                      (l) => !row.item_name || String(l.item_name || '').toLowerCase() === String(row.item_name || '').toLowerCase()
                    );
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ ...ui.td, textAlign: 'center', fontWeight: 700, minWidth: '44px' }}>{idx + 1}</td>
                        <td style={{ ...ui.td, minWidth: '230px' }}>
                          <select
                            value={row.item_name}
                            onChange={(e) => handleRowFieldChange(idx, 'item_name', e.target.value)}
                            style={ui.cellInput}
                          >
                            <option value="">-- Select Item --</option>
                            {(lookups.items || []).map((it) => (
                              <option key={it.id} value={it.item_name}>
                                {it.item_name}{it.item_code ? ` (${it.item_code})` : ''}
                              </option>
                            ))}
                          </select>
                          {row.product_code && (
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                              Code: {row.product_code} {row.hsn_code ? `| HSN: ${row.hsn_code}` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ ...ui.td, minWidth: '165px' }}>
                          <select
                            value={row.godown_id}
                            onChange={(e) => handleRowFieldChange(idx, 'godown_id', e.target.value)}
                            style={ui.cellInput}
                          >
                            <option value="">-- Godown --</option>
                            {(lookups.godowns || []).map((g) => (
                              <option key={g.id} value={g.id}>{g.godown_name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ ...ui.td, minWidth: '230px' }}>
                          {isOrder ? (
                            <>
                              <input
                                type="text"
                                list={`so-lot-options-${idx}`}
                                placeholder="Select or Enter Lot No"
                                value={row.lot_no}
                                onChange={(e) => handleRowFieldChange(idx, 'lot_no', e.target.value)}
                                style={ui.cellInput}
                              />
                              <datalist id={`so-lot-options-${idx}`}>
                                {matchingLots.map((l, lIdx) => (
                                  <option key={`${l.lot_no}-${l.godown_id}-${lIdx}`} value={l.lot_no}>
                                    {l.lot_no} ({l.godown_name}: {l.available_qty} / {l.available_weight}kg)
                                  </option>
                                ))}
                              </datalist>
                            </>
                          ) : (
                            <select
                              value={row.lot_no}
                              onChange={(e) => handleRowFieldChange(idx, 'lot_no', e.target.value)}
                              style={ui.cellInput}
                            >
                              <option value="">-- FIFO Auto / Select Lot --</option>
                              {matchingLots.map((l, lIdx) => (
                                <option key={`${l.lot_no}-${l.godown_id}-${lIdx}`} value={l.lot_no}>
                                  {l.lot_no} ({l.godown_name}: {l.available_qty} / {l.available_weight}kg)
                                </option>
                              ))}
                              {row.lot_no && !matchingLots.some((l) => l.lot_no === row.lot_no) && (
                                <option value={row.lot_no}>{row.lot_no} (Saved)</option>
                              )}
                            </select>
                          )}
                        </td>
                        <td style={{ ...ui.td, minWidth: '135px' }}>
                          <input
                            type="text"
                            value={row.parent_rm_lot_no}
                            onChange={(e) => handleRowFieldChange(idx, 'parent_rm_lot_no', e.target.value)}
                            style={ui.cellInput}
                            placeholder="-"
                          />
                        </td>
                        <td style={{ ...ui.td, minWidth: '100px' }}>
                          <input
                            type="number"
                            step="any"
                            value={row.qty}
                            onChange={(e) => handleRowFieldChange(idx, 'qty', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right', fontWeight: 700 }}
                            placeholder="0"
                          />
                        </td>
                        <td style={{ ...ui.td, minWidth: '95px' }}>
                          <input
                            type="number"
                            step="any"
                            value={row.weight}
                            onChange={(e) => handleRowFieldChange(idx, 'weight', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right' }}
                          />
                        </td>
                        <td style={ui.td}>
                          <input
                            type="number"
                            step="any"
                            value={row.package_tare_wt}
                            onChange={(e) => handleRowFieldChange(idx, 'package_tare_wt', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right' }}
                          />
                        </td>
                        <td style={ui.td}>
                          <input
                            type="number"
                            step="any"
                            value={row.net_product_wt !== '' ? row.net_product_wt : calc.netProductWt}
                            onChange={(e) => handleRowFieldChange(idx, 'net_product_wt', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right', fontWeight: 700, color: '#1e3a8a' }}
                          />
                        </td>
                        <td style={ui.td}>
                          <input
                            type="number"
                            step="any"
                            value={row.rate}
                            onChange={(e) => handleRowFieldChange(idx, 'rate', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right' }}
                            placeholder="0.00"
                          />
                        </td>
                        <td style={ui.td}>
                          <select
                            value={row.rate_type}
                            onChange={(e) => handleRowFieldChange(idx, 'rate_type', e.target.value)}
                            style={ui.cellInput}
                          >
                            <option value="Per Kg">Per Kg</option>
                            <option value="Per Bag">Per Bag</option>
                            <option value="Per Box">Per Box</option>
                            <option value="Per Unit">Per Unit</option>
                          </select>
                        </td>
                        <td style={ui.td}>
                          <input
                            type="number"
                            step="any"
                            value={row.disc}
                            onChange={(e) => handleRowFieldChange(idx, 'disc', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right' }}
                          />
                        </td>
                        <td style={ui.td}>
                          <select
                            value={String(row.tax_rate)}
                            onChange={(e) => handleRowFieldChange(idx, 'tax_rate', e.target.value)}
                            style={ui.cellInput}
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td style={{ ...ui.td, textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                          ₹{calc.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={ui.td}>
                          <input
                            type="number"
                            step="any"
                            value={row.allocated_load_wt}
                            onChange={(e) => handleRowFieldChange(idx, 'allocated_load_wt', e.target.value)}
                            style={{ ...ui.cellInput, textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ ...ui.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => splitItemRow(idx)}
                              style={{ padding: '4px 7px', borderRadius: '4px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              title="Split this item across another Lot/Godown"
                            >
                              Split
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItemRow(idx)}
                              disabled={rows.length <= 1}
                              style={{ padding: '4px 7px', borderRadius: '4px', border: 'none', backgroundColor: rows.length <= 1 ? '#cbd5e1' : '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: rows.length <= 1 ? 'not-allowed' : 'pointer' }}
                              title="Remove row"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Weighment Details Box */}
        {showSection('weighment') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 3 · WEIGHMENT DETAILS BOX</span>
              <span style={ui.sectionBannerSub}>Gross, tare &amp; net lorry weight reconciliation</span>
            </div>
            <div style={ui.twoColGrid}>
              <div style={ui.subCard}>
                <h3 style={ui.subTitle}>3A. Weighbridge / Lorry Weighment Box</h3>
                <div style={ui.formGrid2}>
                  <div style={ui.fieldFull}>
                    <label style={ui.label}>Weighment Mode</label>
                    <select value={formData.weighment_mode} onChange={(e) => handleFieldChange('weighment_mode', e.target.value)} style={ui.input}>
                      <option value="Not Applicable">Not Applicable</option>
                      <option value="Manual Weighment">Manual Weighment</option>
                      <option value="Weighbridge Slip">Weighbridge Slip</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Vehicle Gross Weight (KG)</label>
                    <input type="number" step="any" value={formData.vehicle_gross_weight} onChange={(e) => handleFieldChange('vehicle_gross_weight', e.target.value)} style={ui.input} placeholder="e.g. 12000" />
                  </div>
                  <div>
                    <label style={ui.label}>Vehicle Tare Weight (KG)</label>
                    <input type="number" step="any" value={formData.vehicle_tare_weight} onChange={(e) => handleFieldChange('vehicle_tare_weight', e.target.value)} style={ui.input} placeholder="e.g. 9000" />
                  </div>
                  <div>
                    <label style={ui.label}>Net Load Weight (KG)</label>
                    <input type="text" readOnly value={`${summary.netLoadWeight.toLocaleString('en-IN')} KG`} style={{ ...ui.input, backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e3a8a' }} />
                  </div>
                  <div>
                    <label style={ui.label}>Weighment Slip No</label>
                    <input type="text" value={formData.weighment_slip_no} onChange={(e) => handleFieldChange('weighment_slip_no', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Weighbridge Name</label>
                    <input type="text" value={formData.weighbridge_name} onChange={(e) => handleFieldChange('weighbridge_name', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Weighed By</label>
                    <input type="text" value={formData.weighed_by} onChange={(e) => handleFieldChange('weighed_by', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Weighment Date</label>
                    <input type="date" value={formData.weighment_date} onChange={(e) => handleFieldChange('weighment_date', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Weighment Time</label>
                    <input type="time" value={formData.weighment_time} onChange={(e) => handleFieldChange('weighment_time', e.target.value)} style={ui.input} />
                  </div>
                </div>
              </div>

              <div style={ui.subCard}>
                <h3 style={ui.subTitle}>3B. Package Tare vs Vehicle Load Reconciliation</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={ui.reconRow}>
                    <span>Item Product Net Weight (Invoiced):</span>
                    <strong>{summary.totalProductNetWt.toLocaleString('en-IN')} KG</strong>
                  </div>
                  <div style={ui.reconRow}>
                    <span>Total Package / Bag Tare Weight:</span>
                    <strong>{summary.totalPkgTareWt.toLocaleString('en-IN')} KG</strong>
                  </div>
                  <div style={ui.reconRow}>
                    <span>Expected Loaded Material Wt (Net + Pkg Tare):</span>
                    <strong>{summary.expectedLoadWt.toLocaleString('en-IN')} KG</strong>
                  </div>
                  <div style={{ ...ui.reconRow, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                    <span>Weighbridge Net Load Weight (Gross − Tare):</span>
                    <strong style={{ color: '#1e40af', fontSize: '15px' }}>{summary.netLoadWeight.toLocaleString('en-IN')} KG</strong>
                  </div>
                  <div style={{ ...ui.reconRow, backgroundColor: Math.abs(summary.weightVariance) > 5 ? '#fef3c7' : '#f0fdf4' }}>
                    <span>Load Variance:</span>
                    <strong style={{ color: Math.abs(summary.weightVariance) > 5 ? '#92400e' : '#166534' }}>
                      {summary.weightVariance > 0 ? '+' : ''}{summary.weightVariance.toLocaleString('en-IN')} KG
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleAllocateLoadWeights}
                    disabled={!(summary.netLoadWeight > 0)}
                    style={{ ...ui.primaryBtn, width: '100%', marginTop: '6px', opacity: summary.netLoadWeight > 0 ? 1 : 0.5 }}
                  >
                    ⚖️ Allocate Net Load Weight Proportionally Across Items
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Transport, Outpass & Freight */}
        {showSection('transport') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 4 · TRANSPORT, GATE OUTPASS &amp; FREIGHT</span>
              <span style={ui.sectionBannerSub}>Vehicle, transporter, driver, LR &amp; loadman charges</span>
            </div>
            <div style={ui.twoColGrid}>
              <div style={ui.subCard}>
                <h3 style={ui.subTitle}>4A. Gate Outpass & Vehicle Dispatch</h3>
                {!isOrder && (
                  <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: '#065f46', width: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.auto_outpass)}
                        onChange={(e) => handleFieldChange('auto_outpass', e.target.checked)}
                        style={{ width: '16px', height: '16px', flex: 'none' }}
                      />
                      Auto-Generate Security Outpass on Save
                    </label>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#047857' }}>
                      {formData.outpass_no || lookups.nextOutpassNo}
                    </span>
                  </div>
                )}

                <div style={ui.formGrid2}>
                  <div>
                    <label style={ui.label}>Transport Mode</label>
                    <select value={formData.transport_mode} onChange={(e) => handleFieldChange('transport_mode', e.target.value)} style={ui.input}>
                      <option value="Third Party">Third Party Lorry / Carrier</option>
                      <option value="Own Vehicle">Company Own Vehicle</option>
                      <option value="Customer Pickup">Customer Self Pickup</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ ...ui.label, marginBottom: 0 }}>Transporter</label>
                      <button
                        type="button"
                        onClick={() => setInlineModal({ open: true, masterType: 'transports', rowIdx: null })}
                        style={{ border: 'none', background: 'none', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        + New Transporter
                      </button>
                    </div>
                    <select value={formData.transporter_id} onChange={(e) => handleFieldChange('transporter_id', e.target.value)} style={ui.input}>
                      <option value="">-- Select Transporter --</option>
                      <option value="__NEW_TRANSPORTER__" style={{ fontWeight: 'bold', color: '#1d4ed8' }}>
                        {getCreateLabel('transports')}
                      </option>
                      {(lookups.transports || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.print_name || t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Vehicle / Lorry No</label>
                    <input type="text" value={formData.lorry_no} onChange={(e) => handleFieldChange('lorry_no', e.target.value)} style={ui.input} placeholder="e.g. TN64AB1234" />
                  </div>
                  <div>
                    <label style={ui.label}>Vehicle Type</label>
                    <select value={formData.vehicle_type} onChange={(e) => handleFieldChange('vehicle_type', e.target.value)} style={ui.input}>
                      <option value="Truck">Heavy Truck / Lorry</option>
                      <option value="Container">Container</option>
                      <option value="Mini Van">Mini Van / Tempo</option>
                      <option value="Tractor">Tractor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Driver Name</label>
                    <input type="text" value={formData.driver} onChange={(e) => handleFieldChange('driver', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Driver Mobile</label>
                    <input type="text" value={formData.driver_mobile} onChange={(e) => handleFieldChange('driver_mobile', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>LR / GR No</label>
                    <input type="text" value={formData.lr_no} onChange={(e) => handleFieldChange('lr_no', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>LR Date</label>
                    <input type="date" value={formData.lr_date} onChange={(e) => handleFieldChange('lr_date', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Loading Point</label>
                    <input type="text" value={formData.loading_location} onChange={(e) => handleFieldChange('loading_location', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Delivery Destination</label>
                    <input type="text" value={formData.delivery_location} onChange={(e) => handleFieldChange('delivery_location', e.target.value)} style={ui.input} />
                  </div>
                </div>
              </div>

              <div style={ui.subCard}>
                <h3 style={ui.subTitle}>4B. Transport Freight & Loadman Labour</h3>
                <div style={ui.formGrid2}>
                  <div>
                    <label style={ui.label}>Freight Calculation Type</label>
                    <select value={formData.freight_type} onChange={(e) => handleFieldChange('freight_type', e.target.value)} style={ui.input}>
                      <option value="Fixed">Fixed Lumpsum</option>
                      <option value="Per Kg">Per KG</option>
                      <option value="Per Bag">Per Bag / Pack</option>
                      <option value="Per KM">Per KM</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Freight Rate (₹)</label>
                    <input type="number" step="any" value={formData.freight_rate} onChange={(e) => handleFieldChange('freight_rate', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Total Freight Amount (₹)</label>
                    <input type="number" step="any" value={formData.freight_type === 'Per Kg' || formData.freight_type === 'Per Bag' ? summary.freightAmt : formData.freight_amount} onChange={(e) => handleFieldChange('freight_amount', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Freight Paid By</label>
                    <select value={formData.freight_paid_by} onChange={(e) => handleFieldChange('freight_paid_by', e.target.value)} style={ui.input}>
                      <option value="Buyer">Buyer (To-Pay)</option>
                      <option value="Seller">Seller (Company Borne)</option>
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Freight Payment Status</label>
                    <select value={formData.freight_payment_status} onChange={(e) => handleFieldChange('freight_payment_status', e.target.value)} style={ui.input}>
                      <option value="Pending">Pending / Payable</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: formData.freight_paid_by === 'Seller' ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', width: 'auto' }}>
                      <input
                        type="checkbox"
                        disabled={formData.freight_paid_by !== 'Seller'}
                        checked={Boolean(formData.recover_freight_on_invoice)}
                        onChange={(e) => handleFieldChange('recover_freight_on_invoice', e.target.checked)}
                        style={{ width: '16px', height: '16px', flex: 'none' }}
                      />
                      Recover Freight on Customer Invoice
                    </label>
                  </div>

                  <div>
                    <label style={ui.label}>Loadman Team</label>
                    <select value={formData.loadman_worker_id} onChange={(e) => handleFieldChange('loadman_worker_id', e.target.value)} style={ui.input}>
                      <option value="">-- Select Loadman Team --</option>
                      <option value="__NEW_LOADMAN__" style={{ fontWeight: 'bold', color: '#1d4ed8' }}>
                        {getCreateLabel('loadman')}
                      </option>
                      {(lookups.workers || []).map((w) => (
                        <option key={w.id} value={w.id}>{w.name || w.worker_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Loadman Rate / KG (₹)</label>
                    <input type="number" step="0.01" value={formData.loadman_rate_per_kg} onChange={(e) => handleFieldChange('loadman_rate_per_kg', e.target.value)} style={ui.input} />
                  </div>
                  <div>
                    <label style={ui.label}>Calculated Loadman Wage</label>
                    <input type="text" readOnly value={`₹${summary.loadmanCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} style={{ ...ui.input, backgroundColor: '#f8fafc', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={ui.label}>Expected Delivery Date</label>
                    <input type="date" value={formData.expected_delivery_date} onChange={(e) => handleFieldChange('expected_delivery_date', e.target.value)} style={ui.input} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Charges, Tax & Deductions */}
        {showSection('tax') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 5 · CHARGES, GST TAX &amp; DEDUCTIONS</span>
              <span style={ui.sectionBannerSub}>Tax summary, additional charges, TCS &amp; round-off</span>
            </div>
            <EntryTaxBillDetails
              title={isOrder ? 'Sales Order Tax & Bill Breakdown' : 'Sales Invoice Tax & Bill Breakdown'}
              grossAmt={summary.grossAmt}
              discPercent={summary.discPercent}
              discAmt={summary.discAmt}
              billAmt={summary.billAmt}
              taxAmt={summary.taxAmt}
              totalAmt={summary.itemsTotalAmt}
              grandTotal={summary.grandTotal}
              taxPercent={summary.rateSummaries[0]?.gstRate || formData.tax_percent}
              cgstAmt={summary.cgstAmt}
              sgstAmt={summary.sgstAmt}
              igstAmt={summary.igstAmt}
              rateSummaries={summary.rateSummaries}
              deductionsAmt={summary.netDeductionAmount}
              unloadingAmt={summary.loadingChargesAmt + summary.freightRecoveryAmt + summary.otherCharges + summary.tcsAmount}
              taxType={formData.tax_type}
              isInterState={summary.isInterState}
            />

            <div style={{ ...ui.subCard, marginTop: '14px' }}>
              <h3 style={ui.subTitle}>Additional Invoice Charges, TCS & Round Off</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={ui.label}>Freight Recovery (₹)</label>
                  <input type="text" readOnly value={`₹${summary.freightRecoveryAmt.toFixed(2)}`} style={{ ...ui.input, backgroundColor: '#f8fafc' }} />
                </div>
                <div>
                  <label style={ui.label}>Loading / Unloading (₹)</label>
                  <input type="number" step="any" value={formData.loading_charges_amt} onChange={(e) => handleFieldChange('loading_charges_amt', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Other Charges (₹)</label>
                  <input type="number" step="any" value={formData.other_charges} onChange={(e) => handleFieldChange('other_charges', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>TCS Amount (₹)</label>
                  <input type="number" step="any" value={formData.tcs_amount} onChange={(e) => handleFieldChange('tcs_amount', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ ...ui.label, marginBottom: 0 }}>Round Off (± ₹)</label>
                    <button type="button" onClick={handleAutoRoundOff} style={{ border: 'none', background: 'none', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      Auto Round
                    </button>
                  </div>
                  <input type="number" step="0.01" value={formData.round_off} onChange={(e) => handleFieldChange('round_off', e.target.value)} style={ui.input} />
                </div>
              </div>
            </div>

            <div style={{ ...ui.subCard, marginTop: '14px' }}>
              <div style={ui.subTitleRow}>
                <h3 style={ui.subTitle}>Sales Deductions & Master Adjustments</h3>
                <button
                  type="button"
                  onClick={() => setSelectedDeductions((prev) => [...prev, { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }])}
                  style={ui.primarySmallBtn}
                >
                  + Add Deduction Row
                </button>
              </div>
              {(selectedDeductions || []).map((dRow, dIdx) => (
                <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1fr 0.7fr 1.1fr 1.4fr 42px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <select value={dRow.deduction_id || ''} onChange={(e) => handleDeductionRowChange(dIdx, 'deduction_id', e.target.value)} style={ui.input}>
                    <option value="">-- Master --</option>
                    {(lookups.deductions || []).map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.ded_name}</option>
                    ))}
                    <option value="__CREATE_NEW__">{getCreateLabel('deduction_sales')}</option>
                  </select>
                  <input type="text" placeholder="Name" value={dRow.name || ''} onChange={(e) => handleDeductionRowChange(dIdx, 'name', e.target.value)} style={ui.input} />
                  <select value={dRow.type || 'LESS'} onChange={(e) => handleDeductionRowChange(dIdx, 'type', e.target.value)} style={ui.input}>
                    <option value="LESS">LESS (-)</option>
                    <option value="ADD">ADD (+)</option>
                  </select>
                  <input type="number" step="any" placeholder="%" value={dRow.percent || ''} onChange={(e) => handleDeductionRowChange(dIdx, 'percent', e.target.value)} style={ui.input} />
                  <input type="number" step="any" placeholder="Amount" value={dRow.amount || ''} onChange={(e) => handleDeductionRowChange(dIdx, 'amount', e.target.value)} style={ui.input} />
                  <input type="text" placeholder="Remarks" value={dRow.remarks || ''} onChange={(e) => handleDeductionRowChange(dIdx, 'remarks', e.target.value)} style={ui.input} />
                  <button
                    type="button"
                    onClick={() => setSelectedDeductions((prev) => (prev.length <= 1 ? [{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }] : prev.filter((_, i) => i !== dIdx)))}
                    style={{ height: '34px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: Payment & Receipt Details */}
        {showSection('payment') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 6 · PAYMENT &amp; AUTO-RECEIPT DETAILS</span>
              <span style={ui.sectionBannerSub}>Cash/bank deposit ledger, advance adjustment &amp; receivable balance</span>
            </div>
            <div style={ui.subCard}>
              <div style={ui.subTitleRow}>
                <h3 style={ui.subTitle}>6. Payment Terms & Auto-Receipt Posting</h3>
                {!isOrder && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('received_amount', String(summary.grandTotal))}
                    style={ui.primarySmallBtn}
                  >
                    Mark Full Paid (₹{summary.grandTotal.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
              <div style={ui.formGrid2}>
                <div>
                  <label style={ui.label}>Payment Classification</label>
                  <select value={formData.pay_type} onChange={(e) => handleFieldChange('pay_type', e.target.value)} style={ui.input}>
                    <option value="Credit">Credit</option>
                    <option value="Cash">Cash</option>
                    <option value="Partial">Partial Receipt</option>
                  </select>
                </div>
                <div>
                  <label style={ui.label}>Payment Mode</label>
                  <select value={formData.payment_mode} onChange={(e) => handleFieldChange('payment_mode', e.target.value)} style={ui.input}>
                    <option value="Credit">On Credit</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="NEFT">NEFT / RTGS / Bank Transfer</option>
                    <option value="Cheque">Cheque / DD</option>
                  </select>
                </div>
                <div>
                  <label style={ui.label}>Received Amount Now (₹)</label>
                  <input type="number" step="any" disabled={isOrder} value={formData.received_amount} onChange={(e) => handleFieldChange('received_amount', e.target.value)} style={ui.input} placeholder="0.00" />
                </div>
                <div>
                  <label style={ui.label}>Advance Adjusted (₹)</label>
                  <input type="number" step="any" disabled={isOrder} value={formData.advance_adjusted} onChange={(e) => handleFieldChange('advance_adjusted', e.target.value)} style={ui.input} placeholder="0.00" />
                </div>
                <div>
                  <label style={ui.label}>Deposit Cash / Bank Account</label>
                  <select value={formData.bank_account_id} onChange={(e) => handleFieldChange('bank_account_id', e.target.value)} style={ui.input}>
                    <option value="">-- Select Cash / Bank Ledger --</option>
                    {(lookups.cashBankLedgers || []).map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.group_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={ui.label}>Balance Receivable (₹)</label>
                  <input type="text" readOnly value={`₹${summary.balanceReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} style={{ ...ui.input, backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e3a8a' }} />
                </div>
                <div>
                  <label style={ui.label}>Transaction / UTR / Cheque Ref</label>
                  <input type="text" value={formData.transaction_ref} onChange={(e) => handleFieldChange('transaction_ref', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Receipt Date</label>
                  <input type="date" value={formData.payment_date} onChange={(e) => handleFieldChange('payment_date', e.target.value)} style={ui.input} />
                </div>
              </div>
              {formData.receipt_voucher_no && (
                <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                  Linked Receipt Voucher Posted: {formData.receipt_voucher_no}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Dispatch & Supporting Documents */}
        {showSection('dispatch') && (
          <div style={ui.sectionCard}>
            <div style={ui.sectionBanner}>
              <span>SECTION 7 · DISPATCH, STATUTORY E-WAY / IRN &amp; POD</span>
              <span style={ui.sectionBannerSub}>Dispatch tracking, E-Way Bill, IRN &amp; delivery confirmation</span>
            </div>
            <div style={ui.subCard}>
              <h3 style={ui.subTitle}>7. Dispatch, Statutory E-Way / IRN & POD Records</h3>
              <div style={ui.formGrid2}>
                <div>
                  <label style={ui.label}>Dispatch Status</label>
                  <select value={formData.dispatch_status} onChange={(e) => handleFieldChange('dispatch_status', e.target.value)} style={ui.input}>
                    <option value="Invoice Created">Invoice Created</option>
                    <option value="Loaded">Loaded on Vehicle</option>
                    <option value="Dispatched">Dispatched / Gate Out</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered (POD)</option>
                  </select>
                </div>
                <div>
                  <label style={ui.label}>Dispatch No</label>
                  <input type="text" value={formData.dispatch_no} onChange={(e) => handleFieldChange('dispatch_no', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Delivery Challan / Outpass Ref</label>
                  <input type="text" value={formData.delivery_challan_no || formData.outpass_no} onChange={(e) => handleFieldChange('delivery_challan_no', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Actual Delivery Date</label>
                  <input type="date" value={formData.actual_delivery_date} onChange={(e) => handleFieldChange('actual_delivery_date', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>E-Way Bill No</label>
                  <input type="text" value={formData.eway_bill_no} onChange={(e) => handleFieldChange('eway_bill_no', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>E-Way Bill Validity</label>
                  <input type="date" value={formData.eway_bill_validity} onChange={(e) => handleFieldChange('eway_bill_validity', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>E-Invoice IRN No</label>
                  <input type="text" value={formData.irn_no} onChange={(e) => handleFieldChange('irn_no', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>IRN Ack No</label>
                  <input type="text" value={formData.ack_no} onChange={(e) => handleFieldChange('ack_no', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Received By (Customer POD)</label>
                  <input type="text" value={formData.received_by} onChange={(e) => handleFieldChange('received_by', e.target.value)} style={ui.input} />
                </div>
                <div>
                  <label style={ui.label}>Dispatch Date/Time</label>
                  <input type="text" value={formData.dispatch_datetime} onChange={(e) => handleFieldChange('dispatch_datetime', e.target.value)} style={ui.input} placeholder="YYYY-MM-DD HH:MM" />
                </div>
                <div style={ui.fieldFull}>
                  <label style={ui.label}>Delivery / Security Gate Remarks</label>
                  <textarea rows={2} value={formData.delivery_remarks} onChange={(e) => handleFieldChange('delivery_remarks', e.target.value)} style={ui.textarea} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={ui.secondaryBtn}
              >
                ☰ View All Sections (1–7)
              </button>
            )}
            {activeTab !== 'all' && TABS.findIndex((t) => t.id === activeTab) > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab(TABS[TABS.findIndex((t) => t.id === activeTab) - 1].id)}
                style={ui.secondaryBtn}
              >
                ← Previous Section
              </button>
            )}
            {activeTab !== 'all' && TABS.findIndex((t) => t.id === activeTab) < TABS.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveTab(TABS[TABS.findIndex((t) => t.id === activeTab) + 1].id)}
                style={ui.secondaryBtn}
              >
                Next Section →
              </button>
            )}
          </div>
          <button type="submit" disabled={loading} style={ui.primaryBtn}>
            {loading ? 'Saving...' : (editId ? 'Update Record' : (isOrder ? 'Save Sales Order' : 'Save Invoice & Generate Outpass'))}
          </button>
        </div>
      </form>

      <InlineMasterModal
        open={inlineModal.open}
        onClose={() => setInlineModal({ open: false, masterType: 'deduction_sales', rowIdx: null })}
        masterType={inlineModal.masterType}
        onSuccess={handleInlineCreated}
      />

      {confirmState.open && (
        <div style={ui.modalOverlay}>
          <div style={ui.modalCard}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{confirmState.title}</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#475569' }}>{confirmState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setConfirmState({ open: false, title: '', message: '', onConfirm: null })} style={ui.secondaryBtn}>
                Keep Editing
              </button>
              <button type="button" onClick={confirmState.onConfirm} style={{ ...ui.primaryBtn, backgroundColor: '#dc2626' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ui = {
  headerCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  backBtn: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer'
  },
  badge: {
    fontSize: '11px',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace'
  },
  primaryBtn: {
    backgroundColor: '#1e40af',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer'
  },
  primarySmallBtn: {
    backgroundColor: '#1e40af',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer'
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer'
  },
  miniAddBtn: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '5px',
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: '11px',
    cursor: 'pointer'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
    gap: '10px',
    marginBottom: '12px'
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase'
  },
  kpiValue: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f172a',
    fontFamily: 'monospace'
  },
  kpiSub: {
    fontSize: '11px',
    color: '#475569'
  },
  tabBar: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tabNum: {
    minWidth: '18px',
    height: '18px',
    padding: '0 5px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 800
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '14px'
  },
  sectionBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    padding: '8px 12px',
    marginBottom: '12px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#1e3a8a',
    letterSpacing: '0.03em'
  },
  sectionBannerSub: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    letterSpacing: 'normal'
  },
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: '16px'
  },
  subCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '14px'
  },
  subTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '8px',
    flexWrap: 'wrap'
  },
  subTitle: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: 800,
    color: '#1e3a8a'
  },
  formGrid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
  },
  fieldFull: {
    gridColumn: '1 / -1'
  },
  label: {
    display: 'block',
    width: '100%',
    fontSize: '11px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    height: '34px',
    padding: '5px 9px',
    border: '1px solid #94a3b8',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '6px 9px',
    border: '1px solid #94a3b8',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxSizing: 'border-box',
    resize: 'vertical'
  },
  th: {
    padding: '8px 6px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid #1e40af',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '5px',
    border: '1px solid #cbd5e1',
    verticalAlign: 'middle'
  },
  cellInput: {
    width: '100%',
    minWidth: '72px',
    height: '34px',
    padding: '4px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxSizing: 'border-box'
  },
  reconRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 12px',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    fontSize: '13px'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '20px',
    width: '380px',
    maxWidth: '92vw',
    boxShadow: '0 20px 30px rgba(0,0,0,0.25)'
  }
};

export default SalesCreate;
