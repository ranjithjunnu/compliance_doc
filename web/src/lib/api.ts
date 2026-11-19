// One place for every call to the Aegis backend.
// GET when there is no body, POST with a JSON body otherwise. The backend requires the
// x-aegis-client header on every change, as a guard against cross-site requests.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { credentials: 'same-origin' }
      : {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'x-aegis-client': 'web', 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
  const res = await fetch(path, init)
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data as { error?: string }).error || `Request failed (${res.status}).`
    throw new ApiError(res.status, message)
  }
  return data as T
}
