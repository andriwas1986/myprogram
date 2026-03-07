// public/js/modules/jadwal.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { saveSchedulePdf } from '../firestore-service.js';

let localTahunAjaran = [];
let localSchedulePdfs = [];
let currentUser = {};

// --- FUNGSI INI HANYA UNTUK ADMIN/GADIK ---
const renderJadwalView = () => {
    // Pastikan localTahunAjaran adalah array sebelum difilter
    const activeTAs = (localTahunAjaran || []).filter(ta => ta.isActive == true);

    const allActivePendidikan = activeTAs.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({
            id: `${ta.tahun}-${p.jenis.replace(/\s/g, '-')}-${p.detail.replace(/\s/g, '-')}`,
            tahun: ta.tahun,
            jenis: p.jenis,
            detail: p.detail
        }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) {
            // console.error(`Elemen tabel tidak ditemukan: #${tableBodyId}`);
            return;
        }

        // Filter menggunakan Nama Kategori yang dikirim (harus sama persis dengan DB)
        const pendidikanGroups = allActivePendidikan.filter(p => p.jenis && p.jenis.trim() === kategori);
        
        tableBody.innerHTML = '';
        if (pendidikanGroups.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-subtle">Tidak ada data aktif.</td></tr>`;
            return;
        }

        pendidikanGroups.forEach((pendidikan, index) => {
            const existingSchedule = localSchedulePdfs.find(pdf => pdf.id === pendidikan.id);
            const hasPdf = existingSchedule && existingSchedule.pdfUrl;
            const canUpload = currentUser.role === 'super_admin' || currentUser.role === 'operator';

            const row = document.createElement('tr');
            row.className = 'border-b border-main hover:bg-tertiary';
            
            // Format tampilan nama agar lebih rapi (hilangkan detail jika '-')
            let namaPendidikan = pendidikan.detail;
            if (pendidikan.detail === '-' || !pendidikan.detail) {
                namaPendidikan = pendidikan.jenis;
            } else {
                namaPendidikan = `${pendidikan.jenis} ${pendidikan.detail}`;
            }
            
            row.innerHTML = `
                <td class="p-3 text-center">${index + 1}</td>
                <td class="p-3 font-medium">${namaPendidikan.toUpperCase()} (TA ${pendidikan.tahun})</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${canUpload ? `<button class="btn-upload-jadwal bg-green-600 text-white text-xs py-1 px-2 rounded-md hover:bg-green-700" data-id="${pendidikan.id}" data-nama="${pendidikan.jenis}-${pendidikan.detail}-TA${pendidikan.tahun}">Upload</button>` : ''}
                        <button class="btn-view-jadwal bg-blue-600 text-white text-xs py-1 px-2 rounded-md hover:bg-blue-700 ${!hasPdf ? 'opacity-50 cursor-not-allowed' : ''}" data-id="${pendidikan.id}" ${!hasPdf ? 'disabled' : ''}>Lihat</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    renderCategoryTable('Diktuk Tamtama', 'jadwal-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'jadwal-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'jadwal-dikbangspes-table-body');
    
    // [UPDATE FINAL] Gunakan Nama Kategori Panjang (DB) & ID Tabel Pendek (HTML)
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'jadwal-dikbagum-sbp-table-body');
};

// --- FUNGSI INI HANYA UNTUK ADMIN/GADIK ---
const handleUploadClick = (target) => {
    const id = target.dataset.id;
    const baseFileName = target.dataset.nama.replace(/\s/g, '_');
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        showLoading('Mengunggah PDF...');
        const formData = new FormData();
        formData.append('jadwalFile', file);
        formData.append('fileName', baseFileName);

        try {
            const response = await fetch('upload_jadwal.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                await saveSchedulePdf(id, {
                    id: id,
                    pdfUrl: result.url,
                    fileName: result.fileName,
                    lastUpdated: new Date()
                });
                alert('Jadwal PDF berhasil diunggah!');
                // Opsional: Refresh tampilan tombol lihat agar langsung aktif
                // renderJadwalView(); 
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Gagal mengunggah jadwal:', error);
            alert(`Gagal mengunggah: ${error.message}`);
        } finally {
            hideLoading();
        }
    };
    fileInput.click();
};

// --- FUNGSI INI HANYA UNTUK ADMIN/GADIK ---
const handleViewClick = (target) => {
    const id = target.dataset.id;
    const schedule = localSchedulePdfs.find(pdf => pdf.id === id);
    if (schedule && schedule.pdfUrl) {
        document.getElementById('jadwal-pdf-embed').src = schedule.pdfUrl;
        document.getElementById('jadwal-pdf-title').textContent = schedule.fileName;
        openModal('jadwal-pdf-viewer-modal');
    } else {
        alert('File PDF tidak ditemukan.');
    }
};

// --- [FUNGSI BARU] KHUSUS UNTUK SISWA ---
const showStudentScheduleView = () => {
    const jadwalSection = document.getElementById('jadwal-mengajar-section');
    if (!jadwalSection) return;

    // 1. Buat ID jadwal berdasarkan data siswa yang login
    const scheduleId = `${currentUser.tahunAjaran}-${currentUser.kategori.replace(/\s/g, '-')}-${currentUser.detailPendidikan.replace(/\s/g, '-')}`;

    // 2. Cari file PDF yang cocok di database
    const schedule = localSchedulePdfs.find(pdf => pdf.id === scheduleId);

    let htmlContent = '';

    if (schedule && schedule.pdfUrl) {
        // 3a. Jika PDF ditemukan, buat tampilan <embed>
        const pdfTitle = schedule.fileName || `Jadwal ${currentUser.kategori} ${currentUser.detailPendidikan}`;
        htmlContent = `
            <div class="bg-card p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-main mb-4">${pdfTitle.toUpperCase()}</h2>
                <div class="border border-main rounded-lg overflow-hidden" style="height: 70vh;">
                    <embed src="${schedule.pdfUrl}" type="application/pdf" width="100%" height="100%">
                    <p class="p-4 text-subtle">Browser Anda tidak mendukung PDF. <a href="${schedule.pdfUrl}" target="_blank" class="text-blue-500 hover:underline">Klik di sini untuk membukanya di tab baru.</a></p>
                </div>
            </div>
        `;
    } else {
        // 3b. Jika PDF tidak ditemukan, tampilkan pesan error
        htmlContent = `
            <div class="bg-card p-6 rounded-lg shadow-md text-center">
                <h2 class="text-2xl font-bold text-main mb-4">Jadwal Pelajaran</h2>
                <i class="fas fa-calendar-times fa-3x text-yellow-500 mb-4"></i>
                <p class="text-subtle">Jadwal pelajaran untuk kelas Anda (${currentUser.kategori} ${currentUser.detailPendidikan}) belum diunggah oleh administrator.</p>
            </div>
        `;
    }
    
    // 4. Masukkan HTML ke dalam halaman
    jadwalSection.innerHTML = htmlContent;
};

// --- [FUNGSI UTAMA] ---
export const initJadwalModule = (taData, schedulePdfsData) => {
    localTahunAjaran = taData || [];
    localSchedulePdfs = schedulePdfsData || [];
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    
    if (currentUser.role === 'siswa') {
        // --- LOGIKA UNTUK SISWA ---
        if (currentUser.tahunAjaran && currentUser.kategori) {
            showStudentScheduleView();
        } else {
            const jadwalSection = document.getElementById('jadwal-mengajar-section');
            if(jadwalSection) jadwalSection.innerHTML = '<p class="text-center text-subtle">Memuat data jadwal...</p>';
        }
        
    } else {
        // --- LOGIKA UNTUK ADMIN/GADIK ---
        if (!window.jadwalModuleInitialized) {
            const jadwalSection = document.getElementById('jadwal-mengajar-section');
            if (jadwalSection) {
                jadwalSection.addEventListener('click', (e) => {
                    const uploadBtn = e.target.closest('.btn-upload-jadwal');
                    const viewBtn = e.target.closest('.btn-view-jadwal');
                    if (uploadBtn) {
                        handleUploadClick(uploadBtn);
                    }
                    if (viewBtn) {
                        handleViewClick(viewBtn);
                    }
                });
            }
            
            const closeBtn = document.querySelector('.btn-close-pdf-viewer');
            if (closeBtn && !window.jadwalModalCloseInitialized) { 
                closeBtn.addEventListener('click', () => {
                    document.getElementById('jadwal-pdf-embed').src = 'about:blank';
                    closeModal('jadwal-pdf-viewer-modal');
                });
                window.jadwalModalCloseInitialized = true; 
            }

            window.jadwalModuleInitialized = true;
        }
        
        renderJadwalView();
    }
};