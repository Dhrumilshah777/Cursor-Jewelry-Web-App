const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function getApiBase() {
  return BASE;
}

/** Use for img/video src when the value is a path like /uploads/xxx */
export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin-key');
}

export async function api<T>(
  path: string,
  options: RequestInit & { admin?: boolean } = {}
): Promise<T> {
  const { admin, ...init } = options;
  const headers: HeadersInit = { ...((init.headers as Record<string, string>) || {}) };
  if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (admin) {
    const key = getAdminKey();
    if (key) headers['x-admin-key'] = key;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json().catch(() => ({} as T));
}

export const apiGet = <T>(path: string, admin?: boolean) =>
  api<T>(path, { method: 'GET', admin: !!admin });
export const apiPost = <T>(path: string, body?: unknown, admin?: boolean) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, admin: !!admin });
export const apiPut = <T>(path: string, body?: unknown, admin?: boolean) =>
  api<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, admin: !!admin });
export const apiDelete = <T>(path: string, admin?: boolean) =>
  api<T>(path, { method: 'DELETE', admin: !!admin });

export function setAdminKey(key: string) {
  if (typeof window !== 'undefined') localStorage.setItem('admin-key', key);
}
export function clearAdminKey() {
  if (typeof window !== 'undefined') localStorage.removeItem('admin-key');
}

const USER_TOKEN_KEY = 'user-token';
export function getUserToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_TOKEN_KEY);
}
export function setUserToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(USER_TOKEN_KEY, token);
}
export function clearUserToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(USER_TOKEN_KEY);
}

export async function uploadFile(file: File, admin = true): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  if (admin && getAdminKey()) headers['x-admin-key'] = getAdminKey()!;
  const res = await fetch(`${BASE}/api/admin/upload/single`, { method: 'POST', body: form, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export async function uploadFiles(files: File[], admin = true): Promise<{ urls: string[]; filenames: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const headers: HeadersInit = {};
  if (admin && getAdminKey()) headers['x-admin-key'] = getAdminKey()!;
  const res = await fetch(`${BASE}/api/admin/upload/multiple`, { method: 'POST', body: form, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}
