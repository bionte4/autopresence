const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_UNCOMPRESSED = 30 * 1024 * 1024;
const LOCAL_HEADER = 0x04034b50;

const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export type InspectFailure = { ok: false; error: string };
export type InspectSuccess = { ok: true };

export function inspectWorkbook(input: { filename: string; mime: string; bytes: Uint8Array }): InspectSuccess | InspectFailure {
  const filename = input.filename.trim().toLowerCase();
  if (filename.endsWith(".xlsm") || filename.endsWith(".xlsb")) {
    return { ok: false, error: "Berkas makro tidak diterima." };
  }
  if (!filename.endsWith(".xlsx")) {
    return { ok: false, error: "Hanya berkas .xlsx yang diterima." };
  }
  if (!ALLOWED_MIME.has(input.mime)) {
    return { ok: false, error: "Jenis berkas tidak diterima." };
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: "Ukuran berkas harus antara 1 byte dan 10 MB." };
  }
  const buffer = Buffer.from(input.bytes);
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== LOCAL_HEADER) {
    return { ok: false, error: "Berkas bukan workbook Excel." };
  }
  if (!buffer.includes(Buffer.from("[Content_Types].xml"))) {
    return { ok: false, error: "Berkas Excel tidak lengkap." };
  }
  return walkZip(buffer);
}

function walkZip(buffer: Buffer): InspectSuccess | InspectFailure {
  let offset = 0;
  let entries = 0;
  let uncompressed = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== LOCAL_HEADER) break;
    const flags = buffer.readUInt16LE(offset + 6);
    const compressed = buffer.readUInt32LE(offset + 18);
    const rawSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength > buffer.length) return { ok: false, error: "Struktur berkas rusak." };
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8").toLowerCase();
    if (name.endsWith("vbaproject.bin")) return { ok: false, error: "Berkas makro tidak diterima." };
    entries += 1;
    uncompressed += rawSize;
    if (entries > MAX_ENTRIES || uncompressed > MAX_UNCOMPRESSED) {
      return { ok: false, error: "Isi berkas melebihi batas yang diizinkan." };
    }
    if (rawSize > 0 && compressed > 0 && rawSize / compressed > 100) {
      return { ok: false, error: "Isi berkas melebihi batas yang diizinkan." };
    }
    if ((flags & 0x08) !== 0 && compressed === 0) {
      return { ok: false, error: "Ukuran isi berkas tidak dapat diperiksa." };
    }
    offset = nameEnd + extraLength + compressed;
  }
  if (entries === 0) return { ok: false, error: "Berkas bukan workbook Excel." };
  return { ok: true };
}
