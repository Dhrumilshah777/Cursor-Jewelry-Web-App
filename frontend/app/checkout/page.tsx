'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  isUserLoggedIn,
  getValidatedCartFromApi,
  assetUrl,
  apiPost,
  type CartItem,
} from '@/lib/api';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function cartItemSubtotal(item: CartItem): number {
  const p = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
  return p * item.quantity;
}

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

type Address = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      order_id: string;
      prefill?: {
        name?: string;
        email?: string;
        contact?: string;
      };
      modal?: {
        ondismiss?: () => void;
      };
      handler: (res: { razorpay_payment_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<Address>({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [subtotal, setSubtotal] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const { refreshUserSession } = await import('@/lib/api');
      const ok = await refreshUserSession();
      if (!ok) {
        router.replace('/login?returnTo=/checkout');
        return;
      }
      getValidatedCartFromApi()
        .then(({ items: validated, subtotal: total }) => {
          setItems(validated);
          setSubtotal(total);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    })();
  }, [mounted, router]);

  const loadRazorpay = (): Promise<void> => {
    if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!address.name?.trim() || !address.phone?.trim() || !address.line1?.trim() || !address.city?.trim() || !address.state?.trim() || !address.pincode?.trim()) {
      setError('Please fill all required address fields.');
      return;
    }
    setPlacing(true);
    try {
      const res = await apiPost<{
        order: { _id: string; razorpayOrderId?: string; subtotal?: number };
        razorpayOrderId?: string;
        razorpayKeyId?: string;
      }>(
        '/api/orders',
        {
          idempotencyKey: generateIdempotencyKey(),
          shippingAddress: {
            name: address.name.trim(),
            phone: address.phone.trim(),
            line1: address.line1.trim(),
            line2: address.line2.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            pincode: address.pincode.trim(),
          },
        },
        { user: true }
      );

      const orderId = res.order?._id;
      const rzOrderId = res.razorpayOrderId || res.order?.razorpayOrderId;
      const rzKeyId = res.razorpayKeyId;

      if (rzOrderId && rzKeyId) {
        await loadRazorpay();
        const Razorpay = typeof window !== 'undefined' ? window.Razorpay : null;
        if (!Razorpay) {
          setError('Payment gateway could not be loaded.');
          setPlacing(false);
          return;
        }
        const contact = String(address.phone || '').replace(/\\D/g, '').slice(-10);
        const rz = new Razorpay({
          key: rzKeyId,
          order_id: rzOrderId,
          prefill: {
            name: address.name?.trim() || undefined,
            contact: contact || undefined,
          },
          modal: {
            ondismiss: () => {
              // If the user closes Razorpay (common when offline), move them to our verification UI.
              // Backend webhook is the source of truth for payment.captured.
              if (orderId) router.replace(`/orders/success?orderId=${orderId}&verifying=1`);
            },
          },
          handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await apiPost(
                '/api/orders/verify-payment',
                {
                  orderId,
                  razorpayOrderId: rzOrderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
                { user: true }
              );
              if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart-updated'));
              router.replace(`/orders/success?orderId=${orderId}`);
            } catch (err) {
              // Webhook can be delayed; fall back to polling order status on the success page.
              router.replace(`/orders/success?orderId=${orderId}&verifying=1`);
            } finally {
              setPlacing(false);
            }
          },
        });
        rz.open();
        setPlacing(false);
      } else {
        router.replace(`/orders/success?orderId=${orderId}`);
        setPlacing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order.');
      setPlacing(false);
    }
  };

  if (!mounted || loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading…</p>
        </div>
      </main>
    );
  }

  const token = isUserLoggedIn();
  if (!token) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-stone-600">Redirecting to login…</p>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-2xl font-semibold text-charcoal">Checkout</h1>
          <p className="mt-4 text-stone-600">Your cart is empty.</p>
          <Link href="/cart" className="mt-4 inline-block text-charcoal underline hover:no-underline">
            Back to cart
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Checkout
        </h1>

        <form onSubmit={handlePlaceOrder} className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-medium text-charcoal">Shipping address</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700">Name *</label>
                <input
                  value={address.name}
                  onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Phone *</label>
                <input
                  type="tel"
                  value={address.phone}
                  onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Address line 1 *</label>
                <input
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Address line 2</label>
                <input
                  value={address.line2}
                  onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700">City *</label>
                  <input
                    value={address.city}
                    onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700">State *</label>
                  <input
                    value={address.state}
                    onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                    className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Pincode *</label>
                <input
                  value={address.pincode}
                  onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))}
                  className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-medium text-charcoal">Order summary</h2>
            <ul className="mt-4 space-y-3 border border-stone-200 rounded-lg p-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 text-sm">
                  <img src={imageSrc(item.image)} alt="" className="h-14 w-14 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal truncate">{item.name}</p>
                    <p className="text-stone-500">Qty: {item.quantity} × ₹{item.price}</p>
                  </div>
                  <p className="font-medium">₹{(cartItemSubtotal(item)).toFixed(2)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-lg font-semibold text-charcoal">Subtotal: ₹{subtotal.toFixed(2)}</p>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={placing}
                className="rounded bg-charcoal px-6 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {placing ? 'Placing order…' : 'Place order & pay'}
              </button>
              <Link
                href="/cart"
                className="rounded border border-stone-300 px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-stone-50"
              >
                Back to cart
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
