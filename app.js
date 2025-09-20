// import {generatePDF} from ("./pdfGenerator.js")

// Modal elements
const input = document.getElementById("partPaymentInput");
const maxHint = document.getElementById("maxAmountHint");
const confirmBtn = document.getElementById("confirmPartPayment");
const modal = document.getElementById('partPaymentModal');
const modalBox = document.getElementById('partPaymentBox');
const cancelBtn = document.getElementById('cancelPartPayment');

let selectedMonthSerial = null;
let selectedMaxAmount = 0;
let selectedYear = null;
let selectedEmi = null;


let partPayments = [];


// app.js - EMI Calculator logic
document.addEventListener('DOMContentLoaded', function() {
  emailjs.init("vGkMgPqy7msXERp1n");
  console.log("EmailJS initialized:", emailjs);
  const locale = 'en-IN';
  const formatNumber = (v) => Number(v).toLocaleString(locale);

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
        backgroundColor: ['blue', '#f59e0b'],
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  // second chart setup
  const savingsCtx = document.getElementById('savingsChart');
    let savingsChart = new Chart(savingsCtx, {
      type: 'pie',
      data: {
        labels: ['Principal', 'Interest'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['blue', '#f59e0b'],
        }]
      },
      options: { 
        responsive: true, 
        plugins: { legend: { position: 'bottom' } } 
      }
  });



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
  const P = Number(loanInput.value);
  const annualRate = parseFloat(rateInput.value);
  const N = parseInt(tenureInput.value, 10);

  // --- Original loan (no part payments) ---
  const emi = calculateEMI(P, annualRate, N);
  const totalPayment = emi * N;
  const originalTotalInterest = totalPayment - P;

  // --- With part payments (amortization schedule) ---
  const schedule = generateAmortization(P, annualRate, N, partPayments);

  // ✅ Just sum all interest portions from schedule
  const newTotalInterest = schedule.reduce((sum, m) => sum + m.interest, 0);

  // --- Update Chart 1 (original) ---
  emiChart.data.datasets[0].data = [P, originalTotalInterest];
  emiChart.update();

  // --- Update top results (original values) ---
  loanDisplay.textContent = '₹' + P.toLocaleString('en-IN');
  rateDisplay.textContent = annualRate.toFixed(2) + '%';
  tenureDisplay.textContent = N;
  monthlyEmiEl.textContent = '₹' + Math.round(emi).toLocaleString('en-IN');
  totalInterestEl.textContent = '₹' + Math.round(originalTotalInterest).toLocaleString('en-IN');
  totalPaymentEl.textContent = '₹' + Math.round(totalPayment).toLocaleString('en-IN');

  // --- Render amortization with part-payments applied ---
  renderAmortization(schedule);

  // --- Savings Section (with chart + note) ---
  const savingsSection = document.getElementById('savingsSection'); // chart container
  // const savingsNote = document.getElementById('savingsNote');       // old note text
  const savingsHighlight = document.getElementById("savingsHighlight"); // new fancy box
  const savingsAmountEl = document.getElementById("savingsAmount");
  const savingsDetailEl = document.getElementById("savingsDetail");

  if (partPayments.length > 0) {
    // ✅ Chart 2 (after part payments) uses actual summed interest
    savingsChart.data.datasets[0].data = [P, newTotalInterest];
    savingsChart.update();
    savingsSection.classList.remove('hidden');

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
    savingsSection.classList.add('hidden');
    savingsHighlight.classList.add("hidden");
  }
}

bindInputWithSlider(loanInput, loanRange, updateResults);
bindInputWithSlider(rateInput, rateRange, updateResults);
bindInputWithSlider(tenureInput, tenureRange, updateResults);


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
      })
      .catch((error) => {
        console.error("❌ EmailJS error:", error.text || error);
        feedbackStatus.textContent = "❌ Oops! Something went wrong. Please try again.";
        feedbackStatus.className = "mt-4 text-red-600 font-semibold";
      })
      .finally(() => {
        feedbackBtn.disabled = false;
        feedbackBtn.textContent = "🚀 Send Feedback";
      });
  });
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
      'grid grid-cols-6 gap-2 font-semibold text-xs border-b pb-1 text-left sm:text-sm';
    tableHeader.innerHTML = `
      <div>Month</div>
      <div>EMI (₹)</div>
      <div>Interest (₹)</div>
      <div>Principal (₹)</div>
      <div>Balance (₹)</div>
      <div class="col-span-1 ml-auto mr-5 md:mx-auto md:col-span-1">Action</div>
    `;
    innerWrapper.appendChild(tableHeader);

    years[yr].forEach((m, idx) => {
      const monthRow = document.createElement('div');
      monthRow.className =
        'grid grid-cols-6 gap-2 text-xs py-1 border-b hover:bg-gray-50 text-left sm:text-sm';

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
            class="part-payment-btn col-span-1 ml-auto md:mx-auto md:col-span-1 
                   bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-xs" 
            data-month="${m.serial}" 
            data-year="${m.year}" 
            data-balance="${Math.round(m.balance)}"
            data-emi="${Math.round(m.emi)}"
          >
            Part Pay
          </button>
        `;
      }

      monthRow.innerHTML = `
        <div>${m.serial}. ${monthName}</div>
        <div>₹${Math.round(m.emi).toLocaleString('en-IN')}</div>
        <div>₹${Math.round(m.interest).toLocaleString('en-IN')}</div>
        <div>₹${Math.round(m.principal).toLocaleString('en-IN')}</div>
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

