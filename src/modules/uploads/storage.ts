import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";

const KEY_PATTERN = /^[a-f0-9]{32}\.xlsx$/;

export function newStorageKey(): string {
  return `${randomBytes(16).toString("hex")}.xlsx`;
}

export function assertStorageKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error("Kunci penyimpanan tidak valid.");
}

function location(key: string): string {
  assertStorageKey(key);
  return path.join(getEnv().STORAGE_DIR, key);
}

/** The original workbook is written once. The key is random, never the uploader's filename. */
export async function storeOriginal(key: string, bytes: Uint8Array): Promise<void> {
  const target = location(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}

export async function readOriginal(key: string): Promise<Buffer> {
  return readFile(location(key));
}

export async function removeOriginal(key: string): Promise<void> {
  try {
    await unlink(location(key));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
