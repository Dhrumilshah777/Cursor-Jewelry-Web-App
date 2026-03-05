# Jewelry App – Project Overview (Start to End)

This document describes **everything** in the app: authentication, security, payments, orders, sessions/cookies, and how it all fits together.

---

## 1. Authentication (Login)

### How login works

- **Method:** Google OAuth only (no email/password).
- **Backend:** Passport.js with `passport-google-oauth20`.
- **Flow:**
  1. User clicks “Sign in with Google” → frontend redirects to **backend** `GET /api/auth/google`.
  2. Backend redirects to Google; user signs in with Google.
  3. Google redirects to backend `GET /api/auth/google/callback` with an auth code.
  4. Backend exchanges code for profile (id, email, name).
  5. Backend finds or creates a **User** in MongoDB (`User` model: `googleId`, `email`, `name`, `role`).
  6. **Admin vs user:** If the user’s email is in `ALLOWED_ADMIN_EMAILS` (env), `role` is set to `admin`, else `user`.
  7. Backend issues a **JWT** (see below), sets an **httpOnly cookie** (`user_token` for user, `admin_token` for admin), and redirects to the frontend callback URL, passing the token in the URL as fallback (for when the cookie is blocked cross-origin).

### Separate entry points

- **User login:** `/login` → “Sign in with Google” → same backend `/api/auth/google` → after callback, user gets `user_token` and is redirected to `/login/callback`.
- **Admin login:** `/admin/login` → same Google flow; if email is in `ALLOWED_ADMIN_EMAILS`, user gets `admin_token` and is redirected to `/admin/auth/callback`.

So: **one Google OAuth**, two cookie names and two frontend callback pages depending on where you started (user vs admin).

### After login (callback)

- Frontend callback page reads `token` from the URL (if present).
- It first tries `GET /api/auth/me` with **credentials** (cookie). If that succeeds, the cookie was set and the user is considered logged in.
- If the cookie was not set (e.g. cross-origin), frontend calls `POST /api/auth/set-cookie` (user) or `POST /api/auth/set-admin-cookie` (admin) with `Authorization: Bearer <token>`, so the backend sets the same httpOnly cookie.
- Frontend then sets a **localStorage** flag (`user_logged_in` or `admin_logged_in` = `'1'`) so the UI knows “user is logged in” without ever reading the JWT (the real auth is the cookie).
- For **user** login: if there was a **guest cart** in localStorage, the frontend calls **merge cart** API so guest cart items are moved to the server cart; then guest cart is cleared.

### Logout

- **User:** `GET /api/auth/logout` clears `user_token` cookie; frontend clears `user_logged_in`.
- **Admin:** `GET /api/auth/admin-logout` clears `admin_token` cookie; frontend clears `admin_logged_in`.

---

## 2. Sessions and Cookies – Are We Using JWT?

**Yes. We use JWT for authentication**, but the way it’s used is cookie-based and safe.

- **JWT library:** `jsonwebtoken` (backend).
- **Where the JWT lives:**
  - **Primary:** Stored in **httpOnly cookies** (`user_token` for users, `admin_token` for admins). The browser sends them automatically with every request to the backend; **JavaScript cannot read them** (so XSS cannot steal the token).
  - **Fallback:** For the OAuth redirect, the backend also puts the token in the **callback URL** so the frontend can call `POST /api/auth/set-cookie` or `set-admin-cookie` with `Authorization: Bearer <token>` and get the cookie set if the redirect didn’t set it (e.g. cross-origin).
- **Cookie options:**
  - `httpOnly: true`, `path: '/'`, `maxAge: 7 days`.
  - Production: `sameSite: 'none'`, `secure: true` (HTTPS only).
  - Development: `sameSite: 'lax'`.
- **JWT payload:** `{ sub: user._id, role: 'user' | 'admin', email? }`. Secret: `JWT_SECRET` (env). Expiry: `JWT_EXPIRY` (default `7d`).

So: **JWT is used for auth**, and we **do not use a separate session store** (no Redis/session DB). The JWT in the httpOnly cookie **is** the session. The frontend only knows “logged in” via the localStorage flag and by the fact that API calls with `credentials: 'include'` succeed.

---

## 3. Security (What We Use)

- **Helmet:** Enabled with `contentSecurityPolicy: false` and `crossOriginEmbedderPolicy: false` to avoid breaking typical frontend/script setups.
- **CORS:** Restrictive. Only `FRONTEND_URL` is allowed as origin; `credentials: true` so cookies are sent; allowed methods and headers are explicit.
- **Rate limiting:**
  - Auth routes (`/api/auth/*`): 50 requests per 15 minutes per IP.
  - Order creation (`POST /api/orders`): 10 requests per minute per IP (to avoid abuse).
- **Cookies:** httpOnly, secure in production, sameSite so CSRF risk is reduced (and we don’t rely on cookies for GET-from-other-sites).
- **Admin routes:** Every admin route is protected by **adminAuth** middleware: JWT must be present in `admin_token` cookie or `x-admin-key` header (or `adminKey` query), and JWT must have `role === 'admin'`.
- **User routes (cart, orders):** Protected by **userAuth** middleware: JWT must be in `user_token` cookie or `Authorization: Bearer <token>`, and `role` must be `user` or `admin`; `req.userId` is set from `decoded.sub` (user’s MongoDB `_id`).
- **Body parsing:** `express.json({ strict: true })`. Invalid JSON returns 400. Razorpay webhook uses **raw body** (see below).

---

## 4. User Payment (Razorpay) – How It Works

- **Gateway:** Razorpay (India). Payment is in INR.
- **Backend env:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and for webhooks `RAZORPAY_WEBHOOK_SECRET`.

### Step-by-step payment flow

1. **Checkout (frontend):** User is logged in, fills shipping address, clicks “Place order”.
2. **Create order (backend):**  
   `POST /api/orders` (with `user_token` cookie) sends:
   - `idempotencyKey`: unique string (e.g. UUID) so the same placement isn’t charged twice.
   - `shippingAddress`: name, phone, line1, line2, city, state, pincode.
   - No items in body: **items and total come from the server-side cart**.
3. **Backend order creation:**
   - Checks idempotency: if an order already exists for this user with that `idempotencyKey`, returns that order (no new charge).
   - Loads cart from DB; validates each item (product exists, active, stock); recalculates **price from DB** (gold/fixed price) and builds order items and subtotal.
   - Creates **Order** in DB with status `pending_payment`, stores shipping address and items.
   - Creates a **Razorpay order** (Razorpay API) with amount in paise, receipt = our order `_id`; saves `razorpayOrderId` on our order.
   - Returns to frontend: `order`, `razorpayOrderId`, `razorpayKeyId`.
4. **Frontend:** Loads Razorpay checkout script, opens Razorpay checkout with `razorpayKeyId` and `razorpayOrderId`. User pays on Razorpay (card/UPI/etc.).
5. **Razorpay** calls our **webhook** and (in parallel) the frontend gets a success callback with `razorpay_payment_id` and `razorpay_signature`.
6. **Frontend** calls `POST /api/orders/verify-payment` with:
   - `orderId` (our DB order id),
   - `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`.
7. **Backend verify-payment:**
   - Ensures order belongs to `req.userId` and is not already `paid`.
   - Verifies signature: `HMAC-SHA256(razorpayOrderId + '|' + razorpayPaymentId, RAZORPAY_KEY_SECRET)` must match `razorpaySignature`.
   - Calls **completePaidOrder** (same as webhook): mark order `paid`, save `razorpayPaymentId`, decrement product stock in a **MongoDB transaction**, clear user’s cart. If stock fails, order is set to `stock_failed` and cart is not cleared.
   - Returns updated order to frontend.
8. **Frontend:** Dispatches `cart-updated`, redirects to `/orders/success?orderId=...`.

So: **payment is done on Razorpay’s page**; we never see card details. We only create a Razorpay order, then verify the payment with the signature and complete the order (stock + cart) on our server.

---

## 5. Webhook (Razorpay) – Why and How

- **URL:** `POST /api/webhooks/razorpay`.
- **Why:** Razorpay may confirm payment **before** the user’s browser calls our verify-payment (e.g. slow network, closed tab). The webhook is the **source of truth** so we don’t rely only on the frontend.
- **Raw body:** This route is mounted **before** `express.json()`. It uses `express.raw({ type: 'application/json' })` so we have the exact raw body for signature verification.
- **Verification:** We check header `x-razorpay-signature` with `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)`. If it fails, we respond 400 and do nothing.
- **Event:** We only act on `event === 'payment.captured'`; we read `payload.payload.payment.entity` for `id` (payment id) and `order_id` (Razorpay order id).
- **Logic:** We find our Order by `razorpayOrderId`, then call **completePaidOrder** (mark paid, decrement stock in a transaction, clear cart). Same function as in verify-payment, so order completion is **idempotent** (if already `paid`, we do nothing).

So: **both** the frontend verify-payment and the webhook can complete the order; the first one to run wins; the second sees `status === 'paid'` and exits without changing anything.

---

## 6. Is the User Order Safe?

- **Auth:** Placing an order and verifying payment require the **user JWT** (cookie). Only the order owner can create or verify that order; `getOne` checks `order.user === req.userId`.
- **Items and total:** Items and amount are **never** taken from the client. They are computed on the server from the **cart in DB** and current **product prices** (including gold pricing). So tampering with the frontend cannot change items or total.
- **Idempotency:** `idempotencyKey` prevents double orders for the same “click” (same key returns the same order).
- **Payment verification:** We **verify Razorpay’s signature** (HMAC with key secret) before marking paid. So only real Razorpay payments are accepted.
- **Stock:** Stock is decremented inside a **MongoDB transaction** (with `completePaidOrder`). If any product has insufficient stock, the transaction is aborted, order is set to `stock_failed`, and cart is not cleared. So we don’t oversell.
- **Webhook:** Payment is also confirmed by Razorpay’s webhook (signature verified). So even if the user closes the browser after paying, we still mark the order paid and update stock/cart.

So: **orders are tied to the authenticated user, amounts come from the server, payment is cryptographically verified, and stock is updated safely in a transaction.**

---

## 7. How the Order Is Placed (Short Recap)

1. User is logged in (Google OAuth, JWT in httpOnly cookie).
2. Cart is stored in DB (per user); checkout page loads **validated** cart from API (items + subtotal from server).
3. User submits shipping address; frontend sends `POST /api/orders` with `idempotencyKey` and `shippingAddress` (no items).
4. Backend builds order from DB cart (validates products, recalculates price), creates Order with status `pending_payment`, creates Razorpay order, returns `razorpayOrderId` and key.
5. User pays on Razorpay; we get webhook and/or frontend verify-payment.
6. We verify signature, then run **completePaidOrder**: set order to `paid`, decrement stock in a transaction, clear cart.
7. User is redirected to order success page; they can see the order under “My orders”.

---

## 8. Cart (Guest vs Logged-In)

- **Guest:** Cart is stored in **localStorage** only. Add-to-cart can work without login (frontend stores item in localStorage and dispatches `cart-updated`). No server cart yet.
- **Logged-in:** Cart is stored in **MongoDB** (Cart model: `user`, `items[]`). Add-to-cart calls `POST /api/cart/items` with productId, quantity, etc.; backend validates product (exists, active, stock) and **recalculates price from DB** before adding. So cart always has correct server-side prices.
- **Merge on login:** When user signs in after adding items as guest, the login callback calls **merge cart** API: backend merges guest items (from request body) into the user’s DB cart (again validating and using DB prices), then frontend clears localStorage cart.

---

## 9. Other Features (What We’ve Built)

- **Products:** Public list with optional filters (category, min/max price, color); facets from backend. Admin CRUD for products (with gold pricing, stock, active flag).
- **Gold rates:** Admin can set gold rates; product price can be computed from weight/purity + making charges.
- **View by categories:** Admin-managed categories with images (SiteConfig); home page section fetches from API.
- **Hero, video, Instagram:** Site config and admin panels.
- **Wishlist:** Frontend-only (localStorage).
- **Orders list:** User sees their orders; admin sees all orders (admin routes).
- **Shiprocket:** Backend integration for creating shipments (token-based API); order model has tracking/courier fields.
- **Uploads:** Admin upload for images; stored under `/uploads`, served by backend.

---

## 10. Summary Table

| Topic              | What we use |
|--------------------|------------|
| **Auth**           | Google OAuth (Passport), JWT in httpOnly cookie |
| **Session**        | JWT as session (no Redis/DB session store) |
| **Cookies**        | `user_token`, `admin_token` (httpOnly, 7d, secure in prod) |
| **JWT**            | Yes – issued after Google login, verified on every protected route |
| **Payment**        | Razorpay (create order → user pays → verify signature → complete order) |
| **Order safety**   | Server-side cart & prices, idempotency, signature verification, transactional stock |
| **Security**      | Helmet, CORS, rate limits, httpOnly cookies, admin/user middleware |
| **Webhook**        | Razorpay `payment.captured` → verify signature → complete order (same as verify-payment) |

If you want more detail on any one part (e.g. exact env vars, or cart merge logic), say which part and we can expand it.
