// ─────────────────────────────────────────────
//  KnowYourEMI — Embed build (crefin.co.in)
//  EmailJS / Service Worker / PWA / Feedback
//  stripped out. All calc logic intact.
// ─────────────────────────────────────────────

// Identifies traffic source in GA4 events
window.KYE_CLIENT = "crefin";

// Modal elements
const input = document.getElementById("partPaymentInput");
const maxHint = document.getElementById("maxAmountHint");
const confirmBtn = document.getElementById("confirmPartPayment");
const modal = document.getElementById('partPaymentModal');
const modalBox = document.getElementById('partPaymentBox');
const cancelBtn = document.getElementById('cancelPartPayment');
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

let selectedMonthSerial = null;
let selectedMaxAmount = 0;
let selectedYear = null;
let selectedEmi = null;

let partPayments = [];
let dataForPdf = null;
let originalTotalInterest = 0;
let newTotalInterest = 0;
let currentLoanType = "";


// ─── Main logic ───────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const locale = 'en-IN';

  // Elements
  const loanRange   = document.getElementById('loanAmountRange');
  const loanInput   = document.getElementById('loanAmountInput');
  const loanDisplay = document.getElementById('loanAmountDisplay');
  const rateRange   = document.getElementById('interestRateRange');
  const rateInput   = document.getElementById('interestRateInput');
  const rateDisplay = document.getElementById('interestRateDisplay');
  const tenureRange  = document.getElementById('tenureRange');
  const tenureInput  = document.getElementById('tenureInput');
  const tenureDisplay = document.getElementById('tenureDisplay');

  const monthlyEmiEl   = document.getElementById('monthlyEmi');
  const totalInterestEl = document.getElementById('totalInterest');
  const totalPaymentEl  = document.getElementById('totalPayment');

  const procFeeInput = document.getElementById('processingFeeInput');
  const gstInput     = document.getElementById('gstInput');


  // ─── Loan type config ────────────────────────
  const loanTypeButtons = document.querySelectorAll(".loan-type-btn");
  currentLoanType = "home";

  const loanConfigs = {
    personal: { maxAmount: 5000000,  minAmount: 10000,   maxRate: 36, maxTenure: 60  },
    home:     { maxAmount: 10000000, minAmount: 100000,  maxRate: 35, maxTenure: 360 },
    car:      { maxAmount: 3000000,  minAmount: 50000,   maxRate: 18, maxTenure: 84  },
    credit:   { maxAmount: 1000000,  minAmount: 10000,   maxRate: 45, maxTenure: 60  },
  };


  // ─── Update slider/input limits per loan type ─
  function updateLoanLimits(type) {
    const config = loanConfigs[type];
    if (!config) return;

    loanAmountRange.max = config.maxAmount;
    loanAmountRange.min = config.minAmount;
    loanAmountInput.max = config.maxAmount;
    loanAmountInput.min = config.minAmount;

    interestRateRange.max = config.maxRate;
    interestRateInput.max = config.maxRate;

    tenureRange.max = config.maxTenure;
    tenureInput.max = config.maxTenure;

    document.querySelector("#loanAmountRange + .flex span:last-child").textContent  = `₹${(config.maxAmount).toLocaleString('en-IN')}`;
    document.querySelector("#loanAmountRange + .flex span:first-child").textContent = `₹${(config.minAmount).toLocaleString('en-IN')}`;
    document.querySelector("#loanAmountInput").value  = 100000;
    document.querySelector("#loanAmountRange").value  = 100000;
    document.querySelector("#interestRateRange + .flex span:last-child").textContent = `${config.maxRate}%`;
    document.querySelector("#tenureRange + .flex span:last-child").textContent       = `${config.maxTenure}`;

    if (Number(loanAmountInput.value)   > config.maxAmount)  loanAmountInput.value   = config.maxAmount;
    if (Number(interestRateInput.value) > config.maxRate)    interestRateInput.value  = config.maxRate;
    if (Number(tenureInput.value)       > config.maxTenure)  tenureInput.value        = config.maxTenure;

    updateResults();
  }


  // ─── Loan type button clicks ──────────────────
  loanTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      loanTypeButtons.forEach((b) => b.classList.remove("active", "bg-blue-600", "text-white"));
      loanTypeButtons.forEach((b) => b.classList.add("bg-gray-100", "text-gray-800"));

      btn.classList.remove("bg-gray-100", "text-gray-800");
      btn.classList.add("active", "bg-blue-600", "text-white");

      currentLoanType = btn.dataset.type;
      document.getElementById("loanType").textContent = currentLoanType;

      if (currentLoanType === "credit") {
        loanTypeNote.classList.remove("opacity-0", "max-h-0");
        loanTypeNote.classList.add("opacity-100", "max-h-24");
        document.getElementById("additional-charges-div").classList.remove("hidden");
      } else {
        loanTypeNote.classList.add("opacity-0", "max-h-0");
        loanTypeNote.classList.remove("opacity-100", "max-h-24");
        document.getElementById("additional-charges-div").classList.add("hidden");
      }

      updateLoanLimits(currentLoanType);
      updateDisbursal();
      partPayments = [];
      updateResults();
    });
  });


  // ─── Bind input + slider together ────────────
  function bindInputWithSlider(inputEl, sliderEl, updateFn) {
    inputEl.addEventListener("input", () => {
      sliderEl.value = inputEl.value;
    });

    inputEl.addEventListener("blur", () => {
      let value = Number(inputEl.value);
      const min = Number(inputEl.min);
      const max = Number(inputEl.max);

      if (isNaN(value) || value < min) value = min;
      if (value > max) value = max;

      inputEl.value  = value;
      sliderEl.value = value;
      partPayments   = [];
      updateFn();
    });

    sliderEl.addEventListener("input", () => {
      inputEl.value = sliderEl.value;
      partPayments  = [];
      updateFn();
    });
  }


  // ─── Pie chart setup ─────────────────────────
  const ctx = document.getElementById('emiChart');
  let emiChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Principal', 'Interest'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#005B95', '#f59e0b'],
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });


  // ─── PDF download ─────────────────────────────
  const downloadBtn = document.getElementById("downloadPdfBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!dataForPdf || !Array.isArray(dataForPdf) || dataForPdf.length === 0) {
        alert("No amortization data available to generate PDF.");
        return;
      }

      const loanAmount   = Number(loanInput.value);
      const interestRate = Number(rateInput.value);
      const tenure       = Number(tenureInput.value);
      const emiValue     = Math.round(calculateEMI(loanAmount, interestRate, tenure));

      const totalInterestText = document.getElementById("totalInterest").textContent.replace(/[₹,]/g, "");
      const totalPaymentText  = document.getElementById("totalPayment").textContent.replace(/[₹,]/g, "");
      const totalInterest     = Number(totalInterestText);
      const totalPayment      = Number(totalPaymentText);

      const procFeeValue  = Number(document.getElementById("procFeeVal")?.textContent?.replace(/,/g, "")   || 0);
      const gstValue      = Number(document.getElementById("gstVal")?.textContent?.replace(/,/g, "")        || 0);
      const disbursalValue = Number(document.getElementById("disbursalValue")?.textContent?.replace(/,/g, "") || 0);

      const loanInfo = {
        amount:          loanAmount,
        interestRate:    interestRate,
        tenure:          tenure,
        emi:             emiValue,
        totalInterest:   totalInterest,
        totalPayment:    totalPayment,
        procFeeValue:    procFeeValue,
        gstValue:        gstValue,
        disbursalValue:  disbursalValue,
        originalInterest: originalTotalInterest,
        newInterest:     newTotalInterest,
        loanType:        currentLoanType
      };

      pdfGenerator(dataForPdf, partPayments, loanInfo);

      if (typeof gtag === "function") {
        gtag("event", "pdf_download", {
          event_category: "engagement",
          event_label:    "amortization_pdf",
          value:          loanAmount,
          client:         window.KYE_CLIENT || "crefin"
        });
      }
    });
  }


  // ─── Part payment confirm ─────────────────────
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
      alert(`Part payment amount is less than the current EMI.`);
      return;
    }

    partPayments.push({
      month:  selectedMonthSerial,
      year:   selectedYear,
      amount,
      option
    });

    if (typeof updateResults === "function") {
      updateResults();
    }

    const savingsHighlight = document.getElementById("savingsHighlight");
    if (savingsHighlight) {
      savingsHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    closePartPaymentModal();
    document.getElementById("partPaymentValueDisplay").classList.remove("hidden");
    document.getElementById("partPaymentValueDisplay").classList.add("flex");

    if (typeof gtag === "function") {
      gtag("event", "part_payment_check", {
        event_category: "EMI Calculator",
        event_label:    "Part Payment Confirmed",
        value:          1,
        client:         window.KYE_CLIENT || "crefin"
      });
    }
  });


  // ─── Part payment button click (delegated) ───
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("part-payment-btn")) {
      const monthSerial = parseInt(e.target.getAttribute("data-month"));
      const outstanding = Number(e.target.getAttribute("data-balance"));
      const year        = parseInt(e.target.getAttribute("data-year"));
      const emi         = Number(e.target.getAttribute("data-emi"));

      selectedMonthSerial = monthSerial;
      selectedMaxAmount   = outstanding;
      selectedYear        = year;
      selectedEmi         = emi;

      input.value       = "";
      input.max         = selectedMaxAmount;
      maxHint.textContent = `Max allowed: ₹${selectedMaxAmount.toLocaleString("en-IN")}`;

      openPartPaymentModal(selectedMaxAmount);
    }
  });

  // Cancel button
  cancelBtn.addEventListener("click", closePartPaymentModal);


  // ─── Main results update ──────────────────────
  function updateResults() {
    document.getElementById("partPaymentValueDisplay").classList.remove("flex");
    document.getElementById("partPaymentValueDisplay").classList.add("hidden");

    const P          = Number(loanInput.value);
    const annualRate = parseFloat(rateInput.value);
    const N          = parseInt(tenureInput.value, 10);

    const emi          = calculateEMI(P, annualRate, N);
    const totalPayment = emi * N;
    originalTotalInterest = totalPayment - P;

    const schedule = generateAmortization(P, annualRate, N, partPayments);
    newTotalInterest = schedule.reduce((sum, m) => sum + m.interest, 0);

    emiChart.data.datasets[0].data = [P, originalTotalInterest];
    emiChart.update();

    loanDisplay.textContent   = '₹' + P.toLocaleString('en-IN');
    rateDisplay.textContent   = annualRate.toFixed(2) + '%';
    tenureDisplay.textContent = N;
    monthlyEmiEl.textContent  = '₹' + Math.round(emi).toLocaleString('en-IN');
    totalInterestEl.textContent = '₹' + Math.round(originalTotalInterest).toLocaleString('en-IN');
    totalPaymentEl.textContent  = '₹' + Math.round(totalPayment).toLocaleString('en-IN');

    renderAmortization(schedule);

    const savingsHighlight = document.getElementById("savingsHighlight");
    const savingsAmountEl  = document.getElementById("savingsAmount");
    const savingsDetailEl  = document.getElementById("savingsDetail");

    if (partPayments.length > 0) {
      const interestSaved = originalTotalInterest - newTotalInterest;
      const tenureReduced = N - schedule.length;

      const ppDetails = partPayments.map(pp => {
        const match = schedule.find(m => m.serial === pp.month && m.year === pp.year);
        if (match) {
          const monthName = new Date(match.year, match.month - 1)
            .toLocaleString('default', { month: 'short' });
          return `₹${pp.amount.toLocaleString('en-IN')} in ${monthName} ${match.year}`;
        }
        return `₹${pp.amount.toLocaleString('en-IN')} (date unknown)`;
      });

      savingsHighlight.classList.remove("hidden");

      const duration  = 1500;
      const startTime = performance.now();
      const endValue  = Math.round(interestSaved);

      function animateCount(now) {
        const progress     = Math.min((now - startTime) / duration, 1);
        const currentValue = Math.floor(progress * endValue);
        savingsAmountEl.textContent = `₹${currentValue.toLocaleString('en-IN')}`;
        if (progress < 1) requestAnimationFrame(animateCount);
      }
      requestAnimationFrame(animateCount);

      savingsDetailEl.textContent =
        `if you make part payment(s) of ${ppDetails.join(', ')}${tenureReduced > 0 ? `\n.  You repay entire loan early by ${tenureReduced} months.` : ''}`;

    } else {
      savingsHighlight.classList.add("hidden");
    }

    updateDisbursal();
  }


  // ─── Disbursal breakdown ──────────────────────
  function updateDisbursal() {
    const loanAmount  = Number(loanInput.value);
    const procFeeRate = Number(procFeeInput.value);
    const gstRate     = Number(gstInput.value);

    if (!loanAmount || isNaN(procFeeRate) || isNaN(gstRate)) return;

    let procFeeValue = (loanAmount * procFeeRate) / 100;
    if (procFeeValue > 25000) {
      procFeeValue = 25000;
      document.getElementById("procFeeNote").textContent = "(Capped at ₹25,000)";
    } else {
      document.getElementById("procFeeNote").textContent = "";
    }

    const gstValue           = (procFeeValue * gstRate) / 100;
    const gstValueOnInterest = currentLoanType === "credit" ? (originalTotalInterest * gstRate) / 100 : 0;
    const totalCharges       = procFeeValue + gstValue;
    const disbursalAmount    = loanAmount - totalCharges;

    let displayLoanType;
    if      (currentLoanType === "personal") displayLoanType = "Personal Loan";
    else if (currentLoanType === "home")     displayLoanType = "Home Loan";
    else if (currentLoanType === "car")      displayLoanType = "Car Loan";
    else                                     displayLoanType = "Loan on Credit Card";

    document.getElementById("loanType").textContent           = displayLoanType;
    document.getElementById("loanVal").textContent            = Math.round(loanAmount).toLocaleString('en-IN');
    document.getElementById("procFeeVal").textContent         = Math.round(procFeeValue).toLocaleString('en-IN');
    document.getElementById("gstVal").textContent             = Math.round(gstValue).toLocaleString('en-IN');
    document.getElementById("gstValOnInt").textContent        = Math.round(gstValueOnInterest).toLocaleString('en-IN');
    document.getElementById("totalCharges").textContent       = Math.round(totalCharges).toLocaleString('en-IN');
    document.getElementById("disbursalValue").textContent     = Math.round(disbursalAmount).toLocaleString('en-IN');
    document.getElementById("payBackValue").textContent       = Math.round(loanAmount + originalTotalInterest + gstValueOnInterest).toLocaleString('en-IN');
    document.getElementById("afterPartPaymentValue").textContent = Math.round(loanAmount + newTotalInterest + gstValueOnInterest).toLocaleString('en-IN');

    document.getElementById("loanSummary").classList.remove("hidden");
  }


  // ─── Bind sliders ─────────────────────────────
  bindInputWithSlider(loanInput,   loanRange,   updateResults);
  bindInputWithSlider(rateInput,   rateRange,   updateResults);
  bindInputWithSlider(tenureInput, tenureRange, updateResults);

  procFeeInput.addEventListener("input", updateDisbursal);
  gstInput.addEventListener("input",     updateDisbursal);

  procFeeInput.addEventListener("input", () => {
    if      (procFeeInput.value > 5) procFeeInput.value = 5;
    else if (procFeeInput.value < 0) procFeeInput.value = 0;
    updateDisbursal();
  });

  gstInput.addEventListener("input", () => {
    if      (gstInput.value > 22) gstInput.value = 22;
    else if (gstInput.value < 0)  gstInput.value = 0;
    updateDisbursal();
  });


  // ─── Initial render ───────────────────────────
  // updateResults();
  updateLoanLimits("home")

}); // end DOMContentLoaded


// ─── Restrict tenure to whole numbers ────────
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "tenureInput") {
    el.value = el.value.replace(/[^\d]/g, "");
    if (el.value !== "") el.value = parseInt(el.value, 10);
  }
});


// ─── EMI formula ─────────────────────────────
function calculateEMI(P, annualRate, N) {
  const r = (annualRate / 12) / 100;
  if (r === 0) return P / N;
  return P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
}


// ─── Amortization schedule generator ─────────
function generateAmortization(P, annualRate, N, partPayments = []) {
  const r       = annualRate / 12 / 100;
  let balance   = P;
  const schedule = [];

  const today = new Date();
  let month   = today.getMonth();
  let year    = today.getFullYear();

  let emi = calculateEMI(balance, annualRate, N);

  const ppMap = new Map();
  partPayments.forEach(pp => ppMap.set(pp.month, pp));

  const EPS           = 0.01;
  let originalTenure  = N;

  for (let i = 1; i <= N && balance > EPS; i++) {
    const interest = balance * r;
    let principal  = emi - interest;

    if (principal > balance) principal = balance;

    let emiForThisMonth = principal + interest;
    balance -= principal;

    let note = "";

    const pp = ppMap.get(i);
    if (pp) {
      const remainder = Number(pp.amount) - emiForThisMonth;
      if (remainder > 0) {
        balance -= remainder;
        if (balance <= EPS) {
          schedule.push({
            serial:    i,
            year,
            month:     month + 1,
            emi:       emiForThisMonth,
            principal,
            interest,
            balance:   0,
            note:      `Received part payment of ₹${pp.amount.toLocaleString('en-IN')} - Loan closed`
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
        if (emi > balance * r + EPS) {
          const monthsNeededExact = Math.log(emi / (emi - balance * r)) / Math.log(1 + r);
          N = i + Math.ceil(monthsNeededExact);
        }
        const monthsReduced = originalTenure - N;
        note = `Received part payment of ₹${pp.amount.toLocaleString('en-IN')}. Overall tenure reduced by ${monthsReduced} months.`;
      }
    }

    schedule.push({
      serial:    i,
      year,
      month:     month + 1,
      emi:       emiForThisMonth,
      principal,
      interest,
      balance:   balance < EPS ? 0 : balance,
      note
    });

    month++;
    if (month > 11) { month = 0; year++; }
  }

  dataForPdf = schedule;
  return schedule;
}


// ─── Amortization accordion renderer ─────────
function renderAmortization(schedule) {
  const container = document.getElementById('amortizationAccordion');
  container.innerHTML = '';

  if (!Array.isArray(schedule) || schedule.length === 0) return;

  const years = {};
  schedule.forEach(item => {
    if (!years[item.year]) years[item.year] = [];
    years[item.year].push(item);
  });

  const lastSerial = schedule[schedule.length - 1].serial;

  let maxPaidYear = null;
  if (Array.isArray(partPayments) && partPayments.length > 0) {
    maxPaidYear = Math.max(...partPayments.map(pp => Number(pp.year)));
  }

  for (const yr in years) {
    const yearDiv = document.createElement('div');
    yearDiv.className = 'border rounded-lg' ;
    yearDiv.style.borderColor = '#005B95';

    const header = document.createElement('button');
    header.className =
      'w-full text-left p-3 font-semibold rounded-t-lg flex justify-between items-center focus:outline-none';
    header.style.backgroundColor = '#f0f7fc';
    header.style.color = '#004f82';
    header.innerHTML = `${yr} <span>+</span>`;

    const monthContainer = document.createElement('div');
    monthContainer.className = 'max-h-0 overflow-hidden transition-all duration-500 ease-in-out';

    const innerWrapper = document.createElement('div');
    innerWrapper.className = 'p-3 space-y-1';
    monthContainer.appendChild(innerWrapper);

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

    years[yr].forEach((m) => {
      const monthRow = document.createElement('div');
      monthRow.className =
        'grid grid-cols-5 gap-2 text-xs py-1 border-b hover:bg-gray-50 text-center sm:text-sm';

      const monthName = new Date(m.year, m.month - 1)
        .toLocaleString('default', { month: 'short' });

      let actionHTML = '';
      if (m.serial >= lastSerial - 2) {
        actionHTML = `
          <button class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
            disabled title="Part payment not allowed on last 3 installments">N/A</button>`;
      } else if (currentLoanType === "credit") {
        actionHTML = `
          <button class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
            disabled title="Part payment not allowed for credit card loans">N/A</button>`;
      } else if (maxPaidYear !== null && Number(m.year) <= Number(maxPaidYear)) {
        actionHTML = `
          <button class="col-span-1 ml-auto md:mx-auto md:col-span-1 
                bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed"
            disabled title="Part payments disabled up to year ${maxPaidYear}">N/A</button>`;
      } else {
        actionHTML = `
          <button class="part-payment-btn col-span-1 ml-auto sm:mx-auto md:mx-auto md:col-span-1 md:px-4
                text-white px-2 py-1 rounded text-xs"
            style="background-color:#005B95;"
            data-month="${m.serial}"
            data-year="${m.year}"
            data-balance="${Math.round(m.balance)}"
            data-emi="${Math.round(m.emi)}">Pay</button>`;
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
          'col-span-6 text-center font-bold mx-auto text-sm italic p-2 rounded md:w-1/2';
        noteRow.style.color = '#004f82';
        noteRow.style.backgroundColor = '#f0f7fc';
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

    // Open the first accordion by default
    if (Object.keys(years)[0] === yr) {
      monthContainer.style.maxHeight = monthContainer.scrollHeight + 'px';
      header.querySelector('span').textContent = '−';
    }
  }
}


// ─── Modal open / close ───────────────────────
function openPartPaymentModal(maxOutstanding) {
  modal.classList.remove("hidden");
  setTimeout(() => {
    modalBox.classList.remove("scale-95", "opacity-0");
    modalBox.classList.add("scale-100", "opacity-100");
  }, 10);
  input.max = maxOutstanding;
  maxHint.textContent = `Max allowed: ₹${maxOutstanding.toLocaleString("en-IN")}`;
}

function closePartPaymentModal() {
  modalBox.classList.remove("scale-100", "opacity-100");
  modalBox.classList.add("scale-95", "opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 200);
}


// ─── Disable part payment buttons up to a year ─
function disablePartPaymentButtonsUpToYear(year) {
  document.querySelectorAll(".part-payment-btn").forEach(btn => {
    const btnYear = parseInt(btn.getAttribute("data-year"));
    if (btnYear <= year) {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  });
}


// ─── FAQ accordion ────────────────────────────
document.querySelectorAll("#faqAccordion button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const content = btn.nextElementSibling;
    const symbol  = btn.querySelector("span:last-child");

    if (content.style.maxHeight && content.style.maxHeight !== "0px") {
      content.style.maxHeight = "0px";
      content.style.opacity   = "0";
      symbol.textContent      = "+";
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
      content.style.opacity   = "1";
      symbol.textContent      = "−";
    }
  });
});


// ─── Navbar mobile menu toggle ────────────────
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn  = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));
  }
});
