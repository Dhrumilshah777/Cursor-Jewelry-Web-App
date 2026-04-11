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

type SessionCache = { ok: boolean; checkedAt: number };
const SESSION_TTL_MS = 30_000;
let userSession: SessionCache = { ok: false, checkedAt: 0 };
let adminSession: SessionCache = { ok: false, checkedAt: 0 };

export type WishlistProduct = { id: string; name: string; category: string; price: string; image: string };
/** Logged-in user's wishlist from API; null = not loaded yet */
let userWishlistCache: WishlistProduct[] | null = null;

const LS_USER_LOGGED_IN = 'user_logged_in';
const LS_ADMIN_LOGGED_IN = 'admin_logged_in';
/** iOS/Safari often blocks third-party API cookies; Bearer from sessionStorage keeps auth working (clear on logout). */
const SS_USER_JWT = 'jewelry_user_jwt_fallback';
const SS_ADMIN_JWT = 'jewelry_admin_jwt_fallback';

function readUserAuthFallback(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SS_USER_JWT);
  } catch {
    return null;
  }
}

function readAdminAuthFallback(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SS_ADMIN_JWT);
  } catch {
    return null;
  }
}

/** Call after Google/OTP login when the API cookie may not stick on iOS cross-site. */
export function storeUserAuthTokenFallback(token: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SS_USER_JWT, token);
  } catch {
    // ignore
  }
}

export function storeAdminAuthTokenFallback(token: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SS_ADMIN_JWT, token);
  } catch {
    // ignore
  }
}

/** Some mobile WebViews strip query params; OAuth token may be duplicated in the hash. */
export function readOAuthTokenFromUrlHash(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash;
  if (!h || h.length < 2) return null;
  const q = h.startsWith('#') ? h.slice(1) : h;
  const params = new URLSearchParams(q);
  return params.get('token') || params.get('t');
}

function readLoginFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeLoginFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (value) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // ignore (Safari private mode / storage blocked)
  }
}

function dispatchAuthUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-updated'));
}

export function isAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  // Prefer fresh in-memory cache when available; otherwise fall back to persisted hint.
  if (adminSession.checkedAt && Date.now() - adminSession.checkedAt <= SESSION_TTL_MS) return adminSession.ok;
  return readLoginFlag(LS_ADMIN_LOGGED_IN);
}

export async function refreshAdminSession(): Promise<boolean> {
  try {
    // Minimal check: if admin-only endpoint works, cookie is valid.
    await apiGet<{ ok: boolean }>('/api/admin/me', { admin: true });
    adminSession = { ok: true, checkedAt: Date.now() };
    writeLoginFlag(LS_ADMIN_LOGGED_IN, true);
    dispatchAuthUpdated();
    return true;
  } catch {
    adminSession = { ok: false, checkedAt: Date.now() };
    writeLoginFlag(LS_ADMIN_LOGGED_IN, false);
    dispatchAuthUpdated();
    return false;
  }
}

export function setAdminLoggedIn() {
  adminSession = { ok: true, checkedAt: Date.now() };
  writeLoginFlag(LS_ADMIN_LOGGED_IN, true);
  dispatchAuthUpdated();
}

export function clearAdminLoggedIn() {
  adminSession = { ok: false, checkedAt: Date.now() };
  writeLoginFlag(LS_ADMIN_LOGGED_IN, false);
  try {
    if (typeof window !== 'undefined') sessionStorage.removeItem(SS_ADMIN_JWT);
  } catch {
    // ignore
  }
  dispatchAuthUpdated();
}

/** @deprecated Use isAdminLoggedIn; cookie holds the token */
export function getAdminKey(): string | null {
  return null;
}

export async function api<T>(
  path: string,
  options: RequestInit & { admin?: boolean; user?: boolean } = {}
): Promise<T> {
  const { admin, user, ...init } = options;
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!headers['Authorization']) {
    if (user) {
      const t = readUserAuthFallback();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } else if (admin) {
      const t = readAdminAuthFallback();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    }
  }
  // Auth via httpOnly cookies; send credentials so cookies are included
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    // If the cookie-based session is missing/expired, avoid getting stuck in a "logged in" UI state.
    if (typeof window !== 'undefined' && (res.status === 401 || res.status === 403)) {
      if (user) clearUserLoggedIn();
      if (admin) clearAdminLoggedIn();
    }
    const text = await res.text();
    let err: { error?: string; message?: string } = { message: res.statusText };
    try {
      err = JSON.parse(text) || err;
    } catch {
      if (text) err.message = text.slice(0, 200);
    }
    const msg = err.error || err.message || res.statusText;
    const e = new Error(msg) as Error & { responseBody?: string };
    e.responseBody = text.slice(0, 500);
    throw e;
  }
  return res.json().catch(() => ({} as T));
}

type ApiOpts = { admin?: boolean; user?: boolean };
export const apiGet = <T>(path: string, opts?: boolean | ApiOpts) =>
  api<T>(path, { method: 'GET', ...(typeof opts === 'boolean' ? { admin: opts } : opts) });
export const apiPost = <T>(path: string, body?: unknown, opts?: boolean | ApiOpts) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...(typeof opts === 'boolean' ? { admin: opts } : opts) });
export const apiPut = <T>(path: string, body?: unknown, opts?: boolean | ApiOpts) =>
  api<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...(typeof opts === 'boolean' ? { admin: opts } : opts) });
export const apiPatch = <T>(path: string, body?: unknown, opts?: boolean | ApiOpts) =>
  api<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...(typeof opts === 'boolean' ? { admin: opts } : opts) });
export const apiDelete = <T>(path: string, opts?: boolean | ApiOpts) =>
  api<T>(path, { method: 'DELETE', ...(typeof opts === 'boolean' ? { admin: opts } : opts) });

/** @deprecated Token is in httpOnly cookie; use setAdminLoggedIn after callback */
export function setAdminKey(_key: string) {
  setAdminLoggedIn();
}
export function clearAdminKey() {
  clearAdminLoggedIn();
}

export function isUserLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  // Prefer fresh in-memory cache when available; otherwise fall back to persisted hint.
  if (userSession.checkedAt && Date.now() - userSession.checkedAt <= SESSION_TTL_MS) return userSession.ok;
  return readLoginFlag(LS_USER_LOGGED_IN);
}
export function setUserLoggedIn() {
  userSession = { ok: true, checkedAt: Date.now() };
  writeLoginFlag(LS_USER_LOGGED_IN, true);
  dispatchAuthUpdated();
}
export function clearUserLoggedIn() {
  userSession = { ok: false, checkedAt: Date.now() };
  writeLoginFlag(LS_USER_LOGGED_IN, false);
  userWishlistCache = null;
  try {
    if (typeof window !== 'undefined') sessionStorage.removeItem(SS_USER_JWT);
  } catch {
    // ignore
  }
  dispatchAuthUpdated();
}

/** @deprecated Use isUserLoggedIn; cookie holds the token */
export function getUserToken(): string | null {
  return isUserLoggedIn() ? 'cookie' : null;
}
/** @deprecated Token is in httpOnly cookie; use setUserLoggedIn after callback */
export function setUserToken(_token: string) {
  setUserLoggedIn();
}
export function clearUserToken() {
  clearUserLoggedIn();
}

const WISHLIST_KEY = 'wishlist-items';

function readGuestWishlistOnly(): WishlistProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Guest wishlist in localStorage (for merge on login). Ignores logged-in cache. */
export function getLocalGuestWishlist(): WishlistProduct[] {
  return readGuestWishlistOnly();
}

export function clearGuestWishlistStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WISHLIST_KEY);
  } catch {
    // ignore
  }
}

function writeGuestWishlist(items: WishlistProduct[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('wishlist-updated'));
}

export async function refreshWishlistFromApi(): Promise<void> {
  if (typeof window === 'undefined' || !isUserLoggedIn()) {
    userWishlistCache = null;
    return;
  }
  try {
    const items = await apiGet<WishlistProduct[]>('/api/wishlist', { user: true });
    userWishlistCache = Array.isArray(items) ? items : [];
  } catch {
    userWishlistCache = [];
  }
  window.dispatchEvent(new Event('wishlist-updated'));
}

async function putWishlistApi(items: WishlistProduct[]): Promise<WishlistProduct[]> {
  return apiPut<WishlistProduct[]>('/api/wishlist', { items }, { user: true });
}

async function addWishlistItemApi(product: WishlistProduct): Promise<WishlistProduct[]> {
  return apiPost<WishlistProduct[]>('/api/wishlist/items', product, { user: true });
}

async function removeWishlistItemApi(productId: string): Promise<WishlistProduct[]> {
  return apiDelete<WishlistProduct[]>(`/api/wishlist/items/${encodeURIComponent(productId)}`, { user: true });
}

export async function mergeWishlistApi(items: WishlistProduct[]): Promise<void> {
  const merged = await apiPost<WishlistProduct[]>('/api/wishlist/merge', { items }, { user: true });
  userWishlistCache = Array.isArray(merged) ? merged : [];
  window.dispatchEvent(new Event('wishlist-updated'));
}

export async function refreshUserSession(): Promise<boolean> {
  try {
    await apiGet<{ user: unknown }>('/api/auth/me', { user: true });
    userSession = { ok: true, checkedAt: Date.now() };
    writeLoginFlag(LS_USER_LOGGED_IN, true);
    dispatchAuthUpdated();
    await refreshWishlistFromApi();
    return true;
  } catch {
    userSession = { ok: false, checkedAt: Date.now() };
    writeLoginFlag(LS_USER_LOGGED_IN, false);
    userWishlistCache = null;
    dispatchAuthUpdated();
    return false;
  }
}

export async function uploadFile(file: File, admin = true): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const bearer = readAdminAuthFallback();
  const headers: Record<string, string> = {};
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  const res = await fetch(`${BASE}/api/admin/upload/single`, { method: 'POST', body: form, credentials: 'include', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export async function uploadFiles(files: File[], admin = true): Promise<{ urls: string[]; filenames: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const bearer = readAdminAuthFallback();
  const headers: Record<string, string> = {};
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  const res = await fetch(`${BASE}/api/admin/upload/multiple`, { method: 'POST', body: form, credentials: 'include', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export function getWishlist(): WishlistProduct[] {
  if (typeof window === 'undefined') return [];
  if (isUserLoggedIn()) {
    return userWishlistCache !== null ? userWishlistCache : [];
  }
  return readGuestWishlistOnly();
}

export function setWishlist(items: WishlistProduct[]) {
  if (typeof window === 'undefined') return;
  if (isUserLoggedIn()) {
    userWishlistCache = [...items];
    window.dispatchEvent(new Event('wishlist-updated'));
    void putWishlistApi(items)
      .then((server) => {
        userWishlistCache = server;
        window.dispatchEvent(new Event('wishlist-updated'));
      })
      .catch(() => {
        void refreshWishlistFromApi();
      });
  } else {
    writeGuestWishlist(items);
  }
}

export function addToWishlist(product: WishlistProduct) {
  if (typeof window === 'undefined') return;
  if (!isUserLoggedIn()) {
    const list = readGuestWishlistOnly();
    if (list.some((p) => p.id === product.id)) return;
    writeGuestWishlist([...list, product]);
    return;
  }
  const list = userWishlistCache !== null ? userWishlistCache : [];
  if (list.some((p) => p.id === product.id)) return;
  const prev = userWishlistCache !== null ? [...userWishlistCache] : [];
  userWishlistCache = [...list, product];
  window.dispatchEvent(new Event('wishlist-updated'));
  void addWishlistItemApi(product)
    .then((items) => {
      userWishlistCache = items;
      window.dispatchEvent(new Event('wishlist-updated'));
    })
    .catch(() => {
      userWishlistCache = prev.length ? prev : null;
      window.dispatchEvent(new Event('wishlist-updated'));
    });
}

export function removeFromWishlist(productId: string) {
  if (typeof window === 'undefined') return;
  if (!isUserLoggedIn()) {
    writeGuestWishlist(readGuestWishlistOnly().filter((p) => p.id !== productId));
    return;
  }
  const list = userWishlistCache !== null ? userWishlistCache : [];
  const prev = [...list];
  userWishlistCache = list.filter((p) => p.id !== productId);
  window.dispatchEvent(new Event('wishlist-updated'));
  void removeWishlistItemApi(productId)
    .then((items) => {
      userWishlistCache = items;
      window.dispatchEvent(new Event('wishlist-updated'));
    })
    .catch(() => {
      userWishlistCache = prev;
      window.dispatchEvent(new Event('wishlist-updated'));
    });
}

export function isInWishlist(productId: string): boolean {
  return getWishlist().some((p) => p.id === productId);
}

// Cart (localStorage) – guest cart, no login required. Item: { id, name, price, image, quantity }
const CART_KEY = 'cart-items';

export type CartItem = { id: string; name: string; price: string; image: string; quantity: number };

function dispatchCartUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart-updated'));
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function setCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  dispatchCartUpdated();
}

export function addToCart(item: Omit<CartItem, 'quantity'> | CartItem) {
  if (getUserToken()) {
    addToCartApi(item).catch(() => {
      // If the session cookie isn't actually present (401/403), fall back to guest cart so the UX still works.
      const list = getCart();
      const qty = 'quantity' in item ? item.quantity : 1;
      const existing = list.find((p) => p.id === item.id);
      if (existing) {
        existing.quantity += qty;
        setCart([...list]);
      } else {
        setCart([...list, { ...item, quantity: qty }]);
      }
    });
    return;
  }
  const list = getCart();
  const qty = 'quantity' in item ? item.quantity : 1;
  const existing = list.find((p) => p.id === item.id);
  if (existing) {
    existing.quantity += qty;
    setCart([...list]);
  } else {
    setCart([...list, { ...item, quantity: qty }]);
  }
}

export function removeFromCart(productId: string) {
  setCart(getCart().filter((p) => p.id !== productId));
}

export function updateCartQuantity(productId: string, quantity: number) {
  if (quantity < 1) {
    removeFromCart(productId);
    return;
  }
  const list = getCart();
  const item = list.find((p) => p.id === productId);
  if (!item) return;
  item.quantity = quantity;
  setCart([...list]);
}

export function getCartCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

/** Cart API (when user is logged in). Items use productId on server, we map to id for CartItem. */
export async function getCartFromApi(): Promise<CartItem[]> {
  const raw = await apiGet<{ productId: string; name: string; price: string; image: string; quantity: number }[]>(
    '/api/cart',
    { user: true }
  );
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({ id: i.productId, name: i.name, price: i.price, image: i.image || '', quantity: i.quantity }));
}

/** Validated cart: server re-fetches products and returns items + backend-calculated subtotal. Use for cart page and checkout. */
export type ValidatedCart = { items: CartItem[]; subtotal: number };
export async function getValidatedCartFromApi(): Promise<ValidatedCart> {
  const raw = await apiGet<{ items: { productId: string; name: string; price: string; image: string; quantity: number }[]; subtotal: number }>(
    '/api/cart/validated',
    { user: true }
  );
  const items = Array.isArray(raw?.items)
    ? raw.items.map((i) => ({ id: i.productId, name: i.name, price: i.price, image: i.image || '', quantity: i.quantity }))
    : [];
  const subtotal = typeof raw?.subtotal === 'number' ? raw.subtotal : 0;
  return { items, subtotal };
}

export async function setCartApi(items: CartItem[]): Promise<void> {
  const body = items.map((i) => ({ productId: i.id, name: i.name, price: i.price, image: i.image, quantity: i.quantity }));
  await apiPut('/api/cart', { items: body }, { user: true });
  dispatchCartUpdated();
}

export async function mergeCartApi(items: CartItem[]): Promise<void> {
  await apiPost(
    '/api/cart/merge',
    { items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, image: i.image, quantity: i.quantity })) },
    { user: true }
  );
  dispatchCartUpdated();
}

export async function addToCartApi(item: Omit<CartItem, 'quantity'> | CartItem): Promise<void> {
  const qty = 'quantity' in item ? item.quantity : 1;
  await apiPost(
    '/api/cart/items',
    { productId: item.id, name: item.name, price: item.price, image: item.image || '', quantity: qty },
    { user: true }
  );
  dispatchCartUpdated();
}
