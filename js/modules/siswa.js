// js/modules/siswa.js

import { showLoading, hideLoading, openModal, closeModal, getDefaultAvatar } from '../ui.js'; 
import { addStudent, updateStudent, deleteStudent, deleteStudentsBulk } from '../firestore-service.js';

// --- KONFIGURASI URL & KEAMANAN UPLOAD ---
// Pastikan file upload.php ada di root domain utama
const UPLOAD_ENDPOINT = 'https://akademik.pusdikpolair.my.id/upload.php'; 
const UPLOAD_SECRET = 'PusdikPolair#Jaya2026!SecureUpload'; // Harus SAMA PERSIS dengan di config.php

// --- STATE LOKAL MODUL ---
let localStudents = [];
let localTahunAjaran = [];
let siswaDiktukForm, siswaDikbangspesForm;

// --- STATE UNTUK NAVIGASI ---
let currentView = 'main';
let selectedFilters = {};
let viewHistory = [];

// --- STATE UNTUK PAGINATION (LIST VIEW) ---
let siswaCurrentPage = 1;
const SISWA_ROWS_PER_PAGE = 10;

// --- STATE UNTUK PAGINATION (MAIN VIEW) ---
const MAIN_VIEW_ROWS_PER_PAGE = 10; 
let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1
};

// --- ELEMEN DOM ---
let mainView, classDetailView, viewTitle, backButton, viewContainer;

// --- FUNGSI FORMAT TANGGAL ---
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Mengganti tab Kategori Pendidikan yang aktif dan menggerakkan slider.
 */
const switchTab = (activeTab) => {
    const slider = document.getElementById('siswa-tab-slider');
    const tabContainer = document.querySelector('.ta-tabs-container nav');
    const activeButton = tabContainer.querySelector(`.ta-tab-btn[data-tab='${activeTab}']`);

    if (slider && activeButton) {
        slider.style.width = `${activeButton.offsetWidth}px`;
        slider.style.transform = `translateX(${activeButton.offsetLeft}px)`;

        tabContainer.querySelectorAll('.ta-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });
    }

    document.querySelectorAll('.ta-tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `tab-content-${activeTab}`);
    });
};

/**
 * Fungsi render utama, mengatur tampilan mana yang aktif.
 */
const render = () => {
    if (!mainView || !classDetailView || !backButton) return;
    
    mainView.classList.toggle('hidden', currentView !== 'main');
    classDetailView.classList.toggle('hidden', currentView !== 'class');
    backButton.classList.toggle('hidden', viewHistory.length === 0);

    switch (currentView) {
        case 'main':
            viewTitle.textContent = 'Manajemen Data Siswa';
            const mainSubtitle = document.getElementById('siswa-view-subtitle');
            if (mainSubtitle) mainSubtitle.innerHTML = '';
            renderMainView();
            break;
        case 'class':
            viewTitle.textContent = `${selectedFilters.kategori} ${selectedFilters.detail} (TA ${selectedFilters.tahun})`.toUpperCase();
            renderClassDetailView();
            break;
    }
};

/**
 * Merender tampilan utama yang berisi daftar kategori pendidikan.
 */
const renderMainView = () => {
    const allPendidikanData = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ 
            ...p, 
            tahun: ta.tahun, 
            tanggalMulai: ta.tanggalMulai,
            tanggalBerakhir: ta.tanggalBerakhir,
            isActive: ta.isActive 
        }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
        // Filter & Sort
        const pendidikanGroups = allPendidikanData
            .filter(p => p.jenis === kategori)
            .sort((a,b) => (b.isActive - a.isActive) || (b.tahun - a.tahun));
        
        // --- LOGIKA PAGINATION MAIN VIEW ---
        const currentPage = categoryPageMap[kategori] || 1;
        const totalItems = pendidikanGroups.length;
        const totalPages = Math.ceil(totalItems / MAIN_VIEW_ROWS_PER_PAGE);
        const start = (currentPage - 1) * MAIN_VIEW_ROWS_PER_PAGE;
        const end = start + MAIN_VIEW_ROWS_PER_PAGE;
        const paginatedGroups = pendidikanGroups.slice(start, end);

        tableBody.innerHTML = '';
        if (totalItems === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-subtle uppercase">Tidak ada data tahun ajaran untuk kategori ini.</td></tr>`;
            return;
        }

        paginatedGroups.forEach((p, index) => {
            const jumlahSiswa = localStudents.filter(s =>
                s.kategori === p.jenis &&
                s.detailPendidikan === p.detail &&
                s.tahunAjaran === p.tahun
            ).length;

            const tanggalDik = `${formatDate(p.tanggalMulai)} s.d. ${formatDate(p.tanggalBerakhir)}`;
            
            const statusText = p.isActive ? 'AKTIF' : 'ARSIP';
            const statusClass = p.isActive ? 'bg-green-500' : 'bg-red-500';

            const row = document.createElement('tr');
            row.className = 'border-b border-main hover:bg-tertiary';
            
            const detailDisplay = p.detail === '-' ? '' : p.detail;
            
            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium uppercase">${(p.jenis + ' ' + detailDisplay + ' (TA ' + p.tahun + ')' )}</td>
                <td class="p-3 text-center">${jumlahSiswa}</td>
                <td class="p-3 text-center">${tanggalDik}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 text-xs rounded-full text-white ${statusClass}">${statusText}</span></td>
                <td class="p-3 text-center">
                    <button class="bg-blue-600 text-white text-xs py-1 px-3 rounded-md hover:bg-blue-700 btn-view-group uppercase" data-kategori="${p.jenis}" data-detail="${p.detail}" data-tahun="${p.tahun}">
                        Lihat Siswa
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // --- RENDER PAGINATION CONTROLS (MAIN VIEW) ---
        if (totalPages > 1) {
            const paginationRow = document.createElement('tr');
            paginationRow.innerHTML = `
                <td colspan="6" class="p-2 text-center bg-tertiary">
                    <div class="flex justify-between items-center text-xs px-2">
                        <span class="text-subtle">Menampilkan ${start + 1}-${Math.min(end, totalItems)} dari ${totalItems} data</span>
                        <div class="flex gap-1">
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-prev-cat" 
                                data-kategori="${kategori}" ${currentPage === 1 ? 'disabled' : ''}>
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-next-cat" 
                                data-kategori="${kategori}" ${currentPage === totalPages ? 'disabled' : ''}>
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(paginationRow);
        }
    };

    renderCategoryTable('Diktuk Tamtama', 'diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'dikbangspes-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'dikbangum-sekolah-bintara-polisi-table-body'); 
};

// --- FUNGSI UNTUK MERENDER KONTROL PAGINATION (LIST SISWA) ---
const renderSiswaPagination = (totalPages, totalItems) => {
    const paginationContainer = document.getElementById('siswa-pagination');
    if (!paginationContainer) return;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (siswaCurrentPage - 1) * SISWA_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + SISWA_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} siswa
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-siswa-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-siswa-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-siswa-page');
    const nextButton = document.getElementById('next-siswa-page');

    if (prevButton) {
        prevButton.disabled = (siswaCurrentPage === 1);
        prevButton.addEventListener('click', () => {
            if (siswaCurrentPage > 1) {
                siswaCurrentPage--;
                renderClassDetailView();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (siswaCurrentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (siswaCurrentPage < totalPages) {
                siswaCurrentPage++;
                renderClassDetailView();
            }
        });
    }
};

/**
 * Merender tampilan detail yang berisi daftar siswa dalam satu kelompok.
 */
const renderClassDetailView = () => {
    const tableBody = document.getElementById('student-list-table-body');
    if (!tableBody) return;

    const { kategori, detail, tahun } = selectedFilters;

    const subtitleElement = document.getElementById('siswa-view-subtitle');
    if (subtitleElement) {
        const tahunAjaranData = localTahunAjaran.find(ta => 
            ta.tahun === parseInt(tahun) && 
            ta.pendidikan.some(p => p.jenis === kategori && p.detail === detail)
        );

        const isActive = tahunAjaranData?.isActive;
        const statusLabel = isActive ? '' : '<span class="text-red-500 font-bold ml-2">(ARSIP)</span>';

        const studentCount = localStudents.filter(s => 
            s.kategori === kategori &&
            s.detailPendidikan === detail &&
            s.tahunAjaran === parseInt(tahun)
        ).length;

        // [UPDATE] Header dengan Tombol Batch Upload
        subtitleElement.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-center w-full gap-2">
                <div>
                    Jumlah Siswa : ${studentCount} &nbsp; | &nbsp;
                    Tanggal Mulai Dik : ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
                    <span class="${!isActive ? 'text-red-500 font-bold' : ''}">${!isActive ? '(ARSIP)' : 'AKTIF'}</span>
                </div>
                <button id="btn-batch-upload-foto" class="bg-purple-600 text-white text-xs py-1 px-3 rounded-md hover:bg-purple-700 flex items-center gap-1 shadow-sm">
                    <i class="fas fa-images"></i> Batch Upload Foto (Sesuai Nosis)
                </button>
            </div>
        `;
        
        // Listener untuk tombol batch upload
        const btnBatch = document.getElementById('btn-batch-upload-foto');
        if(btnBatch) btnBatch.addEventListener('click', batchUploadPhotos);
    }

    const filteredStudents = localStudents.filter(s => 
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

    // --- Logika Pagination List Siswa ---
    const totalItems = filteredStudents.length;
    const totalPages = Math.ceil(totalItems / SISWA_ROWS_PER_PAGE);
    siswaCurrentPage = Math.min(Math.max(1, siswaCurrentPage), totalPages || 1);
    
    const startIndex = (siswaCurrentPage - 1) * SISWA_ROWS_PER_PAGE;
    const endIndex = startIndex + SISWA_ROWS_PER_PAGE;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    tableBody.innerHTML = '';
    if (paginatedStudents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-subtle">Belum ada siswa di kelas ini.</td></tr>`;
        renderSiswaPagination(0, 0); 
        return;
    }

    paginatedStudents.forEach((siswa, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        row.innerHTML = `
            <td class="p-3">${startIndex + index + 1}</td> 
            <td class="p-3 font-medium flex items-center gap-2">
                <img src="${getDefaultAvatar(siswa.fotoUrl)}" class="w-8 h-8 rounded-full object-cover border border-gray-300">
                ${siswa.nama}
            </td>
            <td class="p-3">${siswa.nosis || '-'}</td>
            <td class="p-3">${siswa.peleton || '-'}</td>
            <td class="p-3">${siswa.kompi || '-'}</td>
            <td class="p-3">${siswa.batalyon || '-'}</td>
            <td class="p-3 truncate max-w-xs">${siswa.alamat || '-'}</td>
            <td class="p-3 text-center whitespace-nowrap">
                <button class="text-green-500 hover:underline btn-detail-siswa" data-id="${siswa.id}">Lihat</button>
                <button class="text-blue-500 hover:underline ml-2 btn-edit-siswa" data-id="${siswa.id}" data-permission-action="update_data_siswa">Edit</button>
                <button class="text-red-500 hover:underline ml-2 btn-hapus-siswa" data-id="${siswa.id}" data-permission-action="delete_data_siswa">Hapus</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    renderSiswaPagination(totalPages, totalItems);
};

// =============================================
// === [BARU] FITUR BATCH UPLOAD FOTO ===
// =============================================
const batchUploadPhotos = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = "image/jpeg, image/png, image/jpg";
    fileInput.multiple = true; // Izinkan banyak file sekaligus

    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (!confirm(`Anda akan mengupload ${files.length} foto.\nPastikan nama file SESUAI dengan NOSIS siswa (contoh: 2024001.jpg).\nLanjutkan?`)) return;

        showLoading(`Memproses 0/${files.length} foto...`);
        
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        
        // Filter Siswa di Kelas Ini Saja
        const currentClassStudents = localStudents.filter(s => 
            s.kategori === selectedFilters.kategori &&
            s.detailPendidikan === selectedFilters.detail &&
            s.tahunAjaran === parseInt(selectedFilters.tahun)
        );

        // Buat Map untuk pencarian cepat Nosis -> Student
        const studentMap = new Map();
        currentClassStudents.forEach(s => {
            if (s.nosis) studentMap.set(String(s.nosis).trim().toLowerCase(), s);
        });

        // Folder Upload
        const { kategori, detail, tahun } = selectedFilters;
        const folderName = `${kategori}_${detail}_${tahun}`.toLowerCase().replace(/\s+/g, '_');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            showLoading(`Mengupload ${i + 1}/${files.length}: ${file.name}`);

            // Ambil Nosis dari nama file (hilangkan ekstensi)
            const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.');
            const targetNosis = fileNameWithoutExt.trim().toLowerCase();

            if (studentMap.has(targetNosis)) {
                const student = studentMap.get(targetNosis);
                
                try {
                    // Kompresi (Optional tapi disarankan)
                    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800 };
                    const compressedFile = await imageCompression(file, options);

                    const formData = new FormData();
                    formData.append('fotoSiswa', compressedFile, compressedFile.name); // Pakai nama asli
                    formData.append('subfolder', folderName);
                    formData.append('custom_name', fileNameWithoutExt); // Nama file di server ikut nosis
                    formData.append('api_key', UPLOAD_SECRET);

                    const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: formData });
                    const result = await response.json();

                    if (result.success) {
                        // Update Database
                        await updateStudent(student.id, { fotoUrl: result.url });
                        successCount++;
                    } else {
                        console.error(`Gagal upload ${file.name}: ${result.message}`);
                        failCount++;
                    }
                } catch (err) {
                    console.error(`Error upload ${file.name}:`, err);
                    failCount++;
                }
            } else {
                console.warn(`Siswa dengan Nosis ${targetNosis} tidak ditemukan di kelas ini.`);
                skippedCount++;
            }
        }

        hideLoading();
        
        let msg = `Proses Selesai!\n\n`;
        msg += `✅ Berhasil: ${successCount}\n`;
        msg += `❌ Gagal Upload: ${failCount}\n`;
        msg += `⚠️ Nosis Tidak Ditemukan (Skip): ${skippedCount}`;
        
        alert(msg);
        renderClassDetailView(); // Refresh tampilan untuk lihat foto baru
    };

    fileInput.click();
};

const renderAllDetailsView = () => {
    const tableContainer = document.getElementById('student-table-container');
    const detailsContainer = document.getElementById('student-all-details-view');
    if (!tableContainer || !detailsContainer) return;

    const filteredStudents = localStudents.filter(s =>
        s.kategori === selectedFilters.kategori &&
        s.detailPendidikan === selectedFilters.detail &&
        s.tahunAjaran === parseInt(selectedFilters.tahun)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || ''))); 

    if (filteredStudents.length === 0) {
        detailsContainer.innerHTML = '<p class="text-subtle">Tidak ada data siswa untuk ditampilkan.</p>';
        return;
    }

    let contentHtml = `
        <div class="text-center mb-8 hidden print-header">
             <img src="https://upload.wikimedia.org/wikipedia/id/thumb/8/88/Logo_Pataka_Korps_Airud.png/375px-Logo_Pataka_Korps_Airud.png" alt="Logo" class="w-20 h-20 mx-auto mb-2">
             <h2 class="text-xl font-bold text-black">PUSAT PENDIDIKAN POLISI PERAIRAN</h2>
             <p class="text-sm text-gray-700">LEMBAGA PENDIDIKAN DAN PELATIHAN POLRI</p>
             <hr class="my-4 border-black">
             <h3 class="text-lg font-bold text-black underline">DETAIL SISWA ${selectedFilters.kategori.toUpperCase()} ${selectedFilters.detail.toUpperCase()} (TA ${selectedFilters.tahun})</h3>
        </div>
        <button id="btn-back-to-table" class="bg-gray-500 text-white py-1 px-3 rounded-md hover:bg-gray-600 mb-4 no-print">&larr; Kembali ke Tabel</button>
    `;

    contentHtml += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

    filteredStudents.forEach(siswa => {
        let extraFields = '';
        if (siswa.kategori.toLowerCase().includes('diktuk')) {
            extraFields = `<tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Kelas</td><td class="py-2 px-3 text-main">${siswa.peleton || '-'} / ${siswa.kompi || '-'} / ${siswa.batalyon || '-'}</td></tr>`;
        } else {
            extraFields = `
                <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Pangkat</td><td class="py-2 px-3 text-main">${siswa.pangkat || '-'}</td></tr>
                <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Jabatan</td><td class="py-2 px-3 text-main">${siswa.jabatan || '-'}</td></tr>
                <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Agama</td><td class="py-2 px-3 text-main">${siswa.agama || '-'}</td></tr>
                <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Gol. Darah</td><td class="py-2 px-3 text-main">${siswa.goldar || '-'}</td></tr>
            `;
        }

        contentHtml += `
            <div class="bg-card rounded-lg shadow-md flex items-start gap-4 p-4 border border-main page-break-inside-avoid">
                <img src="${getDefaultAvatar(siswa.fotoUrl)}" alt="Foto Siswa" class="w-24 h-32 object-cover rounded-md border-2 border-main">
                <div class="flex-1">
                    <h4 class="font-bold text-main text-lg">${siswa.nama}</h4>
                    <table class="w-full text-left text-sm mt-2">
                        <tbody>
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Nosis / NRP</td><td class="py-2 px-3 text-main">${siswa.nosis || '-'} / ${siswa.nrp || '-'}</td></tr>
                            ${extraFields}
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">NIK</td><td class="py-2 px-3 text-main">${siswa.nik || '-'}</td></tr>
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Pend. Terakhir</td><td class="py-2 px-3 text-main">${siswa.pendidikanTerakhir || '-'}</td></tr>
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">TTL</td><td class="py-2 px-3 text-main">${siswa.tempatLahir || ''}, ${formatDate(siswa.tanggalLahir)}</td></tr>
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Asal</td><td class="py-2 px-3 text-main">${siswa.asalPolda || '-'}</td></tr>
                            <tr class="border-b border-tertiary"><td class="py-2 px-3 text-subtle font-medium w-1/3">Telepon</td><td class="py-2 px-3 text-main">${siswa.telepon || '-'}</td></tr>
                            <tr><td class="py-2 px-3 text-subtle font-medium w-1/3 align-top">Alamat</td><td class="py-2 px-3 text-main">${siswa.alamat || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    contentHtml += '</div>';
    detailsContainer.innerHTML = contentHtml;

    tableContainer.classList.add('hidden');
    detailsContainer.classList.remove('hidden');

    document.getElementById('btn-back-to-table').addEventListener('click', () => {
        tableContainer.classList.remove('hidden');
        detailsContainer.classList.add('hidden');
    });
};

const exportDetailsToPdf = async () => {
    renderAllDetailsView(); 
    showLoading('Membuat PDF...');

    await new Promise(resolve => setTimeout(resolve, 500)); 

    const detailsContainer = document.getElementById('student-all-details-view');
    if (!detailsContainer) {
        console.error("Elemen 'student-all-details-view' tidak ditemukan.");
        hideLoading();
        alert("Gagal membuat PDF: Elemen konten tidak ditemukan.");
        return;
    }
    const fileName = `Detail_Siswa_${selectedFilters.kategori}_${selectedFilters.detail}_TA${selectedFilters.tahun}.pdf`;

    const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        if (typeof html2pdf === 'function') {
            await html2pdf().from(detailsContainer).set(opt).save();
        } else {
            throw new Error("Library html2pdf() tidak ditemukan. Pastikan sudah dimuat di index.html.");
        }
    } catch (error) {
        console.error('Gagal membuat PDF:', error);
        alert('Gagal membuat PDF: ' + error.message);
    } finally {
        hideLoading();
        const tableContainer = document.getElementById('student-table-container');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (detailsContainer) detailsContainer.classList.add('hidden');
    }
};


const navigateToView = (view, filters) => {
    viewHistory.push({ view: currentView, filters: selectedFilters });
    currentView = view;
    selectedFilters = filters;
    
    if (view === 'class') {
        siswaCurrentPage = 1;
    }

    render();
};

const handleBackClick = () => {
    if (viewHistory.length > 0) {
        const lastState = viewHistory.pop();
        currentView = lastState.view;
        selectedFilters = lastState.filters;
        render();
    }
};

export const openSiswaDetailModalFromData = (siswa) => {
    if (!siswa) return;

    document.getElementById('detail-foto-siswa').src = getDefaultAvatar(siswa.fotoUrl);
    document.getElementById('detail-nama-lengkap').textContent = siswa.nama || '-';
    document.getElementById('detail-nosis').textContent = `NOSIS: ${siswa.nosis || '-'}`;
    document.getElementById('detail-pangkat').textContent = siswa.pangkat || '-';
    document.getElementById('detail-nrp-nik').textContent = `${siswa.nrp || '-'} / ${siswa.nik || '-'}`;
    document.getElementById('detail-jabatan').textContent = siswa.jabatan || '-';
    document.getElementById('detail-pendidikan-terakhir').textContent = siswa.pendidikanTerakhir || '-';
    document.getElementById('detail-asal-polda').textContent = siswa.asalPolda || '-';
    document.getElementById('detail-ttl').textContent = `${siswa.tempatLahir || ''}, ${formatDate(siswa.tanggalLahir)}`;
    document.getElementById('detail-agama').textContent = siswa.agama || '-';
    document.getElementById('detail-goldar').textContent = siswa.goldar || '-';
    document.getElementById('detail-telepon').textContent = siswa.telepon || '-';
    document.getElementById('detail-alamat').textContent = siswa.alamat || '-';
    
    const medsosContainer = document.getElementById('detail-medsos-container');
    if (medsosContainer) {
        medsosContainer.innerHTML = '';
        const medsosData = [
            { platform: 'instagram', value: siswa.instagram, icon: '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.703.01 5.555 0 5.827 0 8s.01 2.444.048 3.297c.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.297-.048c.852-.04 1.433-.174 1.942-.372.526-.205.972-.478 1.417-.923.445-.444.718-.891.923-1.417.198-.51.333-1.09.372-1.942C15.99 10.444 16 10.173 16 8s-.01-2.444-.048-3.297c-.04-.852-.174-1.433-.372-1.942a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.09-.333-1.942-.372C10.444.01 10.173 0 8 0zm0 1.44c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.486.039.843.047 1.096.047 3.232s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.486a2.478 2.478 0 0 1-.598.92 2.478 2.478 0 0 1-.92.598c-.28.11-.704.24-1.486.275-.843.038-1.096.047-3.232.047s-2.39-.009-3.232-.047c-.78-.036-1.203-.166-1.486-.275a2.478 2.478 0 0 1-.92-.598 2.478 2.478 0 0 1-.598-.92c-.11-.281-.24-.705-.275-1.486-.038-.843-.046-1.096-.046-3.232s.008-2.389.046-3.232c.036-.78.166-1.204.275-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.486-.275.843-.039 1.096-.046 3.232-.046zM8 4.865a3.135 3.135 0 1 0 0 6.27 3.135 3.135 0 0 0 0-6.27zM8 11a1.135 1.135 0 1 1 0-2.27 1.135 1.135 0 0 1 0 2.27zm4.57-6.218a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/></svg>', url: val => `https://instagram.com/${val.replace('@', '')}` },
            { platform: 'facebook', value: siswa.facebook, icon: '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-3.934 6.75-7.951z"/></svg>', url: val => `https://facebook.com/${val}` },
            { platform: 'tiktok', value: siswa.tiktok, icon: '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0Z"/></svg>', url: val => `https://tiktok.com/@${val.replace('@', '')}` },
            { platform: 'x', value: siswa.x, icon: '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.415 11.633z"/></svg>', url: val => `https://x.com/${val.replace('@', '')}` }
        ];
        let hasMedsos = false;
        medsosData.forEach(item => {
            if (item.value) {
                hasMedsos = true;
                medsosContainer.innerHTML += `
                    <a href="${item.url(item.value)}" target="_blank" class="text-gray-400 hover:text-main" title="${item.platform}">
                        ${item.icon}
                    </a>`;
            }
        });
        if (!hasMedsos) {
            medsosContainer.innerHTML = '<p class="text-sm text-subtle">-</p>';
        }
    }
    
    openModal('siswa-detail-modal');
};

const openSiswaDetailModal = (siswaId) => {
    const siswa = localStudents.find(s => s.id === siswaId);
    openSiswaDetailModalFromData(siswa);
};

const exportToExcel = () => {
    const filteredStudents = localStudents.filter(s => 
        s.kategori === selectedFilters.kategori &&
        s.detailPendidikan === selectedFilters.detail &&
        s.tahunAjaran === parseInt(selectedFilters.tahun)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

    if (filteredStudents.length === 0) {
        alert('Tidak ada data untuk diekspor.');
        return;
    }

    showLoading('Mengekspor data...');
    try {
        const dataForSheet = filteredStudents.map(s => ({
            "Nama Lengkap": s.nama,
            "Nosis": s.nosis,
            "NRP": s.nrp,
            "NIK": s.nik || '-',
            "Pendidikan Terakhir": s.pendidikanTerakhir || '-',
            "Pangkat": s.pangkat || '-',
            "Jabatan": s.jabatan || '-',
            "Asal Polda/Pengiriman": s.asalPolda,
            "Tempat Lahir": s.tempatLahir,
            "Tanggal Lahir": s.tanggalLahir,
            "Peleton": s.peleton || '-',
            "Kompi": s.kompi || '-',
            "Batalyon": s.batalyon || '-',
            "Telepon": s.telepon || '-',
            "Alamat": s.alamat || '-',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

        const fileName = `Data_Siswa_${selectedFilters.kategori}_${selectedFilters.detail}_TA${selectedFilters.tahun}.xlsx`;
        XLSX.writeFile(workbook, fileName);

    } catch (error) {
        console.error("Gagal mengekspor Excel:", error);
        alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
        hideLoading();
    }
};

// [UPDATE] IMPOR EXCEL: UPDATE JIKA ADA, INSERT JIKA BARU
const importFromExcel = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ".xlsx, .xls";
    
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Menganalisis data...');
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    throw new Error("File Excel kosong atau format tidak sesuai.");
                }

                // 1. Petakan Data Siswa yang SUDAH ADA (Key: Nosis)
                const existingStudentsMap = new Map();
                localStudents.forEach(s => {
                    if (s.nosis) {
                        existingStudentsMap.set(String(s.nosis).trim().toLowerCase(), s);
                    }
                });

                let insertCount = 0;
                let updateCount = 0;
                let promises = [];

                // 2. Loop Data Excel
                for (const row of jsonData) {
                    const rawNosis = String(row["Nosis"] || '').trim();
                    const rawNama = (row["Nama Lengkap"] || '').trim();
                    
                    const checkNosis = rawNosis.toLowerCase();

                    // Siapkan Data Baru dari Excel
                    const studentData = {
                        nama: rawNama,
                        nosis: rawNosis,
                        nrp: String(row["NRP"] || ''),
                        nik: String(row["NIK"] || ''),
                        pendidikanTerakhir: row["Pendidikan Terakhir"] || '',
                        pangkat: row["Pangkat"] || '',
                        jabatan: row["Jabatan"] || '',
                        asalPolda: row["Asal Polda/Pengiriman"] || '',
                        tempatLahir: row["Tempat Lahir"] || '',
                        tanggalLahir: row["Tanggal Lahir"] || '', 
                        peleton: row["Peleton"] || '',
                        kompi: row["Kompi"] || '',
                        batalyon: row["Batalyon"] || '',
                        telepon: String(row["Telepon"] || ''),
                        alamat: row["Alamat"] || '',
                        kategori: selectedFilters.kategori,
                        detailPendidikan: selectedFilters.detail,
                        tahunAjaran: parseInt(selectedFilters.tahun),
                        role: 'siswa'
                        // Note: fotoUrl tidak kita update lewat excel biar foto lama gak hilang
                    };

                    // 3. Logika Cek: UPDATE atau INSERT?
                    if (checkNosis && existingStudentsMap.has(checkNosis)) {
                        // --- KONDISI UPDATE ---
                        const existingStudent = existingStudentsMap.get(checkNosis);
                        promises.push(updateStudent(existingStudent.id, studentData));
                        updateCount++;
                    } else {
                        // --- KONDISI INSERT ---
                        studentData.fotoUrl = '';
                        promises.push(addStudent(studentData));
                        insertCount++;
                    }
                }

                if (promises.length > 0) {
                    showLoading(`Memproses: ${updateCount} update, ${insertCount} baru...`);
                    await Promise.all(promises);
                }

                const msg = `Proses Selesai!\n\n✅ Data Baru Ditambahkan: ${insertCount}\n🔄 Data Lama Diperbarui: ${updateCount}`;
                alert(msg);

            } catch (error) {
                console.error("Gagal mengimpor Excel:", error);
                alert("Gagal mengimpor data: " + error.message);
            } finally {
                hideLoading();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    fileInput.click();
};

const fillAndOpenDiktukModal = (kategori, detail, tahun, siswaId = null) => {
    if (!siswaDiktukForm) {
        console.error("Form Diktuk belum dimuat."); 
        return;
    }
    siswaDiktukForm.reset();
    document.getElementById('siswa-diktuk-id').value = '';
    document.getElementById('diktuk-foto-preview').src = getDefaultAvatar(null);
    document.getElementById('diktuk-foto-siswa').value = '';
    
    document.getElementById('siswa-diktuk-kategori-jenis').value = kategori;
    document.getElementById('siswa-diktuk-kategori-detail').value = detail;
    document.getElementById('siswa-diktuk-tahun-ajaran').value = tahun;
    
    const tahunAjaranInput = siswaDiktukForm.querySelector('[name="tahunAjaran"]');
    if (tahunAjaranInput) tahunAjaranInput.value = tahun;

    if (siswaId) {
        const siswa = localStudents.find(s => s.id === siswaId);
        document.getElementById('modal-diktuk-title').textContent = 'Edit Siswa Diktuk';
        document.getElementById('siswa-diktuk-id').value = siswa.id;
        document.getElementById('diktuk-foto-preview').src = getDefaultAvatar(siswa.fotoUrl);
        document.getElementById('diktuk-nama').value = siswa.nama;
        document.getElementById('diktuk-nosis').value = siswa.nosis;
        document.getElementById('diktuk-nrp').value = siswa.nrp || '';
        document.getElementById('diktuk-batalyon').value = siswa.batalyon || '';
        document.getElementById('diktuk-kompi').value = siswa.kompi || '';
        document.getElementById('diktuk-peleton').value = siswa.peleton || '';
        document.getElementById('diktuk-tempatLahir').value = siswa.tempatLahir || ''; 
        document.getElementById('diktuk-tanggalLahir').value = siswa.tanggalLahir || ''; 
        document.getElementById('diktuk-asal-polda').value = siswa.asalPolda || ''; 
        document.getElementById('diktuk-nik').value = siswa.nik || '';
        document.getElementById('diktuk-pendidikan-terakhir').value = siswa.pendidikanTerakhir || ''; 
        document.getElementById('diktuk-pangkat').value = siswa.pangkat || '';
        document.getElementById('diktuk-agama').value = siswa.agama || '';
        document.getElementById('diktuk-goldar').value = siswa.goldar || '';
        document.getElementById('diktuk-alamat').value = siswa.alamat || '';
        document.getElementById('diktuk-telp').value = siswa.telepon || ''; 
        document.getElementById('diktuk-instagram').value = siswa.instagram || '';
        document.getElementById('diktuk-facebook').value = siswa.facebook || '';
        document.getElementById('diktuk-tiktok').value = siswa.tiktok || '';
        document.getElementById('diktuk-x').value = siswa.x || '';
    } else {
        document.getElementById('modal-diktuk-title').textContent = 'Tambah Siswa Diktuk Baru';
    }
    openModal('siswa-diktuk-modal');
};

const fillAndOpenDikbangspesModal = (kategori, detail, tahun, siswaId = null) => {
    if (!siswaDikbangspesForm) {
        console.error("Form Dikbangspes belum dimuat.");
        return;
    }
    siswaDikbangspesForm.reset();
    document.getElementById('siswa-dikbangspes-id').value = '';
    document.getElementById('dikbangspes-foto-preview').src = getDefaultAvatar(null);
    document.getElementById('dikbangspes-foto-siswa').value = '';
    
    const detailDisplay = (detail === '-' || !detail) ? '' : ` - ${detail}`;
    document.getElementById('siswa-dikbangspes-kategori-display').value = `${kategori}${detailDisplay} (TA ${tahun})`;
    document.getElementById('siswa-dikbangspes-kategori-jenis').value = kategori;
    document.getElementById('siswa-dikbangspes-kategori-detail').value = detail;
    document.getElementById('siswa-dikbangspes-tahun-ajaran').value = tahun;
    
    if (siswaId) {
        const siswa = localStudents.find(s => s.id === siswaId);
        document.getElementById('siswa-dikbangspes-modal-title').textContent = `Edit Siswa ${kategori}`;
        document.getElementById('siswa-dikbangspes-id').value = siswa.id;
        document.getElementById('dikbangspes-foto-preview').src = getDefaultAvatar(siswa.fotoUrl);
        document.getElementById('siswa-dikbangspes-nama').value = siswa.nama;
        document.getElementById('siswa-dikbangspes-pangkat').value = siswa.pangkat || '';
        document.getElementById('siswa-dikbangspes-nrp').value = siswa.nrp || '';
        document.getElementById('siswa-dikbangspes-nosis').value = siswa.nosis || '';
        document.getElementById('siswa-dikbangspes-jabatan').value = siswa.jabatan || '';
        document.getElementById('siswa-dikbangspes-asal-polda').value = siswa.asalPolda || '';
        document.getElementById('siswa-dikbangspes-tempat-lahir').value = siswa.tempatLahir || '';
        document.getElementById('siswa-dikbangspes-tanggal-lahir').value = siswa.tanggalLahir || '';
        document.getElementById('siswa-dikbangspes-agama').value = siswa.agama || '';
        document.getElementById('siswa-dikbangspes-goldar').value = siswa.goldar || '';
        document.getElementById('siswa-dikbangspes-telepon').value = siswa.telepon || '';
        document.getElementById('siswa-dikbangspes-alamat').value = siswa.alamat || '';
        document.getElementById('siswa-dikbangspes-nik').value = siswa.nik || '';
        document.getElementById('siswa-dikbangspes-pendidikan-terakhir').value = siswa.pendidikanTerakhir || '';
        document.getElementById('siswa-dikbangspes-instagram').value = siswa.instagram || '';
        document.getElementById('siswa-dikbangspes-facebook').value = siswa.facebook || '';
        document.getElementById('siswa-dikbangspes-tiktok').value = siswa.tiktok || '';
        document.getElementById('siswa-dikbangspes-x').value = siswa.x || '';
    } else {
        document.getElementById('siswa-dikbangspes-modal-title').textContent = `Tambah Siswa ${kategori} Baru`;
    }
    openModal('siswa-dikbangspes-modal');
};

const handleDiktukFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan data...');
    const siswaId = document.getElementById('siswa-diktuk-id').value;
    
    let fotoFile = document.getElementById('diktuk-foto-siswa').files[0];
    let fotoUrl = document.getElementById('diktuk-foto-preview').src;

    // Ambil data untuk nama folder dan file
    const kategoriVal = document.getElementById('siswa-diktuk-kategori-jenis').value || 'umum';
    const detailVal = document.getElementById('siswa-diktuk-kategori-detail').value || '';
    const nosisVal = document.getElementById('diktuk-nosis').value || 'tanpa_nosis';
    const tahunVal = document.getElementById('siswa-diktuk-tahun-ajaran').value || '';

    try {
        if (fotoFile) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800 };
            const compressedFile = await imageCompression(fotoFile, options);
            const formData = new FormData();
            
            // File fisik
            formData.append('fotoSiswa', compressedFile, compressedFile.name);
            
            // --- LOGIKA UPLOAD KE FOLDER & NOSIS ---
            let folderName = `${kategoriVal}_${detailVal}_${tahunVal}`.toLowerCase().replace(/\s+/g, '_');
            formData.append('subfolder', folderName);
            formData.append('custom_name', nosisVal);
            
            // [KEAMANAN] Sertakan API Key
            formData.append('api_key', UPLOAD_SECRET);
            // ----------------------------------------

            const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                fotoUrl = result.url;
            } else {
                throw new Error(result.message);
            }
        } else if (fotoUrl.includes('placehold.co') || fotoUrl.includes('PRESISI%20POLAIR')) {
            fotoUrl = '';
        }

        const data = {
            nama: document.getElementById('diktuk-nama').value,
            nosis: document.getElementById('diktuk-nosis').value,
            nrp: document.getElementById('diktuk-nrp').value,
            batalyon: document.getElementById('diktuk-batalyon').value,
            kompi: document.getElementById('diktuk-kompi').value,
            peleton: document.getElementById('diktuk-peleton').value,
            tempatLahir: document.getElementById('diktuk-tempatLahir').value, 
            tanggalLahir: document.getElementById('diktuk-tanggalLahir').value, 
            asalPolda: document.getElementById('diktuk-asal-polda').value, 
            nik: document.getElementById('diktuk-nik').value,
            pendidikanTerakhir: document.getElementById('diktuk-pendidikan-terakhir').value, 
            kategori: document.getElementById('siswa-diktuk-kategori-jenis').value,
            detailPendidikan: document.getElementById('siswa-diktuk-kategori-detail').value,
            tahunAjaran: parseInt(document.getElementById('siswa-diktuk-tahun-ajaran').value),
            fotoUrl,
            role: 'siswa',
            pangkat: document.getElementById('diktuk-pangkat').value,
            agama: document.getElementById('diktuk-agama').value,
            goldar: document.getElementById('diktuk-goldar').value,
            alamat: document.getElementById('diktuk-alamat').value,
            telepon: document.getElementById('diktuk-telp').value, 
            instagram: document.getElementById('diktuk-instagram').value,
            facebook: document.getElementById('diktuk-facebook').value,
            tiktok: document.getElementById('diktuk-tiktok').value,
            x: document.getElementById('diktuk-x').value
        };

        if (siswaId) {
            await updateStudent(siswaId, data);
        } else {
            await addStudent(data);
        }
        
        alert("MANTAP! Foto dan Data Siswa Diktuk Berhasil Disimpan.");
        closeModal('siswa-diktuk-modal');
    } catch (error) {
        console.error("Gagal menyimpan data siswa: ", error);
        alert("Gagal menyimpan: " + error.message);
    } finally {
        hideLoading();
    }
};

const handleDikbangspesFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan data...');
    const siswaId = document.getElementById('siswa-dikbangspes-id').value;

    let fotoFile = document.getElementById('dikbangspes-foto-siswa').files[0];
    let fotoUrl = document.getElementById('dikbangspes-foto-preview').src;

    // Ambil data untuk nama folder dan file
    const kategoriVal = document.getElementById('siswa-dikbangspes-kategori-jenis').value || 'umum';
    const detailVal = document.getElementById('siswa-dikbangspes-kategori-detail').value || '';
    const nosisVal = document.getElementById('siswa-dikbangspes-nosis').value || 'tanpa_nosis';
    const tahunVal = document.getElementById('siswa-dikbangspes-tahun-ajaran').value || '';

    try {
        if (fotoFile) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800 };
            const compressedFile = await imageCompression(fotoFile, options); 
            const formData = new FormData();
            
            // File fisik
            formData.append('fotoSiswa', compressedFile, compressedFile.name);
            
             // --- LOGIKA UPLOAD KE FOLDER & NOSIS ---
            let folderName = `${kategoriVal}_${detailVal}_${tahunVal}`.toLowerCase().replace(/\s+/g, '_');
            formData.append('subfolder', folderName);
            formData.append('custom_name', nosisVal);

            // [KEAMANAN] Sertakan API Key
            formData.append('api_key', UPLOAD_SECRET);
            // ----------------------------------------

            const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                fotoUrl = result.url;
            } else {
                throw new Error(result.message);
            }
        } else if (fotoUrl.includes('placehold.co') || fotoUrl.includes('PRESISI%20POLAIR')) {
            fotoUrl = '';
        }

        const data = {
            nama: document.getElementById('siswa-dikbangspes-nama').value,
            pangkat: document.getElementById('siswa-dikbangspes-pangkat').value,
            nrp: document.getElementById('siswa-dikbangspes-nrp').value,
            nosis: document.getElementById('siswa-dikbangspes-nosis').value,
            jabatan: document.getElementById('siswa-dikbangspes-jabatan').value,
            asalPolda: document.getElementById('siswa-dikbangspes-asal-polda').value,
            tempatLahir: document.getElementById('siswa-dikbangspes-tempat-lahir').value,
            tanggalLahir: document.getElementById('siswa-dikbangspes-tanggal-lahir').value,
            agama: document.getElementById('siswa-dikbangspes-agama').value,
            goldar: document.getElementById('siswa-dikbangspes-goldar').value,
            telepon: document.getElementById('siswa-dikbangspes-telepon').value,
            alamat: document.getElementById('siswa-dikbangspes-alamat').value,
            nik: document.getElementById('siswa-dikbangspes-nik').value,
            pendidikanTerakhir: document.getElementById('siswa-dikbangspes-pendidikan-terakhir').value,
            instagram: document.getElementById('siswa-dikbangspes-instagram').value,
            facebook: document.getElementById('siswa-dikbangspes-facebook').value,
            tiktok: document.getElementById('siswa-dikbangspes-tiktok').value,
            x: document.getElementById('siswa-dikbangspes-x').value,
            kategori: document.getElementById('siswa-dikbangspes-kategori-jenis').value,
            detailPendidikan: document.getElementById('siswa-dikbangspes-kategori-detail').value,
            tahunAjaran: parseInt(document.getElementById('siswa-dikbangspes-tahun-ajaran').value),
            fotoUrl,
            role: 'siswa'
        };

        if (siswaId) {
            await updateStudent(siswaId, data);
        } else {
            await addStudent(data);
        }
        
        alert("SIAP! Foto dan Data Siswa Dikbangspes Berhasil Disimpan.");
        closeModal('siswa-dikbangspes-modal');
    } catch (error) {
        console.error("Gagal menyimpan data siswa: ", error);
        alert("Gagal menyimpan: " + error.message);
    } finally {
        hideLoading();
    }
};

export const initSiswaModule = (studentsData, taData) => {
    if (!window.siswaModuleInitialized) {
        mainView = document.getElementById('main-view');
        classDetailView = document.getElementById('class-detail-view');
        viewTitle = document.getElementById('siswa-view-title');
        backButton = document.getElementById('btn-back-siswa');
        viewContainer = document.getElementById('siswa-view-container');
        
        siswaDiktukForm = document.getElementById('siswa-diktuk-form');
        siswaDikbangspesForm = document.getElementById('siswa-dikbangspes-form');

        if(backButton) backButton.addEventListener('click', handleBackClick);
        
        if (viewContainer) {
            viewContainer.addEventListener('click', async (e) => {
                const prevBtn = e.target.closest('.btn-prev-cat');
                const nextBtn = e.target.closest('.btn-next-cat');

                if (prevBtn) {
                    const kategori = prevBtn.dataset.kategori;
                    if (categoryPageMap[kategori] > 1) {
                        categoryPageMap[kategori]--;
                        renderMainView();
                    }
                } else if (nextBtn) {
                    const kategori = nextBtn.dataset.kategori;
                    categoryPageMap[kategori]++;
                    renderMainView();
                }

                const groupBtn = e.target.closest('.btn-view-group');
                const detailBtn = e.target.closest('.btn-detail-siswa');
                const editBtn = e.target.closest('.btn-edit-siswa');
                const deleteBtn = e.target.closest('.btn-hapus-siswa');
                const importBtn = e.target.closest('.btn-import-excel');
                const exportBtn = e.target.closest('.btn-export-excel');
                const viewAllBtn = e.target.closest('#btn-view-all-details');
                const printBtn = e.target.closest('#btn-print-details');
                const pdfBtn = e.target.closest('#btn-export-pdf');
                const tambahSiswaDetailBtn = e.target.closest('#btn-tambah-siswa-detail');
                const deleteAllBtn = e.target.closest('#btn-delete-all-siswa'); // [BARU] Button Delete All

                if (tambahSiswaDetailBtn) {
                    const { kategori, detail, tahun } = selectedFilters;
                    if (kategori.includes('Diktuk')) {
                        fillAndOpenDiktukModal(kategori, detail, tahun);
                    } else { 
                        fillAndOpenDikbangspesModal(kategori, detail, tahun);
                    }
                } else if (groupBtn) {
                    const dataset = groupBtn.dataset;
                    navigateToView('class', { 
                        kategori: dataset.kategori, 
                        detail: dataset.detail, 
                        tahun: dataset.tahun 
                    });
                } else if (detailBtn) {
                    openSiswaDetailModal(detailBtn.dataset.id);
                } else if (editBtn) {
                     const siswa = localStudents.find(s => s.id === editBtn.dataset.id);
                    if (siswa.kategori.includes('Diktuk')) {
                       fillAndOpenDiktukModal(siswa.kategori, siswa.detailPendidikan, siswa.tahunAjaran, siswa.id);
                    } else {
                       fillAndOpenDikbangspesModal(siswa.kategori, siswa.detailPendidikan, siswa.tahunAjaran, siswa.id);
                    }
                } else if (deleteBtn) {
                     if (confirm('Apakah Anda yakin ingin menghapus siswa ini?')) {
                        showLoading('Menghapus...');
                        await deleteStudent(deleteBtn.dataset.id);
                        hideLoading();
                    }
                } else if (deleteAllBtn) { 
                    // --- LOGIKA HAPUS MASSAL ---
                    const filteredStudents = localStudents.filter(s => 
                        s.kategori === selectedFilters.kategori &&
                        s.detailPendidikan === selectedFilters.detail &&
                        s.tahunAjaran === parseInt(selectedFilters.tahun)
                    );

                    if (filteredStudents.length === 0) {
                        alert('Tidak ada data siswa di tampilan ini untuk dihapus.');
                        return;
                    }

                    const confirmMsg = `PERINGATAN BAHAYA!\n\nAnda akan menghapus ${filteredStudents.length} data siswa dari kelas:\n` +
                        `${selectedFilters.kategori} ${selectedFilters.detail} (TA ${selectedFilters.tahun})\n\n` +
                        `Data yang dihapus TIDAK DAPAT DIKEMBALIKAN.\n\n` +
                        `Ketik "HAPUS SEMUA" untuk melanjutkan:`;

                    const userInput = prompt(confirmMsg);

                    if (userInput === "HAPUS SEMUA") {
                        showLoading(`Menghapus ${filteredStudents.length} siswa...`);
                        try {
                            const idsToDelete = filteredStudents.map(s => s.id);
                            await deleteStudentsBulk(idsToDelete);
                            localStudents = localStudents.filter(s => !idsToDelete.includes(s.id));
                            renderClassDetailView();
                            alert(`Berhasil menghapus ${idsToDelete.length} data siswa.`);
                        } catch (error) {
                            console.error("Gagal hapus massal:", error);
                            alert("Gagal menghapus data: " + error.message);
                        } finally {
                            hideLoading();
                        }
                    } else if (userInput !== null) {
                        alert("Penghapusan dibatalkan. Kode konfirmasi salah.");
                    }
                } else if (importBtn) {
                    importFromExcel();
                } else if (exportBtn) {
                    exportToExcel();
                } else if (viewAllBtn) {
                    renderAllDetailsView();
                } else if (printBtn) {
                    renderAllDetailsView();
                    setTimeout(() => window.print(), 300);
                } else if (pdfBtn) {
                    exportDetailsToPdf();
                }
            });
        }
        
        document.querySelectorAll('.ta-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
        
        document.getElementById('btn-upload-diktuk-foto')?.addEventListener('click', () => document.getElementById('diktuk-foto-siswa').click());
        document.getElementById('diktuk-foto-siswa')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('diktuk-foto-preview').src = event.target.result;
                }
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        // --- TAMBAHAN: TOMBOL HAPUS FOTO DIKTUK ---
        document.getElementById('btn-hapus-diktuk-foto')?.addEventListener('click', () => {
             document.getElementById('diktuk-foto-siswa').value = ''; 
             document.getElementById('diktuk-foto-preview').src = getDefaultAvatar(null); 
        });

        document.getElementById('btn-upload-dikbangspes-foto')?.addEventListener('click', () => document.getElementById('dikbangspes-foto-siswa').click());
        document.getElementById('dikbangspes-foto-siswa')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('dikbangspes-foto-preview').src = event.target.result;
                }
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        // --- TAMBAHAN: TOMBOL HAPUS FOTO DIKBANGSPES ---
        document.getElementById('btn-hapus-dikbangspes-foto')?.addEventListener('click', () => {
             document.getElementById('dikbangspes-foto-siswa').value = ''; 
             document.getElementById('dikbangspes-foto-preview').src = getDefaultAvatar(null);
        });

        if(siswaDiktukForm) siswaDiktukForm.addEventListener('submit', handleDiktukFormSubmit);
        if(siswaDikbangspesForm) siswaDikbangspesForm.addEventListener('submit', handleDikbangspesFormSubmit);
        
        document.querySelectorAll('.btn-cancel-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal('siswa-diktuk-modal');
                closeModal('siswa-dikbangspes-modal');
            });
        });
        
        window.siswaModuleInitialized = true;
    }

    localStudents = studentsData;
    localTahunAjaran = taData;
    render();
    setTimeout(() => switchTab('dikbangspes'), 100);
};