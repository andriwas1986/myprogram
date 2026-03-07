<?php
// 1. Panggil file konfigurasi untuk mendapatkan APP_URL, UPLOAD_PATH, dll.
require_once 'config.php';

// 2. Mulai Sesi & Cek Login
session_start();

// Cek apakah user sudah login
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); // Forbidden
    echo json_encode(["success" => false, "message" => "Akses ditolak. Silakan login."]);
    exit();
}

// 3. Gunakan APP_URL dari config.php untuk CORS (Keamanan Cross-Origin)
header("Access-Control-Allow-Origin: " . APP_URL);
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 4. Gunakan UPLOAD_PATH dari config.php untuk folder fisik
$target_dir = UPLOAD_PATH . 'jadwal/';

// Buat folder jika belum ada dan amankan
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0755, true);
    file_put_contents($target_dir . 'index.php', ''); // File kosong pencegah intip isi folder
}

// --- LOGIKA SANITASI NAMA FILE ---
// Mencegah Path Traversal (misal input: ../../hack.php)
$rawFileName = isset($_POST['fileName']) ? $_POST['fileName'] : uniqid('jadwal_', true);

// Hanya izinkan huruf, angka, strip, dan underscore
$fileName = preg_replace('/[^a-zA-Z0-9_\-]/', '', $rawFileName);

if (empty($fileName)) {
    $fileName = uniqid('jadwal_', true);
}

// --- PROSES UPLOAD ---
if (isset($_FILES["jadwalFile"])) {
    $file = $_FILES["jadwalFile"];
    $file_extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

    // Validasi Ekstensi (Hanya PDF)
    if ($file_extension !== 'pdf') {
        echo json_encode(["success" => false, "message" => "Hanya file format PDF yang diizinkan."]);
        exit();
    }

    // Validasi MIME Type (Keamanan Tambahan untuk memastikan isi file benar-benar PDF)
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file["tmp_name"]);
    finfo_close($finfo);
    
    if ($mime !== 'application/pdf') {
        echo json_encode(["success" => false, "message" => "File bukan PDF valid."]);
        exit();
    }

    // Tentukan path tujuan (Gabungkan nama bersih + ekstensi)
    $target_file = $target_dir . $fileName . '.' . $file_extension;

    // Validasi Ukuran (Maksimal 20 MB)
    if ($file["size"] > 20000000) { 
        echo json_encode(["success" => false, "message" => "Ukuran file terlalu besar. Maksimal 20MB."]);
        exit();
    }

    if (move_uploaded_file($file["tmp_name"], $target_file)) {
        // 5. Gunakan UPLOAD_URL dari config.php untuk membuat link publik
        $file_url = UPLOAD_URL . 'jadwal/' . $fileName . '.' . $file_extension;
        
        echo json_encode([
            "success" => true, 
            "url" => $file_url, 
            "fileName" => basename($target_file)
        ]);
    } else {
        // Log error ke server, jangan tampilkan path ke user
        error_log("Upload Jadwal Gagal: " . print_r(error_get_last(), true));
        echo json_encode(["success" => false, "message" => "Terjadi kesalahan saat mengunggah file ke server."]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Tidak ada file 'jadwalFile' yang diterima."]);
}
?>