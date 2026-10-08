import { hash } from "argon2";
import { config } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";
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

  console.log("Seed complete:", {
    users: SEED_USERS.length,
    departments: 2,
    schedule: schedule.name,
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
