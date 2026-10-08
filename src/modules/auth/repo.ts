import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/modules/rbac/policy";

const authSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  employeeId: true,
  passwordHash: true,
  isActive: true,
  deletedAt: true,
  failedLogins: true,
  lockedUntil: true,
  managedDepartments: {
    where: { deletedAt: null },
    select: { id: true },
  },
  departmentSeats: {
    select: { departmentId: true, seat: true },
  },
} as const;

type AuthRecord = Prisma.UserGetPayload<{ select: typeof authSelect }>;

function toAuthUser(user: AuthRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId,
    managedDepartmentIds: user.managedDepartments.map((department) => department.id),
    reviewSeats: user.departmentSeats.map((seat) => ({ departmentId: seat.departmentId, seat: seat.seat })),
  };
}

export async function findUserByEmail(email: string): Promise<AuthRecord | null> {
  return prisma.user.findUnique({ where: { email }, select: authSelect });
}

export async function findAuthUser(id: string): Promise<AuthUser | null> {
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, deletedAt: null },
    select: authSelect,
  });
  return user ? toAuthUser(user) : null;
}

export async function setLoginFailure(
  userId: string,
  failedLogins: number,
  lockedUntil: Date | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins, lockedUntil },
  });
}

export async function clearLoginFailures(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null },
  });
}
