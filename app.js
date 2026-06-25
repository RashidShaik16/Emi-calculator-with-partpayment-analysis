
// Modal elements
const input = document.getElementById("partPaymentInput");
const maxHint = document.getElementById("maxAmountHint");
const confirmBtn = document.getElementById("confirmPartPayment");
const modal = document.getElementById('partPaymentModal');
const modalBox = document.getElementById('partPaymentBox');
const cancelBtn = document.getElementById('cancelPartPayment');
const downloadPdfBtn = document.getElementById("downloadPdfBtn")

let selectedMonthSerial = null;
let selectedMaxAmount = 0;
let selectedYear = null;
let selectedEmi = null;

let partPayments = [];
let dataForPdf = null;
let originalTotalInterest = 0
let newTotalInterest = 0
let currentLoanType = ""


// app.js - EMI Calculator logic
document.addEventListener('DOMContentLoaded', function() {
  emailjs.init("vGkMgPqy7msXERp1n");
  console.log("EmailJS initialized:", emailjs);
  const locale = 'en-IN';
  // const formatNumber = (v) => Number(v).toLocaleString(locale);

  // Elements
  const loanRange = document.getElementById('loanAmountRange');
  const loanInput = document.getElementById('loanAmountInput');
  const loanDisplay = document.getElementById('loanAmountDisplay');
  const rateRange = document.getElementById('interestRateRange');
  const rateInput = document.getElementById('interestRateInput');
  const rateDisplay = document.getElementById('interestRateDisplay');
  const tenureRange = document.getElementById('tenureRange');
  const tenureInput = document.getElementById('tenureInput');
  const tenureDisplay = document.getElementById('tenureDisplay');

  const monthlyEmiEl = document.getElementById('monthlyEmi');
  const totalInterestEl = document.getElementById('totalInterest');
  const totalPaymentEl = document.getElementById('totalPayment');

  const procFeeInput = document.getElementById('processingFeeInput');
  const gstInput = document.getElementById('gstInput');


const loanTypeButtons = document.querySelectorAll(".loan-type-btn");
currentLoanType = "personal";
const loanConfigs = {
  personal: { maxAmount: 5000000, minAmount:10000, maxRate: 36, maxTenure: 60 },
  home: { maxAmount: 10000000, minAmount:100000, maxRate: 15, maxTenure: 360 },
  car: { maxAmount: 3000000, minAmount:50000, maxRate: 18, maxTenure: 84 },
  credit: { maxAmount: 1000000, minAmount:10000, maxRate: 45, maxTenure: 60 },
};


// Helper to update limits
function updateLoanLimits(type) {
  const config = loanConfigs[type];
  if (!config) return;

  // Loan amount
  loanAmountRange.max = config.maxAmount;
  loanAmountRange.min = config.minAmount;
  loanAmountInput.max = config.maxAmount;
  loanAmountInput.min = config.minAmount;

  // Interest rate
  interestRateRange.max = config.maxRate;
  interestRateInput.max = config.maxRate;

  // Tenure
  tenureRange.max = config.maxTenure;
  tenureInput.max = config.maxTenure;

  // Adjust display text (optional)
  document.querySelector("#loanAmountRange + .flex span:last-child").textContent = `₹${(config.maxAmount).toLocaleString('en-IN')}`;
  document.querySelector("#loanAmountRange + .flex span:first-child").textContent = `₹${(config.minAmount).toLocaleString('en-IN')}`;
  document.querySelector("#loanAmountInput").value = 100000;
  document.querySelector("#loanAmountRange").value = 100000;
  document.querySelector("#interestRateRange + .flex span:last-child").textContent = `${config.maxRate}%`;
  document.querySelector("#tenureRange + .flex span:last-child").textContent = `${config.maxTenure}`;

  // Reset inputs if they exceed limits
  if (Number(loanAmountInput.value) > config.maxAmount) loanAmountInput.value = config.maxAmount;
  if (Number(interestRateInput.value) > config.maxRate) interestRateInput.value = config.maxRate;
  if (Number(tenureInput.value) > config.maxTenure) tenureInput.value = config.maxTenure;

  // Trigger recalculation
  updateResults();
}


// Add event listeners
loanTypeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from others
    loanTypeButtons.forEach((b) => b.classList.remove("active", "bg-blue-600", "bg-blue-800", "text-white"));
    loanTypeButtons.forEach((b) => b.classList.add("bg-gray-100", "text-gray-800"));

    // Add active class to this
    btn.classList.remove("bg-gray-100", "text-gray-800");
    btn.classList.add("active", "bg-blue-800", "text-white");

    // Update global loan type
    currentLoanType = btn.dataset.type;
    document.getElementById("loanType").textContent = currentLoanType
       const homeLoanNote = document.getElementById("homeLoanNote");
      if (currentLoanType === "credit") {
        loanTypeNote.classList.remove("opacity-0", "max-h-0");
        loanTypeNote.classList.add("opacity-100", "max-h-40");
        homeLoanNote.classList.add("opacity-0", "max-h-0");
        homeLoanNote.classList.remove("opacity-100", "max-h-16");
        document.getElementById("additional-charges-div").classList.remove("hidden");
      } else if (currentLoanType === "home") {
        homeLoanNote.classList.remove("opacity-0", "max-h-0");
        homeLoanNote.classList.add("opacity-100", "max-h-16");
        loanTypeNote.classList.add("opacity-0", "max-h-0");
        loanTypeNote.classList.remove("opacity-100", "max-h-40");
        document.getElementById("additional-charges-div").classList.add("hidden");
      } else {
        loanTypeNote.classList.add("opacity-0", "max-h-0");
        loanTypeNote.classList.remove("opacity-100", "max-h-40");
        homeLoanNote.classList.add("opacity-0", "max-h-0");
        homeLoanNote.classList.remove("opacity-100", "max-h-16");
        document.getElementById("additional-charges-div").classList.add("hidden");
      }

    // Update limits
    updateLoanLimits(currentLoanType);
    updateDisbursal()
    partPayments = [];
    updateResults()
  });
});


  function bindInputWithSlider(inputEl, sliderEl, updateFn) {
  // While typing, only sync slider (don't enforce min/max yet)
  inputEl.addEventListener("input", () => {
    sliderEl.value = inputEl.value;
  });

  // On blur, enforce min/max and trigger update
  inputEl.addEventListener("blur", () => {
    let value = Number(inputEl.value);
    const min = Number(inputEl.min);
    const max = Number(inputEl.max);

    if (isNaN(value) || value < min) value = min;
    if (value > max) value = max;

    inputEl.value = value;
    sliderEl.value = value;
    partPayments = []; // reset if new values
    updateFn();
  });

  // Slider always updates input + results immediately
  sliderEl.addEventListener("input", () => {
    inputEl.value = sliderEl.value;
    partPayments = []; // reset if new values
    updateFn();
  });
}


  // Chart setup
  const ctx = document.getElementById('emiChart');
  let emiChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Principal', 'Interest'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#1E40AF', '#f59e0b'],
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });



const downloadBtn = document.getElementById("downloadPdfBtn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    // basic validation / guard
    if (!dataForPdf || !Array.isArray(dataForPdf) || dataForPdf.length === 0) {
      alert("No amortization data available to generate PDF.");
      return;
    }

    // Prevent double-click while animating
    if (downloadBtn.disabled) return;

    // read current loan inputs (these vars exist inside DOMContentLoaded)
    const loanAmount = Number(loanInput.value);
    const interestRate = Number(rateInput.value);
    const tenure = Number(tenureInput.value);

    // compute EMI from the same function you already have to keep values consistent
    const emiValue = Math.round(calculateEMI(loanAmount, interestRate, tenure));

    // 🧾 Gather data directly from on-screen values (ensures perfect match)
    const totalInterestText = document.getElementById("totalInterest").textContent.replace(/[₹,]/g, "");
    const totalPaymentText = document.getElementById("totalPayment").textContent.replace(/[₹,]/g, "");

    const totalInterest = Number(totalInterestText);
    const totalPayment = Number(totalPaymentText);

    // ✅ Get disbursal-related values
    const procFeeValue = Number(document.getElementById("procFeeVal")?.textContent?.replace(/,/g, "") || 0);
    const gstValue = Number(document.getElementById("gstVal")?.textContent?.replace(/,/g, "") || 0);
    const disbursalValue = Number(document.getElementById("disbursalValue")?.textContent?.replace(/,/g, "") || 0);

    const loanInfo = {
      amount: loanAmount,
      interestRate: interestRate,
      tenure: tenure,
      emi: emiValue,
      totalInterest: totalInterest,
      totalPayment: totalPayment,
      procFeeValue: procFeeValue,
      gstValue: gstValue,
      disbursalValue: disbursalValue,
      originalInterest: originalTotalInterest,
      newInterest: newTotalInterest,
      loanType: currentLoanType
    };

    // ── PDF BUTTON ANIMATION ─────────────────────────────────────────────
    // Save original button content so we can restore it cleanly
    const originalHTML    = downloadBtn.innerHTML;
    const originalClasses = downloadBtn.className;

    // Phase 1 — spinner while jsPDF generates
    downloadBtn.disabled  = true;
    downloadBtn.innerHTML = `
      <svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span>Generating...</span>
    `;
    downloadBtn.className = 'flex items-center gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg font-semibold cursor-not-allowed transition-all duration-300';

    // Generate PDF — wrapped in setTimeout so the spinner renders first
    setTimeout(() => {
      try {
        pdfGenerator(dataForPdf, partPayments, loanInfo);
      } catch (e) {
        // If PDF generation throws, restore button and surface error
        downloadBtn.innerHTML = originalHTML;
        downloadBtn.className = originalClasses;
        downloadBtn.disabled  = false;
        console.error('PDF generation failed:', e);
        return;
      }

      // Phase 2 — green tick + success text
      downloadBtn.innerHTML = `
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>Downloaded!</span>
      `;
      downloadBtn.className = 'flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300';

      // Phase 3 — fade back to original after 2.5s
      setTimeout(() => {
        downloadBtn.style.transition = 'opacity 0.4s ease';
        downloadBtn.style.opacity    = '0';
        setTimeout(() => {
          downloadBtn.innerHTML        = originalHTML;
          downloadBtn.className        = originalClasses;
          downloadBtn.style.opacity    = '0';
          downloadBtn.disabled         = false;
          // Fade back in
          requestAnimationFrame(() => {
            downloadBtn.style.transition = 'opacity 0.4s ease';
            downloadBtn.style.opacity    = '1';
            setTimeout(() => { downloadBtn.style.transition = ''; }, 400);
          });
        }, 400);
      }, 2500);

    }, 60); // 60ms — enough for spinner to paint before heavy PDF work starts
    // ── END PDF BUTTON ANIMATION ─────────────────────────────────────────

    // Fire GA4 event for PDF download
    if (typeof gtag === "function") {
      gtag("event", "pdf_download", {
        event_category: "engagement",
        event_label: "amortization_pdf",
        value: loanAmount,
        client: window.KYE_CLIENT || "main"
      });
    }

  });
}


// ============================================================
// WHATSAPP SHARE
// ============================================================
const whatsappShareBtn = document.getElementById("whatsappShareBtn");
if (whatsappShareBtn) {
  whatsappShareBtn.addEventListener("click", () => {
    const loanAmount    = Number(loanInput.value);
    const interestRate  = Number(rateInput.value);
    const tenure        = Number(tenureInput.value);
    const emiValue      = Math.round(calculateEMI(loanAmount, interestRate, tenure));
    const totalInterest = Math.round(originalTotalInterest);
    const totalPayment  = Math.round(loanAmount + originalTotalInterest);

    const loanTypeLabel = {
      personal: "Personal Loan",
      home:     "Home Loan",
      car:      "Car Loan",
      credit:   "Credit Card Loan"
    }[currentLoanType] || "Loan";

    const hasPartPayments = partPayments && partPayments.length > 0;
    const interestSaved   = hasPartPayments ? Math.round(originalTotalInterest - newTotalInterest) : 0;
    const tenureReduced   = hasPartPayments && dataForPdf ? tenure - dataForPdf.length : 0;
    const newTotalInt     = hasPartPayments ? Math.round(newTotalInterest) : totalInterest;
    const newTotalPay     = hasPartPayments ? Math.round(loanAmount + newTotalInterest) : totalPayment;

    const line = "==================";

    // Proc fee and charges (all loan types)
    const procFeeValue  = Number(document.getElementById("procFeeVal")?.textContent?.replace(/,/g, "") || 0);
    const gstOnFee      = Number(document.getElementById("gstVal")?.textContent?.replace(/,/g, "") || 0);
    const gstOnInterest = currentLoanType === "credit" ? Number(document.getElementById("gstValOnInt")?.textContent?.replace(/,/g, "") || 0) : 0;
    const paybackValue  = currentLoanType === "credit" ? Number(document.getElementById("payBackValue")?.textContent?.replace(/,/g, "") || 0) : 0;

    let msg =
      "*EMI Summary - KnowYourEMI*\n" + line + "\n" +
      "*Loan Type:* " + loanTypeLabel + "\n" +
      "*Loan Amount:* Rs. " + loanAmount.toLocaleString("en-IN") + "\n" +
      "*Interest Rate:* " + interestRate + "% p.a.\n" +
      "*Tenure:* " + tenure + " months\n" +
      line + "\n" +
      "*Monthly EMI:* Rs. " + emiValue.toLocaleString("en-IN") + "\n" +
      "*Total Interest:* Rs. " + totalInterest.toLocaleString("en-IN") + "\n" +
      "*Total Payment:* Rs. " + totalPayment.toLocaleString("en-IN") + "\n";

    // Proc fee for all loan types
    if (procFeeValue > 0) {
      msg +=
        line + "\n" +
        "*Processing Fee:* Rs. " + Math.round(procFeeValue).toLocaleString("en-IN") + "\n" +
        "*GST on Fee:* Rs. " + Math.round(gstOnFee).toLocaleString("en-IN") + "\n";
    }
    // GST on interest + total payback for credit card only
    if (currentLoanType === "credit") {
      msg +=
        "*GST on Interest:* Rs. " + Math.round(gstOnInterest).toLocaleString("en-IN") + "\n" +
        "*Total Payback (incl. GST):* Rs. " + Math.round(paybackValue).toLocaleString("en-IN") + "\n";
    }

    if (hasPartPayments) {
      msg +=
        line + "\n" +
        "*Part Payments Applied:* " + partPayments.length + "\n" +
        "*Interest Saved:* Rs. " + interestSaved.toLocaleString("en-IN") + "\n" +
        "*Months Saved:* " + tenureReduced + "\n" +
        "*New Total Interest:* Rs. " + newTotalInt.toLocaleString("en-IN") + "\n" +
        "*New Total Payment:* Rs. " + newTotalPay.toLocaleString("en-IN") + "\n";
    }

    msg += line + "\nhttps://knowyouremi.in";

    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");

    if (typeof gtag === "function") {
      gtag("event", "whatsapp_share", {
        event_category: "engagement",
        event_label: "loan_summary_shared",
        value: loanAmount
      });
    }
  });
}


  // Confirm button
confirmBtn.addEventListener("click", () => {
  const amount = Number(input.value);
  const option = document.querySelector("input[name='partPaymentOption']:checked")?.value;
  


  if (!amount || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  if (amount > selectedMaxAmount) {
    alert(`Amount cannot exceed ₹${selectedMaxAmount.toLocaleString("en-IN")}`);
    return;
  }
  if (!option) {
    alert("Please choose whether to reduce EMI or tenure.");
    return;
  }

  
  if (amount < selectedMaxAmount && amount < selectedEmi) {
  alert(`Part payment amount is less than the current emi.`);
  return;
}

  

  // Save part payment
  partPayments.push({
    month: selectedMonthSerial,
    year: selectedYear,
    amount,
    option
  });



  // ✅ Recalculate amortization with new part payment
  if (typeof updateResults === "function") {
    updateResults(); 
  } else {
    console.warn("⚠️ updateResults() is not defined!");
  }

  const savingsHighlight = document.getElementById("savingsHighlight");
  if (savingsHighlight) {
    savingsHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ✅ Close modal after saving
  closePartPaymentModal();
   document.getElementById("partPaymentValueDisplay").classList.remove("hidden");
   document.getElementById("partPaymentValueDisplay").classList.add("flex");

  //  GA4 tracking for part payments
    if (typeof gtag === "function") {
    gtag("event", "part_payment_check", {
      event_category: "EMI Calculator",
      event_label: "Part Payment Confirmed",
      value: 1,
      client: window.KYE_CLIENT || "main"
    });
  }
   
});


// ✅ Single Event Delegation for part-payment buttons
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("part-payment-btn")) {
    const monthSerial = parseInt(e.target.getAttribute("data-month"));
    const outstanding = Number(e.target.getAttribute("data-balance"));
    const year = parseInt(e.target.getAttribute("data-year"));
    const emi = Number(e.target.getAttribute("data-emi"));


    selectedMonthSerial = monthSerial;
    selectedMaxAmount = outstanding;
    selectedYear = year;
    selectedEmi = emi;

    // Setup input restrictions
    input.value = "";
    input.max = selectedMaxAmount;
    maxHint.textContent = `Max allowed: ₹${selectedMaxAmount.toLocaleString("en-IN")}`;

    // Show modal
    openPartPaymentModal(selectedMaxAmount);
  }
});

// Cancel button
cancelBtn.addEventListener("click", closePartPaymentModal);

 


function updateResults() {
  document.getElementById("partPaymentValueDisplay").classList.remove("flex")
  document.getElementById("partPaymentValueDisplay").classList.add("hidden")
  const P = Number(loanInput.value);
  const annualRate = parseFloat(rateInput.value);
  const N = parseInt(tenureInput.value, 10);

  // --- Original loan (no part payments) ---
  const emi = calculateEMI(P, annualRate, N);
  const totalPayment = emi * N;
  originalTotalInterest = totalPayment - P;

  // --- With part payments (amortization schedule) ---
  const schedule = generateAmortization(P, annualRate, N, partPayments);

  // ✅ Just sum all interest portions from schedule
  newTotalInterest = schedule.reduce((sum, m) => sum + m.interest, 0);

  // --- Update Chart 1 (original) ---
  emiChart.data.datasets[0].data = [P, originalTotalInterest];
  emiChart.update();

  // --- Update top results (original values) ---
  loanDisplay.textContent = '₹' + P.toLocaleString('en-IN');
  rateDisplay.textContent = annualRate.toFixed(2) + '%';
  tenureDisplay.textContent = N;

  // ── KYE COUNT-UP WIRING ──────────────────────────────────────────────────
  // _kyeCountUp is exposed by the animation block below (outside DOMContentLoaded).
  // We pass the exact calculated values directly — no DOM reading, no race condition.
  if (window._kyeCountUp) {
    window._kyeCountUp(monthlyEmiEl,    Math.round(emi),                   null);
    window._kyeCountUp(totalInterestEl, Math.round(originalTotalInterest), null);
    window._kyeCountUp(totalPaymentEl,  Math.round(totalPayment),          null);
  } else {
    // Fallback: animations not loaded yet (e.g. very first paint)
    monthlyEmiEl.textContent    = '₹' + Math.round(emi).toLocaleString('en-IN');
    totalInterestEl.textContent = '₹' + Math.round(originalTotalInterest).toLocaleString('en-IN');
    totalPaymentEl.textContent  = '₹' + Math.round(totalPayment).toLocaleString('en-IN');
  }
  // ── END KYE COUNT-UP WIRING ──────────────────────────────────────────────

  // --- Render amortization with part-payments applied ---
  renderAmortization(schedule);

  // --- Savings Section (with chart + note) ---
  // const savingsSection = document.getElementById('savingsSection');
  const savingsHighlight = document.getElementById("savingsHighlight"); // new fancy box
  const savingsAmountEl = document.getElementById("savingsAmount");
  const savingsDetailEl = document.getElementById("savingsDetail");

  if (partPayments.length > 0) {
    // ✅ Chart 2 (after part payments) uses actual summed interest
    // savingsChart.data.datasets[0].data = [P, newTotalInterest];
    // savingsChart.update();
    // savingsSection.classList.remove('hidden');

    // ✅ Savings = difference
    const interestSaved = originalTotalInterest - newTotalInterest;
    const tenureReduced = N - schedule.length;

    // ✅ Fix: Map part-payments to actual schedule months
    const ppDetails = partPayments.map(pp => {
      const match = schedule.find(m => m.serial === pp.month && m.year === pp.year);
      if (match) {
        const monthName = new Date(match.year, match.month - 1)
          .toLocaleString('default', { month: 'short' });
        return `₹${pp.amount.toLocaleString('en-IN')} in ${monthName} ${match.year}`;
      }
      return `₹${pp.amount.toLocaleString('en-IN')} (date unknown)`;
    });

    // --- Animated highlight ---
    savingsHighlight.classList.remove("hidden");

    const duration = 1500; // ms
    const startTime = performance.now();
    const endValue = Math.round(interestSaved);

    function animateCount(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const currentValue = Math.floor(progress * endValue);
      savingsAmountEl.textContent = `₹${currentValue.toLocaleString('en-IN')}`;
      if (progress < 1) requestAnimationFrame(animateCount);
    }
    requestAnimationFrame(animateCount);

    savingsDetailEl.textContent =
      `if you make part payment(s) of ${ppDetails.join(', ')}${tenureReduced > 0 ? `\n.  You repay entire loan early by ${tenureReduced} months.` : ''}`;

  } else {
    // savingsSection.classList.add('hidden');
    savingsHighlight.classList.add("hidden");
  }

  updateDisbursal();

}


function updateDisbursal() {
  const loanAmount = Number(loanInput.value);
  const procFeeRate = Number(procFeeInput.value);
  const gstRate = Number(gstInput.value);

  if (!loanAmount || isNaN(procFeeRate) || isNaN(gstRate)) return;

  let procFeeValue = (loanAmount * procFeeRate) / 100;
  if (procFeeValue > 25000) {
    procFeeValue = 25000;
    document.getElementById("procFeeNote").textContent = "(Capped at ₹25,000)";
  } else {
    document.getElementById("procFeeNote").textContent = "";
  }
  const gstValue = (procFeeValue * gstRate) / 100;
  const gstValueOnInterest = currentLoanType === "credit" ? (originalTotalInterest * gstRate) / 100 : 0;
  const totalCharges = procFeeValue + gstValue
  const disbursalAmount = loanAmount - totalCharges;

  let displayLoanType

  if(currentLoanType === "personal"){
    displayLoanType = "Personal Loan"
  } else if(currentLoanType === "home"){
    displayLoanType = "Home Loan"
  } else if(currentLoanType === "car"){
    displayLoanType = "Car Loan"
  } else {
    displayLoanType = "Loan on Credit Card"
  }


  document.getElementById("loanType").textContent = displayLoanType;
  document.getElementById("loanVal").textContent = Math.round(loanAmount).toLocaleString('en-IN');
  document.getElementById("procFeeVal").textContent = Math.round(procFeeValue).toLocaleString('en-IN');
  document.getElementById("gstVal").textContent = Math.round(gstValue).toLocaleString('en-IN');
  document.getElementById("gstValOnInt").textContent = Math.round(gstValueOnInterest).toLocaleString('en-IN');
  document.getElementById("totalCharges").textContent = Math.round(totalCharges).toLocaleString('en-IN');
  document.getElementById("disbursalValue").textContent = Math.round(disbursalAmount).toLocaleString('en-IN');
  document.getElementById("payBackValue").textContent = Math.round(loanAmount + originalTotalInterest + gstValueOnInterest).toLocaleString('en-IN');
  document.getElementById("afterPartPaymentValue").textContent = Math.round(loanAmount + newTotalInterest + gstValueOnInterest).toLocaleString('en-IN');

  document.getElementById("loanSummary").classList.remove("hidden");
 
}




bindInputWithSlider(loanInput, loanRange, updateResults);
bindInputWithSlider(rateInput, rateRange, updateResults);
bindInputWithSlider(tenureInput, tenureRange, updateResults);

procFeeInput.addEventListener("input", updateDisbursal);
gstInput.addEventListener("input", updateDisbursal);


// ✅ Enforce max limits on Processing Fee and GST
procFeeInput.addEventListener("input", () => {
  if (procFeeInput.value > 5) {
    procFeeInput.value = 5;
  } else if (procFeeInput.value < 0) {
    procFeeInput.value = 0;
  }
  updateDisbursal();
});

gstInput.addEventListener("input", () => {
  if (gstInput.value > 22) {
    gstInput.value = 22;
  } else if (gstInput.value < 0) {
    gstInput.value = 0;
  }
  updateDisbursal();
});



  // Initial update on page load
  updateResults();


// --- Feedback Form (working version) ---
const feedbackForm = document.getElementById("feedbackForm");
const feedbackStatus = document.getElementById("feedbackStatus");
const feedbackBtn = document.getElementById("feedbackSubmitBtn");

if (feedbackForm) {
  feedbackForm.addEventListener("submit", function(e) {
    e.preventDefault();

    console.log("🚀 Form submitted, preventDefault worked!");

    // ✅ Check reCAPTCHA
    const captchaResponse = grecaptcha.getResponse();
    if (!captchaResponse) {
      feedbackStatus.textContent = "⚠️ Please verify the reCAPTCHA before submitting.";
      feedbackStatus.className = "mt-4 text-red-600 font-semibold";
      return;
    }

    // Show loading state
    feedbackBtn.disabled = true;
    feedbackBtn.textContent = "⏳ Sending...";

    // ✅ Attach captcha response
    const captchaField = document.createElement("input");
    captchaField.type = "hidden";
    captchaField.name = "g-recaptcha-response";
    captchaField.value = captchaResponse;
    feedbackForm.appendChild(captchaField);

    // Send via EmailJS
    emailjs.sendForm("service_e5o8v41", "template_gt38jdj", feedbackForm)
      .then(() => {
        feedbackStatus.textContent = "✅ Thank you! Your feedback has been sent.";
        feedbackStatus.className = "mt-4 text-green-600 font-semibold";
        feedbackForm.reset();
        grecaptcha.reset();
        

        // Fire GA4 event for feedback form submit
          if (typeof gtag === "function") {
            gtag("event", "feedback_submit", {
              event_category: "engagement",
              event_label: "feedback_form",
            });
          }
      })
      .catch((error) => {
        console.error("❌ EmailJS error:", error.text || error);
        feedbackStatus.textContent = "❌ Oops! Something went wrong. Please try again.";
        feedbackStatus.className = "mt-4 text-red-600 font-semibold";
      })
      .finally(() => {
        feedbackBtn.disabled = false;
        feedbackBtn.textContent = "Send Feedback";
      });
  });
}

});


// 🔒 Restrict month inputs to whole numbers only
  document.addEventListener("input", (e) => {
    const el = e.target;

    if (
      el.id === "tenureInput"
    ) {
      // Remove any non-digit or decimal characters
      el.value = el.value.replace(/[^\d]/g, "");

      // Convert to integer (optional, to drop leading zeros)
      if (el.value !== "") el.value = parseInt(el.value, 10);
    }
  });

  

  // EMI calculation
  function calculateEMI(P, annualRate, N) {
    const r = (annualRate / 12) / 100;
    if (r === 0) return P / N;
    return P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
  }






function generateAmortization(P, annualRate, N, partPayments = []) {
  const r = annualRate / 12 / 100;
  let balance = P;
  const schedule = [];

  const today = new Date();
  let month = today.getMonth(); // 0 = Jan
  let year = today.getFullYear();

  let emi = calculateEMI(balance, annualRate, N);

  // Convert partPayments to a map for faster lookup
  const ppMap = new Map();
  partPayments.forEach(pp => ppMap.set(pp.month, pp));

  const EPS = 0.01;
  let originalTenure = N;

  for (let i = 1; i <= N && balance > EPS; i++) {
    const interest = balance * r;
    let principal = emi - interest;

    // ✅ Adjustment: if this EMI would overpay the balance, trim it
    if (principal > balance) {
      principal = balance;
    }

    let emiForThisMonth = principal + interest;
    balance -= principal;

    let note = "";

    // --- Check if part-payment is scheduled at this month ---
    const pp = ppMap.get(i);
    if (pp) {
      const remainder = Number(pp.amount) - emiForThisMonth;
      if (remainder > 0) {
        balance -= remainder;
        if (balance <= EPS) {
          schedule.push({
            serial: i,
            year,
            month: month + 1,
            emi: emiForThisMonth,
            principal,
            interest,
            balance: 0,
            note: `Received part payment of ₹${pp.amount.toLocaleString('en-IN')} - Loan closed`
          });
          break;
        }
      }

      if (pp.option === "reduceEmi") {
        const oldEmi = emi;
        const remainingMonthsAfterThis = N - i;
        if (remainingMonthsAfterThis > 0) {
          emi = calculateEMI(balance, annualRate, remainingMonthsAfterThis);
        }
        note = `Received part payment of ₹${pp.amount.toLocaleString('en-IN')}.  EMI reduced from ₹${Math.round(oldEmi).toLocaleString('en-IN')} to ₹${Math.round(emi).toLocaleString('en-IN')}.`;
      } else if (pp.option === "reduceTenure") {
        const oldTenure = N;
        if (emi > balance * r + EPS) {
          const monthsNeededExact = Math.log(emi / (emi - balance * r)) / Math.log(1 + r);
          N = i + Math.ceil(monthsNeededExact);
        }
        const monthsReduced = originalTenure - N;
        note = `Received part payment of ₹${pp.amount.toLocaleString('en-IN')}. Overall tenure reduced by ${monthsReduced} months.`;
      }
    }

    schedule.push({
      serial: i,
      year,
      month: month + 1,
      emi: emiForThisMonth,
      principal,
      interest,
      balance: balance < EPS ? 0 : balance,
      note
    });

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  dataForPdf = schedule
  return schedule;
}




// Render amortization schedule accordion with part-payment button
function renderAmortization(schedule) {
  const container = document.getElementById('amortizationAccordion');
  container.innerHTML = ''; // clear previous

  if (!Array.isArray(schedule) || schedule.length === 0) return;

  // Group by year
  const years = {};
  schedule.forEach(item => {
    if (!years[item.year]) years[item.year] = [];
    years[item.year].push(item);
  });

  // serial of the very last month in the whole schedule
  const lastSerial = schedule[schedule.length - 1].serial;

  let maxPaidYear = null;
  if (Array.isArray(partPayments) && partPayments.length > 0) {
    maxPaidYear = Math.max(...partPayments.map(pp => Number(pp.year)));
  }

    for (const yr in years) {
      const yearDiv = document.createElement('div');
      yearDiv.className = 'border rounded-lg text-blue-500';

      const header = document.createElement('button');
      header.className =
        'w-full text-left p-3 font-semibold bg-blue-100 rounded-t-lg flex justify-between items-center focus:outline-none';
      header.innerHTML = `${yr} <span>+</span>`;

      // Outer collapsible container (no padding)
      const monthContainer = document.createElement('div');
      monthContainer.className =
        'max-h-0 overflow-hidden transition-all duration-500 ease-in-out';

      // Inner wrapper (with padding + spacing)
      const innerWrapper = document.createElement('div');
      innerWrapper.className = 'p-3 space-y-1';
      monthContainer.appendChild(innerWrapper);

      // Add table header row
      const tableHeader = document.createElement('div');
      tableHeader.className =
        'grid grid-cols-5 gap-2 font-semibold text-xs border-b pb-1 text-center sm:text-sm';
      tableHeader.innerHTML = `
        <div>Month</div>
        <div>EMI</div>
        <div>Interest / Principal</div>
        <div>Balance</div>
        <div class="col-span-1 ml-auto sm:mx-auto md:mx-auto md:col-span-1">Part Pay</div>
      `;
      innerWrapper.appendChild(tableHeader);

      years[yr].forEach((m, idx) => {
        const monthRow = document.createElement('div');
        monthRow.className =
          'grid grid-cols-5 gap-2 text-xs py-1 border-b hover:bg-gray-50 text-center sm:text-sm';

        const monthName = new Date(m.year, m.month - 1).toLocaleString(
          'default',
          { month: 'short' }
        );

        // Decide if this button should be disabled:
        let actionHTML = '';
        if (m.serial === lastSerial) {
          actionHTML = `
            <button 
              class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                    bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
              disabled
              title="Part payment not allowed on final installment"
            >
              N/A
            </button>
          `;
        } else if (currentLoanType === "credit") {
            actionHTML = `
              <button 
                class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                      bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
                disabled
                title="Part payment not allowed for credit card loans"
              >
                N/A
              </button>
            `;
          } else if (maxPaidYear !== null && Number(m.year) <= Number(maxPaidYear)) {
          actionHTML = `
            <button 
              class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                    bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
              disabled
              title="Part payments disabled up to year ${maxPaidYear}"
            >
              N/A
            </button>
          `;
        } else {
          actionHTML = `
            <button 
              class="part-payment-btn col-span-1 ml-auto sm:mx-auto md:mx-auto md:col-span-1 md:px-4
                    bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-xs" 
              data-month="${m.serial}" 
              data-year="${m.year}" 
              data-balance="${Math.round(m.balance)}"
              data-emi="${Math.round(m.emi)}"
            >
              Pay
            </button>
          `;
        }

        monthRow.innerHTML = `
          <div>${m.serial}. ${monthName}</div>
          <div>₹${Math.round(m.emi).toLocaleString('en-IN')}</div>
          <div>₹${Math.round(m.interest).toLocaleString('en-IN')} / ₹${Math.round(m.principal).toLocaleString('en-IN')}</div>
          <div>₹${Math.round(m.balance).toLocaleString('en-IN')}</div>
          ${actionHTML}
        `;

        innerWrapper.appendChild(monthRow);

        if (m.note) {
          const noteRow = document.createElement('div');
          noteRow.className =
            'col-span-6 text-center font-bold mx-auto text-sm italic text-blue-700 bg-blue-100 p-2 rounded md:w-1/2';
          noteRow.textContent = m.note;
          innerWrapper.appendChild(noteRow);
        }
      });

      header.addEventListener('click', () => {
        if (monthContainer.style.maxHeight && monthContainer.style.maxHeight !== '0px') {
          monthContainer.style.maxHeight = '0px';
          header.querySelector('span').textContent = '+';
        } else {
          monthContainer.style.maxHeight = monthContainer.scrollHeight + 'px';
          header.querySelector('span').textContent = '−';
        }
      });

      yearDiv.appendChild(header);
      yearDiv.appendChild(monthContainer);
      container.appendChild(yearDiv);
      // ✅ Open the first accordion by default
      if (Object.keys(years)[0] === yr) {
        monthContainer.style.maxHeight = monthContainer.scrollHeight + 'px';
        header.querySelector('span').textContent = '−';
      }

    }
}



// --- Modal Functions ---
function openPartPaymentModal(maxOutstanding) {
  modal.classList.remove("hidden");
  setTimeout(() => {
    modalBox.classList.remove("scale-95", "opacity-0");
    modalBox.classList.add("scale-100", "opacity-100");
  }, 10);

  // update max allowed hint
  input.max = maxOutstanding;
  maxHint.textContent = `Max allowed: ₹${maxOutstanding.toLocaleString("en-IN")}`;
}

function closePartPaymentModal() {
  modalBox.classList.remove("scale-100", "opacity-100");
  modalBox.classList.add("scale-95", "opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 200); // wait for animation
}


// Disabling part payment button for past to till payment made year
function disablePartPaymentButtonsUpToYear(year) {
  document.querySelectorAll(".part-payment-btn").forEach(btn => {
    const btnYear = parseInt(btn.getAttribute("data-year"));
    if (btnYear <= year) {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  });
}


// FAQ Accordion Toggle
document.querySelectorAll("#faqAccordion button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const content = btn.nextElementSibling;
      const symbol = btn.querySelector("span:last-child");

      if (content.style.maxHeight && content.style.maxHeight !== "0px") {
        // Closing
        content.style.maxHeight = "0px";
        content.style.opacity = "0";
        symbol.textContent = "+";
      } else {
        // Opening
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.opacity = "1";
        symbol.textContent = "−";
      }
    });
  });


  // ✅ Navbar mobile menu toggle
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }
});



// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker registered'))
    .catch((err) => console.log('Service Worker failed:', err));
}

// ============================================================
// PWA INSTALL POPUP
// First appearance: 30s after page load.
// After dismissal (Install clicked, declined, or Maybe Later): the 30s
// timer is restarted from the moment of dismissal, not before.
// Fully independent of the comment popup — no shared state.
// ============================================================

let deferredPrompt;
const popup = document.getElementById('installPopup');
const addShortCutBtn = document.getElementById('addShortCutBtn');
const closeShortCutBtn = document.getElementById('closeShortCutBtn');
let popupTimer;
const PWA_POPUP_DELAY = 30000; // 30s, used both for first show and every reappearance

function showPopup() {
  if (localStorage.getItem('pwaInstalled') === 'true') return;
  popup.classList.remove('hidden');
  popup.classList.add('opacity-0');
  popup.classList.add('transition-opacity', 'duration-700');

  setTimeout(() => {
    popup.classList.remove('opacity-0');
    popup.classList.add('opacity-100');
  }, 50);
}

function schedulePwaPopup(delay) {
  clearTimeout(popupTimer);
  popupTimer = setTimeout(showPopup, delay);
}

function dismissPwaPopup() {
  clearTimeout(popupTimer);
  popup.classList.add('hidden');
  popup.classList.remove('opacity-100');
  popup.classList.add('opacity-0');
  // Timer for the next appearance starts now, from the moment of dismissal
  schedulePwaPopup(40000);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// First appearance — 30s after load, regardless of beforeinstallprompt firing
schedulePwaPopup(PWA_POPUP_DELAY);

addShortCutBtn.addEventListener('click', async () => {
  clearTimeout(popupTimer);
  popup.classList.add('hidden');

  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted A2HS prompt');
      localStorage.setItem('pwaInstalled', 'true');

      if (typeof gtag !== 'undefined') {
        gtag('event', 'app_installed', {
          event_category: 'PWA',
          event_label: 'User Installed App Successfully',
          value: 1
        });
      }
      // Installed — no need to schedule another appearance
    } else {
      console.log('User dismissed A2HS prompt');
      schedulePwaPopup(PWA_POPUP_DELAY);
    }

    deferredPrompt = null;
  } else {
    // No native prompt available (e.g. already installed, or browser doesn't support it) — just reschedule
    schedulePwaPopup(PWA_POPUP_DELAY);
  }
});

closeShortCutBtn.addEventListener('click', dismissPwaPopup);


// ============================================================
// COMMENT NUDGE POPUP
// First appearance: 45s after page load.
// After dismissal: the 30s timer is restarted from the moment of dismissal.
// Fully independent of the PWA popup — no shared state, no localStorage
// flags that depend on the PWA install status.
// Skips showing if the comments section is already close to the viewport
// (within 100px), since there's no point nudging someone who's already there.
// ============================================================

const commentPopup      = document.getElementById('commentPopup');
const commentPopupBtn   = document.getElementById('commentPopupBtn');
const commentPopupClose = document.getElementById('commentPopupClose');
let commentPopupTimer;
const COMMENT_POPUP_FIRST_DELAY = 50000; // 50s for the very first appearance only
const COMMENT_POPUP_DELAY       = 40000; // 40s for every appearance after a dismissal

function isCommentsSectionNearView() {
  const anchor = document.getElementById('comments-anchor');
  if (!anchor) return false;
  const rect = anchor.getBoundingClientRect();
  // "Near view" = within 100px of the viewport (above or below), or already inside it
  return rect.top < window.innerHeight + 100 && rect.bottom > -100;
}

function showCommentPopup() {
  if (!commentPopup) return;

  // If the comments section is already close to view, skip this attempt
  // and check again shortly rather than showing an unnecessary nudge.
  if (isCommentsSectionNearView()) {
    commentPopupTimer = setTimeout(showCommentPopup, 5000);
    return;
  }

  commentPopup.classList.remove('hidden');
  commentPopup.classList.add('opacity-0');
  commentPopup.classList.add('transition-opacity', 'duration-700');

  setTimeout(() => {
    commentPopup.classList.remove('opacity-0');
    commentPopup.classList.add('opacity-100');
  }, 50);
}

function scheduleCommentPopup(delay) {
  clearTimeout(commentPopupTimer);
  commentPopupTimer = setTimeout(showCommentPopup, delay);
}

function dismissCommentPopup() {
  clearTimeout(commentPopupTimer);
  commentPopup.classList.add('hidden');
  commentPopup.classList.remove('opacity-100');
  commentPopup.classList.add('opacity-0');
  // Timer for the next appearance starts now, from the moment of dismissal
  scheduleCommentPopup(COMMENT_POPUP_DELAY);
}

if (commentPopup && commentPopupBtn && commentPopupClose) {
  // First appearance — 45s after load
  scheduleCommentPopup(COMMENT_POPUP_FIRST_DELAY);

  commentPopupBtn.addEventListener('click', () => {
    clearTimeout(commentPopupTimer);
    commentPopup.classList.add('hidden');
    commentPopup.classList.remove('opacity-100');
    commentPopup.classList.add('opacity-0');

    if (typeof gtag === 'function') {
      gtag('event', 'comment_popup_clicked', {
        event_category: 'engagement',
        event_label: 'comment_nudge_popup'
      });
    }

    setTimeout(() => {
      const c = document.getElementById('comments-anchor');
      if (c) {
        const y = c.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);

    // Timer for the next appearance starts now, from the moment of dismissal
    scheduleCommentPopup(COMMENT_POPUP_DELAY);
  });

  commentPopupClose.addEventListener('click', dismissCommentPopup);
}
 


// Marching border on savings results card

(function () {
  const el = document.getElementById('savingsHighlight');
  if (!el) return;
 
  const SPEED = 3000;
  const SEG   = 0.22;
  let rafId   = null;
  let start   = null;
 
  function march(ts) {
    if (!start) start = ts;
    const prog   = ((ts - start) % SPEED) / SPEED;
    const deg    = prog * 360;
    const segDeg = SEG * 360;
    const end    = deg + segDeg;
 
    // Absolute degree stops so multicolor spreads visibly across the segment
    el.style.background = `conic-gradient(from 0deg,
      transparent              ${deg}deg,
      #1e40af                  ${deg + segDeg * 0.1}deg,
      #4f46e5                  ${deg + segDeg * 0.4}deg,
      #7c3aed                  ${deg + segDeg * 0.7}deg,
      #1e40af                  ${end - segDeg * 0.1}deg,
      transparent              ${end}deg,
      transparent              360deg)`;
 
    rafId = requestAnimationFrame(march);
  }
 
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = null;
    start = null;
    el.style.background = '#e2e8f0';
  }
 
  // Watch for hidden/visible class toggle
  new MutationObserver(function () {
    if (el.classList.contains('hidden')) {
      stop();
    } else if (!rafId) {
      rafId = requestAnimationFrame(march);
    }
  }).observe(el, { attributes: true, attributeFilter: ['class'] });
})();
// === End marching border animation ==


// ============================================================
// KYE SCROLL-TRIGGERED ANIMATIONS
// Self-contained IIFE — no changes needed to any other code.
// Exposes window._kyeCountUp so updateResults() can trigger
// count-up with the exact calculated value (no DOM reading).
// Accordion fade-in is fully internal — driven by MutationObserver
// watching for newly added year blocks.
// To remove all animations: delete this entire block.
// ============================================================
(function () {

  // ---------- helpers ----------

  function countUp(el, targetValue, onDone) {
    if (el._kyeRaf) cancelAnimationFrame(el._kyeRaf);
    const DURATION = 900;
    const start    = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / DURATION, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.round(eased * targetValue);
      el.textContent = '₹' + current.toLocaleString('en-IN');
      if (progress < 1) {
        el._kyeRaf = requestAnimationFrame(step);
      } else {
        el.textContent = '₹' + targetValue.toLocaleString('en-IN');
        if (typeof onDone === 'function') onDone();
      }
    }
    el._kyeRaf = requestAnimationFrame(step);
  }

  function countUpWhenVisible(el, targetValue, onDone) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      countUp(el, targetValue, onDone);
      return;
    }
    if (el._kyeVisObs) el._kyeVisObs.disconnect();
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.disconnect();
          countUp(el, targetValue, onDone);
        }
      });
    }, { threshold: 0.3 });
    el._kyeVisObs = obs;
    obs.observe(el);
  }

  // ---------- 1. Expose count-up for updateResults() wiring ----------
  window._kyeCountUp = countUpWhenVisible;

  // ---------- 2. Fade-in stagger on amortization year blocks ----------

  function fadeInWhenVisible(el) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(14px)';
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';

    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.disconnect();
          el.style.opacity   = '1';
          el.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });
    obs.observe(el);
  }

  const accordion = document.getElementById('amortizationAccordion');
  if (accordion) {
    const accObs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            fadeInWhenVisible(node);
          }
        });
      });
    });
    accObs.observe(accordion, { childList: true });
  }

})();
// === End KYE scroll-triggered animations ===


// ════════════════════════════════════════════════════════════════════════════
// KYE RESULT CARD
// Self-contained IIFE. Reads loan data from the existing global variables
// (originalTotalInterest, newTotalInterest, partPayments, dataForPdf,
//  currentLoanType) and DOM inputs — zero changes to any other logic.
//
// Depends on: html2canvas (loaded in index.html before app.js)
//
// To remove this feature entirely:
//   1. Delete this entire block
//   2. Delete the resultCardBtn in index.html buttons row
//   3. Delete the kye-result-card-modal in index.html
//   4. Remove the html2canvas <script> tag from index.html
// ════════════════════════════════════════════════════════════════════════════
(function () {

  // ── Element refs ──────────────────────────────────────────────────────────
  const openBtn   = document.getElementById('resultCardBtn');
  const modal     = document.getElementById('kye-result-card-modal');
  const closeBtn  = document.getElementById('kye-rc-close');
  const card      = document.getElementById('kye-result-card');
  const dlBtn     = document.getElementById('kye-rc-download');
  const shareBtn  = document.getElementById('kye-rc-share');
  const caption   = document.getElementById('kye-rc-caption');

  // Card field refs
  const rcEmi        = document.getElementById('kye-rc-emi');
  const rcAmount     = document.getElementById('kye-rc-amount');
  const rcRate       = document.getElementById('kye-rc-rate');
  const rcTenure     = document.getElementById('kye-rc-tenure');
  const rcInt        = document.getElementById('kye-rc-interest');
  const rcPPSec      = document.getElementById('kye-rc-pp-section');
  const rcPPDet      = document.getElementById('kye-rc-pp-detail');
  const rcPPSaved    = document.getElementById('kye-rc-pp-saved');
  const rcPPMon      = document.getElementById('kye-rc-pp-months');
  const rcPPNewI     = document.getElementById('kye-rc-pp-newint');
  const rcPPTenureRow = document.getElementById('kye-rc-pp-tenure-row');
  const rcPPEmiRow   = document.getElementById('kye-rc-pp-emi-row');
  const rcPPNewEmi   = document.getElementById('kye-rc-pp-newemi');

  if (!openBtn || !modal || !card) return; // guard: elements not in DOM

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  // ── Populate card with current loan data ──────────────────────────────────
  function populateCard() {
    const loanInput   = document.getElementById('loanAmountInput');
    const rateInput   = document.getElementById('interestRateInput');
    const tenureInput = document.getElementById('tenureInput');

    const P           = Number(loanInput?.value   || 0);
    const annualRate  = parseFloat(rateInput?.value || 0);
    const N           = parseInt(tenureInput?.value || 0, 10);

    // EMI — recalculate cleanly (same formula used in updateResults)
    const r   = (annualRate / 12) / 100;
    const emi = r === 0 ? P / N : P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);

    // Populate main fields
    rcEmi.textContent    = fmt(Math.round(emi));
    rcAmount.textContent = fmt(P);
    rcRate.textContent   = annualRate.toFixed(2) + '%';
    rcTenure.textContent = N + ' months';
    rcInt.textContent    = fmt(originalTotalInterest);  // global from app.js

    // Part payments section
    const hasPP = Array.isArray(partPayments) && partPayments.length > 0;  // global
    rcPPSec.style.display = hasPP ? 'block' : 'none';

    if (hasPP) {
      const interestSaved = originalTotalInterest - newTotalInterest;  // globals
      const schedule      = dataForPdf || [];                          // global
      const tenureReduced = N - schedule.length;

      // Build compact part payments table — max 5 rows
      const MAX_PP = 5;
      const shownPPs  = partPayments.slice(0, MAX_PP);
      const hiddenCount = partPayments.length - shownPPs.length;

      let ppTableHTML = '<table style="width:100%;border-collapse:collapse;margin-bottom:2px;">';
      shownPPs.forEach(function (pp) {
        const matchRow = schedule.find(function (m) { return m.serial === pp.month; });
        let dateLabel = '';
        if (matchRow) {
          const mName = new Date(matchRow.year, matchRow.month - 1).toLocaleString('default', { month: 'short' });
          dateLabel = mName + ' ' + matchRow.year;
        }
        ppTableHTML +=
          '<tr>' +
            '<td style="font-size:11px;color:rgba(187,247,208,0.8);padding:2px 0;">' + dateLabel + '</td>' +
            '<td style="font-size:11px;font-weight:700;color:#86efac;text-align:right;padding:2px 0;">' + fmt(pp.amount) + '</td>' +
          '</tr>';
      });
      ppTableHTML += '</table>';
      if (hiddenCount > 0) {
        ppTableHTML += '<p style="font-size:10px;color:rgba(187,247,208,0.6);margin:2px 0 0;">and ' + hiddenCount + ' more payment' + (hiddenCount > 1 ? 's' : '') + '</p>';
      }
      rcPPDet.innerHTML = ppTableHTML;
      rcPPSaved.textContent = fmt(interestSaved);
      rcPPNewI.textContent  = fmt(newTotalInterest);

      // Determine which option was used — check the last part payment's option
      const lastOption = partPayments[partPayments.length - 1].option;

      if (lastOption === 'reduceEmi') {
        // Show New EMI row, hide Tenure Reduced row
        rcPPTenureRow.style.display = 'none';
        rcPPEmiRow.style.display    = 'flex';

        // New EMI = EMI recalculated on remaining balance after last part payment
        // Best approximation: use the last month's EMI from the schedule
        const lastMonth = schedule[schedule.length - 1];
        const newEmiVal = lastMonth ? lastMonth.emi : 0;
        rcPPNewEmi.textContent = fmt(Math.round(newEmiVal));

      } else {
        // reduceTenure — show Tenure Reduced row, hide New EMI row
        rcPPTenureRow.style.display = 'flex';
        rcPPEmiRow.style.display    = 'none';
        rcPPMon.textContent = tenureReduced + ' months';
      }
    }
  }

  // ── Render card to canvas via html2canvas ─────────────────────────────────
  function renderCardToCanvas() {
    return html2canvas(card, {
      scale:           2,         // retina quality
      useCORS:         true,
      backgroundColor: null,      // transparent — card has its own bg
      logging:         false
    });
  }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openModal() {
    populateCard();
    caption.textContent  = '';
    modal.style.display  = 'flex';
    // Slight entrance animation
    modal.style.opacity  = '0';
    requestAnimationFrame(function () {
      modal.style.transition = 'opacity 0.25s ease';
      modal.style.opacity    = '1';
    });

    // GA4 — loan card opened
    if (typeof gtag === 'function') {
      gtag('event', 'loan_card_clicked', {
        event_category: 'engagement',
        event_label: 'loan_card',
        client: window.KYE_CLIENT || 'main'
      });
    }
  }

  // ── Close modal ───────────────────────────────────────────────────────────
  function closeModal() {
    modal.style.transition = 'opacity 0.2s ease';
    modal.style.opacity    = '0';
    setTimeout(function () {
      modal.style.display = 'none';
      modal.style.opacity = '1';   // reset for next open
    }, 200);
  }

  // ── Download as image ─────────────────────────────────────────────────────
  function downloadImage() {
    caption.textContent = 'Generating image...';
    dlBtn.style.opacity = '0.5';
    dlBtn.style.pointerEvents = 'none';

    renderCardToCanvas().then(function (canvas) {
      canvas.toBlob(function (blob) {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'KnowYourEMI-LoanPlan.png';
        link.href     = url;
        link.click();
        URL.revokeObjectURL(url);

        // GA4 — loan card downloaded
        if (typeof gtag === 'function') {
          gtag('event', 'loan_card_downloaded', {
            event_category: 'engagement',
            event_label: 'loan_card',
            client: window.KYE_CLIENT || 'main'
          });
        }

        caption.textContent       = 'Image saved!';
        dlBtn.style.opacity       = '1';
        dlBtn.style.pointerEvents = '';
        setTimeout(function () { caption.textContent = ''; }, 2500);
      });
    }).catch(function (err) {
      caption.textContent       = 'Could not generate image.';
      dlBtn.style.opacity       = '1';
      dlBtn.style.pointerEvents = '';
      console.error('KYE Result Card: html2canvas error', err);
    });
  }

  // ── Share as image (Web Share API) ────────────────────────────────────────
  function shareImage() {
    // Check if Web Share API supports file sharing (mobile browsers)
    if (!navigator.canShare) {
      // Desktop fallback — just download instead
      caption.textContent = 'Sharing not supported here — saving instead.';
      setTimeout(function () { caption.textContent = ''; downloadImage(); }, 1200);
      return;
    }

    caption.textContent         = 'Preparing to share...';
    shareBtn.style.opacity      = '0.5';
    shareBtn.style.pointerEvents = 'none';

    renderCardToCanvas().then(function (canvas) {
      canvas.toBlob(function (blob) {
        const file = new File([blob], 'KnowYourEMI-LoanPlan.png', { type: 'image/png' });

        if (!navigator.canShare({ files: [file] })) {
          // Files not supported — fall back to download
          caption.textContent         = 'Image sharing not supported — saving instead.';
          shareBtn.style.opacity      = '1';
          shareBtn.style.pointerEvents = '';
          setTimeout(function () { caption.textContent = ''; downloadImage(); }, 1200);
          return;
        }

        navigator.share({
          files:  [file],
          title:  'My Loan Plan — KnowYourEMI',
          text:   'Calculated my EMI on knowyouremi.in'
        }).then(function () {
          caption.textContent = 'Shared!';
          setTimeout(function () { caption.textContent = ''; }, 2000);

          // GA4 — loan card shared
          if (typeof gtag === 'function') {
            gtag('event', 'loan_card_shared', {
              event_category: 'engagement',
              event_label: 'loan_card',
              client: window.KYE_CLIENT || 'main'
            });
          }
        }).catch(function (err) {
          if (err.name !== 'AbortError') {
            caption.textContent = 'Share cancelled.';
            setTimeout(function () { caption.textContent = ''; }, 2000);
          } else {
            caption.textContent = '';
          }
        }).finally(function () {
          shareBtn.style.opacity      = '1';
          shareBtn.style.pointerEvents = '';
        });

      }, 'image/png');
    }).catch(function (err) {
      caption.textContent         = 'Could not generate image.';
      shareBtn.style.opacity      = '1';
      shareBtn.style.pointerEvents = '';
      console.error('KYE Result Card: html2canvas error', err);
    });
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  dlBtn.addEventListener('click', downloadImage);
  shareBtn.addEventListener('click', shareImage);

  // Close on backdrop click
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  });

})();
// ════════════════════════════════════════════════════════════════════════════
// === End KYE Result Card ===
