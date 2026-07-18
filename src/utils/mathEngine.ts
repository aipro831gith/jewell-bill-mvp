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

  const cgstPercent = isLocal ? 1.5 : 0;
  const sgstPercent = isLocal ? 1.5 : 0;
  const igstPercent = isLocal ? 0 : 3.0;
  const totalGstPercent = cgstPercent + sgstPercent + igstPercent;
  const gstDivisor = 1 + (totalGstPercent / 100);

  // 1. Base Target
  const targetTaxable = targetTotal / gstDivisor;

  // 2. Base Rate (Standard Round to 2 decimals)
  const exactRate = targetTaxable / totalWeightInGrams;
  const baseRate = toFixed2(exactRate);

  // 3. Simulate Forward Math
  let simulatedSubtotal = 0;
  items.forEach(item => {
    simulatedSubtotal = toFixed2(simulatedSubtotal + toFixed2(item.weightInGrams * baseRate));
  });

  let simulatedGst = 0;
  if (isLocal) {
    simulatedGst = toFixed2(simulatedSubtotal * 0.015) + toFixed2(simulatedSubtotal * 0.015);
  } else {
    simulatedGst = toFixed2(simulatedSubtotal * 0.03);
  }
  const simulatedRawTotal = toFixed2(simulatedSubtotal + simulatedGst);
  const simulatedPayable = Math.ceil(simulatedRawTotal);

  let finalRate = baseRate;
  let discountApplied = 0;

  // 4. Resolution Logic
  if (simulatedPayable === targetTotal) {
    discountApplied = 0;
  } else if (simulatedPayable > targetTotal) {
    // Over-Match
    const difference = simulatedPayable - targetTotal;
    discountApplied = toFixed2(difference / gstDivisor);
  } else {
    // Under-Match (Simulated Payable < Target)
    const shortfall = targetTotal - simulatedPayable;
    const exactRateBump = (shortfall / gstDivisor) / totalWeightInGrams;
    const safeRateBump = Number(exactRateBump.toFixed(6));
    const roundedRateBump = Math.ceil(safeRateBump * 100) / 100;
    
    finalRate = toFixed2(baseRate + roundedRateBump);
    
    // Simulate again with finalRate to find required discount for overshoot
    let newSubtotal = 0;
    items.forEach(item => {
      newSubtotal = toFixed2(newSubtotal + toFixed2(item.weightInGrams * finalRate));
    });
    
    let newGst = 0;
    if (isLocal) {
      newGst = toFixed2(newSubtotal * 0.015) + toFixed2(newSubtotal * 0.015);
    } else {
      newGst = toFixed2(newSubtotal * 0.03);
    }
    const newRawTotal = toFixed2(newSubtotal + newGst);
    const newPayable = Math.ceil(newRawTotal);
    
    const difference = newPayable - targetTotal;
    discountApplied = difference > 0 ? toFixed2(difference / gstDivisor) : 0;
  }

  return {
    updatedItems: items.map((item) => ({ id: item.id, ratePerGram: finalRate })),
    discountApplied,
  };
}
