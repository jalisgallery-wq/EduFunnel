// guard login
if (sessionStorage.getItem('loggedIn') !== 'true') {
  window.location.href = 'index.html';
}

// deklarasi variabel global
let jsonData = null;
let conversionChart = null;
let studentChart = null;

async function loadData() { // fungsi untuk mengambil data dari file json (ambil file data_funnel.json, simpan ke variabel jsonData, lalu panggil fungsi halaman yang sesuai.)
  try { // pola penanganan error (try dan catch)
    const response = await fetch('data_funnel.json'); // fetch untuk mengambil data_funnel.json
    if (!response.ok) throw new Error('File tidak ditemukan');
    jsonData = await response.json(); /// Mengubah teks JSON mentah menjadi objek JavaScript dan menyimpannya ke variabel global jsonData

    const path = window.location.pathname.toLowerCase();
    if (path.includes('dashboard')) {
      initDashboard();
    } else if (path.includes('traffic-sources')) {
      initTrafficSources();
    } else if (path.includes('annual-stages')) {
      initAnnualStages();
    }
  } catch (error) {
    console.error('Error fetch:', error);
    const main = document.querySelector('.page-content');
    if (main) {
      main.innerHTML = '<p style="color:#ef4444;padding:2rem;text-align:center;">Gagal memuat data. Pastikan file <strong>data_funnel.json</strong> sudah ada.</p>';
    }
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
  const s = jsonData.summary;
  setText('stat-total-leads',    s.total_prospek);
  setText('stat-retention-rate', s.rata_rata_probabilitas_konversi_persen + '%');
  setText('stat-success-rate',   s.rata_rata_probabilitas_konversi_persen + '%');
  setText('stat-failure-rate',   s.rata_rata_probabilitas_attrition_persen + '%');

  // hitung persentase leads tiap tahun dibanding tahun sebelumnya
  const total2025 = getTotalLeads(2025); 
  const total2026 = getTotalLeads(2026);
  const pct = Math.round(((total2026 - total2025) / total2025) * 100); // rumus peresentase perubahan perbandingan tahun
  setText('stat-total-change', (pct > 0 ? '+' : '') + pct + '%');

  // panggil fungsi render chart
  renderConversionChart();
  renderStudentGrowthChart();
}

function renderConversionChart() {
  const canvas = document.getElementById('conversionChart');
  if (!canvas) return;
  if (conversionChart) conversionChart.destroy();

  // FIX 1: grouped - batang berdampingan
  conversionChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['2024', '2025', '2026'],
      datasets: [
        {
          label: 'Failure',
          data: [2024, 2025, 2026].map(y => getTotalLeads(y) - getTotalBerkuliah(y)),
          backgroundColor: '#fd6a6a',
          borderRadius: 4
        },
        {
          label: 'Success',
          data: [2024, 2025, 2026].map(y => getTotalBerkuliah(y)),
          backgroundColor: '#6b69ea',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: false, grid: { display: false } },
        y: { stacked: false, beginAtZero: true }
      }
    }
  });
}

function renderStudentGrowthChart() {
  const canvas = document.getElementById('studentGrowthChart');
  if (!canvas) return;
  if (studentChart) studentChart.destroy();
  studentChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ['2024', '2025', '2026'],
      datasets: [{
        label: 'Berkuliah',
        data: [2024, 2025, 2026].map(y => getTotalBerkuliah(y)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        borderWidth: 2,
        pointRadius: 5,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

// ============================================================
// TRAFFIC SOURCES
// ============================================================
function initTrafficSources() {
  showTotalTraffic2026();

  const filter = document.getElementById('tsFilter');
  if (filter) {
    filter.addEventListener('change', function () {
      if (this.value === '') {
        showTotalTraffic2026();
      } else {
        updateTraffic(this.value);
      }
    });
  }
}

function showTotalTraffic2026() { // 2026 seluruhnya
  const rows = jsonData.funnel_data.filter(d => d.tahun === 2026);
  const totalP = rows.reduce((s, d) => s + d.prospek, 0); // totalP = total prospek 
  const totalB = rows.reduce((s, d) => s + d.berkuliah, 0); // totalB = total berkuliah
  const ret    = Math.round((totalB / totalP) * 100); // rumus persentase retention 

  setText('ts-total',     totalP);
  setText('ts-retention', ret + '%');
  setText('ts-success',   ret + '%');
  setText('ts-attrition', (100 - ret) + '%'); // rumus persentase attrition
  setText('ts-pct',       '100%');

// hitung pipeline
  const keys = ['web_visitor', 'ingin_mendaftar', 'lakukan_test', 'daftar_ulang', 'berkuliah'];
  const totals = keys.map(k => rows.reduce((s, d) => s + d.detail_tahap[k], 0));
  const yieldPct = Math.round((totals[4] / totals[0]) * 100);

  setText('ts-yield',    yieldPct + '%');
  setText('ts-s1-count', totals[0]);
  setText('ts-s1-rate',  '100%');
  for (let i = 1; i <= 4; i++) { // loop untuk menghitung konversi tiap tahun
    const conv = Math.round((totals[i] / totals[i - 1]) * 100); // total sekarang dibagi total sebelumnya, dikali 100
    setText('ts-s' + (i + 1) + '-count', totals[i]);
    setText('ts-s' + (i + 1) + '-rate',  i < 4 ? conv + '% CONV' : yieldPct + '% YIELD');
  }
}

function updateTraffic(val) { // untuk sumber traffic terntu (GA or IG)
  const map = { 'google-ads': 'Google Ads', 'instagram': 'Instagram' }; // dropdown sumber trafik
  const sumber = map[val];
  if (!sumber) return;

  const row = jsonData.funnel_data.find(d => d.tahun === 2026 && d.sumber_trafik === sumber);
  if (!row) return;

  setText('ts-total',     row.prospek);
  setText('ts-retention', row.konversi + '%');
  setText('ts-success',   row.konversi + '%');
  setText('ts-attrition', row.attrition + '%');

  const kontribusi = Math.round((row.prospek / getTotalLeads(2026)) * 100); // ngitung kontribusi/porsi sumber trafik yang dipilih dari total keseluruhan 2026
  setText('ts-pct', kontribusi + '%');

  const d = row.detail_tahap;
  const stages = [d.web_visitor, d.ingin_mendaftar, d.lakukan_test, d.daftar_ulang, d.berkuliah];
  const yieldPct = Math.round((stages[4] / stages[0]) * 100); // rumus persentase yeild 

  setText('ts-yield',    yieldPct + '%');
  setText('ts-s1-count', stages[0]);
  setText('ts-s1-rate',  '100%');
  for (let i = 1; i <= 4; i++) {
    const conv = Math.round((stages[i] / stages[i - 1]) * 100);
    setText('ts-s' + (i + 1) + '-count', stages[i]);
    setText('ts-s' + (i + 1) + '-rate',  i < 4 ? conv + '% CONV' : yieldPct + '% YIELD');
  }
}

// ============================================================
// ANNUAL STAGES
// FIX 3: slider span tab klik
// ============================================================
const YEARS = [2024, 2025, 2026];

function initAnnualStages() {
  const yearList = document.getElementById('yearList');
  if (!yearList) return;

  // Sembunyikan tombol panah
  const prev = document.getElementById('prevYearBtn');
  const next = document.getElementById('nextYearBtn');
  if (prev) prev.style.display = 'none';
  if (next) next.style.display = 'none';

  // Buat tab tahun pakai span
  yearList.innerHTML = '';
  YEARS.forEach((yr, i) => {
    const span = document.createElement('span');
    span.textContent = yr;
    span.style.cssText = `
      padding: 6px 20px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      color: ${i === 2 ? '#fff' : '#888'};
      background: ${i === 2 ? '#185FA5' : 'transparent'};
      border-radius: 20px;
      transition: all 0.2s;
    `;
    span.onclick = () => {
      // Reset semua span
      yearList.querySelectorAll('span').forEach(s => {
        s.style.color = '#888';
        s.style.background = 'transparent';
      });
      // Aktifkan yang diklik
      span.style.color = '#fff';
      span.style.background = '#185FA5';
      updateAnnual(yr);
    };
    yearList.appendChild(span);
  });

  updateAnnual(2026);
}

// changeYear tetap ada untuk jaga-jaga kalau HTML masih pakai onclick
function changeYear(dir) {
  const slider = document.getElementById('yearSlider');
  if (!slider) return;
  const n = Math.min(2, Math.max(0, parseInt(slider.value) + dir));
  slider.value = n;
  const yr = YEARS[n];
  document.getElementById('year-display').textContent = yr;
  updateAnnual(yr);
}

function updateAnnual(tahun) {
  const rows = jsonData.funnel_data.filter(d => d.tahun === tahun); // ambil data berdasarkan tahun yg dipilih
  if (!rows.length) return;

  const totalP = rows.reduce((s, d) => s + d.prospek, 0);
  const totalB = rows.reduce((s, d) => s + d.berkuliah, 0);
  const ret    = Math.round((totalB / totalP) * 100); // rumus persentase retenttion rate

  setText('as-total',     totalP);
  setText('as-retention', ret + '%');
  setText('as-success',   ret + '%');
  setText('as-attrition', (100 - ret) + '%');

  const prevRows = jsonData.funnel_data.filter(d => d.tahun === tahun - 1); // Ambil data tahun sebelumnya (untuk hitung persentase perubahan).
  if (prevRows.length) {
    const prevP = prevRows.reduce((s, d) => s + d.prospek, 0);
    const pct   = Math.round(((totalP - prevP) / prevP) * 100);
    setText('as-pct', (pct > 0 ? '+' : '') + pct + '%');
  } else {
    setText('as-pct', '-');
  }

  // hitung pipeline
  const keys = ['web_visitor', 'ingin_mendaftar', 'lakukan_test', 'daftar_ulang', 'berkuliah'];
  const totals = keys.map(k => rows.reduce((s, d) => s + d.detail_tahap[k], 0));
  const yieldPct = Math.round((totals[4] / totals[0]) * 100);

  setText('as-yield',    yieldPct + '%');
  setText('as-s1-count', totals[0]);
  setText('as-s1-rate',  '100%');
  for (let i = 1; i <= 4; i++) { // loop untuk menghitung konversi tiap tahun
    const conv = Math.round((totals[i] / totals[i - 1]) * 100);
    setText('as-s' + (i + 1) + '-count', totals[i]);
    setText('as-s' + (i + 1) + '-rate',  i < 4 ? conv + '% CONV' : yieldPct + '% YIELD');
  }
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getTotalLeads(tahun) {
  return jsonData.funnel_data
    .filter(d => d.tahun === tahun)
    .reduce((s, d) => s + d.prospek, 0);
}

function getTotalBerkuliah(tahun) {
  return jsonData.funnel_data
    .filter(d => d.tahun === tahun)
    .reduce((s, d) => s + d.berkuliah, 0);
}

loadData();
