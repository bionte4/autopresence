import { hash } from "argon2";
import { config } from "dotenv";
import { AnomalyType, PrismaClient, Role, Severity } from "@prisma/client";
import { DEFAULT_WORK_SCHEDULE } from "../src/lib/constants";

config({ path: ".env" });
config({ path: ".env.example" });

const prisma = new PrismaClient();

const SEED_USERS: ReadonlyArray<{ email: string; name: string; role: Role }> = [
  { email: "super.admin@local", name: "Super Admin", role: Role.SUPER_ADMIN },
  { email: "hr.admin@local", name: "HR Admin", role: Role.HR_ADMIN },
  { email: "manager@local", name: "Manager Operasional", role: Role.MANAGER },
  { email: "auditor@local", name: "Auditor", role: Role.AUDITOR },
  { email: "employee@local", name: "Pegawai Contoh", role: Role.EMPLOYEE },
];

/** Staff from the BI - DIDD roster. Email is local-only so the seed stays free of real addresses. */
const SEED_STAFF: ReadonlyArray<{ pin: string; name: string }> = [
  { pin: "4370", name: "ANDREA RAHMADANISYA" },
  { pin: "4383", name: "ARIE KURNIAWAN" },
  { pin: "4384", name: "ARSY BAIQ SHAZKYA" },
  { pin: "4520", name: "BILLY TIGO RAMADHAN" },
  { pin: "4382", name: "CAROLUS BENNY DWI SETIAWAN" },
  { pin: "4376", name: "ERNA KARINA" },
  { pin: "4372", name: "FIRZA VENANDA" },
  { pin: "4373", name: "GILANG NURDIA YUSUF" },
  { pin: "4374", name: "M GILANG RIZKY RAMADHAN" },
  { pin: "4371", name: "REZA PRASETYO AJI" },
  { pin: "4519", name: "SANDY KURNIAWAN" },
  { pin: "4369", name: "SOPAN BUKHARI LUBIS" },
  { pin: "4375", name: "UNGGUL AZHARI RAMADHAN" },
];

function staffEmail(name: string): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, ".")}@local`;
}

async function main(): Promise<void> {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error("SEED_PASSWORD must be set and at least 12 characters.");
  }

  const passwordHash = await hash(seedPassword);

  const schedule = await prisma.workSchedule.upsert({
    where: { id: "seed-schedule-default" },
    update: {
      name: DEFAULT_WORK_SCHEDULE.name,
      startMin: DEFAULT_WORK_SCHEDULE.startMin,
      endMin: DEFAULT_WORK_SCHEDULE.endMin,
      lateToleranceMin: DEFAULT_WORK_SCHEDULE.lateToleranceMin,
    },
    create: {
      id: "seed-schedule-default",
      name: DEFAULT_WORK_SCHEDULE.name,
      startMin: DEFAULT_WORK_SCHEDULE.startMin,
      endMin: DEFAULT_WORK_SCHEDULE.endMin,
      lateToleranceMin: DEFAULT_WORK_SCHEDULE.lateToleranceMin,
    },
  });

  const operasional = await prisma.department.upsert({
    where: { name: "Operasional" },
    update: {},
    create: { name: "Operasional" },
  });

  await prisma.department.upsert({
    where: { name: "Keuangan" },
    update: {},
    create: { name: "Keuangan" },
  });

  const didd = await prisma.department.upsert({
    where: { name: "BI - DIDD" },
    update: {},
    create: { name: "BI - DIDD" },
  });

  const bankIndonesia = await prisma.customer.upsert({
    where: { name: "Bank Indonesia" },
    update: { deletedAt: null },
    create: { name: "Bank Indonesia" },
  });
  const diddProject = await prisma.project.upsert({
    where: { customerId_name: { customerId: bankIndonesia.id, name: "DIDD" } },
    update: { deletedAt: null },
    create: { name: "DIDD", customerId: bankIndonesia.id },
  });
  await prisma.department.update({ where: { id: didd.id }, data: { projectId: diddProject.id } });

  for (const staff of SEED_STAFF) {
    const employee = await prisma.employee.upsert({
      where: { pin: staff.pin },
      update: { name: staff.name, departmentId: didd.id, isActive: true, deletedAt: null },
      create: {
        pin: staff.pin,
        name: staff.name,
        departmentId: didd.id,
        scheduleId: schedule.id,
      },
    });
    const email = staffEmail(staff.name);
    await prisma.user.upsert({
      where: { email },
      update: {
        name: staff.name,
        role: Role.EMPLOYEE,
        isActive: true,
        passwordHash,
        employeeId: employee.id,
        deletedAt: null,
      },
      create: {
        email,
        name: staff.name,
        role: Role.EMPLOYEE,
        passwordHash,
        employeeId: employee.id,
      },
    });
  }

  for (const user of SEED_USERS) {
    const managedDepartments =
      user.role === Role.MANAGER ? { set: [{ id: operasional.id }] } : { set: [] };

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        isActive: true,
        passwordHash,
        managedDepartments,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        managedDepartments: user.role === Role.MANAGER ? { connect: [{ id: operasional.id }] } : undefined,
      },
    });
  }

  const rules: Array<{ type: AnomalyType; severity: Severity; threshold?: number }> = [
    { type: AnomalyType.ROW_MISMATCH, severity: Severity.HIGH },
    { type: AnomalyType.TOTAL_MISMATCH, severity: Severity.HIGH },
    { type: AnomalyType.DAYS_MISMATCH, severity: Severity.MEDIUM },
    { type: AnomalyType.DATA_CHANGED, severity: Severity.CRITICAL },
    { type: AnomalyType.DUPLICATE_FILE, severity: Severity.LOW },
    { type: AnomalyType.FILE_METADATA_SUSPICIOUS, severity: Severity.MEDIUM },
    { type: AnomalyType.MISSING_UPLOAD, severity: Severity.HIGH },
    { type: AnomalyType.MISSING_PUNCH, severity: Severity.LOW },
    { type: AnomalyType.NO_REASON, severity: Severity.MEDIUM },
    { type: AnomalyType.REPEATED_LATE, severity: Severity.MEDIUM, threshold: 3 },
    { type: AnomalyType.UNKNOWN_EMPLOYEE, severity: Severity.MEDIUM },
    { type: AnomalyType.FORMAT_UNKNOWN, severity: Severity.HIGH },
    { type: AnomalyType.GRANULARITY_MISMATCH, severity: Severity.LOW },
    { type: AnomalyType.UNKNOWN_NOTE, severity: Severity.LOW },
  ];
  for (const rule of rules) {
    await prisma.anomalyRule.upsert({
      where: { type: rule.type },
      update: { severity: rule.severity, threshold: rule.threshold ?? null, enabled: true },
      create: {
        type: rule.type,
        severity: rule.severity,
        threshold: rule.threshold ?? null,
        notifyRoles: [Role.SUPER_ADMIN, Role.HR_ADMIN],
        notifyManager: true,
        channels: ["IN_APP", "EMAIL"],
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "pelanggan@local" },
    update: {
      name: "Pelanggan BI",
      role: Role.CUSTOMER,
      isActive: true,
      passwordHash,
      customerId: bankIndonesia.id,
      employeeId: null,
      deletedAt: null,
      managedDepartments: { set: [] },
    },
    create: {
      email: "pelanggan@local",
      name: "Pelanggan BI",
      role: Role.CUSTOMER,
      passwordHash,
      customerId: bankIndonesia.id,
    },
  });

  console.log("Seed complete:", {
    users: SEED_USERS.length + SEED_STAFF.length + 1,
    departments: 3,
    schedule: schedule.name,
    rules: rules.length,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
