import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, getMasters } from '../../services/api.js';
import { safeArray } from './safeArray.js';

/**
 * Returns distinctive color schemes for different stock types
 * to differentiate item names as requested.
 */
export const getStockTypeColor = (type) => {
  const t = String(type || '').trim().toLowerCase();
  
  if (t.includes('flour')) {
    return {
      text: '#15803d', // Emerald Green
      bg: '#f0fdf4',
      border: '#bbf7d0',
      badgeBg: '#dcfce7',
      badgeText: '#166534',
      name: 'Flour',
    };
  }
  if (t.includes('pack')) {
    return {
      text: '#1d4ed8', // Royal Blue
      bg: '#eff6ff',
      border: '#bfdbfe',
      badgeBg: '#dbeafe',
      badgeText: '#1e40af',
      name: 'Pack',
    };
  }
  if (t.includes('urad')) {
    return {
      text: '#b91c1c', // Crimson Red
      bg: '#fef2f2',
      border: '#fecaca',
      badgeBg: '#fee2e2',
      badgeText: '#991b1b',
      name: 'Urad',
    };
  }
  if (t.includes('rice')) {
    return {
      text: '#c2410c', // Amber / Orange
      bg: '#fff7ed',
      border: '#ffedd5',
      badgeBg: '#ffedd5',
      badgeText: '#9a3412',
      name: 'Rice',
    };
  }
  if (t.includes('suji')) {
    return {
      text: '#7e22ce', // Purple
      bg: '#faf5ff',
      border: '#f3e8ff',
      badgeBg: '#f3e8ff',
      badgeText: '#6b21a8',
      name: 'Suji',
    };
  }
  if (t.includes('papad')) {
    return {
      text: '#a16207', // Bronze / Gold
      bg: '#fefce8',
      border: '#fef08a',
      badgeBg: '#fef9c3',
      badgeText: '#854d0e',
      name: 'Papad',
    };
  }
  if (t.includes('masala')) {
    return {
      text: '#be123c', // Deep Rose
      bg: '#fff1f2',
      border: '#ffe4e6',
      badgeBg: '#ffe4e6',
      badgeText: '#9f1239',
      name: 'Masala',
    };
  }
  if (t.includes('vacuum') || t.includes('vaccum')) {
    return {
      text: '#4338ca', // Indigo
      bg: '#eef2ff',
      border: '#e0e7ff',
      badgeBg: '#e0e7ff',
      badgeText: '#3730a3',
      name: 'Vacuum',
    };
  }
  if (t.includes('grain')) {
    return {
      text: '#0e7490', // Teal / Cyan
      bg: '#ecfeff',
      border: '#cffafe',
      badgeBg: '#cffafe',
      badgeText: '#155e75',
      name: 'Grains',
    };
  }
  if (t.includes('reject') || t.includes('wastage') || t.includes('scrap')) {
    return {
      text: '#475569', // Slate
      bg: '#f8fafc',
      border: '#e2e8f0',
      badgeBg: '#f1f5f9',
      badgeText: '#334155',
      name: 'Wastage',
    };
  }
  return {
    text: '#1e293b', // Default Charcoal
    bg: '#ffffff',
    border: '#cbd5e1',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    name: type ? String(type) : 'Standard',
  };
};

const ItemDropdownCell = ({
  value,
  valueId,
  onChange,
  rowIndex,
  row,
  lotMode = 'auto',
  taxRate = 5,
  data = [],
  readOnly = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load items with stock qty, item group, and stock type
  useEffect(() => {
    let isMounted = true;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const result = await getMasters('items');
        const list = safeArray(result?.data || result);
        if (isMounted) {
          setItems(list);
        }
      } catch (err) {
        console.error('Failed to fetch items master:', err);
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchItems();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync display value when row changes
  const selectedItem = useMemo(() => {
    if (!items || items.length === 0) return null;
    const targetId = valueId || row?.item_id;
    if (targetId) {
      const found = items.find((i) => String(i.id) === String(targetId));
      if (found) return found;
    }
    const targetName = value || row?.item_name || row?.item_label;
    if (targetName) {
      const found = items.find(
        (i) =>
          String(i.item_name || i.name || i.print_name || '').toLowerCase() ===
          String(targetName).toLowerCase()
      );
      if (found) return found;
    }
    return null;
  }, [items, valueId, value, row?.item_id, row?.item_name, row?.item_label]);

  const selectedName =
    selectedItem?.item_name ||
    selectedItem?.name ||
    row?.item_name ||
    row?.item_label ||
    value ||
    '';

  const selectedColor = getStockTypeColor(selectedItem?.type || row?.type);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const name = String(item.item_name || item.name || '').toLowerCase();
      const group = String(item.item_group || '').toLowerCase();
      const type = String(item.type || '').toLowerCase();
      const code = String(item.item_code || '').toLowerCase();
      return (
        name.includes(term) ||
        group.includes(term) ||
        type.includes(term) ||
        code.includes(term)
      );
    });
  }, [items, searchTerm]);

  // Group items by category: 1. RAW MATERIALS (RM), 2. FINISHED GOODS (FG), 3. OTHER
  const groupedItems = useMemo(() => {
    const rmItems = [];
    const fgItems = [];
    const otherItems = [];

    filteredItems.forEach((item) => {
      const type = String(item.type || '').toUpperCase();
      const group = String(item.item_group || '').toUpperCase();
      const name = String(item.item_name || item.name || '').toUpperCase();

      const isFG = type.includes('FINISH') || type.includes('FG') || group.includes('FINISH') || group.includes('FG') || name.includes('-FG-') || name.includes(' FG') || name.includes('(FG)');
      const isRM = type.includes('RAW') || type.includes('RM') || group.includes('RAW') || group.includes('RM') || name.includes('-RM-') || name.includes(' RM') || name.includes('(RM)') || !isFG;

      if (isFG) {
        fgItems.push(item);
      } else if (isRM) {
        rmItems.push(item);
      } else {
        otherItems.push(item);
      }
    });

    const groups = [];
    if (rmItems.length > 0) {
      groups.push({
        groupName: '1. RAW MATERIALS (RM)',
        categoryType: 'RM',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        icon: '🌾',
        items: rmItems,
      });
    }
    if (fgItems.length > 0) {
      groups.push({
        groupName: '2. FINISHED GOODS (FG)',
        categoryType: 'FG',
        badgeBg: '#dbeafe',
        badgeColor: '#1d4ed8',
        icon: '📦',
        items: fgItems,
      });
    }
    if (otherItems.length > 0) {
      groups.push({
        groupName: '3. OTHER MATERIALS & SUPPLIES',
        categoryType: 'OTHER',
        badgeBg: '#f3e8ff',
        badgeColor: '#7e22ce',
        icon: '🏷️',
        items: otherItems,
      });
    }
    return groups;
  }, [filteredItems]);

  // Flattened list for keyboard index navigation
  const flatItems = useMemo(() => {
    const flat = [];
    groupedItems.forEach((g) => {
      g.items.forEach((item) => {
        flat.push({ ...item, groupName: g.groupName });
      });
    });
    return flat;
  }, [groupedItems]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems.length]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const highlightedEl = dropdownRef.current.querySelector(
        `[data-item-index="${highlightedIndex}"]`
      );
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Item Selection Handler
  const handleSelectItem = async (item) => {
    if (!item) return;

    const selectedItemId = item.id;
    const itemName = item.item_name || item.name || item.print_name || '';
    const itemTax =
      item.tax !== undefined && item.tax !== null && item.tax !== ''
        ? parseFloat(item.tax)
        : item.gst_rate !== undefined
        ? parseFloat(item.gst_rate)
        : null;
    const resolvedTaxRate =
      itemTax !== null && !isNaN(itemTax)
        ? itemTax
        : taxRate !== undefined
        ? taxRate
        : 5;
    const resolvedHsn = item.hsn_code || row?.hsn_code || '';
    const resolvedTaxType = item.tax_type || row?.tax_type || 'Taxable';

    setIsOpen(false);
    setSearchTerm('');

    const extractNumericWeight = (it) => {
      if (!it) return '';
      const candidateFields = [it.weight, it.per_unit_wt, it.perUnitWt, it.unit_wt, it.bag_weight, it.wt, it.weight_kg, it.bag_size];
      for (const val of candidateFields) {
        if (val !== undefined && val !== null && val !== '') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.]/g, ''));
          if (!isNaN(num) && num > 0) return num;
        }
      }
      const label = it.item_name || it.name || it.print_name || '';
      const match = String(label).match(/(\d+(?:\.\d+)?)\s*(?:kg|g|kgs|gm|bag)/i);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num > 0) return num;
      }
      return '';
    };

    const resolvedWeight = extractNumericWeight(item);

    // If lotMode is 'select' (consumption)
    if (lotMode === 'select') {
      const rowQty = row.qty !== undefined && row.qty !== null && row.qty !== '' ? row.qty : '';
      const totalW = (parseFloat(rowQty) || 0) * (parseFloat(resolvedWeight) || 0);
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: itemName,
        item_label: itemName,
        item_group: item.item_group || '',
        type: item.type || '',
        lot_no: '',
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
        available_lots_loaded: false,
        available_lots: [],
        weight: resolvedWeight !== '' ? resolvedWeight : (row.weight || ''),
        per_unit_wt: resolvedWeight !== '' ? resolvedWeight : (row.per_unit_wt || ''),
        qty: rowQty,
        total_wt: totalW > 0 ? totalW : '',
        total_weight: totalW > 0 ? totalW : '',
        amount: '',
      });
      return;
    }

    // CREATION MODE: Auto preview lot assignment
    if (row?.lot_no) {
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: itemName,
        item_label: itemName,
        item_group: item.item_group || '',
        type: item.type || '',
        lot_no: row.lot_no,
        weight: resolvedWeight !== '' ? resolvedWeight : (row.weight || ''),
        per_unit_wt: resolvedWeight !== '' ? resolvedWeight : (row.per_unit_wt || ''),
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
      return;
    }

    const isWastageLot = lotMode === 'auto-wastage' || lotMode === 'wastage';

    if (isWastageLot) {
      if (!ItemDropdownCell._previewWastageStart) {
        try {
          const previewRes = await api('/lots/preview-wastage', { method: 'GET' });
          ItemDropdownCell._previewWastageStart =
            previewRes?.lot_no || previewRes?.data?.lot_no || 'WST0001';
        } catch (err) {
          console.error('Failed to get wastage lot preview start:', err);
          ItemDropdownCell._previewWastageStart = 'WST0001';
        }
      }
    } else {
      if (!ItemDropdownCell._previewStart) {
        try {
          const previewRes = await api('/lots/preview', { method: 'GET' });
          ItemDropdownCell._previewStart =
            previewRes?.lot_no || previewRes?.data?.lot_no || 'LOT0001';
        } catch (err) {
          console.error('Failed to get lot preview start:', err);
          ItemDropdownCell._previewStart = 'LOT0001';
        }
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

    const activeLots = new Set(
      (data || [])
        .map((r, idx) =>
          idx !== rowIndex ? String(r.lot_no || '').toUpperCase().trim() : ''
        )
        .filter(Boolean)
    );

    let lotNo = '';
    let offset = 0;
    try {
      let found = false;
      const startLot = isWastageLot ? (ItemDropdownCell._previewWastageStart || 'WST0001') : (ItemDropdownCell._previewStart || 'LOT0001');
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
        item_name: itemName,
        item_label: itemName,
        item_group: item.item_group || '',
        type: item.type || '',
        lot_no: lotNo,
        weight: resolvedWeight !== '' ? resolvedWeight : (row.weight || ''),
        per_unit_wt: resolvedWeight !== '' ? resolvedWeight : (row.per_unit_wt || ''),
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
    } catch (err) {
      console.error('Lot preview failed:', err);
      onChange(rowIndex, '__batch__', {
        ...row,
        item_id: selectedItemId,
        item_name: itemName,
        item_label: itemName,
        item_group: item.item_group || '',
        type: item.type || '',
        lot_no: '',
        weight: resolvedWeight !== '' ? resolvedWeight : (row.weight || ''),
        per_unit_wt: resolvedWeight !== '' ? resolvedWeight : (row.per_unit_wt || ''),
        hsn_code: resolvedHsn,
        tax_type: resolvedTaxType,
        tax_rate: resolvedTaxRate,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (disabled || readOnly) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < flatItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : flatItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[highlightedIndex]) {
        handleSelectItem(flatItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(rowIndex, '__batch__', {
      ...row,
      item_id: '',
      item_name: '',
      item_label: '',
      item_group: '',
      type: '',
      lot_no: '',
      hsn_code: '',
      amount: '',
    });
    setSearchTerm('');
    setIsOpen(false);
  };

  let itemFlatCounter = 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Table Input Cell Container */}
      <div
        onClick={() => {
          if (!disabled && !readOnly) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '28px',
          height: '100%',
          padding: '2px 6px',
          backgroundColor: disabled || readOnly ? '#f8fafc' : '#ffffff',
          border: isOpen ? '1px solid #2563eb' : '1px solid transparent',
          borderRadius: '3px',
          cursor: disabled || readOnly ? 'default' : 'pointer',
          boxSizing: 'border-box',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {selectedName ? (
            <>
              <span
                style={{
                  fontWeight: '600',
                  fontSize: '13px',
                  color: selectedColor.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={`${selectedName} | Group: ${selectedItem?.item_group || 'General'} | Stock: ${selectedItem?.stock_qty ?? '0.00'} | Type: ${selectedItem?.type || 'Standard'}`}
              >
                {selectedName}
              </span>

              {/* Stock Type & Stock Mini Badge */}
              {selectedItem && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    backgroundColor: selectedColor.badgeBg,
                    color: selectedColor.badgeText,
                    border: `1px solid ${selectedColor.border}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {selectedItem.type || 'Item'} • Stk: {Number(selectedItem.stock_qty || 0).toFixed(0)}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {loading ? 'Loading...' : '-- Select Item --'}
            </span>
          )}
        </div>

        {/* Dropdown Indicator and Clear Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {selectedName && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '13px',
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.target.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.target.style.color = '#94a3b8')}
            >
              ×
            </button>
          )}
          <span
            style={{
              fontSize: '9px',
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
              userSelect: 'none',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Floating Rich Tabular Dropdown Popup */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            width: '580px',
            maxWidth: '90vw',
            maxHeight: '380px',
            backgroundColor: '#ffffff',
            border: '2px solid #1e3a8a',
            borderRadius: '6px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          {/* Quick Search Header */}
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: '#f1f5f9',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b' }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by Item Name, Group, Stock Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #94a3b8',
                borderRadius: '4px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
              }}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Tabular Header matching ERP columns: Item Name, Item Group, Stock, Type */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr',
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              padding: '6px 10px',
              fontWeight: '700',
              fontSize: '11px',
              letterSpacing: '0.3px',
              borderBottom: '1px solid #0f2557',
              userSelect: 'none',
            }}
          >
            <div>ITEM NAME</div>
            <div>ITEM GROUP</div>
            <div style={{ textAlign: 'right', paddingRight: '8px' }}>STOCK QTY</div>
            <div style={{ textAlign: 'center' }}>TYPE OF STOCK</div>
          </div>

          {/* Scrollable Items List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '280px',
              backgroundColor: '#ffffff',
            }}
          >
            {loading && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '12px',
                }}
              >
                Loading items master...
              </div>
            )}

            {!loading && flatItems.length === 0 && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '12px',
                }}
              >
                No matching items found for &quot;{searchTerm}&quot;
              </div>
            )}

            {!loading &&
              groupedItems.map((group) => {
                return (
                  <div key={group.groupName}>
                    {/* Item Group Header Bar */}
                    <div
                      style={{
                        padding: '6px 10px',
                        backgroundColor: group.badgeBg || '#e2e8f0',
                        color: group.badgeColor || '#1e293b',
                        fontWeight: '800',
                        fontSize: '11px',
                        letterSpacing: '0.4px',
                        borderTop: '1px solid #cbd5e1',
                        borderBottom: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{group.icon || '📁'} {group.groupName}</span>
                      <span style={{ fontSize: '10px', color: group.badgeColor || '#64748b', fontWeight: 'bold' }}>
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Group Items */}
                    {group.items.map((item) => {
                      const currentIndex = itemFlatCounter++;
                      const isHighlighted = currentIndex === highlightedIndex;
                      const isSelected =
                        selectedItem && String(selectedItem.id) === String(item.id);
                      const colorInfo = getStockTypeColor(item.type);
                      const stockVal = parseFloat(item.stock_qty || 0);

                      return (
                        <div
                          key={item.id || currentIndex}
                          data-item-index={currentIndex}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setHighlightedIndex(currentIndex)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr',
                            padding: '6px 10px',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isHighlighted
                              ? '#dbeafe'
                              : isSelected
                              ? '#eff6ff'
                              : '#ffffff',
                            cursor: 'pointer',
                            alignItems: 'center',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          {/* 1. Item Name with Stock Type-specific color differentiation */}
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '12px',
                              color: colorInfo.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              paddingRight: '6px',
                            }}
                            title={item.item_name || item.name}
                          >
                            {item.item_name || item.name}
                          </div>

                          {/* 2. Item Group */}
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#475569',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.item_group || 'General'}
                          </div>

                          {/* 3. Stock Quantity */}
                          <div
                            style={{
                              textAlign: 'right',
                              paddingRight: '8px',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '12px',
                              fontWeight: '700',
                              color:
                                stockVal > 0
                                  ? '#0f172a'
                                  : stockVal < 0
                                  ? '#dc2626'
                                  : '#94a3b8',
                            }}
                          >
                            {stockVal.toFixed(2)}
                          </div>

                          {/* 4. Type of Stock with color badge */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '700',
                                backgroundColor: colorInfo.badgeBg,
                                color: colorInfo.badgeText,
                                border: `1px solid ${colorInfo.border}`,
                                whiteSpace: 'nowrap',
                                textTransform: 'capitalize',
                              }}
                            >
                              {item.type || 'Standard'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>

          {/* Dropdown Footer Status */}
          <div
            style={{
              padding: '4px 10px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '10px',
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Total Items: <strong>{flatItems.length}</strong> ({groupedItems.length} groups)
            </span>
            <span>
              Use <strong>↑</strong> <strong>↓</strong> to navigate, <strong>Enter</strong> to select, <strong>Esc</strong> to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemDropdownCell;
