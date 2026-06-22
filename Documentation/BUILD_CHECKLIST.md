# Build Checklist — What You Need to Add

## Frontend Updates (Small Changes)

### ✏️ Update `app.js` — ONE Function Change

**What to update:** The `handleSuccess()` function

**Current code (WRONG):**
```javascript
function handleSuccess(response) {
    sessionStorage.setItem('successData', JSON.stringify({...}));
    window.location.href = 'success.html';
}
```

**New code (CORRECT):**
```javascript
function handleSuccess(response) {
    // Send to backend for verification
    fetch('https://your-backend-url.com/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reference: response.reference,
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            email: emailInput.value,
            phone: phoneInput.value || ''
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.verified) {
            sessionStorage.setItem('successData', JSON.stringify({
                reference: response.reference,
                amount: window.selectedAmount,
                timestamp: new Date().toISOString()
            }));
            window.location.href = 'success.html';
        } else {
            document.getElementById('form-error').innerText = 
                'Payment verification failed. Please contact support.';
        }
    })
    .catch(err => {
        console.error('Verification error:', err);
        document.getElementById('form-error').innerText = 
            'Network error. Please try again.';
    });
}
```

**That's it for frontend.** Everything else stays the same.

---

## Backend — Build From Scratch (REQUIRED)

### 📦 Step 1: Initialize Node.js Project

```bash
# Create project directory
mkdir amf-backend
cd amf-backend

# Initialize npm
npm init -y

# Install dependencies
npm install express dotenv node-fetch cors
```

### 🔐 Step 2: Create `.env` File

```
PAYSTACK_SECRET_KEY=sk_test_PASTE_YOUR_SECRET_KEY_HERE
PAYSTACK_PUBLIC_KEY=pk_test_PASTE_YOUR_PUBLIC_KEY_HERE
PORT=3000
NODE_ENV=development
```

**Where to get these:**
- Go to Paystack Dashboard → Settings → API Keys
- Copy the test secret key and public key
- Paste into `.env`

### 📄 Step 3: Create `server.js`

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// Import routes
const verifyPayment = require('./routes/payments');

// Routes
app.post('/verify-payment', verifyPayment.verifyPayment);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
```

### 🛣️ Step 4: Create `routes/payments.js`

```javascript
const fetch = require('node-fetch');

exports.verifyPayment = async (req, res) => {
  try {
    const { reference, firstName, lastName, email, phone } = req.body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    console.log(`Verifying payment: ${reference}`);

    // ===== STEP 1: VERIFY TRANSACTION =====
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`
        }
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      console.log('❌ Payment verification failed');
      return res.status(400).json({
        verified: false,
        message: 'Payment verification failed'
      });
    }

    console.log('✅ Payment verified');

    // ===== STEP 2: UPDATE CUSTOMER =====
    const customerId = verifyData.data.customer.id;
    const amount = verifyData.data.amount / 100; // Convert from cents

    const updateResponse = await fetch(
      `https://api.paystack.co/customer/${customerId}`,
      {
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
      }
    );

    const updateData = await updateResponse.json();

    if (!updateData.status) {
      console.log('⚠️ Customer update failed (but payment is verified)');
      return res.json({
        verified: true,
        message: 'Payment verified but customer update failed',
        customerId: customerId,
        amount: amount
      });
    }

    console.log('✅ Customer updated in Paystack');

    // ===== SUCCESS =====
    return res.status(200).json({
      verified: true,
      message: 'Payment verified and customer updated',
      customerId: customerId,
      amount: amount,
      customerName: `${firstName} ${lastName}`,
      email: email
    });

  } catch (error) {
    console.error('❌ Backend error:', error.message);
    return res.status(500).json({
      verified: false,
      message: 'Server error',
      error: error.message
    });
  }
};
```

### 📝 Step 5: Create `package.json` (if npm init didn't create proper one)

```json
{
  "name": "amf-backend",
  "version": "1.0.0",
  "description": "Backend for AMF Paystack membership form",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "node-fetch": "^2.6.11"
  }
}
```

---

## Testing the Backend Locally

### 1. Start the backend
```bash
npm start
# Should show: ✅ Backend running on http://localhost:3000
```

### 2. Test the endpoint (using curl or Postman)

```bash
curl -X POST http://localhost:3000/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "T407760427792707",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+27123456789"
  }'
```

**Expected response:**
```json
{
  "verified": true,
  "message": "Payment verified and customer updated",
  "customerId": 123456,
  "amount": 4800,
  "customerName": "John Doe",
  "email": "john@example.com"
}
```

### 3. Check Paystack dashboard
- Go to Customers
- Find "John Doe"
- Should now show name instead of "No name"

---

## Updating Frontend to Use Backend

In your form's `app.js`, change this line in `handleSuccess()`:

```javascript
// BEFORE: (fake URL)
fetch('https://your-backend-url.com/verify-payment', {

// AFTER: (your actual backend URL)
fetch('http://localhost:3000/verify-payment', {  // For local testing
// OR
fetch('https://your-deployed-backend.com/verify-payment', {  // For production
```

---

## File Summary

| File | Status | Action |
|---|---|---|
| `index.html` | ✅ Exists | No change |
| `app.js` | ✅ Exists | **UPDATE:** `handleSuccess()` function |
| `styles.css` | ✅ Exists | No change |
| `success.html` | ✅ Exists | No change |
| `server.js` | ❌ Missing | **CREATE** — Express app |
| `routes/payments.js` | ❌ Missing | **CREATE** — Verify endpoint |
| `.env` | ❌ Missing | **CREATE** — Store secrets |
| `package.json` | ❌ Missing | **CREATE** — Dependencies |

---

## Deployment Steps (After Testing)

### Frontend (Already on Netlify)
- No changes needed
- Just update the backend URL in `app.js` to your production backend

### Backend (New)
Choose one:
- **Heroku** (free tier available)
- **Railway** (generous free tier)
- **Render** (free tier available)
- **AWS** (or your own server)

Steps:
1. Push code to GitHub
2. Connect to hosting platform
3. Set environment variables (PAYSTACK_SECRET_KEY, etc.)
4. Deploy
5. Update frontend to use new backend URL

---

## Quick Troubleshooting

| Error | Solution |
|---|---|
| "Cannot find module 'express'" | Run `npm install` |
| "PORT 3000 already in use" | Change PORT in `.env` to 3001 |
| "PAYSTACK_SECRET_KEY is undefined" | Check `.env` file exists and has correct key |
| "Backend URL not found" | Make sure frontend is calling correct backend URL |
| "Customer name still shows 'No name'" | Check Paystack dashboard — refresh page |

---

**Ready to build?** Start with Step 1 above.
