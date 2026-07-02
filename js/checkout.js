'use strict';

/* =====================================================
   CHECKOUT  —  checkout.html only
   Depends on: shop.js (SHED_CONFIG, Cart, fmtPrice,
   PAYPAL_CLIENT_ID, DEPOSIT_PER_KIT, ORDER_EMAIL_ENDPOINT)

   Flow:
   1. Customer confirms details → order emailed via FormSubmit
      (mailto fallback if the request fails)
   2. PayPal buttons appear → deposit captured client-side
   3. Payment confirmation emailed, success screen shown
   ===================================================== */

(function () {
  const cart = Cart.get();

  /* Redirect if cart is empty */
  if (!cart || cart.shedQty < 1) {
    window.location.href = 'index.html#product';
    return;
  }

  Cart.updateBadge(cart);

  const depositTotal = DEPOSIT_PER_KIT * cart.shedQty;
  const paypalConfigured = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_ID !== 'YOUR_LIVE_CLIENT_ID_HERE';

  /* ============================================================
     PAYPAL SDK — loaded once, early, so buttons render instantly
     ============================================================ */
  let sdkPromise = null;
  function loadPayPalSdk() {
    if (!paypalConfigured) return Promise.reject(new Error('PayPal client ID not configured'));
    if (!sdkPromise) {
      sdkPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=AUD&components=buttons`;
        s.onload  = () => resolve(window.paypal);
        s.onerror = () => reject(new Error('PayPal SDK failed to load'));
        document.head.appendChild(s);
      });
    }
    return sdkPromise;
  }
  loadPayPalSdk().catch(() => { /* handled again at render time */ });

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
      <div class="co-summary__deposit">
        <span>Deposit due now</span>
        <strong>$1,500 × ${cart.shedQty} kit${cart.shedQty > 1 ? 's' : ''} = ${fmtPrice(depositTotal)}</strong>
      </div>
      <div class="co-summary__freight-note">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        Deposit: $1,500 per kit. Balance invoice issued after deposit is confirmed.
      </div>
      <a href="index.html#product" class="co-summary__edit-link">← Edit order</a>
    `;
  }

  /* ============================================================
     FORM VALIDATION
     ============================================================ */
  const VALIDATORS = {
    fullName:      v => v.trim().length >= 2 || 'Please enter your full name.',
    invoiceNumber: v => v.trim().length >= 2 || 'Please enter your invoice number.',
    email:         v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
    phone:         v => /^(\+?61|0)[2-9]\d{8}$|^04\d{8}$/.test(v.replace(/\s/g, '')) || 'Please enter a valid Australian phone number.',
    address:       v => v.trim().length >= 4 || 'Please enter your street address.',
    suburb:        v => v.trim().length >= 2 || 'Please enter your suburb.',
    state:         v => v !== '' || 'Please select your state.',
    postcode:      v => /^\d{4}$/.test(v.trim()) || 'Please enter a valid 4-digit postcode.',
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
     FORM SUBMIT — Phase A: confirm details
     ============================================================ */
  const form          = document.getElementById('checkout-form');
  const submitBtn     = document.getElementById('co-submit-btn');
  const submitLbl     = document.getElementById('submit-label');
  const successEl     = document.getElementById('checkout-success');
  const formErrEl     = document.getElementById('form-error');
  const paypalSection = document.getElementById('co-paypal-section');
  const paypalNote    = paypalSection?.querySelector('.co-paypal-note');

  if (!form) return;

  function fieldValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function buildOrderBody() {
    const addonLines = SHED_CONFIG.addons
      .filter(a => (cart.addons[a.id] || 0) > 0)
      .map(a => `  ${cart.addons[a.id]}x ${a.name} @ ${fmtPrice(a.price)} each`);

    const total = Cart.totalPrice(cart);
    const notes = fieldValue('notes');

    return [
      'Deposit order from Dead Dingo Dongas website.',
      '',
      'CUSTOMER DETAILS:',
      `  Name:       ${fieldValue('fullName')}`,
      `  Invoice No: ${fieldValue('invoiceNumber')}`,
      `  Email:      ${fieldValue('email')}`,
      `  Phone:      ${fieldValue('phone')}`,
      `  Address:    ${fieldValue('address')}, ${fieldValue('suburb')} ${fieldValue('state')} ${fieldValue('postcode')}`,
      notes ? `  Notes:      ${notes}` : null,
      '',
      'ORDER:',
      `  ${cart.shedQty}x The Ultimate Aussie Garden Shed @ ${fmtPrice(SHED_CONFIG.basePrice)} each`,
      ...addonLines,
      total !== null ? `  Subtotal (excl. freight): ${fmtPrice(total)}` : '',
      `  Deposit due: ${fmtPrice(depositTotal)} ($1,500 x ${cart.shedQty} kit)`,
      '',
      'Customer has read and agreed to the Product Specifications & Liability Disclaimer.',
    ].filter(l => l !== null).join('\n');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();

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

    /* 3 — Email the order details, then reveal payment */
    submitOrderDetails();
  });

  function submitOrderDetails() {
    setLoading(true);
    if (formErrEl) formErrEl.textContent = '';

    const body = buildOrderBody();
    const name = fieldValue('fullName');
    const invoiceNumber = fieldValue('invoiceNumber');

    fetch(ORDER_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `Deposit Order — ${name} — Invoice ${invoiceNumber} — Dead Dingo Dongas`,
        email: fieldValue('email'),
        message: body,
      }),
    })
      .then(res => { if (!res.ok) throw new Error('send failed'); })
      .catch(() => {
        /* Fallback: open the customer's mail client with the same content */
        const subject = `Deposit Order — ${name} — Invoice ${invoiceNumber} — Dead Dingo Dongas`;
        window.location.href = `mailto:dddongas@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      })
      .finally(() => {
        setLoading(false);
        revealPayPal();
      });
  }

  /* ============================================================
     Phase B: PayPal deposit payment
     ============================================================ */
  let buttonsRendered = false;

  function revealPayPal() {
    if (submitBtn) submitBtn.style.display = 'none';
    if (paypalSection) paypalSection.hidden = false;

    /* Lock fields so the paid order matches the emailed details */
    form.querySelectorAll('.co-input').forEach(el => { el.readOnly = true; el.disabled = el.tagName === 'SELECT'; });

    if (!buttonsRendered) renderPayPalButtons();
    paypalSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderPayPalButtons() {
    buttonsRendered = true;

    loadPayPalSdk()
      .then(paypal => {
        paypal.Buttons({
          createOrder: (data, actions) => actions.order.create({
            purchase_units: [{
              description: `Deposit — ${cart.shedQty}x Ultimate Aussie Garden Shed`,
              custom_id: fieldValue('invoiceNumber'),
              amount: { currency_code: 'AUD', value: depositTotal.toFixed(2) },
            }],
          }),
          onApprove: (data, actions) => actions.order.capture().then(details => {
            const txnId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id || details?.id || '';
            sendPaymentConfirmation(txnId);
            showSuccess(txnId);
          }),
          onError: () => {
            if (paypalNote) paypalNote.textContent =
              'The payment could not be processed. Please try again, or email us at dddongas@gmail.com and we will send you a PayPal payment request.';
          },
        }).render('#paypal-button-container');
      })
      .catch(() => {
        /* SDK unavailable (or client ID not yet configured) — order details
           were still emailed, so fall back to the manual payment request. */
        if (paypalNote) paypalNote.textContent =
          "Your order has been received. Online payment is temporarily unavailable — we'll email you a PayPal payment request for your deposit within 1 business day.";
        showSuccess('');
      });
  }

  function sendPaymentConfirmation(txnId) {
    /* Fire-and-forget notification to the business inbox */
    fetch(ORDER_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `DEPOSIT PAID — ${fieldValue('fullName')} — Invoice ${fieldValue('invoiceNumber')} — Dead Dingo Dongas`,
        email: fieldValue('email'),
        message: [
          `Deposit payment received via PayPal.`,
          '',
          `  Name:        ${fieldValue('fullName')}`,
          `  Invoice No:  ${fieldValue('invoiceNumber')}`,
          `  Amount:      ${fmtPrice(depositTotal)} AUD`,
          `  PayPal Txn:  ${txnId}`,
        ].join('\n'),
      }),
    }).catch(() => { /* merchant can reconcile from the PayPal dashboard */ });
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function setLoading(on) {
    if (submitBtn) submitBtn.disabled = on;
    if (submitLbl) submitLbl.textContent = on ? 'Submitting…' : 'Confirm Details & Pay Deposit';
  }

  function showSuccess(txnId) {
    form.style.display = 'none';
    if (!successEl) return;
    successEl.hidden = false;

    if (!txnId) {
      const headingEl = successEl.querySelector('.checkout-success__heading');
      const bodyEl    = successEl.querySelector('.checkout-success__body');
      if (headingEl) headingEl.textContent = 'Order Received!';
      if (bodyEl) bodyEl.textContent = 'Your deposit order has been received and your production slot is being confirmed.';
    }

    const pmEl = document.getElementById('checkout-payment-detail');
    if (pmEl) {
      pmEl.textContent = txnId
        ? `Deposit of ${fmtPrice(depositTotal)} paid via PayPal. Transaction ID: ${txnId}`
        : "We'll email you a PayPal payment request for your deposit within 1 business day.";
    }

    Cart.save(Cart.empty());
    Cart.updateBadge(Cart.empty());
  }

})();
