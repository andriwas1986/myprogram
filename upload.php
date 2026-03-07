<?php
// FILE: upload.php

require_once 'config.php';

// Bypass Session Check (Karena pakai Firebase Auth di JS)
// session_start();

// [KEAMANAN] Batasi akses hanya dari domain resmi
header("Access-Control-Allow-Origin: https://akademik.pusdikpolair.my.id");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 1. Tentukan Root Folder (Default)
$base_dir = UPLOAD_PATH; // Dari config.php (misal: .../uploads/)
$base_url = UPLOAD_URL;  // Dari config.php (misal: .../uploads/)

// Variabel default
$final_target_dir = $base_dir;
$final_url_dir = $base_url;

// --- LOGIKA BARU: DETEKSI INPUT FILE (Siswa / Admin) ---
$file_key = null;
if (isset($_FILES['fotoSiswa'])) {
    $file_key = 'fotoSiswa';
} elseif (isset($_FILES['fotoPengguna'])) {
    $file_key = 'fotoPengguna';
}

// Jika tidak ada file yang dikenali
if (!$file_key) {
    echo json_encode(["success" => false, "message" => "Tidak ada file valid yang dikirim (fotoSiswa/fotoPengguna)."]);
    exit();
}

$file = $_FILES[$file_key];

// --- LOGIKA OTOMATIS SUBFOLDER ---
// Jika JS tidak mengirim 'subfolder', kita tentukan otomatis berdasarkan jenis input
if (!isset($_POST['subfolder']) || empty($_POST['subfolder'])) {
    if ($file_key === 'fotoPengguna') {
        $_POST['subfolder'] = 'admin'; // Foto admin masuk folder admin/
    }
}

// --- LOGIKA DYNAMIC FOLDER ---
if (isset($_POST['subfolder']) && !empty($_POST['subfolder'])) {
    // Bersihkan nama folder (hanya huruf, angka, underscore, strip) agar aman
    $subfolder = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $_POST['subfolder']);
    
    // Update path tujuan
    $final_target_dir = $base_dir . $subfolder . '/';
    $final_url_dir = $base_url . $subfolder . '/';
}

// Buat folder jika belum ada (Recursive)
if (!file_exists($final_target_dir)) {
    if (!mkdir($final_target_dir, 0755, true)) {
        echo json_encode(["success" => false, "message" => "Gagal membuat folder tujuan."]);
        exit();
    }
    // Buat index.php kosong untuk keamanan
    file_put_contents($final_target_dir . 'index.php', ''); 
}

// --- PROSES UPLOAD ---
// Ambil ekstensi (jpg/png)
$imageFileType = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

// Validasi Gambar
$check = getimagesize($file["tmp_name"]);
if($check === false) {
    echo json_encode(["success" => false, "message" => "File bukan gambar."]);
    exit();
}

// Validasi Tipe File (Opsional tapi disarankan)
$allowed_types = ['jpg', 'jpeg', 'png', 'gif'];
if (!in_array($imageFileType, $allowed_types)) {
    echo json_encode(["success" => false, "message" => "Hanya format JPG, JPEG, PNG, & GIF yang diperbolehkan."]);
    exit();
}

// --- PENAMAAN FILE ---
if (isset($_POST['custom_name']) && !empty($_POST['custom_name'])) {
    // Bersihkan nama file (hanya angka/huruf)
    $clean_name = preg_replace('/[^a-zA-Z0-9]/', '', $_POST['custom_name']);
    $file_name = $clean_name . '.' . $imageFileType;
} else {
    // Fallback: Pakai Uniqid dengan prefix sesuai tipe
    $prefix = ($file_key === 'fotoPengguna') ? 'admin_' : 'siswa_';
    $file_name = uniqid($prefix, true) . '.' . $imageFileType;
}

$target_file = $final_target_dir . $file_name;

// Pindahkan file
if (move_uploaded_file($file["tmp_name"], $target_file)) {
    // Balikkan URL lengkap
    $file_url = $final_url_dir . $file_name;
    
    echo json_encode([
        "success" => true, 
        "url" => $file_url,
        "message" => "Upload berhasil!"
    ]);
} else {
    echo json_encode(["success" => false, "message" => "Gagal menyimpan file ke folder server."]);
}
?>