export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export function denied<T>(): ServiceResult<T> {
  return { ok: false, status: 403, error: "Tidak diizinkan." };
}

export function missing<T>(error: string): ServiceResult<T> {
  return { ok: false, status: 404, error };
}

export function invalid<T>(error: string): ServiceResult<T> {
  return { ok: false, status: 400, error };
}

export function conflict<T>(error: string): ServiceResult<T> {
  return { ok: false, status: 409, error };
}
