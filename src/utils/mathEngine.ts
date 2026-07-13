/**
 * Enforces strict 2-decimal math at every operational step.
 */
export function toFixed2(value: number): number {
  return Number(Number(value).toFixed(2));
}

export function toFixed3(value: number): number {
  return Number(Number(value).toFixed(3));
}

export interface CalculationResult {
  totalTaxableBeforeDiscount: number;
  discountApplied: number;
  totalTaxableAfterDiscount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  rawGrandTotal: number;
  payableAmount: number;
}

/**
 * Standard Forward Math Execution.
 * All operations must enforce strict 2-decimal math.
 */
export function calculateInvoiceTotals(
  items: { weightInGrams: number; ratePerGram: number }[],
  discount: number,
  isLocal: boolean // true if Profile stateCode === Customer stateCode
): CalculationResult {
  // 1. Item Taxable Amount: weight * rate (enforce 2 decimals for each)
  let totalTaxableBeforeDiscount = 0;
  items.forEach((item) => {
    const itemTaxable = toFixed2(item.weightInGrams * item.ratePerGram);
    totalTaxableBeforeDiscount = toFixed2(totalTaxableBeforeDiscount + itemTaxable);
  });

  // 2. Apply Discount (if any)
  const discountApplied = toFixed2(discount);
  const totalTaxableAfterDiscount = toFixed2(totalTaxableBeforeDiscount - discountApplied);

  // 3. GST State Check & Calculation
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const cgstPercent = isLocal ? 1.5 : 0;
  const sgstPercent = isLocal ? 1.5 : 0;
  const igstPercent = isLocal ? 0 : 3.0;

  if (isLocal) {
    cgst = toFixed2(totalTaxableAfterDiscount * 0.015);
    sgst = toFixed2(totalTaxableAfterDiscount * 0.015);
  } else {
    igst = toFixed2(totalTaxableAfterDiscount * 0.03);
  }

  // 4. Raw Grand Total: Taxable + GST
  const rawGrandTotal = toFixed2(totalTaxableAfterDiscount + cgst + sgst + igst);

  // 5. Payable Amount: always positive round off (ceiling)
  const payableAmount = Math.ceil(rawGrandTotal);

  return {
    totalTaxableBeforeDiscount,
    discountApplied,
    totalTaxableAfterDiscount,
    cgst,
    sgst,
    igst,
    cgstPercent,
    sgstPercent,
    igstPercent,
    rawGrandTotal,
    payableAmount,
  };
}

/**
 * Situation 1 & 2: The Reverse Calculation Override (CRITICAL ALGORITHM)
 * Resolves a flat Target Total back to item rate and line-item discount.
 */
export function applyReverseCalculation(
  targetTotal: number,
  items: { id: string; weightInGrams: number }[],
  isLocal: boolean
): {
  updatedItems: { id: string; ratePerGram: number }[];
  discountApplied: number;
} {
  const totalWeightInGrams = items.reduce((sum, item) => sum + item.weightInGrams, 0);
  if (totalWeightInGrams <= 0) {
    return {
      updatedItems: items.map((item) => ({ id: item.id, ratePerGram: 0 })),
      discountApplied: 0,
    };
  }

  // Target Taxable Amount: Target Total / 1.03
  const targetTaxable = targetTotal / 1.03;
  const exactRate = targetTaxable / totalWeightInGrams;

  // Helper to test if a given 2-decimal rate hits the target exactly without discount
  const testExactRate = (rateToTest: number): boolean => {
    let subtotal = 0;
    items.forEach(item => {
      subtotal = toFixed2(subtotal + toFixed2(item.weightInGrams * rateToTest));
    });
    let cgst = 0, sgst = 0, igst = 0;
    if (isLocal) {
      cgst = toFixed2(subtotal * 0.015);
      sgst = toFixed2(subtotal * 0.015);
    } else {
      igst = toFixed2(subtotal * 0.03);
    }
    const rawTotal = toFixed2(subtotal + cgst + sgst + igst);
    return Math.ceil(rawTotal) === targetTotal;
  };

  // Smart Rate Finder: Test rates around the mathematical exact rate (e.g. +/- 0.05)
  // We check in order of proximity to exactRate.
  const baseRate = Math.floor(exactRate * 100) / 100; // Floor to 2 decimals
  const offsets = [
    0, 0.01, -0.01, 0.02, -0.02, 0.03, -0.03, 
    0.04, -0.04, 0.05, -0.05, 0.06, -0.06, 0.07, -0.07
  ];

  let perfectRate: number | null = null;
  for (const offset of offsets) {
    const rateToTest = toFixed2(baseRate + offset);
    if (rateToTest > 0 && testExactRate(rateToTest)) {
      perfectRate = rateToTest;
      break;
    }
  }

  // If a perfect rate was found that requires NO discount
  if (perfectRate !== null) {
    return {
      updatedItems: items.map((item) => ({ id: item.id, ratePerGram: perfectRate! })),
      discountApplied: 0,
    };
  }

  // Fallback: If no perfect rate exists due to granularity limits, use ceil and calculate a tiny discount
  const adjustedRate = toFixed2(Math.ceil(exactRate * 100) / 100);
  
  let newSubtotal = 0;
  items.forEach(item => {
    newSubtotal = toFixed2(newSubtotal + toFixed2(item.weightInGrams * adjustedRate));
  });
  
  // We aim for exactly targetTotal / 1.03
  const discountBoxValue = Math.max(0, toFixed2(newSubtotal - targetTaxable));

  return {
    updatedItems: items.map((item) => ({ id: item.id, ratePerGram: adjustedRate })),
    discountApplied: discountBoxValue,
  };
}
