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

const ADMIN_LOGGED_IN_KEY = 'admin_logged_in';
const USER_LOGGED_IN_KEY = 'user_logged_in';

export function isAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADMIN_LOGGED_IN_KEY) === '1';
}
export function setAdminLoggedIn() {
  if (typeof window !== 'undefined') localStorage.setItem(ADMIN_LOGGED_IN_KEY, '1');
}
export function clearAdminLoggedIn() {
  if (typeof window !== 'undefined') localStorage.removeItem(ADMIN_LOGGED_IN_KEY);
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
  const headers: HeadersInit = { ...((init.headers as Record<string, string>) || {}) };
  if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  // Auth via httpOnly cookies; send credentials so cookies are included
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
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
  return localStorage.getItem(USER_LOGGED_IN_KEY) === '1';
}
export function setUserLoggedIn() {
  if (typeof window !== 'undefined') localStorage.setItem(USER_LOGGED_IN_KEY, '1');
}
export function clearUserLoggedIn() {
  if (typeof window !== 'undefined') localStorage.removeItem(USER_LOGGED_IN_KEY);
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

export async function uploadFile(file: File, admin = true): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/admin/upload/single`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export async function uploadFiles(files: File[], admin = true): Promise<{ urls: string[]; filenames: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await fetch(`${BASE}/api/admin/upload/multiple`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

// Wishlist (localStorage) – product shape: { id, name, category, price, image }
const WISHLIST_KEY = 'wishlist-items';

export type WishlistProduct = { id: string; name: string; category: string; price: string; image: string };

export function getWishlist(): WishlistProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function setWishlist(items: WishlistProduct[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
}

export function addToWishlist(product: WishlistProduct) {
  const list = getWishlist();
  if (list.some((p) => p.id === product.id)) return;
  setWishlist([...list, product]);
}

export function removeFromWishlist(productId: string) {
  setWishlist(getWishlist().filter((p) => p.id !== productId));
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
    addToCartApi(item).catch(() => {});
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
