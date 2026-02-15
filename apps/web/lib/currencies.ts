export const SUPPORTED_CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; locale: string }> = {
  AUD: { name: "Australian Dollar", symbol: "$", locale: "en-AU" },
  NZD: { name: "New Zealand Dollar", symbol: "$", locale: "en-NZ" },
  USD: { name: "US Dollar", symbol: "$", locale: "en-US" },
  GBP: { name: "British Pound", symbol: "£", locale: "en-GB" },
  EUR: { name: "Euro", symbol: "€", locale: "en-IE" },
};

export function getLocaleForCurrency(currency: string): string {
  const config = CURRENCY_CONFIG[currency as SupportedCurrency];
  return config?.locale ?? "en-AU";
}

export function getCurrencyName(currency: string): string {
  const config = CURRENCY_CONFIG[currency as SupportedCurrency];
  return config?.name ?? currency;
}

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
}
