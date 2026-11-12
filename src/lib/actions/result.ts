export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;

export function ok<T = void>(data?: T): { ok: true; data: T } {
  return { ok: true, data: data as T };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionFailure {
  return { ok: false, error, fieldErrors };
}
