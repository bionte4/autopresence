import { handlers } from "@/auth";

// Auth.js owns CSRF and credential checks on this route. RBAC applies after a session exists.
export const { GET, POST } = handlers;
