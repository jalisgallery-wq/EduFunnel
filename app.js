// =============================================
//  EduFunnel — app.js  (FIXED VERSION)
//  Supabase tables:
//    campaign_metrics  → id_performance, id_sumber, tahun, total_leads, jumlah_berhasil, jumlah_gagal
//    funnel_details    → id_funnel, id_performance, tahap_1..tahap_5
//  id_sumber: 1 = Google Ads, 2 = Instagram
// =============================================

const supabaseUrl = 'https://sciqhbmlhecpervewyld.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaXFoYm1saGVjcGVydmV3eWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDQ3MDEsImV4cCI6MjA5MjY4MDcwMX0.7uLggDlAEiuZyU7pBX4DltH8iufWXEvUqcFVaK0907o'
const _supabase = (typeof supabase !== 'undefined') ? supabase.createClient(supabaseUrl, supabaseKey) : null

// =============================================
//  HELPER: Normalisasi campaign_metrics
//  (Supabase kadang return object, kadang array)
// =============================================
function getMetric(row) {
    const m = row.campaign_metrics
    if (!m) return null
    // Jika array (one-to-many), ambil elemen pertama
    if (Array.isArray(m)) return m.length > 0 ? m[0] : null
    return m
}

// =============================================
//  CORE: Hitung pipeline dari data mentah
// =============================================

/**
 * buildPipeline(funnel, metric)
 * funnel  → { tahap_1, tahap_2, tahap_3, tahap_4, tahap_5 }
 * metric  → { total_leads, jumlah_berhasil, jumlah_gagal }
 *
 * Rumus konversi:
 *   T1        = semua lead masuk (baseline 100%)
 *   conv T2   = tahap_2 / tahap_1  × 100
 *   conv T3   = tahap_3 / tahap_2  × 100
 *   conv T4   = tahap_4 / tahap_3  × 100
 *   yield T5  = tahap_5 / tahap_1  × 100  ← overall yield (berhasil)
 *   success   = jumlah_berhasil / total_leads × 100
 *   attrition = jumlah_gagal    / total_leads × 100
 *   retention = tahap_5         / total_leads × 100
 */
function buildPipeline(funnel, metric) {
    const t1 = funnel.tahap_1 || 0
    const t2 = funnel.tahap_2 || 0
    const t3 = funnel.tahap_3 || 0
    const t4 = funnel.tahap_4 || 0
    const t5 = funnel.tahap_5 || 0

    const pct = (a, b) => b ? Math.round((a / b) * 100) : 0

    const convT2  = pct(t2, t1)
    const convT3  = pct(t3, t2)
    const convT4  = pct(t4, t3)
    const yieldT5 = pct(t5, t1)

    const totalLeads    = metric.total_leads     || 0
    const berhasil      = metric.jumlah_berhasil || 0
    const gagal         = metric.jumlah_gagal    || 0
    const successRate   = pct(berhasil, totalLeads)
    const attritionRate = pct(gagal,    totalLeads)
    const retentionRate = pct(t5,       totalLeads)

    return {
        total:         totalLeads,
        retention:     retentionRate + '%',
        success:       successRate + '%',
        attrition:     attritionRate + '%',
        yield:         yieldT5 + '%',
        success_count: berhasil,
        failure_count: gagal,
        stages: [
            { name: 'Conversion T1', count: t1, rate: '100%',              conv: 100    },
            { name: 'Conversion T2', count: t2, rate: convT2  + '% CONV',  conv: convT2 },
            { name: 'Conversion T3', count: t3, rate: convT3  + '% CONV',  conv: convT3 },
            { name: 'Conversion T4', count: t4, rate: convT4  + '% CONV',  conv: convT4 },
            { name: 'Conversion T5', count: t5, rate: yieldT5 + '% YIELD', conv: yieldT5 },
        ]
    }
}

/**
 * mergeFunnels — gabungkan banyak baris menjadi 1 pipeline total
 * FIX: gunakan getMetric() agar aman dari null / array
 */
function mergeFunnels(rows) {
    const sumFunnel = { tahap_1: 0, tahap_2: 0, tahap_3: 0, tahap_4: 0, tahap_5: 0 }
    const sumMetric = { total_leads: 0, jumlah_berhasil: 0, jumlah_gagal: 0 }

    rows.forEach(row => {
        sumFunnel.tahap_1 += row.tahap_1 || 0
        sumFunnel.tahap_2 += row.tahap_2 || 0
        sumFunnel.tahap_3 += row.tahap_3 || 0
        sumFunnel.tahap_4 += row.tahap_4 || 0
        sumFunnel.tahap_5 += row.tahap_5 || 0

        const m = getMetric(row)   // FIX: pakai helper, bukan row.campaign_metrics langsung
        if (m) {
            sumMetric.total_leads     += m.total_leads     || 0
            sumMetric.jumlah_berhasil += m.jumlah_berhasil || 0
            sumMetric.jumlah_gagal    += m.jumlah_gagal    || 0
        }
    })

    return buildPipeline(sumFunnel, sumMetric)
}

// =============================================
//  DASHBOARD PAGE
// =============================================

let conversionChartInstance = null

async function loadDashboardData() {
    if (!_supabase) return

    // STEP 1: Fetch semua campaign_metrics
    const { data: metrics, error: metricError } = await _supabase
        .from('campaign_metrics')
        .select('id_performance, id_sumber, tahun, total_leads, jumlah_berhasil, jumlah_gagal')
        .order('tahun', { ascending: true })

    if (metricError || !metrics?.length) {
        console.warn('Dashboard: gagal fetch campaign_metrics', metricError)
        return
    }

    // STEP 2: Fetch semua funnel_details (untuk hitung retention = tahap_5 / total_leads)
    const { data: funnels, error: funnelError } = await _supabase
        .from('funnel_details')
        .select('id_performance, tahap_1, tahap_2, tahap_3, tahap_4, tahap_5')

    if (funnelError || !funnels?.length) {
        console.warn('Dashboard: gagal fetch funnel_details', funnelError)
        return
    }

    // STEP 3: Agregasi semua sumber per tahun
    const byYear = {}
    metrics.forEach(m => {
        if (!byYear[m.tahun]) byYear[m.tahun] = {
            tahun: m.tahun,
            jumlah_berhasil: 0,
            jumlah_gagal: 0,
            total_leads: 0,
            tahap_5: 0
        }
        byYear[m.tahun].jumlah_berhasil += m.jumlah_berhasil || 0
        byYear[m.tahun].jumlah_gagal    += m.jumlah_gagal    || 0
        byYear[m.tahun].total_leads     += m.total_leads     || 0

        // Cari funnel yang cocok dengan id_performance ini, tambahkan tahap_5-nya
        const f = funnels.find(f => f.id_performance === m.id_performance)
        if (f) byYear[m.tahun].tahap_5 += f.tahap_5 || 0
    })

    const grouped = Object.values(byYear).sort((a, b) => a.tahun - b.tahun)
    const latest  = grouped[grouped.length - 1]
    const previous = grouped[grouped.length - 2]

    const pct = (a, b) => b ? Math.round((a / b) * 100) : 0
    const retentionRate = pct(latest.tahap_5, latest.total_leads)
    const successRate   = pct(latest.jumlah_berhasil, latest.total_leads)
    const failureRate   = pct(latest.jumlah_gagal, latest.total_leads)
    const totalGrowth   = previous?.total_leads
        ? Math.round(((latest.total_leads - previous.total_leads) / previous.total_leads) * 100)
        : null

    const el = id => document.getElementById(id)
    if (el('stat-total-leads'))   el('stat-total-leads').innerText   = Number(latest.total_leads).toLocaleString('id-ID')
    if (el('stat-total-change')) {
        el('stat-total-change').innerText = totalGrowth === null ? '' : (totalGrowth >= 0 ? '+' : '') + totalGrowth + '%'
        el('stat-total-change').classList.toggle('negative', totalGrowth < 0)
    }
    if (el('stat-retention-rate')) el('stat-retention-rate').innerText = retentionRate + '%'
    if (el('stat-success-rate'))  el('stat-success-rate').innerText  = successRate + '%'
    if (el('stat-failure-rate'))  el('stat-failure-rate').innerText  = failureRate + '%'
    if (el('insight-text'))       el('insight-text').innerText =
        `Analysis shows ${latest.jumlah_gagal} failed leads out of ${latest.total_leads} total data, resulting in a ${failureRate}% Failure Rate. Optimization is required to improve the ${successRate}% Success Rate for the next period.`

    renderConversionChart(grouped)
}

function renderConversionChart(data) {
    const canvas = document.getElementById('conversionChart')
    if (!canvas) return
    if (conversionChartInstance) conversionChartInstance.destroy()

    conversionChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.tahun),
            datasets: [
                {
                    label: 'Failure',
                    data: data.map(d => Number(d.jumlah_gagal)),
                    backgroundColor: 'rgba(239,68,68,0.7)',
                    borderColor: 'rgba(239,68,68,1)',
                    borderWidth: 1, borderRadius: 6
                },
                {
                    label: 'Success',
                    data: data.map(d => Number(d.jumlah_berhasil)),
                    backgroundColor: '#2b7de9',
                    borderColor: '#2b7de9',
                    borderWidth: 1, borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y} leads` } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    })
}

// Student Growth chart (statis)
const ctxGrowth = document.getElementById('studentGrowthChart')
if (ctxGrowth) {
    new Chart(ctxGrowth, {
        type: 'line',
        data: {
            labels: ['2024', '2025', '2026'],
            datasets: [{
                data: [50, 61, 93],
                borderColor: '#2b7de9',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#2b7de9',
                pointRadius: 5,
                tension: 0,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false },   ticks: { color: '#94a3b8' } }
            }
        }
    })
}

if (document.getElementById('stat-total-leads')) loadDashboardData()

// =============================================
//  TRAFFIC SOURCES PAGE
// =============================================

/**
 * Render pipeline ke elemen DOM dengan prefix id (misal 'ts-')
 */
function renderPipelineToDOM(prefix, pipeline) {
    const el = id => document.getElementById(id)
    if (el(`${prefix}total`))     el(`${prefix}total`).textContent     = pipeline.total
    if (el(`${prefix}retention`)) el(`${prefix}retention`).textContent = pipeline.retention
    if (el(`${prefix}success`))   el(`${prefix}success`).textContent   = pipeline.success
    if (el(`${prefix}attrition`)) el(`${prefix}attrition`).textContent = pipeline.attrition
    if (el(`${prefix}yield`))     el(`${prefix}yield`).textContent     = pipeline.yield
    pipeline.stages.forEach((s, i) => {
        if (el(`${prefix}s${i+1}-count`)) el(`${prefix}s${i+1}-count`).textContent = s.count
        if (el(`${prefix}s${i+1}-rate`))  el(`${prefix}s${i+1}-rate`).textContent  = s.rate
    })
}

/**
 * loadTrafficSources(idSumber)
 * idSumber: null = semua sumber, 1 = Google Ads, 2 = Instagram
 *
 * FIX: Fetch campaign_metrics dulu (dengan filter id_sumber jika perlu),
 *      lalu fetch funnel_details berdasarkan id_performance yang cocok.
 *      Ini menghindari bug nested filter Supabase yang tidak reliable.
 */
async function loadTrafficSources(idSumber = null) {
    if (!_supabase) return

    // STEP 1: Fetch campaign_metrics (filter tahun 2026, dan sumber jika dipilih)
    let metricQuery = _supabase
        .from('campaign_metrics')
        .select('id_performance, id_sumber, tahun, total_leads, jumlah_berhasil, jumlah_gagal')
        .eq('tahun', 2026)

    if (idSumber !== null) {
        metricQuery = metricQuery.eq('id_sumber', idSumber)
    }

    const { data: metrics, error: metricError } = await metricQuery
    if (metricError || !metrics?.length) {
        console.warn('Traffic Sources: gagal fetch campaign_metrics', metricError)
        return
    }

    // STEP 2: Ambil semua id_performance yang cocok
    const ids = metrics.map(m => m.id_performance)

    // STEP 3: Fetch funnel_details berdasarkan id_performance (pastikan id_performance ikut di-select)
    const { data: funnels, error: funnelError } = await _supabase
        .from('funnel_details')
        .select('id_performance, tahap_1, tahap_2, tahap_3, tahap_4, tahap_5')
        .in('id_performance', ids)

    if (funnelError || !funnels?.length) {
        console.warn('Traffic Sources: gagal fetch funnel_details', funnelError)
        return
    }

    // STEP 4: Join manual — pasangkan setiap funnel dengan metric-nya
    const joined = funnels.map(f => {
        const m = metrics.find(m => m.id_performance === f.id_performance)
        return { ...f, campaign_metrics: m || null }
    }).filter(r => r.campaign_metrics !== null)

    if (!joined.length) return

    // STEP 5: Build pipeline (gabungkan jika lebih dari 1 baris)
    const pipeline = joined.length === 1
        ? buildPipeline(joined[0], joined[0].campaign_metrics)
        : mergeFunnels(joined)

    renderPipelineToDOM('ts-', pipeline)
}

const tsFilterEl = document.getElementById('tsFilter')
if (tsFilterEl) {
    loadTrafficSources(null)  // load semua sumber saat halaman pertama dibuka

    tsFilterEl.addEventListener('change', function () {
        if      (this.value === 'google-ads') loadTrafficSources(1)
        else if (this.value === 'instagram')  loadTrafficSources(2)
        else                                  loadTrafficSources(null)
    })
}

// =============================================
//  ANNUAL STAGES PAGE
// =============================================

let annualChartInstance  = null
let currentYearIndex     = 0
let annualDataFromDB     = {}

/**
 * loadAnnualStages
 * FIX: Fetch 2 tabel terpisah lalu join manual,
 *      sama seperti fix di Traffic Sources.
 */
async function loadAnnualStages() {
    if (!_supabase) {
        initAnnualFallback(); return
    }

    // STEP 1: Fetch semua campaign_metrics
    const { data: metrics, error: metricError } = await _supabase
        .from('campaign_metrics')
        .select('id_performance, id_sumber, tahun, total_leads, jumlah_berhasil, jumlah_gagal')
        .order('tahun', { ascending: true })

    if (metricError || !metrics?.length) {
        console.warn('Annual Stages: gagal fetch campaign_metrics', metricError)
        initAnnualFallback(); return
    }

    // STEP 2: Fetch semua funnel_details (pastikan id_performance ikut di-select)
    const { data: funnels, error: funnelError } = await _supabase
        .from('funnel_details')
        .select('id_performance, tahap_1, tahap_2, tahap_3, tahap_4, tahap_5')

    if (funnelError || !funnels?.length) {
        console.warn('Annual Stages: gagal fetch funnel_details', funnelError)
        initAnnualFallback(); return
    }

    // STEP 3: Join manual
    const joined = funnels.map(f => {
        const m = metrics.find(m => m.id_performance === f.id_performance)
        return { ...f, campaign_metrics: m || null }
    }).filter(r => r.campaign_metrics !== null)

    if (!joined.length) { initAnnualFallback(); return }

    // STEP 4: Kelompokkan per tahun (gabungkan semua sumber)
    const byYear = {}
    joined.forEach(row => {
        const tahun = row.campaign_metrics?.tahun
        if (!tahun) return
        if (!byYear[tahun]) byYear[tahun] = []
        byYear[tahun].push(row)
    })

    const years = Object.keys(byYear).map(Number).sort()
    annualDataFromDB = {}

    years.forEach((tahun, idx) => {
        const rows     = byYear[tahun]
        const pipeline = rows.length === 1
            ? buildPipeline(rows[0], rows[0].campaign_metrics)
            : mergeFunnels(rows)

        // Hitung % perubahan total leads vs tahun sebelumnya
        let pct = ''
        if (idx > 0) {
            const prevTotal = annualDataFromDB[years[idx - 1]]?.total || 0
            if (prevTotal) {
                const change = Math.round(((pipeline.total - prevTotal) / prevTotal) * 100)
                pct = (change >= 0 ? '+' : '') + change + '%'
            }
        }

        annualDataFromDB[tahun] = { ...pipeline, pct }
    })

    window._annualYears = years
    currentYearIndex    = years.length - 1   // default: tahun terbaru
    refreshAnnual()
}

function initAnnualFallback() {
    annualDataFromDB = {
        2024: { total: 160, pct: '',      retention: '31%', success: '31%', attrition: '69%', yield: '31%', success_count: 50, failure_count: 110,
            stages: [{ name:'Conversion T1',count:160,rate:'100%',conv:100},{ name:'Conversion T2',count:120,rate:'75% CONV',conv:75},{ name:'Conversion T3',count:90,rate:'75% CONV',conv:75},{ name:'Conversion T4',count:75,rate:'83% CONV',conv:83},{ name:'Conversion T5',count:50,rate:'31% YIELD',conv:31}]},
        2025: { total: 200, pct: '+25%',  retention: '30%', success: '30%', attrition: '70%', yield: '30%', success_count: 61, failure_count: 139,
            stages: [{ name:'Conversion T1',count:200,rate:'100%',conv:100},{ name:'Conversion T2',count:154,rate:'77% CONV',conv:77},{ name:'Conversion T3',count:116,rate:'75% CONV',conv:75},{ name:'Conversion T4',count:92, rate:'79% CONV',conv:79},{ name:'Conversion T5',count:61, rate:'31% YIELD',conv:31}]},
        2026: { total: 380, pct: '+90%',  retention: '24%', success: '24%', attrition: '76%', yield: '24%', success_count: 93, failure_count: 287,
            stages: [{ name:'Conversion T1',count:380,rate:'100%',conv:100},{ name:'Conversion T2',count:269,rate:'71% CONV',conv:71},{ name:'Conversion T3',count:197,rate:'73% CONV',conv:73},{ name:'Conversion T4',count:147,rate:'75% CONV',conv:75},{ name:'Conversion T5',count:93, rate:'24% YIELD',conv:24}]},
    }
    window._annualYears = [2024, 2025, 2026]
    currentYearIndex    = 2
    refreshAnnual()
}

function renderYearSelector() {
    const years = window._annualYears || []
    const list  = document.getElementById('yearList')
    if (!list) return
    list.innerHTML = ''

    const prevY = years[currentYearIndex - 1]
    const currY = years[currentYearIndex]
    const nextY = years[currentYearIndex + 1]

    if (prevY) {
        const el = document.createElement('span')
        el.className = 'as-year-item'
        el.textContent = prevY
        el.onclick = () => { currentYearIndex--; refreshAnnual() }
        list.appendChild(el)
    }
    const curr = document.createElement('span')
    curr.className = 'as-year-item active'
    curr.textContent = currY
    list.appendChild(curr)

    if (nextY) {
        const el = document.createElement('span')
        el.className = 'as-year-item'
        el.textContent = nextY
        el.onclick = () => { currentYearIndex++; refreshAnnual() }
        list.appendChild(el)
    }

    document.getElementById('prevYearBtn').disabled = currentYearIndex === 0
    document.getElementById('nextYearBtn').disabled = currentYearIndex === years.length - 1
}

function changeYear(dir) {
    const years  = window._annualYears || []
    const newIdx = currentYearIndex + dir
    if (newIdx < 0 || newIdx >= years.length) return
    currentYearIndex = newIdx
    refreshAnnual()
}

function updateStats(d) {
    const el = id => document.getElementById(id)
    if (el('as-total'))     el('as-total').textContent     = d.total
    if (el('as-pct'))       el('as-pct').textContent       = d.pct || ''
    if (el('as-retention')) el('as-retention').textContent = d.retention
    if (el('as-success'))   el('as-success').textContent   = d.success
    if (el('as-attrition')) el('as-attrition').textContent = d.attrition
    if (el('as-yield'))     el('as-yield').textContent     = d.yield
}

function updatePipeline(d) {
    d.stages.forEach((s, i) => {
        const elC = document.getElementById(`as-s${i+1}-count`)
        const elR = document.getElementById(`as-s${i+1}-rate`)
        if (elC) elC.textContent = s.count
        if (elR) elR.textContent = s.rate
    })
}

function updateTable(d) {
    const tbody = document.getElementById('stageTableBody')
    if (!tbody) return
    tbody.innerHTML = ''
    d.stages.forEach((s, i) => {
        const status      = i === 0 ? 'blue' : s.conv >= 75 ? 'green' : s.conv >= 50 ? 'blue' : 'red'
        const statusLabel = i === 0 ? 'Entry' : s.conv >= 75 ? 'Strong' : s.conv >= 50 ? 'Moderate' : 'Weak'
        tbody.innerHTML += `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td><strong>${s.count}</strong> leads</td>
            <td>${s.rate}</td>
            <td>
              <div class="as-progress-bar">
                <div class="as-progress-fill" style="width:${s.conv}%"></div>
              </div>
            </td>
            <td><span class="as-badge ${status}">${statusLabel}</span></td>
          </tr>`
    })
}

function updateAnnualChart() {
    const canvas = document.getElementById('annualChart')
    if (!canvas) return
    if (annualChartInstance) annualChartInstance.destroy()

    const years   = window._annualYears || []
    const success = years.map(y => annualDataFromDB[y]?.success_count || 0)
    const failure = years.map(y => annualDataFromDB[y]?.failure_count || 0)

    annualChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: years.map(String),
            datasets: [
                { label: 'Failure', data: failure, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: 'rgba(239,68,68,1)', borderWidth: 1, borderRadius: 6 },
                { label: 'Success', data: success, backgroundColor: '#2b7de9', borderColor: '#2b7de9', borderWidth: 1, borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y} leads` } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    })
}

function refreshAnnual() {
    const years = window._annualYears || []
    const year  = years[currentYearIndex]
    const d     = annualDataFromDB[year]
    if (!d) return
    renderYearSelector()
    updateStats(d)
    updatePipeline(d)
    updateTable(d)
    updateAnnualChart()
}

if (document.getElementById('yearList')) loadAnnualStages()
