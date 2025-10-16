
// Minimum income thresholds per loan type
const minIncomeByType = {
  personal: 25000,
  home: 22000,
  car: 20000,
  credit: 18000,
};

// Fixed rates and tenure (for eligibility)
const fixedROI = {
  personal: 15,
  home: 8.5,
  car: 10,
  credit: 18,
};

const fixedTenure = {
  personal: 48,
  home: 240,
  car: 84,
  credit: 36,
};

let selectedLoanType = "personal";

// EMI Formula
function calculateEMI(P, annualRate, N) {
  const r = annualRate / 12 / 100;
  return P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
}

// Update Minimum Income Note
function updateMinIncomeNote(type) {
  let note = document.getElementById("minIncomeNote");
  if (!note) {
    note = document.createElement("p");
    note.id = "minIncomeNote";
    note.className = "text-xs text-gray-500 mt-1 italic";
    document.querySelector("#eligIncome").insertAdjacentElement("afterend", note);
  }
  note.textContent = `Minimum required income for ${type} ${type === "credit"? "card" : "loan"}: ₹${minIncomeByType[type].toLocaleString("en-IN")}`;
}

// Handle Loan Type Buttons
document.querySelectorAll(".eligibility-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Reset all buttons to inactive state
    document.querySelectorAll(".eligibility-type-btn").forEach((b) => {
      b.classList.remove("active", "bg-blue-600", "text-white");
      b.classList.add("bg-gray-100", "text-gray-800");
    });

    // Activate the clicked one
    btn.classList.remove("bg-gray-100", "text-gray-800");
    btn.classList.add("active", "bg-blue-600", "text-white");

    // Update selected type
    selectedLoanType = btn.dataset.loantype;
    updateMinIncomeNote(selectedLoanType);

    // Hide result when switching type
    document.getElementById("eligibilityResult").classList.add("hidden");
  });
});

// Main Eligibility Function


function checkEligibility() {
  const income = Number(document.getElementById("eligIncome").value);
  const obligations = Number(document.getElementById("eligObligations").value || 0);
  const resultBox = document.getElementById("eligibilityResult");
  const output = document.getElementById("eligibilityOutput");
  const note = document.getElementById("eligibilityNote");

  resultBox.classList.remove("hidden");
  output.textContent = "";
  note.textContent = "";
  resultBox.classList.remove("bg-red-50", "border-red-300");
  resultBox.classList.add("bg-gradient-to-br", "from-blue-100", "to-indigo-100");

  if (!income || income <= 0) {
    output.innerHTML = "⚠️ Please enter a valid monthly income.";
    resultBox.classList.add("bg-red-50", "border-red-300");
    return;
  }

  const remainingIncome = income - obligations;

  // ✅ Check if remaining income meets the minimum threshold
  if (remainingIncome < minIncomeByType[selectedLoanType]) {
    output.innerHTML = `❌ Your income is too low to eligible for a ${selectedLoanType} ${selectedLoanType === "credit" ? "card" : "loan"}.`;
    resultBox.classList.add("bg-red-50", "border-red-300");
    return;
  }

  // ✅ Special logic for Credit Card
  if (selectedLoanType === "credit") {
    const creditLimit = Math.round(remainingIncome * 3.5);

    output.innerHTML = `
      Based on your monthly income and existing EMIs, you may be eligible for a
      <span class="font-semibold text-blue-700">credit card</span> 
      with a credit limit of upto:
      <br>
      <span class="text-2xl font-bold text-blue-700 mt-2 inline-block">
        ₹${creditLimit.toLocaleString("en-IN")}
      </span>
    `;

    note.textContent = `* Actual credit limit varies by bank and depends on your income, repayment history, and credit score.`;
    return;
  }

  // ✅ For all other loans
  const maxEmi = remainingIncome * 0.45;
  const r = fixedROI[selectedLoanType] / 12 / 100;
  const n = fixedTenure[selectedLoanType];
  const loanAmount = maxEmi * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)));

  output.innerHTML = `
    Based on your income and current obligations, you may be eligible for a
    <span class="font-semibold text-blue-700">${selectedLoanType} loan</span> of upto:
    <br>
    <span class="text-2xl font-bold text-blue-700 mt-2 inline-block">
      ₹${Math.round(loanAmount).toLocaleString("en-IN")}
    </span>
  `;

  note.textContent = `*Assuming an interest rate of ${fixedROI[selectedLoanType]}% p.a. and tenure of ${fixedTenure[selectedLoanType] / 12} years (standard for ${selectedLoanType} loans). Actual eligibility may vary based on your credit score.`;

  // ✅ Track event in Google Analytics
  if (typeof gtag === "function") {
    gtag("event", "loan_eligibility_check", {
      event_category: "engagement",
      event_label: selectedLoanType,  // logs which loan type user checked
      value: Number(document.getElementById("eligIncome").value) || 0 // logs income if you want
    });
  }

}


// Button Click Event
document.getElementById("checkEligibilityBtn").addEventListener("click", checkEligibility);

// Reset when income input changes
document.getElementById("eligIncome").addEventListener("input", () => {
  document.getElementById("eligibilityResult").classList.add("hidden");
});

// Init on Load
document.addEventListener("DOMContentLoaded", () => {
  updateMinIncomeNote(selectedLoanType);
});
