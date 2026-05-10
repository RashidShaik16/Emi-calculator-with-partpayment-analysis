
// ---- DOM refs ----
const loanAmountInput   = document.getElementById("loanAmountInput");
const loanAmountRange   = document.getElementById("loanAmountRange");
const loanAmountDisplay = document.getElementById("loanAmountDisplay");

const interestRateInput   = document.getElementById("interestRateInput");
const interestRateRange   = document.getElementById("interestRateRange");
const interestRateDisplay = document.getElementById("interestRateDisplay");

const tenureInput   = document.getElementById("tenureInput");
const tenureRange   = document.getElementById("tenureRange");
const tenureDisplay = document.getElementById("tenureDisplay");

const monthlyEmiEl              = document.getElementById("monthlyEmi");
const totalPaymentEl            = document.getElementById("totalPayment");
const summaryLoanAmountEl       = document.getElementById("summaryLoanAmount");
const summaryRateEl             = document.getElementById("summaryRate");
const summaryTenureEl           = document.getElementById("summaryTenure");
const summaryLoanAmountCreditEl = document.getElementById("summaryLoanAmountCredit");
const totalDebitsWithEventsEl   = document.getElementById("totalDebitsWithEvents");
const totalPaymentWithEventsEl  = document.getElementById("totalPaymentWithEvents");
const summaryTotalInterestEl    = document.getElementById("summaryTotalInterest");
const summaryTotalRepaymentEl   = document.getElementById("summaryTotalRepayment");

const savingsHighlight = document.getElementById("savingsHighlight");
const savingsAmount    = document.getElementById("savingsAmount");
const savingsDetail    = document.getElementById("savingsDetail");

const downloadPdfBtn   = document.getElementById("downloadPdfBtn");

// Modal refs
const alterModal      = document.getElementById("alterModal");
const alterModalBox   = document.getElementById("alterModalBox");
const modalMonthLabel = document.getElementById("modalMonthLabel");
const modalRoiInput   = document.getElementById("modalRoiInput");
const modalPartPayInput = document.getElementById("modalPartPayInput");
const maxAmountHint   = document.getElementById("maxAmountHint");
const currentRoiHint  = document.getElementById("currentRoiHint");
const confirmBtn      = document.getElementById("confirmAlterModal");

// ---- State ----
let events = [];              // Array of { month (serial), year, amount (or 0), newRoi (or null), option }
let dataForPdf    = null;
let originalTotalInterest = 0;
let newTotalInterest      = 0;

// Modal working vars
let selectedMonthSerial = null;
let selectedYear        = null;
let selectedMaxAmount   = 0;
let selectedCurrentRoi  = 0;
let selectedOriginalRoi  = 0;  // always the slider ROI, never changes


// ============================================================
// SLIDER / INPUT BINDING
// ============================================================
function bindSliderInput(inputEl, rangeEl, updateFn) {
  inputEl.addEventListener("input", () => { rangeEl.value = inputEl.value; });
  inputEl.addEventListener("blur", () => {
    let v = Number(inputEl.value);
    const mn = Number(inputEl.min), mx = Number(inputEl.max);
    if (isNaN(v) || v < mn) v = mn;
    if (v > mx) v = mx;
    inputEl.value = v;
    rangeEl.value = v;
    events = [];
    updateResults();
  });
  rangeEl.addEventListener("input", () => {
    inputEl.value = rangeEl.value;
    events = [];
    updateResults();
  });
}

bindSliderInput(loanAmountInput, loanAmountRange, updateResults);
bindSliderInput(interestRateInput, interestRateRange, updateResults);
bindSliderInput(tenureInput, tenureRange, updateResults);

// Restrict tenure to integers only
document.addEventListener("input", (e) => {
  if (e.target.id === "tenureInput") {
    e.target.value = e.target.value.replace(/[^\d]/g, "");
    if (e.target.value !== "") e.target.value = parseInt(e.target.value, 10);
  }
});


// ============================================================
// CORE MATH
// ============================================================
function calculateEMI(P, annualRate, N) {
  const r = annualRate / 12 / 100;
  if (r === 0) return P / N;
  return P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
}


// ============================================================
// AMORTIZATION WITH FLOATING EVENTS
// ============================================================
function generateAmortization(P, annualRate, N, eventsArr) {
  const EPS   = 0.01;
  const today = new Date();

  let balance      = P;
  let currentRate  = annualRate;
  let emi          = calculateEMI(balance, currentRate, N);
  let month        = today.getMonth();  // 0-based
  let year         = today.getFullYear();
  let schedule     = [];
  let originalTenure = N;

  // Build event map keyed by serial month number
  const evMap = new Map();
  eventsArr.forEach(ev => evMap.set(ev.month, ev));

  for (let i = 1; i <= N && balance > EPS; i++) {
    const r        = currentRate / 12 / 100;
    const interest = balance * r;
    let principal  = emi - interest;

    // Clamp final EMI
    if (principal > balance) principal = balance;
    let emiForMonth = principal + interest;
    balance -= principal;

    let note = "";
    const rateBeforeEvent = currentRate;  // rate BEFORE any event this month changes it

    // ---- Check for event at this serial ----
    const ev = evMap.get(i);
    if (ev) {
      let roiChanged   = false;
      let partPaid     = false;
      let partRemainder = 0;

      // --- Apply part payment (if any) ---
      // The part payment amount covers this month's EMI first.
      // Whatever is left after paying the EMI goes against the outstanding principal.
      // So: balance after EMI = balance (already updated above via principal deduction).
      // But we need to UNDO the principal deduction first, then apply:
      //   remainder = partAmount - emiForMonth   (the leftover after covering EMI)
      //   balance   = (balance + principal) - principal - remainder
      //             = balance - remainder
      // Which is equivalent to: balance -= (partAmount - emiForMonth)
      if (ev.amount && ev.amount > 0) {
        const partAmount = Number(ev.amount);
        const remainder  = partAmount - emiForMonth;  // amount left after covering EMI
        if (remainder > 0) {
          balance -= remainder;
        }
        // If partAmount <= emiForMonth it just covers part of the EMI - no extra principal credit.
        // balance is already correct from the principal deduction above.
        if (balance < 0) balance = 0;
        partPaid = true;
        partRemainder = Math.max(remainder, 0);
      }

      if (balance <= EPS) {
        schedule.push({
          serial: i, year, month: month + 1,
          emi: emiForMonth, principal, interest,
          balance: 0, note: `Part payment of ₹${Number(ev.amount).toLocaleString("en-IN")} – Loan closed early.`
        });
        break;
      }

      // --- Apply ROI change (if any) ---
      const newRoi = (ev.newRoi !== null && ev.newRoi !== "" && !isNaN(Number(ev.newRoi)))
        ? Number(ev.newRoi) : null;

      if (newRoi !== null) {
        currentRate = newRoi;
        roiChanged  = true;
      }

      // --- Recalculate forward based on option ---
      const remainingMonths = N - i;

      if (ev.option === "reduceEmi") {
        // Fresh recalculation: new EMI = f(balance, currentRate, remainingMonths)
        if (remainingMonths > 0) {
          const oldEmi = emi;
          emi = calculateEMI(balance, currentRate, remainingMonths);
          const roiPart  = roiChanged   ? ` Rate changed to ${currentRate}%.` : "";
          const partPart = partPaid ? ` Part payment of ₹${Number(ev.amount).toLocaleString("en-IN")}.` : "";
          note = `${partPart}${roiPart} EMI changed from ₹${Math.round(oldEmi).toLocaleString("en-IN")} to ₹${Math.round(emi).toLocaleString("en-IN")}.`;
        }
      } else {
        // reduceTenure: keep same EMI, recalculate how many months left
        if (emi > balance * (currentRate / 12 / 100) + EPS && remainingMonths > 0) {
          const r2 = currentRate / 12 / 100;
          if (r2 > 0) {
            const monthsNeeded = Math.log(emi / (emi - balance * r2)) / Math.log(1 + r2);
            const newTenure    = i + Math.ceil(monthsNeeded);
            const saved        = originalTenure - newTenure;
            const roiPart  = roiChanged ? ` Rate changed to ${currentRate}%.` : "";
            const partPart = partPaid ? ` Part payment of ₹${Number(ev.amount).toLocaleString("en-IN")}.` : "";
            note = `${partPart}${roiPart} Tenure reduced by ${saved > 0 ? saved : 0} months.`;
            N = newTenure;
          } else {
            // 0% rate - just reduce principal months
            const monthsNeeded = Math.ceil(balance / emi);
            N = i + monthsNeeded;
            note = `Rate changed to 0%. Tenure adjusted.`;
          }
        } else if (roiChanged || partPaid) {
          // EMI can't cover interest with new rate - force reduceEmi behaviour
          if (remainingMonths > 0) {
            const oldEmi = emi;
            emi = calculateEMI(balance, currentRate, remainingMonths);
            const roiPart  = roiChanged ? ` Rate changed to ${currentRate}%.` : "";
            const partPart = partPaid ? ` Part payment of ₹${Number(ev.amount).toLocaleString("en-IN")}.` : "";
            note = `${partPart}${roiPart} EMI adjusted to ₹${Math.round(emi).toLocaleString("en-IN")} (tenure-reduction not viable).`;
          }
        }
      }
    }

    schedule.push({
      serial: i, year, month: month + 1,
      emi: emiForMonth, principal, interest,
      balance: balance < EPS ? 0 : balance,
      note,
      currentRate,        // rate AFTER this month (possibly changed by event)
      rateBeforeEvent     // rate BEFORE event applied — cap anchor for Edit
    });

    month++;
    if (month > 11) { month = 0; year++; }
  }

  return schedule;
}


// ============================================================
// UPDATE RESULTS (called on every input change or event)
// ============================================================
function updateResults() {
  const P    = Number(loanAmountInput.value);
  const rate = parseFloat(interestRateInput.value);
  const N    = parseInt(tenureInput.value, 10);

  // Display labels
  loanAmountDisplay.textContent  = "₹" + P.toLocaleString("en-IN");
  interestRateDisplay.textContent = rate.toFixed(2) + "%";
  tenureDisplay.textContent = `${N} mo (${(N / 12).toFixed(1)} yr)`;

  if (!P || !rate || !N) return;

  // Original loan summary (no events)
  const baseEmi   = calculateEMI(P, rate, N);
  const basePay   = baseEmi * N;
  originalTotalInterest = basePay - P;

  // Summary card
  monthlyEmiEl.textContent              = "₹" + Math.round(baseEmi).toLocaleString("en-IN");
  summaryLoanAmountEl.textContent       = "₹" + P.toLocaleString("en-IN");
  summaryRateEl.textContent             = rate.toFixed(2) + "% p.a.";
  summaryTenureEl.textContent           = N + " months (" + (N / 12).toFixed(1) + " yrs)";
  summaryLoanAmountCreditEl.textContent = "₹" + P.toLocaleString("en-IN");
  totalPaymentEl.textContent            = "₹" + Math.round(basePay).toLocaleString("en-IN");
  summaryTotalInterestEl.textContent    = "₹" + Math.round(originalTotalInterest).toLocaleString("en-IN");
  summaryTotalRepaymentEl.textContent   = "₹" + Math.round(basePay).toLocaleString("en-IN");

  // Amortization with events
  const schedule = generateAmortization(P, rate, N, events);
  dataForPdf     = schedule;

  newTotalInterest = schedule.reduce((s, m) => s + m.interest, 0);

  // ---- Total Debits with Events pill ----
  if (events.length > 0) {
    const newTotalPay   = schedule.reduce((s, m) => s + m.emi, 0);
    const extraPaid     = events.reduce((s, ev) => {
      if (!ev.amount || ev.amount <= 0) return s;
      const match = schedule.find(m2 => m2.serial === ev.month);
      const emiAmt = match ? match.emi : 0;
      return s + Math.max(Number(ev.amount) - emiAmt, 0);
    }, 0);
    const totalWithEv = Math.round(newTotalPay + extraPaid);
    totalDebitsWithEventsEl.classList.remove("hidden");
    totalDebitsWithEventsEl.classList.add("flex");
    totalPaymentWithEventsEl.textContent = "₹" + totalWithEv.toLocaleString("en-IN");
  } else {
    totalDebitsWithEventsEl.classList.add("hidden");
    totalDebitsWithEventsEl.classList.remove("flex");
  }

  // ---- Savings section ----
  if (events.length > 0) {
    const saved = Math.round(originalTotalInterest - newTotalInterest);
    const tenureReduced = N - schedule.length;

    savingsHighlight.classList.remove("hidden");

    // Animate count
    const duration = 1400;
    const startTime = performance.now();
    const endVal = Math.max(saved, 0);
    function animateCount(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const cur = Math.floor(progress * endVal);
      savingsAmount.textContent = "₹" + cur.toLocaleString("en-IN");
      if (progress < 1) requestAnimationFrame(animateCount);
    }
    requestAnimationFrame(animateCount);

    // Build detail — "if you make part payment(s) of ₹X in Month Year"
    const partPayEvents = events.filter(ev => ev.amount && ev.amount > 0);
    const roiEvents     = events.filter(ev => ev.newRoi !== null && ev.newRoi !== "");

    // Build pill elements — one pill per event, one pill for tenure saved
    savingsDetail.innerHTML = "";

    // Part payment pills
    partPayEvents.forEach(ev => {
      const match = schedule.find(m => m.serial === ev.month);
      if (!match) return;
      const mLabel = new Date(match.year, match.month - 1)
        .toLocaleString("default", { month: "short", year: "numeric" });
      const pill = document.createElement("span");
      pill.className = "inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full";
      pill.innerHTML = `<svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a1 1 0 100-2 1 1 0 000 2z"/></svg>Part payment &nbsp;<strong>&#8377;${Number(ev.amount).toLocaleString("en-IN")}</strong>&nbsp; in ${mLabel}`;
      savingsDetail.appendChild(pill);
    });

    // ROI change pills
    roiEvents.forEach(ev => {
      const match = schedule.find(m => m.serial === ev.month);
      if (!match) return;
      const mLabel = new Date(match.year, match.month - 1)
        .toLocaleString("default", { month: "short", year: "numeric" });
      const prevRoi = match.rateBeforeEvent || Number(interestRateInput.value);
      const pill = document.createElement("span");
      pill.className = "inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1.5 rounded-full";
      pill.innerHTML = `<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/></svg>Rate ${prevRoi}% to <strong>&nbsp;${ev.newRoi}%</strong>&nbsp; in ${mLabel}`;
      savingsDetail.appendChild(pill);
    });

    // Tenure saved pill
    if (tenureReduced > 0) {
      const pill = document.createElement("span");
      pill.className = "inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full";
      pill.innerHTML = `<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Loan closes <strong>&nbsp;${tenureReduced} months&nbsp;</strong> early`;
      savingsDetail.appendChild(pill);
    }
  } else {
    savingsHighlight.classList.add("hidden");
  }

  renderAmortization(schedule, N);
}


// ============================================================
// RENDER AMORTIZATION ACCORDION
// ============================================================
function renderAmortization(schedule, originalN) {
  const container = document.getElementById("amortizationAccordion");
  container.innerHTML = "";

  if (!schedule || schedule.length === 0) return;

  // Group by year
  const years = {};
  schedule.forEach(m => {
    if (!years[m.year]) years[m.year] = [];
    years[m.year].push(m);
  });

  const lastSerial = schedule[schedule.length - 1].serial;
  const totalSerials = lastSerial;

  // Years with events
  const eventYearSet = new Set(events.map(ev => ev.year));

  // Max event year
  let maxEventYear = null;
  if (events.length > 0) {
    maxEventYear = Math.max(...events.map(ev => Number(ev.year)));
  }

  Object.keys(years).forEach((yr, idx) => {
    const yearDiv = document.createElement("div");
    yearDiv.className = "border rounded-xl overflow-hidden";

    // Header
    const header = document.createElement("button");
    header.className = "w-full text-left p-3 font-semibold bg-blue-100 text-blue-800 flex justify-between items-center focus:outline-none";

    const hasEvent = eventYearSet.has(Number(yr));
    const eventTag = hasEvent
      ? `<span class="event-badge bg-green-100 text-green-700 ml-2">Event</span>` : "";

    header.innerHTML = `<span>${yr}${eventTag}</span><span class="toggle-icon">+</span>`;

    // Body
    const body = document.createElement("div");
    body.className = "accordion-body";

    const inner = document.createElement("div");
    inner.className = "p-3 space-y-1";

    // Column headers
    const th = document.createElement("div");
    th.className = "grid grid-cols-5 gap-1 text-xs font-bold text-blue-500 border-b pb-1 text-center";
    th.innerHTML = `<div>Month</div><div>EMI</div><div>Interest / Principal</div><div>Balance</div><div>Action</div>`;
    inner.appendChild(th);

    years[yr].forEach(m => {
      const mName = new Date(m.year, m.month - 1).toLocaleString("default", { month: "short" });

      const row = document.createElement("div");
      row.className = "grid grid-cols-5 gap-1 text-xs py-1 border-b hover:bg-gray-50 text-center items-center";

      // Determine button state
      // Only the LAST event is editable. All prior event months are locked to N/A.
      let actionHTML = "";
      const isLastThree    = m.serial >= totalSerials - 2;
      const yearHasEvent   = eventYearSet.has(Number(yr));
      const isLockedYear   = maxEventYear !== null && Number(yr) <= maxEventYear && !yearHasEvent;
      const isPastEventMonth = yearHasEvent && !events.find(ev => ev.month === m.serial && ev.year === m.year);

      // Find the last event by highest serial month number
      const lastEventSerial = events.length > 0
        ? Math.max(...events.map(ev => ev.month))
        : null;
      const isThisTheLastEvent = lastEventSerial !== null && m.serial === lastEventSerial;

      if (isLastThree) {
        actionHTML = `<button disabled class="bg-gray-300 text-white px-2 py-1 rounded text-xs cursor-not-allowed mx-auto">N/A</button>`;
      } else if (isLockedYear || isPastEventMonth) {
        actionHTML = `<button disabled class="bg-gray-300 text-white px-2 py-1 rounded text-xs cursor-not-allowed mx-auto" title="Only one event per year">N/A</button>`;
      } else if (yearHasEvent && events.find(ev => ev.month === m.serial && ev.year === m.year)) {
        // This month has an event — only show Edit if it is the last event
        if (isThisTheLastEvent) {
          actionHTML = `<button class="alter-btn bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-xs mx-auto"
            data-month="${m.serial}" data-year="${m.year}" data-balance="${Math.round(m.balance)}" data-roi="${m.rateBeforeEvent || m.currentRate || Number(interestRateInput.value)}" data-original-roi="${Number(interestRateInput.value)}">Edit</button>`;
        } else {
          actionHTML = `<button disabled class="bg-gray-400 text-white px-2 py-1 rounded text-xs cursor-not-allowed mx-auto" title="Earlier events are locked">Locked</button>`;
        }
      } else {
        actionHTML = `<button class="alter-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-xs mx-auto"
          data-month="${m.serial}" data-year="${m.year}" data-balance="${Math.round(m.balance)}" data-roi="${m.rateBeforeEvent || m.currentRate || Number(interestRateInput.value)}" data-original-roi="${Number(interestRateInput.value)}">Pay</button>`;
      }

      row.innerHTML = `
        <div>${m.serial}. ${mName}</div>
        <div>₹${Math.round(m.emi).toLocaleString("en-IN")}</div>
        <div>₹${Math.round(m.interest).toLocaleString("en-IN")} / ₹${Math.round(m.principal).toLocaleString("en-IN")}</div>
        <div>₹${Math.round(m.balance).toLocaleString("en-IN")}</div>
        <div>${actionHTML}</div>
      `;

      inner.appendChild(row);

      // Note row — bold, blue left-border, "Received" prefix (matching main calc style)
      if (m.note) {
        const noteRow = document.createElement("div");
        noteRow.className = "text-xs font-bold text-blue-900 bg-blue-100 border-l-4 border-blue-500 px-4 py-2 rounded my-1 mx-auto text-center" ; noteRow.style.maxWidth = "520px";
        // "Received" only makes sense when a part payment was made
        const hasPartPay = events.some(ev => ev.month === m.serial && ev.amount > 0);
        noteRow.textContent = (hasPartPay ? "Received " : "") + m.note;
        inner.appendChild(noteRow);
      }
    });

    body.appendChild(inner);
    header.addEventListener("click", () => {
      const isOpen = body.style.maxHeight && body.style.maxHeight !== "0px";
      if (isOpen) {
        body.style.maxHeight = "0px";
        header.querySelector(".toggle-icon").textContent = "+";
      } else {
        body.style.maxHeight = body.scrollHeight + "px";
        header.querySelector(".toggle-icon").textContent = "−";
      }
    });

    yearDiv.appendChild(header);
    yearDiv.appendChild(body);
    container.appendChild(yearDiv);

    // Open first year by default
    if (idx === 0) {
      body.style.maxHeight = body.scrollHeight + "px";
      header.querySelector(".toggle-icon").textContent = "−";
    }
  });
}


// ============================================================
// MODAL LOGIC
// ============================================================
function openModal(monthSerial, year, balance, currentRoi, originalRoi) {
  selectedMonthSerial = monthSerial;
  selectedYear        = year;
  selectedMaxAmount   = balance;
  selectedCurrentRoi  = currentRoi;
  selectedOriginalRoi = originalRoi;

  const ROI_CAP    = 3;
  const minAllowed = Math.max(1,  currentRoi - ROI_CAP);
  const maxAllowed = Math.min(25, currentRoi + ROI_CAP);

  // Pre-fill if editing an existing event
  const existingEv = events.find(ev => ev.month === monthSerial && ev.year === year);
  if (existingEv) {
    modalRoiInput.value     = existingEv.newRoi !== null ? existingEv.newRoi : "";
    modalPartPayInput.value = existingEv.amount > 0 ? existingEv.amount : "";
    document.querySelector(`input[name="alterOption"][value="${existingEv.option}"]`).checked = true;
  } else {
    modalRoiInput.value     = "";
    modalPartPayInput.value = "";
    document.querySelector(`input[name="alterOption"][value="reduceTenure"]`).checked = true;
  }

  const sched = dataForPdf || [];
  const match = sched.find(m => m.serial === monthSerial);
  const dispMonth = match
    ? new Date(match.year, match.month - 1).toLocaleString("default", { month: "long" })
    : "";
  modalMonthLabel.textContent = `Month ${monthSerial} – ${dispMonth} ${year}`;
  maxAmountHint.textContent   = `Max allowed: ₹${balance.toLocaleString("en-IN")}`;

  // Two-line ROI hint
  currentRoiHint.innerHTML =
    `<span class="text-gray-500">Original loan rate: <strong>${originalRoi}%</strong></span><br>` +
    `<span class="text-blue-600">Effective rate at this month: <strong>${currentRoi}%</strong> &nbsp;|&nbsp; ` +
    `Allowed change: <strong>${minAllowed}% – ${maxAllowed}%</strong> (±${ROI_CAP}%)</span>`;

  alterModal.classList.remove("hidden");
  setTimeout(() => {
    alterModalBox.classList.remove("scale-95", "opacity-0");
    alterModalBox.classList.add("scale-100", "opacity-100");
  }, 10);
}

function closeModal() {
  alterModalBox.classList.remove("scale-100", "opacity-100");
  alterModalBox.classList.add("scale-95", "opacity-0");
  setTimeout(() => alterModal.classList.add("hidden"), 200);
}

document.getElementById("cancelAlterModal").addEventListener("click", closeModal);
document.getElementById("cancelAlterModal2").addEventListener("click", closeModal);

// Confirm event
confirmBtn.addEventListener("click", () => {
  const rawRoi     = modalRoiInput.value.trim();
  const rawAmount  = modalPartPayInput.value.trim();
  const option     = document.querySelector("input[name='alterOption']:checked")?.value;

  const newRoi    = rawRoi !== "" ? Number(rawRoi)   : null;
  const partAmount = rawAmount !== "" ? Number(rawAmount) : 0;

  // Validation: at least one must be set
  if (newRoi === null && partAmount === 0) {
    alert("Please enter a new interest rate, a part payment amount, or both.");
    return;
  }

  // Validate ROI
  if (newRoi !== null) {
    if (isNaN(newRoi) || newRoi < 1 || newRoi > 25) {
      alert("Interest rate must be between 1% and 25%.");
      return;
    }
    const ROI_CAP = 3;
    const minAllowed = Math.max(1,  selectedCurrentRoi - ROI_CAP);
    const maxAllowed = Math.min(25, selectedCurrentRoi + ROI_CAP);
    if (newRoi < minAllowed || newRoi > maxAllowed) {
      alert(`New rate must be within ±${ROI_CAP}% of the current effective rate (${selectedCurrentRoi}%).
Allowed range: ${minAllowed}% – ${maxAllowed}%.`);
      return;
    }
    if (newRoi === selectedCurrentRoi && partAmount === 0) {
      alert("The new interest rate is the same as the current effective rate. Please change it or add a part payment.");
      return;
    }
  }

  // Validate part payment
  if (partAmount > 0) {
    if (partAmount > selectedMaxAmount) {
      alert(`Part payment cannot exceed ₹${selectedMaxAmount.toLocaleString("en-IN")} (outstanding balance).`);
      return;
    }
    const emiVal = dataForPdf
      ? Math.round((dataForPdf.find(m => m.serial === selectedMonthSerial) || {}).emi || 0)
      : 0;
    if (partAmount < emiVal && partAmount < selectedMaxAmount) {
      alert(`Part payment amount is less than the current EMI (₹${emiVal.toLocaleString("en-IN")}). Please enter at least the EMI amount or the full outstanding balance.`);
      return;
    }
  }

  // Remove any existing event for this year/month and save new one
  events = events.filter(ev => !(ev.month === selectedMonthSerial && ev.year === selectedYear));
  events.push({
    month:  selectedMonthSerial,
    year:   selectedYear,
    amount: partAmount,
    newRoi: newRoi,
    option: option
  });

  closeModal();
  updateResults();

  // Scroll to savings
  setTimeout(() => {
    const el = document.getElementById("savingsHighlight");
    if (el && !el.classList.contains("hidden")) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 300);
});

// Delegation for alter buttons
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("alter-btn")) {
    const monthSerial = parseInt(e.target.getAttribute("data-month"));
    const year        = parseInt(e.target.getAttribute("data-year"));
    const balance     = Number(e.target.getAttribute("data-balance"));
    const roi         = Number(e.target.getAttribute("data-roi"));
    const origRoi     = Number(e.target.getAttribute("data-original-roi"));
    openModal(monthSerial, year, balance, roi, origRoi);
  }
});


// ============================================================
// PDF DOWNLOAD
// ============================================================
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => {
    if (!dataForPdf || !Array.isArray(dataForPdf) || dataForPdf.length === 0) {
      alert("No amortization data available. Please set the loan details first.");
      return;
    }

    const P    = Number(loanAmountInput.value);
    const rate = parseFloat(interestRateInput.value);
    const N    = parseInt(tenureInput.value, 10);
    const emiVal = Math.round(calculateEMI(P, rate, N));

    const loanInfo = {
      amount:           P,
      interestRate:     rate,
      tenure:           N,
      emi:              emiVal,
      totalInterest:    Math.round(originalTotalInterest),
      totalPayment:     Math.round(emiVal * N),
      originalInterest: Math.round(originalTotalInterest),
      newInterest:      Math.round(newTotalInterest),
      loanType:         "home"
    };

    pdfGeneratorFloat(dataForPdf, events, loanInfo);
  });
}


// ============================================================
// INITIAL RENDER
// ============================================================
updateResults();


// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================

// ============================================================
// FAQ ACCORDION
// ============================================================
document.querySelectorAll("#faqAccordion button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const content = btn.nextElementSibling;
    const symbol = btn.querySelector("span:last-child");

    if (content.style.maxHeight && content.style.maxHeight !== "0px") {
      content.style.maxHeight = "0px";
      content.style.opacity = "0";
      symbol.textContent = "+";
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
      content.style.opacity = "1";
      symbol.textContent = "−";
    }
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker registered'))
    .catch((err) => console.log('Service Worker failed:', err));
}

// ============================================================
// PWA INSTALL BANNER — exact same as main calc
// ============================================================
let deferredPrompt;
const popup = document.getElementById('installPopup');
const addShortCutBtn = document.getElementById('addShortCutBtn');
const closeShortCutBtn = document.getElementById('closeShortCutBtn');
let popupTimer;
let popupDelay = 15000;

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

function schedulePopup(delay) {
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => showPopup(), delay);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  schedulePopup(popupDelay);
});

addShortCutBtn.addEventListener('click', async () => {
  clearTimeout(popupTimer);
  popup.classList.add('hidden');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwaInstalled', 'true');
    } else {
      popupDelay = 30000;
      schedulePopup(popupDelay);
    }
    deferredPrompt = null;
  }
});

closeShortCutBtn.addEventListener('click', () => {
  clearTimeout(popupTimer);
  popup.classList.add('hidden');
  popupDelay = 30000;
  schedulePopup(popupDelay);
});
