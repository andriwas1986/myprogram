<?php
// File: public/config.php

// --- PENGATURAN DOMAIN & SERVER ---

// 1. Domain Utama Aplikasi (Tanpa tanda '/' di akhir)
// Ganti nilai ini jika Anda membeli domain baru atau pindah alamat
define('APP_URL', 'https://akademik.pusdikpolair.my.id');

// 2. Folder Fisik Penyimpanan (Otomatis mendeteksi path server)
// __DIR__ akan otomatis menyesuaikan jika Anda pindah server (hosting)
define('UPLOAD_PATH', __DIR__ . '/uploads/');

// 3. URL Folder Upload (Untuk ditampilkan di browser)
define('UPLOAD_URL', APP_URL . '/uploads/');

// 4. Pengaturan Zona Waktu
date_default_timezone_set('Asia/Jakarta');

?>