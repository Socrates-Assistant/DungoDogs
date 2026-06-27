'use strict';

/* =====================================================
   CHECKOUT  —  checkout.html only
   Depends on: Stripe.js (loaded in <head>), shop.js

   STRIPE SETUP (required for live card processing):
   1. Create a Stripe account at stripe.com
   2. Replace STRIPE_PUBLISHABLE_KEY below with your
      actual key from the Stripe dashboard
   3. Deploy the backend function in /api/create-intent.js
      (see that file for Netlify setup instructions)
   ===================================================== */

/* ---- Replace with your Stripe publishable key ---- */
const STRIPE_PUBLISHABLE_KEY = 'pk_live_REPLACE_WITH_YOUR_STRIPE_KEY';

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
     STRIPE CARD ELEMENT
     ============================================================ */
  let stripe      = null;
  let cardElement = null;
  let cardValid   = false;

  const cardSection = document.getElementById('stripe-card-section');
  const cardErrEl   = document.getElementById('stripe-card-errors');

  function initStripe() {
    if (typeof Stripe === 'undefined') {
      if (cardSection) {
        cardSection.innerHTML = `
          <p class="co-stripe-unavailable">
            Card payment could not load. Please refresh the page, or email us at dddongas@gmail.com.
          </p>`;
      }
      return;
    }

    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    const elements = stripe.elements({
      fonts: [{
        cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500',
      }],
    });

    cardElement = elements.create('card', {
      iconStyle: 'solid',
      style: {
        base: {
          fontSize:      '15px',
          color:         '#1A1A1A',
          fontFamily:    "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight:    '400',
          lineHeight:    '1.5',
          letterSpacing: '0.01em',
          '::placeholder': { color: '#718096' },
          iconColor: '#2D5A27',
        },
        invalid: {
          color:     '#DC2626',
          iconColor: '#DC2626',
        },
        complete: {
          iconColor: '#2D5A27',
        },
      },
    });

    cardElement.mount('#stripe-card-element');

    cardElement.on('change', event => {
      cardValid = event.complete;
      if (cardErrEl) {
        cardErrEl.textContent = event.error ? event.error.message : '';
        cardErrEl.style.display = event.error ? 'block' : 'none';
      }
    });
  }

  /* Wait for Stripe.js to load (it's loaded async in <head>) */
  if (document.readyState === 'complete') {
    initStripe();
  } else {
    window.addEventListener('load', initStripe);
  }

  /* ============================================================
     PAYMENT METHOD TOGGLE
     ============================================================ */
  const PAYMENT_INFO = {
    afterpay: "We'll contact you within 1 business day to send your Afterpay payment link for the confirmed total.",
    paypal:   "We'll send a PayPal payment request to your email address after confirming your order and freight.",
    bpay:     "Your BPAY Biller Code and Reference Number will be included in your order confirmation email.",
  };

  const payInfoEl = document.getElementById('payment-info');

  document.querySelectorAll('input[name="payment"]').forEach(input => {
    input.addEventListener('change', () => {
      const isCard = input.value === 'card';

      /* Show/hide Stripe element */
      if (cardSection) {
        cardSection.style.display = isCard ? 'block' : 'none';
      }

      /* Show/hide info text for non-card options */
      if (payInfoEl) {
        const msg = PAYMENT_INFO[input.value] || '';
        payInfoEl.textContent = msg;
        payInfoEl.style.display = msg ? 'block' : 'none';
      }
    });
  });

  /* ============================================================
     FORM VALIDATION HELPERS
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
    const field  = document.getElementById(name);
    const errEl  = document.getElementById(`err-${name}`);
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

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;

    /* 1 — Validate contact + address fields */
    if (!validateAllFields()) {
      const firstBad = form.querySelector('.co-input--error');
      firstBad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstBad?.focus();
      return;
    }

    /* 1b — Disclaimer checkbox */
    const disclaimerBox   = document.getElementById('co-disclaimer');
    const disclaimerError = document.getElementById('co-disclaimer-error');
    if (!disclaimerBox?.checked) {
      if (disclaimerError) disclaimerError.style.display = '';
      disclaimerBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (disclaimerError) disclaimerError.style.display = 'none';

    /* 2 — Card-specific validation */
    if (paymentMethod === 'card') {
      if (!stripe || !cardElement) {
        setError('Card payment is unavailable. Please refresh and try again, or email dddongas@gmail.com.');
        return;
      }
      if (!cardValid) {
        setError('Please enter complete, valid card details before placing your order.');
        if (cardErrEl && !cardErrEl.textContent) {
          cardErrEl.textContent = 'Card details are incomplete.';
          cardErrEl.style.display = 'block';
        }
        cardSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setLoading(true);
    clearError();

    /* 3 — Process payment */
    if (paymentMethod === 'card') {
      await processCardPayment();
    } else {
      await processAlternativePayment(paymentMethod);
    }
  });

  /* ============================================================
     CARD PAYMENT via Stripe
     ============================================================ */
  async function processCardPayment() {
    /*
      PRODUCTION FLOW:
      1. POST to /api/create-intent (your Netlify/backend function) with the order amount
      2. Backend creates a Stripe PaymentIntent and returns { clientSecret }
      3. Call stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } })
      4. On success, submit order details to Formspree/database

      BACKEND ENDPOINT (/api/create-intent.js):
      ─────────────────────────────────────────
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      exports.handler = async (event) => {
        const { amountCents } = JSON.parse(event.body);
        const intent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: 'aud',
          automatic_payment_methods: { enabled: true },
        });
        return { statusCode: 200, body: JSON.stringify({ clientSecret: intent.client_secret }) };
      };
      ─────────────────────────────────────────
    */

    const amountCents = (() => {
      const p = Cart.totalPrice(cart);
      return p ? Math.round(p * 100) : null;
    })();

    const CHARGE_ENDPOINT = '/api/create-intent';

    let clientSecret = null;

    try {
      const res  = await fetch(CHARGE_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amountCents, order: buildOrderSummary('card') }),
      });

      if (!res.ok) throw new Error('backend_unavailable');
      const data = await res.json();
      clientSecret = data.clientSecret;
    } catch {
      /*
        Backend not yet deployed — fall back to email submission.
        Remove this catch block once /api/create-intent is live.
      */
      await submitOrderEmail('card');
      return;
    }

    /* Confirm the payment with Stripe */
    const { error: stripeErr } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name:  document.getElementById('fullName')?.value || '',
          email: document.getElementById('email')?.value    || '',
          phone: document.getElementById('phone')?.value    || '',
          address: {
            line1:       document.getElementById('address')?.value  || '',
            city:        document.getElementById('suburb')?.value   || '',
            state:       document.getElementById('state')?.value    || '',
            postal_code: document.getElementById('postcode')?.value || '',
            country:     'AU',
          },
        },
      },
    });

    if (stripeErr) {
      setLoading(false);
      setError(stripeErr.message);
      if (cardErrEl) {
        cardErrEl.textContent = stripeErr.message;
        cardErrEl.style.display = 'block';
      }
    } else {
      /* Payment confirmed — email order receipt */
      await submitOrderEmail('card');
    }
  }

  /* ============================================================
     NON-CARD PAYMENT (Afterpay / PayPal / BPAY)
     ============================================================ */
  async function processAlternativePayment(method) {
    await submitOrderEmail(method);
  }

  /* ============================================================
     EMAIL ORDER via Formspree
     Set the Formspree action on the form element, or replace
     FORMSPREE_URL below when the client sets up Formspree.
     ============================================================ */
  const FORMSPREE_URL = 'https://formspree.io/f/YOUR_FORM_ID';

  async function submitOrderEmail(paymentMethod) {
    const orderField = document.getElementById('order-details');
    if (orderField) orderField.value = JSON.stringify(buildOrderSummary(paymentMethod));

    const formData = new FormData(form);

    if (FORMSPREE_URL.includes('YOUR_FORM_ID')) {
      /* Formspree not set up yet — show success locally */
      showSuccess(paymentMethod);
      return;
    }

    try {
      const res = await fetch(FORMSPREE_URL, {
        method:  'POST',
        body:    formData,
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        showSuccess(paymentMethod);
      } else {
        setLoading(false);
        setError('There was a problem submitting your order. Please email dddongas@gmail.com directly.');
      }
    } catch {
      setLoading(false);
      setError('Could not connect. Please email dddongas@gmail.com directly.');
    }
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function buildOrderSummary(paymentMethod) {
    const addonLines = SHED_CONFIG.addons
      .filter(a => (cart.addons[a.id] || 0) > 0)
      .map(a => `${a.name}: ${cart.addons[a.id]}`)
      .join(', ');
    return {
      shedQty:  cart.shedQty,
      addons:   addonLines || 'None',
      total:    Cart.totalPrice(cart) !== null ? fmtPrice(Cart.totalPrice(cart)) : 'TBC',
      payment:  paymentMethod,
      name:     document.getElementById('fullName')?.value,
      email:    document.getElementById('email')?.value,
      phone:    document.getElementById('phone')?.value,
      address:  `${document.getElementById('address')?.value}, ${document.getElementById('suburb')?.value} ${document.getElementById('state')?.value} ${document.getElementById('postcode')?.value}`,
      notes:    document.getElementById('notes')?.value || '',
    };
  }

  function setLoading(on) {
    if (submitBtn) submitBtn.disabled = on;
    if (submitLbl) submitLbl.textContent = on ? 'Processing…' : 'Place Order & Pay';
  }

  function setError(msg) {
    if (formErrEl) {
      formErrEl.textContent = msg;
      formErrEl.style.display = msg ? 'block' : 'none';
      if (msg) formErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function clearError() {
    setError('');
  }

  function showSuccess(paymentMethod) {
    form.style.display = 'none';
    if (!successEl) return;
    successEl.hidden = false;

    const pmMessages = {
      card:     'Your payment has been processed. A confirmation email is on its way.',
      afterpay: "We'll email you an Afterpay payment link within 1 business day.",
      paypal:   "We'll send a PayPal payment request to your email address.",
      bpay:     "Your BPAY details will be in your confirmation email.",
    };

    const pmEl = document.getElementById('checkout-payment-detail');
    if (pmEl) pmEl.textContent = pmMessages[paymentMethod] || '';

    Cart.save(Cart.empty());
    Cart.updateBadge(Cart.empty());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
