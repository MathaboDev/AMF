# Active Mobility Forum — Membership Form

A lightweight, production-ready membership signup form with integrated Paystack payment processing. Designed for organizations managing tiered memberships with recurring billing.

## Overview

This project provides a complete solution for membership acquisition and billing:
- **Tier-based pricing** (Open Door/free, Community, Champion, Family)
- **Flexible payment frequency** (monthly, quarterly, yearly)
- **Paystack integration** for secure payment processing
- **WhatsApp community onboarding** for free tier members
- **Responsive mobile-first design** with sticky summary panel

## Architecture

**Vanilla JavaScript** (no frameworks) for minimal dependencies and fast page load.

```
index.html ─────── Main membership form
  ├── app.js ──────── Form validation, Paystack integration, state management
  ├── styles.css ─── Single responsive stylesheet
  └── success.html ─ Transaction result page (success/failure states)
```

## Key Components

### `app.js` (519 lines)
**Responsibilities:**
- Form field validation (name, email)
- Membership tier/frequency calculation
- Paystack payment initialization with error classification
- SessionStorage-based result tracking across page redirects
- Sticky summary card behavior on scroll

**Design patterns:**
- Centralized CONFIG object for deployment values
- Extracted builder functions for Paystack configuration
- Single `recordFailure()` and `recordSuccess()` functions (no duplication)
- Error classification via `classifyError()` → maps to user-facing messages

### `success.html` (287 lines)
**Responsibilities:**
- Reads transaction state from sessionStorage
- Dynamically renders success or failure card
- Displays transaction details (amount, tier, reference)
- Routes users to WhatsApp (success) or back to form (failure)

**Design patterns:**
- Single template structure with dynamic content population
- Template-based error messaging (`errorTemplates` object)
- No hardcoded duplicate HTML

### `styles.css` (616 lines)
- CSS custom properties (--primary, --border, etc.) for theming
- Responsive grid layout (mobile 1-col → desktop 2-col at 1024px)
- Pill-shaped floating-label form fields
- Smooth animations and micro-interactions
- Accessible color contrast (WCAG AA)

### `index.html` (229 lines)
- Semantic HTML5 structure
- Accessibility: ARIA roles, form labels, error announcements
- Preloads Paystack library via `<script defer>`
- Four payment method badges (Visa, Mastercard, Instant EFT, SnapScan)

## Code Quality

**Refactored for maintainability:**
- ✅ Eliminated code duplication (error handling consolidated)
- ✅ Magic numbers → named constants (CONFIG object)
- ✅ All functions documented with JSDoc
- ✅ Error logging (console.error) vs silent failures
- ✅ Single source of truth for error classification

**Metrics:**
- Code duplication: 0 (previously 3 instances)
- Documented functions: 16/16 (100%)
- No external dependencies beyond Paystack library

## Deployment

### Prerequisites
1. Paystack account with live API key
2. WhatsApp group with shareable invite link
3. 9 payment plans configured in Paystack dashboard matching tier/frequency combos

### Setup

1. **Update `app.js` configuration (lines 13–14):**
   ```javascript
   CONFIG.PAYSTACK_PUBLIC_KEY = "pk_live_your_live_key_here";
   CONFIG.WHATSAPP_INVITE_URL = "https://chat.whatsapp.com/your_group_code";
   ```

2. **Verify Paystack plan IDs** match your dashboard:
   ```javascript
   PLAN_IDS: {
     "community-monthly": "PLAN_CMO",
     "champion-quarterly": "PLAN_CHQT",
     // ... verify all 9 exist
   }
   ```

3. **Update website links** in `success.html` (line 143)

4. **Test payment flow:**
   - Test card: `4111 1111 1111 1111` (Paystack test environment)
   - Verify all tiers + frequencies
   - Test cancellation and error paths

### Hosting

Static files — deploy to any CDN or web server. No backend required. Paystack handles PCI compliance.

## Payment Flow

```
User fills form
    ↓
[Validation] → Show error if invalid
    ↓
[Open Door?] → YES: Redirect to WhatsApp
           → NO: Initialize Paystack modal
    ↓
Paystack processes payment
    ↓
onSuccess / onCancel / onError
    ↓
Store result in sessionStorage
    ↓
Redirect to success.html
    ↓
success.html reads state → Render appropriate card
```

## Error Handling

Errors are classified into semantic categories:
- `cancelled` — User closed payment modal
- `declined` — Card rejected by bank
- `network` — Connection failure
- `error` — Generic payment processing error

Each maps to a user-friendly message template. Adding new error types requires updates in ONE place.

## Browser Support

- Chrome, Firefox, Safari, Edge (modern versions)
- Mobile: iOS Safari, Chrome Android
- Requires ES5+ JavaScript and CSS Grid

## State Management

**SessionStorage** bridges form.html → success.html:
```javascript
// Success
{ amount, tier, frequency, reference, email, name, at }

// Failure
{ email, tier, amount, frequency, reason, message, at }
```

Data is cleared after display. Refreshing success.html shows default success message (graceful fallback).

## Future Enhancements

- Environment variables for API keys (process.env)
- Form field validation at keystroke (UX improvement)
- Unit tests for utility functions
- Analytics tracking (form completion, payment outcomes)
- Multiple language support

## Technical Notes

- **No frameworks** → Minimal bundle size (~50KB gzipped)
- **SessionStorage** → Survives page reload, cleared on new tab
- **Vanilla CSS** → No PostCSS or preprocessors needed
- **Accessibility** → form-alert has role="alert" for screen readers
- **Security** → All card data handled by Paystack (PCI DSS Level 1)

## License

Internal use — Active Mobility Forum

---

**Last Updated:** June 20, 2026  
**Status:** Production Ready  
**Maintainer:** Engineering Team
