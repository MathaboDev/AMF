/* Active Mobility Forum — Membership form logic (vanilla JS) */
(function () {
  "use strict";
  // ---- Config (replace before launch) ----
  var PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  var WHATSAPP_INVITE_URL = "https://chat.whatsapp.com/your-invite-code";
  var TIERS = {
    "open-door":  { label: "Open Door",          base: 0   },
    "community":  { label: "Community Advocate", base: 50  },
    "champion":   { label: "Champion Advocate",  base: 500 },
    "family":     { label: "Family Advocate",    base: 400 }
  };
  var FREQUENCIES = {
    monthly:   { label: "Monthly",   months: 1  },
    quarterly: { label: "Quarterly", months: 4  },
    yearly:    { label: "Yearly",    months: 12 }
  };
  var PLAN_IDS = {
    "community-monthly":   "PLAN_CMO",
    "community-quarterly": "PLAN_CQT",
    "community-yearly":    "PLAN_CYR",
    "champion-monthly":    "PLAN_CHM",
    "champion-quarterly":  "PLAN_CHQT",
    "champion-yearly":     "PLAN_CHYR",
    "family-monthly":      "PLAN_FAM",
    "family-quarterly":    "PLAN_FAQT",
    "family-yearly":       "PLAN_FAYR"
  };
  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmtZAR(n) { return "R" + n.toLocaleString("en-ZA"); }
  function calcAmount(tier, freq) { return TIERS[tier].base * FREQUENCIES[freq].months; }
  document.addEventListener("DOMContentLoaded", function () {
    var form        = $("#membership-form");
    if (!form) return;
    var firstName   = $("#firstName");
    var lastName    = $("#lastName");
    var email       = $("#email");
    var phone       = $("#phone");
    var tierSel     = $("#tier");
    var freqField   = $("#frequency-field");
    var freqSel     = $("#frequency");
    var alertBox    = $("#form-alert");
    var cta         = $("#cta");
    var sumTier     = $("#sum-tier");
    var sumFreq     = $("#sum-freq");
    var sumTotal    = $("#sum-total");
    var sumNote     = $("#sum-note");
    var summaryCard = $("#summary-card");
    function isOpenDoor() { return tierSel.value === "open-door"; }
    function setError(msg) {
      if (!msg) { alertBox.style.display = "none"; alertBox.textContent = ""; return; }
      alertBox.style.display = "block";
      alertBox.textContent = msg;
    }
    function updateSummary() {
      var t = tierSel.value;
      var f = freqSel.value;
      var open = isOpenDoor();
      // Show/hide frequency picker
      freqField.style.display = open ? "none" : "";
      // Swap with subtle animation
      sumTier.classList.remove("fade-swap"); void sumTier.offsetWidth; sumTier.classList.add("fade-swap");
      sumFreq.classList.remove("fade-swap"); void sumFreq.offsetWidth; sumFreq.classList.add("fade-swap");
      sumTotal.classList.remove("fade-swap"); void sumTotal.offsetWidth; sumTotal.classList.add("fade-swap");
      sumTier.textContent = TIERS[t].label;
      sumFreq.textContent = open ? "—" : FREQUENCIES[f].label;
      var amount = open ? 0 : calcAmount(t, f);
      sumTotal.textContent = amount === 0 ? "Free" : fmtZAR(amount);
      if (!open) {
        var note = f === "monthly"
          ? "Your card will automatically be charged every month."
          : f === "quarterly"
            ? "Your card will automatically be charged every 3 months."
            : "Your card will automatically be charged every 12 months.";
        sumNote.textContent = note;
        sumNote.style.display = "block";
      } else {
        sumNote.style.display = "none";
      }
      cta.textContent = open ? "Join our WhatsApp Community" : "Pay now";
    }
    function validate() {
      if (!firstName.value.trim() || !lastName.value.trim()) {
        setError("Please enter your first and last name."); return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        setError("Please enter a valid email address."); return false;
      }
      setError(null);
      return true;
    }
    function handleSubmit(e) {
      e.preventDefault();
      if (!validate()) return;
      if (isOpenDoor()) {
        window.open(WHATSAPP_INVITE_URL, "_blank", "noopener");
        return;
      }
      if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
        setError("Payment library still loading. Please try again in a moment.");
        return;
      }
      var t = tierSel.value, f = freqSel.value;
      var amount = calcAmount(t, f);
      var planId = PLAN_IDS[t + "-" + f];
      cta.disabled = true;
      cta.textContent = "Opening Paystack…";
      try {
        var handler = window.PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: email.value.trim(),
          amount: amount * 100,
          currency: "ZAR",
          plan: planId,
          metadata: {
            custom_fields: [
              { display_name: "Name",      variable_name: "name",      value: firstName.value + " " + lastName.value },
              { display_name: "Tier",      variable_name: "tier",      value: TIERS[t].label },
              { display_name: "Frequency", variable_name: "frequency", value: FREQUENCIES[f].label },
              { display_name: "Phone",     variable_name: "phone",     value: phone.value || "—" }
            ]
          },
          onSuccess: function (response) {
            try {
              sessionStorage.setItem("amf:success", JSON.stringify({
                amount: amount,
                tier: TIERS[t].label,
                frequency: FREQUENCIES[f].label,
                reference: response.reference,
                email: email.value.trim(),
                name: firstName.value + " " + lastName.value,
                at: new Date().toISOString()
              }));
            } catch (_) { /* ignore */ }
            window.location.href = "success.html";
          },
          onCancel: function () {
            cta.disabled = false;
            cta.textContent = "Pay now";
            try {
              sessionStorage.setItem("amf:failure", JSON.stringify({
                email: email.value.trim(),
                tier: TIERS[t].label,
                amount: amount,
                frequency: FREQUENCIES[f].label,
                reason: "cancelled",
                message: "You cancelled the payment. No amount was charged to your account.",
                at: new Date().toISOString(),
                formUrl: "index.html"
              }));
            } catch (_) { /* ignore */ }
            window.location.href = "success.html";
          },
          onError: function (error) {
            cta.disabled = false;
            cta.textContent = "Pay now";
            var reason = "error";
            var message = "Payment processing error. Please try again.";
            
            if (error && error.message) {
              if (error.message.toLowerCase().includes("declined") || error.message.toLowerCase().includes("rejected")) {
                reason = "declined";
                message = error.message;
              } else if (error.message.toLowerCase().includes("network") || error.message.toLowerCase().includes("timeout")) {
                reason = "network";
                message = error.message;
              }
            }
            
            try {
              sessionStorage.setItem("amf:failure", JSON.stringify({
                email: email.value.trim(),
                tier: TIERS[t].label,
                amount: amount,
                frequency: FREQUENCIES[f].label,
                reason: reason,
                message: message,
                at: new Date().toISOString(),
                formUrl: "index.html"
              }));
            } catch (_) { /* ignore */ }
            window.location.href = "success.html";
          }
        });
        handler.openIframe();
      } catch (err) {
        cta.disabled = false;
        cta.textContent = "Pay now";
        var fallbackReason = "error";
        var fallbackMsg = err && err.message ? err.message : "Failed to initialize payment. Please try again.";
        try {
          sessionStorage.setItem("amf:failure", JSON.stringify({
            email: email.value.trim(),
            tier: TIERS[t].label,
            amount: amount,
            frequency: FREQUENCIES[f].label,
            reason: fallbackReason,
            message: fallbackMsg,
            at: new Date().toISOString(),
            formUrl: "index.html"
          }));
        } catch (_) { /* ignore */ }
        window.location.href = "success.html";
      }
    }
    // Sticky shadow effect on summary while scrolling
    function onScroll() {
      if (!summaryCard) return;
      var rect = summaryCard.getBoundingClientRect();
      if (rect.top <= 36 && window.innerWidth >= 1024) {
        summaryCard.classList.add("is-stuck");
      } else {
        summaryCard.classList.remove("is-stuck");
      }
    }
    tierSel.addEventListener("change", updateSummary);
    freqSel.addEventListener("change", updateSummary);
    form.addEventListener("submit", handleSubmit);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateSummary();
    onScroll();
  });
})();