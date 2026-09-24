const PAISA_PER_RUPEE = 100;

const wholeRupees = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const rupeesWithPaisa = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an integer paisa amount for display, e.g. 249900 -> "Rs. 2,499".
 * Uses South Asian (lakh) grouping as in the references: "Rs. 1,24,580".
 * Paisa are shown only when the amount is not a whole rupee.
 */
export function formatNpr(paisa: number): string {
  if (!Number.isSafeInteger(paisa)) {
    throw new TypeError(`formatNpr expects integer paisa, received ${paisa}`);
  }

  const sign = paisa < 0 ? "-" : "";
  const absolutePaisa = Math.abs(paisa);
  const rupees = Math.trunc(absolutePaisa / PAISA_PER_RUPEE);
  const remainder = absolutePaisa % PAISA_PER_RUPEE;

  const formatted =
    remainder === 0
      ? wholeRupees.format(rupees)
      : rupeesWithPaisa.format(absolutePaisa / PAISA_PER_RUPEE);

  return `${sign}Rs. ${formatted}`;
}
