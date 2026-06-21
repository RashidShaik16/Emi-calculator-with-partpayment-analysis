
    // ── Count-up animation ─────────────────────────────────────────
    function animateCountUp(el, finalText, duration = 1200) {
      // Extract numeric part and prefix/suffix
      const match = finalText.match(/^(Rs\.\s*)?([\d,\.]+)(.*)/);
      if (!match) { el.textContent = finalText; return; }

      const prefix = match[1] || '';
      const rawNum = parseFloat(match[2].replace(/,/g, ''));
      const suffix = match[3] || '';

      if (isNaN(rawNum)) { el.textContent = finalText; return; }

      const startTime = performance.now();
      const startVal = rawNum * 0.3;

      function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOut(progress);
        const current = Math.round(startVal + (rawNum - startVal) * eased);
        el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = finalText; // snap to exact final value
      }
      requestAnimationFrame(tick);
    }

    // ── Verification animation overlay ─────────────────────────────
    function runVerificationAnimation(callback) {
      const panel = document.getElementById('resultPanel');
      const body  = panel.querySelector('.result-body');

      // Build overlay
      const overlay = document.createElement('div');
      overlay.id = 'verifyOverlay';
      overlay.style.cssText = `
        position:absolute; inset:0; background:rgba(255,255,255,0.97);
        display:flex; flex-direction:column; align-items:center;
        justify-content:center; z-index:10; border-radius:0 0 16px 16px;
        gap:16px; padding:32px;
      `;

      const steps = [
        { icon: '📋', text: 'Reading your income details...' },
        { icon: '🔍', text: 'Verifying salary and obligations...' },
        { icon: '📊', text: 'Calculating FOIR and EMI capacity...' },
        { icon: '🏦', text: 'Checking bank rate matrix...' },
        { icon: '📈', text: 'Matching your credit score...' },
        { icon: '✅', text: 'Eligibility confirmed.' },
      ];

      const iconEl = document.createElement('div');
      iconEl.style.cssText = 'font-size:2.5rem; transition:all 0.3s ease;';

      const textEl = document.createElement('div');
      textEl.style.cssText = 'font-size:0.85rem; font-weight:600; color:#374151; text-align:center; min-height:24px; transition:opacity 0.3s;';

      // Progress bar
      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'width:200px; height:4px; background:#e5e7eb; border-radius:999px; overflow:hidden;';
      const bar = document.createElement('div');
      bar.style.cssText = 'height:100%; width:0%; background:linear-gradient(90deg,#3b82f6,#6366f1); border-radius:999px; transition:width 0.4s ease;';
      barWrap.appendChild(bar);

      overlay.appendChild(iconEl);
      overlay.appendChild(textEl);
      overlay.appendChild(barWrap);

      // Make panel relative for overlay positioning
      panel.style.position = 'relative';
      panel.style.overflow = 'hidden';
      body.appendChild(overlay);

      // Auto-scroll result panel to center of viewport
      setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      let step = 0;
      const stepDuration = 750;

      function showStep() {
        if (step >= steps.length) {
          // Done — fade out overlay and run callback
          overlay.style.transition = 'opacity 0.4s ease';
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
            callback();
          }, 400);
          return;
        }
        iconEl.textContent = steps[step].icon;
        textEl.textContent = steps[step].text;
        bar.style.width = ((step + 1) / steps.length * 100) + '%';
        step++;
        setTimeout(showStep, stepDuration);
      }

      showStep();
    }

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
      // Clear hero amount
      const heroEl = document.getElementById('eligibility-hero');
      if (heroEl) heroEl.style.display = 'none';
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

    // ── Minimum salary by loan type, reflecting standard bank-grade lending criteria ──
    const minSalaryByType = { home: 25000, personal: 20000, car: 20000 };
    const loanTypeLabels  = { home: 'Home Loan', personal: 'Personal Loan', car: 'Car Loan' };

    // ── Validate inputs ───────────────────────────────────────────
    function validate() {
      let valid = true;

      const loanType = document.getElementById('loanType').value;
      // Use the loan-type-specific minimum if a type is already selected,
      // otherwise fall back to the lowest threshold across all types so we
      // don't block on salary before the user has even picked a loan type.
      const minSalary = loanType && minSalaryByType[loanType]
        ? minSalaryByType[loanType]
        : Math.min(...Object.values(minSalaryByType));

      const salary = parseInt(document.getElementById('salary').value);
      const salaryErr = document.getElementById('salary-error');
      if (!salary || salary < minSalary || salary > 10000000) {
        salaryErr.textContent = 'Please enter a valid salary (min Rs. ' + minSalary.toLocaleString('en-IN') + (loanType ? ' for ' + loanTypeLabels[loanType] : '') + ')';
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

      // Basic sanity: obligations cannot be negative or exceed total salary
      let obligationsInvalid = isNaN(obligationsVal) || obligationsVal < 0 || (salary && obligationsVal >= salary);

      // Deeper check: even if obligations are technically less than salary,
      // they can still consume the entire FOIR-based EMI capacity for this
      // loan type, leaving zero or negative room for a new loan. Only run
      // this check once a loan type is selected, since FOIR is type-specific.
      if (!obligationsInvalid && salary && loanType && foirByType[loanType]) {
        const maxEmiForType = Math.floor(salary * foirByType[loanType]);
        if (maxEmiForType - obligationsVal <= 0) {
          obligationsInvalid = true;
          obErr.textContent = 'Your existing EMIs already use up your full ' + Math.round(foirByType[loanType] * 100) + '% FOIR limit for a ' + loanTypeLabels[loanType].toLowerCase() + '. There is no room left for a new EMI.';
        }
      }

      if (obligationsInvalid) {
        if (obErr.textContent === 'Cannot be more than your salary' || !obErr.textContent) {
          obErr.textContent = 'Cannot be more than your salary';
        }
        obErr.classList.add('visible');
        document.getElementById('obligations').classList.add('error');
        valid = false;
      } else {
        obErr.textContent = 'Cannot be more than your salary'; // reset to default for next validation pass
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

      // GA4 — fire immediately after validation passes
      if (typeof gtag === 'function') {
        gtag('event', 'eligibility_checked', {
          loan_type:    loanType,
          loan_tenure:  tenureYrs + ' years',
          credit_score: creditScore,
          salary:       salary
        });
      }

      const foir        = foirByType[loanType];
      const maxEMI      = Math.floor(salary * foir);
      const emiCapacity = maxEMI - obligations;
      const tenureMonths = tenureYrs * 12;

      const roi = roiMatrix[loanType][creditScore];

      // ── Safety net: even though validate() already checks this, never let
      // a zero or negative EMI capacity flow into the loan amount formula.
      // This guards against any future change to validate() accidentally
      // letting an invalid combination through.
      if (emiCapacity <= 0) {
        document.getElementById('resultSubtitle').textContent = loanTypeLabels[loanType] + ' eligibility result';
        const resLoanType = document.getElementById('res-loanType');
        resLoanType.textContent = loanTypeLabels[loanType];
        resLoanType.className = 'result-value';

        document.getElementById('res-emiCapacity').textContent = 'Rs. 0 / month';
        document.getElementById('res-emiCapacity').className = 'result-value';
        document.getElementById('res-rate').textContent = '—';
        document.getElementById('res-rate').className = 'result-value';
        document.getElementById('res-loanRange').textContent = 'Not eligible';
        document.getElementById('res-loanRange').className = 'result-value';
        document.getElementById('res-tenure').textContent = tenureYrs + (tenureYrs === 1 ? ' Year' : ' Years');
        document.getElementById('res-tenure').className = 'result-value';
        document.getElementById('res-foir').textContent = Math.round(foir * 100) + '%';
        document.getElementById('res-foir').className = 'result-value';
        document.getElementById('res-score').innerHTML = scoreBadge(creditScore);
        document.getElementById('res-score').className = 'result-value';

        const rejPanel = document.getElementById('rejectionPanel');
        rejPanel.classList.add('visible');
        document.getElementById('rejectionMsg').textContent =
          'Based on your salary of Rs. ' + salary.toLocaleString('en-IN') + ' and existing obligations of Rs. ' +
          obligations.toLocaleString('en-IN') + ' per month, you have no remaining EMI capacity under the ' +
          Math.round(foir * 100) + '% FOIR limit for a ' + loanTypeLabels[loanType].toLowerCase() + '. ' +
          'Banks are very unlikely to approve a new loan in this situation. ' +
          'Reducing or clearing existing EMIs first would meaningfully improve your eligibility.';

        document.getElementById('resultNote').style.display = 'none';
        const heroEl = document.getElementById('eligibility-hero');
        if (heroEl) heroEl.style.display = 'none';

        const panel = document.getElementById('resultPanel');
        panel.classList.remove('animate-in');
        void panel.offsetWidth;
        panel.classList.add('animate-in');
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

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

      // ── Run verification animation then reveal results ────────────
      // Collect all final values before animating
      const finalLoanRange  = document.getElementById('res-loanRange').textContent;
      const finalEmiCap     = document.getElementById('res-emiCapacity').textContent;
      const finalRate       = document.getElementById('res-rate').textContent;

      // Reset to dashes while animation plays
      ['res-loanRange','res-emiCapacity','res-rate','res-tenure','res-foir','res-loanType','res-score'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.innerHTML.includes('badge')) el.textContent = '--';
      });
      document.getElementById('resultNote').style.display = 'none';
      document.getElementById('rejectionPanel').classList.remove('visible');

      const panel = document.getElementById('resultPanel');
      panel.classList.remove('animate-in');
      void panel.offsetWidth;
      panel.classList.add('animate-in');

      runVerificationAnimation(() => {
        // ── Hero loan amount ──────────────────────────────────────
        let heroEl = document.getElementById('eligibility-hero');
        if (!heroEl) {
          heroEl = document.createElement('div');
          heroEl.id = 'eligibility-hero';
          heroEl.style.cssText = `
            text-align:center; padding:24px 16px 20px;
            border-bottom:1px solid #e5e7eb; margin-bottom:4px;
          `;
          const resultBody = document.querySelector('#resultPanel .result-body');
          resultBody.insertBefore(heroEl, resultBody.firstChild);
        }

        if (roi) {
          const loanHigh = calcMaxLoan(emiCapacity, roi.low, tenureYrs * 12);
          let heroAmountStr;
          if (loanHigh >= 10000000) heroAmountStr = (loanHigh / 10000000).toFixed(2) + ' Cr';
          else if (loanHigh >= 100000) heroAmountStr = (loanHigh / 100000).toFixed(2) + ' Lakhs';
          else heroAmountStr = Math.round(loanHigh).toLocaleString('en-IN');

          heroEl.innerHTML = `
            <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">You May Be Eligible For Up To</p>
            <p id="hero-amount" style="font-size:2.6rem;font-weight:800;color:#1e40af;line-height:1;font-family:'Lora',serif;">&#8377;0</p>
            <p style="font-size:0.72rem;color:#9ca3af;margin-top:6px;">${loanTypeLabels[loanType]} &nbsp;·&nbsp; ${tenureYrs} yr tenure &nbsp;·&nbsp; Based on best rate offered</p>
          `;
          heroEl.style.display = 'block';

          // Count up the hero number
          const heroAmountEl = document.getElementById('hero-amount');
          const startTime = performance.now();
          const duration = 2200;
          function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
          function tickHero(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = easeOut(progress);
            const current = Math.round(loanHigh * 0.2 + (loanHigh - loanHigh * 0.2) * eased);
            let display;
            if (current >= 10000000) display = (current / 10000000).toFixed(2) + ' Cr';
            else if (current >= 100000) display = (current / 100000).toFixed(2) + ' L';
            else display = current.toLocaleString('en-IN');
            heroAmountEl.textContent = '₹' + display;
            if (progress < 1) requestAnimationFrame(tickHero);
            else heroAmountEl.textContent = '₹' + heroAmountStr;
          }
          requestAnimationFrame(tickHero);
        } else {
          heroEl.innerHTML = `
            <p style="font-size:0.75rem;font-weight:700;color:#b91c1c;text-align:center;padding:8px 0;">Loan approval unlikely at this credit score</p>
          `;
          heroEl.style.display = 'block';
        }

        // Restore all values
        document.getElementById('res-loanType').textContent  = loanTypeLabels[loanType];
        document.getElementById('res-loanType').className    = 'result-value';
        document.getElementById('res-tenure').textContent    = tenureYrs + (tenureYrs === 1 ? ' Year' : ' Years');
        document.getElementById('res-tenure').className      = 'result-value';
        document.getElementById('res-foir').textContent      = Math.round(foir * 100) + '%';
        document.getElementById('res-foir').className        = 'result-value';
        document.getElementById('res-score').innerHTML       = scoreBadge(creditScore);
        document.getElementById('res-score').className       = 'result-value';

        if (!roi) {
          document.getElementById('res-rate').textContent     = 'Not favourable';
          document.getElementById('res-rate').className       = 'result-value';
          document.getElementById('res-loanRange').textContent = 'See note below';
          document.getElementById('res-loanRange').className  = 'result-value';
          document.getElementById('rejectionPanel').classList.add('visible');
        } else {
          // Count-up for key numbers
          const elRate  = document.getElementById('res-rate');
          const elLoan  = document.getElementById('res-loanRange');
          const elEmi   = document.getElementById('res-emiCapacity');
          elRate.className  = 'result-value highlight';
          elLoan.className  = 'result-value highlight';
          elEmi.className   = 'result-value';

          // Rate just set directly (not a single number)
          elRate.textContent = finalRate;

          // EMI capacity count-up
          animateCountUp(elEmi, finalEmiCap, 1400);

          // Loan range — animate the first number if range, else animate single
          if (finalLoanRange.includes(' to ')) {
            const parts = finalLoanRange.split(' to ');
            setTimeout(() => {
              elLoan.textContent = finalLoanRange; // set immediately, range is complex
            }, 200);
          } else {
            animateCountUp(elLoan, finalLoanRange, 2000);
          }

          document.getElementById('resultNote').style.display = 'block';
          document.getElementById('note-maxEmi').textContent  = 'Rs. ' + Math.floor(salary * foir).toLocaleString('en-IN') + ' / month';
          document.getElementById('note-obligations').textContent = 'Rs. ' + obligations.toLocaleString('en-IN') + ' / month';
          document.getElementById('note-available').textContent   = 'Rs. ' + emiCapacity.toLocaleString('en-IN') + ' / month';
          document.getElementById('note-summary').innerHTML = summaryEl ? summaryEl.innerHTML :
            'At your credit score, banks typically offer <strong>' +
            (roi.low === roi.high ? roi.low + '%' : roi.low + '% to ' + roi.high + '%') +
            '</strong> on ' + loanTypeLabels[loanType].toLowerCase() + 's.';
        }

      });
    }
