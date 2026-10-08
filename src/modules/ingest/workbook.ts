import { read, utils } from "xlsx";
import type { SheetGrid } from "./parser/types";

export type NamedSheet = { name: string; cells: SheetGrid };

/** Turns a workbook into text grids. Parsing rules stay in the pure parser and never read the file themselves. */
export function sheetsFromWorkbook(data: Uint8Array): NamedSheet[] {
  const workbook = read(data, { type: "array", cellDates: false });
  return workbook.SheetNames.map((name) => {
    const rows = utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" }) as unknown[][];
    return {
      name,
      cells: rows.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : [])),
    };
  });
}
