# AMF Membership Form — Backend Verification Architecture

## Executive Summary

A membership signup form with **Paystack subscription management** and **server-side payment verification**. Users select a tier (Community/Champion/Family) and frequency (monthly/quarterly/yearly), pay via Paystack, and are automatically added to recurring billing.

**Key Change:** Added backend verification to comply with Paystack's API requirements and ensure customer data is complete in Paystack.

---

## What Changed & Why

### Previous Approach (Frontend-Only)
- Form → Paystack popup → User pays → `onSuccess` callback → Show success page
- **Problem:** No server-side verification; customer names appeared as "No name" in Paystack

### Paystack's Requirement
From Paystack's official guidance:
> "After the user pays, **call the verify API endpoint on your server** to confirm the payment. All calls to Paystack require your secret key in the Authorization header."

### New Approach (Frontend + Backend)
- Form → Paystack popup → User pays → `onSuccess` callback
- **Send reference to backend** → Backend verifies with Paystack (secret key)
- **Backend updates customer name** in Paystack → Success page shows complete data
- **Paystack dashboard** now displays full member details

**Why This Matters:**
1. ✅ Verify payment is real (not just frontend callback)
2. ✅ Update customer name in Paystack (fixes "No name" issue)
3. ✅ Comply with Paystack's official API workflow
4. ✅ Audit trail: proof that payment was verified server-side

---

## User Journey

```
1. User visits form
   ├─ Selects: Tier (Community/Champion/Family)
   ├─ Selects: Frequency (Monthly/Quarterly/Yearly)
   └─ Enters: First Name, Last Name, Email, Phone (optional)

2. Sees live summary
   └─ "You are choosing: Champion Advocate - Quarterly"
   └─ "Total amount: R2,000"

3. Clicks "Proceed to Payment"
   └─ Paystack modal opens

4. Enters card details (Paystack handles security)
   └─ Card: 4111 1111 1111 1111 (test)
   └─ Payment processes

5. Paystack sends reference to frontend
   └─ Frontend receives: reference, status

6. Frontend sends reference + user data to BACKEND
   └─ Backend: /verify-payment endpoint

7. BACKEND verifies with Paystack API (secret key)
   ├─ Calls: https://api.paystack.co/transaction/verify/{reference}
   └─ Gets: confirmation + customer ID

8. BACKEND updates customer in Paystack
   ├─ Calls: https://api.paystack.co/customer/{id}
   ├─ Updates: first_name, last_name, phone
   └─ Paystack now shows: "John Doe" (not "No name")

9. Frontend shows success page
   └─ "Payment successful. Welcome to AMF!"

10. Paystack automatically handles recurring charges
    └─ Monthly: Every month on signup date
    └─ Quarterly: Every 3 months
    └─ Yearly: Every 12 months

11. Admin (AMF) checks Paystack dashboard
    └─ Sees all members with complete names
    └─ Sees all transactions, subscription status, revenue
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (index.html)                     │
│ • Tier + Frequency dropdown                                  │
│ • Name, Email, Phone fields                                  │
│ • PaystackPop.setup() with PUBLIC key (safe)                │
│ • Sends reference to backend on success                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ reference + user data
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Node.js / verify-payment)             │
│ • Receives: reference, firstName, lastName, email, phone    │
│ • Calls: Paystack Verify API (with SECRET key)              │
│ • Calls: Paystack Update Customer API (with SECRET key)     │
│ • Returns: { verified: true/false }                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ verification result
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         PAYSTACK (Their servers — PCI compliant)            │
│ • Stores: Customer data (first_name, last_name, phone)      │
│ • Manages: Subscription plans, recurring charges            │
│ • Sends: Webhooks on charge success/failure                 │
│ • Dashboard: Shows all members, transactions, revenue       │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure (Updated)

```
amf-membership-form/
│
├── FRONTEND (Netlify)
│   ├── index.html              ← Form structure + Paystack script
│   ├── app.js                  ← Form logic, validation, API calls
│   ├── styles.css              ← Responsive styling
│   ├── success.html            ← Success/failure page
│   └── netlify.toml            (optional) Redirect config
│
├── BACKEND (Node.js — your server)
│   ├── server.js               ← Express server (NEW — REQUIRED)
│   ├── routes/
│   │   └── payments.js         ← POST /verify-payment (NEW — REQUIRED)
│   ├── .env                    ← SECRET_KEY, PUBLIC_KEY (NEW — REQUIRED)
│   └── package.json            ← Dependencies (NEW — REQUIRED)
│
└── DOCS
    ├── README.md               ← This file
    └── DEPLOYMENT.md           (optional) Hosting instructions
```

---

## What's Missing (Must Build)

| Item | File | Purpose |
|---|---|---|
| ✅ Form | `index.html` | Already exists |
| ✅ Styling | `styles.css` | Already exists |
| ✅ Logic | `app.js` | **UPDATE:** Add backend call in `onSuccess` |
| ✅ Success page | `success.html` | Already exists |
| ❌ Backend server | `server.js` | **NEW: Required** — Express app |
| ❌ Verify endpoint | `routes/payments.js` | **NEW: Required** — Paystack API calls |
| ❌ Environment file | `.env` | **NEW: Required** — Store SECRET_KEY |
| ❌ Dependencies | `package.json` | **NEW: Required** — Node packages |

---

## Backend Setup (Required)

### 1. Create Node.js Project
```bash
npm init -y
npm install express dotenv node-fetch cors
```

### 2. Create `.env`
```
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PORT=3000
```

### 3. Create `server.js`
```javascript
const express = require('express');
const paymentRoutes = require('./routes/payments');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.post('/verify-payment', paymentRoutes.verifyPayment);

app.listen(process.env.PORT, () => {
  console.log(`Backend running on port ${process.env.PORT}`);
});
```

### 4. Create `routes/payments.js`
```javascript
const fetch = require('node-fetch');

exports.verifyPayment = async (req, res) => {
  const { reference, firstName, lastName, phone } = req.body;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    // Step 1: Verify transaction
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` }
      }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return res.json({ verified: false });
    }

    // Step 2: Update customer
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

---

## Frontend Update (Required)

In `app.js`, update `handleSuccess()`:

```javascript
function handleSuccess(response) {
  fetch('/verify-payment', {  // ← Send to YOUR backend
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
      sessionStorage.setItem('successData', JSON.stringify({...}));
      window.location.href = 'success.html';
    } else {
      showError('Payment verification failed.');
    }
  });
}
```

---

## Deployment

**Frontend (Netlify):**
- Drag project folder → netlify.com
- Gets HTTPS + free SSL

**Backend (Heroku/Railway/Render):**
- Set environment variables (SECRET_KEY, PUBLIC_KEY)
- Update frontend to call backend URL: `https://your-backend.com/verify-payment`

---

## Paystack Plans (Pre-Created)

You must create these plans in Paystack Dashboard → Plans:

| Plan Name | Amount | Interval | Plan ID |
|---|---|---|---|
| Community Monthly | R50 | Monthly | `PLN_k9zqr6la5vxk9yp` |
| Community Quarterly | R200 | Quarterly | `PLN_zkisy4f2qwfn3x7` |
| Community Yearly | R600 | Yearly | (create) |
| Champion Monthly | R500 | Monthly | (create) |
| Champion Quarterly | R2,000 | Quarterly | `PLN_w570e9g90wkw1ur` |
| Champion Yearly | R6,000 | Yearly | (create) |
| Family Monthly | R400 | Monthly | (create) |
| Family Quarterly | R1,600 | Quarterly | (create) |
| Family Yearly | R4,800 | Yearly | `PLN_hlcmzpngewf3ur2` |

---

## Testing Checklist

- [ ] Form validates all fields
- [ ] Paystack modal opens
- [ ] Test card charges successfully
- [ ] Backend receives reference
- [ ] Paystack confirms payment
- [ ] Customer name updates in Paystack dashboard
- [ ] Success page displays
- [ ] All tier/frequency combinations tested (9 total)
- [ ] Mobile responsiveness verified
- [ ] Switch to live keys before launch

---

## Key Differences From Original

| Original | Updated | Reason |
|---|---|---|
| Frontend-only flow | Frontend + Backend | Paystack requires server verification |
| No customer name update | Backend updates Paystack | Fix "No name" issue |
| Trust `onSuccess` callback | Verify with secret key | Security + compliance |
| No audit trail | Verified server-side | Proof for disputes |

---

**Status:** Ready for backend development  
**Last Updated:** June 22, 2026
