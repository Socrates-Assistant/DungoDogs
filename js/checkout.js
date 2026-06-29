'use strict';

/* =====================================================
   CHECKOUT  —  checkout.html only
   Depends on: shop.js (SHED_CONFIG, Cart, fmtPrice)
   Payment methods: Afterpay, PayPal, BPAY
   Orders are submitted via mailto to dddongas@gmail.com
   ===================================================== */

(function () {
  const cart = Cart.get();

  /* Redirect if cart is empty */
  if (!cart || cart.shedQty < 1) {
    window.location.href = 'index.html#product';
    return;
  }

  Cart.updateBadge(cart);

  /* ============================================================
     ORDER SUMMARY
     ============================================================ */
  const summaryEl = document.getElementById('order-summary');
  if (summaryEl) {
    const price      = Cart.totalPrice(cart);
    const addonItems = SHED_CONFIG.addons.filter(a => (cart.addons[a.id] || 0) > 0);

    summaryEl.innerHTML = `
      <div class="co-summary__product">
        <div class="co-summary__product-name">The Ultimate Aussie Garden Shed</div>
        <div class="co-summary__product-sub">Quantity: ${cart.shedQty}</div>
        <div class="co-summary__product-price">
          ${SHED_CONFIG.basePrice !== null ? fmtPrice(SHED_CONFIG.basePrice * cart.shedQty) : 'TBC'}
        </div>
      </div>
      ${addonItems.length > 0 ? `
        <div class="co-summary__addons">
          <p class="co-summary__addons-heading">Optional Extras</p>
          ${addonItems.map(a => `
            <div class="co-summary__addon">
              <span>${a.name} × ${cart.addons[a.id]}</span>
              <span>${a.price !== null ? fmtPrice(a.price * cart.addons[a.id]) : 'TBC'}</span>
            </div>`).join('')}
        </div>
      ` : ''}
      <div class="co-summary__total">
        <span>Subtotal (excl. freight)</span>
        <strong>${price !== null ? fmtPrice(price) : 'TBC'}</strong>
      </div>
      <div class="co-summary__freight-note">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        Freight confirmed separately — you won't be charged until you approve the freight quote.
      </div>
      <a href="index.html#product" class="co-summary__edit-link">← Edit order</a>
    `;
  }

  /* ============================================================
     FORM VALIDATION
     ============================================================ */
  const VALIDATORS = {
    fullName: v => v.trim().length >= 2 || 'Please enter your full name.',
    email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
    phone:    v => /^(\+?61|0)[2-9]\d{8}$|^04\d{8}$/.test(v.replace(/\s/g, '')) || 'Please enter a valid Australian phone number.',
    address:  v => v.trim().length >= 4 || 'Please enter your street address.',
    suburb:   v => v.trim().length >= 2 || 'Please enter your suburb.',
    state:    v => v !== '' || 'Please select your state.',
    postcode: v => /^\d{4}$/.test(v.trim()) || 'Please enter a valid 4-digit postcode.',
  };

  function validateField(name) {
    const field = document.getElementById(name);
    const errEl = document.getElementById(`err-${name}`);
    if (!field || !errEl) return true;

    const result = VALIDATORS[name]?.(field.value);
    const msg    = result === true ? '' : (result || '');

    field.classList.toggle('co-input--error', !!msg);
    errEl.textContent = msg;
    return !msg;
  }

  function validateAllFields() {
    return Object.keys(VALIDATORS).map(validateField).every(Boolean);
  }

  /* Inline validation on blur */
  Object.keys(VALIDATORS).forEach(name => {
    document.getElementById(name)?.addEventListener('blur', () => validateField(name));
  });

  /* ============================================================
     FORM SUBMIT
     ============================================================ */
  const form      = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('co-submit-btn');
  const submitLbl = document.getElementById('submit-label');
  const successEl = document.getElementById('checkout-success');
  const formErrEl = document.getElementById('form-error');

  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const paymentMethod = 'paypal';

    /* 1 — Validate contact + address fields */
    if (!validateAllFields()) {
      const firstBad = form.querySelector('.co-input--error');
      firstBad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstBad?.focus();
      return;
    }

    /* 2 — Disclaimer checkbox */
    const disclaimerBox   = document.getElementById('co-disclaimer');
    const disclaimerError = document.getElementById('co-disclaimer-error');
    if (!disclaimerBox?.checked) {
      if (disclaimerError) disclaimerError.style.display = '';
      disclaimerBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (disclaimerError) disclaimerError.style.display = 'none';

    /* 3 — Build mailto and submit */
    submitOrder(paymentMethod);
  });

  /* ============================================================
     SUBMIT ORDER via mailto
     ============================================================ */
  function submitOrder(paymentMethod) {
    setLoading(true);

    const name     = document.getElementById('fullName')?.value.trim() || '';
    const email    = document.getElementById('email')?.value.trim()    || '';
    const phone    = document.getElementById('phone')?.value.trim()    || '';
    const address  = document.getElementById('address')?.value.trim()  || '';
    const suburb   = document.getElementById('suburb')?.value.trim()   || '';
    const state    = document.getElementById('state')?.value.trim()    || '';
    const postcode = document.getElementById('postcode')?.value.trim() || '';
    const notes    = document.getElementById('notes')?.value.trim()    || '';

    const addonLines = SHED_CONFIG.addons
      .filter(a => (cart.addons[a.id] || 0) > 0)
      .map(a => `  ${cart.addons[a.id]}x ${a.name} @ ${fmtPrice(a.price)} each`);

    const total = Cart.totalPrice(cart);

    const PAYMENT_LABELS = {
      paypal: 'PayPal',
    };

    const bodyLines = [
      'New order from Dead Dingo Dongas website.',
      '',
      'CUSTOMER DETAILS:',
      `  Name:     ${name}`,
      `  Email:    ${email}`,
      `  Phone:    ${phone}`,
      `  Address:  ${address}, ${suburb} ${state} ${postcode}`,
      notes ? `  Notes:    ${notes}` : null,
      '',
      'ORDER:',
      `  ${cart.shedQty}x The Ultimate Aussie Garden Shed @ ${fmtPrice(SHED_CONFIG.basePrice)} each`,
      ...addonLines,
      total !== null ? `  Subtotal (excl. freight): ${fmtPrice(total)}` : '',
      '',
      `PAYMENT METHOD: ${PAYMENT_LABELS[paymentMethod] || paymentMethod}`,
      '',
      'Customer has read and agreed to the Product Specifications & Liability Disclaimer.',
    ].filter(l => l !== null);

    const subject = `Shed Order — ${name} — Dead Dingo Dongas`;
    const mailto  = `mailto:dddongas@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    window.location.href = mailto;

    /* Show success after a short delay (mailto opens in same tab) */
    setTimeout(() => showSuccess(paymentMethod), 800);
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function setLoading(on) {
    if (submitBtn) submitBtn.disabled = on;
    if (submitLbl) submitLbl.textContent = on ? 'Submitting…' : 'Submit Order';
  }

  function showSuccess(paymentMethod) {
    form.style.display = 'none';
    if (!successEl) return;
    successEl.hidden = false;

    const pmMessages = {
      paypal: "We'll send a PayPal payment request to your email address within 1 business day.",
    };

    const pmEl = document.getElementById('checkout-payment-detail');
    if (pmEl) pmEl.textContent = pmMessages[paymentMethod] || '';

    Cart.save(Cart.empty());
    Cart.updateBadge(Cart.empty());
  }

})();
