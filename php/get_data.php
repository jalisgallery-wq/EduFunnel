<?php
// Izinkan akses dari port berbeda (untuk Live Server)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

include 'db_config.php';

// Wadah untuk semua data
$response = array();

// 1. Ambil Data Campaign Performance
$query1 = "SELECT * FROM campaign_performance";
$result1 = mysqli_query($conn, $query1);
$response['campaign_performance'] = array();
while($row = mysqli_fetch_assoc($result1)) {
    $response['campaign_performance'][] = $row;
}

// 2. Ambil Data Kontribusi Sumber Trafik
$query2 = "SELECT * FROM traffic_contribution";
$result2 = mysqli_query($conn, $query2);
$response['traffic_contribution'] = array();
while($row = mysqli_fetch_assoc($result2)) {
    $response['traffic_contribution'][] = $row;
}

// 3. Ambil Data Conversion Rates (Funnel)
$query3 = "SELECT * FROM conversion_rates";
$result3 = mysqli_query($conn, $query3);
$response['conversion_rates'] = array();
while($row = mysqli_fetch_assoc($result3)) {
    $response['conversion_rates'][] = $row;
}

// Kirim semua data dalam satu paket JSON
echo json_encode($response, JSON_PRETTY_PRINT);

mysqli_close($conn);
?>