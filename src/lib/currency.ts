/**
 * Centralised currency formatting for ML2 EduManager.
 *
 * School-level amounts (scolarité, dépenses, encaissements) are displayed with a
 * short "F" suffix. Subscription/billing amounts pass an ISO currency code; "XOF"
 * is rendered as its common "FCFA" abbreviation, any other code is shown as-is.
 */
export type FormatCurrencyOptions = {
  /**
   * ISO currency code (e.g. "XOF", "EUR"). When provided it is appended as a
   * suffix ("XOF" becomes "FCFA"). When omitted, the short "F" suffix is used.
   */
  currency?: string | null;
};

export function formatCurrency(
  value: number | string | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  const formatted = amount.toLocaleString("fr-FR");

  const { currency } = options;
  if (!currency) return `${formatted} F`;
  const suffix = currency === "XOF" ? "FCFA" : currency;
  return `${formatted} ${suffix}`;
}
