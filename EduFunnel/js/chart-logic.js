function renderChart(data) {
    const ctx = document.getElementById('campaignChart').getContext('2d');
    
    // Mengambil tahun dan angka keberhasilan dari JSON database
    const labels = data.map(item => item.tahun);
    const successData = data.map(item => item.berhasil);

    new Chart(ctx, {
        type: 'bar', // Bisa diganti 'line' atau 'pie' sesuai desain UI/UX
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Mahasiswa Berhasil',
                data: successData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        }
    });
}