import React, { useState, useEffect, useCallback } from 'react';

import { validateEntryConfig } from '../../utils/validateEntryPage';

import { api, getMasters } from '../../services/api.js';
import { safeArray, normalizeMasterKey, getCachedMasters } from '../../services/masterservice.js';
import { DEBUG } from '../../config/debug';
import ItemDropdownCell from './ItemDropdownCell.jsx';
import ExistingLotDropdownCell from './ExistingLotDropdownCell.jsx';
import TaxDropdownCell from './TaxDropdownCell.jsx';
import { InlineMasterModal, getCreateLabel } from '../common/InlineMasterModal.jsx';
import { calculateLineTax } from '../../services/taxService.js';

const safeNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};


const MasterSelectCell = ({
  value,
  valueId,
  masterType,
  onChange,
  rowIndex,
  row,
  cellKey,
  documentLotNo,
  onDocumentLotSet,
  lotMode,
  taxRate,
  data,
}) => {
  const normKey = normalizeMasterKey(masterType || cellKey);
  const [options, setOptions] = useState(() => {
    const table = (normKey || '').replace('_master', '');
    const cached = getCachedMasters(table || normKey);
    return cached && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(false);
  const [inlineModalOpen, setInlineModalOpen] = useState(false);

  useEffect(() => {
    const key = normalizeMasterKey(masterType || cellKey);
    if (!key) {
      return;
    }

    const fetchOptions = async () => {
      setLoading(true);

      try {
        const table = key.replace('_master', '');
        const result = await getMasters(table);

        const data = safeArray(result?.data || result);
        if (data && data.length > 0) {
          setOptions(data);
        } else if (options.length === 0) {
          setOptions(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [masterType, cellKey]);

  const safeOptions = Array.isArray(options) ? options : [];

  const handleInlineCreated = async (newId, newRecord) => {
    try {
      const key = normalizeMasterKey(masterType || cellKey);
      const table = key.replace('_master', '');
      const result = await getMasters(table, { forceRefresh: true });
      const refreshedData = safeArray(result?.data || result);
      setOptions(refreshedData);

      const targetId = newId !== undefined && newId !== null ? String(newId) : (newRecord?.id ? String(newRecord.id) : '');
      if (targetId) {
        await handleChange({ target: { value: targetId } }, newRecord);
      }
    } catch (e) {
      console.error('Error post-creating master inline:', e);
    }
  };

  const handleChange = async (e, directRecord = null) => {
    const selectedId = e.target.value;
    if (selectedId === '__CREATE_NEW__') {
      setInlineModalOpen(true);
      return;
    }

    const selectedItem = directRecord || safeOptions.find(
      (opt) => String(opt.id) === String(selectedId)
    );

    const selectedItemId = selectedItem?.id || selectedId;
    const selectedName =
      selectedItem?.item_name ||
      selectedItem?.name ||
      selectedItem?.printname ||
      selectedItem?.print_name ||
      '';

    const isItemSelection = cellKey === 'item_name' && masterType === 'items';

    // Non-item cells: simple update, except weight master needs to write numeric weight too.
    if (!isItemSelection) {
      // Weight masterSelect binding fix
      if (masterType === 'weights' && cellKey === 'weight') {
        console.log('[WEIGHT SELECT]', {
          rowIndex,
          cellKey,
          masterType,
          selectedId,
          rowSnapshot: row,
        });

        // TEMP DEBUG (required)
        console.log('SELECTED WEIGHT ITEM FULL', selectedItem);

        const getNumericWeight = (item) => {
          if (!item) return 0;

          const directFields = [
            'kg',
            'weight_kg',
            'weight_val',
            'per_unit_wt',
            'perUnitWt',
            'weight_value',
            'weight',
            'wt',
            'value',
            'unit_kg',
            'qty_kg',
            'numeric',
            'amount',
          ];

          for (const field of directFields) {
            const val = item?.[field];
            if (val === null || val === undefined || val === '') continue;
            const num = parseFloat(val);
            if (!Number.isNaN(num) && num > 0) return num;
          }

          const textFields = [
            'name',
            'weight_name',
            'item_name',
            'weight_label',
            'label',
            'printname',
            'item_label',
          ];

          for (const field of textFields) {
            const text = item?.[field];
            if (!text) continue;
            const numericWt = parseFloat(
              String(text).replace(/[^\d.]/g, '')
            );
            if (!Number.isNaN(numericWt) && numericWt > 0) return numericWt;
          }

          // Last-chance: if master returned a primitive
          if (typeof item === 'string' || typeof item === 'number') {
            const numericWt = parseFloat(
              String(item).replace(/[^\d.]/g, '')
            );
            return Number.isNaN(numericWt) ? 0 : numericWt;
          }

          return 0;
        };

        const numericWt = getNumericWeight(selectedItem);

        // TEMP DEBUG (required)
        console.log('NUMERIC WEIGHT RESOLVED', numericWt);

        const weightId = selectedItem?.id ?? selectedId;


        const qty = safeNumber(row?.qty || 0);
        const wt = safeNumber(numericWt);

        // IMPORTANT: also write total fields immediately so parent totals + Total Wt column update.
        // (Qty may be stored as string, but safeNumber normalizes it.)
        const totalW = qty * wt;

        onChange(rowIndex, '__batch__', {
          ...row,
          weight_id: weightId,
          weight: wt,
          per_unit_wt: wt,
          tot_wt: totalW > 0 ? totalW.toFixed(2) : (row.tot_wt || ''),
          total_wt: totalW,
          total_weight: totalW,
        });
        return;
      }

      onChange(rowIndex, cellKey, selectedId);
      return;
    }


    // Only generate on NEW item selection (not same item re-select)
    if (row?.item_id && String(row.item_id) === String(selectedItemId)) return;

    // Must have a selected item id
    if (!selectedItemId) return;

    const itemTax = selectedItem?.tax !== undefined && selectedItem?.tax !== null && selectedItem?.tax !== '' ? parseFloat(selectedItem.tax) : (selectedItem?.gst_rate !== undefined ? parseFloat(selectedItem.gst_rate) : null);
    const resolvedTaxRate = itemTax !== null && !isNaN(itemTax) ? itemTax : (taxRate !== undefined ? taxRate : 5);
    const resolvedHsn = selectedItem?.hsn_code || row?.hsn_code || '';
    const resolvedTaxType = selectedItem?.tax_type || row?.tax_type || 'Taxable';

    // If lotMode is 'select', reset lots and do not assign a preview lot automatically
    if (lotMode === 'select') {
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: selectedName,
        item_label: selectedName,
        lot_no: '',
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
        available_lots_loaded: false,
        available_lots: [],
        weight: '',
        per_unit_wt: '',
        qty: '',
        total_wt: '',
        total_weight: '',
        amount: ''
      });
      return;
    }

    // Business rule:
    // - Do NOT consume lot sequence here.
    // - Provide preview lot numbers that are unique across rows BEFORE Save.
    // Approach: preview first lot from server, then allocate sequentially locally per row selection.

    // If already assigned, keep it.
    if (row?.lot_no) {
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: selectedName,
        item_label: selectedName,
        lot_no: row?.lot_no,
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
      return;
    }

    // Determine next preview lot for this row without consuming backend sequence.
    const isWastageLot = lotMode === 'auto-wastage' || lotMode === 'wastage';
    let startLot = '';

    if (isWastageLot) {
      try {
        const previewRes = await api('/lots/preview-wastage', { method: 'GET' });
        startLot = previewRes?.lot_no || previewRes?.data?.lot_no || '';
      } catch (err) {
        console.error('Failed to get wastage lot preview start:', err);
      }
    } else {
      try {
        const previewRes = await api('/lots/preview', { method: 'GET' });
        startLot = previewRes?.lot_no || previewRes?.data?.lot_no || '';
      } catch (err) {
        console.error('Failed to get lot preview start:', err);
      }
    }

    const computeNextLot = (startLotNo, offset) => {
      if (isWastageLot) {
        const match = String(startLotNo || '').match(/WST(\d+)/i);
        const start = match ? parseInt(match[1], 10) : 1;
        const next = start + offset;
        return `WST${String(next).padStart(4, '0')}`;
      } else {
        const match = String(startLotNo || '').match(/LOT(\d+)/i);
        const start = match ? parseInt(match[1], 10) : 1;
        const next = start + offset;
        return `LOT${String(next).padStart(4, '0')}`;
      }
    };

    // Find all lot numbers currently occupied in other rows of the form
    const activeLots = new Set(
      (data || [])
        .map((r, idx) => idx !== rowIndex ? String(r.lot_no || '').toUpperCase().trim() : '')
        .filter(Boolean)
    );

    // Find the smallest non-overlapping lot sequence
    let lotNo = '';
    let offset = 0;
    try {
      let found = false;
      while (!found) {
        const candidate = computeNextLot(startLot, offset);
        if (!activeLots.has(candidate)) {
          lotNo = candidate;
          found = true;
        } else {
          offset += 1;
        }
      }

      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: selectedName,
        item_label: selectedName,
        lot_no: lotNo,
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
    } catch (err) {
      console.error('Lot preview failed:', err);
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: selectedName,
        item_label: selectedName,
        lot_no: '',
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
    }
  };

  let selectValue = valueId ? String(valueId) : '';
  const cellVal = value || row?.[cellKey] || row?.description || row?.item_name || '';

  if (selectValue && safeOptions.length > 0) {
    const isValidId = safeOptions.some(opt => String(opt.id) === selectValue);
    if (!isValidId) {
      const found = safeOptions.find(opt => 
        String(opt.item_name || opt.name || opt.printname || opt.print_name || opt.weight_name || '').toLowerCase() === String(selectValue).toLowerCase()
      );
      if (found) {
        selectValue = String(found.id);
      } else if (masterType === 'weights' || cellKey === 'weight') {
        const numVal = parseFloat(String(selectValue).replace(/[^\d.]/g, ''));
        if (!isNaN(numVal) && numVal > 0) {
          const matchNum = safeOptions.find(opt => {
            const optNum = parseFloat(String(opt.name || opt.weight || opt.print_name || opt.printname || '').replace(/[^\d.]/g, ''));
            return !isNaN(optNum) && Math.abs(optNum - numVal) < 0.001;
          });
          if (matchNum) {
            selectValue = String(matchNum.id);
          } else {
            selectValue = '';
          }
        } else {
          selectValue = '';
        }
      } else {
        selectValue = '';
      }
    }
  }

  if (!selectValue && cellVal && safeOptions.length > 0) {
    let found = safeOptions.find(opt => 
      String(opt.item_name || opt.name || opt.printname || opt.print_name || opt.weight_name || '').toLowerCase() === String(cellVal).toLowerCase()
    );
    if (!found && (masterType === 'weights' || cellKey === 'weight')) {
      const numCell = parseFloat(String(cellVal).replace(/[^\d.]/g, ''));
      if (!isNaN(numCell) && numCell > 0) {
        found = safeOptions.find(opt => {
          const optNum = parseFloat(String(opt.name || opt.item_name || opt.weight_name || opt.kg || opt.weight || opt.value || '').replace(/[^\d.]/g, ''));
          return !isNaN(optNum) && Math.abs(optNum - numCell) < 0.001;
        });
      }
    }
    if (found) {
      selectValue = String(found.id);
    }
  }

  return (
    <>
      <select
        value={selectValue}
        onChange={handleChange}
        disabled={row?.readOnly || false}
        style={styles.cellInput}
        className="table-input"
      >
        <option value="">
          -- Select --
        </option>

        {safeOptions.map((opt, idx) => {
          const optVal = opt.id !== undefined && opt.id !== null ? String(opt.id) : (opt.value !== undefined ? String(opt.value) : String(opt.name || opt));
          const optLabel = opt.item_name || opt.name || opt.printname || opt.print_name || opt.weight_name || opt.label || String(optVal);
          return (
            <option key={`${optVal || 'opt'}-${idx}`} value={optVal}>
              {optLabel}
            </option>
          );
        })}

        <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
          {getCreateLabel(normKey || masterType || cellKey)}
        </option>
      </select>

      <InlineMasterModal
        open={inlineModalOpen}
        onClose={() => setInlineModalOpen(false)}
        masterType={normKey || masterType || cellKey}
        onSuccess={handleInlineCreated}
      />
    </>
  );
};

const EntryItemsTable = ({
  columns = [],
  data,
  items,
  onRowChange,
  onItemChange,
  onAddRow,
  onAddItem,
  onDeleteRow,
  onRemoveItem,
  showActions = true,
  sectionTitle = '',
  editable = true,
  lotMode = 'select',
  taxType = 'Exclusive',
  taxRate = 18,
  isInterState = false,
}) => {
  // Support both 'data' and 'items' seamlessly
  const activeData = (Array.isArray(items) && items.length > 0)
    ? items
    : (Array.isArray(data) && data.length > 0
        ? data
        : (Array.isArray(items) ? items : (Array.isArray(data) ? data : [])));

  const activeRowChange = onRowChange || onItemChange || (() => {});
  const activeAddRow = onAddRow || onAddItem || (() => {});
  const activeDeleteRow = onDeleteRow || onRemoveItem || (() => {});

  const [weights, setWeights] = useState([]);

  useEffect(() => {
    const loadWeights = async () => {
      try {
        const result = await getMasters('weights');
        const loaded = safeArray(result?.data || result);
        setWeights(Array.isArray(loaded) ? loaded : []);
      } catch (err) {
        console.error('Failed to load weights master:', err);
        setWeights([]);
      }
    };
    loadWeights();
  }, []);

  useEffect(() => {
    if (lotMode !== 'select') return;
    activeData.forEach((row, rowIndex) => {
      const queryKey = row.item_id || row.item_name;
      if (queryKey && !row.available_lots_loaded) {
        (async () => {
          try {
            const lots = await api(`/stock/available/${encodeURIComponent(queryKey)}`);
            const availableLots = safeArray(lots.data || lots).filter(
              l => (l.balance_qty || l.remaining_quantity || l.available_qty || l.qty || 0) > 0
            );

            const batchUpdates = {
              available_lots: availableLots,
              available_lots_loaded: true
            };

            // If only 1 lot available and no lot selected yet, and row.qty is empty, auto select it and fill details!
            const currentQty = safeNumber(row?.qty);
            if (availableLots.length === 1 && !row.lot_no && currentQty === 0) {
              const singleLot = availableLots[0];
              const qty = singleLot.available_qty || singleLot.balance_qty || singleLot.remaining_quantity || 0;
              const weight = singleLot.per_unit_weight || singleLot.weight || 0;
              const rate = singleLot.rate || 0;
              const totalWt = qty * weight;
              const base = qty * rate;
              const rowTaxRate = row.tax_rate !== undefined ? safeNumber(row.tax_rate) : (taxRate !== undefined ? taxRate : 5);
              const taxAmt = (base * rowTaxRate) / 100;

              batchUpdates.lot_no = singleLot.lot_no;
              batchUpdates.qty = qty;
              batchUpdates.weight = weight;
              batchUpdates.per_unit_wt = weight;
              batchUpdates.total_wt = totalWt;
              batchUpdates.total_weight = totalWt;
              batchUpdates.rate = rate;
              batchUpdates.base_amount = base;
              batchUpdates.tax_amount = taxAmt;
              batchUpdates.amount = base + taxAmt;
            }

            activeRowChange(rowIndex, '__batch__', batchUpdates);
          } catch (err) {
            console.error(`LOT LOAD ERROR for ${row.item_name}`, err);
            activeRowChange(rowIndex, '__batch__', {
              available_lots: [],
              available_lots_loaded: true
            });
          }
        })();
      }
    });
  }, [activeData, activeRowChange, lotMode, taxRate]);

  useEffect(() => {
    // Reset preview lot cursors on mount to ensure unused lot numbers are not skipped/wasted
    MasterSelectCell._previewStart = null;
    MasterSelectCell._previewCursor = null;

    if (activeData.length === 0) {
      handleAddRow();
    }
  }, []);

  const normalizeColumns = (cols) =>
    (cols || []).map(col => {
      const k = col.key?.toLowerCase() || '';
      const isWeight = k === 'weight' || k === 'weight_id' || k === 'wt' || col.masterType === 'weights';
      const isItem = k === 'item_name' || k === 'description' || col.masterType === 'items';
      const isGodown = k === 'godown' || k === 'godown_id' || col.masterType === 'godowns';
      const isTax = k === 'tax' || k === 'tax_rate' || k === 'tax_perc' || k === 'tax_percent' || col.masterType === 'taxes' || col.masterType === 'tax' || col.type === 'taxSelect';
      const isMaster = col.type === 'masterSelect' || col.masterType || isWeight || isItem || isGodown;
      return {
        ...col,
        type: isTax ? 'taxSelect' : (isMaster ? 'masterSelect' : col.type),
        masterType: col.masterType || (isWeight ? 'weights' : isItem ? 'items' : isGodown ? 'godowns' : isTax ? 'taxes' : undefined)
      };
    });

  const cleanedColumns = normalizeColumns(columns);
  validateEntryConfig([], cleanedColumns);

  const handleAddRow = () => {
    const newRow = {
      sno: (Array.isArray(activeData) ? activeData.length : 0) + 1,
      s_no: (Array.isArray(activeData) ? activeData.length : 0) + 1,
      no: (Array.isArray(activeData) ? activeData.length : 0) + 1,
      item_id: '',
      item_name: '',
      item_label: '',
      lot_no: '',
      qty: '',
      weight: '',
      rate: '',
      disc: '',
      tax_rate: (taxType === 'Without Tax' ? 0 : (taxRate || 5)),
      total_weight: '',
      total_wt: '',
      amount: '',
      papad_kg: '',
      cost: '',
      wages_bag: '',
      wages_per_bag: '',
      wages: ''
    };
    if (typeof onAddRow === 'function') {
      onAddRow(newRow);
    } else if (typeof onAddItem === 'function') {
      onAddItem(newRow);
    } else if (typeof activeAddRow === 'function') {
      activeAddRow(newRow);
    }
  };

  const handleDeleteRow = (rowIndex) => {
    if (typeof onDeleteRow === 'function') {
      onDeleteRow(rowIndex);
    } else if (typeof onRemoveItem === 'function') {
      onRemoveItem(rowIndex);
    } else if (typeof activeDeleteRow === 'function') {
      activeDeleteRow(rowIndex);
    }
  };

  const handleCellChange = useCallback(
    (rowIndex, key, value) => {
      let updates = key === '__batch__' ? { ...value } : { [key]: value };

      if (key === 'rate') {
        updates.rate = value;
        updates.purc_rate = value;
      } else if (key === 'purc_rate') {
        updates.rate = value;
        updates.purc_rate = value;
      }

      if (key === 'weight' || key === 'per_unit_weight' || key === 'per_unit_wt') {
        updates.weight = value;
        updates.per_unit_weight = value;
        updates.per_unit_wt = value;
      }

      if (key === 'disc' || key === 'disc_percent') {
        updates.disc = value;
        updates.disc_percent = value;
      }

      if (key === 'lot_no' && value) {
        const availableLots = activeData[rowIndex]?.available_lots || [];
        const selectedLot = availableLots.find(l => l.lot_no === value);
        if (selectedLot) {
          updates.rate = selectedLot.rate || 0;
          updates.purc_rate = selectedLot.rate || 0;
          updates.weight = selectedLot.per_unit_weight || selectedLot.weight || 0;
          updates.qty = selectedLot.available_qty || selectedLot.balance_qty || selectedLot.remaining_quantity || 0;
          updates.per_unit_wt = updates.weight;
          updates.per_unit_weight = updates.weight;
        }
      }

      // Also compute wages for papad_kg, wages_bag, wages_per_bag if present
      if (key === 'papad_kg' || key === 'wages_bag' || key === 'wages_per_bag') {
        const currentRow = { ...activeData[rowIndex], ...updates };
        const pKg = parseFloat(currentRow.papad_kg) || 0;
        const wBag = parseFloat(currentRow.wages_bag || currentRow.wages_per_bag) || 0;
        if (pKg > 0 && wBag > 0) {
          updates.wages = (pKg * wBag).toFixed(2);
        }
      }

      const currentRow = { ...activeData[rowIndex], ...updates };

      const parseNumber = (v) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = typeof v === 'number' ? v : parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      };

      const safeQty = parseNumber(currentRow.qty);
      const safeRate = parseNumber(key === 'rate' || key === 'purc_rate' ? value : (currentRow.rate ?? currentRow.purc_rate));
      const safeDisc = parseNumber(key === 'disc' || key === 'disc_percent' ? value : (currentRow.disc ?? currentRow.disc_percent));

      const rawWeight = (key === 'weight' || key === 'per_unit_wt' || key === 'per_unit_weight')
        ? value
        : (currentRow.weight ?? currentRow.per_unit_wt ?? currentRow.perUnitWt ?? currentRow.per_unit_weight ?? 0);

      const numericWeight = (() => {
        if (rawWeight && typeof rawWeight === 'object') {
          const cand = rawWeight.weight ?? rawWeight.value ?? rawWeight.per_unit_wt ?? rawWeight.perUnitWt ?? rawWeight.wt ?? rawWeight.id ?? rawWeight.name;
          const num = parseFloat(String(cand || '').replace(/[^\d.]/g, ''));
          return Number.isFinite(num) && num > 0 ? num : 1;
        }
        const str = String(rawWeight || '');
        const num = parseFloat(str.replace(/[^\d.]/g, ''));
        return Number.isFinite(num) && num > 0 ? num : (safeQty > 0 ? 1 : 0);
      })();

      const safeWeight = numericWeight;

      const rowTaxRate = currentRow.tax_rate !== undefined ? parseNumber(currentRow.tax_rate) : (currentRow.tax !== undefined ? parseNumber(currentRow.tax) : (currentRow.tax_percent !== undefined ? parseNumber(currentRow.tax_percent) : taxRate));
      const totalWt = safeQty * safeWeight;
      const lineTax = calculateLineTax({
        qty: safeQty,
        rate: safeRate,
        discPercent: safeDisc,
        taxType: currentRow.tax_type || (rowTaxRate === 0 ? 'Nil Rated' : 'Taxable'),
        taxMode: taxType,
        gstRate: rowTaxRate,
        hsnCode: currentRow.hsn_code || ''
      });

      Object.assign(updates, {
        base_amount: lineTax.grossAmount,
        disc_amount: lineTax.discAmount,
        taxable_amount: lineTax.taxableAmount,
        tax_amount: lineTax.totalTax,
        tot_wt: totalWt > 0 ? totalWt.toFixed(2) : (totalWt === 0 && safeQty > 0 ? '0.00' : (currentRow.tot_wt || '')),
        total_wt: totalWt > 0 ? totalWt : (currentRow.total_wt || totalWt),
        total_weight: totalWt > 0 ? totalWt : (currentRow.total_weight || totalWt),
        amount: lineTax.totalAmount.toFixed(2),
      });

      if (typeof onRowChange === 'function') {
        onRowChange(rowIndex, '__batch__', updates);
      } else if (typeof onItemChange === 'function') {
        onItemChange(rowIndex, '__batch__', updates);
      } else if (typeof activeRowChange === 'function') {
        activeRowChange(rowIndex, '__batch__', updates);
      }
    },
    [activeData, activeRowChange, onRowChange, onItemChange, taxRate, taxType]
  );


  return (
    <div style={styles.sectionContainer}>
      {sectionTitle && <div style={styles.sectionTitle}>{sectionTitle}</div>}

      <table style={styles.table}>
        <thead>
          <tr>
            {cleanedColumns.map((col) => (
              <th key={col.key}>{col.title}</th>
            ))}
            {showActions && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {activeData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {cleanedColumns.map((col) => {
                if (col.key === 'sno' || col.key === 's_no' || col.key === 'no') {
                  return <td key={col.key}>{rowIndex + 1}</td>;
                }

                if (col.key === 'lot_no' || col.type === 'lotSelect') {
                  // CONSUMPTION / EXISTING LOT MODE: show rich 5-column dropdown of available lots
                  if (lotMode === 'select' || col.type === 'lotSelect') {
                    return (
                      <td key={col.key}>
                        <ExistingLotDropdownCell
                          value={row[col.key] || row.lot_no}
                          row={row}
                          rowIndex={rowIndex}
                          onChange={handleCellChange}
                          readOnly={col.readOnly}
                          taxRate={taxRate}
                          taxType={taxType}
                        />
                      </td>
                    );
                  }

                  // CREATION MODE: show read-only auto/preview lot
                  return (
                    <td key={col.key}>
                      <input
                        value={row.lot_no || ''}
                        readOnly

                        style={{
                          ...styles.cellInput,
                          background: '#f0f8ff',
                          fontStyle: 'normal',
                        }}
                        title={'Select item to generate lot'}
                      />
                    </td>
                  );
                }



                return (
                  <td key={col.key}>
                    {col.type === 'select' && Array.isArray(col.options) ? (
                      <select
                        value={row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== '' ? row[col.key] : ((typeof col.options[0] === 'object' ? col.options[0]?.value : col.options[0]) || '')}
                        onChange={(e) =>
                          handleCellChange(rowIndex, col.key, e.target.value)
                        }
                        style={styles.cellInput}
                        className="table-input"
                        disabled={col.readOnly}
                      >
                        {col.options.map((opt, idx) => {
                          const val = typeof opt === 'object' ? opt.value : opt;
                          const lbl = typeof opt === 'object' ? opt.label : opt;
                          return (
                            <option key={idx} value={val}>
                              {lbl}
                            </option>
                          );
                        })}
                      </select>
                    ) : col.type === 'masterSelect' && (col.masterType === 'items' || col.key === 'item_name' || col.key === 'description') ? (
                      <ItemDropdownCell
                        value={row[col.key]}
                        valueId={row.item_id || row[col.key] || row.description || row.item_name}
                        onChange={handleCellChange}
                        rowIndex={rowIndex}
                        row={row}
                        lotMode={lotMode}
                        taxRate={taxRate}
                        data={activeData}
                        readOnly={col.readOnly}
                      />
                    ) : col.type === 'masterSelect' ? (
                      <MasterSelectCell
                        value={row[col.key]}
                        valueId={
                          col.key === 'weight'
                            ? (row.weight_id ?? row.weight)
                            : (row.item_id || row[col.key] || row.description || row.item_name)
                        }
                        masterType={col.masterType}
                        onChange={handleCellChange}
                        rowIndex={rowIndex}
                        row={row}
                        cellKey={col.key}
                        lotMode={lotMode}
                        taxRate={taxRate}
                        data={activeData}
                      />
                    ) : col.type === 'taxSelect' ? (
                      <TaxDropdownCell
                        value={row[col.key]}
                        onChange={(val, taxMeta) => {
                          const numVal = parseFloat(val) || 0;
                          let updates = {
                            [col.key]: numVal,
                            tax_rate: numVal,
                            tax: numVal,
                            tax_percent: numVal,
                            tax_perc: numVal,
                            gst_rate: numVal,
                            tax_type: taxMeta?.tax_type || (numVal === 0 ? 'Nil Rated' : 'Taxable')
                          };
                          if (taxMeta && taxMeta.hsn_code) {
                            updates.hsn_code = taxMeta.hsn_code;
                          }
                          handleCellChange(rowIndex, '__batch__', updates);
                        }}
                        rowIndex={rowIndex}
                        row={row}
                        cellKey={col.key}
                        readOnly={col.readOnly}
                        isInterState={isInterState}
                      />
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : ''}
                        onChange={(e) =>
                          handleCellChange(rowIndex, col.key, e.target.value)
                        }
                        onFocus={(e) => {
                          if (col.type === 'number') {
                            e.target.select();
                          }
                        }}
                        readOnly={col.readOnly}
                        style={{
                          ...styles.cellInput,
                          ...(col.readOnly ? { background: '#f5f5f5' } : {})
                        }}
                      />
                    )}
                  </td>
                );
              })}

              {showActions && (
                <td>
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(rowIndex)}
                    style={{
                      background: '#ff4d4f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {showActions && editable && (
        <button type="button" onClick={handleAddRow} style={styles.addRowBtn}>
          + Add Row
        </button>
      )}
    </div>
  );
};

const styles = {
  sectionContainer: { padding: 15 },
  sectionTitle: { fontWeight: 'bold' },
  table: { width: '100%' },
  cellInput: { width: '100%', padding: 4 },
  addRowBtn: {
    marginTop: 10,
    padding: '8px 16px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};


export default EntryItemsTable;