import { read } from "xlsx";
import type { FileMetadata } from "@/modules/ingest/validator/rules";

export function readWorkbookMeta(bytes: Uint8Array): FileMetadata {
  const workbook = read(bytes, { type: "array", bookProps: true });
  const props = workbook.Props;
  return {
    creator: text(props?.Author),
    lastModifiedBy: text(props?.LastAuthor),
    application: text(props?.Application),
    createdAt: iso(props?.CreatedDate),
    modifiedAt: iso(props?.ModifiedDate),
  };
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function iso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}
