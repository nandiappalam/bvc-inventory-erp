import React from 'react';

/**
 * EntryTaxBillDetails
 * Displays comprehensive Bill Details with explicit Tax %, Tax Split (CGST/SGST/IGST),
 * Discount %, Discount Amount, Taxable Bill Amount, and Grand Total
 */
export const EntryTaxBillDetails = ({
  grossAmt = 0,
  baseAmt = 0,
  discPercent = 0,
  discAmt = 0,
  billAmt = 0,
  exemptAmt = 0,
  nilRatedAmt = 0,
  zeroRatedAmt = 0,
  nonGstAmt = 0,
  withoutTaxAmt = 0,
  taxAmt = 0,
  totalAmt = 0,
  grandTotal = 0,
  taxPercent = 0,
  cgstAmt = 0,
  sgstAmt = 0,
  igstAmt = 0,
  rateSummaries = [],
  deductionsAmt = 0,
  deductionPercent = 0,
  edPercent = 0,
  isInterState = false,
  taxType = 'Exclusive',
  title = 'Bill & Tax Details'
}) => {
  const numericBillAmt = parseFloat(billAmt) || 0;
  const numericExemptAmt = parseFloat(exemptAmt) || 0;
  const numericNilRatedAmt = parseFloat(nilRatedAmt) || 0;
  const numericZeroRatedAmt = parseFloat(zeroRatedAmt) || 0;
  const numericNonGstAmt = parseFloat(nonGstAmt) || 0;
  const numericWithoutTaxAmt = parseFloat(withoutTaxAmt) || 0;
  const numericTaxAmt = parseFloat(taxAmt) || 0;
  const numericTotalAmt = parseFloat(totalAmt) || 0;
  const numericGrandTotal = parseFloat(grandTotal) || (numericTotalAmt - (parseFloat(deductionsAmt) || 0));
  const numericTaxPercent = parseFloat(taxPercent) || 0;
  const numericDiscAmt = parseFloat(discAmt) || 0;
  const numericDiscPercent = parseFloat(discPercent) || 0;
  const numericGrossAmt = parseFloat(grossAmt || baseAmt) || (numericBillAmt + numericExemptAmt + numericDiscAmt);
  const availableRateSummaries = Array.isArray(rateSummaries) ? rateSummaries : [];
  const taxableRateSummaries = availableRateSummaries.filter(
    rs => parseFloat(rs.gstRate ?? rs.tax_rate ?? 0) > 0
  );
  const displayedRateSummaries = taxableRateSummaries.length > 0
    ? taxableRateSummaries
    : availableRateSummaries;

  // Compute CGST and SGST if not explicitly provided but taxAmt and taxPercent exist
  const effectiveCgst = cgstAmt !== undefined && cgstAmt !== null && parseFloat(cgstAmt) > 0
    ? parseFloat(cgstAmt)
    : (!isInterState && numericTaxAmt > 0 ? (numericTaxAmt / 2) : 0);

  const effectiveSgst = sgstAmt !== undefined && sgstAmt !== null && parseFloat(sgstAmt) > 0
    ? parseFloat(sgstAmt)
    : (!isInterState && numericTaxAmt > 0 ? (numericTaxAmt / 2) : 0);

  const effectiveIgst = igstAmt !== undefined && igstAmt !== null && parseFloat(igstAmt) > 0
    ? parseFloat(igstAmt)
    : (isInterState && numericTaxAmt > 0 ? numericTaxAmt : 0);

  const halfRate = (numericTaxPercent / 2).toFixed(1).replace(/\.0$/, '');

  const formatCurr = (v) => {
    const num = typeof v === 'number' ? v : parseFloat(v) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isWithoutTax = String(taxType || '').toLowerCase().includes('without');

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        <div style={styles.badge}>
          {isWithoutTax ? 'Tax Exempt / Without Tax' : (isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)')}
        </div>
      </div>

      <div style={styles.grid}>
        {/* Gross / Base Item Amount before discount */}
        {numericGrossAmt > 0 && numericGrossAmt !== numericBillAmt && (
          <div style={styles.item}>
            <span style={styles.label}>Gross Amount:</span>
            <span style={{ ...styles.amount, color: '#334155' }}>{formatCurr(numericGrossAmt)}</span>
          </div>
        )}

        {/* Discount % and Discount Amount */}
        {(numericDiscAmt > 0 || numericDiscPercent > 0) && (
          <>
            <div style={{ ...styles.item, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <span style={{ ...styles.label, color: '#991b1b', fontWeight: 'bold' }}>
                Discount %:
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c' }}>
                {numericDiscPercent > 0 ? `${numericDiscPercent}%` : 'Item Disc'}
              </span>
            </div>

            <div style={{ ...styles.item, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <span style={{ ...styles.label, color: '#991b1b', fontWeight: 'bold' }}>
                Discount Amount:
              </span>
              <span style={{ ...styles.amount, color: '#b91c1c' }}>
                - {formatCurr(numericDiscAmt)}
              </span>
            </div>
          </>
        )}

        {/* Taxable Bill Amount (Net after discount) */}
        <div style={{ ...styles.item, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <span style={{ ...styles.label, color: '#0f172a', fontWeight: '700' }}>Taxable Bill Amt:</span>
          <span style={{ ...styles.amount, color: '#0f172a', fontWeight: '800' }}>{formatCurr(numericBillAmt)}</span>
        </div>

        {/* Exempt Amount (if any exempt/nil-rated items exist) */}
        {numericExemptAmt > 0 && (
          <div style={{ ...styles.item, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ ...styles.label, color: '#166534', fontWeight: '700' }}>Exempt Amount:</span>
            <span style={{ ...styles.amount, color: '#166534', fontWeight: '800' }}>{formatCurr(numericExemptAmt)}</span>
          </div>
        )}
        {numericNilRatedAmt > 0 && (
          <div style={{ ...styles.item, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ ...styles.label, color: '#166534', fontWeight: '700' }}>Nil Rated Amount:</span>
            <span style={{ ...styles.amount, color: '#166534', fontWeight: '800' }}>{formatCurr(numericNilRatedAmt)}</span>
          </div>
        )}
        {numericZeroRatedAmt > 0 && (
          <div style={{ ...styles.item, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ ...styles.label, color: '#166534', fontWeight: '700' }}>Zero Rated Amount:</span>
            <span style={{ ...styles.amount, color: '#166534', fontWeight: '800' }}>{formatCurr(numericZeroRatedAmt)}</span>
          </div>
        )}
        {numericNonGstAmt > 0 && (
          <div style={{ ...styles.item, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ ...styles.label, color: '#166534', fontWeight: '700' }}>Non-GST Amount:</span>
            <span style={{ ...styles.amount, color: '#166534', fontWeight: '800' }}>{formatCurr(numericNonGstAmt)}</span>
          </div>
        )}
        {numericWithoutTaxAmt > 0 && (
          <div style={{ ...styles.item, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ ...styles.label, color: '#166534', fontWeight: '700' }}>Without Tax Amount:</span>
            <span style={{ ...styles.amount, color: '#166534', fontWeight: '800' }}>{formatCurr(numericWithoutTaxAmt)}</span>
          </div>
        )}

        {/* Tax % and Split */}
        {!isWithoutTax && (
          <div style={{ ...styles.item, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <span style={{ ...styles.label, color: '#1e40af', fontWeight: 'bold' }}>
              Tax Rate %:
            </span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1d4ed8' }}>
              {displayedRateSummaries.length > 0 ? (
                displayedRateSummaries.map((rs, i) => {
                  const r = parseFloat(rs.gstRate || rs.tax_rate || 0);
                  const half = (r / 2).toFixed(1).replace(/\.0$/, '');
                  const rateLabel = r > 0
                    ? (isInterState ? `${r}% (IGST ${r}%)` : `${r}% (${half}% + ${half}%)`)
                    : `0% (${rs.taxType || 'Exempt'})`;
                  return (
                    <span key={i} style={{ marginRight: '6px' }}>
                      {rateLabel}
                    </span>
                  );
                })
              ) : (
                numericTaxPercent > 0 ? (
                  isInterState ? `${numericTaxPercent}% (IGST ${numericTaxPercent}%)` : `${numericTaxPercent}% (${halfRate}% + ${halfRate}%)`
                ) : '0% (Exempt)'
              )}
            </span>
          </div>
        )}

        {/* CGST & SGST or IGST details */}
        {!isWithoutTax && !isInterState && (
          <>
            <div style={styles.item}>
              <span style={styles.label}>
                CGST {numericTaxPercent > 0 ? `(${halfRate}%)` : ''}:
              </span>
              <span style={{ ...styles.amount, color: '#0369a1' }}>
                {formatCurr(effectiveCgst)}
              </span>
            </div>

            <div style={styles.item}>
              <span style={styles.label}>
                SGST {numericTaxPercent > 0 ? `(${halfRate}%)` : ''}:
              </span>
              <span style={{ ...styles.amount, color: '#0369a1' }}>
                {formatCurr(effectiveSgst)}
              </span>
            </div>
          </>
        )}

        {!isWithoutTax && isInterState && (
          <div style={styles.item}>
            <span style={styles.label}>
              IGST {numericTaxPercent > 0 ? `(${numericTaxPercent}%)` : ''}:
            </span>
            <span style={{ ...styles.amount, color: '#0369a1' }}>
              {formatCurr(effectiveIgst)}
            </span>
          </div>
        )}

        {/* Total Tax Amount */}
        <div style={styles.item}>
          <span style={styles.label}>Total Tax Amount:</span>
          <span style={{ ...styles.amount, color: '#0284c7' }}>
            {formatCurr(numericTaxAmt)}
          </span>
        </div>

        {/* Deductions & ED% if any */}
        {(parseFloat(deductionsAmt) !== 0 || Boolean(deductionPercent) || Boolean(edPercent)) && (
          <>
            {Boolean(deductionPercent) && (
              <div style={{ ...styles.item, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ ...styles.label, color: '#991b1b', fontWeight: 'bold' }}>
                  Deduction %:
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c' }}>
                  {deductionPercent}%
                </span>
              </div>
            )}

            {Boolean(edPercent) && (
              <div style={{ ...styles.item, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ ...styles.label, color: '#991b1b', fontWeight: 'bold' }}>
                  ED %:
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c' }}>
                  {edPercent}%
                </span>
              </div>
            )}

            {parseFloat(deductionsAmt) !== 0 && (
              <div style={{ ...styles.item, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ ...styles.label, color: '#991b1b', fontWeight: 'bold' }}>
                  Deduction / Addition Amount:
                </span>
                <span style={{ ...styles.amount, color: parseFloat(deductionsAmt) > 0 ? '#dc2626' : '#16a34a' }}>
                  {formatCurr(Math.abs(deductionsAmt || 0))}
                </span>
              </div>
            )}
          </>
        )}

        {/* Net Payable / Grand Total */}
        <div style={{ ...styles.item, backgroundColor: '#1e3a8a', color: '#ffffff', gridColumn: 'span 2' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffffff' }}>
            Grand Total (Net Payable):
          </span>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#ffffff' }}>
            {formatCurr(numericGrandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#ffffff',
    border: '2px solid #93c5fd',
    borderRadius: '8px',
    padding: '16px 20px',
    margin: '14px 0',
    boxShadow: '0 2px 4px rgba(30, 58, 138, 0.06)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #dbeafe',
    paddingBottom: '8px',
    marginBottom: '12px'
  },
  title: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#1e3a8a',
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  },
  badge: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '12px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px'
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569'
  },
  amount: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#1e293b'
  }
};

export default EntryTaxBillDetails;
