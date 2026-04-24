/** Public product page path: prefer slug; fall back to Mongo id for legacy bookmarks. */
export function productHref(p: { slug?: string; _id?: string; id?: string }): string {
  const slug = typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : '';
  if (slug) return `/products/${encodeURIComponent(slug)}`;
  const id = (p._id || p.id || '').toString();
  return `/products/${encodeURIComponent(id)}`;
}
