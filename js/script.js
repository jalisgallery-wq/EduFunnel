const supabaseUrl = 'https://sciqhbmlhecpervewyld.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaXFoYm1saGVjcGVydmV3eWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDQ3MDEsImV4cCI6MjA5MjY4MDcwMX0.7uLggDlAEiuZyU7pBX4DltH8iufWXEvUqcFVaK0907o'
const _supabase = supabase.createClient(supabaseUrl, supabaseKey)

async function ambilData() {
    let { data: campaign_performance, error } = await _supabase
        .from('campaign_performance')
        .select('*')

    if (error) {
        console.error("Error dapet data:", error)
    } else {
        console.log("Data dari Supabase:", campaign_performance)
        // Di sini panggil fungsi buat update angka & grafik
    }
}

ambilData()

async function loadDashboardData() {
    // 1. Ambil data dari tabel campaign_performance
    let { data: campaignData, error } = await _supabase
        .from('campaign_performance')
        .select('*');

    if (error) {
        console.error("Gagal ambil data:", error);
        return;
    }

    console.log("Data Supabase:", campaignData);

    // 2. Tampilkan angka ke HTML
    // Kita ambil data tahun terbaru (misal index terakhir)
    if (campaignData.length > 0) {
        const latestData = campaignData[campaignData.length - 1];
        document.getElementById('totalLeads').innerText = latestData.total_data;
    }
    
    // 3. (Opsional) Panggil fungsi grafik jika Front End sudah siap
    // renderChart(campaignData); 
}

// Jalankan fungsi saat halaman dibuka
loadDashboardData();