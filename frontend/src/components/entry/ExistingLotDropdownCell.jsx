import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../../services/api.js';

/**
 * ExistingLotDropdownCell - High-precision Existing Lot Selection Dropdown
 * 
 * Displays available existing lots for the selected item in a 5-column tabular format:
 * 1. Lot No (e.g., Lot sequence / lot barcode)
 * 2. Weight (e.g., Bag weight in KG)
 * 3. Stock / Qty (Available remaining bags)
 * 4. Purc Rate (Unit purchase rate / cost)
 * 5. Supplier Name (Vendor / Supplier source)
 * 
 * Used in consumption / item table modules (Grind Creation, Sales, Stock Adjust, etc.)
 */

const ExistingLotDropdownCell = ({
  value = '',
  row = {},
  rowIndex = 0,
  onChange = () => {},
  readOnly = false,
  taxRate = 5,
  taxType = 'Exclusive'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const rowRefs = useRef([]);

  const currentItemKey = row?.item_id || row?.item_name || row?.name || '';
  const currentLotNo = value || row?.lot_no || '';

  // Fetch available lots when the item changes or when opened
  const fetchAvailableLots = useCallback(async (force = false) => {
    if (!currentItemKey) {
      setLots([]);
      return;
    }

    if (!force && row?.available_lots && Array.isArray(row.available_lots) && row.available_lots.length > 0) {
      setLots(row.available_lots);
      return;
    }

    setLoading(true);
    try {
      const endpoint = `/stock/available/${encodeURIComponent(currentItemKey)}`;
      const res = await api(endpoint);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      const parsedLots = list.map(item => {
        const rawStock = item.stock ?? item.available_qty ?? item.remaining_quantity ?? item.balance_qty ?? item.quantity ?? 0;
        const rawWeight = item.per_unit_weight ?? item.weight ?? item.weight_kg ?? 0;
        const rawRate = item.purc_rate ?? item.purchase_rate ?? item.rate ?? 0;
        const rawSup = item.supplier_name ?? item.supplier ?? item.supplier_print_name ?? '-';

        return {
          id: item.id,
          lot_no: String(item.lot_no || '').trim(),
          stock: parseFloat(rawStock) || 0,
          weight: parseFloat(rawWeight) || 0,
          rate: parseFloat(rawRate) || 0,
          supplier_name: String(rawSup).trim() || '-',
          purchase_date: item.purchase_date || item.created_at || ''
        };
      }).filter(l => l.stock > 0 || l.lot_no === currentLotNo);

      setLots(parsedLots);

      // Also cache onto row batch if needed
      onChange(rowIndex, '__batch__', {
        ...row,
        available_lots: parsedLots,
        available_lots_loaded: true
      });
    } catch (err) {
      console.error('Failed to fetch available lots:', err);
      setLots([]);
    } finally {
      setLoading(false);
    }
  }, [currentItemKey, currentLotNo, row, rowIndex, onChange]);

  useEffect(() => {
    if (currentItemKey) {
      fetchAvailableLots();
    } else {
      setLots([]);
    }
  }, [currentItemKey]);

  // Sync if row already has available_lots
  useEffect(() => {
    if (row?.available_lots && Array.isArray(row.available_lots) && row.available_lots.length > 0) {
      setLots(row.available_lots);
    }
  }, [row?.available_lots]);

  // Filter lots by search term
  const filteredLots = useMemo(() => {
    if (!searchTerm.trim()) return lots;
    const term = searchTerm.toLowerCase().trim();
    return lots.filter(lot => 
      lot.lot_no.toLowerCase().includes(term) ||
      lot.supplier_name.toLowerCase().includes(term) ||
      String(lot.rate).includes(term) ||
      String(lot.weight).includes(term) ||
      String(lot.stock).includes(term)
    );
  }, [lots, searchTerm]);

  // Handle open / close dropdown
  const toggleDropdown = () => {
    if (readOnly) return;
    if (!currentItemKey) {
      alert('Please select an Item Name first to view available lots.');
      return;
    }
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      fetchAvailableLots(true);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Select a lot and update the full row
  const handleSelectLot = (lot) => {
    if (!lot) return;

    const lotNo = lot.lot_no;
    const wt = parseFloat(lot.weight) || 0;
    const availableStock = parseFloat(lot.stock) || 0;
    const purcRate = parseFloat(lot.rate) || 0;
    const supplierName = lot.supplier_name || '';

    // If current row qty is empty or 0, default to available stock
    const currentQtyNum = parseFloat(row?.qty) || 0;
    const finalQty = currentQtyNum > 0 ? currentQtyNum : availableStock;
    const totalWt = finalQty * wt;

    const effectiveRate = purcRate > 0 ? purcRate : (parseFloat(row?.rate) || 0);
    const baseAmt = finalQty * effectiveRate;
    const rowTaxRate = row?.tax_rate !== undefined ? parseFloat(row.tax_rate) : (taxRate || 5);
    const effectiveTaxRate = (taxType === 'Without Tax') ? 0 : rowTaxRate;
    const taxAmt = (baseAmt * effectiveTaxRate) / 100;
    const finalAmt = baseAmt + taxAmt;

    const batchUpdates = {
      ...row,
      lot_no: lotNo,
      weight: wt,
      per_unit_wt: wt,
      qty: finalQty,
      total_wt: totalWt,
      total_weight: totalWt,
      rate: effectiveRate,
      purchase_rate: purcRate,
      purc_rate: purcRate,
      cost: effectiveRate,
      supplier_name: supplierName,
      supplier: supplierName,
      base_amount: baseAmt,
      tax_amount: taxAmt,
      amount: finalAmt,
      available_lots: lots
    };

    onChange(rowIndex, '__batch__', batchUpdates);
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < filteredLots.length - 1 ? prev + 1 : prev;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredLots[selectedIndex]) {
        handleSelectLot(filteredLots[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Format numbers cleanly
  const formatWeight = (wt) => {
    const num = parseFloat(wt) || 0;
    return `${num}KG`;
  };

  const formatStock = (stk) => {
    const num = parseFloat(stk) || 0;
    return num.toFixed(3);
  };

  const formatRate = (r) => {
    const num = parseFloat(r) || 0;
    return num.toFixed(2);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', minWidth: '110px' }}
      onKeyDown={handleKeyDown}
    >
      {/* Table Cell Display / Trigger */}
      <div
        onClick={toggleDropdown}
        title={currentItemKey ? (currentLotNo ? `Lot: ${currentLotNo} (Click to change)` : 'Click to select available lot') : 'Select Item Name first'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          border: '1px solid #cbd5e1',
          borderRadius: '3px',
          background: readOnly ? '#f8fafc' : (!currentItemKey ? '#f1f5f9' : '#ffffff'),
          cursor: readOnly || !currentItemKey ? 'not-allowed' : 'pointer',
          minHeight: '26px',
          fontSize: '12px',
          fontFamily: 'inherit',
          color: currentLotNo ? '#0f172a' : '#94a3b8',
          fontWeight: currentLotNo ? '600' : '400',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLotNo || (currentItemKey ? '-- Select Lot --' : 'Select Item')}
        </span>
        {!readOnly && (
          <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '4px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ▼
          </span>
        )}
      </div>

      {/* 5-Column Existing Lot Dropdown Popover (matching screenshot) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 9999,
            marginTop: '2px',
            minWidth: '460px',
            maxWidth: '560px',
            background: '#ffffff',
            border: '1px solid #334155',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            fontFamily: 'Segoe UI, Tahoma, sans-serif'
          }}
        >
          {/* Quick Search & Header Info Bar */}
          <div
            style={{
              padding: '6px 8px',
              background: '#f1f5f9',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search lot, supplier, rate..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '11px',
                border: '1px solid #94a3b8',
                borderRadius: '3px',
                outline: 'none',
                background: '#ffffff'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', whiteSpace: 'nowrap' }}>
              {filteredLots.length} {filteredLots.length === 1 ? 'Lot' : 'Lots'} Available
            </span>
          </div>

          {/* 5-Column Table Header (Dark Charcoal/Blue styling from screenshot) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '95px 75px 85px 85px 1fr',
              background: '#2d3748',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              borderBottom: '1px solid #1a202c',
              userSelect: 'none'
            }}
          >
            <div style={{ padding: '6px 8px', borderRight: '1px solid #4a5568', textAlign: 'left' }}>
              Lot No
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #4a5568', textAlign: 'left' }}>
              Weight
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #4a5568', textAlign: 'right' }}>
              Stock
            </div>
            <div style={{ padding: '6px 8px', borderRight: '1px solid #4a5568', textAlign: 'right' }}>
              Purc Rate
            </div>
            <div style={{ padding: '6px 8px', textAlign: 'left' }}>
              Supplier Name
            </div>
          </div>

          {/* Table Rows Body */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              background: '#ffffff'
            }}
          >
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                Loading available lots...
              </div>
            ) : filteredLots.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#ef4444', fontSize: '12px' }}>
                {searchTerm ? 'No matching lots found' : 'No existing stock lots found for this item'}
              </div>
            ) : (
              filteredLots.map((lot, idx) => {
                const isSelected = lot.lot_no === currentLotNo;
                const isHighlighted = idx === selectedIndex;

                return (
                  <div
                    key={`${lot.lot_no}-${idx}`}
                    ref={(el) => (rowRefs.current[idx] = el)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectLot(lot);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '95px 75px 85px 85px 1fr',
                      fontSize: '11px',
                      color: '#0f172a',
                      background: isSelected
                        ? '#dbeafe'
                        : isHighlighted
                        ? '#f1f5f9'
                        : idx % 2 === 0
                        ? '#ffffff'
                        : '#fafafa',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e2e8f0',
                      alignItems: 'center',
                      fontWeight: isSelected ? '700' : '400',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    {/* 1. Lot No */}
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e2e8f0',
                        color: '#0f172a',
                        fontWeight: '700',
                        fontFamily: 'Consolas, monospace',
                        textAlign: 'left'
                      }}
                    >
                      {lot.lot_no}
                    </div>

                    {/* 2. Weight */}
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e2e8f0',
                        color: '#334155',
                        textAlign: 'left'
                      }}
                    >
                      {formatWeight(lot.weight)}
                    </div>

                    {/* 3. Stock */}
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e2e8f0',
                        textAlign: 'right',
                        color: '#0369a1',
                        fontWeight: '600'
                      }}
                    >
                      {formatStock(lot.stock)}
                    </div>

                    {/* 4. Purc Rate */}
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e2e8f0',
                        textAlign: 'right',
                        color: '#047857',
                        fontWeight: '600'
                      }}
                    >
                      {formatRate(lot.rate)}
                    </div>

                    {/* 5. Supplier Name */}
                    <div
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        color: '#334155',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={lot.supplier_name}
                    >
                      {lot.supplier_name}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div
            style={{
              padding: '4px 8px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              color: '#64748b'
            }}
          >
            <span>Click or press [Enter] to select lot</span>
            <span>[Esc] to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExistingLotDropdownCell;
