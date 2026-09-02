import { useMemo, useState } from 'react';

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const createItem = () => ({
  itemId: '',
  itemName: '',
  weightId: '',
  weight: 0,
  uom: '',
  qty: 1,
  rate: 0,
  discountPercent: 0,
  taxPercent: 0,
  amount: 0,
});

const usePurchaseOrderForm = (initialValues = {}) => {
  const [form, setForm] = useState(() => ({
    orderNo: '',
    supplier: '',
    supplierId: undefined,

    buyer: '',
    buyerId: undefined,

    warehouse: '',
    warehouseId: undefined,

    purchaseType: '',
    paymentTerms: '',
    expectedDelivery: '',
    priority: '',

    status: 'DRAFT',
    date: new Date().toISOString().slice(0, 10),

    freight: 0,
    otherCharges: 0,

    remarks: '',
    internalRemarks: '',
    supplierNotes: '',

    items: [createItem()],
    ...initialValues,
  }));

  const formWithComputedValues = useMemo(() => {
    const rawItems = Array.isArray(form.items) ? form.items : [];
    
    let grossAmount = 0;
    let discount = 0;
    let taxableAmount = 0;
    let gst = 0;

    const freight = toNum(form.freight, 0);
    const otherCharges = toNum(form.otherCharges, 0);

    const items = rawItems.map((it) => {
      const qty = toNum(it.qty, 0);
      const rate = toNum(it.rate, 0);
      const discPct = toNum(it.discountPercent, 0);
      const taxPct = toNum(it.taxPercent, 0);

      const lineGross = qty * rate;
      const lineDiscount = lineGross * (discPct / 100);
      const lineTaxable = lineGross - lineDiscount;
      const lineGst = lineTaxable * (taxPct / 100);
      const amount = lineTaxable + lineGst;

      grossAmount += lineGross;
      discount += lineDiscount;
      taxableAmount += lineTaxable;
      gst += lineGst;

      return {
        ...it,
        amount,
      };
    });

    const subtotal = taxableAmount + gst + freight + otherCharges;
    const roundOff = Math.round(subtotal) - subtotal;
    const grandTotal = subtotal + roundOff;

    const summary = {
      grossAmount,
      discount,
      taxableAmount,
      gst,
      freight,
      otherCharges,
      roundOff,
      grandTotal,
    };

    return {
      ...form,
      items,
      summary,
    };
  }, [form]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutocompleteChange = (field, newValue) => {
    if (newValue && typeof newValue === 'object' && 'id' in newValue) {
      setForm((prev) => ({
        ...prev,
        [field]: newValue.id,
        [field.replace('Id', '')]: newValue.name || ''
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: newValue }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...(prev.items || []), createItem()] }));
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return {
    form: formWithComputedValues,
    setForm,
    handleFieldChange,
    handleDateChange: (field, value) => handleFieldChange(field, value),
    handleAutocompleteChange,
    addItem,
    updateItem,
    removeItem,
    masterData: {},
  };
};

export default usePurchaseOrderForm;

