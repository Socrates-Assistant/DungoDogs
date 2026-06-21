'use strict';

/* =====================================================
   PRODUCT CONFIGURATOR  —  index.html only
   Depends on: shop.js (SHED_CONFIG, Cart, fmtPrice)
   ===================================================== */

(function () {
  let cart = Cart.get();

  /* ---- Render addon rows ---- */
  const addonList = document.getElementById('addon-list');

  if (addonList) {
    addonList.innerHTML = SHED_CONFIG.addons.map(addon => `
      <div class="addon-row" id="addon-row-${addon.id}">

        <div class="addon-row__qty">
          <button class="qty-btn qty-btn--sm"
                  data-addon="${addon.id}" data-action="decrease"
                  aria-label="Decrease ${addon.name}">−</button>
          <span   class="qty-display qty-display--sm"
                  id="addon-qty-${addon.id}">${cart.addons[addon.id] || 0}</span>
          <button class="qty-btn qty-btn--sm"
                  data-addon="${addon.id}" data-action="increase"
                  aria-label="Increase ${addon.name}">+</button>
        </div>

        <div class="addon-row__label">
          <button class="addon-row__name" type="button"
                  aria-describedby="tooltip-${addon.id}">${addon.name}</button>

          <div class="addon-tooltip" id="tooltip-${addon.id}"
               role="tooltip" aria-hidden="true">
            <div class="addon-tooltip__img-wrap">
              <img src="${addon.imageSrc}"
                   alt="${addon.name}"
                   class="addon-tooltip__img"
                   onerror="this.closest('.addon-tooltip__img-wrap').classList.add('no-img')">
              <div class="addon-tooltip__placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span>Image coming soon</span>
              </div>
            </div>
            <p class="addon-tooltip__desc">${addon.description}</p>
          </div>
        </div>

        <div class="addon-row__price-wrap">
          <span class="addon-row__unit-price">
            ${addon.price !== null ? `+${fmtPrice(addon.price)} ea` : 'TBC'}
          </span>
          <span class="addon-row__subtotal" id="addon-sub-${addon.id}"></span>
        </div>

      </div>
    `).join('');
  }

  /* ---- State update helpers ---- */
  function updateTotal() {
    const el = document.getElementById('config-total');
    if (!el) return;
    const price = Cart.totalPrice(cart);
    el.textContent = price !== null ? fmtPrice(price) : 'TBC';
    el.classList.toggle('config-total__amount--tbc', price === null);
  }

  function updateBaseDisplay() {
    const el = document.getElementById('base-qty-display');
    if (el) el.textContent = cart.shedQty;
  }

  function updateAddonDisplay(id) {
    const qtyEl = document.getElementById(`addon-qty-${id}`);
    const subEl = document.getElementById(`addon-sub-${id}`);
    const addon = SHED_CONFIG.addons.find(a => a.id === id);
    const qty   = cart.addons[id] || 0;

    if (qtyEl) qtyEl.textContent = qty;
    if (subEl) {
      if (addon && addon.price !== null && qty > 0) {
        subEl.textContent = fmtPrice(addon.price * qty);
        subEl.style.display = '';
      } else {
        subEl.style.display = 'none';
      }
    }
  }

  function updateAddToCartBtn() {
    const btn = document.getElementById('add-to-cart');
    if (!btn) return;
    const empty = cart.shedQty === 0;
    btn.disabled = empty;
    btn.classList.toggle('btn--disabled', empty);
    const label = btn.querySelector('.add-to-cart-label');
    if (label) label.textContent = empty ? 'Select a quantity above' : 'Add to Cart';
  }

  function initDisplays() {
    updateBaseDisplay();
    SHED_CONFIG.addons.forEach(a => updateAddonDisplay(a.id));
    updateTotal();
    updateAddToCartBtn();
    Cart.updateBadge(cart);
  }

  /* ---- Base shed quantity ---- */
  document.getElementById('base-qty-decrease')?.addEventListener('click', () => {
    if (cart.shedQty > 0) { cart.shedQty--; updateBaseDisplay(); updateTotal(); updateAddToCartBtn(); }
  });

  document.getElementById('base-qty-increase')?.addEventListener('click', () => {
    if (cart.shedQty < 10) { cart.shedQty++; updateBaseDisplay(); updateTotal(); updateAddToCartBtn(); }
  });

  /* ---- Add-on quantity (event delegation) ---- */
  addonList?.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn[data-addon]');
    if (!btn) return;
    const { addon: id, action } = btn.dataset;
    let qty = cart.addons[id] || 0;
    if (action === 'decrease' && qty > 0)  qty--;
    if (action === 'increase' && qty < 20) qty++;
    cart.addons[id] = qty;
    updateAddonDisplay(id);
    updateTotal();
  });

  /* ---- Addon tooltips ---- */
  function showTip(id) {
    const tip = document.getElementById(`tooltip-${id}`);
    if (tip) { tip.classList.add('visible'); tip.setAttribute('aria-hidden', 'false'); }
  }
  function hideTip(id) {
    const tip = document.getElementById(`tooltip-${id}`);
    if (tip) { tip.classList.remove('visible'); tip.setAttribute('aria-hidden', 'true'); }
  }

  SHED_CONFIG.addons.forEach(({ id }) => {
    const row  = document.getElementById(`addon-row-${id}`);
    const name = row?.querySelector('.addon-row__name');
    const tip  = document.getElementById(`tooltip-${id}`);
    if (!row || !name || !tip) return;

    name.addEventListener('mouseenter', () => showTip(id));
    name.addEventListener('mouseleave', () => { setTimeout(() => { if (!tip.matches(':hover')) hideTip(id); }, 120); });
    name.addEventListener('focus',      () => showTip(id));
    name.addEventListener('blur',       () => hideTip(id));
    name.addEventListener('click',      e => { e.stopPropagation(); tip.classList.toggle('visible'); });
    tip.addEventListener('mouseleave',  () => hideTip(id));
  });

  document.addEventListener('click', () => SHED_CONFIG.addons.forEach(a => hideTip(a.id)));

  /* ---- Add to Cart ---- */
  document.getElementById('add-to-cart')?.addEventListener('click', () => {
    Cart.save(cart);
    Cart.updateBadge(cart);
    openCart();
  });

  /* ---- Cart Sidebar ---- */
  function openCart() {
    const overlay = document.getElementById('cart-overlay');
    if (!overlay) return;
    renderCart();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('cart-close')?.focus();
  }

  function closeCart() {
    const overlay = document.getElementById('cart-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderCart() {
    const body   = document.getElementById('cart-body');
    const footer = document.getElementById('cart-footer');
    if (!body || !footer) return;

    const c          = Cart.get();
    const price      = Cart.totalPrice(c);
    const addonItems = SHED_CONFIG.addons.filter(a => (c.addons[a.id] || 0) > 0);

    body.innerHTML = `
      <div class="cart-item">
        <div class="cart-item__row">
          <span class="cart-item__name">The Ultimate Aussie Garden Shed</span>
          <span class="cart-item__qty-badge">× ${c.shedQty}</span>
        </div>
        <div class="cart-item__price">
          ${SHED_CONFIG.basePrice !== null ? fmtPrice(SHED_CONFIG.basePrice * c.shedQty) : 'Price TBC'}
        </div>
        ${addonItems.length > 0 ? `
          <div class="cart-addons">
            ${addonItems.map(a => `
              <div class="cart-addon">
                <span>${a.name} × ${c.addons[a.id]}</span>
                <span>${a.price !== null ? fmtPrice(a.price * c.addons[a.id]) : 'TBC'}</span>
              </div>`).join('')}
          </div>
        ` : ''}
      </div>
      <p class="cart-freight-note">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        Freight is quoted separately based on your delivery location.
      </p>
    `;

    footer.innerHTML = `
      <div class="cart-total">
        <span>Order Total</span>
        <strong>${price !== null ? fmtPrice(price) : 'TBC'}</strong>
      </div>
      <a href="checkout.html" class="btn btn--amber btn--lg btn--block">Proceed to Checkout →</a>
      <button class="cart-continue-btn" id="cart-keep-shopping">← Continue Shopping</button>
    `;

    document.getElementById('cart-keep-shopping')?.addEventListener('click', closeCart);
  }

  /* Nav cart button */
  document.getElementById('cart-open')?.addEventListener('click', openCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'cart-overlay') closeCart();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('cart-overlay')?.classList.contains('open')) closeCart();
  });

  /* ---- Set base price from config ---- */
  const basePriceEl = document.getElementById('config-base-price');
  if (basePriceEl) {
    basePriceEl.textContent = SHED_CONFIG.basePrice !== null
      ? fmtPrice(SHED_CONFIG.basePrice)
      : '$X,XXX';
  }

  /* ---- Init ---- */
  initDisplays();
})();
