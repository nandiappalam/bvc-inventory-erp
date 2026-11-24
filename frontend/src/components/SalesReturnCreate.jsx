import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { calculateTotals } from '../utils/taxCalc';
import { EntryTaxBillDetails } from './entry';
import { InlineMasterModal, getCreateLabel } from './common/InlineMasterModal.jsx';
import SalesDistributionWorkflow from './common/SalesDistributionWorkflow.jsx';
import './SalesReturnCreate.css';

const SECTIONS = [
  { id: 'all', label: 'All Sections (A–F)' },
  { id: 'A', label: 'A. Original Sales' },
  { id: 'B', label: 'B. Returned Items' },
  { id: 'C', label: 'C. Reason & QC' },
  { id: 'D', label: 'D. Condition & Stock' },
  { id: 'E', label: 'E. Settlement & CN' },
  { id: 'F', label: 'F. Transport & Docs' }
];

const DEFAULT_REASONS = [
  'Quality Issue',
  'Damaged Goods',
  'Expired Product',
  'Near Expiry',
  'Wrong Product Delivered',
  'Wrong Quantity',
  'Shortage / Excess Dispute',
  'Packaging Defect',
  'Moisture Problem',
  'Contamination',
  'Customer Order Cancellation',
  'Incorrect Specification',
  'Transit Delay',
  'Commercial / Billing Dispute',
  'Other'
];

const DEFAULT_CONDITIONS = [
  'Good / Resalable',
  'Damaged',
  'Quality Hold',
  'Reprocessing Required',
  'Wastage / Rejected',
  'Under Investigation'
];

const DEFAULT_SETTLEMENT_TYPES = [
  'Credit Note',
  'Refund',
  'Replacement',
  'No Financial Adjustment'
];

const EMPTY_ITEM = {
  original_sales_id: null,
  original_sales_item_id: null,
  complaint_item_id: null,
  item_id: '',
  item_name: '',
  lot_no: '',
  uom: 'Bags',
  weight: '50',
  original_sold_qty: 0,
  previously_returned_qty: 0,
  available_return_qty: 0,
  complaint_qty: 0,
  qty: '',
  return_weight: '',
  destination_godown_id: '',
  destination_godown_name: '',
  mfg_date: '',
  exp_date: '',
  rate: '',
  disc_perc: '0',
  tax_perc: '5',
  amount: 0,
  item_reason: ''
};

const round2 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const SalesReturnCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const complaintIdParam = searchParams.get('complaint_id');
  const { user, selectedCompany, financialYear, isAdmin } = useAuth();

  const canAuthorize = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return Boolean(isAdmin || ['admin', 'super_admin', 'superadmin', 'manager', 'supervisor', 'owner'].includes(role));
  }, [user, isAdmin]);

  const [activeSection, setActiveSection] = useState('all');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [approveModalOpen, setApproveModalOpen] = useState(false);

  // Lookups & Invoice / Complaint Candidates
  const [invoiceCandidates, setInvoiceCandidates] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [itemMaster, setItemMaster] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [banks, setBanks] = useState([]);
  const [deductionOptions, setDeductionOptions] = useState([]);
  const [reasonCategories, setReasonCategories] = useState(DEFAULT_REASONS);
  const [goodsConditions, setGoodsConditions] = useState(DEFAULT_CONDITIONS);
  const [settlementTypes, setSettlementTypes] = useState(DEFAULT_SETTLEMENT_TYPES);

  // Inline master modals
  const [inlineDeductionOpen, setInlineDeductionOpen] = useState(false);
  const [inlineTransporterOpen, setInlineTransporterOpen] = useState(false);

  const todayIso = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    s_no: '',
    return_no: '',
    date: todayIso,
    original_sales_id: '',
    original_invoice_no: '',
    original_invoice_date: '',
    customer_id: '',
    customer_name: '',
    customer_gstin: '',
    customer_address: '',
    customer_state: '',
    customer_state_code: '',
    sales_order_no: '',
    delivery_challan_no: '',
    outpass_no: '',
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    tax_percent: 0,
    tax_percent_display: '0%',
    gross_amt: 0,
    disc_percent: 0,
    disc_amount: 0,
    bill_amt: 0,
    tax_amt: 0,
    cgst_amt: 0,
    sgst_amt: 0,
    igst_amt: 0,
    rate_summaries: [],
    total_amt: 0,
    deduction: '',
    deduction_remarks: '',
    deduction_amount: 0,
    grand_total: 0,
    // Section C
    return_reason_category: 'Quality Issue',
    return_reason_detail: '',
    complaint_id: '',
    complaint_no: '',
    complaint_qty: 0,
    quality_issue_desc: '',
    inspection_required: true,
    inspection_date: '',
    inspected_by: '',
    qc_status: 'Pending',
    qc_remarks: '',
    supporting_docs: '',
    // Section D
    goods_condition: 'Under Investigation',
    stock_disposition: 'Hold',
    stock_status: 'Hold',
    destination_godown_id: '',
    destination_godown_name: '',
    // Section E
    original_invoice_amount: 0,
    returned_item_amount: 0,
    settlement_type: 'Credit Note',
    settlement_status: 'Pending',
    credit_note_no: '',
    credit_note_date: todayIso,
    refund_amount: 0,
    refund_mode: 'Bank',
    refund_bank_name: '',
    refund_ref_no: '',
    replacement_amount: 0,
    replacement_ref_no: '',
    customer_outstanding_adj: 0,
    no_adjustment_reason: '',
    // Section F
    return_vehicle_no: '',
    transporter_name: '',
    driver_name: '',
    return_freight: 0,
    freight_paid_by: 'Company',
    return_pass_ref: '',
    customer_return_challan: '',
    loadman_name: '',
    loadman_worker_id: '',
    loadman_rate_per_kg: '0.50',
    loadman_charges: 0,
    remarks: '',
    // Workflow / Override
    workflow_status: 'QC Pending',
    approval_status: 'PENDING',
    authorized_override: false,
    override_reason: ''
  });

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [selectedDeductions, setSelectedDeductions] = useState([
    { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }
  ]);

  // Approval modal state (for editing existing return)
  const [approvalForm, setApprovalForm] = useState({
    qc_status: 'Approved',
    inspection_date: todayIso,
    inspected_by: user?.username || 'QC Manager',
    qc_remarks: '',
    goods_condition: 'Good / Resalable',
    stock_disposition: 'Resalable',
    destination_godown_id: '',
    destination_godown_name: '',
    settlement_type: 'Credit Note',
    credit_note_no: '',
    credit_note_date: todayIso,
    refund_amount: '',
    refund_mode: 'Bank',
    refund_bank_name: '',
    refund_ref_no: '',
    replacement_amount: '',
    replacement_ref_no: '',
    no_adjustment_reason: '',
    approval_remarks: '',
    close_return: false
  });

  const showBanner = useCallback((type, text) => {
    setBanner({ type, text });
    if (type === 'success') {
      setTimeout(() => setBanner((prev) => (prev.text === text ? { type: '', text: '' } : prev)), 4500);
    }
  }, []);

  // Load lookups + invoice candidates + next numbers / existing record
  useEffect(() => {
    let active = true;
    const init = async () => {
      setInitializing(true);
      try {
        const [lookupRes, candRes] = await Promise.all([
          api('/sales-returns/form-lookups').catch(() => null),
          api(`/sales-returns/invoice-candidates${editId ? `?exclude_return_id=${encodeURIComponent(editId)}` : ''}`).catch(() => null)
        ]);

        if (!active) return;

        const lData = lookupRes?.data || {};
        setCustomers(lData.customers || []);
        setGodowns(lData.godowns || []);
        setItemMaster(lData.items || []);
        setTransporters(lData.transporters || []);
        setBanks(lData.banks || []);
        setDeductionOptions(lData.deductions || []);
        setComplaints(lData.complaints || []);
        if (Array.isArray(lData.returnReasons) && lData.returnReasons.length) setReasonCategories(lData.returnReasons);
        if (Array.isArray(lData.goodsConditions) && lData.goodsConditions.length) setGoodsConditions(lData.goodsConditions);
        if (Array.isArray(lData.settlementTypes) && lData.settlementTypes.length) setSettlementTypes(lData.settlementTypes);

        const cList = candRes?.data || (Array.isArray(candRes) ? candRes : []);
        setInvoiceCandidates(cList);

        const defaultGodown = (lData.godowns || []).find((g) => /finish|\bfg\b|normal/i.test(`${g.godown_name} ${g.godown_type}`)) || (lData.godowns || [])[0];

        if (editId) {
          const rec = await api(`/sales-returns/${editId}`);
          if (!active || !rec) return;

          let parsedDeds = [];
          try {
            parsedDeds = rec.deductions_json ? JSON.parse(rec.deductions_json) : [];
          } catch (_) {
            parsedDeds = [];
          }
          if (Array.isArray(parsedDeds) && parsedDeds.length > 0) {
            setSelectedDeductions(parsedDeds);
          }

          setFormData((prev) => ({
            ...prev,
            s_no: rec.s_no ? String(rec.s_no) : '',
            return_no: rec.return_no || '',
            date: rec.date ? String(rec.date).slice(0, 10) : todayIso,
            original_sales_id: rec.original_sales_id ? String(rec.original_sales_id) : '',
            original_invoice_no: rec.original_invoice_no || '',
            original_invoice_date: rec.original_invoice_date ? String(rec.original_invoice_date).slice(0, 10) : '',
            customer_id: rec.customer_id ? String(rec.customer_id) : '',
            customer_name: rec.customer || '',
            customer_gstin: rec.customer_gstin || '',
            customer_address: rec.customer_address || rec.address || '',
            customer_state: rec.customer_state || rec.party_state || '',
            customer_state_code: rec.customer_state_code || '',
            sales_order_no: rec.sales_order_no || '',
            delivery_challan_no: rec.delivery_challan_no || '',
            outpass_no: rec.outpass_no || '',
            pay_type: rec.pay_type || 'Credit',
            tax_type: rec.tax_type || 'Exclusive',
            tax_percent: Number(rec.tax_percent || 0),
            bill_amt: Number(rec.bill_amt || 0),
            tax_amt: Number(rec.tax_amt || 0),
            cgst_amt: Number(rec.cgst_amount || 0),
            sgst_amt: Number(rec.sgst_amount || 0),
            igst_amt: Number(rec.igst_amount || 0),
            total_amt: Number(rec.total_amt || 0),
            deduction: rec.deduction || '',
            deduction_remarks: rec.deduction_remarks || '',
            deduction_amount: Number(rec.deduction_amount || 0),
            grand_total: Number(rec.grand_total || rec.total_amt || 0),
            return_reason_category: rec.return_reason_category || 'Quality Issue',
            return_reason_detail: rec.return_reason_detail || rec.remarks || '',
            complaint_id: rec.complaint_id ? String(rec.complaint_id) : '',
            complaint_no: rec.complaint_no || '',
            complaint_qty: Number(rec.complaint_qty || 0),
            quality_issue_desc: rec.quality_issue_desc || '',
            inspection_required: rec.inspection_required !== 0,
            inspection_date: rec.inspection_date || '',
            inspected_by: rec.inspected_by || '',
            qc_status: rec.qc_status || 'Pending',
            qc_remarks: rec.qc_remarks || '',
            supporting_docs: rec.supporting_docs || '',
            goods_condition: rec.goods_condition || 'Under Investigation',
            stock_disposition: rec.stock_disposition || 'Hold',
            stock_status: rec.stock_status || 'Hold',
            destination_godown_id: rec.destination_godown_id ? String(rec.destination_godown_id) : (defaultGodown?.id ? String(defaultGodown.id) : ''),
            destination_godown_name: rec.destination_godown_name || defaultGodown?.godown_name || '',
            original_invoice_amount: Number(rec.original_invoice_amount || 0),
            returned_item_amount: Number(rec.returned_item_amount || rec.grand_total || 0),
            settlement_type: rec.settlement_type || 'Credit Note',
            settlement_status: rec.settlement_status || 'Pending',
            credit_note_no: rec.credit_note_no || '',
            credit_note_date: rec.credit_note_date || todayIso,
            refund_amount: Number(rec.refund_amount || 0),
            refund_mode: rec.refund_mode || 'Bank',
            refund_bank_name: rec.refund_bank_name || '',
            refund_ref_no: rec.refund_ref_no || '',
            replacement_amount: Number(rec.replacement_amount || 0),
            replacement_ref_no: rec.replacement_ref_no || '',
            customer_outstanding_adj: Number(rec.customer_outstanding_adj || 0),
            no_adjustment_reason: rec.no_adjustment_reason || '',
            return_vehicle_no: rec.return_vehicle_no || '',
            transporter_name: rec.transporter_name || '',
            driver_name: rec.driver_name || '',
            return_freight: Number(rec.return_freight || 0),
            freight_paid_by: rec.freight_paid_by || 'Company',
            return_pass_ref: rec.return_pass_ref || '',
            customer_return_challan: rec.customer_return_challan || '',
            loadman_name: rec.loadman_name || '',
            loadman_worker_id: rec.loadman_worker_id || '',
            loadman_rate_per_kg: rec.loadman_rate_per_kg !== undefined ? String(rec.loadman_rate_per_kg) : '0.50',
            loadman_charges: Number(rec.loadman_charges || 0),
            remarks: rec.remarks || '',
            workflow_status: rec.workflow_status || 'QC Pending',
            approval_status: rec.approval_status || 'PENDING'
          }));

          if (Array.isArray(rec.items) && rec.items.length > 0) {
            setItems(
              rec.items.map((it) => ({
                ...EMPTY_ITEM,
                ...it,
                complaint_item_id: it.complaint_item_id || null,
                complaint_qty: Number(it.complaint_qty || 0),
                weight: String(it.weight || 50),
                qty: String(it.qty || ''),
                return_weight: String(it.return_weight || it.total_wt || ''),
                rate: String(it.rate || ''),
                disc_perc: String(it.disc_perc ?? 0),
                tax_perc: String(it.tax_perc ?? 5),
                amount: Number(it.total_amt || it.amount || 0),
                destination_godown_id: it.destination_godown_id ? String(it.destination_godown_id) : (defaultGodown?.id ? String(defaultGodown.id) : ''),
                destination_godown_name: it.destination_godown_name || defaultGodown?.godown_name || ''
              }))
            );
          }

          setApprovalForm({
            qc_status: rec.qc_status && rec.qc_status !== 'Pending' ? rec.qc_status : 'Approved',
            inspection_date: rec.inspection_date || todayIso,
            inspected_by: rec.inspected_by || user?.username || 'QC Manager',
            qc_remarks: rec.qc_remarks || '',
            goods_condition: rec.goods_condition && rec.goods_condition !== 'Under Investigation' ? rec.goods_condition : 'Good / Resalable',
            stock_disposition: rec.stock_disposition && rec.stock_disposition !== 'Hold' ? rec.stock_disposition : 'Resalable',
            destination_godown_id: rec.destination_godown_id ? String(rec.destination_godown_id) : (defaultGodown?.id ? String(defaultGodown.id) : ''),
            destination_godown_name: rec.destination_godown_name || defaultGodown?.godown_name || '',
            settlement_type: rec.settlement_type || 'Credit Note',
            credit_note_no: rec.credit_note_no || '',
            credit_note_date: rec.credit_note_date || todayIso,
            refund_amount: String(rec.refund_amount || rec.grand_total || rec.total_amt || ''),
            refund_mode: rec.refund_mode || 'Bank',
            refund_bank_name: rec.refund_bank_name || '',
            refund_ref_no: rec.refund_ref_no || '',
            replacement_amount: String(rec.replacement_amount || ''),
            replacement_ref_no: rec.replacement_ref_no || '',
            no_adjustment_reason: rec.no_adjustment_reason || '',
            approval_remarks: rec.approval_remarks || '',
            close_return: false
          });
        } else {
          const nextRes = await api('/sales-returns/next-no').catch(() => null);
          if (!active) return;
          const sno = nextRes?.next_s_no || '1';
          const retNo = nextRes?.return_no || `SR-${String(sno).padStart(5, '0')}`;
          const cnNo = nextRes?.credit_note_no || `CN-${String(sno).padStart(5, '0')}`;
          setFormData((prev) => ({
            ...prev,
            s_no: String(sno),
            return_no: retNo,
            credit_note_no: cnNo,
            destination_godown_id: defaultGodown?.id ? String(defaultGodown.id) : '',
            destination_godown_name: defaultGodown?.godown_name || ''
          }));

          if (complaintIdParam) {
            let targetCmp = (lData.complaints || []).find((c) => Number(c.id) === Number(complaintIdParam));
            if (!targetCmp) {
              const cmpRes = await api(`/complaints/${complaintIdParam}`).catch(() => null);
              targetCmp = cmpRes?.data || null;
            }
            if (active && targetCmp) {
              const cmpItems = Array.isArray(targetCmp.items) ? targetCmp.items : [];
              const totalComplQty = round2(
                cmpItems.reduce((s, it) => s + Number(it.complaint_qty || 0), 0) || Number(targetCmp.complaint_qty || targetCmp.qty_affected || 0)
              );
              const matchedInv = targetCmp.original_sales_id
                ? cList.find((inv) => Number(inv.id) === Number(targetCmp.original_sales_id))
                : cList.find((inv) => targetCmp.original_invoice_no && String(inv.inv_no).toUpperCase() === String(targetCmp.original_invoice_no).toUpperCase());

              const mapCategoryToReason = (cat) => {
                const c = String(cat || '').toLowerCase();
                if (c === 'quality') return 'Quality Issue';
                if (c === 'packaging') return 'Packaging Defect';
                if (c === 'weight') return 'Wrong Quantity';
                if (c === 'delivery') return 'Transit Delay';
                return DEFAULT_REASONS.find((r) => r.toLowerCase() === c) || 'Quality Issue';
              };

              if (matchedInv) {
                const defaultDestId = matchedInv.godown_id ? String(matchedInv.godown_id) : (defaultGodown?.id ? String(defaultGodown.id) : '');
                const defaultDestName = matchedInv.godown_name || defaultGodown?.godown_name || '';
                setFormData((prev) => ({
                  ...prev,
                  complaint_id: String(targetCmp.id),
                  complaint_no: targetCmp.complaint_no || '',
                  complaint_qty: totalComplQty,
                  original_sales_id: String(matchedInv.id),
                  original_invoice_no: matchedInv.inv_no || '',
                  original_invoice_date: matchedInv.date ? String(matchedInv.date).slice(0, 10) : '',
                  customer_id: matchedInv.customer_id ? String(matchedInv.customer_id) : (targetCmp.customer_id ? String(targetCmp.customer_id) : ''),
                  customer_name: matchedInv.customer_name || matchedInv.customer || targetCmp.customer_name || '',
                  customer_gstin: matchedInv.customer_gstin || '',
                  customer_address: matchedInv.customer_address || matchedInv.address || '',
                  customer_state: matchedInv.customer_state || matchedInv.party_state || '',
                  customer_state_code: matchedInv.customer_state_code || '',
                  sales_order_no: matchedInv.sales_order_no || matchedInv.sales_order_ref || '',
                  delivery_challan_no: matchedInv.delivery_challan_no || matchedInv.outpass_no || '',
                  outpass_no: matchedInv.outpass_no || '',
                  tax_type: matchedInv.tax_type || prev.tax_type,
                  pay_type: matchedInv.pay_type || prev.pay_type,
                  original_invoice_amount: round2(matchedInv.original_invoice_amount || matchedInv.grand_total || 0),
                  destination_godown_id: defaultDestId,
                  destination_godown_name: defaultDestName,
                  return_reason_category: mapCategoryToReason(targetCmp.complaint_category),
                  return_reason_detail: targetCmp.complaint_description || '',
                  quality_issue_desc: targetCmp.complaint_description || ''
                }));
                const invItems = Array.isArray(matchedInv.items) ? matchedInv.items : [];
                if (invItems.length > 0) {
                  setItems(
                    invItems.map((it) => {
                      const soldQty = round2(it.original_sold_qty ?? it.qty ?? 0);
                      const prevRet = round2(it.previously_returned_qty ?? 0);
                      const availQty = it.available_return_qty !== undefined ? round2(it.available_return_qty) : Math.max(0, round2(soldQty - prevRet));
                      const ci = cmpItems.find(
                        (cIt) =>
                          String(cIt.item_name || '').trim().toLowerCase() === String(it.item_name || '').trim().toLowerCase() &&
                          (!cIt.lot_no || !it.lot_no || String(cIt.lot_no).trim().toUpperCase() === String(it.lot_no).trim().toUpperCase())
                      ) || cmpItems.find((cIt) => String(cIt.item_name || '').trim().toLowerCase() === String(it.item_name || '').trim().toLowerCase());
                      const cQty = round2(ci?.complaint_qty || 0);
                      const retQty = cQty > 0 ? Math.min(availQty, cQty) : availQty;
                      const unitWt = Number(it.weight || 50);
                      const retWt = round2(retQty * unitWt);
                      const rate = Number(it.rate || 0);
                      const discPerc = Number(it.disc_perc ?? it.disc ?? 0);
                      const taxPerc = Number(it.tax_perc ?? it.tax_rate ?? 5);
                      const taxable = round2(retQty * rate * (1 - discPerc / 100));
                      const taxAmt = (matchedInv.tax_type || 'Exclusive') === 'Exclusive' ? round2((taxable * taxPerc) / 100) : 0;
                      return {
                        ...EMPTY_ITEM,
                        original_sales_id: matchedInv.id,
                        original_sales_item_id: it.original_sales_item_id || it.id || null,
                        complaint_item_id: ci?.id || null,
                        complaint_qty: cQty,
                        item_id: it.item_id || '',
                        item_name: it.item_name || '',
                        lot_no: it.lot_no || '',
                        uom: it.uom || 'Bags',
                        weight: String(unitWt),
                        original_sold_qty: soldQty,
                        previously_returned_qty: prevRet,
                        available_return_qty: availQty,
                        qty: String(retQty),
                        return_weight: String(retWt),
                        destination_godown_id: it.destination_godown_id ? String(it.destination_godown_id) : defaultDestId,
                        destination_godown_name: it.destination_godown_name || defaultDestName,
                        mfg_date: it.mfg_date || '',
                        exp_date: it.exp_date || '',
                        rate: String(rate),
                        disc_perc: String(discPerc),
                        tax_perc: String(taxPerc),
                        amount: round2(taxable + taxAmt)
                      };
                    })
                  );
                }
              } else {
                setFormData((prev) => ({
                  ...prev,
                  complaint_id: String(targetCmp.id),
                  complaint_no: targetCmp.complaint_no || '',
                  complaint_qty: totalComplQty,
                  customer_id: targetCmp.customer_id ? String(targetCmp.customer_id) : '',
                  customer_name: targetCmp.customer_name || '',
                  original_invoice_no: targetCmp.original_invoice_no || '',
                  return_reason_category: mapCategoryToReason(targetCmp.complaint_category),
                  return_reason_detail: targetCmp.complaint_description || '',
                  quality_issue_desc: targetCmp.complaint_description || ''
                }));
                if (cmpItems.length > 0) {
                  setItems(
                    cmpItems.map((ci) => {
                      const cQty = round2(ci.complaint_qty || 0);
                      const unitWt = Number(ci.weight_per_unit || 50);
                      return {
                        ...EMPTY_ITEM,
                        complaint_item_id: ci.id || null,
                        complaint_qty: cQty,
                        item_id: ci.item_id || '',
                        item_name: ci.item_name || '',
                        lot_no: ci.lot_no || '',
                        uom: ci.uom || 'Bags',
                        weight: String(unitWt),
                        qty: cQty > 0 ? String(cQty) : '',
                        return_weight: cQty > 0 ? String(round2(cQty * unitWt)) : '',
                        mfg_date: ci.mfg_date || '',
                        exp_date: ci.exp_date || ''
                      };
                    })
                  );
                }
              }
              showBanner('success', `Loaded Customer Complaint ${targetCmp.complaint_no} into Sales Return.`);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing sales return form:', err);
        if (active) showBanner('error', `Failed to load Sales Return setup: ${err.message}`);
      } finally {
        if (active) setInitializing(false);
      }
    };
    init();
    return () => { active = false; };
  }, [editId, complaintIdParam, todayIso, user?.username, showBanner]);

  // Apply selected Sales Invoice auto-fill (Section A + Section B)
  const applySalesInvoiceCandidate = useCallback((inv) => {
    if (!inv) return;
    const defaultDestId = inv.godown_id ? String(inv.godown_id) : '';
    const defaultDestName = inv.godown_name || '';

    setFormData((prev) => ({
      ...prev,
      original_sales_id: String(inv.id || inv.sales_id || ''),
      original_invoice_no: inv.inv_no || (inv.s_no ? `SAL-${String(inv.s_no).padStart(5, '0')}` : ''),
      original_invoice_date: inv.date ? String(inv.date).slice(0, 10) : '',
      customer_id: inv.customer_id ? String(inv.customer_id) : '',
      customer_name: inv.customer_name || inv.customer || '',
      customer_gstin: inv.customer_gstin || '',
      customer_address: inv.customer_address || inv.address || '',
      customer_state: inv.customer_state || inv.party_state || '',
      customer_state_code: inv.customer_state_code || '',
      sales_order_no: inv.sales_order_no || inv.sales_order_ref || '',
      delivery_challan_no: inv.delivery_challan_no || inv.outpass_no || '',
      outpass_no: inv.outpass_no || '',
      tax_type: inv.tax_type || prev.tax_type,
      pay_type: inv.pay_type || prev.pay_type,
      original_invoice_amount: round2(inv.original_invoice_amount || inv.grand_total || 0),
      destination_godown_id: defaultDestId || prev.destination_godown_id,
      destination_godown_name: defaultDestName || prev.destination_godown_name
    }));

    const sourceItems = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [];
    if (sourceItems.length > 0) {
      setItems(
        sourceItems.map((it) => {
          const soldQty = round2(it.original_sold_qty ?? it.qty ?? 0);
          const prevRet = round2(it.previously_returned_qty ?? 0);
          const availQty = it.available_return_qty !== undefined ? round2(it.available_return_qty) : Math.max(0, round2(soldQty - prevRet));
          const unitWt = Number(it.weight || 50);
          const retQty = availQty;
          const retWt = round2(retQty * unitWt);
          const rate = Number(it.rate || 0);
          const discPerc = Number(it.disc_perc ?? it.disc ?? 0);
          const taxPerc = Number(it.tax_perc ?? it.tax_rate ?? 5);
          const taxable = round2((retQty * rate) * (1 - discPerc / 100));
          const taxAmt = (inv.tax_type || 'Exclusive') === 'Exclusive' ? round2((taxable * taxPerc) / 100) : 0;

          return {
            ...EMPTY_ITEM,
            original_sales_id: inv.id || inv.sales_id || null,
            original_sales_item_id: it.original_sales_item_id || it.id || null,
            item_id: it.item_id || '',
            item_name: it.item_name || '',
            lot_no: it.lot_no || '',
            uom: it.uom || 'Bags',
            weight: String(unitWt),
            original_sold_qty: soldQty,
            previously_returned_qty: prevRet,
            available_return_qty: availQty,
            qty: String(retQty),
            return_weight: String(retWt),
            destination_godown_id: it.destination_godown_id ? String(it.destination_godown_id) : defaultDestId,
            destination_godown_name: it.destination_godown_name || defaultDestName,
            mfg_date: it.mfg_date || '',
            exp_date: it.exp_date || '',
            rate: String(rate),
            disc_perc: String(discPerc),
            tax_perc: String(taxPerc),
            amount: round2(taxable + taxAmt)
          };
        })
      );
    }

    showBanner('success', `Invoice ${inv.inv_no || inv.id} loaded with eligible return quantities.`);
  }, [showBanner]);

  // Apply selected Customer Complaint auto-fill (keeps Complaint Qty separate from Return Qty)
  const applyComplaintCandidate = useCallback((cmp) => {
    if (!cmp) {
      setFormData((prev) => ({ ...prev, complaint_id: '', complaint_qty: 0 }));
      return;
    }
    const cmpItems = Array.isArray(cmp.items) ? cmp.items : [];
    const totalComplQty = round2(
      cmpItems.reduce((s, it) => s + Number(it.complaint_qty || 0), 0) || Number(cmp.complaint_qty || 0)
    );
    const mapCategoryToReason = (cat) => {
      const c = String(cat || '').toLowerCase();
      if (c === 'quality') return 'Quality Issue';
      if (c === 'packaging') return 'Packaging Defect';
      if (c === 'weight') return 'Wrong Quantity';
      if (c === 'delivery') return 'Transit Delay';
      return reasonCategories.find((r) => r.toLowerCase() === c) || 'Quality Issue';
    };

    const matchedInv = cmp.original_sales_id
      ? invoiceCandidates.find((inv) => Number(inv.id) === Number(cmp.original_sales_id))
      : invoiceCandidates.find(
          (inv) => cmp.original_invoice_no && String(inv.inv_no).toUpperCase() === String(cmp.original_invoice_no).toUpperCase()
        );

    if (matchedInv) {
      applySalesInvoiceCandidate(matchedInv);
      setFormData((prev) => ({
        ...prev,
        complaint_id: String(cmp.id),
        complaint_no: cmp.complaint_no || '',
        complaint_qty: totalComplQty,
        return_reason_category: mapCategoryToReason(cmp.complaint_category),
        return_reason_detail: cmp.complaint_description || prev.return_reason_detail,
        quality_issue_desc: cmp.complaint_description || prev.quality_issue_desc
      }));
      const invItems = Array.isArray(matchedInv.items) ? matchedInv.items : [];
      if (invItems.length > 0) {
        setItems(
          invItems.map((it) => {
            const soldQty = round2(it.original_sold_qty ?? it.qty ?? 0);
            const prevRet = round2(it.previously_returned_qty ?? 0);
            const availQty = it.available_return_qty !== undefined ? round2(it.available_return_qty) : Math.max(0, round2(soldQty - prevRet));
            const ci =
              cmpItems.find(
                (cIt) =>
                  String(cIt.item_name || '').trim().toLowerCase() === String(it.item_name || '').trim().toLowerCase() &&
                  (!cIt.lot_no || !it.lot_no || String(cIt.lot_no).trim().toUpperCase() === String(it.lot_no).trim().toUpperCase())
              ) || cmpItems.find((cIt) => String(cIt.item_name || '').trim().toLowerCase() === String(it.item_name || '').trim().toLowerCase());
            const cQty = round2(ci?.complaint_qty || 0);
            const retQty = cQty > 0 ? Math.min(availQty, cQty) : availQty;
            const unitWt = Number(it.weight || 50);
            const retWt = round2(retQty * unitWt);
            const rate = Number(it.rate || 0);
            const discPerc = Number(it.disc_perc ?? it.disc ?? 0);
            const taxPerc = Number(it.tax_perc ?? it.tax_rate ?? 5);
            const taxable = round2(retQty * rate * (1 - discPerc / 100));
            const taxAmt = (matchedInv.tax_type || 'Exclusive') === 'Exclusive' ? round2((taxable * taxPerc) / 100) : 0;
            return {
              ...EMPTY_ITEM,
              original_sales_id: matchedInv.id,
              original_sales_item_id: it.original_sales_item_id || it.id || null,
              complaint_item_id: ci?.id || null,
              complaint_qty: cQty,
              item_id: it.item_id || '',
              item_name: it.item_name || '',
              lot_no: it.lot_no || '',
              uom: it.uom || 'Bags',
              weight: String(unitWt),
              original_sold_qty: soldQty,
              previously_returned_qty: prevRet,
              available_return_qty: availQty,
              qty: String(retQty),
              return_weight: String(retWt),
              destination_godown_id: it.destination_godown_id ? String(it.destination_godown_id) : (matchedInv.godown_id ? String(matchedInv.godown_id) : ''),
              destination_godown_name: it.destination_godown_name || matchedInv.godown_name || '',
              mfg_date: it.mfg_date || '',
              exp_date: it.exp_date || '',
              rate: String(rate),
              disc_perc: String(discPerc),
              tax_perc: String(taxPerc),
              amount: round2(taxable + taxAmt)
            };
          })
        );
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        complaint_id: String(cmp.id),
        complaint_no: cmp.complaint_no || '',
        complaint_qty: totalComplQty,
        customer_id: cmp.customer_id ? String(cmp.customer_id) : prev.customer_id,
        customer_name: cmp.customer_name || prev.customer_name,
        original_invoice_no: cmp.original_invoice_no || prev.original_invoice_no,
        return_reason_category: mapCategoryToReason(cmp.complaint_category),
        return_reason_detail: cmp.complaint_description || prev.return_reason_detail,
        quality_issue_desc: cmp.complaint_description || prev.quality_issue_desc
      }));
      if (cmpItems.length > 0) {
        setItems(
          cmpItems.map((ci) => {
            const cQty = round2(ci.complaint_qty || 0);
            const unitWt = Number(ci.weight_per_unit || 50);
            return {
              ...EMPTY_ITEM,
              complaint_item_id: ci.id || null,
              complaint_qty: cQty,
              item_id: ci.item_id || '',
              item_name: ci.item_name || '',
              lot_no: ci.lot_no || '',
              uom: ci.uom || 'Bags',
              weight: String(unitWt),
              qty: cQty > 0 ? String(cQty) : '',
              return_weight: cQty > 0 ? String(round2(cQty * unitWt)) : '',
              mfg_date: ci.mfg_date || '',
              exp_date: ci.exp_date || ''
            };
          })
        );
      }
    }
    showBanner('success', `Complaint ${cmp.complaint_no} linked (Complaint Qty ${totalComplQty} kept independent from Return Qty).`);
  }, [invoiceCandidates, applySalesInvoiceCandidate, reasonCategories, showBanner]);

  // Also support SalesDistributionWorkflow import button seamlessly
  const handleWorkflowImport = useCallback((sourceRecord) => {
    if (!sourceRecord) return;
    const matched = invoiceCandidates.find((c) => Number(c.id) === Number(sourceRecord.id));
    if (matched) {
      applySalesInvoiceCandidate(matched);
    } else {
      applySalesInvoiceCandidate({
        ...sourceRecord,
        inv_no: sourceRecord.inv_no || sourceRecord.bill_no || `SAL-${sourceRecord.s_no || sourceRecord.id}`,
        original_invoice_amount: sourceRecord.grand_total || sourceRecord.total_amt || 0,
        items: (sourceRecord.items || []).map((it) => ({
          ...it,
          original_sold_qty: Number(it.qty || 0),
          previously_returned_qty: 0,
          available_return_qty: Number(it.qty || 0)
        }))
      });
    }
  }, [invoiceCandidates, applySalesInvoiceCandidate]);

  // Live GST & line totals calculation
  useEffect(() => {
    const mappedItems = items.map((item) => ({
      ...item,
      disc: parseFloat(item.disc_perc) || 0,
      tax_rate: parseFloat(item.tax_perc) || 0
    }));
    const stateOrAddr = `${formData.customer_state || ''} ${formData.customer_address || ''}`.trim() || 'Tamil Nadu';
    const newTotals = calculateTotals(mappedItems, formData.tax_type, parseFloat(formData.tax_percent) || 0, stateOrAddr);
    setFormData((prev) => ({
      ...prev,
      gross_amt: newTotals.grossAmount || newTotals.baseAmount || 0,
      disc_percent: newTotals.discPercent || 0,
      disc_amount: newTotals.discAmount || 0,
      bill_amt: newTotals.taxableAmount,
      tax_amt: newTotals.taxAmount,
      total_amt: newTotals.totalAmount,
      returned_item_amount: newTotals.totalAmount,
      cgst_amt: newTotals.cgstAmount || 0,
      sgst_amt: newTotals.sgstAmount || 0,
      igst_amt: newTotals.igstAmount || 0,
      tax_percent_display: newTotals.taxPercentDisplay || '0%',
      rate_summaries: newTotals.rateSummaries || []
    }));
  }, [items, formData.tax_type, formData.tax_percent, formData.customer_state, formData.customer_address]);

  // Live Loadman calculation
  useEffect(() => {
    const totalWt = items.reduce(
      (sum, r) => sum + (parseFloat(r.return_weight) || ((parseFloat(r.qty) || 0) * (parseFloat(r.weight) || 0))),
      0
    );
    const rate = parseFloat(formData.loadman_rate_per_kg) || 0;
    setFormData((prev) => ({ ...prev, loadman_charges: round2(totalWt * rate) }));
  }, [items, formData.loadman_rate_per_kg]);

  // Live Deductions & Grand Total
  useEffect(() => {
    const totalAmt = parseFloat(formData.total_amt) || 0;
    const billAmt = parseFloat(formData.bill_amt) || 0;
    let totalAdditions = 0;
    let totalSubtractions = 0;

    selectedDeductions.forEach((d) => {
      const pct = parseFloat(d.percent) || 0;
      let amt = parseFloat(d.amount) || 0;
      if (pct > 0 && billAmt > 0) amt = (billAmt * pct) / 100;
      const dName = String(d.name || '').toLowerCase();
      const rowType = String(d.type || '').toUpperCase();
      const isAdd = rowType === 'ADD' || rowType === '+' || (rowType !== 'LESS' && dName.includes('tcs'));
      if (isAdd) totalAdditions += amt;
      else totalSubtractions += amt;
    });

    const netDed = round2(totalSubtractions - totalAdditions);
    const grandTot = Math.max(0, round2(totalAmt + totalAdditions - totalSubtractions));
    setFormData((prev) => ({
      ...prev,
      deduction_amount: netDed,
      grand_total: grandTot,
      customer_outstanding_adj: prev.settlement_type === 'Credit Note' || prev.settlement_type === 'Refund' ? grandTot : 0,
      refund_amount: prev.settlement_type === 'Refund' && (!prev.refund_amount || prev.refund_amount === prev.grand_total) ? grandTot : prev.refund_amount
    }));
  }, [formData.total_amt, formData.bill_amt, selectedDeductions, formData.settlement_type]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'customer_id') {
        const cust = customers.find((c) => String(c.id) === String(value));
        if (cust) {
          next.customer_name = cust.name || cust.print_name || '';
          next.customer_gstin = cust.gst_number || '';
          next.customer_address = [cust.address1, cust.address2].filter(Boolean).join(', ');
          next.customer_state = cust.state || '';
          next.customer_state_code = cust.state_code || '';
        }
      }
      if (field === 'destination_godown_id') {
        const g = godowns.find((gd) => String(gd.id) === String(value));
        if (g) next.destination_godown_name = g.godown_name;
      }
      if (field === 'settlement_type') {
        if (value === 'Refund' && (!prev.refund_amount || prev.refund_amount === 0)) {
          next.refund_amount = prev.grand_total || 0;
        }
        next.customer_outstanding_adj = value === 'Credit Note' || value === 'Refund' ? (prev.grand_total || 0) : 0;
      }
      return next;
    });
  };

  const handleItemChange = (idx, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[idx], [field]: value };

      if (field === 'item_name') {
        const im = itemMaster.find((m) => String(m.item_name).toLowerCase() === String(value).toLowerCase());
        if (im) {
          row.item_id = im.id;
          if (im.tax !== undefined) row.tax_perc = String(im.tax);
        }
      }
      if (field === 'destination_godown_id') {
        const g = godowns.find((gd) => String(gd.id) === String(value));
        if (g) row.destination_godown_name = g.godown_name;
      }

      const qty = parseFloat(row.qty) || 0;
      const unitWt = parseFloat(row.weight) || 0;
      if (field === 'qty' || field === 'weight') {
        row.return_weight = unitWt > 0 ? String(round2(qty * unitWt)) : row.return_weight;
      }

      const rate = parseFloat(row.rate) || 0;
      const discPerc = parseFloat(row.disc_perc) || 0;
      const taxPerc = parseFloat(row.tax_perc) || 0;
      const gross = qty * rate;
      const taxable = gross - (gross * discPerc) / 100;
      const taxAmt = formData.tax_type === 'Exclusive' ? (taxable * taxPerc) / 100 : 0;
      row.amount = round2(taxable + taxAmt);

      updated[idx] = row;
      return updated;
    });
  };

  const handleDeductionRowChange = (index, field, value) => {
    if (field === 'deduction_id' && value === '__CREATE_NEW__') {
      setInlineDeductionOpen(true);
      return;
    }
    setSelectedDeductions((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      if (field === 'deduction_id') {
        const ded = deductionOptions.find((d) => String(d.id) === String(value));
        if (ded) {
          const dVal = parseFloat(ded.ded_value) || 0;
          const billAmt = parseFloat(formData.bill_amt) || 0;
          const isAdd = String(ded.ded_type || '').toUpperCase() === 'ADD' || (ded.ded_name || '').toLowerCase().includes('tcs');
          row.name = ded.ded_name || '';
          row.type = isAdd ? 'ADD' : 'LESS';
          if (ded.ded_type === 'Percentage') {
            row.percent = String(dVal);
            row.amount = ((billAmt * dVal) / 100).toFixed(2);
          } else {
            row.percent = '';
            row.amount = String(dVal);
          }
        }
      } else if (field === 'percent') {
        const pct = parseFloat(value) || 0;
        const billAmt = parseFloat(formData.bill_amt) || 0;
        if (pct > 0) row.amount = ((billAmt * pct) / 100).toFixed(2);
      }
      updated[index] = row;
      return updated;
    });
  };

  const totalSummary = useMemo(() => {
    const qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const weight = items.reduce((s, i) => s + (parseFloat(i.return_weight) || ((parseFloat(i.qty) || 0) * (parseFloat(i.weight) || 0))), 0);
    return { qty: round2(qty), weight: round2(weight) };
  }, [items]);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoiceCandidates;
    return invoiceCandidates.filter((inv) =>
      `${inv.inv_no} ${inv.customer_name} ${inv.sales_order_no} ${inv.outpass_no} ${inv.date}`.toLowerCase().includes(q)
    );
  }, [invoiceCandidates, invoiceSearch]);

  const filteredComplaints = useMemo(() => {
    const q = complaintSearch.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter((c) =>
      `${c.complaint_no} ${c.customer_name} ${c.original_invoice_no} ${c.complaint_category} ${c.product_name} ${c.lot_no}`.toLowerCase().includes(q)
    );
  }, [complaints, complaintSearch]);

  const handleSave = async () => {
    const validItems = items.filter((i) => String(i.item_name || '').trim() !== '');
    if (validItems.length === 0) {
      showBanner('error', 'Please select a Sales Invoice or add at least one returned item.');
      return;
    }
    if (!String(formData.customer_name || formData.customer_id || '').trim()) {
      showBanner('error', 'Customer is required.');
      return;
    }
    if (!formData.return_reason_category) {
      showBanner('error', 'Please select a Return Reason Category in Section C.');
      return;
    }
    if (formData.return_reason_category === 'Other' && !String(formData.return_reason_detail || '').trim()) {
      showBanner('error', 'Please enter Detailed Return Reason when "Other" is selected.');
      return;
    }

    for (const it of validItems) {
      const q = round2(it.qty || 0);
      if (q <= 0) {
        showBanner('error', `Return Qty must be greater than 0 for "${it.item_name}".`);
        return;
      }
      if (formData.original_sales_id && Number(it.original_sold_qty || 0) > 0 && !formData.authorized_override) {
        const avail = round2(it.available_return_qty || 0);
        if (q > avail + 0.001) {
          showBanner('error', `Return Qty (${q}) exceeds Available Return Qty (${avail}) for "${it.item_name}".`);
          return;
        }
      }
    }

    setLoading(true);
    setBanner({ type: '', text: '' });

    try {
      const validDeductions = selectedDeductions.filter(
        (d) => d.deduction_id || d.name || parseFloat(d.amount) > 0
      );

      const payload = {
        ...formData,
        customer: formData.customer_name || formData.customer_id,
        total_qty: totalSummary.qty,
        total_wt: totalSummary.weight,
        total_amt: formData.grand_total,
        deduction: validDeductions.map((d) => d.name).filter(Boolean).join(', '),
        deductions_json: JSON.stringify(validDeductions),
        items: validItems.map((it) => ({
          ...it,
          qty: round2(it.qty || 0),
          weight: Number(it.weight || 50),
          return_weight: round2(it.return_weight || ((parseFloat(it.qty) || 0) * (parseFloat(it.weight) || 50))),
          rate: Number(it.rate || 0),
          disc_perc: Number(it.disc_perc || 0),
          tax_perc: Number(it.tax_perc || 0),
          amount: round2(it.amount || 0)
        }))
      };

      const endpoint = editId ? `/sales-returns/${editId}` : '/sales-returns';
      const method = editId ? 'PUT' : 'POST';
      const res = await api(endpoint, { method, body: payload });

      if (res && res.success !== false) {
        showBanner('success', res.message || 'Sales Return saved successfully!');
        setTimeout(() => navigate('/entry/sales-return-display'), 950);
      } else {
        showBanner('error', res?.message || res?.error || 'Failed to save Sales Return');
      }
    } catch (err) {
      console.error('Error saving sales return:', err);
      showBanner('error', err.message || 'Failed to save Sales Return');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!editId) return;
    if (approvalForm.settlement_type === 'No Financial Adjustment' && !String(approvalForm.no_adjustment_reason || approvalForm.approval_remarks || '').trim()) {
      showBanner('error', 'Please enter an authorization reason for "No Financial Adjustment".');
      return;
    }
    setLoading(true);
    try {
      const res = await api(`/sales-returns/${editId}/approve`, {
        method: 'POST',
        body: approvalForm
      });
      if (res && res.success !== false) {
        setApproveModalOpen(false);
        showBanner('success', res.message || 'Sales Return approved & disposition applied.');
        setTimeout(() => navigate('/entry/sales-return-display'), 900);
      } else {
        showBanner('error', res?.message || 'Approval failed');
      }
    } catch (err) {
      showBanner('error', err.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const showSec = (key) => activeSection === 'all' || activeSection === key;
  const isInterState = Boolean(
    formData.customer_state &&
    !formData.customer_state.toLowerCase().includes('tamil nadu') &&
    String(formData.customer_state_code || '') !== '33'
  );

  return (
    <div className="sr-page">
      {/* Header Bar */}
      <div className="sr-header-bar">
        <div className="sr-header-left">
          <button
            type="button"
            className="sr-back-btn"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>
                {editId ? `Update Sales Return (${formData.return_no || `#${editId}`})` : 'New Sales Return Entry'}
              </h2>
              <span className="sr-badge-pill" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                QC: {formData.qc_status}
              </span>
              <span className="sr-badge-pill" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                Stock: {formData.stock_status}
              </span>
              <span className="sr-badge-pill" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                {formData.workflow_status}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#dbeafe', marginTop: '2px' }}>
              {selectedCompany?.name || 'BVC Exports Pvt Ltd'} · FY {financialYear || '2026-2027'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {editId && (
            <button
              type="button"
              onClick={() => navigate(`/entry/capa-create?sales_return_id=${editId}`)}
              style={{
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Generate CAPA
            </button>
          )}
          {editId && canAuthorize && formData.approval_status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setApproveModalOpen(true)}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✓ QC Inspect & Approve Disposition
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                open: true,
                title: 'Cancel Entry',
                message: 'Discard unsaved changes and return to Sales Return Display?',
                onConfirm: () => navigate('/entry/sales-return-display')
              })
            }
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || initializing}
            onClick={handleSave}
            style={{
              backgroundColor: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              borderRadius: '5px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Saving...' : editId ? 'Update Sales Return' : 'Save Sales Return (QC Hold)'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sr-kpi-grid">
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Returned Qty & Weight</div>
          <div className="sr-kpi-value">{totalSummary.qty.toLocaleString('en-IN')} Units</div>
          <div className="sr-kpi-sub">{totalSummary.weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG Return Wt</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Taxable + GST Adjustment</div>
          <div className="sr-kpi-value">₹{round2(formData.bill_amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="sr-kpi-sub">GST Reversal: ₹{round2(formData.tax_amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Net Return / Credit Value</div>
          <div className="sr-kpi-value" style={{ color: '#dc2626' }}>
            ₹{round2(formData.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="sr-kpi-sub">Orig Inv: ₹{round2(formData.original_invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="sr-kpi-card">
          <div className="sr-kpi-label">Food Safety Hold & Settlement</div>
          <div className="sr-kpi-value" style={{ fontSize: '15px', color: '#1e3a8a' }}>
            {formData.stock_status} · {formData.settlement_type}
          </div>
          <div className="sr-kpi-sub">Reason: {formData.return_reason_category || 'Not Set'}</div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="sr-tabs-bar">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sr-tab-btn ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {banner.text && (
        <div className={`sr-notice-banner ${banner.type === 'error' ? 'sr-notice-red' : 'sr-notice-green'}`} style={{ marginTop: '12px' }}>
          {banner.text}
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <SalesDistributionWorkflow
          currentModule="sales_return"
          onImportRecord={handleWorkflowImport}
          importButtonText="Import from Sales Invoice"
        />
      </div>

      {/* SECTION A: ORIGINAL SALES DETAILS */}
      {showSec('A') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section A · Original Sales Details & Customer Context</span>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
              Select an Original Sales Invoice to auto-fill customer, lots, rates & eligible quantities
            </span>
          </div>
          <div className="sr-section-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '10px', padding: '12px', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '6px' }}>
              <div className="sr-field">
                <label className="sr-label">Filter Customer Complaints</label>
                <input
                  type="text"
                  className="sr-input"
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  placeholder="Type complaint no, customer, invoice, lot..."
                />
              </div>
              <div className="sr-field">
                <label className="sr-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Linked Customer Complaint (Optional)</span>
                  {formData.complaint_no && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', backgroundColor: '#fef3c7', padding: '1px 7px', borderRadius: '4px' }}>
                      Complaint Qty: {round2(formData.complaint_qty)} (Independent of Return Qty)
                    </span>
                  )}
                </label>
                <select
                  className="sr-select"
                  value={formData.complaint_id}
                  onChange={(e) => {
                    const cmp = complaints.find((c) => String(c.id) === String(e.target.value));
                    applyComplaintCandidate(cmp || null);
                  }}
                >
                  <option value="">-- Optional: Link Customer Complaint --</option>
                  {filteredComplaints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.complaint_no} | {c.complaint_date} | {c.customer_name} | {c.complaint_category} | Compl Qty: {round2(c.complaint_qty)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
              <div className="sr-field">
                <label className="sr-label">Filter Posted Invoices</label>
                <input
                  type="text"
                  className="sr-input"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Type invoice no, customer, outpass, SO..."
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">
                  Original Sales Invoice Reference <span className="sr-req">*</span>
                </label>
                <select
                  className="sr-select"
                  value={formData.original_sales_id}
                  onChange={(e) => {
                    const inv = invoiceCandidates.find((c) => String(c.id) === String(e.target.value));
                    if (inv) applySalesInvoiceCandidate(inv);
                    else handleFieldChange('original_sales_id', e.target.value);
                  }}
                >
                  <option value="">-- Select Original Sales Invoice to Auto-Fill --</option>
                  {filteredInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.inv_no} | {inv.date} | {inv.customer_name} | Eligible: {inv.total_eligible_qty}/{inv.total_qty} | ₹{round2(inv.original_invoice_amount).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sr-form-grid">
              <div className="sr-field">
                <label className="sr-label">Sales Return Number</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.return_no}
                  onChange={(e) => handleFieldChange('return_no', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Return Date <span className="sr-req">*</span></label>
                <input
                  type="date"
                  className="sr-input"
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Original Invoice Number</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.original_invoice_no}
                  onChange={(e) => handleFieldChange('original_invoice_no', e.target.value)}
                  placeholder="SAL-00001"
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Original Invoice Date</label>
                <input
                  type="date"
                  className="sr-input"
                  value={formData.original_invoice_date}
                  onChange={(e) => handleFieldChange('original_invoice_date', e.target.value)}
                />
              </div>

              <div className="sr-field span-2">
                <label className="sr-label">Customer Name <span className="sr-req">*</span></label>
                <select
                  className="sr-select"
                  value={formData.customer_id}
                  onChange={(e) => handleFieldChange('customer_id', e.target.value)}
                >
                  <option value="">{formData.customer_name ? `${formData.customer_name} (Selected)` : '-- Select Customer --'}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.print_name}</option>
                  ))}
                </select>
              </div>

              <div className="sr-field">
                <label className="sr-label">Customer GSTIN</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.customer_gstin}
                  onChange={(e) => handleFieldChange('customer_gstin', e.target.value)}
                  placeholder="33XXXXX..."
                />
              </div>

              <div className="sr-field">
                <label className="sr-label">Customer State / Place of Supply</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.customer_state}
                  onChange={(e) => handleFieldChange('customer_state', e.target.value)}
                />
              </div>

              <div className="sr-field">
                <label className="sr-label">Sales Order Number</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.sales_order_no}
                  onChange={(e) => handleFieldChange('sales_order_no', e.target.value)}
                />
              </div>

              <div className="sr-field">
                <label className="sr-label">Delivery Challan / Outpass No.</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.delivery_challan_no || formData.outpass_no}
                  onChange={(e) => handleFieldChange('delivery_challan_no', e.target.value)}
                />
              </div>

              <div className="sr-field span-2">
                <label className="sr-label">Customer Billing / Dispatch Address</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.customer_address}
                  onChange={(e) => handleFieldChange('customer_address', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: RETURNED ITEM DETAILS */}
      {showSec('B') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section B · Returned Item Details & Eligible Return Qty Control</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                className="sr-select"
                style={{ width: '150px', height: '32px', minHeight: '32px' }}
                value={formData.tax_type}
                onChange={(e) => handleFieldChange('tax_type', e.target.value)}
              >
                <option value="Exclusive">Tax: Exclusive</option>
                <option value="Inclusive">Tax: Inclusive</option>
                <option value="Without Tax">Without Tax</option>
              </select>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                style={{
                  backgroundColor: '#1f4fb2',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Add Item Row
              </button>
            </div>
          </div>
          <div className="sr-section-body">
            {canAuthorize && formData.original_sales_id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formData.authorized_override)}
                    onChange={(e) => handleFieldChange('authorized_override', e.target.checked)}
                  />
                  Authorized Over-Return Adjustment (Admin/Manager Only)
                </label>
                {formData.authorized_override && (
                  <input
                    type="text"
                    className="sr-input"
                    style={{ maxWidth: '420px', height: '32px', minHeight: '32px' }}
                    value={formData.override_reason}
                    onChange={(e) => handleFieldChange('override_reason', e.target.value)}
                    placeholder="Mandatory reason for exceeding invoice eligible quantity..."
                  />
                )}
              </div>
            )}

            <div className="sr-table-wrap">
              <table className="sr-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ minWidth: '185px' }}>Item Name</th>
                    <th style={{ minWidth: '115px' }}>FG Lot No.</th>
                    <th style={{ minWidth: '85px' }}>UOM</th>
                    <th style={{ minWidth: '85px', textAlign: 'right' }}>Orig Sold</th>
                    <th style={{ minWidth: '85px', textAlign: 'right' }}>Prev Ret</th>
                    <th style={{ minWidth: '90px', textAlign: 'right' }}>Avail Qty</th>
                    <th style={{ minWidth: '85px', textAlign: 'right' }}>Compl Qty</th>
                    <th style={{ minWidth: '95px', textAlign: 'right' }}>Return Qty *</th>
                    <th style={{ minWidth: '80px', textAlign: 'right' }}>Wt/Unit</th>
                    <th style={{ minWidth: '100px', textAlign: 'right' }}>Return Wt (Kg)</th>
                    <th style={{ minWidth: '140px' }}>Dest Godown</th>
                    <th style={{ minWidth: '120px' }}>Mfg Date</th>
                    <th style={{ minWidth: '120px' }}>Exp Date</th>
                    <th style={{ minWidth: '95px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ minWidth: '75px', textAlign: 'right' }}>Disc %</th>
                    <th style={{ minWidth: '75px', textAlign: 'right' }}>GST %</th>
                    <th style={{ minWidth: '115px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const qVal = round2(row.qty || 0);
                    const availVal = round2(row.available_return_qty || 0);
                    const exceeds = Boolean(formData.original_sales_id && Number(row.original_sold_qty || 0) > 0 && qVal > availVal + 0.001 && !formData.authorized_override);
                    return (
                      <tr key={idx} style={{ backgroundColor: exceeds ? '#fef2f2' : '#ffffff' }}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td>
                          <select
                            className="sr-tbl-select"
                            value={row.item_name || ''}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                          >
                            <option value="">-- Select Item --</option>
                            {itemMaster.map((im) => (
                              <option key={im.id} value={im.item_name}>{im.item_name}</option>
                            ))}
                            {row.item_name && !itemMaster.some((im) => im.item_name === row.item_name) && (
                              <option value={row.item_name}>{row.item_name}</option>
                            )}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="sr-tbl-input"
                            value={row.lot_no || ''}
                            onChange={(e) => handleItemChange(idx, 'lot_no', e.target.value)}
                            placeholder="LOT..."
                          />
                        </td>
                        <td>
                          <select
                            className="sr-tbl-select"
                            value={row.uom || 'Bags'}
                            onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                          >
                            <option value="Bags">Bags</option>
                            <option value="Kg">Kg</option>
                            <option value="Nos">Nos</option>
                            <option value="Boxes">Boxes</option>
                          </select>
                        </td>
                        <td>
                          <input type="text" className="sr-tbl-input sr-num" value={row.original_sold_qty || 0} readOnly />
                        </td>
                        <td>
                          <input type="text" className="sr-tbl-input sr-num" value={row.previously_returned_qty || 0} readOnly />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="sr-tbl-input sr-num"
                            style={{ fontWeight: 700, color: exceeds ? '#dc2626' : '#166534' }}
                            value={row.original_sold_qty > 0 ? availVal : 'Manual'}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="sr-tbl-input sr-num"
                            style={{ fontWeight: 700, color: '#92400e', backgroundColor: '#fffbeb' }}
                            value={row.complaint_qty || 0}
                            title="Complaint Quantity (independent from Actual Return Qty)"
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="sr-tbl-input sr-num"
                            style={{ borderColor: exceeds ? '#dc2626' : '#94a3b8', fontWeight: 700 }}
                            value={row.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="sr-tbl-input sr-num"
                            value={row.weight}
                            onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="sr-tbl-input sr-num"
                            value={row.return_weight}
                            onChange={(e) => handleItemChange(idx, 'return_weight', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="sr-tbl-select"
                            value={row.destination_godown_id || ''}
                            onChange={(e) => handleItemChange(idx, 'destination_godown_id', e.target.value)}
                          >
                            <option value="">-- Godown --</option>
                            {godowns.map((g) => (
                              <option key={g.id} value={g.id}>{g.godown_name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            className="sr-tbl-input"
                            value={row.mfg_date || ''}
                            onChange={(e) => handleItemChange(idx, 'mfg_date', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="sr-tbl-input"
                            value={row.exp_date || ''}
                            onChange={(e) => handleItemChange(idx, 'exp_date', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="sr-tbl-input sr-num"
                            value={row.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="sr-tbl-input sr-num"
                            value={row.disc_perc}
                            onChange={(e) => handleItemChange(idx, 'disc_perc', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="sr-tbl-input sr-num"
                            value={row.tax_perc}
                            onChange={(e) => handleItemChange(idx, 'tax_perc', e.target.value)}
                          />
                        </td>
                        <td className="sr-num" style={{ fontWeight: 800, paddingRight: '8px' }}>
                          ₹{round2(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                            style={{
                              backgroundColor: items.length <= 1 ? '#e2e8f0' : '#dc2626',
                              color: items.length <= 1 ? '#94a3b8' : '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              width: '28px',
                              height: '28px',
                              fontWeight: 700,
                              cursor: items.length <= 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: RETURN REASON AND QUALITY INSPECTION */}
      {showSec('C') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section C · Return Reason Classification & Quality Inspection</span>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              Reason is tracked independently from physical stock disposition and financial settlement
            </span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Return Reason Category <span className="sr-req">*</span></label>
                <select
                  className="sr-select"
                  value={formData.return_reason_category}
                  onChange={(e) => handleFieldChange('return_reason_category', e.target.value)}
                >
                  {reasonCategories.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Customer Complaint No.</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.complaint_no}
                  onChange={(e) => handleFieldChange('complaint_no', e.target.value)}
                  placeholder="CMP-..."
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Inspection Required</label>
                <select
                  className="sr-select"
                  value={formData.inspection_required ? '1' : '0'}
                  onChange={(e) => handleFieldChange('inspection_required', e.target.value === '1')}
                >
                  <option value="1">Yes (Mandatory Food QC Hold)</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div className="sr-field span-2">
                <label className="sr-label">
                  Detailed Return Reason {formData.return_reason_category === 'Other' && <span className="sr-req">*</span>}
                </label>
                <textarea
                  className="sr-textarea"
                  value={formData.return_reason_detail}
                  onChange={(e) => handleFieldChange('return_reason_detail', e.target.value)}
                  placeholder="Specify detailed customer return explanation..."
                />
              </div>
              <div className="sr-field span-2">
                <label className="sr-label">Quality Issue Description</label>
                <textarea
                  className="sr-textarea"
                  value={formData.quality_issue_desc}
                  onChange={(e) => handleFieldChange('quality_issue_desc', e.target.value)}
                  placeholder="Taste, moisture %, packaging tear, insect/contamination observation, shelf-life..."
                />
              </div>

              <div className="sr-field">
                <label className="sr-label">Inspection Date</label>
                <input
                  type="date"
                  className="sr-input"
                  value={formData.inspection_date}
                  onChange={(e) => handleFieldChange('inspection_date', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Inspected By</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.inspected_by}
                  onChange={(e) => handleFieldChange('inspected_by', e.target.value)}
                  placeholder="QC Inspector name"
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Quality Test Result</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.qc_status}
                  readOnly
                  title="Updated via QC Inspection & Approval workflow"
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Supporting Photos / Docs Ref</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.supporting_docs}
                  onChange={(e) => handleFieldChange('supporting_docs', e.target.value)}
                  placeholder="Lab report / Photo ref..."
                />
              </div>
              <div className="sr-field span-4">
                <label className="sr-label">QC Remarks</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.qc_remarks}
                  onChange={(e) => handleFieldChange('qc_remarks', e.target.value)}
                  placeholder="Preliminary QC observations..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: RETURNED GOODS CONDITION & STOCK DISPOSITION */}
      {showSec('D') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section D · Returned Goods Condition & Stock Disposition</span>
            <span className="sr-badge-pill" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
              Current Stock Status: {formData.stock_status}
            </span>
          </div>
          <div className="sr-section-body">
            <div className="sr-notice-banner sr-notice-amber">
              Food Safety Inventory Rule: Returned finished goods ALWAYS enter Quality Hold upon receipt and are NOT added into saleable FG stock until QC Inspection and Authorized Approval explicitly route them to Good / Resalable, Reprocessing Required, or Wastage / Rejected.
            </div>
            <div className="sr-form-grid">
              <div className="sr-field span-2">
                <label className="sr-label">Observed Goods Condition (On Receipt)</label>
                <select
                  className="sr-select"
                  value={formData.goods_condition}
                  onChange={(e) => handleFieldChange('goods_condition', e.target.value)}
                >
                  {goodsConditions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Destination Godown</label>
                <select
                  className="sr-select"
                  value={formData.destination_godown_id}
                  onChange={(e) => handleFieldChange('destination_godown_id', e.target.value)}
                >
                  <option value="">-- Select Godown --</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.godown_name}</option>
                  ))}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Stock Disposition Status</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.stock_status}
                  readOnly
                  title="Stock disposition is finalized during Authorized Approval"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION E: RETURN SETTLEMENT & CREDIT NOTE */}
      {showSec('E') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section E · Return Settlement, Credit Note & GST Reversal</span>
            <span className="sr-badge-pill" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
              Settlement Status: {formData.settlement_status}
            </span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid" style={{ marginBottom: '16px' }}>
              <div className="sr-field">
                <label className="sr-label">Settlement Type <span className="sr-req">*</span></label>
                <select
                  className="sr-select"
                  value={formData.settlement_type}
                  onChange={(e) => handleFieldChange('settlement_type', e.target.value)}
                >
                  {settlementTypes.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Original Invoice Amount (₹)</label>
                <input type="text" className="sr-input sr-num" value={round2(formData.original_invoice_amount).toFixed(2)} readOnly />
              </div>
              <div className="sr-field">
                <label className="sr-label">Returned Item Amount (₹)</label>
                <input type="text" className="sr-input sr-num" value={round2(formData.returned_item_amount).toFixed(2)} readOnly />
              </div>
              <div className="sr-field">
                <label className="sr-label">Customer Outstanding Adj (₹)</label>
                <input type="text" className="sr-input sr-num" value={round2(formData.customer_outstanding_adj).toFixed(2)} readOnly />
              </div>

              {(formData.settlement_type === 'Credit Note' || formData.settlement_type === 'Refund') && (
                <>
                  <div className="sr-field">
                    <label className="sr-label">Credit Note Number</label>
                    <input
                      type="text"
                      className="sr-input"
                      value={formData.credit_note_no}
                      onChange={(e) => handleFieldChange('credit_note_no', e.target.value)}
                    />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Credit Note Date</label>
                    <input
                      type="date"
                      className="sr-input"
                      value={formData.credit_note_date}
                      onChange={(e) => handleFieldChange('credit_note_date', e.target.value)}
                    />
                  </div>
                </>
              )}

              {formData.settlement_type === 'Refund' && (
                <>
                  <div className="sr-field">
                    <label className="sr-label">Refund Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="sr-input sr-num"
                      value={formData.refund_amount}
                      onChange={(e) => handleFieldChange('refund_amount', e.target.value)}
                    />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Refund Mode</label>
                    <select
                      className="sr-select"
                      value={formData.refund_mode}
                      onChange={(e) => handleFieldChange('refund_mode', e.target.value)}
                    >
                      <option value="Bank">Bank / NEFT / RTGS</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  {formData.refund_mode === 'Bank' && (
                    <div className="sr-field span-2">
                      <label className="sr-label">Bank Account Ledger</label>
                      <select
                        className="sr-select"
                        value={formData.refund_bank_name}
                        onChange={(e) => handleFieldChange('refund_bank_name', e.target.value)}
                      >
                        <option value="">-- Select Bank Account --</option>
                        {banks.map((b) => (
                          <option key={b.id} value={b.ledger_name}>{b.ledger_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="sr-field span-2">
                    <label className="sr-label">Refund Transaction Ref / UTR</label>
                    <input
                      type="text"
                      className="sr-input"
                      value={formData.refund_ref_no}
                      onChange={(e) => handleFieldChange('refund_ref_no', e.target.value)}
                    />
                  </div>
                </>
              )}

              {formData.settlement_type === 'Replacement' && (
                <>
                  <div className="sr-field">
                    <label className="sr-label">Replacement Value (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="sr-input sr-num"
                      value={formData.replacement_amount}
                      onChange={(e) => handleFieldChange('replacement_amount', e.target.value)}
                    />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Replacement Dispatch / Order Ref</label>
                    <input
                      type="text"
                      className="sr-input"
                      value={formData.replacement_ref_no}
                      onChange={(e) => handleFieldChange('replacement_ref_no', e.target.value)}
                    />
                  </div>
                </>
              )}

              {formData.settlement_type === 'No Financial Adjustment' && (
                <div className="sr-field span-4">
                  <label className="sr-label">Authorization Justification for No Financial Adjustment <span className="sr-req">*</span></label>
                  <input
                    type="text"
                    className="sr-input"
                    value={formData.no_adjustment_reason}
                    onChange={(e) => handleFieldChange('no_adjustment_reason', e.target.value)}
                    placeholder="Explain why no Credit Note / Refund is issued..."
                  />
                </div>
              )}
            </div>

            <EntryTaxBillDetails
              title="Credit Note GST Tax Adjustment Breakdown"
              grossAmt={formData.gross_amt || 0}
              discPercent={formData.disc_percent || 0}
              discAmt={formData.disc_amount || 0}
              billAmt={formData.bill_amt}
              taxAmt={formData.tax_amt}
              totalAmt={formData.total_amt}
              grandTotal={formData.grand_total || formData.total_amt}
              taxPercent={formData.tax_percent}
              cgstAmt={formData.cgst_amt}
              sgstAmt={formData.sgst_amt}
              igstAmt={formData.igst_amt}
              rateSummaries={formData.rate_summaries}
              deductionsAmt={formData.deduction_amount}
              taxType={formData.tax_type}
              isInterState={isInterState}
            />

            {/* Deductions */}
            <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>Return Deductions / Freight Recovery</span>
                <button
                  type="button"
                  onClick={() => setSelectedDeductions((prev) => [...prev, { deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }])}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: '5px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  + Add Deduction
                </button>
              </div>
              {selectedDeductions.map((dRow, dIdx) => (
                <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1fr 0.8fr 1.1fr 1.4fr 38px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <select
                    className="sr-tbl-select"
                    value={dRow.deduction_id || ''}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'deduction_id', e.target.value)}
                  >
                    <option value="">-- Master --</option>
                    {deductionOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.ded_name}</option>
                    ))}
                    <option value="__CREATE_NEW__">{getCreateLabel('deduction_sales')}</option>
                  </select>
                  <input
                    type="text"
                    className="sr-tbl-input"
                    value={dRow.name || ''}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'name', e.target.value)}
                    placeholder="Deduction Name"
                  />
                  <select
                    className="sr-tbl-select"
                    value={dRow.type === 'ADD' ? 'ADD' : 'LESS'}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'type', e.target.value)}
                  >
                    <option value="LESS">LESS (-)</option>
                    <option value="ADD">ADD (+)</option>
                  </select>
                  <input
                    type="number"
                    className="sr-tbl-input sr-num"
                    value={dRow.percent || ''}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'percent', e.target.value)}
                    placeholder="%"
                  />
                  <input
                    type="number"
                    className="sr-tbl-input sr-num"
                    value={dRow.amount || ''}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'amount', e.target.value)}
                    placeholder="₹"
                  />
                  <input
                    type="text"
                    className="sr-tbl-input"
                    value={dRow.remarks || ''}
                    onChange={(e) => handleDeductionRowChange(dIdx, 'remarks', e.target.value)}
                    placeholder="Remarks"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDeductions((prev) =>
                        prev.length <= 1 ? [{ deduction_id: '', name: '', type: 'LESS', percent: '', amount: '', remarks: '' }] : prev.filter((_, i) => i !== dIdx)
                      )
                    }
                    style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION F: TRANSPORT AND RETURN DOCUMENTS */}
      {showSec('F') && (
        <div className="sr-section-card">
          <div className="sr-section-header">
            <span className="sr-section-title">Section F · Return Transport, Logistics & Supporting Documents</span>
          </div>
          <div className="sr-section-body">
            <div className="sr-form-grid">
              <div className="sr-field">
                <label className="sr-label">Return Vehicle Number</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.return_vehicle_no}
                  onChange={(e) => handleFieldChange('return_vehicle_no', e.target.value)}
                  placeholder="TN54..."
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Transporter Name</label>
                <select
                  className="sr-select"
                  value={formData.transporter_name}
                  onChange={(e) => {
                    if (e.target.value === '__CREATE_NEW__') {
                      setInlineTransporterOpen(true);
                      return;
                    }
                    handleFieldChange('transporter_name', e.target.value);
                  }}
                >
                  <option value="">-- Select Transporter --</option>
                  {transporters.map((t) => (
                    <option key={t.id} value={t.name || t.print_name}>{t.name || t.print_name}</option>
                  ))}
                  {formData.transporter_name && !transporters.some((t) => (t.name || t.print_name) === formData.transporter_name) && (
                    <option value={formData.transporter_name}>{formData.transporter_name}</option>
                  )}
                  <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                    + Enter Transporter Manually
                  </option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Driver Name</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.driver_name}
                  onChange={(e) => handleFieldChange('driver_name', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Return Freight (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="sr-input sr-num"
                  value={formData.return_freight}
                  onChange={(e) => handleFieldChange('return_freight', e.target.value)}
                />
              </div>

              <div className="sr-field">
                <label className="sr-label">Freight Paid By</label>
                <select
                  className="sr-select"
                  value={formData.freight_paid_by}
                  onChange={(e) => handleFieldChange('freight_paid_by', e.target.value)}
                >
                  <option value="Company">Company (Seller)</option>
                  <option value="Customer">Customer (Buyer)</option>
                  <option value="Transporter">Transporter Claim</option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Return Inpass / Outpass Ref</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.return_pass_ref}
                  onChange={(e) => handleFieldChange('return_pass_ref', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Customer Return Challan No.</label>
                <input
                  type="text"
                  className="sr-input"
                  value={formData.customer_return_challan}
                  onChange={(e) => handleFieldChange('customer_return_challan', e.target.value)}
                />
              </div>
              <div className="sr-field">
                <label className="sr-label">Loadman Unloading Charges (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="sr-input sr-num"
                  value={formData.loadman_charges}
                  onChange={(e) => handleFieldChange('loadman_charges', e.target.value)}
                />
              </div>

              <div className="sr-field span-4">
                <label className="sr-label">General Remarks / Warehouse Notes</label>
                <textarea
                  className="sr-textarea"
                  value={formData.remarks}
                  onChange={(e) => handleFieldChange('remarks', e.target.value)}
                  placeholder="Additional return receiving notes..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Action Bar */}
      <div className="sr-footer-bar">
        <div style={{ fontSize: '12px', color: '#475569' }}>
          <strong>Grand Total Credit / Return Value:</strong>{' '}
          <span style={{ fontSize: '17px', fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
            ₹{round2(formData.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/entry/sales-return-display')}
            style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '8px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Back to Register
          </button>
          <button
            type="button"
            disabled={loading || initializing}
            onClick={handleSave}
            style={{ backgroundColor: '#1f4fb2', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '8px 18px', fontWeight: 800, fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Saving...' : editId ? 'Save Changes' : 'Save Sales Return (QC Hold)'}
          </button>
        </div>
      </div>

      {/* Inline Master Modals */}
      <InlineMasterModal
        open={inlineDeductionOpen}
        onClose={() => setInlineDeductionOpen(false)}
        masterType="deduction_sales"
        onSuccess={async (newId, newRecord) => {
          const res = await api('/masters/deduction_sales').catch(() => null);
          const list = res?.data || res || [];
          if (Array.isArray(list)) setDeductionOptions(list);
          if (newRecord) {
            setSelectedDeductions((prev) => [
              ...prev.filter((r) => r.deduction_id || r.name),
              { deduction_id: newId || newRecord.id, name: newRecord.ded_name || '', type: 'LESS', percent: '', amount: String(newRecord.ded_value || 0), remarks: '' }
            ]);
          }
        }}
      />

      <InlineMasterModal
        open={inlineTransporterOpen}
        onClose={() => setInlineTransporterOpen(false)}
        masterType="transporters"
        onSuccess={async (_newId, newRecord) => {
          const res = await api('/masters/transport_master').catch(() => null);
          const list = res?.data || res || [];
          if (Array.isArray(list)) setTransporters(list);
          const name = newRecord?.name || newRecord?.print_name || '';
          if (name) handleFieldChange('transporter_name', name);
        }}
      />

      {/* In-App Confirmation Modal */}
      {confirmModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '92%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 20px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#1f4fb2', color: '#fff', fontWeight: 800, fontSize: '14px' }}>
              {confirmModal.title}
            </div>
            <div style={{ padding: '16px', fontSize: '13px', color: '#334155' }}>{confirmModal.message}</div>
            <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null })}
                style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
                  if (fn) fn();
                }}
                style={{ padding: '6px 14px', borderRadius: '5px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QC Inspection & Authorized Disposition Modal (when editing) */}
      {approveModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '14px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.28)' }}>
            <div style={{ padding: '12px 18px', backgroundColor: '#1f4fb2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>QC Inspection & Authorized Return Approval ({formData.return_no})</span>
              <button type="button" onClick={() => setApproveModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sr-field">
                <label className="sr-label">QC Test Result</label>
                <select className="sr-select" value={approvalForm.qc_status} onChange={(e) => setApprovalForm((p) => ({ ...p, qc_status: e.target.value }))}>
                  <option value="Approved">Approved</option>
                  <option value="Hold">Hold</option>
                  <option value="Reprocess">Reprocess</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Inspected By</label>
                <input type="text" className="sr-input" value={approvalForm.inspected_by} onChange={(e) => setApprovalForm((p) => ({ ...p, inspected_by: e.target.value }))} />
              </div>
              <div className="sr-field">
                <label className="sr-label">Stock Disposition (Physical Routing)</label>
                <select className="sr-select" value={approvalForm.stock_disposition} onChange={(e) => setApprovalForm((p) => ({ ...p, stock_disposition: e.target.value }))}>
                  <option value="Resalable">Resalable (Inward to Approved FG Stock)</option>
                  <option value="Hold">Hold (Keep in Quality Quarantine)</option>
                  <option value="Reprocess">Reprocess (Route for Reprocessing)</option>
                  <option value="Wastage">Wastage (Record Wastage / Disposal)</option>
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Destination Godown</label>
                <select className="sr-select" value={approvalForm.destination_godown_id} onChange={(e) => {
                  const g = godowns.find((gd) => String(gd.id) === String(e.target.value));
                  setApprovalForm((p) => ({ ...p, destination_godown_id: e.target.value, destination_godown_name: g?.godown_name || '' }));
                }}>
                  <option value="">-- Select Godown --</option>
                  {godowns.map((g) => <option key={g.id} value={g.id}>{g.godown_name}</option>)}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Financial Settlement Type</label>
                <select className="sr-select" value={approvalForm.settlement_type} onChange={(e) => setApprovalForm((p) => ({ ...p, settlement_type: e.target.value }))}>
                  {settlementTypes.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="sr-field">
                <label className="sr-label">Credit Note Date</label>
                <input type="date" className="sr-input" value={approvalForm.credit_note_date} onChange={(e) => setApprovalForm((p) => ({ ...p, credit_note_date: e.target.value }))} />
              </div>
              {approvalForm.settlement_type === 'Refund' && (
                <>
                  <div className="sr-field">
                    <label className="sr-label">Refund Amount (₹)</label>
                    <input type="number" className="sr-input" value={approvalForm.refund_amount} onChange={(e) => setApprovalForm((p) => ({ ...p, refund_amount: e.target.value }))} />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Refund Mode</label>
                    <select className="sr-select" value={approvalForm.refund_mode} onChange={(e) => setApprovalForm((p) => ({ ...p, refund_mode: e.target.value }))}>
                      <option value="Bank">Bank</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </>
              )}
              {approvalForm.settlement_type === 'No Financial Adjustment' && (
                <div className="sr-field span-2">
                  <label className="sr-label">Mandatory Authorization Reason *</label>
                  <input type="text" className="sr-input" value={approvalForm.no_adjustment_reason} onChange={(e) => setApprovalForm((p) => ({ ...p, no_adjustment_reason: e.target.value }))} />
                </div>
              )}
              <div className="sr-field span-2">
                <label className="sr-label">Approval & QC Remarks</label>
                <textarea className="sr-textarea" value={approvalForm.approval_remarks} onChange={(e) => setApprovalForm((p) => ({ ...p, approval_remarks: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setApproveModalOpen(false)} style={{ padding: '7px 14px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={loading} onClick={handleSubmitApproval} style={{ padding: '7px 16px', borderRadius: '5px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {loading ? 'Processing...' : 'Confirm & Post Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReturnCreate;
