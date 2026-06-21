/*
  ============================================================
  STRIPE PAYMENT INTENT CREATOR  —  Netlify Serverless Function
  ============================================================
  This file enables real card charging on the checkout page.

  HOW TO DEPLOY (Netlify — free tier works):
  ──────────────────────────────────────────
  1. Create a free Netlify account at netlify.com
  2. Drag-and-drop the ClientProject folder onto Netlify
     (or connect your GitHub repo)
  3. In Netlify → Site Settings → Environment Variables, add:
       STRIPE_SECRET_KEY = sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXX
     (Get this from your Stripe Dashboard → Developers → API Keys)
  4. Netlify automatically serves files in /api as functions
     at the path /.netlify/functions/create-intent
     BUT since checkout.js calls /api/create-intent, you also
     need to add a redirect in netlify.toml (see below)

  netlify.toml (create this file in ClientProject root):
  ──────────────────────────────────────────────────────
  [[redirects]]
    from = "/api/create-intent"
    to   = "/.netlify/functions/create-intent"
    status = 200

  STRIPE ACCOUNT SETUP:
  ──────────────────────
  1. Sign up at stripe.com (free)
  2. Go to Dashboard → Developers → API Keys
  3. Copy your Publishable Key → paste into checkout.js (STRIPE_PUBLISHABLE_KEY)
  4. Copy your Secret Key    → paste into Netlify Environment Variables
  5. Test with card number 4242 4242 4242 4242, any future expiry, any CVV
  ============================================================
*/

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body.' }) };
  }

  const { amountCents, order } = body;

  /* Validate amount */
  if (!amountCents || typeof amountCents !== 'number' || amountCents < 100) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Amount is missing or too low. Please contact us.' }),
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amountCents),
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: {
        shed_qty:  String(order?.shedQty  || ''),
        addons:    String(order?.addons   || ''),
        customer:  String(order?.name     || ''),
        email:     String(order?.email    || ''),
        address:   String(order?.address  || ''),
      },
    });

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body:       JSON.stringify({ message: 'Payment could not be initiated. Please try again.' }),
    };
  }
};
