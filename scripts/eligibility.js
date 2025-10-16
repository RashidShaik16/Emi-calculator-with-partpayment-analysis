document.addEventListener("DOMContentLoaded", function () {
  const typeButtons = document.querySelectorAll(".eligibility-type-btn");
  const incomeInput = document.getElementById("eligIncome");
  const obligationsInput = document.getElementById("eligObligations");
  const checkBtn = document.getElementById("checkEligibilityBtn");
  const resultBox = document.getElementById("eligibilityResult");
  const resultOutput = document.getElementById("eligibilityOutput");
  const resultNote = document.getElementById("eligibilityNote");

  let selectedLoanType = "personal";

  const loanConfigs = {
    personal: { rate: 15, tenure: 60 },
    home: { rate: 8.5, tenure: 240 },
    car: { rate: 9.5, tenure: 84 },
    credit: { rate: 18, tenure: 36 }
  };

  // Handle loan type switch
  typeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      typeButtons.forEach(b => b.classList.remove("bg-blue-600", "text-white", "active"));
      typeButtons.forEach(b => b.classList.add("bg-gray-100", "text-gray-800"));
      btn.classList.remove("bg-gray-100", "text-gray-800");
      btn.classList.add("bg-blue-600", "text-white", "active");
      selectedLoanType = btn.getAttribute("data-loantype");
    });
  });

 checkBtn.addEventListener("click", () => {
  const income = parseFloat(incomeInput.value) || 0;
  const obligations = parseFloat(obligationsInput.value) || 0;
  const config = loanConfigs[selectedLoanType];

  if (income <= 0) {
    alert("Please enter your monthly income.");
    return;
  }

  // --- Step 1: Calculate disposable and EMI capacity (FOIR logic)
  const disposable = income - obligations;
  const maxEmi = disposable * 0.45; // 45% EMI-to-income rule

  // --- Step 2: Convert to loan amount
  const r = config.rate / 12 / 100;
  const n = config.tenure;
  const loanAmount = (maxEmi * ((1 + r) ** n - 1)) / (r * (1 + r) ** n);

  // --- Step 3: Calculate multiple of income
  const monthlyMultiplier = loanAmount / income;
  const multiplier = Math.round(monthlyMultiplier * 10) / 10; // round to 1 decimal

  // --- Step 4: Display result
  resultBox.classList.remove("hidden");

  resultOutput.innerHTML = `
    Based on your monthly income of ₹${income.toLocaleString("en-IN")} and obligations of ₹${obligations.toLocaleString("en-IN")},
    you may be eligible for a loan up to 
    <span class="font-bold text-blue-700 text-lg">₹${Math.round(loanAmount).toLocaleString("en-IN")}</span>.
    <br><span class="text-sm text-gray-700">That’s roughly <strong>${multiplier}×</strong> your monthly income.</span>
  `;

  resultNote.textContent = `Assuming an interest rate of ${config.rate}% p.a. and tenure of ${config.tenure / 12} years (standard for ${selectedLoanType} loans). Actual eligibility may vary.`;
});

});
