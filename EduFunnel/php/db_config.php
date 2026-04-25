<?php
$host = "localhost"; // atau alamat IP server hosting
$user = "root";      // username database
$pass = "";          // password database
$db   = "edu_funnel"; // nama database kalian

$conn = mysqli_connect($host, $user, $pass, $db);

if (!$conn) {
    die("Koneksi gagal: " . mysqli_connect_error());
}
?>