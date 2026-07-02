'use strict';

/* =====================================================
   PAY INVOICE  —  pay-invoice.html only
   Depends on: shop.js (fmtPrice, PAYPAL_CLIENT_ID,
   ORDER_EMAIL_ENDPOINT)

   Customer enters their invoice number and the amount
   from their invoice email, then pays via PayPal.
   ===================================================== */

(function () {
  const paypalConfigured = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_ID !== 'YOUR_LIVE_CLIENT_ID_HERE';

  /* ---- PayPal SDK ---- */
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
  loadPayPalSdk().catch(() => {});

  /* ---- Validation ---- */
  const VALIDATORS = {
    fullName:      v => v.trim().length >= 2 || 'Please enter your full name.',
    email:         v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
    invoiceNumber: v => v.trim().length >= 2 || 'Please enter your invoice number.',
    amount:        v => (parseFloat(v) >= 1) || 'Please enter the amount shown on your invoice.',
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

  Object.keys(VALIDATORS).forEach(name => {
    document.getElementById(name)?.addEventListener('blur', () => validateField(name));
  });

  function fieldValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  /* ---- Submit → reveal PayPal ---- */
  const form       = document.getElementById('invoice-form');
  const submitBtn  = document.getElementById('pi-submit-btn');
  const section    = document.getElementById('pi-paypal-section');
  const note       = document.getElementById('pi-paypal-note');
  const successEl  = document.getElementById('invoice-success');
  const formErrEl  = document.getElementById('form-error');

  if (!form) return;

  let buttonsRendered = false;

  form.addEventListener('submit', e => {
    e.preventDefault();

    if (!Object.keys(VALIDATORS).map(validateField).every(Boolean)) {
      form.querySelector('.co-input--error')?.focus();
      return;
    }

    const amount = parseFloat(fieldValue('amount'));

    if (submitBtn) submitBtn.style.display = 'none';
    if (section) section.hidden = false;
    if (note) note.textContent = `Paying ${fmtPrice(amount)} AUD for invoice ${fieldValue('invoiceNumber')} — complete your payment below.`;

    /* Lock fields so the payment matches what was entered */
    form.querySelectorAll('.co-input').forEach(el => { el.readOnly = true; });

    if (!buttonsRendered) renderButtons(amount);
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function renderButtons(amount) {
    buttonsRendered = true;

    loadPayPalSdk()
      .then(paypal => {
        paypal.Buttons({
          createOrder: (data, actions) => actions.order.create({
            purchase_units: [{
              description: `Invoice ${fieldValue('invoiceNumber')} — Dead Dingo Dongas`,
              custom_id: fieldValue('invoiceNumber'),
              amount: { currency_code: 'AUD', value: amount.toFixed(2) },
            }],
          }),
          onApprove: (data, actions) => actions.order.capture().then(details => {
            const txnId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id || details?.id || '';
            sendPaymentConfirmation(txnId, amount);
            showSuccess(txnId, amount);
          }),
          onError: () => {
            if (formErrEl) formErrEl.textContent =
              'The payment could not be processed. Please try again, or email us at dddongas@gmail.com.';
          },
        }).render('#paypal-button-container');
      })
      .catch(() => {
        if (formErrEl) formErrEl.textContent =
          'Online payment is temporarily unavailable. Please email us at dddongas@gmail.com and we will send you a PayPal payment request.';
        if (section) section.hidden = true;
        if (submitBtn) submitBtn.style.display = '';
        form.querySelectorAll('.co-input').forEach(el => { el.readOnly = false; });
        buttonsRendered = false;
      });
  }

  function sendPaymentConfirmation(txnId, amount) {
    fetch(ORDER_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `INVOICE PAID — ${fieldValue('fullName')} — Invoice ${fieldValue('invoiceNumber')} — Dead Dingo Dongas`,
        email: fieldValue('email'),
        message: [
          'Invoice payment received via PayPal.',
          '',
          `  Name:        ${fieldValue('fullName')}`,
          `  Email:       ${fieldValue('email')}`,
          `  Invoice No:  ${fieldValue('invoiceNumber')}`,
          `  Amount:      ${fmtPrice(amount)} AUD`,
          `  PayPal Txn:  ${txnId}`,
        ].join('\n'),
      }),
    }).catch(() => { /* merchant can reconcile from the PayPal dashboard */ });
  }

  function showSuccess(txnId, amount) {
    form.style.display = 'none';
    if (!successEl) return;
    successEl.hidden = false;

    const detailEl = document.getElementById('invoice-payment-detail');
    if (detailEl) {
      detailEl.textContent = `${fmtPrice(amount)} paid via PayPal for invoice ${fieldValue('invoiceNumber')}. Transaction ID: ${txnId}`;
    }
  }

})();
