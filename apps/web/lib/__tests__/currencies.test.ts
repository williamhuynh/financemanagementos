import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_CONFIG,
  getLocaleForCurrency,
  getCurrencyName,
  getCurrencyUnitPlural,
  isSupportedCurrency,
} from "../currencies";

describe("SUPPORTED_CURRENCIES", () => {
  it("contains exactly the 5 expected currency codes", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["AUD", "NZD", "USD", "GBP", "EUR"]);
  });
});

describe("getLocaleForCurrency", () => {
  it("returns en-AU for AUD", () => {
    expect(getLocaleForCurrency("AUD")).toBe("en-AU");
  });

  it("returns en-NZ for NZD", () => {
    expect(getLocaleForCurrency("NZD")).toBe("en-NZ");
  });

  it("returns en-US for USD", () => {
    expect(getLocaleForCurrency("USD")).toBe("en-US");
  });

  it("returns en-GB for GBP", () => {
    expect(getLocaleForCurrency("GBP")).toBe("en-GB");
  });

  it("returns en-IE for EUR", () => {
    expect(getLocaleForCurrency("EUR")).toBe("en-IE");
  });

  it("returns en-AU for unknown currency", () => {
    expect(getLocaleForCurrency("CAD")).toBe("en-AU");
    expect(getLocaleForCurrency("JPY")).toBe("en-AU");
  });
});

describe("getCurrencyName", () => {
  it("returns human-readable name for each supported currency", () => {
    expect(getCurrencyName("AUD")).toBe("Australian Dollar");
    expect(getCurrencyName("NZD")).toBe("New Zealand Dollar");
    expect(getCurrencyName("USD")).toBe("US Dollar");
    expect(getCurrencyName("GBP")).toBe("British Pound");
    expect(getCurrencyName("EUR")).toBe("Euro");
  });

  it("returns the code itself for unknown currencies", () => {
    expect(getCurrencyName("CAD")).toBe("CAD");
    expect(getCurrencyName("JPY")).toBe("JPY");
  });
});

describe("isSupportedCurrency", () => {
  it("returns true for all 5 supported currencies", () => {
    expect(isSupportedCurrency("AUD")).toBe(true);
    expect(isSupportedCurrency("NZD")).toBe(true);
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("GBP")).toBe(true);
    expect(isSupportedCurrency("EUR")).toBe(true);
  });

  it("returns false for unsupported currencies", () => {
    expect(isSupportedCurrency("CAD")).toBe(false);
    expect(isSupportedCurrency("JPY")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });
});

describe("getCurrencyUnitPlural", () => {
  it("returns dollars for dollar currencies", () => {
    expect(getCurrencyUnitPlural("AUD")).toBe("dollars");
    expect(getCurrencyUnitPlural("NZD")).toBe("dollars");
    expect(getCurrencyUnitPlural("USD")).toBe("dollars");
  });

  it("returns pounds for GBP", () => {
    expect(getCurrencyUnitPlural("GBP")).toBe("pounds");
  });

  it("returns euros for EUR", () => {
    expect(getCurrencyUnitPlural("EUR")).toBe("euros");
  });

  it("returns dollars for unknown currencies", () => {
    expect(getCurrencyUnitPlural("CAD")).toBe("dollars");
  });
});

describe("CURRENCY_CONFIG", () => {
  it("has entries for all supported currencies", () => {
    for (const code of SUPPORTED_CURRENCIES) {
      expect(CURRENCY_CONFIG[code]).toBeDefined();
      expect(CURRENCY_CONFIG[code].name).toBeTruthy();
      expect(CURRENCY_CONFIG[code].symbol).toBeTruthy();
      expect(CURRENCY_CONFIG[code].locale).toBeTruthy();
    }
  });
});
