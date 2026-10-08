import { Prisma, type AnomalyType, type Granularity, type UploadStatus } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const listSelect = {
  id: true,
  originalName: true,
  granularity: true,
  periodStart: true,
  periodEnd: true,
  status: true,
  sizeBytes: true,
  stats: true,
  createdAt: true,
} as const;

export async function listUploads(query: ListQuery, db: Db = prisma) {
  const where: Prisma.UploadWhereInput = query.q
    ? { originalName: { contains: query.q, mode: "insensitive" } }
    : {};
  const orderBy = query.sort === "originalName" ? { originalName: query.direction } : { createdAt: query.direction };
  const total = await db.upload.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.upload.findMany({
    where,
    orderBy,
    select: listSelect,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findUpload(id: string, db: Db = prisma) {
  return db.upload.findUnique({
    where: { id },
    include: {
      anomalies: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function findUploadByHash(sha256: string, db: Db = prisma) {
  return db.upload.findUnique({ where: { sha256 }, select: { id: true, originalName: true } });
}

export async function findUploadByKey(storageKey: string, db: Db = prisma) {
  return db.upload.findUnique({ where: { storageKey }, select: { id: true } });
}

export async function findEmployeesByPins(pins: string[], db: Db = prisma) {
  return db.employee.findMany({
    where: { pin: { in: pins }, deletedAt: null },
    select: { id: true, pin: true, schedule: { select: { lateToleranceMin: true } } },
  });
}

export async function findDefaultSchedule(db: Db = prisma) {
  const seeded = await db.workSchedule.findUnique({ where: { id: "seed-schedule-default" }, select: { id: true } });
  if (seeded) return seeded;
  return db.workSchedule.findFirst({ orderBy: { name: "asc" }, select: { id: true } });
}

export async function insertEmployeeFromReport(db: Db, data: { pin: string; name: string; scheduleId: string }) {
  return db.employee.create({ data, select: { id: true, pin: true, name: true } });
}

export async function listAnomalyRules(db: Db = prisma) {
  return db.anomalyRule.findMany();
}

export async function insertUpload(
  db: Db,
  data: {
    originalName: string;
    storageKey: string;
    sha256: string;
    sizeBytes: number;
    granularity: Granularity;
    periodStart: Date;
    periodEnd: Date;
    status: UploadStatus;
    fileMeta: Prisma.InputJsonValue;
    stats?: Prisma.InputJsonValue;
    uploadedById: string;
  },
) {
  try {
    return await db.upload.create({ data });
  } catch (error) {
    rethrowUnique(error, "Berkas yang sama sudah pernah diunggah.");
  }
}

export async function markUpload(
  db: Db,
  id: string,
  data: { status: UploadStatus; stats: Prisma.InputJsonValue },
) {
  return db.upload.update({ where: { id }, data });
}

export async function findAttendance(db: Db, employeeId: string, date: Date) {
  return db.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date } } });
}

export async function insertAttendance(db: Db, data: Prisma.AttendanceRecordUncheckedCreateInput) {
  return db.attendanceRecord.create({ data });
}

export async function updateAttendance(db: Db, id: string, data: Prisma.AttendanceRecordUncheckedUpdateInput) {
  return db.attendanceRecord.update({ where: { id }, data });
}

export async function insertRevision(
  db: Db,
  data: { recordId: string; before: Prisma.InputJsonValue; after: Prisma.InputJsonValue; reason: string; uploadId: string },
) {
  return db.attendanceRevision.create({ data });
}

export async function findAnomalyByKey(db: Db, dedupeKey: string) {
  return db.anomaly.findUnique({ where: { dedupeKey }, select: { id: true } });
}

export async function insertAnomaly(
  db: Db,
  data: {
    type: AnomalyType;
    severity: Prisma.AnomalyCreateInput["severity"];
    uploadId: string;
    employeeId: string | null;
    date: Date | null;
    message: string;
    details: Prisma.InputJsonValue;
    dedupeKey: string;
  },
) {
  try {
    await db.anomaly.create({ data });
    return "created" as const;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate" as const;
    throw error;
  }
}

export async function insertJob(db: Db, uploadId: string) {
  return db.job.create({
    data: { type: "anomaly.dispatch", payload: { uploadId }, status: "PENDING" },
  });
}
