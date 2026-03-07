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
$target_dir = UPLOAD_PATH . 'admin/';

// Buat folder jika belum ada dan amankan
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0755, true);
    file_put_contents($target_dir . 'index.php', ''); // File kosong pencegah intip isi folder
}

// --- PROSES UPLOAD ---
if (isset($_FILES["fotoPengguna"])) {
    $file = $_FILES["fotoPengguna"];
    $imageFileType = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

    // Buat nama file yang unik
    $unique_name = uniqid('admin_', true) . '.' . $imageFileType;
    $target_file = $target_dir . $unique_name;

    // Validasi file
    // 1. Cek apakah ini benar-benar file gambar
    $check = getimagesize($file["tmp_name"]);
    if($check === false) {
        echo json_encode(["success" => false, "message" => "File bukan gambar valid."]);
        exit();
    }

    // 2. Batasi ukuran file (2MB)
    if ($file["size"] > 2000000) {
        echo json_encode(["success" => false, "message" => "Ukuran file terlalu besar. Maksimal 2MB."]);
        exit();
    }

    // 3. Izinkan format file tertentu
    $allowed_formats = ["jpg", "jpeg", "png", "gif"];
    if(!in_array($imageFileType, $allowed_formats)) {
        echo json_encode(["success" => false, "message" => "Hanya format JPG, JPEG, PNG & GIF yang diizinkan."]);
        exit();
    }

    // Pindahkan file yang diunggah
    if (move_uploaded_file($file["tmp_name"], $target_file)) {
        // 5. Gunakan UPLOAD_URL dari config.php untuk membuat link publik
        $file_url = UPLOAD_URL . 'admin/' . $unique_name;
        
        echo json_encode(["success" => true, "url" => $file_url]);
    } else {
        error_log("Upload Admin Gagal: " . print_r(error_get_last(), true));
        echo json_encode(["success" => false, "message" => "Terjadi kesalahan saat mengunggah file ke server."]);
    }

} else {
    echo json_encode(["success" => false, "message" => "Tidak ada file 'fotoPengguna' yang diterima."]);
}
?>