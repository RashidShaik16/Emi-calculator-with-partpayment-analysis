    // ── Utilities ──────────────────────────────────────────────────
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('mobile-menu').classList.toggle('hidden');
    });
    document.getElementById('year').textContent = new Date().getFullYear();

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.body.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        document.getElementById('progressBar').style.width = (scrollTop / docHeight * 100) + '%';
      }
    });

    // ── Sanitize: only allow digits ────────────────────────────────
    function sanitizeNumericInput(el) {
      el.addEventListener('input', () => {
        el.value = el.value.replace(/[^0-9]/g, '');
      });
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        el.value = pasted.replace(/[^0-9]/g, '').slice(0, el.maxLength);
      });
      el.addEventListener('keydown', (e) => {
        const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
        if (allowed.includes(e.key)) return;
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
      });
    }

    sanitizeNumericInput(document.getElementById('salary'));
    sanitizeNumericInput(document.getElementById('obligations'));
    sanitizeNumericInput(document.getElementById('age'));

    // Reset result values to dashes on any input change
    const allInputs = ['salary','obligations','age','loanType','tenure','creditScore'];
    allInputs.forEach(id => {
      document.getElementById(id).addEventListener('change', resetResults);
      document.getElementById(id).addEventListener('input', resetResults);
    });

    function resetResults() {
      const dashIds = ['res-loanType','res-emiCapacity','res-rate','res-loanRange','res-tenure','res-foir','res-score'];
      dashIds.forEach(id => {
        const el = document.getElementById(id);
        el.textContent = '--';
        el.className = 'result-value dash';
      });
      document.getElementById('resultNote').style.display = 'none';
      const noteIds = ['note-maxEmi','note-obligations','note-available','note-summary'];
      noteIds.forEach(id => { document.getElementById(id).textContent = ''; });
      document.getElementById('rejectionPanel').classList.remove('visible');
      document.getElementById('resultSubtitle').textContent = 'Fill in your details and click Calculate';
    }

    // ── Tenure options by loan type ────────────────────────────────
    const tenureOptions = {
      home:     [10,12,15,20,25,30],
      personal: [2,3,4,5,6,7],
      car:      [3,4,5,6,7]
    };

    document.getElementById('loanType').addEventListener('change', function() {
      const type = this.value;
      const tenureSelect = document.getElementById('tenure');
      const age = parseInt(document.getElementById('age').value) || 0;
      tenureSelect.innerHTML = '<option value="">Select tenure</option>';

      if (!type) return;

      const options = tenureOptions[type] || [];
      const retirementAge = 60;

      options.forEach(yr => {
        if (type === 'home' && age > 0 && (age + yr) > retirementAge) return;
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr === 1 ? '1 Year' : yr + ' Years';
        tenureSelect.appendChild(opt);
      });

      // Update hint
      const hints = {
        home: 'Home loan tenure capped at retirement age (60)',
        personal: 'Personal loans: 2 to 7 years',
        car: 'Car loans: 3 to 7 years'
      };
      document.getElementById('tenure-hint').textContent = hints[type] || '';
    });

    // Also refresh tenure when age is entered
    document.getElementById('age').addEventListener('blur', function() {
      const loanType = document.getElementById('loanType').value;
      if (loanType) {
        document.getElementById('loanType').dispatchEvent(new Event('change'));
      }
    });

    // ── ROI matrix ─────────────────────────────────────────────────
    const roiMatrix = {
      home: {
        '300-600':  null,
        '600-650':  { low: 10.0, high: 10.5 },
        '650-700':  { low: 9.5,  high: 10.0 },
        '700-750':  { low: 9.0,  high: 9.5  },
        '750-800':  { low: 8.5,  high: 9.0  },
        '800-900':  { low: 8.25, high: 8.5  }
      },
      personal: {
        '300-600':  null,
        '600-650':  { low: 20.0, high: 24.0 },
        '650-700':  { low: 18.0, high: 20.0 },
        '700-750':  { low: 14.0, high: 18.0 },
        '750-800':  { low: 12.0, high: 14.0 },
        '800-900':  { low: 12.0, high: 12.0 }
      },
      car: {
        '300-600':  null,
        '600-650':  { low: 13.0, high: 15.0 },
        '650-700':  { low: 11.0, high: 13.0 },
        '700-750':  { low: 9.5,  high: 11.0 },
        '750-800':  { low: 8.75, high: 9.5  },
        '800-900':  { low: 8.5,  high: 8.75 }
      }
    };

    const foirByType = { home: 0.55, personal: 0.45, car: 0.50 };

    // ── EMI formula (reducing balance) ────────────────────────────
    function calcMaxLoan(emiCapacity, annualRate, months) {
      const r = annualRate / 12 / 100;
      if (r === 0) return emiCapacity * months;
      const factor = Math.pow(1 + r, months);
      return emiCapacity * (factor - 1) / (r * factor);
    }

    // ── Format currency ───────────────────────────────────────────
    function formatRs(amount) {
      if (amount >= 10000000) return 'Rs. ' + (amount / 10000000).toFixed(2) + ' Cr';
      if (amount >= 100000)   return 'Rs. ' + (amount / 100000).toFixed(2) + ' L';
      return 'Rs. ' + Math.round(amount).toLocaleString('en-IN');
    }

    // ── Score badge ───────────────────────────────────────────────
    function scoreBadge(range) {
      const map = {
        '300-600':  { cls: 'badge-poor',  label: 'Poor' },
        '600-650':  { cls: 'badge-poor',  label: 'Below Average' },
        '650-700':  { cls: 'badge-fair',  label: 'Fair' },
        '700-750':  { cls: 'badge-good',  label: 'Good' },
        '750-800':  { cls: 'badge-great', label: 'Very Good' },
        '800-900':  { cls: 'badge-great', label: 'Excellent' }
      };
      const m = map[range];
      return `<span class="score-badge ${m.cls}">${range} &nbsp; ${m.label}</span>`;
    }

    // ── Validate inputs ───────────────────────────────────────────
    function validate() {
      let valid = true;

      const salary = parseInt(document.getElementById('salary').value);
      const salaryErr = document.getElementById('salary-error');
      if (!salary || salary < 5000 || salary > 10000000) {
        salaryErr.classList.add('visible');
        document.getElementById('salary').classList.add('error');
        valid = false;
      } else {
        salaryErr.classList.remove('visible');
        document.getElementById('salary').classList.remove('error');
      }

      const obligations = document.getElementById('obligations').value;
      const obligationsVal = obligations === '' ? 0 : parseInt(obligations);
      const obErr = document.getElementById('obligations-error');
      if (isNaN(obligationsVal) || obligationsVal < 0 || obligationsVal >= salary) {
        obErr.classList.add('visible');
        document.getElementById('obligations').classList.add('error');
        valid = false;
      } else {
        obErr.classList.remove('visible');
        document.getElementById('obligations').classList.remove('error');
      }

      const age = parseInt(document.getElementById('age').value);
      const ageErr = document.getElementById('age-error');
      if (!age || age < 21 || age > 58) {
        ageErr.classList.add('visible');
        document.getElementById('age').classList.add('error');
        valid = false;
      } else {
        ageErr.classList.remove('visible');
        document.getElementById('age').classList.remove('error');
      }

      const loanType = document.getElementById('loanType').value;
      const ltErr = document.getElementById('loanType-error');
      if (!loanType) {
        ltErr.classList.add('visible');
        valid = false;
      } else {
        ltErr.classList.remove('visible');
      }

      const tenure = document.getElementById('tenure').value;
      const tErr = document.getElementById('tenure-error');
      if (!tenure) {
        tErr.classList.add('visible');
        valid = false;
      } else {
        tErr.classList.remove('visible');
      }

      const creditScore = document.getElementById('creditScore').value;
      const csErr = document.getElementById('creditScore-error');
      if (!creditScore) {
        csErr.classList.add('visible');
        valid = false;
      } else {
        csErr.classList.remove('visible');
      }

      return valid;
    }

    // ── Main calculation ──────────────────────────────────────────
    function calculateEligibility() {
      if (!validate()) return;

      const salary      = parseInt(document.getElementById('salary').value);
      const obligations = parseInt(document.getElementById('obligations').value) || 0;
      const age         = parseInt(document.getElementById('age').value);
      const loanType    = document.getElementById('loanType').value;
      const tenureYrs   = parseInt(document.getElementById('tenure').value);
      const creditScore = document.getElementById('creditScore').value;

      const foir        = foirByType[loanType];
      const maxEMI      = Math.floor(salary * foir);
      const emiCapacity = maxEMI - obligations;
      const tenureMonths = tenureYrs * 12;

      const loanTypeLabels = { home: 'Home Loan', personal: 'Personal Loan', car: 'Car Loan' };
      const roi = roiMatrix[loanType][creditScore];

      // Populate basic fields
      const resLoanType = document.getElementById('res-loanType');
      resLoanType.textContent = loanTypeLabels[loanType];
      resLoanType.className = 'result-value';

      const resEMI = document.getElementById('res-emiCapacity');
      resEMI.textContent = 'Rs. ' + emiCapacity.toLocaleString('en-IN') + ' / month';
      resEMI.className = 'result-value';

      const resTenure = document.getElementById('res-tenure');
      resTenure.textContent = tenureYrs + (tenureYrs === 1 ? ' Year' : ' Years');
      resTenure.className = 'result-value';

      const resFoir = document.getElementById('res-foir');
      resFoir.textContent = Math.round(foir * 100) + '%';
      resFoir.className = 'result-value';

      const resScore = document.getElementById('res-score');
      resScore.innerHTML = scoreBadge(creditScore);
      resScore.className = 'result-value';

      document.getElementById('resultSubtitle').textContent = loanTypeLabels[loanType] + ' eligibility result';

      // Handle low score / likely rejection
      if (!roi) {
        document.getElementById('res-rate').textContent = 'Not favourable';
        document.getElementById('res-rate').className = 'result-value';
        document.getElementById('res-loanRange').textContent = 'See note below';
        document.getElementById('res-loanRange').className = 'result-value';

        const rejPanel = document.getElementById('rejectionPanel');
        rejPanel.classList.add('visible');
        document.getElementById('rejectionMsg').textContent =
          'A credit score below 600 makes it very difficult to get a loan from scheduled banks. ' +
          'Some NBFCs and small finance banks may consider your application at interest rates of 24 percent or higher. ' +
          'We strongly recommend focusing on improving your credit score first. ' +
          'Paying existing EMIs on time, clearing any credit card dues, and avoiding new loan applications for 6 to 12 months can meaningfully improve your score.';
      } else {
        document.getElementById('rejectionPanel').classList.remove('visible');

        // Calculate loan range
        const loanHigh = calcMaxLoan(emiCapacity, roi.low,  tenureMonths);
        const loanLow  = calcMaxLoan(emiCapacity, roi.high, tenureMonths);

        const resRate = document.getElementById('res-rate');
        if (roi.low === roi.high) {
          resRate.textContent = roi.low.toFixed(2) + '%';
        } else {
          resRate.textContent = roi.low.toFixed(2) + '% to ' + roi.high.toFixed(2) + '%';
        }
        resRate.className = 'result-value highlight';

        const resLoan = document.getElementById('res-loanRange');
        if (Math.abs(loanHigh - loanLow) < 1000) {
          resLoan.textContent = formatRs(loanHigh);
        } else {
          resLoan.textContent = formatRs(loanLow) + ' to ' + formatRs(loanHigh);
        }
        resLoan.className = 'result-value highlight';

        // Build structured note
        const noteEl = document.getElementById('resultNote');
        noteEl.style.display = 'block';

        const maxEmiEl = document.getElementById('note-maxEmi');
        const obligEl  = document.getElementById('note-obligations');
        const availEl  = document.getElementById('note-available');
        const summaryEl = document.getElementById('note-summary');

        const maxEmiAmount = Math.floor(salary * foir);
        maxEmiEl.textContent  = 'Rs. ' + maxEmiAmount.toLocaleString('en-IN') + ' / month';
        obligEl.textContent   = 'Rs. ' + obligations.toLocaleString('en-IN') + ' / month';
        availEl.textContent   = 'Rs. ' + emiCapacity.toLocaleString('en-IN') + ' / month';

        summaryEl.innerHTML =
          'At your credit score, banks typically offer <strong>' +
          (roi.low === roi.high ? roi.low + '%' : roi.low + '% to ' + roi.high + '%') +
          '</strong> on ' + loanTypeLabels[loanType].toLowerCase() + 's. ' +
          'A better score within this band puts you closer to <strong>' + formatRs(loanHigh) + '</strong>.';
      }

      // Animate result panel
      const panel = document.getElementById('resultPanel');
      panel.classList.remove('animate-in');
      void panel.offsetWidth;
      panel.classList.add('animate-in');

      // GA4 event
      if (typeof gtag === 'function') {
        gtag('event', 'advanced_eligibility_check', {
          event_category: 'calculator',
          event_label: loanType + '_' + creditScore
        });
      }
    }
