import { describe, expect, it } from "vitest";
import { inspectWorkbook } from "./inspect";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function header(name: string, compressed = 1, uncompressed = 1): Buffer {
  const fileName = Buffer.from(name);
  const bytes = Buffer.alloc(30 + fileName.length + compressed);
  bytes.writeUInt32LE(0x04034b50, 0);
  bytes.writeUInt32LE(compressed, 18);
  bytes.writeUInt32LE(uncompressed, 22);
  bytes.writeUInt16LE(fileName.length, 26);
  fileName.copy(bytes, 30);
  return bytes;
}

describe("workbook inspection", () => {
  it("rejects macros, the wrong extension, and an oversized claimed zip entry", () => {
    expect(inspectWorkbook({ filename: "a.xlsm", mime, bytes: new Uint8Array([1]) }).ok).toBe(false);
    expect(inspectWorkbook({ filename: "a.xlsx", mime: "text/plain", bytes: new Uint8Array([1, 2, 3, 4]) }).ok).toBe(false);
    const bomb = header("sheet.xml", 10, 5000);
    bomb.write("[Content_Types].xml", "utf8");
    const result = inspectWorkbook({ filename: "a.xlsx", mime, bytes: bomb });
    expect(result.ok).toBe(false);
  });
});
