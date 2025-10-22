// balanceTransfer.js

// ------------------------------
// 📘 Utility Calculation Functions
// ------------------------------
function calcEMI(p, r, n) {
  const monthlyRate = r / 12 / 100;
  return (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}
function calcOutstanding(p, r, n, x) {
  const monthlyRate = r / 12 / 100;
  return p * ((Math.pow(1 + monthlyRate, n) - Math.pow(1 + monthlyRate, x)) / (Math.pow(1 + monthlyRate, n) - 1));
}



function resetNewLoanResults() {
  // Reset displayed values in new loan summary
  document.getElementById("newLoanAmount").textContent = "–";
  document.getElementById("newEmi").textContent = "–";
  document.getElementById("newTenure").textContent = "–";
  document.getElementById("newProcFees").textContent = "–";
  document.getElementById("newGstFees").textContent = "–";
  document.getElementById("newTotal").textContent = "–";

  // Hide decision/result box
  // document.getElementById("totalForeclosureSection").classList.add("hidden");
  const decisionBox = document.getElementById("decisionBox");
  if (decisionBox) decisionBox.classList.add("hidden");
}

const existingLoansWrapper = document.getElementById("existingLoansWrapper");

// const observer = new MutationObserver(() => {
//   // When loan is added/removed:
//   // 1. Hide decision box (since user changed loan structure)
//   const decisionBox = document.getElementById("decisionBox");
//   if (decisionBox) decisionBox.classList.add("hidden");

//   // 2. Recalculate total foreclosure properly
//   updateTotalForeclosureSum();

//   // 3. Reset new loan summary (optional — if you want to clear summary when loan count changes)
//   resetNewLoanResults();
// });

// observer.observe(existingLoansWrapper, { childList: true });

const observer = new MutationObserver((mutations) => {
  let loanAdded = false;

  // Check if a loan was added
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      loanAdded = true;
    }
  });

  // 1️⃣ Always hide the decision box (since structure changed)
  const decisionBox = document.getElementById("decisionBox");
  if (decisionBox) decisionBox.classList.add("hidden");

  // 2️⃣ Always reset new loan summary
  resetNewLoanResults();

  // 3️⃣ If a loan was added, hide the foreclosure section temporarily
  if (loanAdded) {
    document.getElementById("totalForeclosureSection").classList.add("hidden");
  } else {
    // 4️⃣ If it was a removal, recalc totals
    updateTotalForeclosureSum();
  }
});

observer.observe(existingLoansWrapper, { childList: true });


// 🔒 Restrict month inputs to whole numbers only
  document.addEventListener("input", (e) => {
    const el = e.target;
// Tenure Restrictions (Months)
    if (
      el.classList.contains("oldTenureMonths") ||
      el.id === "newTenureMonths"
    ) {
      // Remove any non-digit or decimal characters
      el.value = el.value.replace(/[^\d]/g, "");

      // Convert to integer (optional, to drop leading zeros)
      if (el.value !== "") el.value = parseInt(el.value, 10);

       // Enforce min/max range (3–360 months)
      const minMonths = 3;
      const maxMonths = 360;

      if (el.value && el.value < minMonths) el.value = minMonths;
      if (el.value && el.value > maxMonths) el.value = maxMonths;
    }

//  Interest Rate Restrictions (% p.a.)
  if (
    el.classList.contains("oldInterest") ||
    el.id === "newInterest"
  ) {
    const minRate = 1;
    const maxRate = 36;

    let val = parseFloat(el.value);
    if (!isNaN(val)) {
      if (val < minRate) val = minRate;
      if (val > maxRate) val = maxRate;
      el.value = val;
    }
  }


    // When any existing loan input changes:
  if (
    el.closest(".existing-loan") &&
    (el.classList.contains("lenderName") ||
      el.classList.contains("oldLoanAmount") ||
      el.classList.contains("oldInterest") ||
      el.classList.contains("oldTenureMonths") ||
      el.classList.contains("emisPaid") ||
      el.classList.contains("foreclosureRate"))
  ) {
    const parentLoan = el.closest(".existing-loan");

    // 🧹 Reset this specific loan's summary box
    const resetFields = [
      ".oldEmi",
      ".outstanding",
      ".remainingEmis",
      ".remainingTotal",
      ".foreclosureFee",
      ".foreclosureGst",
      ".totalForeclose"
    ];
    resetFields.forEach((cls) => {
      const field = parentLoan.querySelector(cls);
      if (field) field.textContent = "–";
    });

    // Reset dataset values (so totals don’t add up stale data)
    parentLoan.dataset.forecloseAmount = 0;
    parentLoan.dataset.remainingPayment = 0;

    // Reset global totals & new loan summary
    resetNewLoanResults();
    updateTotalForeclosureSum(); // optional — ensures total foreclosure recalculates live
    document.getElementById("totalForeclosureSection").classList.add("hidden");
  }

  });


  // ------------------------------
// 👀 Hide Decision Box when New Lender Inputs Change
// ------------------------------
document.addEventListener("input", (e) => {
  const el = e.target;
  if (
    el.id === "newLenderName" ||
    el.id === "newInterest" ||
    el.id === "newTenureMonths" ||
    el.id === "processingFeeRate"
  ) {
    const decisionBox = document.getElementById("decisionBox");
    if (decisionBox) decisionBox.classList.add("hidden");
  }
});


// ------------------------------
// 🧮 Helper: Update Total Foreclosure Sum
// ------------------------------
function updateTotalForeclosureSum() {
  const loans = document.querySelectorAll(".existing-loan");
  let total = 0;
  loans.forEach((loan) => {
    const val = parseFloat(loan.dataset.forecloseAmount || 0);
    if (!isNaN(val) && val > 0) total += val;
  });

  const totalSection = document.getElementById("totalForeclosureSection");
  const totalSpan = document.getElementById("totalForeclosureSum");

  if (total > 0) {
    totalSpan.textContent = Number(total.toFixed(2)).toLocaleString('en-IN');
    totalSection.classList.remove("hidden");
  } else {
    totalSpan.textContent = "0";
    totalSection.classList.add("hidden");
  }

  totalSection.dataset.totalForeclose = total;
}

// ------------------------------
// ➕ Add Loan Button Handler (fixed)
// ------------------------------
const addBtn = document.getElementById("addLoanBtn");
addBtn.classList.add("hidden"); // hidden initially


addBtn.addEventListener("click", () => {
   
  const wrapper = document.getElementById("existingLoansWrapper");
  const firstLoan = wrapper.querySelector(".existing-loan");
  const newLoan = firstLoan.cloneNode(true);
  const count = wrapper.querySelectorAll(".existing-loan").length + 1;

  // Update heading
  newLoan.querySelector("h3").textContent = `Existing Loan ${count}`;

  // Reset all input and output values
  newLoan.querySelectorAll("input").forEach((inp) => (inp.value = ""));
  newLoan.querySelectorAll("span").forEach((span) => (span.textContent = "–"));

  // ✅ Ensure all stored data attributes are cleared
  newLoan.dataset.forecloseAmount = "";
  newLoan.dataset.remainingPayment = "";
  newLoan.dataset.lenderName = "";

  // ✅ Prevent new loan from being counted in total until calculated
  newLoan.classList.remove("calculated");

  // Add remove button if missing
  const header = newLoan.querySelector(".flex.items-center.justify-between");
  let removeBtn = header.querySelector(".removeLoanBtn");
  if (!removeBtn) {
    removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "removeLoanBtn text-sm px-3 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100";
    removeBtn.textContent = "Remove";
    header.appendChild(removeBtn);
  }

  // Remove loan event
  removeBtn.addEventListener("click", () => {
    newLoan.remove();
    const allLoans = wrapper.querySelectorAll(".existing-loan");
    allLoans.forEach((loan, idx) => {
      loan.querySelector("h3").textContent = `Existing Loan ${idx + 1}`;
    });
    updateTotalForeclosureSum();
    addBtn.classList.remove("hidden")
    
  });

  // Append new loan
  wrapper.appendChild(newLoan);


  // ✅ Do NOT update totals yet (user hasn’t calculated anything)
  // ✅ Hide Add button again until user calculates this loan
  addBtn.classList.add("hidden");
  
});

// ------------------------------
// 🧮 Calculate Existing Loan
// ------------------------------
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("calcExistingLoan")) {
    const parent = e.target.closest(".existing-loan");

    // const lenderName = parent.querySelector(".lenderName").value.trim() || "";
    const p = parseFloat(parent.querySelector(".oldLoanAmount").value);
    const rate = parseFloat(parent.querySelector(".oldInterest").value);
    const months = parseFloat(parent.querySelector(".oldTenureMonths").value);
    const emisPaid = parseFloat(parent.querySelector(".emisPaid").value);
    const foreclosureRate = parseFloat(parent.querySelector(".foreclosureRate").value) || 0;

    // Validate inputs
    if (isNaN(p) || isNaN(rate) || isNaN(months) || isNaN(emisPaid) || emisPaid < 0 || emisPaid >= months) {
      alert("Please fill all fields correctly before calculating.");
      return;
    }

    // Perform calculations
    const emi = calcEMI(p, rate, months);
    const outstanding = calcOutstanding(p, rate, months, emisPaid);
    const remainingEmis = months - emisPaid;
    const remainingTotal = emi * remainingEmis;
    const foreclosureFee = outstanding * (foreclosureRate / 100);
    const gst = foreclosureFee * 0.18;
    const totalForeclose = outstanding + foreclosureFee + gst;

    // Display results
    parent.querySelector(".oldEmi").textContent = "₹" + Number(emi.toFixed(2)).toLocaleString('en-IN');
    parent.querySelector(".outstanding").textContent = "₹" + Number(outstanding.toFixed(2)).toLocaleString('en-IN');
    parent.querySelector(".remainingEmis").textContent = remainingEmis + " Months";
    parent.querySelector(".remainingTotal").textContent = "₹" + Number(remainingTotal.toFixed(2)).toLocaleString('en-IN');
    parent.querySelector(".foreclosureFee").textContent = "₹" + Number(foreclosureFee.toFixed(2)).toLocaleString('en-IN');
    parent.querySelector(".foreclosureGst").textContent = "₹" + Number(gst.toFixed(2)).toLocaleString('en-IN');
    parent.querySelector(".totalForeclose").textContent = "₹" + Number(totalForeclose.toFixed(2)).toLocaleString('en-IN');

    // ✅ Store valid calculation results
    parent.dataset.forecloseAmount = totalForeclose;
    parent.dataset.remainingPayment = remainingTotal;
    // parent.dataset.lenderName = lenderName;
    parent.classList.add("calculated");

    // ✅ Update totals only after a successful calculation
    updateTotalForeclosureSum();

    // ✅ Show Add button again
    addBtn.classList.remove("hidden");
  }
});

// ------------------------------
// 🧾 Compare & Calculate Savings
// ------------------------------
document.getElementById("compareTransfer").addEventListener("click", () => {
  // const newLenderName = document.getElementById("newLenderName").value.trim() || "New Lender";
  const newRate = parseFloat(document.getElementById("newInterest").value);
  const newMonths = parseFloat(document.getElementById("newTenureMonths").value);
  const processingFeeRate = parseFloat(document.getElementById("processingFeeRate").value) || 0;
  // const processingGstRate = parseFloat(document.getElementById("processingGstRate").value) || 0;

  if (!newRate || !newMonths || newMonths <= 0) {
    alert("Please enter valid details for the new lender before comparing.");
    return;
  }

  // Get total foreclosure (new loan amount)
  const totalForeclosureDisplayed = parseFloat(
    document.getElementById("totalForeclosureSection").dataset.totalForeclose || 0
  );
  if (totalForeclosureDisplayed <= 0) {
    alert("Please calculate at least one existing loan before comparing.");
    return;
  }

  // Simple check: make sure all existing loans are calculated

    const allLoans = document.querySelectorAll(".existing-loan");
  for (const loan of allLoans) {
    const foreclose = parseFloat(loan.dataset.forecloseAmount || 0);
    if (!foreclose || foreclose <= 0) {
      alert("Please calculate all existing loans before comparing.");
      return;
    }
  }

  // Collect all existing loan totals
  const loans = document.querySelectorAll(".existing-loan.calculated");
  let totalOldPayment = 0;
  const lenders = [];
  loans.forEach((loan) => {
    const remainPay = parseFloat(loan.dataset.remainingPayment || 0);
    const lender = loan.dataset.lenderName || "Existing Lender";
    if (remainPay > 0) {
      totalOldPayment += remainPay;
      lenders.push(lender);
    }
  });

  // New loan details
  const newLoanAmount = totalForeclosureDisplayed;
  const newEMI = calcEMI(newLoanAmount, newRate, newMonths);
  const processingFee = newLoanAmount * (processingFeeRate / 100);
  const processingGst = processingFee * (18 / 100);
  const totalProcessingCost = processingFee + processingGst;
  const newTotalRepayment = newEMI * newMonths + totalProcessingCost;

  // Calculate savings
  const savings = totalOldPayment - newTotalRepayment;

  // Display Results
  document.getElementById("newLoanAmount").textContent = "₹" + Number(newLoanAmount.toFixed(2)).toLocaleString('en-IN');
  document.getElementById("newEmi").textContent = "₹" + Number(newEMI.toFixed(2)).toLocaleString('en-IN');
  document.getElementById("newTotal").textContent = "₹" + Number(newTotalRepayment.toFixed(2)).toLocaleString('en-IN');
  document.getElementById("newTenure").textContent = newMonths.toFixed(0) + " Months";
  document.getElementById("newProcFees").textContent = "₹" + Number(processingFee.toFixed(2)).toLocaleString('en-IN');
  document.getElementById("newGstFees").textContent = "₹" + Number(processingGst.toFixed(2)).toLocaleString('en-IN');


  // Show decision box
const decisionBox = document.getElementById("decisionBox");
decisionBox.classList.remove("hidden");

const titleEl = document.getElementById("decisionTitle");
const emojiEl = document.getElementById("decisionEmoji");
const labelEl = document.getElementById("decisionAmountLabel");
const amountEl = document.getElementById("decisionAmount");
const recoEl = document.getElementById("recommendationText");
const emojiSection = document.getElementById("emoji-section");
const savingsSection = document.getElementById("savings-section");
const recommendationBox = document.getElementById("recommendationBox");
const recommendationText = document.getElementById("recommendationText");

// Decide based on savings range
if (savings > 0) {
  // ✅ Positive savings
  labelEl.textContent = "You Save";
  amountEl.textContent = `₹${savings.toFixed(0)}`;
  amountEl.className = "text-xl font-bold text-green-700";
  emojiSection.className = "bg-green-100 border border-green-200 text-center rounded-2xl py-4";
  savingsSection.className = "bg-green-100 border border-green-200 text-center rounded-2xl py-4 sm:py-8";
  titleEl.className = "text-lg font-semibold text-green-700 mb-2";
  recommendationBox.className = "mt-4 bg-green-100 border-l-8 border-green-700 rounded-r-2xl p-4"
  recommendationText.className = "text-sm text-green-800 text-left font-medium"

  if (savings <= 10000) {
     emojiEl.src = "assets/is-it-worth.gif";
    titleEl.textContent = "Nice offer, but not worth switching";
    recoEl.textContent = `Surely you save some money but for ${savings.toFixed(0)}, is it worth going through all the process ? Taking new loan can also temporarily drops your credit score`;
  } else if (savings > 10000 && savings <= 20000) {
    emojiEl.src = "assets/clap.gif";
    titleEl.textContent = "Decent savings — could be worth it";
    recoEl.textContent = `Not a big savings but you can still consider it`;
  } else if (savings > 20000 && savings <= 50000) {
    emojiEl.src = "assets/star-eyes.gif";
    titleEl.textContent = "Solid Deal! Go for it";
    recoEl.textContent = `It's a good amount of savings. Go for it, if the offer is available`;
  } else {
    emojiEl.src = "assets/dollar-face.gif";
    titleEl.textContent = "Jackpot savings! Don’t miss this";
    recoEl.textContent = `Excellent offer — you’ll save big! Go ahead and lock this deal before rates change.`;
  }


} else if (savings < 0) {
  // ❌ Negative savings (it costs more)
  labelEl.textContent = "It Costs You";
  amountEl.textContent = `₹${Math.abs(savings).toFixed(0)}`;
  amountEl.className = "text-xl font-bold text-red-700";
  emojiSection.className = "bg-red-100 border border-red-200 text-center rounded-2xl py-4";
  savingsSection.className = "bg-red-100 border border-red-200 text-center rounded-2xl py-4 sm:py-8";
  titleEl.className = "text-lg font-semibold text-red-700 mb-2";
  recommendationBox.className = "mt-4 bg-red-100 border-l-8 border-red-700 rounded-r-2xl p-4"
  recommendationText.className = "text-sm text-red-700 text-left font-medium"

  const cost = Math.abs(savings);
  if (cost <= 10000) {
    emojiEl.src = "assets/thumbs-down.gif";
    titleEl.textContent = "Not ideal — think twice";
    recoEl.textContent = `You end up paying more interest. Better continue with your existing loans`;
    
  } else if (cost > 10000 && cost <= 25000) {
    emojiEl.src = "assets/very-bad-offer.gif";
    titleEl.textContent = "Bad deal";
    recoEl.textContent = `You end up paying more interest. Better continue with your existing loans`;
  } else {
    emojiEl.src = "assets/dont-even-think.gif";
    titleEl.textContent = "Don't even think of doing that";
    recoEl.textContent = `You’ll regret this — ₹${cost.toFixed(0)} is way too much to lose! Stay where you are.`;
  }


} else {
  // Neutral
  emojiEl.src = "assets/neutral-face.gif";
  titleEl.textContent = "It's a waste of time";
  titleEl.className = "text-lg font-semibold text-gray-700 mb-2";
  labelEl.textContent = "No Gain / No Loss";
  amountEl.textContent = "₹0";
  amountEl.className = "text-xl font-bold text-gray-700";
  recoEl.textContent = "When the total cost is about the same — Then why to waste your time.";
   emojiSection.className = "bg-gray-100 border border-gray-200 text-center rounded-2xl py-4";
  savingsSection.className = "bg-gray-100 border border-gray-200 text-center rounded-2xl py-4 sm:py-8";
  recommendationBox.className = "mt-4 bg-gray-100 border-l-8 border-gray-600 rounded-r-2xl p-4"
  recommendationText.className = "text-sm text-gray-600 text-left font-medium"
}

// ✅ GA4 Tracking for Balance Transfer Comparison
if (typeof gtag === "function") {
  gtag("event", "balance_transfer_check", {
    event_category: "Loan Comparison",
    event_label: "Balance Transfer",
    value: totalForeclosureDisplayed.toFixed(0), // total foreclosure amount used
  });
}

});





