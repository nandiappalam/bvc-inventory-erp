import React, { useState, useEffect, useCallback, useRef } from 'react';

import { validateEntryConfig } from '../../utils/validateEntryPage';
import { api, getMasters } from '../../services/api.js';
import { safeArray } from './safeArray.js';
import { DEBUG } from '../../config/debug';
import { parseWeight } from '../../utils/weightUtils.js';
import ExistingLotDropdownCell from './ExistingLotDropdownCell.jsx';



const MasterSelectCell = ({ value, valueId, masterType, onChange, rowIndex, row, cellKey, lotMode }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  // Prevent lot generation on programmatic/select initialization changes.
  // Only allow /lots/next after a real user interaction with this cell.
  const userInteractedRef = useRef(false);


  useEffect(() => {

    if (!masterType) {
      setOptions([]);
      return;
    }

    const fetchOptions = async () => {
      setLoading(true);
      try {
        const table = masterType.replace('_master', '');
        if (DEBUG) console.log(`Fetching masters: ${masterType} -> table: ${table}`);
        const result = await getMasters(table);
        if (!result) return;
        const data = safeArray(result.data || result);
        setOptions(data);
      } catch (err) {
        console.error(`Error fetching ${masterType}:`, err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [masterType]);

  const safeOptions = Array.isArray(options) ? options : [];

  const handleChange = (e) => {
    const selectedId = e.target.value;
    if (DEBUG) console.log('🎯 MasterSelectCell CHANGE:', { cellKey, selectedId, nativeEventType: e?.nativeEvent?.type });

    // Allow only real user-triggered select interactions.
    // React may call onChange during initialization/re-render; nativeEventType distinguishes it.
    const nativeType = e?.nativeEvent?.type;
    if (nativeType === 'click' || nativeType === 'keydown' || nativeType === 'change') {
      userInteractedRef.current = true;
    }


    const selectedItem = safeOptions.find(opt => String(opt.id) === String(selectedId));
    const selectedName = selectedItem?.item_name ?? selectedItem?.name ?? selectedItem?.printname ?? selectedItem?.print_name ?? '';

    // Treat the item master dropdown column as the "item selection" column.
    // Your table may pass different keys, so we check both:
    //   - cellKey === 'item_name' (older convention)
    //   - masterType === 'items' (current normalization sets this for the item dropdown)
    const isItemSelection = cellKey === 'item_name' || masterType === 'items';

    if (isItemSelection) {
      // When item is selected, update both item_id and item_name in a batch.
      // For STOCK CREATION modules (lotMode === 'auto'), generate NEW lot immediately.
      const baseBatch = {
        item_id: selectedItem?.id ?? selectedId,
        item_name: selectedName,
        item_label: selectedName,
        // Reset other item-related fields when item_name changes
        qty: '',
        weight: '',
        total_wt: '',
        available_lots: [],
        available_lots_loaded: false, // Mark lots as not loaded for the new item
      };

      if (lotMode === 'auto') {
        // Option B2 cannot be implemented correctly with current backend /lots/preview.
        // /lots/preview does not consume/advance sequence, so every row gets the same lot.
        // Correct approach per requirement: generate/commit lots ONLY on Save (/lots/reserve).

        // User clearing item selection => clear lot.
        if (!selectedId) {
          if (row?.lot_no) {
            const safeBatch = { ...baseBatch };
            delete safeBatch.lot_no;
            delete safeBatch.lot_status;
            onChange(rowIndex, '__batch__', safeBatch);
          } else {
            onChange(rowIndex, '__batch__', { ...baseBatch, lot_no: '', lot_status: '' });
          }
          return;
        }

        // LOT IMMUTABILITY: if already has lot_no, keep it.
        if (row?.lot_no) {
          if (DEBUG) console.log('🛑 [lots] skipped (row already has lot_no)', { rowIndex, lot_no: row?.lot_no });
          const safeBatch = { ...baseBatch };
          delete safeBatch.lot_no;
          onChange(rowIndex, '__batch__', safeBatch);
          return;
        }

        // IMPORTANT: Reserve/commit must happen ONLY on real user interaction.
        // Prevent accidental sequence advancement during refresh/mount/re-render.
        if (!userInteractedRef.current) {
          if (DEBUG) console.log('🛑 [lots/reserve] blocked (no user interaction)');
          const safeBatch = { ...baseBatch };
          delete safeBatch.lot_no;
          onChange(rowIndex, '__batch__', safeBatch);
          return;
        }

        // Option B: immediately reserve/commit a unique lot number per row when item is selected.
        // Do NOT use /lots/preview (non-consuming); use /lots/reserve.
        const safeBatch = { ...baseBatch };
        delete safeBatch.lot_no;

        (async () => {
          try {
            const reserveRes = await api('/lots/reserve', { method: 'POST' });
            const reservedLot = reserveRes?.lot_no || reserveRes?.data?.lot_no || '';
            if (reservedLot) {
              onChange(rowIndex, '__batch__', {
                ...safeBatch,
                lot_no: reservedLot,
                lot_status: 'reserved',
              });
            } else {
              onChange(rowIndex, '__batch__', {
                ...safeBatch,
                lot_no: '',
                lot_status: 'reserve_error',
              });
            }
          } catch (err) {
            console.error('LOT RESERVE ERROR:', err);
            onChange(rowIndex, '__batch__', {
              ...safeBatch,
              lot_no: '',
              lot_status: 'reserve_error',
            });
          }
        })();



      } else {

        // STOCK CONSUMPTION modules: keep lot_no empty until user selects from dropdown.
        onChange(rowIndex, '__batch__', {
          ...baseBatch,
          lot_no: '',
        });
      }


      return;
    }


    onChange(rowIndex, cellKey, selectedId, selectedId);
  };

  const selectValue = valueId ? String(valueId) : '';

  return (
    <select value={selectValue} onChange={handleChange} style={styles.cellInput} disabled={loading} className="table-input">
      {/* Keep compatibility with existing weight dropdown values: store ID, also keep computed per_unit_weight */}
      <option value="">{loading ? 'Loading...' : '-- Select --'}</option>
      {safeOptions.map((opt) => (
        <option key={opt.id} value={String(opt.id)}>
          {opt.item_name || opt.name || opt.printname || opt.print_name || String(opt.id)}
        </option>
      ))}
    </select>
  );
};

const EntryItemsTable = ({
  columns = [],
  data = [],
  onRowChange = () => {},
  onAddRow = () => {},
  onDeleteRow = () => {},
  showActions = true,
  sectionTitle = '',
  editable = true,
  lotMode = 'select',
  taxType = 'Exclusive',
  taxRate = 18
}) => {
  const [weights, setWeights] = useState([]);

  // Load weight master dropdown options once (id stored for DB relations, name for calculations)
  useEffect(() => {
    const loadWeights = async () => {
      try {
        const result = await getMasters('weights');
        const data = safeArray(result?.data || result);
        setWeights(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load weights master:', err);
        setWeights([]);
      }
    };
    loadWeights();
  }, []);



  // Effect to load available lots when item_id changes for a row
  useEffect(() => {
    data.forEach((row, rowIndex) => {
      // Only load if item_id exists and lots for this item haven't been loaded yet
      if (row.item_id && !row.available_lots_loaded) {
        const loadLots = async () => {
          try {
            const lots = await api(`/stock/available/${encodeURIComponent(row.item_id)}`);
            const availableLots = safeArray(lots.data || lots).filter(l => (l.balance_qty || l.remaining_quantity || l.available_qty || l.qty || 0) > 0);
            onRowChange(rowIndex, '__batch__', { available_lots: availableLots, available_lots_loaded: true });
            if (DEBUG) console.log(`Loaded ${availableLots.length} lots for "${row.item_name}" (ID: ${row.item_id})`);
          } catch (err) {
            console.error(`LOT LOAD ERROR for ${row.item_name} (ID: ${row.item_id}):`, err);
            onRowChange(rowIndex, '__batch__', { available_lots: [], available_lots_loaded: true });
          }
        };
        loadLots();
      }
    });
  }, [data, onRowChange]); // Depend on data and onRowChange



  // Auto first row
  useEffect(() => {
    if (data.length === 0) {
      const newRow = {
        item_name: '',
        item_id: '',
        lot_no: '',
        weight: '',
        qty: '',
        total_wt: '',
        rate: '',
        disc: '',
        tax: '',
        amount: ''
      };
      onAddRow(newRow);
    }
  }, []);



  const normalizeColumns = (columns) => {
    return columns.map(col => ({
      ...col,
      type: col.type || (col.key?.toLowerCase() === 'item_name' ? 'masterSelect' : undefined),
      masterType: col.masterType || (col.key?.toLowerCase() === 'item_name' ? 'items' : undefined),
    }));
  };

  const cleanedColumns = normalizeColumns(columns);

  // IMPORTANT: EntryItemsTable supports different lot balance field names.
  // Some backend queries return available_qty / remaining_qty / balance_qty.
  // The UI must not treat missing fields as 0.
  validateEntryConfig([], cleanedColumns);

  const handleAddRow = () => {
    const newRow = {
      sno: (Array.isArray(data) ? data.length : 0) + 1,

      item_id: '',
      item_name: '',
      item_label: '',

      lot_no: '',
      // canonical internal trace only
      _lot_fetched: '',

      qty: 0,
      weight: 0,
      rate: 0,
      disc: 0,
      tax_rate: 5,

      // Canonical ERP output fields (will be recalculated on edits)
      per_unit_weight: '',
      total_weight: 0,
      base_amount: 0,
      disc_amount: 0,
      tax_amount: 0,
      amount: 0
    };

    onAddRow(newRow);
  };

  const handleCellChange = useCallback((rowIndex, key, value) => {
    if (lotMode === 'auto' && key === 'lot_no') return;



    // Qty validation against lot balance
    if (key === 'qty' && data[rowIndex]?.lot_no && data[rowIndex]?.available_lots) {
      const qty = parseFloat(value) || 0;
      const currentLot = data[rowIndex].available_lots.find(l => l.lot_no === data[rowIndex].lot_no);
      const getLotBalance = (lot) => (
        lot?.remaining_quantity ??
        lot?.available_qty ??
        lot?.balance_qty ??
        lot?.remaining_qty ??
        lot?.qty ??
        0
      );

const balance = currentLot ? getLotBalance(currentLot) : Infinity;
      // If backend didn't return any balance fields for this lot, do not block qty.
      // This prevents the false error: "Qty 1 > Lot balance 0" when stock_lots stores different column names.
      if (balance === 0 && !(currentLot?.available_qty || currentLot?.remaining_quantity || currentLot?.remaining_qty || currentLot?.balance_qty)) {
        // allow
      } else if (qty > balance) {
        alert(`Qty ${qty} > Lot balance ${balance}`);
        return;
      }
    }

    // Prepare updates for the current change
    let updates = {};
    if (key === '__batch__') {
      updates = { ...value };

      // Anti-overwrite guard for creation flow:
      // If we already have a generated lot_no, do not allow later batches to wipe it out.
      // This prevents the symptom where UI stays "Auto..." after selection.
      const incomingLotNo = updates.lot_no;
      const hasExistingLot = Boolean(data[rowIndex]?.lot_no);
      if (lotMode === 'auto' && hasExistingLot && (incomingLotNo === '' || incomingLotNo === undefined || incomingLotNo === null)) {
        delete updates.lot_no;
        if (updates.lotNo !== undefined) delete updates.lotNo;
      }
    } else {
      updates = { [key]: value };
    }


    // Recalculate ERP fields whenever any of: Qty, Per Unit Weight, Rate, Disc%, Tax%
    const currentRow = { ...data[rowIndex], ...updates };
    if (currentRow) {
      const qty = parseFloat(currentRow.qty || 0) || 0;
      // weight_id is stored in row.weight (master dropdown id) for DB relations.
      // NEVER use the DB id for weight math.
      const selectedWeight = weights.find(
        w => String(w.id) === String(currentRow.weight)
      );

      const perUnitWeight = parseWeight(selectedWeight?.name);

      const rate = parseFloat(currentRow.rate || 0) || 0;
      const discPercent = parseFloat(currentRow.disc || 0) || 0;
      const taxPercent = parseFloat(currentRow.tax_rate ?? taxRate) || 0;

      // ✅ ERP formula structure (Qty × Rate)
      // Total weight should be Qty × Per Unit Wt
      const totalWeight = qty * perUnitWeight;
      const baseAmount = qty * rate;
      const discAmount = baseAmount * (discPercent / 100);
      const taxableAmount = baseAmount - discAmount;
      const taxAmount = Number(((taxableAmount * taxPercent) / 100).toFixed(2));
      const amount = Number((taxableAmount + taxAmount).toFixed(2));

      // Consolidate all calculated fields into the update batch
      Object.assign(updates, {
        total_wt: totalWeight,
        total_weight: totalWeight,
        base_amount: baseAmount,
        disc_amount: discAmount,
        tax_amount: taxAmount,
        amount: amount,
        per_unit_weight: perUnitWeight
      });
    }

    // Single call to update the parent state
    onRowChange(rowIndex, '__batch__', updates);
  }, [data, onRowChange, lotMode, taxRate, weights, parseWeight]);

  return (
    <div style={styles.sectionContainer}>
      {sectionTitle && <div style={styles.sectionTitle}>{sectionTitle}</div>}
      <table style={styles.table}>
        <thead>
          <tr>
            {cleanedColumns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : {}}>
                {col.title}
              </th>
            ))}
            {showActions && editable && <th style={{ width: '50px' }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {cleanedColumns.map((col) => {
                if (col.key === 's_no' || col.key === 'sno') {
                  return (
                    <td key={col.key}>
                      <input 
                        type="text" 
                        value={rowIndex + 1} 
                        readOnly 
                        style={{...styles.cellInput, backgroundColor: '#f5f5f5', textAlign: 'center'}} 
                      />
                    </td>
                  );
                }
                if (col.key === 'lot_no') {
                  if (lotMode === 'auto') {
                    return (
                      <td key={col.key}>
                        <input
                          type="text"
                          value={row.lot_no || ''}
                          readOnly
                          className="table-input"
                          style={{ backgroundColor: '#f0f8ff', fontWeight: 'bold' }}
                          title="Auto-generated lot"
                        />
                      </td>
                    );
                  } else {
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
                }

                return (
                  <td key={col.key}>
                    {editable ? (
                      col.type === 'masterSelect' ? (
                        <MasterSelectCell
                          value={row[col.key]} // This is row.item_name
                          valueId={col.key === 'item_name' ? row.item_id : row[col.key]} // Use row[col.key] as ID for other master selects
                          masterType={col.masterType}
                          onChange={handleCellChange}
                          rowIndex={rowIndex}
                          row={row}
                          cellKey={col.key}
                          lotMode={lotMode}
                        />


                      ) : col.readOnly ? (
                        <input
                          type={col.type || 'text'}
                          value={row[col.key] || ''}
                          style={{...styles.cellInput, backgroundColor: '#f5f5f5'}}
                          readOnly
                        />
                      ) : (
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={row[col.key] || ''}
                          onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                          style={styles.cellInput}
                          step={col.type === 'number' ? '0.01' : '1'}
                        />
                      )
                    ) : row[col.key]}
                  </td>
                );
              })}
              {showActions && editable && (
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onDeleteRow(rowIndex)}
                    style={styles.deleteBtn}
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={cleanedColumns.length + (showActions && editable ? 1 : 0)} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px', backgroundColor: '#f8f9fa' }}>
              Total Weight: {data.reduce((sum, row) => sum + parseFloat(row.total_wt || 0), 0).toLocaleString()} KG
            </td>
          </tr>
        </tfoot>
      </table>


      {showActions && editable && (
        <button
          type="button"
          onClick={handleAddRow}
          style={styles.addRowBtn}
          title="Add Row"
        >
          + Add Row
        </button>
      )}

    </div>
  );
};

const styles = {
  sectionContainer: {
    padding: '15px 20px',
    background: '#ffffff',
    margin: '10px 20px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1f3f67',
    marginBottom: '10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    backgroundColor: '#fff',
    marginBottom: '15px',
  },
  cellInput: {
    width: '100%',
    height: '100%',
    border: 'none',
    padding: '4px 8px',
    fontSize: '13px',
    boxSizing: 'border-box',
    background: 'transparent',
  },
  addRowBtn: {
    padding: '8px 16px',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  deleteBtn: {
    padding: '4px 8px',
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default EntryItemsTable;
