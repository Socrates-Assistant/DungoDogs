'use strict';

/* =====================================================
   PRODUCT CONFIGURATION
   Update prices when the client confirms them.
   Leave as null to show "TBC" to customers.
   ===================================================== */
const SHED_CONFIG = {
  name:      'The Ultimate Aussie Garden Shed',
  basePrice: null, /* TODO: set confirmed price, e.g. 4999 */
  addons: [
    {
      id:          'window',
      name:        'Extra Window',
      description: 'Additional louvred aluminium window — same size and finish as the standard window.',
      price:       null, /* TODO: set price, e.g. 299 */
      imageSrc:    'assets/addons/window.jpg',
    },
    {
      id:          'pa-door',
      name:        'Single PA Door',
      description: 'Single pedestrian access door, 820 mm × 2040 mm, matching panel finish.',
      price:       null, /* TODO: set price, e.g. 499 */
      imageSrc:    'assets/addons/pa-door.jpg',
    },
    {
      id:          'double-door',
      name:        'Double Door',
      description: 'Wide double-leaf swing door — ideal for ride-ons, quad bikes, large equipment, or easy storage access.',
      price:       null, /* TODO: set price, e.g. 799 */
      imageSrc:    'assets/addons/double-door.jpg',
    },
  ],
};

/* =====================================================
   PRICE FORMATTER
   ===================================================== */
function fmtPrice(n) {
  if (n === null || n === undefined) return 'TBC';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);
}

/* =====================================================
   CART  —  single-product localStorage cart
   Shape: { shedQty: number, addons: { [id]: number } }
   ===================================================== */
const Cart = (() => {
  const KEY = 'ddd_cart_v1';

  const empty = () => ({
    shedQty: 0,
    addons: Object.fromEntries(SHED_CONFIG.addons.map(a => [a.id, 0])),
  });

  const get = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return { ...empty(), ...JSON.parse(raw) };
    } catch { return empty(); }
  };

  const save = cart => localStorage.setItem(KEY, JSON.stringify(cart));

  const totalQty = (c = get()) =>
    (c.shedQty || 0) + Object.values(c.addons || {}).reduce((s, v) => s + v, 0);

  const totalPrice = (c = get()) => {
    if (SHED_CONFIG.basePrice === null) return null;
    let t = SHED_CONFIG.basePrice * (c.shedQty || 1);
    for (const a of SHED_CONFIG.addons) {
      if (a.price === null) return null;
      t += a.price * (c.addons[a.id] || 0);
    }
    return t;
  };

  const updateBadge = (c = get()) => {
    const el = document.getElementById('cart-badge');
    if (!el) return;
    const n = totalQty(c);
    el.textContent = n;
    el.style.display = n > 0 ? 'flex' : 'none';
  };

  return { get, save, empty, totalQty, totalPrice, updateBadge };
})();
