// Single source of truth for converting weight-master dropdown names into KG per-unit.
// NOTE: Weight master dropdown still stores weight_id for DB relations.
//       All calculations must use parseWeight(weightName), never DB ids.

export function parseWeight(weightName) {
  if (!weightName) return 0;

  // Expected formats (future-ready):
  // - "50 KG"  -> 50
  // - "500 GM" -> 0.5
  // - "1 GM"   -> 0.001
  // - future: MG, TON, LTR, ML
  const [value, unit] = String(weightName).trim().split(/\s+/);
  const numericValue = parseFloat(value);

  if (Number.isNaN(numericValue)) return 0;

  switch ((unit || '').toUpperCase()) {
    case 'KG':
      return numericValue;

    case 'GM':
      return numericValue / 1000;

    // Future-ready placeholders (safe defaults = treat as KG-equivalent if unknown)
    case 'MG':
      return numericValue / 1_000_000;

    // 1 TON = 1000 KG
    case 'TON':
      return numericValue * 1000;

    // If weight master later uses these units for mass/volume conversions,
    // they must be implemented here with the correct domain-specific ratios.
    case 'LTR':
    case 'ML':
      // No conversion ratio available in current requirements.
      // Returning numericValue as-is preserves backward compatibility.
      return numericValue;

    default:
      // If unit is missing/unknown, treat the numeric part as KG.
      return numericValue;
  }
}

