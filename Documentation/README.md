# AMF Membership Form — Complete Architecture & Implementation Guide

## Executive Summary

A membership signup form enabling users to select tier (Community/Champion/Family/Open Door) and payment frequency (monthly/quarterly/yearly), pay via Paystack, and be automatically added to recurring billing. **Key architecture decision:** Backend verification with customer data synchronization to comply with Paystack API requirements and ensure data integrity.

---

## The Problem & Solution

### What Didn't Work
- **Original approach:** Frontend-only flow. After payment, user saw confirmation, but customer names appeared as "No name" in Paystack dashboard.
- **Root cause:** No server-side verification or customer data update.

### Why It Matters
Paystack's official guidance requires:
1. Server-side verification using SECRET_KEY (not frontend callback)
2. Customer name synchronization after payment
3. Audit trail for disputes

### The Solution
**Frontend → Backend → Paystack** architecture:
```
1. User fills form (tier, frequency, name, email, phone)
2. Clicks "Proceed to Payment" → Paystack modal opens
3. User pays via Paystack
4. Frontend receives reference from onSuccess callback (unavoidable)
5. Frontend sends reference + user data to backend
6. Backend verifies with Paystack (using SECRET_KEY)
7. Backend updates customer name in Paystack
8. Frontend redirects to Welcome page
9. User sees: "Welcome to AMF. Join WhatsApp. Roland will follow up."
```

**Why this is sound:**
- ✅ Uses PUBLIC_KEY only on frontend (safe)
- ✅ Uses SECRET_KEY only on backend (secure)
- ✅ Synchronous verification before redirect (no race conditions)
- ✅ Paystack customers show full names, not "No name"
- ✅ Audit trail exists for all transactions

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│ FRONTEND (Netlify) — index.html, styles.css, app.js     │
│ • Tier dropdown (Community/Champion/Family/Open Door)    │
│ • Frequency dropdown (Monthly/Quarterly/Yearly)          │
│ • Auto-calculated amount display                         │
│ • Form validation                                        │
│ • PaystackPop.setup() with PUBLIC_KEY                    │
│ • POST /verify-payment with reference + user data        │
└──────────────────┬───────────────────────────────────────┘
                   │ reference + {firstName, lastName, email, phone}
                   ▼
┌──────────────────────────────────────────────────────────┐
│ BACKEND (Node.js) — server.js + routes/payments.js       │
│ POST /verify-payment:                                    │
│ 1. Receive reference + user details                      │
│ 2. Call Paystack Verify API (+ SECRET_KEY)               │
│ 3. Get customer ID from response                         │
│ 4. Call Paystack Update Customer API                     │
│ 5. Return { verified: true/false }                       │
└──────────────────┬───────────────────────────────────────┘
                   │ verification result
                   ▼
┌──────────────────────────────────────────────────────────┐
│ PAYSTACK (Their servers — PCI compliant)                 │
│ • Stores customer data (first_name, last_name, phone)    │
│ • Manages subscription plans, recurring charges          │
│ • Dashboard shows members with complete names            │
└──────────────────────────────────────────────────────────┘
```

---

## Membership Tiers & Pricing (Fixed)

| Tier | Monthly | Quarterly | Yearly |
|---|---|---|---|
| **Open Door** | Free | Free | Free |
| **Community** | R50 | R200 | R600 |
| **Champion** | R500 | R2,000 | R6,000 |
| **Family** | R400 | R1,600 | R4,800 |

Formula: `Amount = Base Price × Frequency Multiplier` (Monthly=1, Quarterly=4, Yearly=12)

---

## File Structure

```
amf-membership-form/

FRONTEND (Netlify)
├── index.html              (Form structure + Paystack script tag)
├── app.js                  (Logic: validation, amount calc, API calls)
├── styles.css              (Responsive styling)
└── welcome.html            (Post-payment welcome page)

BACKEND (Node.js server)
├── server.js               (Express app, middleware)
├── routes/payments.js      (POST /verify-payment endpoint)
├── .env                    (PAYSTACK_SECRET_KEY, PORT)
└── package.json            (Dependencies)
```

---

## Frontend Implementation

### Key Methods in app.js

**handleTierChange()** — Show/hide frequency dropdown
```javascript
if (tier === 'open-door') {
  frequencyDropdown.style.display = 'none';
  amount = 0;
  button.innerHTML = 'Join our WhatsApp';
} else {
  frequencyDropdown.style.display = 'block';
  calculateAmount();
}
```

**calculateAmount()** — Lookup table (no math)
```javascript
const lookup = {
  community: { monthly: 50, quarterly: 200, yearly: 600 },
  champion: { monthly: 500, quarterly: 2000, yearly: 6000 },
  family: { monthly: 400, quarterly: 1600, yearly: 4800 }
};
amount = lookup[tier][frequency];
```

**sendToPaystack()** — Open payment modal
```javascript
PaystackPop.setup({
  key: 'pk_test_YOUR_PUBLIC_KEY',
  email: emailInput.value,
  amount: amount * 100,  // Convert to cents
  plan: planId,          // Pre-created in Paystack dashboard
  metadata: { name, tier, frequency, phone },
  onSuccess: (response) => verifyOnBackend(response.reference),
  onCancel: () => showError('Payment cancelled')
}).openIframe();
```

**verifyOnBackend()** — Send reference to backend
```javascript
fetch('/verify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reference: response.reference,
    firstName: firstNameInput.value,
    lastName: lastNameInput.value,
    email: emailInput.value,
    phone: phoneInput.value
  })
})
.then(res => res.json())
.then(data => {
  if (data.verified) {
    window.location.href = 'welcome.html';
  } else {
    showError('Payment verification failed.');
  }
});
```

---

## Backend Implementation

### server.js
```javascript
const express = require('express');
const paymentRoutes = require('./routes/payments');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.post('/verify-payment', paymentRoutes.verifyPayment);
app.listen(process.env.PORT, () => console.log(`Server on port ${process.env.PORT}`));
```

### routes/payments.js — verifyPayment()
```javascript
exports.verifyPayment = async (req, res) => {
  const { reference, firstName, lastName, phone } = req.body;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    // Step 1: Verify transaction
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return res.json({ verified: false });
    }

    // Step 2: Update customer in Paystack
    const customerId = verifyData.data.customer.id;
    await fetch(`https://api.paystack.co/customer/${customerId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        phone: phone || ''
      })
    });

    res.json({ verified: true });
  } catch (error) {
    console.error(error);
    res.json({ verified: false, error: error.message });
  }
};
```

### .env
```
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PORT=3000
```

---

## Paystack Setup (Required Before Launch)

**Create these plans in Paystack Dashboard:**

| Plan | Interval | Amount (ZAR) |
|---|---|---|
| Community Monthly | Monthly | 5,000 (R50) |
| Community Quarterly | Quarterly | 20,000 (R200) |
| Community Yearly | Yearly | 60,000 (R600) |
| Champion Monthly | Monthly | 50,000 (R500) |
| Champion Quarterly | Quarterly | 200,000 (R2,000) |
| Champion Yearly | Yearly | 600,000 (R6,000) |
| Family Monthly | Monthly | 40,000 (R400) |
| Family Quarterly | Quarterly | 160,000 (R1,600) |
| Family Yearly | Yearly | 480,000 (R4,800) |

Copy Plan IDs into frontend lookup table.

---

## Deployment

### Frontend (Netlify)
- Drag folder to netlify.com
- Auto-deploys on git push
- Gets free HTTPS + SSL
- Update `fetch('/verify-payment')` to point to backend URL

### Backend (Heroku/Railway/Render)
- Set environment variables (SECRET_KEY, PUBLIC_KEY, PORT)
- Frontend calls: `https://your-backend.com/verify-payment`

---

## Welcome Page (welcome.html)

Replace generic "Transaction Success" with:
```html
<h1>Welcome to AMF!</h1>
<p>We've sent a confirmation email to [email].</p>
<p>Join our community:</p>
<a href="https://chat.whatsapp.com/your-group" class="btn">
  Join WhatsApp Community
</a>
<p>Roland will get back to you shortly with next steps.</p>
<a href="https://amf.org.za" class="btn-secondary">Return to AMF</a>
```

---

## Testing Checklist

- [ ] All form fields validate (required fields)
- [ ] Amount updates correctly for all 9 tier/frequency combinations
- [ ] Open Door tier hides frequency dropdown
- [ ] Paystack modal opens with correct amount in cents
- [ ] Backend receives reference + user data
- [ ] Paystack verifies payment successfully
- [ ] Paystack customer record updates with name
- [ ] Frontend redirects to welcome.html after verification
- [ ] Mobile responsive on both desktop and mobile
- [ ] Test with Paystack test keys first
- [ ] Switch to live keys before production launch

---

## Key Architectural Decisions

| Decision | Why |
|---|---|
| Backend verification | Paystack requires SECRET_KEY verification; prevents fraud |
| Customer name sync | Fixes "No name" issue in Paystack dashboard |
| Welcome page not success | Paystack already shows transaction status; avoid redundancy |
| Frontend-initiated verification | onSuccess callback is unavoidable; using it is the right pattern |
| Lookup table not math | Fixed pricing reduces calculation errors and complexity |
| Separate endpoints | Each file has one responsibility; easier to test and maintain |

---

**Status:** Ready for development  
**Architecture:** Finalized and validated  
**Security:** Backend verified, compliant with Paystack requirements
