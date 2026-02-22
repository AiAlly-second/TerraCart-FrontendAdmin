/**
 * Unit Conversion Utilities for Costing V2
 * Formats quantities with proper unit conversion for display
 */

const UNIT_CONVERSIONS = {
  // Weight conversions (to grams as base)
  kg: { base: "g", factor: 1000, displayName: "kg" },
  g: { base: "g", factor: 1, displayName: "g" },
  
  // Volume conversions (to ml as base)
  l: { base: "ml", factor: 1000, displayName: "l" },
  ml: { base: "ml", factor: 1, displayName: "ml" },
  
  // Count-based (default 1:1 with pcs unless customized elsewhere)
  pcs: { base: "pcs", factor: 1, displayName: "pcs" },
  pack: { base: "pcs", factor: 1, displayName: "pack" },
  box: { base: "pcs", factor: 1, displayName: "box" },
  bottle: { base: "pcs", factor: 1, displayName: "bottle" },
  dozen: { base: "pcs", factor: 12, displayName: "dozen" },
};

/**
 * Convert quantity from one unit to another
 * @param {Number} qty - Quantity to convert
 * @param {String} fromUom - Source unit
 * @param {String} toUom - Target unit
 * @returns {Number} Converted quantity
 */
export function convertUnit(qty, fromUom, toUom) {
  if (fromUom === toUom) return qty;

  const from = UNIT_CONVERSIONS[fromUom];
  const to = UNIT_CONVERSIONS[toUom];

  if (!from || !to) {
    throw new Error(`Unknown unit: ${fromUom} or ${toUom}`);
  }

  // If same base unit, convert directly
  if (from.base === to.base) {
    return (qty * from.factor) / to.factor;
  }

  // Cannot convert between different base types (weight vs volume vs count)
  throw new Error(`Cannot convert from ${fromUom} (${from.base}) to ${toUom} (${to.base})`);
}

/**
 * Format quantity with proper unit conversion for display
 * Automatically converts to the most appropriate unit
 * @param {Number} qty - Quantity to format
 * @param {String} currentUom - Current unit of the quantity
 * @param {Object} options - Formatting options
 * @param {Number} options.decimals - Number of decimal places (default: 2)
 * @param {Boolean} options.autoConvert - Whether to auto-convert to best unit (default: true)
 * @returns {String} Formatted string like "1.5 kg" or "500 g"
 */
export function formatUnit(qty, currentUom, options = {}) {
  const { decimals = 2, autoConvert = true } = options;
  
  if (qty === null || qty === undefined || isNaN(qty)) {
    return `0.00 ${currentUom}`;
  }

  const qtyNum = parseFloat(qty);
  if (qtyNum === 0) {
    return `0.00 ${currentUom}`;
  }

  // If auto-convert is disabled, just format with current unit
  if (!autoConvert) {
    return `${qtyNum.toFixed(decimals)} ${currentUom}`;
  }

  const currentUnit = UNIT_CONVERSIONS[currentUom];
  if (!currentUnit) {
    // Unknown unit, return as-is
    return `${qtyNum.toFixed(decimals)} ${currentUom}`;
  }

  // For count-based units, no conversion needed
  if (currentUnit.base === "pcs" || currentUnit.base === "pack" || 
      currentUnit.base === "box" || currentUnit.base === "bottle") {
    return `${qtyNum.toFixed(decimals)} ${currentUom}`;
  }

  // For dozen, convert to pcs if appropriate
  if (currentUom === "dozen") {
    const pcsValue = qtyNum * 12;
    if (pcsValue >= 12 && pcsValue % 12 === 0) {
      // If it's a whole number of dozens, show as dozen
      return `${qtyNum.toFixed(decimals)} dozen`;
    } else if (pcsValue >= 12) {
      // Show as dozen with remainder in pcs
      const dozens = Math.floor(pcsValue / 12);
      const remainderPcs = pcsValue % 12;
      if (remainderPcs === 0) {
        return `${dozens.toFixed(decimals)} dozen`;
      }
      return `${dozens.toFixed(0)} dozen ${remainderPcs.toFixed(0)} pcs`;
    } else {
      // Less than a dozen, show as pcs
      return `${pcsValue.toFixed(decimals)} pcs`;
    }
  }

  // For weight units (kg/g)
  if (currentUnit.base === "g") {
    // Convert to kg if >= 1000g, otherwise show in g
    if (qtyNum >= 1000) {
      const kgValue = convertUnit(qtyNum, currentUom, "kg");
      return `${kgValue.toFixed(decimals)} kg`;
    } else if (currentUom === "kg" && qtyNum < 1) {
      // If in kg but less than 1, convert to g
      const gValue = convertUnit(qtyNum, currentUom, "g");
      return `${gValue.toFixed(decimals)} g`;
    } else {
      // Show in current unit
      return `${qtyNum.toFixed(decimals)} ${currentUom}`;
    }
  }

  // For volume units (l/ml)
  if (currentUnit.base === "ml") {
    // Convert to l if >= 1000ml, otherwise show in ml
    if (qtyNum >= 1000) {
      const lValue = convertUnit(qtyNum, currentUom, "l");
      return `${lValue.toFixed(decimals)} l`;
    } else if (currentUom === "l" && qtyNum < 1) {
      // If in l but less than 1, convert to ml
      const mlValue = convertUnit(qtyNum, currentUom, "ml");
      return `${mlValue.toFixed(decimals)} ml`;
    } else {
      // Show in current unit
      return `${qtyNum.toFixed(decimals)} ${currentUom}`;
    }
  }

  // Fallback: return as-is
  return `${qtyNum.toFixed(decimals)} ${currentUom}`;
}

/**
 * Format quantity with unit, showing both original and converted if different
 * @param {Number} qty - Quantity to format
 * @param {String} currentUom - Current unit
 * @param {Object} options - Formatting options
 * @returns {String} Formatted string with conversion if applicable
 */
export function formatUnitWithConversion(qty, currentUom, options = {}) {
  const { decimals = 2 } = options;
  
  if (qty === null || qty === undefined || isNaN(qty)) {
    return `0.00 ${currentUom}`;
  }

  const qtyNum = parseFloat(qty);
  if (qtyNum === 0) {
    return `0.00 ${currentUom}`;
  }

  const currentUnit = UNIT_CONVERSIONS[currentUom];
  if (!currentUnit) {
    return `${qtyNum.toFixed(decimals)} ${currentUom}`;
  }

  // For weight units
  if (currentUnit.base === "g") {
    if (currentUom === "g" && qtyNum >= 1000) {
      const kgValue = convertUnit(qtyNum, "g", "kg");
      return `${qtyNum.toFixed(decimals)} g (${kgValue.toFixed(decimals)} kg)`;
    } else if (currentUom === "kg" && qtyNum < 1) {
      const gValue = convertUnit(qtyNum, "kg", "g");
      return `${qtyNum.toFixed(decimals)} kg (${gValue.toFixed(decimals)} g)`;
    }
  }

  // For volume units
  if (currentUnit.base === "ml") {
    if (currentUom === "ml" && qtyNum >= 1000) {
      const lValue = convertUnit(qtyNum, "ml", "l");
      return `${qtyNum.toFixed(decimals)} ml (${lValue.toFixed(decimals)} l)`;
    } else if (currentUom === "l" && qtyNum < 1) {
      const mlValue = convertUnit(qtyNum, "l", "ml");
      return `${qtyNum.toFixed(decimals)} l (${mlValue.toFixed(decimals)} ml)`;
    }
  }

  // For dozen
  if (currentUom === "dozen") {
    const pcsValue = qtyNum * 12;
    return `${qtyNum.toFixed(decimals)} dozen (${pcsValue.toFixed(decimals)} pcs)`;
  }

  // No conversion needed
  return `${qtyNum.toFixed(decimals)} ${currentUom}`;
}

/**
 * Get conversion factor between two units
 * @param {String} fromUom - Source unit
 * @param {String} toUom - Target unit
 * @returns {Number} Conversion factor
 */
export function getConversionFactor(fromUom, toUom) {
  if (fromUom === toUom) return 1;
  return convertUnit(1, fromUom, toUom);
}

/**
 * Check if two units are compatible (same base type)
 * @param {String} uom1 - First unit
 * @param {String} uom2 - Second unit
 * @returns {Boolean} True if compatible
 */
export function areUnitsCompatible(uom1, uom2) {
  if (uom1 === uom2) return true;
  
  const unit1 = UNIT_CONVERSIONS[uom1];
  const unit2 = UNIT_CONVERSIONS[uom2];
  
  if (!unit1 || !unit2) return false;
  
  return unit1.base === unit2.base;
}

