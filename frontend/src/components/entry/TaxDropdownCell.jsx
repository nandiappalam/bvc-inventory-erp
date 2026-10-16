import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';

// Standard fallback rates if API is unavailable or loading
const STANDARD_TAX_RATES = [
  { rate: 5, label: '5% (CGST 2.5% + SGST 2.5%)', cgst: 2.5, sgst: 2.5, igst: 5, type: 'Taxable' },
  { rate: 6, label: '6% (CGST 3% + SGST 3%)', cgst: 3, sgst: 3, igst: 6, type: 'Taxable' },
  { rate: 9, label: '9% (CGST 4.5% + SGST 4.5%)', cgst: 4.5, sgst: 4.5, igst: 9, type: 'Taxable' },
  { rate: 12, label: '12% (CGST 6% + SGST 6%)', cgst: 6, sgst: 6, igst: 12, type: 'Taxable' },
  { rate: 18, label: '18% (CGST 9% + SGST 9%)', cgst: 9, sgst: 9, igst: 18, type: 'Taxable' },
  { rate: 28, label: '28% (CGST 14% + SGST 14%)', cgst: 14, sgst: 14, igst: 28, type: 'Taxable' }
];
const ZERO_RATE_CLASSIFICATIONS = ['Exempt', 'Nil Rated', 'Zero Rated', 'Non-GST'];
const taxOptionValue = (type, rate) => `${type}|${rate}`;
const normalizeTaxType = (value, rate = 0) => {
  const type = String(value || '').trim().toLowerCase();
  if (type.includes('exempt')) return 'Exempt';
  if (type.includes('nil')) return 'Nil Rated';
  if (type.includes('zero')) return 'Zero Rated';
  if (type.includes('non-gst') || type.includes('nongst')) return 'Non-GST';
  if (type.includes('taxable')) return 'Taxable';
  return Number(rate) === 0 ? 'Nil Rated' : 'Taxable';
};

let cachedTaxMaster = null;

/**
 * TaxDropdownCell - Tax Master Dropdown for table rows
 * Populates tax rates from the Tax Master and displays CGST/SGST split
 */
export const TaxDropdownCell = ({
  value,
  onChange,
  rowIndex,
  row = {},
  cellKey = 'tax',
  readOnly = false,
  isInterState = false,
  style = {}
}) => {
  const [taxMasterList, setTaxMasterList] = useState(cachedTaxMaster || []);
  const [loading, setLoading] = useState(!cachedTaxMaster);

  useEffect(() => {
    let isMounted = true;
    const fetchTaxes = async () => {
      if (cachedTaxMaster && cachedTaxMaster.length > 0) {
        setTaxMasterList(cachedTaxMaster);
        setLoading(false);
        return;
      }

      try {
        let records = [];
        // Try /tax-master first
        const res = await api('/tax-master').catch(() => null);
        if (res && res.success && Array.isArray(res.data)) {
          records = res.data;
        } else {
          // Fallback to /masters/tax
          const res2 = await api('/masters/tax').catch(() => null);
          const data2 = Array.isArray(res2) ? res2 : (res2?.data || []);
          if (data2.length > 0) records = data2;
        }

        if (isMounted) {
          if (records.length > 0) {
            cachedTaxMaster = records;
            setTaxMasterList(records);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Tax Master:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchTaxes();
    return () => { isMounted = false; };
  }, []);

  // Parse current numeric value
  const numericValue = (() => {
    if (value === null || value === undefined || value === '') {
      // Check row for alternative keys
      const alt = row.tax_rate ?? row.tax ?? row.tax_percent ?? row.tax_perc;
      if (alt !== null && alt !== undefined && alt !== '') {
        const parsedAlt = parseFloat(alt);
        return isNaN(parsedAlt) ? 0 : parsedAlt;
      }
      return '';
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? '' : parsed;
  })();
  const selectedTaxType = normalizeTaxType(row.tax_type, numericValue);
  const selectedOptionValue = numericValue === ''
    ? ''
    : taxOptionValue(selectedTaxType, numericValue);

  const handleChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onChange(0, null);
      return;
    }

    const [selectedClassification, rawRate] = rawVal.split('|');
    const selectedRate = parseFloat(rawRate);
    // Find matching record from taxMasterList if available
    const matchedMaster = taxMasterList.find(t => 
      parseFloat(t.gst_rate ?? t.tax_rate ?? t.tax_percent) === selectedRate &&
      normalizeTaxType(t.tax_type, selectedRate) === selectedClassification
    );

    const taxType = normalizeTaxType(selectedClassification || matchedMaster?.tax_type, selectedRate);
    onChange(isNaN(selectedRate) ? 0 : selectedRate, {
      ...matchedMaster,
      gst_rate: selectedRate,
      tax_type: taxType
    });
  };

  // Build options list
  // 1. Group standard GST rates
  // 2. Also list master items
  const standardRatesSet = new Set(STANDARD_TAX_RATES.map(s => s.rate));

  // Additional rates from master that aren't in standard
  const customMasterRates = taxMasterList.filter(t => {
    const r = parseFloat(t.gst_rate ?? t.tax_rate ?? t.tax_percent);
    return !isNaN(r) && !standardRatesSet.has(r);
  });
  const selectedRateIsAvailable = numericValue === '' ||
    Number(numericValue) === 0 ||
    STANDARD_TAX_RATES.some(rate =>
      rate.rate === Number(numericValue) && rate.type === selectedTaxType
    ) ||
    taxMasterList.some(t =>
      Number(t.gst_rate ?? t.tax_rate ?? t.tax_percent) === Number(numericValue) &&
      normalizeTaxType(t.tax_type || t.tax_name, numericValue) === selectedTaxType
    );

  return (
    <select
      value={selectedOptionValue}
      onChange={handleChange}
      disabled={readOnly}
      style={{
        width: '100%',
        minWidth: '120px',
        height: '28px',
        padding: '2px 6px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#1e3a8a',
        backgroundColor: readOnly ? '#f3f4f6' : '#ffffff',
        border: '1px solid #93c5fd',
        borderRadius: '4px',
        cursor: readOnly ? 'default' : 'pointer',
        outline: 'none',
        ...style
      }}
      title="Select Tax Rate from Tax Master"
    >
      <option value="">-- Tax Rate --</option>
      {!selectedRateIsAvailable && (
        <option value={selectedOptionValue}>
          {numericValue}% ({selectedTaxType})
        </option>
      )}

      <optgroup label="Standard GST Rates">
        {STANDARD_TAX_RATES.map((st) => {
          const splitLabel = isInterState
            ? `${st.rate}% (IGST ${st.igst}%)`
            : `${st.rate}% (CGST ${st.cgst}% + SGST ${st.sgst}%)`;
          return (
            <option key={`std-${st.rate}`} value={taxOptionValue(st.type, st.rate)}>
              {splitLabel}
            </option>
          );
        })}
      </optgroup>

      <optgroup label="Zero-Rated Tax Classifications">
        {ZERO_RATE_CLASSIFICATIONS.map(type => {
          const master = taxMasterList.find(t =>
            Number(t.gst_rate ?? t.tax_rate ?? t.tax_percent) === 0 && normalizeTaxType(t.tax_type, 0) === type
          );
          return (
            <option key={`zero-${type}`} value={taxOptionValue(type, 0)}>
              {master?.tax_name || `0% (${type})`}
            </option>
          );
        })}
      </optgroup>

      {customMasterRates.length > 0 && (
        <optgroup label="Custom Tax Master Rates">
          {customMasterRates.map((cm, idx) => {
            const r = parseFloat(cm.gst_rate ?? cm.tax_rate ?? cm.tax_percent);
            const cgst = r / 2;
            const splitLabel = isInterState
              ? `${r}% (IGST ${r}%)`
              : `${r}% (CGST ${cgst}% + SGST ${cgst}%)`;
            return (
              <option key={`custom-${idx}`} value={taxOptionValue(normalizeTaxType(cm.tax_type || cm.tax_name, r), r)}>
                {cm.tax_name ? `${cm.tax_name} - ${splitLabel}` : splitLabel}
              </option>
            );
          })}
        </optgroup>
      )}

      {taxMasterList.length > 0 && (
        <optgroup label="Tax Master Commodities">
          {taxMasterList.slice(0, 15).map((tm, idx) => {
            const r = parseFloat(tm.gst_rate ?? tm.tax_rate ?? tm.tax_percent ?? 0);
            const cgst = (tm.cgst_rate !== undefined && tm.cgst_rate !== null) ? tm.cgst_rate : (r / 2);
            const sgst = (tm.sgst_rate !== undefined && tm.sgst_rate !== null) ? tm.sgst_rate : (r / 2);
            return (
              <option key={`commodity-${tm.id || idx}`} value={taxOptionValue(normalizeTaxType(tm.tax_type || tm.tax_name, r), r)}>
                {tm.tax_name} ({r}%: {cgst}%+{sgst}%)
              </option>
            );
          })}
        </optgroup>
      )}
    </select>
  );
};

export default TaxDropdownCell;
