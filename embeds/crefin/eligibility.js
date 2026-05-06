// ─────────────────────────────────────────────
//  KnowYourEMI — Eligibility Embed (crefin.co.in)
//  Standalone version — not shared with main site
// ─────────────────────────────────────────────

// Minimum income thresholds per loan type
const minIncomeByType = {
  personal: 25000,
  home:     22000,
  car:      20000,
};

// Fixed rates and tenure (for eligibility calc)
const fixedROI = {
  personal: 15,
  home:     8.5,
  car:      10,
};

const fixedTenure = {
  personal: 48,
  home:     240,
  car:      84,
};

let selectedLoanType = "home";


// ─── Minimum income note ──────────────────────
function updateMinIncomeNote(type) {
  let note = document.getElementById("minIncomeNote");
  if (!note) {
    note = document.createElement("p");
    note.id = "minIncomeNote";
    note.className = "text-xs text-gray-500 mt-1 italic";
    document.querySelector("#eligIncome").insertAdjacentElement("afterend", note);
  }
  note.textContent = `Minimum required income for ${type} loan: ₹${minIncomeByType[type].toLocaleString("en-IN")}`;
}


// ─── Loan type button clicks ──────────────────
document.querySelectorAll(".eligibility-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Reset all to inactive
    document.querySelectorAll(".eligibility-type-btn").forEach((b) => {
      b.classList.remove("active");
      b.style.backgroundColor = "";
      b.style.color = "";
      b.style.boxShadow = "";
    });

    // Activate clicked
    btn.classList.add("active");
    btn.style.backgroundColor = "#005B95";
    btn.style.color = "#ffffff";
    btn.style.boxShadow = "0 2px 8px rgba(0, 91, 149, 0.3)";

    selectedLoanType = btn.dataset.loantype;
    updateMinIncomeNote(selectedLoanType);

    // Hide result on type switch
    document.getElementById("eligibilityResult").classList.add("hidden");
  });
});


// ─── Show result box in correct state ─────────
function showResult(isError) {
  const resultBox = document.getElementById("eligibilityResult");
  resultBox.classList.remove("hidden");

  if (isError) {
    resultBox.style.backgroundColor = "#fef2f2";
    resultBox.style.border = "1px solid #fca5a5";
    resultBox.querySelector("h3").style.color = "#dc2626";
  } else {
    resultBox.style.background = "linear-gradient(160deg, #deedf8 0%, #c2ddf0 60%, #aed0ea 100%)";
    resultBox.style.border = "1px solid #8bbedd";
    resultBox.querySelector("h3").style.color = "#004f82";
  }
}


// ─── Main eligibility check ───────────────────
function checkEligibility() {
  const income      = Number(document.getElementById("eligIncome").value);
  const obligations = Number(document.getElementById("eligObligations").value || 0);
  const output      = document.getElementById("eligibilityOutput");
  const note        = document.getElementById("eligibilityNote");

  output.innerHTML = "";
  note.textContent = "";

  // Validate income
  if (!income || income <= 0) {
    showResult(true);
    output.innerHTML = `<span style="color:#dc2626;">⚠️ Please enter a valid monthly income.</span>`;
    return;
  }

  const remainingIncome = income - obligations;

  // Check minimum income threshold
  if (remainingIncome < minIncomeByType[selectedLoanType]) {
    showResult(true);
    output.innerHTML = `<span style="color:#dc2626;">❌ Your income is too low to be eligible for a ${selectedLoanType} loan.</span>`;
    return;
  }

  // Calculate eligibility
  const maxEmi     = remainingIncome * 0.45;
  const r          = fixedROI[selectedLoanType] / 12 / 100;
  const n          = fixedTenure[selectedLoanType];
  const loanAmount = maxEmi * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)));

  showResult(false);

  output.innerHTML = `
    <span style="color: #4a7fa5; font-size: 0.875rem;">
      Based on your income and current obligations, you may be eligible for a
      <strong style="color:#004f82;">${selectedLoanType} loan</strong> of upto:
    </span>
    <span style="display:block; color:#005B95; font-size:1.75rem; font-weight:700; margin-top:0.5rem;">
      ₹${Math.round(loanAmount).toLocaleString("en-IN")}
    </span>
  `;

  note.style.color = "#4a7fa5";
  note.textContent = `*Assuming an interest rate of ${fixedROI[selectedLoanType]}% p.a. and tenure of ${fixedTenure[selectedLoanType] / 12} years (standard for ${selectedLoanType} loans). Actual eligibility may vary based on your credit score.`;

  // GA4 tracking
  if (typeof gtag === "function") {
    gtag("event", "loan_eligibility_check", {
      event_category: "engagement",
      event_label:    selectedLoanType,
      value:          income,
      client:         window.KYE_CLIENT || "crefin"
    });
  }
}


// ─── Event listeners ──────────────────────────
document.getElementById("checkEligibilityBtn").addEventListener("click", checkEligibility);

document.getElementById("eligIncome").addEventListener("input", () => {
  document.getElementById("eligibilityResult").classList.add("hidden");
});


// ─── Init ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Set Home Loan as default active button
  document.querySelectorAll(".eligibility-type-btn").forEach((b) => {
    b.classList.remove("active");
    b.style.backgroundColor = "";
    b.style.color = "";
    b.style.boxShadow = "";
  });

  const defaultBtn = document.querySelector(`.eligibility-type-btn[data-loantype="home"]`);
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    defaultBtn.style.backgroundColor = "#005B95";
    defaultBtn.style.color = "#ffffff";
    defaultBtn.style.boxShadow = "0 2px 8px rgba(0, 91, 149, 0.3)";
  }

  updateMinIncomeNote(selectedLoanType);
});
