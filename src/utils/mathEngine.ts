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

  // Step 2: Target Taxable Amount: Target Total / 1.03
  const targetTaxable = targetTotal / 1.03;

  // Step 3: Calculate New Rate to 4 decimal places for internal accuracy
  const newRate = Number((targetTaxable / totalWeightInGrams).toFixed(4));

  // Step 4: Test the Math (The Precision Check)
  // We test if calculating forward with newRate (rounded to 2 decimals for transactions)
  // and 0 discount equals the Target Total.
  const testRate = toFixed2(newRate);
  
  // Calculate raw test grand total
  let testSubtotal = 0;
  items.forEach(item => {
    testSubtotal = toFixed2(testSubtotal + toFixed2(item.weightInGrams * testRate));
  });
  let testCgst = 0;
  let testSgst = 0;
  let testIgst = 0;
  if (isLocal) {
    testCgst = toFixed2(testSubtotal * 0.015);
    testSgst = toFixed2(testSubtotal * 0.015);
  } else {
    testIgst = toFixed2(testSubtotal * 0.03);
  }
  const testRawGrandTotal = toFixed2(testSubtotal + testCgst + testSgst + testIgst);
  const testPayableAmount = Math.ceil(testRawGrandTotal);

  // Check if test matches Target Total
  if (testPayableAmount === targetTotal) {
    // Situation 1: Matches perfectly with positive round off. No adjustment needed.
    return {
      updatedItems: items.map((item) => ({ id: item.id, ratePerGram: testRate })),
      discountApplied: 0,
    };
  } else {
    // Situation 2: Mismatch Fix (intervene)
    // 1. Step the rate up slightly (ceil rate * 100 / 100)
    const adjustedRate = toFixed2(Math.ceil(newRate * 100) / 100);
    
    // 2. New Subtotal based on adjusted rate
    let newSubtotal = 0;
    items.forEach(item => {
      newSubtotal = toFixed2(newSubtotal + toFixed2(item.weightInGrams * adjustedRate));
    });
    
    // 3. To hit the exact targetTotal after positive round off, the rawGrandTotal must be <= targetTotal and > targetTotal - 1
    // We aim for exactly targetTotal / 1.03
    const discountBoxValue = toFixed2(newSubtotal - targetTaxable);

    return {
      updatedItems: items.map((item) => ({ id: item.id, ratePerGram: adjustedRate })),
      discountApplied: discountBoxValue,
    };
  }
}
