<?php
// 1. Panggil file konfigurasi
require_once 'config.php';

// 2. Mulai Sesi & Cek Login
session_start();

// Cek apakah user sudah login
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); // Forbidden
    echo json_encode(["success" => false, "message" => "Akses ditolak. Silakan login."]);
    exit();
}

// 3. Gunakan APP_URL dari config.php untuk CORS
header("Access-Control-Allow-Origin: " . APP_URL);
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 4. Gunakan UPLOAD_PATH dari config.php untuk folder fisik
$target_dir = UPLOAD_PATH . 'materi/';

// Buat folder jika belum ada dan amankan
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0755, true);
    file_put_contents($target_dir . 'index.php', ''); // File kosong pencegah intip isi folder
}

// --- PROSES UPLOAD ---
if (isset($_FILES["materiFile"])) {
    $file = $_FILES["materiFile"];
    $file_extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

    // Buat nama file yang unik
    $unique_name = uniqid('materi_', true) . '.' . $file_extension;
    $target_file = $target_dir . $unique_name;

    // Validasi file
    // 1. Batasi ukuran file (20MB)
    if ($file["size"] > 20000000) { 
        echo json_encode(["success" => false, "message" => "Ukuran file terlalu besar. Maksimal 20MB."]);
        exit();
    }

    // 2. Izinkan format file yang umum untuk materi
    $allowed_formats = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "mp4", "mov", "zip", "rar", "jpg", "jpeg", "png"];
    if(!in_array($file_extension, $allowed_formats)) {
        echo json_encode(["success" => false, "message" => "Format file tidak diizinkan."]);
        exit();
    }

    // Pindahkan file yang diunggah
    if (move_uploaded_file($file["tmp_name"], $target_file)) {
        // 5. Gunakan UPLOAD_URL dari config.php untuk membuat link publik
        $file_url = UPLOAD_URL . 'materi/' . $unique_name;
        
        echo json_encode(["success" => true, "url" => $file_url]);
    } else {
        error_log("Upload Materi Gagal: " . print_r(error_get_last(), true));
        echo json_encode(["success" => false, "message" => "Terjadi kesalahan saat mengunggah file ke server."]);
    }

} else {
    echo json_encode(["success" => false, "message" => "Tidak ada file 'materiFile' yang diterima."]);
}
?>