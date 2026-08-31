import React from 'react';

/**
 * TaxSummary Component
 * Renders high-contrast, ERP-grade summary of:
 * - Taxable Value
 * - Rate-wise breakdown
 * - CGST + SGST (Intra-State) or IGST (Inter-State)
 * - CESS (if any)
 * - Total Tax & Net Grand Total
 */
const TaxSummary = ({ invoiceSummary, isInterState = false, className = '' }) => {
  if (!invoiceSummary) return null;

  const rateSummaries = invoiceSummary.rateSummaries || [];
  const hasTax = (invoiceSummary.taxAmount || invoiceSummary.totalTax) > 0;
  const isWithoutTax = invoiceSummary.taxMode === 'Without Tax';

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm text-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
        <div className="font-semibold text-slate-800 flex items-center gap-2">
          <span>GST / Tax Summary</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            isWithoutTax 
              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
              : isInterState 
                ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
          }`}>
            {isWithoutTax ? 'Mode: Without Tax (0% GST)' : isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
          </span>
        </div>
        <div className="text-xs text-slate-500">
          State: <strong className="text-slate-700">{invoiceSummary.partyState || 'Tamil Nadu'}</strong> ({invoiceSummary.partyStateCode || '33'})
        </div>
      </div>

      {/* Rate-wise Breakdown Table */}
      {rateSummaries.length > 0 && !isWithoutTax && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs text-left border border-slate-200 bg-white rounded">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2 border-r border-slate-200">Rate / Classification</th>
                <th className="p-2 border-r border-slate-200 text-right">Taxable Value</th>
                {!isInterState ? (
                  <>
                    <th className="p-2 border-r border-slate-200 text-right">CGST</th>
                    <th className="p-2 border-r border-slate-200 text-right">SGST</th>
                  </>
                ) : (
                  <th className="p-2 border-r border-slate-200 text-right">IGST</th>
                )}
                <th className="p-2 text-right font-bold">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rateSummaries.map((rate, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 border-r border-slate-200 font-medium text-slate-800">
                    {rate.taxType} {rate.taxType === 'Taxable' ? `(${rate.gstRate}%)` : ''}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-right font-mono">
                    ₹{(rate.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!isInterState ? (
                    <>
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-emerald-700">
                        ₹{(rate.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-emerald-700">
                        ₹{(rate.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </>
                  ) : (
                    <td className="p-2 border-r border-slate-200 text-right font-mono text-purple-700">
                      ₹{(rate.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="p-2 text-right font-mono font-semibold text-slate-900">
                    ₹{(rate.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Aggregate Totals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded border border-slate-200">
        <div>
          <div className="text-xs text-slate-500 font-medium">Taxable Base</div>
          <div className="text-sm font-bold text-slate-800 font-mono">
            ₹{(invoiceSummary.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {!isInterState ? (
          <>
            <div>
              <div className="text-xs text-emerald-700 font-medium">CGST Total</div>
              <div className="text-sm font-bold text-emerald-800 font-mono">
                ₹{(invoiceSummary.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-emerald-700 font-medium">SGST Total</div>
              <div className="text-sm font-bold text-emerald-800 font-mono">
                ₹{(invoiceSummary.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-xs text-purple-700 font-medium">IGST Total</div>
            <div className="text-sm font-bold text-purple-800 font-mono">
              ₹{(invoiceSummary.igstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-slate-500 font-medium">Total GST Amount</div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            ₹{(invoiceSummary.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxSummary;
