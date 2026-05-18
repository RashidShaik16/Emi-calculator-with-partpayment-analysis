// ── Count-up animation helper ─────────────────────────────────────────────
function ccCountUp(el, finalNum, prefix, suffix, duration) {
  const startVal = finalNum * 0.1;
  const startTime = performance.now();
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.round(startVal + (finalNum - startVal) * easeOut(progress));
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + Math.round(finalNum).toLocaleString('en-IN') + suffix;
  }
  requestAnimationFrame(tick);
}

// ── STATE ────────────────────────────────────────────────────────────────────
let scheduleData         = [];
let overrides            = {};   // { i: { type:'pay'|'min'|'skip', amount:number } }
let purchases            = {};   // { i: amount }
let globalType           = 'pay';
let pendingPurchaseMonth = null;
let chartInstance        = null;

// ── UTILS ────────────────────────────────────────────────────────────────────
const inr     = n => '&#8377;' + Math.round(n).toLocaleString('en-IN');
const inrText = n => '₹' + Math.round(n).toLocaleString('en-IN');

function lateFeeGST(balance) {
  let fee = 0;
  if      (balance <   100) fee = 0;
  else if (balance <=  500) fee = 100;
  else if (balance <= 5000) fee = 500;
  else if (balance <= 10000) fee = 600;
  else if (balance <= 25000) fee = 800;
  else if (balance <= 50000) fee = 1100;
  else                       fee = 1300;
  return Math.round(fee * 1.18);
}

function minDue(balance) { return Math.max(200, Math.round(balance * 0.05)); }

// ── SLIDERS ──────────────────────────────────────────────────────────────────
function bindSlider(rangeId, numId, dispId, fmt) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numId);
  const d = dispId ? document.getElementById(dispId) : null;
  const update = v => { if (d) d.innerHTML = fmt(v); recompute(); };
  r.addEventListener('input', () => { n.value = r.value; update(parseFloat(r.value)); });
  n.addEventListener('change', () => { r.value = n.value; update(parseFloat(n.value)); });
}

// ── GLOBAL TYPE ───────────────────────────────────────────────────────────────
// Only 'pay' and 'min' are available globally. 'skip' is row-only.
const hintText = {
  pay: 'Every month pays your set amount (₹ entered above). Change individual months in the schedule.',
  min: 'Every month pays minimum due only (5% of balance or ₹200). Payoff takes much longer — try it to see why.',
};

function setGlobalType(type, btn) {
  globalType = type;
  document.querySelectorAll('#global-seg .seg-btn').forEach(b => b.className = 'seg-btn');
  btn.className = 'seg-btn seg-active-' + type;
  document.getElementById('global-hint').innerHTML = hintText[type];
  overrides = {};   // clear per-row overrides when global default changes
  recompute();
}

// ── INPUT VALIDATION ─────────────────────────────────────────────────────────
function showInputError(fieldId, msg) {
  // Remove any existing error for this field
  clearInputError(fieldId);
  const field = document.getElementById(fieldId);
  if (!field) return;
  const err = document.createElement('p');
  err.className = 'input-error-msg';
  err.id = 'err-' + fieldId;
  err.style.cssText = 'color:#dc2626;font-size:0.72rem;font-weight:600;margin-top:4px;';
  err.textContent = msg;
  field.parentNode.parentNode.appendChild(err);
  field.style.borderColor = '#dc2626';
}

function clearInputError(fieldId) {
  const existing = document.getElementById('err-' + fieldId);
  if (existing) existing.remove();
  const field = document.getElementById(fieldId);
  if (field) field.style.borderColor = '';
}

function showScheduleWarning(msg) {
  let warn = document.getElementById('schedule-warning');
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'schedule-warning';
    warn.style.cssText = 'margin:0 24px 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;font-size:0.8rem;color:#92400e;font-weight:500;display:flex;align-items:center;gap:8px;';
    warn.innerHTML = '<span style="font-size:1rem;">&#9888;</span> <span id="schedule-warning-text"></span>';
    const tableWrap = document.getElementById('schedule-table-wrap');
    if (tableWrap) tableWrap.parentNode.insertBefore(warn, tableWrap);
  }
  document.getElementById('schedule-warning-text').textContent = msg;
  warn.style.display = 'flex';
}

function clearScheduleWarning() {
  const warn = document.getElementById('schedule-warning');
  if (warn) warn.style.display = 'none';
}

// ── COMPUTE ───────────────────────────────────────────────────────────────────
function computeSchedule() {
  const balance = parseFloat(document.getElementById('inp-balance-num').value) || 0;
  const payment = parseFloat(document.getElementById('inp-payment-num').value) || 0;
  const rate    = parseFloat(document.getElementById('inp-rate').value)         || 3.75;

  scheduleData = [];
  clearScheduleWarning();

  // ── EDGE CASE: Zero or missing balance ───────────────────────────────────
  if (balance <= 0) {
    showInputError('inp-balance-num', 'Please enter a valid outstanding balance.');
    return;
  } else {
    clearInputError('inp-balance-num');
  }

  // ── EDGE CASE: Payment >= balance (pointless calculation) ────────────────
  // Only applies when global type is 'pay' — min/skip don't use this payment
  if (globalType === 'pay' && payment >= balance) {
    showInputError('inp-payment-num', 'Monthly payment equals or exceeds your balance. Your card will be cleared in month 1 — no schedule needed.');
    return;
  } else {
    clearInputError('inp-payment-num');
  }

  // ── EDGE CASE: Zero payment with 'pay' type = infinite loop risk ─────────
  if (globalType === 'pay' && payment <= 0) {
    showInputError('inp-payment-num', 'Please enter a monthly payment amount greater than ₹0.');
    return;
  }

  let bal = balance;
  const MAX_MONTHS = 600;
  let hitCap = false;

  for (let i = 0; i < MAX_MONTHS && bal > 0; i++) {
    const ov       = overrides[i];
    const type     = ov ? ov.type : globalType;
    const purchase = purchases[i] || 0;
    const opening  = bal;
    const interest = opening * (rate / 100);
    let lateFee = 0, paid = 0;

    if (type === 'skip') {
      paid    = 0;
      lateFee = lateFeeGST(opening);
    } else if (type === 'min') {
      paid = Math.min(minDue(opening), opening + interest);
    } else {
      // 'pay' — use override amount if set, else global default payment
      const amt = ov ? ov.amount : payment;
      // ── EDGE CASE: Row override amount = 0 with type 'pay' ──────────────
      // Treat as skip — balance grows, late fee applies
      if (amt <= 0) {
        paid    = 0;
        lateFee = lateFeeGST(opening);
      } else {
        paid = Math.min(amt, opening + interest);
      }
    }

    const toPrincipal = Math.max(0, paid - interest);
    let closing = opening + interest + lateFee - paid + purchase;
    if (closing < 0.5) closing = 0;

    scheduleData.push({
      month: i + 1,
      opening,
      interest,
      purchase,
      lateFee,
      payment: paid,
      toPrincipal,
      closing,
      type,
      amount: ov ? ov.amount : payment
    });

    bal = closing;

    // Check if we're near the cap
    if (i === MAX_MONTHS - 1 && bal > 0) hitCap = true;
  }

  // ── EDGE CASE: Payment barely covers interest (schedule never ends) ───────
  if (hitCap) {
    showScheduleWarning('At this payment amount, the balance takes over 50 years to clear. Try increasing your monthly payment — even a small increase makes a big difference.');
  }

  // ── EDGE CASE: Payment barely above interest — show a nudge ──────────────
  if (!hitCap && scheduleData.length > 0 && globalType === 'pay') {
    const firstInterest = scheduleData[0].interest;
    if (payment > 0 && payment < firstInterest * 1.1 && payment < balance) {
      showScheduleWarning('Your payment is barely above the monthly interest of ' + inrText(firstInterest) + '. Very little goes to principal each month — consider paying more to clear this faster.');
    }
  }
}

// ── RENDER SUMMARY ────────────────────────────────────────────────────────────
function renderSummary() {
  const balance   = parseFloat(document.getElementById('inp-balance-num').value) || 0;
  const rate      = parseFloat(document.getElementById('inp-rate').value);
  const months    = scheduleData.length;
  const totalInt  = scheduleData.reduce((s, r) => s + r.interest, 0);
  const totalFee  = scheduleData.reduce((s, r) => s + r.lateFee,  0);
  const totalPaid = scheduleData.reduce((s, r) => s + r.payment,  0);

  // Static fields — no count-up needed
  document.getElementById('s-balance').innerHTML  = inr(balance);
  document.getElementById('s-rate').textContent   = rate.toFixed(2) + '% / mo  (' + (rate * 12).toFixed(1) + '% p.a.)';

  // Months — count up the number part
  const monthsEl = document.getElementById('s-months');
  const monthSuffix = months >= 12 ? ' months  (' + Math.floor(months / 12) + ' yr ' + (months % 12) + ' mo)' : ' months';
  ccCountUp(monthsEl, months, '', monthSuffix, 900);

  // Money fields — count up
  const intEl   = document.getElementById('s-interest');
  const feeEl   = document.getElementById('s-fees');
  const totEl   = document.getElementById('s-total');
  const extEl   = document.getElementById('s-extra');

  // Set final values immediately for reference, then animate
  setTimeout(() => ccCountUp(intEl, totalInt,             'Rs.', '', 1100), 80);
  setTimeout(() => ccCountUp(feeEl, totalFee,             'Rs.', '', 900),  160);
  setTimeout(() => ccCountUp(totEl, totalPaid,            'Rs.', '', 1300), 240);
  setTimeout(() => ccCountUp(extEl, totalInt + totalFee,  'Rs.', '', 1200), 320);
}

// ── SCROLL-TRIGGERED CHART ────────────────────────────────────────────────────
let chartObserver = null;
function observeChart() {
  const canvas = document.getElementById('balanceChart');
  if (!canvas) return;
  if (chartObserver) chartObserver.disconnect();

  // Destroy existing chart and clear — wait for scroll to re-render
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  // Check if canvas is already visible — if so defer until user scrolls away and back
  const rect = canvas.getBoundingClientRect();
  const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;

  if (alreadyVisible) {
    // Temporarily mark as pending, animate when scrolled out and back in
    canvas.dataset.chartPending = 'true';
  }

  chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && canvas.dataset.chartPending !== 'skip') {
        canvas.dataset.chartPending = 'skip';
        renderChart();
        chartObserver.disconnect();
      }
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -50px 0px' });

  if (alreadyVisible) {
    // Scroll listener: fire once canvas leaves and re-enters view
    canvas.dataset.chartPending = 'true';
    const scrollHandler = () => {
      const r = canvas.getBoundingClientRect();
      const nowVisible = r.top < window.innerHeight && r.bottom > 0;
      if (!nowVisible) {
        // Left viewport — now observe for re-entry
        window.removeEventListener('scroll', scrollHandler);
        canvas.dataset.chartPending = 'true';
        chartObserver.observe(canvas);
      }
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });
  } else {
    chartObserver.observe(canvas);
  }
}

// ── RENDER CHART ──────────────────────────────────────────────────────────────
function renderChart() {
  if (chartInstance) chartInstance.destroy();
  const ctx  = document.getElementById('balanceChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, 'rgba(239,68,68,0.18)');
  grad.addColorStop(1, 'rgba(239,68,68,0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: scheduleData.map(r => 'M' + r.month),
      datasets: [
        {
          label: 'Balance',
          data: scheduleData.map(r => Math.round(r.closing)),
          borderColor: '#ef4444',
          backgroundColor: grad,
          borderWidth: 2,
          pointRadius: scheduleData.length > 48 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: true
        },
        {
          label: 'After Purchase',
          data: scheduleData.map(r => r.purchase > 0 ? Math.round(r.opening + r.interest + r.purchase) : null),
          borderWidth: 0,
          pointRadius: 7,
          pointHoverRadius: 9,
          pointBackgroundColor: '#818cf8',
          pointStyle: 'triangle',
          showLine: false
        }
      ]
    },
    options: {
      animation: {
        duration: 1400,
        easing: 'easeOutQuart',
        x: { from: 0 },
      },
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e3a8a',
          titleColor: '#fff',
          bodyColor: '#bfdbfe',
          callbacks: {
            label: c => {
              if (c.datasetIndex === 0) return ' Balance: ₹' + c.parsed.y.toLocaleString('en-IN');
              return c.parsed.y !== null ? ' New purchase this month' : null;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f3f4f6' },
          ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 14 }
        },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: {
            color: '#9ca3af',
            font: { size: 10 },
            callback: v =>
              v >= 100000 ? '₹' + (v / 100000).toFixed(1) + 'L'
              : v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K'
              : '₹' + v
          }
        }
      }
    }
  });
}

// ── RENDER TABLE ──────────────────────────────────────────────────────────────
function renderTable() {
  const balance0 = parseFloat(document.getElementById('inp-balance-num').value) || 1;
  const defAmt   = parseFloat(document.getElementById('inp-payment-num').value) || 0;
  const tbody    = document.getElementById('schedule-body');
  tbody.innerHTML = '';

  scheduleData.forEach((row, i) => {
    const tr = document.createElement('tr');
    let rowClass = 'hover:bg-gray-50 transition-colors ';
    if      (row.type === 'skip') rowClass += 'row-skip';
    else if (row.type === 'min')  rowClass += 'row-min';
    if (row.purchase > 0)         rowClass += ' row-purchase';
    tr.className = rowClass;

    // Month
    const tdM = document.createElement('td');
    tdM.className = 'px-4 py-2.5 whitespace-nowrap';
    tdM.innerHTML = `<span class="font-semibold text-gray-700">M${row.month}</span>`;

    // Opening balance
    const tdO = makeTd(inr(row.opening), 'text-right text-gray-700');

    // Interest
    const tdI = makeTd(inr(row.interest), 'text-right text-red-500 font-medium');

    // Purchase
    const tdP = document.createElement('td');
    tdP.className = 'px-4 py-2.5 text-right whitespace-nowrap';
    tdP.innerHTML = row.purchase > 0
      ? `<span class="chip-purchase" title="Click to remove" onclick="removePurchase(${i})">+${inrText(row.purchase)} &#215;</span>`
      : `<span class="text-gray-300 text-xs">--</span>`;

    // Late fee
    const tdF = document.createElement('td');
    tdF.className = 'px-4 py-2.5 text-right whitespace-nowrap';
    tdF.innerHTML = row.lateFee > 0
      ? `<span class="chip-late">${inrText(row.lateFee)}</span>`
      : `<span class="text-gray-300 text-xs">--</span>`;

    // Payment made
    const tdPay = document.createElement('td');
    tdPay.className = 'px-4 py-2.5 text-right whitespace-nowrap';
    tdPay.innerHTML = row.type === 'skip'
      ? `<span class="font-semibold text-red-500">&#8377;0</span>`
      : `<span class="font-medium text-green-600">${inrText(row.payment)}</span>`;

    // To principal
    const tdPrin = makeTd(
      inr(row.toPrincipal),
      'text-right ' + (row.toPrincipal > 0 ? 'text-green-600' : 'text-red-400')
    );

    // Closing balance with color coding
    const tdC = document.createElement('td');
    tdC.className = 'px-4 py-2.5 text-right whitespace-nowrap';
    const pct = row.closing / balance0;
    const bc  = row.closing <= 0 ? 'bal-zero' : pct > 0.6 ? 'bal-high' : pct > 0.3 ? 'bal-mid' : 'bal-low';
    tdC.innerHTML = `<span class="${bc}">${row.closing <= 0 ? '&#8377;0 &#10003;' : inrText(row.closing)}</span>`;

    // Controls: Pay / Min / Skip pills + amount input + Purchase button
    const tdCtrl = document.createElement('td');
    tdCtrl.className = 'col-sticky px-3 py-2 text-center whitespace-nowrap';
    const pp  = row.type === 'pay'  ? 'pp-pay'  : '';
    const pm  = row.type === 'min'  ? 'pp-min'  : '';
    const ps  = row.type === 'skip' ? 'pp-skip' : '';
    const dis = row.type !== 'pay'  ? 'disabled' : '';
    const amt = Math.round(row.amount || defAmt);

    // Purchase button always rendered to lock column width — just invisible when purchase exists
    const purchaseBtnCls = row.purchase > 0 ? 'btn-add-purchase' : 'btn-add-purchase';
    const purchaseBtnStyle = row.purchase > 0 ? 'style="opacity:0;pointer-events:none;"' : '';

    tdCtrl.innerHTML = `
      <div class="flex items-center gap-1 justify-center" style="flex-wrap:nowrap;">
        <button class="pay-pill ${pp}" onclick="setRowType(${i},'pay',this)">Pay</button>
        <button class="pay-pill ${pm}" onclick="setRowType(${i},'min',this)">Min</button>
        <button class="pay-pill ${ps}" onclick="setRowType(${i},'skip',this)">Skip</button>
        <input class="pay-override" id="ro-${i}" type="number" value="${amt}" min="0" ${dis}
          onchange="setRowAmount(${i},this.value)" />
        <button class="btn-add-purchase" ${purchaseBtnStyle} onclick="openPurchaseModal(${i})">+ Purchase</button>
      </div>`;

    [tdM, tdO, tdI, tdP, tdF, tdPay, tdPrin, tdC, tdCtrl].forEach(c => tr.appendChild(c));
    tbody.appendChild(tr);
  });
}

function makeTd(html, cls) {
  const el = document.createElement('td');
  el.className = 'px-4 py-2.5 whitespace-nowrap ' + cls;
  el.innerHTML = html;
  return el;
}

// ── ROW CONTROLS ──────────────────────────────────────────────────────────────
function setRowType(i, type, btn) {
  const defAmt = parseFloat(document.getElementById('inp-payment-num').value) || 0;
  overrides[i] = { type, amount: overrides[i] ? overrides[i].amount : defAmt };
  recompute();
}

function setRowAmount(i, val) {
  let amt = parseFloat(val);

  // ── EDGE CASE: Negative value — clamp to 0 ───────────────────────────────
  if (isNaN(amt) || amt < 0) amt = 0;

  // ── EDGE CASE: type is 'pay' but amount is 0 — warn user ─────────────────
  if (amt === 0) {
    const currentType = overrides[i] ? overrides[i].type : globalType;
    if (currentType === 'pay') {
      // Force the input back to 1 minimum and show inline hint
      const inputEl = document.getElementById('ro-' + i) || document.getElementById('cro-' + i);
      if (inputEl) {
        inputEl.value = 1;
        inputEl.style.borderColor = '#f59e0b';
        inputEl.title = 'Use the Skip button to miss a payment. Pay amount must be at least ₹1.';
        setTimeout(() => { inputEl.style.borderColor = ''; inputEl.title = ''; }, 2500);
      }
      amt = 1;
    }
  }

  overrides[i] = overrides[i] ? { ...overrides[i], amount: amt } : { type: 'pay', amount: amt };
  recompute();
}

// ── PURCHASE MODAL ────────────────────────────────────────────────────────────
function openPurchaseModal(i) {
  pendingPurchaseMonth = i;
  document.getElementById('modal-month-label').textContent = 'Month ' + (i + 1);
  document.getElementById('modal-amount').value = '';
  const modal = document.getElementById('purchase-modal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('modal-amount').focus(), 50);
}

function closePurchaseModal() {
  const modal = document.getElementById('purchase-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
  pendingPurchaseMonth = null;
  // Reset modal input state
  document.getElementById('modal-amount').style.borderColor = '';
  document.getElementById('modal-amount').value = '';
  const errMsg = document.getElementById('modal-err');
  if (errMsg) errMsg.remove();
}

function confirmPurchase() {
  const raw = document.getElementById('modal-amount').value;
  const amt = parseFloat(raw);

  // ── EDGE CASE: Non-numeric, zero, or negative ────────────────────────────
  if (isNaN(amt) || amt <= 0) {
    const input = document.getElementById('modal-amount');
    input.style.borderColor = '#dc2626';
    let errMsg = document.getElementById('modal-err');
    if (!errMsg) {
      errMsg = document.createElement('p');
      errMsg.id = 'modal-err';
      errMsg.style.cssText = 'color:#dc2626;font-size:0.72rem;font-weight:600;margin-top:6px;';
      input.parentNode.after(errMsg);
    }
    errMsg.textContent = 'Please enter a valid purchase amount greater than ₹0.';
    input.focus();
    return;
  }

  // Clear any error state
  document.getElementById('modal-amount').style.borderColor = '';
  const errMsg = document.getElementById('modal-err');
  if (errMsg) errMsg.remove();

  purchases[pendingPurchaseMonth] = amt;
  closePurchaseModal();
  recompute();
  if (typeof gtag !== 'undefined') gtag('event', 'cc_purchase_added', { month: pendingPurchaseMonth + 1, amount: amt });
}

function removePurchase(i) {
  delete purchases[i];
  recompute();
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function downloadPDF() {
  if (!scheduleData || scheduleData.length === 0) {
    alert('No schedule data available to generate PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const fmt = n => 'Rs.' + Math.round(n).toLocaleString('en-IN');
  // Portrait + pt units — mirrors pdfGenerator.js to avoid jsPDF.f3 errors
  const doc = new jsPDF('p', 'pt', 'a4');

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const balance   = parseFloat(document.getElementById('inp-balance-num').value) || 0;
  const rate      = parseFloat(document.getElementById('inp-rate').value)         || 3.75;
  const months    = scheduleData.length;
  const totalInt  = scheduleData.reduce((s, r) => s + r.interest, 0);
  const totalFee  = scheduleData.reduce((s, r) => s + r.lateFee,  0);
  const totalPaid = scheduleData.reduce((s, r) => s + r.payment,  0);

  // ── HEADER BAR ─────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Logo replaced with text to avoid jsPDF.f3 error
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('KnowYourEMI.in', 25, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Credit Card Payoff Schedule', pageWidth / 2, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Generated by KnowYourEMI.in', pageWidth / 2, 48, { align: 'center' });

  // ── SUMMARY BOX ────────────────────────────────────────────────────────
  let startY = 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 64, 175);
  doc.text('Payoff Summary', 40, startY);
  startY += 15;

  doc.setDrawColor(140, 170, 220);
  doc.setFillColor(220, 235, 255);
  doc.roundedRect(40, startY, pageWidth - 80, 150, 6, 6, 'FD');
  startY += 25;

  const summaryRows = [
    ['Outstanding Balance',         fmt(balance)],
    ['Monthly Interest Rate',       rate.toFixed(2) + '%  (' + (rate * 12).toFixed(1) + '% p.a.)'],
    ['Months to Pay Off',           months + ' months' + (months >= 12 ? '  (' + Math.floor(months / 12) + ' yr ' + (months % 12) + ' mo)' : '')],
    ['Total Interest Paid',         fmt(totalInt)],
    ['Late Fees (incl. 18% GST)',   fmt(totalFee)],
    ['Total Amount Paid',           fmt(totalPaid)],
    ['Extra Paid (beyond balance)', fmt(totalInt + totalFee)]
  ];

  const labelX = 60;
  const valueX = pageWidth - 60;
  doc.setFontSize(10);
  summaryRows.forEach(function([label, value]) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(label, labelX, startY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(value, valueX, startY, { align: 'right' });
    startY += 19;
  });

  startY += 25;

  // ── SCHEDULE HEADING ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 64, 175);
  doc.text('Month-by-Month Schedule', pageWidth / 2, startY, { align: 'center' });
  startY += 15;

  // ── AUTOTABLE ──────────────────────────────────────────────────────────
  doc.autoTable({
    startY: startY,
    head: [['Month', 'Opening', 'Interest', 'Purchase', 'Late Fee', 'Payment', 'To Principal', 'Closing', 'Type']],
    body: scheduleData.map(function(r) { return [
      'M' + r.month,
      fmt(r.opening),
      fmt(r.interest),
      r.purchase > 0 ? fmt(r.purchase) : '--',
      r.lateFee   > 0 ? fmt(r.lateFee)  : '--',
      r.type === 'skip' ? 'SKIPPED' : fmt(r.payment),
      fmt(r.toPrincipal),
      r.closing <= 0 ? 'PAID OFF' : fmt(r.closing),
      r.type === 'pay' ? 'Set Amt' : r.type === 'min' ? 'Min Due' : 'Defaulted'
    ]; }),
    theme: 'grid',
    headStyles:        { fillColor: [30, 64, 175], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles:        { fontSize: 7, textColor: [55, 65, 81] },
    alternateRowStyles:{ fillColor: [249, 250, 251] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 35 },
      1: { halign: 'right' }, 2: { halign: 'right' },
      3: { halign: 'right' }, 4: { halign: 'right' },
      5: { halign: 'right' }, 6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 45 }
    },
    margin: { left: 40, right: 40 },
    didParseCell: function(data) {
      if (data.section !== 'body') return;
      var r = scheduleData[data.row.index];
      if (!r) return;
      if (r.type === 'skip') {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fillColor = [254, 242, 242];
      } else if (r.type === 'min') {
        data.cell.styles.fillColor = [255, 253, 235];
      }
      if (data.column.index === 7 && r.closing <= 0) {
        data.cell.styles.textColor = [22, 163, 74];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // ── FOOTER on every page ───────────────────────────────────────────────
  var pageCount = doc.internal.getNumberOfPages();
  for (var i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Late fees: standard Indian bank slabs + 18% GST. Monthly compounding. Actual charges vary by bank.',
      40, pageHeight - 18
    );
    doc.text(
      'Page ' + i + ' of ' + pageCount,
      pageWidth - 40, pageHeight - 18, { align: 'right' }
    );
  }

  doc.save('credit-card-payoff-KnowYourEMI.pdf');
  if (typeof gtag !== 'undefined') gtag('event', 'cc_pdf_download');
}

// ── MOBILE CARD RENDER ───────────────────────────────────────────────────────
function renderCards() {
  const container = document.getElementById('schedule-cards');
  if (!container) return;
  const balance0 = parseFloat(document.getElementById('inp-balance-num').value) || 1;
  const defAmt   = parseFloat(document.getElementById('inp-payment-num').value) || 0;
  container.innerHTML = '';

  scheduleData.forEach((row, i) => {
    const div = document.createElement('div');
    let cardClass = 'month-card';
    if (row.type === 'skip')     cardClass += ' card-skip';
    else if (row.type === 'min') cardClass += ' card-min';
    if (row.purchase > 0)        cardClass += ' card-purchase';
    div.className = cardClass;
    div.id = 'card-row-' + i;

    // Closing balance color
    const pct = row.closing / balance0;
    const closingText  = row.closing <= 0 ? '&#8377;0 &#10003;' : inrText(row.closing);
    const closingColor = row.closing <= 0 ? '#16a34a'
      : pct > 0.6 ? '#dc2626'
      : pct > 0.3 ? '#d97706'
      : '#16a34a';

    // Payment display
    const payColor  = row.type === 'skip' ? '#ef4444' : '#16a34a';
    const payText   = row.type === 'skip' ? '&#8377;0 (skipped)' : inrText(row.payment);

    // Controls
    const pp  = row.type === 'pay'  ? 'pp-pay'  : '';
    const pm  = row.type === 'min'  ? 'pp-min'  : '';
    const ps  = row.type === 'skip' ? 'pp-skip' : '';
    const dis = row.type !== 'pay'  ? 'disabled' : '';
    const amt = Math.round(row.amount || defAmt);
    const purchaseHide = row.purchase > 0 ? 'style="opacity:0;pointer-events:none;"' : '';

    div.innerHTML = `
      <div class="card-top">
        <span class="card-month-label">Month ${row.month}</span>
        <div style="text-align:right;">
          <div style="font-size:0.62rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:2px;">Closing Balance</div>
          <span class="card-closing" style="color:${closingColor};">${closingText}</span>
        </div>
      </div>
      <div class="card-grid">
        <div class="card-cell">
          <span class="card-cell-label">Opening</span>
          <span class="card-cell-value">${inrText(row.opening)}</span>
        </div>
        <div class="card-cell">
          <span class="card-cell-label">Interest</span>
          <span class="card-cell-value" style="color:#ef4444;">${inrText(row.interest)}</span>
        </div>
        <div class="card-cell">
          <span class="card-cell-label">Payment</span>
          <span class="card-cell-value" style="color:${payColor};">${payText}</span>
        </div>
        <div class="card-cell">
          <span class="card-cell-label">To Principal</span>
          <span class="card-cell-value" style="color:${row.toPrincipal > 0 ? '#16a34a' : '#ef4444'};">${inrText(row.toPrincipal)}</span>
        </div>
        <div class="card-cell">
          <span class="card-cell-label">Purchase</span>
          <span class="card-cell-value" style="color:${row.purchase > 0 ? '#4f46e5' : '#d1d5db'};">${row.purchase > 0 ? inrText(row.purchase) : '--'}</span>
        </div>
        <div class="card-cell">
          <span class="card-cell-label">Late Fee</span>
          <span class="card-cell-value" style="color:${row.lateFee > 0 ? '#dc2626' : '#d1d5db'};">${row.lateFee > 0 ? inrText(row.lateFee) : '--'}</span>
        </div>
      </div>
      <div class="card-controls">
        <button class="pay-pill ${pp}" onclick="setRowType(${i},'pay',this)">Pay</button>
        <button class="pay-pill ${pm}" onclick="setRowType(${i},'min',this)">Min</button>
        <button class="pay-pill ${ps}" onclick="setRowType(${i},'skip',this)">Skip</button>
        <input class="pay-override" id="cro-${i}" type="number" value="${amt}" min="0" ${dis}
          onchange="setRowAmount(${i},this.value)" style="flex:1;min-width:0;max-width:80px;" />
        <button class="btn-add-purchase" ${purchaseHide} onclick="openPurchaseModal(${i})">+ Purchase</button>
      </div>`;

    container.appendChild(div);
  });
}

// ── SCROLL NAVIGATOR (bidirectional) ─────────────────────────────────────────
let lastScrollY    = 0;
let scrollDir      = 'down';  // 'down' or 'up'

function handleScrollNavClick() {
  const isMobile = window.innerWidth <= 768;
  if (scrollDir === 'down') {
    const target = isMobile
      ? document.querySelector('#schedule-cards .month-card:last-child')
      : document.querySelector('#schedule-body tr:last-child');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    const target = isMobile
      ? document.querySelector('#schedule-cards .month-card:first-child')
      : document.querySelector('#schedule-body tr:first-child');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateScrollArrow() {
  const nav = document.getElementById('scroll-nav');
  if (!nav) return;

  // Only relevant when more than 50 months
  if (scheduleData.length <= 50) {
    nav.style.display = 'none';
    return;
  }

  const isMobile  = window.innerWidth <= 768;
  const container = isMobile
    ? document.getElementById('schedule-cards')
    : document.getElementById('schedule-body');
  if (!container) { nav.style.display = 'none'; return; }

  const tbodyRect  = container.getBoundingClientRect();
  const firstRow   = container.firstElementChild;
  const lastRow    = container.lastElementChild;

  const tableVisible  = tbodyRect.top < window.innerHeight && tbodyRect.bottom > 0;
  const firstVisible  = firstRow ? firstRow.getBoundingClientRect().top >= -40 : false;
  const lastVisible   = lastRow  ? lastRow.getBoundingClientRect().bottom <= window.innerHeight + 40 : false;

  // Detect scroll direction
  const currentY = window.scrollY;
  if (currentY > lastScrollY + 2)       scrollDir = 'down';
  else if (currentY < lastScrollY - 2)  scrollDir = 'up';
  lastScrollY = currentY;

  if (!tableVisible) {
    nav.style.display = 'none';
    return;
  }

  // When scrolling down: show "last month" arrow if last row not yet visible
  // When scrolling up:   show "first month" arrow if first row not yet visible (table scrolled past top)
  const showDown = scrollDir === 'down' && !lastVisible;
  const showUp   = scrollDir === 'up'   && tbodyRect.top < 0;  // table scrolled above viewport top

  if (showDown || showUp) {
    nav.style.display = 'flex';
    const icon  = document.getElementById('scroll-nav-icon');
    const label = document.getElementById('scroll-nav-label');
    if (showDown) {
      icon.setAttribute('points', '');  // reset via polyline
      icon.innerHTML = '<polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2.5" fill="none"/>';
      label.textContent = 'Jump to last month';
    } else {
      icon.innerHTML = '<polyline points="18,15 12,9 6,15" stroke="currentColor" stroke-width="2.5" fill="none"/>';
      label.textContent = 'Jump to first month';
    }
  } else {
    nav.style.display = 'none';
  }
}

// ── RECOMPUTE (master call) ───────────────────────────────────────────────────
function recompute() {
  computeSchedule();
  renderSummary();
  renderChart();
  renderTable();
  renderCards();
  updateScrollArrow();
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

  // Slider bindings
  bindSlider('inp-balance-range', 'inp-balance-num', 'disp-balance',
    v => '&#8377;' + Math.round(v).toLocaleString('en-IN'));
  bindSlider('inp-payment-range', 'inp-payment-num', 'disp-payment',
    v => '&#8377;' + Math.round(v).toLocaleString('en-IN'));

  // ── EDGE CASE: Clamp payment to be less than balance on blur ─────────────
  // We don't clamp on every keystroke (too jarring) — only on blur/change
  function clampPaymentToBalance() {
    if (globalType !== 'pay') return;  // min/skip modes don't use this
    const balance = parseFloat(document.getElementById('inp-balance-num').value) || 0;
    const payment = parseFloat(document.getElementById('inp-payment-num').value) || 0;
    if (balance > 0 && payment >= balance) {
      // Don't auto-correct silently — let computeSchedule show the error
      // but prevent the slider from going above balance - 1
      document.getElementById('inp-payment-range').max = Math.max(balance - 1, 500);
    } else {
      document.getElementById('inp-payment-range').max = 200000;
    }
  }

  document.getElementById('inp-balance-num').addEventListener('change', clampPaymentToBalance);
  document.getElementById('inp-balance-range').addEventListener('input', clampPaymentToBalance);
  document.getElementById('inp-payment-num').addEventListener('change', clampPaymentToBalance);
  document.getElementById('inp-payment-range').addEventListener('input', clampPaymentToBalance);

  document.getElementById('inp-rate').addEventListener('input', function () {
    const v = parseFloat(this.value);
    document.getElementById('disp-rate').textContent =
      v.toFixed(2) + '% / mo  (' + (v * 12).toFixed(1) + '% p.a.)';
    recompute();
  });

  // Modal events
  document.getElementById('purchase-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePurchaseModal();
  });
  document.getElementById('modal-amount').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmPurchase();
    if (e.key === 'Escape') closePurchaseModal();
  });

  // Navbar
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.toggle('hidden');
  });

  // Progress bar + bidirectional scroll navigator
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    document.getElementById('progressBar').style.width = pct + '%';
    updateScrollArrow();
  }, { passive: true });

  // Footer year
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // Initial render
  recompute();
});

// ── FAQ ACCORDION ─────────────────────────────────────────────────────────────
function toggleFaq(el) {
  const answer = el.nextElementSibling;
  if (answer) answer.classList.toggle('faq-open');
}
