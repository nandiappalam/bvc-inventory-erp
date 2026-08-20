import React from 'react';
import { TRANSACTION_TAX_MODES, INDIAN_STATES } from '../../services/taxService';

/**
 * TaxModeSelector Component
 * Allows selecting:
 * 1. Transaction Tax Mode (Exclusive vs Inclusive vs Without Tax)
 * 2. Party State (Tamil Nadu vs Karnataka vs etc.) for automatic Inter/Intra state determination
 */
const TaxModeSelector = ({
  taxMode = 'Exclusive',
  onTaxModeChange,
  partyState = 'Tamil Nadu',
  onPartyStateChange,
  companyState = 'Tamil Nadu',
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm ${className}`}>
      {/* Tax Mode Selection */}
      <div className="flex items-center gap-2">
        <label className="font-medium text-slate-700 whitespace-nowrap">Tax Mode:</label>
        <select
          value={taxMode}
          onChange={(e) => onTaxModeChange && onTaxModeChange(e.target.value)}
          disabled={disabled}
          className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {TRANSACTION_TAX_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      {/* Party State Selection */}
      {onPartyStateChange && (
        <div className="flex items-center gap-2">
          <label className="font-medium text-slate-700 whitespace-nowrap">Party State:</label>
          <select
            value={partyState}
            onChange={(e) => onPartyStateChange(e.target.value)}
            disabled={disabled}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {INDIAN_STATES.map((state) => (
              <option key={state.code} value={state.name}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* State Status Badge */}
      <div className="ml-auto">
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
          taxMode === 'Without Tax'
            ? 'bg-amber-100 text-amber-800 border border-amber-300'
            : partyState.toLowerCase() === companyState.toLowerCase()
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-purple-100 text-purple-800 border border-purple-300'
        }`}>
          {taxMode === 'Without Tax'
            ? '0% GST (Without Tax)'
            : partyState.toLowerCase() === companyState.toLowerCase()
              ? 'Intra-State (CGST + SGST)'
              : 'Inter-State (IGST)'}
        </span>
      </div>
    </div>
  );
};

export default TaxModeSelector;
