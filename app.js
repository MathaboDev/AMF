/**
 * Active Mobility Forum — Membership form logic (vanilla JS)
 * 
 * Handles form validation, Paystack payment integration, and result tracking.
 * 
 * BEFORE LAUNCHING TO PRODUCTION:
 * 1. Replace CONFIG.PAYSTACK_PUBLIC_KEY with live key from https://dashboard.paystack.com
 * 2. Replace CONFIG.WHATSAPP_INVITE_URL with your actual group invite link
 * 3. Verify all CONFIG.PLAN_IDS match your Paystack plan IDs
 * 4. Test payment flow with test card: 4111111111111111 (Paystack test mode)
 */

(function () {
  "use strict";

  // ========== CONFIGURATION ==========
  
  var CONFIG = {
    BACKEND_URL: "http://localhost:3000", //change with backend url
    PAYSTACK_PUBLIC_KEY: "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    WHATSAPP_INVITE_URL: "https://chat.whatsapp.com/your-invite-code",
    
    // Sticky summary breakpoints
    STICKY_BREAKPOINT: 1024,
    STICKY_OFFSET: 36,
    
    TIERS: {
      "open-door":  { label: "Open Door",          base: 0   },
      "community":  { label: "Community Advocate", base: 50  },
      "champion":   { label: "Champion Advocate",  base: 500 },
      "family":     { label: "Family Advocate",    base: 400 }
    },
    
    FREQUENCIES: {
      monthly:   { label: "Monthly",   months: 1  },
      quarterly: { label: "Quarterly", months: 3  },
      yearly:    { label: "Yearly",    months: 12 }
    },
    
    PLAN_IDS: {
      "community-monthly":   "PLAN_CMO",
      "community-quarterly": "PLAN_CQT",
      "community-yearly":    "PLAN_CYR",
      "champion-monthly":    "PLAN_CHM",
      "champion-quarterly":  "PLAN_CHQT",
      "champion-yearly":     "PLAN_CHYR",
      "family-monthly":      "PLAN_FAM",
      "family-quarterly":    "PLAN_FAQT",
      "family-yearly":       "PLAN_FAYR"
    }
  };

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Query selector helper
   * @param {string} sel - CSS selector
   * @param {Element} root - Element to search within (defaults to document)
   * @returns {Element|null}
   */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /**
   * Format number as South African Rand
   * @param {number} n - Amount to format
   * @returns {string} - Formatted amount (e.g., "R1,250.00")
   */
  function fmtZAR(n) {
    return "R" + n.toLocaleString("en-ZA");
  }

  /**
   * Calculate total amount based on tier and frequency
   * @param {string} tier - Membership tier key
   * @param {string} freq - Payment frequency key
   * @returns {number} - Total amount in ZAR
   */
  function calcAmount(tier, freq) {
    return CONFIG.TIERS[tier].base * CONFIG.FREQUENCIES[freq].months;
  }

  /**
   * Determine if selected tier is "Open Door" (free)
   * @param {string} tierValue - Tier value from select element
   * @returns {boolean}
   */
  function isOpenDoor(tierValue) {
    return tierValue === "open-door";
  }

  // ========== ERROR HANDLING ==========

  /**
   * Classify payment error into a user-friendly category
   * @param {Error} error - Error object from Paystack
   * @returns {Object} - { reason: string, message: string }
   */
  function classifyError(error) {
    if (!error || !error.message) {
      return {
        reason: "error",
        message: "Payment processing error. Please try again."
      };
    }

    var msg = error.message.toLowerCase();

    if (msg.includes("declined") || msg.includes("rejected")) {
      return {
        reason: "declined",
        message: error.message
      };
    }

    if (msg.includes("network") || msg.includes("timeout")) {
      return {
        reason: "network",
        message: error.message
      };
    }

    return {
      reason: "error",
      message: "Payment processing error. Please try again."
    };
  }

  /**
   * Record failure to sessionStorage and redirect to success page
   * Success page will detect failure and display appropriate message
   * @param {string} tier - Membership tier label
   * @param {string} freq - Frequency label
   * @param {number} amount - Amount in ZAR
   * @param {string} email - User email
   * @param {string} reason - Error reason (cancelled|declined|network|error)
   * @param {string} message - Error message to display
   */
  function recordFailure(tier, freq, amount, email, reason, message) {
    try {
      sessionStorage.setItem("amf:failure", JSON.stringify({
        email: email,
        tier: tier,
        amount: amount,
        frequency: freq,
        reason: reason,
        message: message,
        at: new Date().toISOString(),
        formUrl: "index.html"
      }));
    } catch (err) {
      console.error("Failed to save failure state:", err);
    }
    window.location.href = "success.html";
  }

  /**
   * Record success to sessionStorage and redirect to success page
   * @param {Object} data - Success data to store
   */
  function recordSuccess(data) {
    try {
      sessionStorage.setItem("amf:success", JSON.stringify({
        amount: data.amount,
        tier: data.tier,
        frequency: data.frequency,
        reference: data.reference,
        email: data.email,
        name: data.name,
        at: new Date().toISOString()
      }));
    } catch (err) {
      console.error("Failed to save success state:", err);
    }
    window.location.href = "success.html";
  }

  // ========== PAYSTACK CONFIGURATION ==========

  /**
   * Build metadata custom fields for Paystack
   * @param {string} firstName - User first name
   * @param {string} lastName - User last name
   * @param {string} tier - Tier label
   * @param {string} frequency - Frequency label
   * @param {string} phone - Phone number (optional)
   * @returns {Array} - Custom fields array for Paystack
   */
  function buildMetadata(firstName, lastName, tier, frequency, phone) {
    return [
      {
        display_name: "Name",
        variable_name: "name",
        value: firstName + " " + lastName
      },
      {
        display_name: "Tier",
        variable_name: "tier",
        value: tier
      },
      {
        display_name: "Frequency",
        variable_name: "frequency",
        value: frequency
      },
      {
        display_name: "Phone",
        variable_name: "phone",
        value: phone || "—"
      }
    ];
  }

  /**
   * Create Paystack success callback
   * @param {Object} params - { tier, frequency, email, firstName, lastName, amount }
   * @returns {Function}
   */
  function createPaystackSuccessHandler(params) {
    return function (response) {
      recordSuccess({
        amount: params.amount,
        tier: params.tier,
        frequency: params.frequency,
        reference: response.reference,
        email: params.email,
        name: params.firstName + " " + params.lastName
      });
    };
  }

  /**
   * Create Paystack cancel callback
   * @param {Object} params - { tier, frequency, email, amount }
   * @returns {Function}
   */
  function createPaystackCancelHandler(params) {
    return function () {
      var ctaBtn = $("#cta");
      ctaBtn.disabled = false;
      ctaBtn.textContent = "Pay now";

      recordFailure(
        params.tier,
        params.frequency,
        params.amount,
        params.email,
        "cancelled",
        "You cancelled the payment. No amount was charged to your account."
      );
    };
  }

  /**
   * Create Paystack error callback
   * @param {Object} params - { tier, frequency, email, amount }
   * @returns {Function}
   */
  function createPaystackErrorHandler(params) {
    return function (error) {
      var ctaBtn = $("#cta");
      ctaBtn.disabled = false;
      ctaBtn.textContent = "Pay now";

      var classified = classifyError(error);

      recordFailure(
        params.tier,
        params.frequency,
        params.amount,
        params.email,
        classified.reason,
        classified.message
      );
    };
  }

  /**
   * Build complete Paystack configuration object
   * @param {Object} params - Form data and settings
   * @returns {Object} - PaystackPop.setup() configuration
   */
  function buildPaystackConfig(params) {
    return {
      key: CONFIG.PAYSTACK_PUBLIC_KEY,
      email: params.email,
      amount: params.amount * 100, // Convert to kobo
      currency: "ZAR",
      plan: params.planId,
      metadata: {
        custom_fields: buildMetadata(
          params.firstName,
          params.lastName,
          params.tierLabel,
          params.frequencyLabel,
          params.phone
        )
      },
      onSuccess: createPaystackSuccessHandler(params),
      onCancel: createPaystackCancelHandler({
        tier: params.tierLabel,
        frequency: params.frequencyLabel,
        amount: params.amount,
        email: params.email
      }),
      onError: createPaystackErrorHandler({
        tier: params.tierLabel,
        frequency: params.frequencyLabel,
        amount: params.amount,
        email: params.email
      })
    };
  }

  // ========== FORM HANDLING ==========

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("#membership-form");
    if (!form) return;

    // Capture form elements
    var firstName = $("#firstName");
    var lastName = $("#lastName");
    var email = $("#email");
    var phone = $("#phone");
    var tierSel = $("#tier");
    var freqField = $("#frequency-field");
    var freqSel = $("#frequency");
    var alertBox = $("#form-alert");
    var cta = $("#cta");
    var sumTier = $("#sum-tier");
    var sumFreq = $("#sum-freq");
    var sumTotal = $("#sum-total");
    var sumNote = $("#sum-note");
    var summaryCard = $("#summary-card");

    /**
     * Display or hide form validation error
     * @param {string|null} msg - Error message, or null to hide
     */
    function setError(msg) {
      if (!msg) {
        alertBox.style.display = "none";
        alertBox.textContent = "";
        return;
      }
      alertBox.style.display = "block";
      alertBox.textContent = msg;
    }

    /**
     * Update summary card to reflect current form selections
     * Animates changes with fade-in effect
     */
    function updateSummary() {
      var tierValue = tierSel.value;
      var freqValue = freqSel.value;
      var isOpen = isOpenDoor(tierValue);

      // Show/hide frequency selector for non-free tiers
      freqField.style.display = isOpen ? "none" : "";

      // Trigger animation on summary fields
      [sumTier, sumFreq, sumTotal].forEach(function (el) {
        el.classList.remove("fade-swap");
        // Force reflow to restart animation
        void el.offsetWidth;
        el.classList.add("fade-swap");
      });

      // Update summary content
      sumTier.textContent = CONFIG.TIERS[tierValue].label;
      sumFreq.textContent = isOpen ? "—" : CONFIG.FREQUENCIES[freqValue].label;

      var amount = isOpen ? 0 : calcAmount(tierValue, freqValue);
      sumTotal.textContent = amount === 0 ? "Free" : fmtZAR(amount);

      // Update payment frequency note
      if (!isOpen) {
        var noteText;
        if (freqValue === "monthly") {
          noteText = "Your card will automatically be charged every month.";
        } else if (freqValue === "quarterly") {
          noteText = "Your card will automatically be charged every 3 months.";
        } else {
          noteText = "Your card will automatically be charged every 12 months.";
        }
        sumNote.textContent = noteText;
        sumNote.style.display = "block";
      } else {
        sumNote.style.display = "none";
      }

      // Update CTA button text
      cta.textContent = isOpen ? "Join our WhatsApp Community" : "Pay now";
    }

    /**
     * Validate form fields
     * @returns {boolean} - True if valid, false otherwise
     */
    function validate() {
      if (!firstName.value.trim() || !lastName.value.trim()) {
        setError("Please enter your first and last name.");
        return false;
      }

      // Simple email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        setError("Please enter a valid email address.");
        return false;
      }

      setError(null);
      return true;
    }

    /**
     * Handle form submission
     * Routes to either WhatsApp (free tier) or Paystack payment
     * @param {Event} e - Form submit event
     */
    function handleSubmit(e) {
      e.preventDefault();

      if (!validate()) return;

      var tierValue = tierSel.value;
      var freqValue = freqSel.value;
      var isOpen = isOpenDoor(tierValue);

      // ===== OPEN DOOR (FREE) TIER =====
      if (isOpen) {
        window.open(CONFIG.WHATSAPP_INVITE_URL, "_blank", "noopener");
        return;
      }

      // ===== PAID TIERS - INITIATE PAYSTACK =====

      // Verify Paystack library is available
      if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
        setError("Payment library still loading. Please try again in a moment.");
        return;
      }

      var amount = calcAmount(tierValue, freqValue);
      var planId = CONFIG.PLAN_IDS[tierValue + "-" + freqValue];

      // Disable button during payment initialization
      cta.disabled = true;
      cta.textContent = "Opening Paystack…";

      try {
        // Build and initialize Paystack
        var paystackConfig = buildPaystackConfig({
          email: email.value.trim(),
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          phone: phone.value,
          tier: tierValue,
          tierLabel: CONFIG.TIERS[tierValue].label,
          frequency: freqValue,
          frequencyLabel: CONFIG.FREQUENCIES[freqValue].label,
          amount: amount,
          planId: planId
        });

        var handler = window.PaystackPop.setup(paystackConfig);
        handler.openIframe();
      } catch (err) {
        // Reset button state
        cta.disabled = false;
        cta.textContent = "Pay now";

        // Record the initialization error
        recordFailure(
          CONFIG.TIERS[tierValue].label,
          CONFIG.FREQUENCIES[freqValue].label,
          amount,
          email.value.trim(),
          "error",
          err && err.message
            ? err.message
            : "Failed to initialize payment. Please try again."
        );
      }
    }

    /**
     * Handle scroll events for sticky summary card
     * Adds shadow when summary becomes sticky on desktop
     */
    function onScroll() {
      if (!summaryCard) return;

      var rect = summaryCard.getBoundingClientRect();
      var isStuck =
        rect.top <= CONFIG.STICKY_OFFSET &&
        window.innerWidth >= CONFIG.STICKY_BREAKPOINT;

      if (isStuck) {
        summaryCard.classList.add("is-stuck");
      } else {
        summaryCard.classList.remove("is-stuck");
      }
    }

    // ===== EVENT LISTENERS =====
    tierSel.addEventListener("change", updateSummary);
    freqSel.addEventListener("change", updateSummary);
    form.addEventListener("submit", handleSubmit);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Initialize
    updateSummary();
    onScroll();
  });
})();
