import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EntryTopFrame from './entry/EntryTopFrame';
import EntryItemsTable from './entry/EntryItemsTable';
import api from '../utils/api';
import './PurchaseCreationPage.css';
import { safeArray } from './entry/safeArray';
import { getMasters } from '../services/api';

const PurchaseCreationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // S.No must be consumed only on SAVE (do not pre-fetch on page open)
    s_no: '',
    supplier: '',
    address: '',
    date: new Date().toISOString().slice(0, 10),
    inv_no: '',
    inv_date: '',
    godown: '',
    pay_type: 'Credit',
    tax_type: 'Exclusive',
    tax_rate: 5,
    gst_no: '',
    email: '',
    type: 'Urad',
    remarks: ''
  });

  const [tableData, setTableData] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debug: watch raw table rows as user selects Qty/Weight
  useEffect(() => {
    console.log('TABLE DATA', JSON.stringify(tableData, null, 2));
  }, [tableData]);

  useEffect(() => {
    const loadDeductions = async () => {
      try {
        const res = await getMasters('deduction_purchase');
        setDeductions(safeArray(res?.data || res));
      } catch (err) {
        console.error('Deduction load failed', err);
      }
    };

    const fetchPurchase = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const result = await api(`/purchases/${id}`);
        if (!result) return;

        setFormData({
          s_no: String(result.s_no),
          supplier: result.supplier,
          address: result.address,
          date: result.date,
          inv_no: result.inv_no,
          inv_date: result.inv_date || '',
          godown: result.godown,
          pay_type: result.pay_type,
          tax_type: result.tax_type,
          tax_rate:
            result.tax_amount > 0 && result.base_amount > 0
              ? ((result.tax_amount / result.base_amount) * 100).toFixed(0)
              : 5,
          gst_no: result.gst_no || '',
          email: result.email || '',
          type: result.type || 'Urad',
          remarks: result.remarks || ''
        });

        setTableData(
          safeArray(result.items).map(it => ({
            ...it,
            item_name: it.item_name,
            weight: it.weight,
            total_wt: it.total_wt,
            item_id: it.item_id || it.item_name,
            type: it.type,
            calculation_type: it.calculation_type,
            percentage: it.percentage
          }))
        );
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDeductions();
    fetchPurchase();
  }, [id]);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 's_no') return;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleTableChange = useCallback((index, field, value) => {
    setTableData(prev => {
      return prev.map((row, i) => {
        if (i !== index) return row;
        if (field === '__batch__') return { ...row, ...value };
        return { ...row, [field]: value };
      });
    });
  }, []);

  const addRow = () => setTableData(prev => [...prev, {}]);
  const deleteRow = (index) => setTableData(prev => prev.filter((_, i) => i !== index));

  const erpTotals = useMemo(() => {
    let totalQty = 0;
    let totalWeight = 0;
    let baseAmount = 0;
    let discountAmount = 0;
    let totalDeductionsAggregated = 0;

    tableData.forEach(row => {
      const qty = parseFloat(row.qty) || 0;
      const rate = parseFloat(row.rate) || 0;
      const discPerc = parseFloat(row.disc) || 0;

      totalQty += qty;
      totalWeight += parseFloat(row.total_wt || row.total_weight) || 0;

      const rowBase = qty * rate;
      baseAmount += rowBase;
      discountAmount += (rowBase * discPerc) / 100;
    });

    const taxable = baseAmount - discountAmount;
    const taxRate = parseFloat(formData.tax_rate) || 0;

    // IMPORTANT: honor tax type selection.
    // - Exclusive/Inclusive: calculate tax normally.
    // - Without Tax: force tax = 0 and net = taxable.
    const taxAmount = formData.tax_type === 'Without Tax'
      ? 0
      : (taxable * taxRate) / 100;

    const netAmount = formData.tax_type === 'Without Tax'
      ? taxable
      : taxable + taxAmount;


    selectedDeductions.forEach(d => {
      const amt = parseFloat(d.amount) || 0;
      if (d.type === 'ADD') totalDeductionsAggregated += amt;
      else if (d.type === 'LESS') totalDeductionsAggregated -= amt;
    });

    const grandTotal = netAmount + totalDeductionsAggregated;

    return {
      totalQty,
      totalWeight,
      totalDeductionsAggregated,
      baseAmount,
      discountAmount,
      taxable,
      taxAmount,
      netAmount,
      totalDeductions: totalDeductionsAggregated,
      grandTotal
    };
  }, [tableData, formData.tax_type, formData.tax_rate, selectedDeductions]);

  const formatNumber = (num) => Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validRows = tableData.filter(row => {
      const qty = parseFloat(row.qty);
      return Number.isFinite(qty) && qty > 0;
    });

    const transformedItems = validRows
      .map(row => ({
        item_id: row.item_id || row.item_name,
        item_name: row.item_name || '',
        lotNo: row.lot_no || '',
        qty: parseFloat(row.qty) || 0,
        per_unit_weight: parseFloat(row.per_unit_weight || row.per_unit_wt || 0),
        total_weight: parseFloat(row.total_weight || row.total_wt || 0),
        tax_percent: parseFloat(row.tax_rate) || parseFloat(formData.tax_rate) || 0,
        tax_amount:
          (((parseFloat(row.qty) * parseFloat(row.rate) -
            (parseFloat(row.qty) * parseFloat(row.rate) * (parseFloat(row.disc) || 0)) / 100) *
            (parseFloat(row.tax_rate) || parseFloat(formData.tax_rate) || 0)) /
            100) || 0,
        amount:
          (parseFloat(row.qty) * parseFloat(row.rate)) -
          (parseFloat(row.qty) * parseFloat(row.rate) * (parseFloat(row.disc) || 0)) / 100 || 0
      }))
      .filter(item => item.item_name && item.qty > 0);

    let snoToSave = parseInt(formData.s_no, 10) || 1;
    if (!id) {
      const snoRes = await api('/purchases/next-sno');
      if (snoRes?.success && snoRes?.data?.s_no) snoToSave = parseInt(snoRes.data.s_no, 10);
    }

    const payload = {
      formData: { ...formData, sno: snoToSave },
      items: transformedItems,
      totals: {
        totalQty: erpTotals.totalQty,
        totalWeight: erpTotals.totalWeight,
        totalAmount: erpTotals.taxable,
        deductionAmount: erpTotals.totalDeductionsAggregated,
        baseAmount: erpTotals.baseAmount,
        discAmount: erpTotals.discountAmount,
        taxAmount: erpTotals.taxAmount,
        netAmount: erpTotals.netAmount,
        grandTotal: erpTotals.grandTotal,
        deductions: { autoWages: 0, vatPercent: 0, vat: 0 }
      },
      deductions: selectedDeductions.map(d => ({
        deduction_id: d.id,
        deduction_name: d.name,
        type: d.type,
        calculation_type: d.calculation_type,
        percentage: d.percentage,
        amount: d.amount
      }))
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/purchases/${id}` : '/purchases';
      const result = await api(url, { method, body: payload });

      if (result?.success) {
        alert(`Purchase ${id ? 'updated' : 'saved'} successfully!`);
        if (id) navigate('/purchase-list');

        setFormData(prev => ({
          ...prev,
          supplier: '',
          address: '',
          gst_no: '',
          email: '',
          date: new Date().toISOString().slice(0, 10),
          inv_no: '',
          inv_date: '',
          godown: '',
          pay_type: 'Credit',
          tax_type: 'Exclusive',
          tax_rate: 5
        }));
        setTableData([]);
      } else {
        alert('Save failed: ' + (result?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Save failed: ' + error?.message);
    }
  };

  const handleDeductionAdd = (dedIdOrEvent) => {
    const dedId = dedIdOrEvent?.target ? dedIdOrEvent.target.value : dedIdOrEvent;
    const master = deductions.find(d => String(d.id) === String(dedId));
    if (!master) return;

    const baseTaxable = erpTotals.taxable;
    const amt = master.calc_type === 'Percent'
      ? (baseTaxable * (parseFloat(master.deduction_value) || 0)) / 100
      : parseFloat(master.deduction_value) || 0;

    setSelectedDeductions(prev => [
      ...prev,
      {
        id: master.id,
        name: master.ded_name || master.name || master.deduction_name || 'Unnamed',
        amount: amt,
        type: master.type,
        calculation_type: master.calculation_type,
        percentage: master.calculation_type === 'Percentage' ? parseFloat(master.deduction_value) : 0,
        remarks: ''
      }
    ]);

    if (dedIdOrEvent?.target) dedIdOrEvent.target.value = '';
  };

  const topFields = [
    { name: 'supplier', label: 'Supplier', type: 'masterSelect', masterType: 'suppliers' },
    { name: 'address', label: 'Address', type: 'text' },
    { name: 'godown', label: 'Godown', type: 'masterSelect', masterType: 'godowns' },
    {
      name: 'tax_type',
      label: 'Tax Type',
      type: 'select',
      options: [
        { value: 'Exclusive', label: 'Exclusive' },
        { value: 'Inclusive', label: 'Inclusive' },
        { value: 'Without Tax', label: 'Without Tax' }
      ]
    },
    { name: 'remarks', label: 'Remarks', type: 'text' },
    { name: 'inv_no', label: 'Inv No', type: 'text' },
    { name: 'inv_date', label: 'Inv Date', type: 'date' },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'Urad', label: 'Urad' },
        { value: 'Rice', label: 'Rice' },
        { value: 'Flour', label: 'Flour' },
        { value: 'Other', label: 'Other' }
      ]
    },
    { name: 'tax_rate', label: 'Tax %', type: 'number' }
  ];

  const columns = [
    { key: 's_no', title: 'S.No', readOnly: true },
    { key: 'item_name', title: 'Item', type: 'masterSelect', masterType: 'items' },
    { key: 'lot_no', title: 'Lot No' },
    { key: 'qty', title: 'Qty', type: 'number' },
    { key: 'weight', title: 'Per Unit Wt', type: 'masterSelect', masterType: 'weights' },
    { key: 'total_wt', title: 'number' },
    { key: 'disc', title: 'Disc%', type: 'number' },
    { key: 'tax', title: 'TaxadOnly: true' }
  ];

  return (
    <div className="purchase-page">
      <div className="screen-title">Purchase Creation</div>

      <form onSubmit={handleSubmit}>
        <EntryTopFrame fields={topFields} data={formData} onChange={handleFormChange} columns={2} />

        <EntryItemsTable
          columns={columns}
          data={tableData}
          onRowChange={handleTableChange}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          lotMode="auto"
          editable={true}
          showActions={true}
          sectionTitle="Items"
          taxType={formData.tax_type}
          taxRate={formData.tax_rate}
        />

        <div className="table-footer">
          <div className="footer-line"></div>
          <div className="footer-totals">
            Total Qty: <span>{formatNumber(erpTotals.totalQty)}</span> | Total Weight:{' '}
            <span>{formatNumber(erpTotals.totalWeight)} KG</span>
          </div>
          <div className="footer-line"></div>
        </div>

        <div className="layout-row">
          <div className="summary-box">
            <div className="summary-row">Base Amount: ₹{formatNumber(erpTotals.baseAmount)}</div>
            <div className="summary-row">Discount: ₹{formatNumber(erpTotals.discountAmount)}</div>
            <div className="summary-row">Taxable: ₹{formatNumber(erpTotals.taxable)}</div>
            <div className="summary-row">Tax ({formData.tax_rate}%): ₹{formatNumber(erpTotals.taxAmount)}</div>
            <div className="summary-row net-total">Net Total: ₹{formatNumber(erpTotals.netAmount)}</div>
            <div className="summary-row" style={{ color: 'red' }}>
              Deductions: -₹{formatNumber(erpTotals.totalDeductions)}
            </div>
            <div className="summary-row grand-total" style={{ fontSize: '1.4em', borderTop: '2px solid #333' }}>
              Grand Total: ₹{formatNumber(erpTotals.grandTotal)}
            </div>
          </div>

          <div className="deductions-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Deductions</h4>
              <select
                onChange={(e) => handleDeductionAdd(e.target.value)}
                className="table-input"
                style={{ width: '200px' }}
              >
                <option value="">+ Add Deduction</option>
                {deductions.map((d, idx) => (
                  <option key={`${d.id || 'ded'}-${idx}`} value={d.id}>
                    {d.ded_name || d.name}
                  </option>
                ))}
              </select>
            </div>

            <table className="deductions-table">
              <thead>
                <tr>
                  <th>Deduction Type</th>
                  <th>Amount</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedDeductions.map((d, i) => (
                  <tr key={i}>
                    <td>{d.name}</td>
                    <td>
                      <input
                        type="number"
                        value={d.amount !== undefined && d.amount !== null ? d.amount : ''}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          updated[i].amount = e.target.value;
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={d.remarks !== undefined && d.remarks !== null ? d.remarks : ''}
                        onChange={(e) => {
                          const updated = [...selectedDeductions];
                          updated[i].remarks = e.target.value;
                          setSelectedDeductions(updated);
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedDeductions(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}

                {selectedDeductions.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#666' }}>
                      No deductions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="actions">
          <button type="button" onClick={addRow} className="add-row-btn">
            + Add Row
          </button>
          <button type="submit" className="save-btn">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseCreationPage;

