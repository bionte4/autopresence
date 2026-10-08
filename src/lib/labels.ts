import type { Role } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  MANAGER: "Manajer",
  AUDITOR: "Auditor",
  EMPLOYEE: "Pegawai",
};
