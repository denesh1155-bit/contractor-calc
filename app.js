/* ═══════════════════════════════════════════
   CONTRACTOR CALC PRO — APPLICATION LOGIC
   ═══════════════════════════════════════════ */

'use strict';

// ── STATE ─────────────────────────────────────
let currentMode = 'margin'; // 'margin' | 'markup'

// ── MODE SWITCHER ─────────────────────────────
function setMode(mode) {
  currentMode = mode;

  const btnMargin = document.getElementById('btn-margin');
  const btnMarkup = document.getElementById('btn-markup');
  const marginGroup = document.getElementById('margin-group');
  const markupGroup = document.getElementById('markup-group');
  const tooltip    = document.getElementById('mode-tooltip');

  if (mode === 'margin') {
    btnMargin.classList.add('active');
    btnMarkup.classList.remove('active');
    marginGroup.classList.remove('hidden');
    markupGroup.classList.add('hidden');
    tooltip.innerHTML = '<strong>Margin Mode:</strong> Set your desired profit as a % of the final selling price. (Recommended for contractors)';
  } else {
    btnMarkup.classList.add('active');
    btnMargin.classList.remove('active');
    markupGroup.classList.remove('hidden');
    marginGroup.classList.add('hidden');
    tooltip.innerHTML = '<strong>Markup Mode:</strong> Set your desired profit as a % of your total cost. Common with suppliers and material vendors.';
  }
  calculate();
}

// ── BENCHMARK QUICK-APPLY ─────────────────────
function applyBenchmark(value) {
  // Always switch to margin mode when applying benchmark
  if (currentMode !== 'margin') setMode('margin');
  const marginInput  = document.getElementById('margin');
  const marginSlider = document.getElementById('margin-slider');
  marginInput.value  = value;
  marginSlider.value = value;
  calculate();
  // Flash highlight on the price card
  pulsePrice();
  // Scroll to calculator
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── CORE CALCULATION ──────────────────────────
function calculate() {
  // Read inputs (default to 0 if empty)
  const materials     = parseFloat(document.getElementById('materials').value)     || 0;
  const labor         = parseFloat(document.getElementById('labor').value)         || 0;
  const subcontractor = parseFloat(document.getElementById('subcontractor').value) || 0;
  const overheadPct   = parseFloat(document.getElementById('overhead').value)      || 0;
  const hours         = parseFloat(document.getElementById('hours').value)         || 0;

  // Keep sliders in sync with inputs
  document.getElementById('overhead-slider').value = overheadPct;
  if (currentMode === 'margin') {
    const m = parseFloat(document.getElementById('margin').value) || 0;
    document.getElementById('margin-slider').value = m;
  } else {
    const mk = parseFloat(document.getElementById('markup').value) || 0;
    document.getElementById('markup-slider').value = mk;
  }

  // ── STEP 1: Direct Costs ──
  const directCost = materials + labor + subcontractor;

  // ── STEP 2: Overhead ──
  const overheadAmount = directCost * (overheadPct / 100);

  // ── STEP 3: Total Cost ──
  const totalCost = directCost + overheadAmount;

  // ── STEP 4: Selling Price ──
  let sellingPrice = 0;
  let profit = 0;
  let effectiveMargin = 0;
  let effectiveMarkup = 0;

  if (currentMode === 'margin') {
    const marginPct = parseFloat(document.getElementById('margin').value) || 0;
    // Guard: margin must be < 100%
    const safeMargin = Math.min(marginPct, 99.9);
    sellingPrice    = totalCost / (1 - safeMargin / 100);
    profit          = sellingPrice - totalCost;
    effectiveMargin = marginPct;
    effectiveMarkup = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  } else {
    const markupPct = parseFloat(document.getElementById('markup').value) || 0;
    sellingPrice    = totalCost * (1 + markupPct / 100);
    profit          = sellingPrice - totalCost;
    effectiveMarkup = markupPct;
    effectiveMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  }

  // ── STEP 5: Effective Hourly Rate ──
  const effectiveHourly = (hours > 0 && sellingPrice > 0) ? sellingPrice / hours : 0;

  // ── UPDATE UI ──
  updateResults({
    sellingPrice, profit, directCost, overheadAmount, totalCost,
    effectiveMargin, effectiveMarkup, effectiveHourly, hours
  });
}

// ── RENDER RESULTS ────────────────────────────
function updateResults({ sellingPrice, profit, directCost, overheadAmount, totalCost,
                          effectiveMargin, effectiveMarkup, effectiveHourly, hours }) {

  // Selling Price
  const priceEl = document.getElementById('selling-price');
  const prevPrice = priceEl.textContent;
  const newPrice  = fmt(sellingPrice);
  if (prevPrice !== newPrice) {
    priceEl.textContent = newPrice;
    pulsePrice();
  }

  // Sub line
  document.getElementById('price-sub').textContent =
    sellingPrice > 0
      ? `Total Cost: ${fmt(totalCost)} + Profit: ${fmt(profit)}`
      : 'Enter costs on the left to calculate';

  // Breakdown amounts
  document.getElementById('b-direct').textContent   = fmt(directCost);
  document.getElementById('b-overhead').textContent  = fmt(overheadAmount);
  document.getElementById('b-profit').textContent    = fmt(profit);

  // Bars (% of selling price)
  const total = sellingPrice || 1;
  setBar('bar-direct',   (directCost / total) * 100);
  setBar('bar-overhead', (overheadAmount / total) * 100);
  setBar('bar-profit',   (profit / total) * 100);

  // Conversion values
  document.getElementById('eff-markup').textContent = sellingPrice > 0 ? fmtPct(effectiveMarkup) : '—';
  document.getElementById('eff-margin').textContent = sellingPrice > 0 ? fmtPct(effectiveMargin) : '—';

  // Hourly rate row
  const hourlyRow = document.getElementById('hourly-row');
  if (hours > 0 && sellingPrice > 0) {
    hourlyRow.style.display = 'flex';
    document.getElementById('eff-hourly').textContent = fmt(effectiveHourly) + '/hr';
  } else {
    hourlyRow.style.display = 'none';
  }

  // Donut chart
  updateDonut(directCost, overheadAmount, profit, sellingPrice, effectiveMargin);
}

// ── DONUT CHART ───────────────────────────────
const CIRC = 2 * Math.PI * 70; // ~439.8

function updateDonut(direct, overhead, profit, total, marginPct) {
  if (total <= 0) {
    setDash('d-direct',   0, CIRC, 0);
    setDash('d-overhead', 0, CIRC, 0);
    setDash('d-profit',   0, CIRC, 0);
    document.getElementById('center-profit').textContent = '0%';
    return;
  }

  const dDirect   = (direct   / total) * CIRC;
  const dOverhead = (overhead / total) * CIRC;
  const dProfit   = (profit   / total) * CIRC;

  // Each segment's offset = sum of previous segments (clockwise from top = -90°)
  const offsetDirect   = 0;
  const offsetOverhead = dDirect;
  const offsetProfit   = dDirect + dOverhead;

  setDash('d-direct',   dDirect,   CIRC, offsetDirect);
  setDash('d-overhead', dOverhead, CIRC, offsetOverhead);
  setDash('d-profit',   dProfit,   CIRC, offsetProfit);

  document.getElementById('center-profit').textContent = fmtPct(Math.max(0, marginPct));
}

function setDash(id, dash, gap, offsetArc) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.strokeDasharray  = `${dash} ${gap - dash}`;
  // Rotate so each arc starts where the previous one ended
  // Base rotation is -90deg (top) expressed as stroke-dashoffset trick:
  // dashoffset shifts the start of the dash pattern.
  // We shift by (CIRC - offsetArc) so arc starts at -90° + offsetArc
  el.style.strokeDashoffset = CIRC - offsetArc;
}

// ── COPY RESULT ───────────────────────────────
function copyResult() {
  const price = document.getElementById('selling-price').textContent;
  navigator.clipboard.writeText(price).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copied!';
    btn.style.background = 'rgba(34,197,94,0.15)';
    btn.style.borderColor = 'rgba(34,197,94,0.3)';
    btn.style.color = '#22C55E';
    setTimeout(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  });
}

// ── FAQ TOGGLE ────────────────────────────────
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  // Open clicked (if it was closed)
  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
}

// ── TOOLTIPS ──────────────────────────────────
(function initTooltips() {
  const popup = document.getElementById('tooltip-popup');
  document.querySelectorAll('.tooltip-icon').forEach(icon => {
    icon.addEventListener('mouseenter', (e) => {
      popup.textContent = e.target.dataset.tip;
      popup.classList.add('show');
    });
    icon.addEventListener('mousemove', (e) => {
      popup.style.left = (e.clientX + 14) + 'px';
      popup.style.top  = (e.clientY - 10) + 'px';
    });
    icon.addEventListener('mouseleave', () => {
      popup.classList.remove('show');
    });
  });
})();

// ── HELPERS ───────────────────────────────────
function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2
  }).format(Math.max(0, n));
}

function fmtPct(n) {
  if (isNaN(n) || !isFinite(n)) return '0.00%';
  return n.toFixed(2) + '%';
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function pulsePrice() {
  const el = document.getElementById('selling-price');
  el.classList.remove('price-pulse');
  void el.offsetWidth; // reflow
  el.classList.add('price-pulse');
}

// ── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set default example values
  document.getElementById('materials').value     = '3500';
  document.getElementById('labor').value         = '2000';
  document.getElementById('subcontractor').value = '500';
  calculate();
});
