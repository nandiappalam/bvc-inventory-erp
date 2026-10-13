import React, { useState, useEffect } from 'react';
import {
  TextField, MenuItem, Select, FormControl, InputLabel,
  Autocomplete, Box, Typography, Button
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { getMasters, safeArray } from '../../services/masterservice.js';
import { InlineMasterModal, getCreateLabel, normalizeMasterType } from './InlineMasterModal.jsx';

export const InlineMasterSelect = ({
  masterType,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  fullWidth = true,
  disabled = false,
  size = 'small',
  options: externalOptions = null,
  variant = 'mui', // 'mui', 'native', 'autocomplete'
  className,
  style,
  allowCreate = true,
  customCreateLabel = null,
  getOptionLabelOverride = null,
  getOptionValueOverride = null
}) => {
  const normType = normalizeMasterType(masterType);
  const [masterOptions, setMasterOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [typedSearch, setTypedSearch] = useState('');

  const fetchOptions = async (force = false) => {
    if (externalOptions && Array.isArray(externalOptions) && externalOptions.length > 0) {
      setMasterOptions(externalOptions);
      return;
    }
    setLoading(true);
    try {
      let data = [];
      if (normType === 'workers' || normType === 'drivers') {
        const res = await fetch('/api/operational-charges/parties').then(r => r.json());
        data = safeArray(res.parties || res.data || res);
        if (normType === 'drivers') {
          data = data.filter(p => (p.category || p.party_category) === 'DRIVER');
        }
      } else {
        data = await getMasters(normType, { forceRefresh: force });
      }
      setMasterOptions(safeArray(data));
    } catch (err) {
      console.error(`Failed to fetch options for ${normType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!externalOptions) {
      fetchOptions();
    } else {
      setMasterOptions(externalOptions);
    }
  }, [masterType, externalOptions]);

  const getOptVal = (opt) => {
    if (getOptionValueOverride) return getOptionValueOverride(opt);
    if (!opt) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    return String(
      opt.id !== undefined && opt.id !== null ? opt.id :
      opt.value !== undefined ? opt.value :
      opt.code || opt.name || ''
    );
  };

  const getOptLabel = (opt) => {
    if (getOptionLabelOverride) return getOptionLabelOverride(opt);
    if (!opt) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    return String(
      opt.label || opt.name || opt.supplier_name || opt.customer_name ||
      opt.godown_name || opt.item_name || opt.flourmill || opt.papad_company ||
      opt.sender_name || opt.consignee_name || opt.weight_name || opt.displayName ||
      opt.vehicle_no || opt.city_name || opt.area_name || opt.group_name || opt.id || ''
    );
  };

  const createOptionLabel = customCreateLabel || getCreateLabel(normType);

  const handleSelectChange = (e) => {
    const selectedVal = e.target.value;
    if (selectedVal === '__CREATE_NEW__') {
      setModalOpen(true);
      return;
    }
    if (onChange) {
      const match = masterOptions.find(o => String(getOptVal(o)) === String(selectedVal));
      onChange(selectedVal, match || null);
    }
  };

  const handleCreated = async (newId, newRecord) => {
    await fetchOptions(true);
    const targetVal = newId !== undefined && newId !== null ? String(newId) : (newRecord?.name || '');
    if (onChange) {
      onChange(targetVal, newRecord);
    }
  };

  const currentValueStr = value !== undefined && value !== null ? String(value) : '';
  const hasMatchingOption = masterOptions.some(opt => String(getOptVal(opt)) === currentValueStr);

  if (variant === 'native') {
    return (
      <>
        <select
          value={currentValueStr}
          onChange={handleSelectChange}
          disabled={disabled || loading}
          required={required}
          className={className || "uniform-input"}
          style={style}
        >
          <option value="">Select {label || normType}</option>
          {currentValueStr && !hasMatchingOption && (
            <option value={currentValueStr}>
              {currentValueStr}
            </option>
          )}
          {masterOptions.map((opt, idx) => {
            const val = getOptVal(opt);
            const lbl = getOptLabel(opt);
            return (
              <option key={`${val}-${idx}`} value={val}>
                {lbl}
              </option>
            );
          })}
          {allowCreate && (
            <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
              {createOptionLabel}
            </option>
          )}
        </select>

        {allowCreate && (
          <InlineMasterModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            masterType={normType}
            initialName={typedSearch}
            onSuccess={handleCreated}
          />
        )}
      </>
    );
  }

  return (
    <>
      <TextField
        select
        label={label || normType}
        value={currentValueStr}
        onChange={handleSelectChange}
        disabled={disabled || loading}
        required={required}
        fullWidth={fullWidth}
        size={size}
        placeholder={placeholder}
        className={className}
        sx={style}
      >
        <MenuItem value="">
          <em>-- Select {label || normType} --</em>
        </MenuItem>
        {currentValueStr && !hasMatchingOption && (
          <MenuItem value={currentValueStr}>
            {currentValueStr}
          </MenuItem>
        )}
        {masterOptions.map((opt, idx) => {
          const val = getOptVal(opt);
          const lbl = getOptLabel(opt);
          return (
            <MenuItem key={`${val}-${idx}`} value={val}>
              {lbl}
            </MenuItem>
          );
        })}
        {allowCreate && (
          <MenuItem
            value="__CREATE_NEW__"
            sx={{
              fontWeight: 800,
              color: '#1e3a8a',
              bgcolor: '#f0fdf4',
              borderTop: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': { bgcolor: '#dcfce7' }
            }}
          >
            <AddCircleOutlineIcon fontSize="small" sx={{ color: '#16a34a' }} />
            {createOptionLabel}
          </MenuItem>
        )}
      </TextField>

      {allowCreate && (
        <InlineMasterModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          masterType={normType}
          initialName={typedSearch}
          onSuccess={handleCreated}
        />
      )}
    </>
  );
};

export default InlineMasterSelect;
