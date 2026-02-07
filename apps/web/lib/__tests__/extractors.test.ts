import { describe, it, expect } from "vitest";
import { resolveExtractor } from "../extractors/index";
import { extractJsonArray } from "../extractors/pdf";

describe("resolveExtractor", () => {
  it("returns a PdfExtractor for '.pdf'", () => {
    const extractor = resolveExtractor(".pdf");
    expect(extractor).not.toBeNull();
    expect(extractor!.source).toBe("PDF");
  });

  it("returns a PdfExtractor for 'application/pdf'", () => {
    const extractor = resolveExtractor("application/pdf");
    expect(extractor).not.toBeNull();
    expect(extractor!.source).toBe("PDF");
  });

  it("is case-insensitive", () => {
    expect(resolveExtractor(".PDF")).not.toBeNull();
    expect(resolveExtractor("APPLICATION/PDF")).not.toBeNull();
  });

  it("returns null for unsupported file types", () => {
    expect(resolveExtractor(".csv")).toBeNull();
    expect(resolveExtractor(".xlsx")).toBeNull();
    expect(resolveExtractor("text/plain")).toBeNull();
  });
});

describe("extractJsonArray", () => {
  it("extracts a JSON array from text containing one", () => {
    const text = 'Here are the results: [{"date":"2024-01-01","description":"Test","amount":"10"}]';
    const result = extractJsonArray(text);
    expect(result).toEqual([{ date: "2024-01-01", description: "Test", amount: "10" }]);
  });

  it("returns null when no array is found", () => {
    expect(extractJsonArray("no array here")).toBeNull();
  });

  it("returns null for invalid JSON inside brackets", () => {
    expect(extractJsonArray("[not valid json}")).toBeNull();
  });

  it("extracts an empty array", () => {
    expect(extractJsonArray("Result: []")).toEqual([]);
  });

  it("extracts array even with surrounding text", () => {
    const text = `
      Some preamble text.
      [{"date":"2024-01-01","description":"Coffee","amount":"-5.50"}]
      Some trailing text.
    `;
    const result = extractJsonArray(text);
    expect(result).toHaveLength(1);
    expect(result![0].description).toBe("Coffee");
  });

  it("handles multiline JSON arrays", () => {
    const text = `[
      {"date":"2024-01-01","description":"Item 1","amount":"10"},
      {"date":"2024-01-02","description":"Item 2","amount":"20"}
    ]`;
    const result = extractJsonArray(text);
    expect(result).toHaveLength(2);
  });

  it("returns null for non-array JSON (object)", () => {
    expect(extractJsonArray('{"key": "value"}')).toBeNull();
  });
});
