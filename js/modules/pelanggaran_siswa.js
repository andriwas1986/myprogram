// js/modules/pelanggaran_siswa.js

import { showLoading, hideLoading, openModal, closeModal, getDefaultAvatar } from '../ui.js';
import { addPelanggaran, updatePelanggaran, deletePelanggaran } from '../firestore-service.js';

// --- KONFIGURASI URL & KEAMANAN UPLOAD ---
const UPLOAD_ENDPOINT = 'https://akademik.pusdikpolair.my.id/upload.php'; 
const UPLOAD_SECRET = 'PusdikPolair#Jaya2026!SecureUpload'; 

// --- STATE LOKAL ---
let localPelanggaran = [];
let localStudents = [];
let localTahunAjaran = [];
let currentUser = {};

// --- STATE UI & NAVIGASI ---
let currentView = 'main';
let selectedFilters = {};
let mainView, listView, viewTitle, backButton, subtitleElement;

// --- STATE PAGINATION (LIST VIEW) ---
let currentPage = 1;
const ROWS_PER_PAGE = 10;

// --- STATE PAGINATION (MAIN VIEW) ---
const MAIN_VIEW_ROWS_PER_PAGE = 5;
// Mapping ID Tabel HTML -> Halaman Aktif
let mainViewCurrentPages = {
    'pelanggaran-diktuk-tamtama-table-body': 1,
    'pelanggaran-diktuk-bintara-table-body': 1,
    'pelanggaran-dikbangspes-table-body': 1,
    'pelanggaran-dikbagum-sbp-table-body': 1 
};

// --- HELPER ---
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
};

// Helper Normalisasi (Agar data "-" dan "" dianggap sama saat filter)
const normalizeDetail = (val) => {
    if (!val || val === '-' || val === 'null' || val === 'undefined') return '';
    return val.toString().trim();
};

// ======================================================
// --- FUNGSI UNTUK TAMPILAN SISWA ---
// ======================================================

const renderSiswaPelanggaranView = () => {
    const container = document.getElementById('pelanggaran-siswa-view-container');
    if (!container) return;

    const myPelanggaran = (localPelanggaran || [])
        .filter(p => p.siswaId === currentUser.id)
        .sort((a, b) => (b.tanggalKejadian || '').localeCompare(a.tanggalKejadian || ''));

    if (myPelanggaran.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 bg-tertiary rounded-lg border border-main">
                <i class="fas fa-shield-alt text-5xl text-green-500 mb-4"></i>
                <h3 class="text-xl font-semibold text-main uppercase">Anda tidak memiliki catatan pelanggaran.</h3>
                <p class="text-subtle mt-2">Tingkatkan kedisiplinan dan patuhi peraturan Siswa Pusdik Polair. Terima Kasih.</p>
            </div>
        `;
    } else {
        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-subtle uppercase bg-tertiary">
                        <tr>
                            <th class="p-3">NO</th>
                            <th class="p-3">TANGGAL</th>
                            <th class="p-3">JENIS PELANGGARAN</th>
                            <th class="p-3">URAIAN</th>
                            <th class="p-3">SANKSI</th>
                            <th class="p-3">DICATAT OLEH</th>
                            <th class="p-3">DOKUMENTASI</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        myPelanggaran.forEach((item, index) => {
            const dokumentasiHtml = item.fotoUrl
                ? `<a href="${item.fotoUrl}" target="_blank" class="text-blue-500 hover:underline">Lihat Foto</a>`
                : '-';
            tableHTML += `
                <tr class="border-b border-main">
                    <td class="p-3">${index + 1}</td>
                    <td class="p-3">${formatDate(item.tanggalKejadian)}</td>
                    <td class="p-3 uppercase">${item.jenisPelanggaran}</td>
                    <td class="p-3 uppercase">${item.uraian || '-'}</td>
                    <td class="p-3 uppercase">${item.tindakan || '-'}</td>
                    <td class="p-3 uppercase">${item.pembina || '-'}</td>
                    <td class="p-3">${dokumentasiHtml}</td>
                </tr>
            `;
        });
        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = tableHTML;
    }
};

// ======================================================
// --- FUNGSI UNTUK TAMPILAN ADMIN/GADIK ---
// ======================================================

// [FUNGSI PAGINATION MAIN VIEW - SESUAI STRUKTUR TA.JS]
const renderMainPaginationControls = (tableBodyId, tabId, totalPages, totalItems) => {
    const paginationContainer = document.getElementById(`pagination-pelanggaran-${tabId}`);
    if (!paginationContainer) return;
    
    let currentPage = mainViewCurrentPages[tableBodyId];
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * MAIN_VIEW_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + MAIN_VIEW_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} data
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-main-page-${tabId}" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-main-page-${tabId}" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById(`prev-main-page-${tabId}`);
    const nextButton = document.getElementById(`next-main-page-${tabId}`);

    if (prevButton) {
        prevButton.disabled = (currentPage === 1);
        // Hapus listener lama (cloning element) untuk mencegah double event
        const newPrev = prevButton.cloneNode(true);
        prevButton.parentNode.replaceChild(newPrev, prevButton);
        
        newPrev.addEventListener('click', () => {
            if (mainViewCurrentPages[tableBodyId] > 1) {
                mainViewCurrentPages[tableBodyId]--;
                renderMainView();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (currentPage >= totalPages);
        const newNext = nextButton.cloneNode(true);
        nextButton.parentNode.replaceChild(newNext, nextButton);

        newNext.addEventListener('click', () => {
            if (mainViewCurrentPages[tableBodyId] < totalPages) {
                mainViewCurrentPages[tableBodyId]++;
                renderMainView();
            }
        });
    }
};

const renderMainView = () => {
    const allPendidikan = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ ...p, tahun: ta.tahun, isActive: ta.isActive }))
    );

    const renderCategoryTable = (kategoriNamaDB, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
        // Extract tabId dari tableBodyId (misal: 'pelanggaran-dikbagum-sbp-table-body' -> 'dikbagum-sbp')
        const tabId = tableBodyId.replace('pelanggaran-', '').replace('-table-body', '');
        
        // [PENTING] Filter menggunakan Nama Kategori Panjang (Sesuai DB)
        const pendidikanGroups = allPendidikan
            .filter(p => p.jenis.toUpperCase() === kategoriNamaDB.toUpperCase())
            .sort((a, b) => b.isActive - a.isActive || b.tahun - a.tahun); 
        
        // Logika Pagination
        const totalItems = pendidikanGroups.length;
        const totalPages = Math.ceil(totalItems / MAIN_VIEW_ROWS_PER_PAGE);
        let currentPage = mainViewCurrentPages[tableBodyId] || 1;
        currentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
        mainViewCurrentPages[tableBodyId] = currentPage;
        
        const startIndex = (currentPage - 1) * MAIN_VIEW_ROWS_PER_PAGE;
        const paginatedGroups = pendidikanGroups.slice(startIndex, startIndex + MAIN_VIEW_ROWS_PER_PAGE);
        
        tableBody.innerHTML = '';
        if (paginatedGroups.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-subtle">Tidak ada data.</td></tr>`;
            renderMainPaginationControls(tableBodyId, tabId, 0, 0); 
            return;
        }

        paginatedGroups.forEach((p, index) => {
            // Hitung Pelanggaran untuk indikator visual
            const pelanggaranCount = localPelanggaran.filter(pel => {
                const siswa = localStudents.find(s => s.id === pel.siswaId);
                return siswa && 
                       siswa.kategori === p.jenis && 
                       normalizeDetail(siswa.detailPendidikan) === normalizeDetail(p.detail) && 
                       siswa.tahunAjaran === p.tahun;
            }).length;

            const row = document.createElement('tr');
            row.className = 'border-b border-main';
            const isDisabled = !p.isActive;
            const buttonClass = isDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700';
            const buttonTitle = isDisabled ? 'Aktifkan Tahun Ajaran terlebih dahulu' : 'Lihat Catatan Pelanggaran';

            // Nama tampilan (jika detail '-', hanya tampilkan jenis)
            let displayName = p.detail === '-' ? p.jenis : `${p.jenis} ${p.detail}`;

            row.innerHTML = `
                <td class="p-3 text-center">${startIndex + index + 1}</td>
                <td class="p-3 font-medium uppercase">
                    ${displayName} (TA ${p.tahun})
                    ${pelanggaranCount > 0 ? `<br><span class="text-xs text-red-500 font-bold"><i class="fas fa-exclamation-circle"></i> ${pelanggaranCount} Kasus</span>` : ''}
                </td>
                <td class="p-3 text-center">
                    <button class="text-white text-xs py-1 px-3 rounded-md ${buttonClass} btn-view-pelanggaran-group" 
                            data-kategori="${p.jenis}" 
                            data-detail="${p.detail}" 
                            data-tahun="${p.tahun}"
                            title="${buttonTitle}"
                            ${isDisabled ? 'disabled' : ''}
                            >
                        LIHAT
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        renderMainPaginationControls(tableBodyId, tabId, totalPages, totalItems); 
    };

    renderCategoryTable('DIKTUK TAMTAMA', 'pelanggaran-diktuk-tamtama-table-body');
    renderCategoryTable('DIKTUK BINTARA', 'pelanggaran-diktuk-bintara-table-body');
    renderCategoryTable('DIKBANGSPES', 'pelanggaran-dikbangspes-table-body');
    
    // [UPDATE FINAL] Parameter 1: Nama Kategori DB (Panjang), Parameter 2: ID Tabel HTML (Pendek)
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'pelanggaran-dikbagum-sbp-table-body');
};

const renderPelanggaranTable = () => {
    const tableBody = document.getElementById('pelanggaran-table-body');
    const paginationContainer = document.getElementById('pelanggaran-pagination');
    if (!tableBody || !paginationContainer) return;

    const { kategori, detail, tahun } = selectedFilters;
    const studentIdsInClass = localStudents
        .filter(s => 
            s.kategori === kategori && 
            normalizeDetail(s.detailPendidikan) === normalizeDetail(detail) && 
            s.tahunAjaran === parseInt(tahun)
        )
        .map(s => s.id);
        
    const filteredData = (localPelanggaran || [])
        .filter(p => studentIdsInClass.includes(p.siswaId))
        .sort((a, b) => (b.tanggalKejadian || '').localeCompare(a.tanggalKejadian || ''));

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE);
    currentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);

    tableBody.innerHTML = '';
    if (paginatedData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-subtle">Belum ada data pelanggaran untuk kelompok ini.</td></tr>`;
        renderPaginationControls(0, 1, 0); // Render pagination kosong
        return;
    }

    paginatedData.forEach((item, index) => {
        const siswa = localStudents.find(s => s.id === item.siswaId) || {};
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        const dokumentasiHtml = item.fotoUrl 
            ? `<a href="${item.fotoUrl}" target="_blank" class="text-blue-500 hover:underline flex items-center justify-center gap-1"><i class="fas fa-image"></i> Lihat</a>` 
            : '-';
        
        row.innerHTML = `
            <td class="p-3 sticky left-0 bg-card z-10">${startIndex + index + 1}</td>
            <td class="p-3 font-medium uppercase sticky left-12 bg-card z-10 min-w-[200px]">${siswa.nama || 'Siswa Dihapus'}</td>
            <td class="p-3">${formatDate(item.tanggalKejadian)}</td>
            <td class="p-3 uppercase">${item.jenisPelanggaran}</td>
            <td class="p-3 uppercase">${item.tindakan}</td>
            <td class="p-3 uppercase">${item.pembina}</td>
            <td class="p-3 text-center">${dokumentasiHtml}</td>
            <td class="p-3 text-center whitespace-nowrap">
                <button class="text-blue-500 hover:underline btn-edit-pelanggaran" data-id="${item.id}" data-permission-action="update_pelanggaran_siswa">EDIT</button>
                <button class="text-red-500 hover:underline ml-4 btn-hapus-pelanggaran" data-id="${item.id}" data-permission-action="delete_pelanggaran_siswa">HAPUS</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    renderPaginationControls(totalPages, currentPage, totalItems);
};

const renderPaginationControls = (totalPages, page, totalItems) => {
    const paginationContainer = document.getElementById('pelanggaran-pagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1 && totalItems > 0) {
        // Tampilkan info saja jika cuma 1 halaman
        paginationContainer.innerHTML = `<span class="text-sm text-subtle">Menampilkan ${totalItems} dari ${totalItems} catatan</span>`;
        return;
    } else if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (page - 1) * ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} catatan
        </span>
        <div class="inline-flex mt-2 xs:mt-0">
            <button id="prev-pelanggaran-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                Sebelumnya
            </button>
            <button id="next-pelanggaran-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                Selanjutnya
            </button>
        </div>
    `;
    paginationContainer.innerHTML = paginationHTML;

    // Re-attach listeners with cloneNode to prevent stacking
    const prevButton = document.getElementById('prev-pelanggaran-page');
    const nextButton = document.getElementById('next-pelanggaran-page');

    if (prevButton) {
        prevButton.disabled = (page === 1);
        const newPrev = prevButton.cloneNode(true);
        prevButton.parentNode.replaceChild(newPrev, prevButton);
        newPrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPelanggaranTable();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (page >= totalPages);
        const newNext = nextButton.cloneNode(true);
        nextButton.parentNode.replaceChild(newNext, nextButton);
        newNext.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPelanggaranTable();
            }
        });
    }
};

const openPelanggaranModal = (pelanggaranId = null) => {
    const form = document.getElementById('pelanggaran-form');
    if (!form) return;
    form.reset();
    const modalTitle = document.getElementById('pelanggaran-modal-title');
    const siswaSelect = document.getElementById('pelanggaran-siswa-id');
    const fotoPreview = document.getElementById('pelanggaran-foto-preview');
    const { kategori, detail, tahun } = selectedFilters;
    
    const studentsInClass = localStudents.filter(s => 
        s.kategori === kategori && 
        normalizeDetail(s.detailPendidikan) === normalizeDetail(detail) && 
        s.tahunAjaran === parseInt(tahun)
    );
    
    siswaSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    studentsInClass.sort((a,b) => a.nama.localeCompare(b.nama)).forEach(siswa => {
        siswaSelect.innerHTML += `<option value="${siswa.id}">${siswa.nama.toUpperCase()} (${siswa.nosis})</option>`;
    });

    fotoPreview.src = 'https://placehold.co/400x200/374151/9ca3af?text=Pratinjau+Foto';

    if (pelanggaranId) {
        modalTitle.textContent = 'EDIT CATATAN PELANGGARAN';
        const item = localPelanggaran.find(p => p.id === pelanggaranId);
        document.getElementById('pelanggaran-id').value = item.id;
        siswaSelect.value = item.siswaId;
        document.getElementById('pelanggaran-tanggal').value = item.tanggalKejadian;
        document.getElementById('pelanggaran-jenis').value = item.jenisPelanggaran;
        document.getElementById('pelanggaran-kategori').value = item.kategoriPelanggaran;
        document.getElementById('pelanggaran-uraian').value = item.uraian;
        document.getElementById('pelanggaran-tindakan').value = item.tindakan;
        document.getElementById('pelanggaran-pembina').value = item.pembina;
        if (item.fotoUrl) fotoPreview.src = item.fotoUrl;
        updateSiswaInfo(item.siswaId);
    } else {
        modalTitle.textContent = 'TAMBAH CATATAN PELANGGARAN';
        document.getElementById('pelanggaran-id').value = '';
        const pembinaInput = document.getElementById('pelanggaran-pembina');
        if (pembinaInput) pembinaInput.value = currentUser.nama.toUpperCase() || '';
        updateSiswaInfo(null);
    }
    openModal('pelanggaran-modal');
};

const updateSiswaInfo = (siswaId) => {
    const siswa = localStudents.find(s => s.id === siswaId);
    if (siswa) {
        document.getElementById('info-pangkat').textContent = (siswa.pangkat || '-').toUpperCase();
        document.getElementById('info-nrp-nosis').textContent = `${siswa.nrp || '-'} / ${siswa.nosis || '-'}`;
        document.getElementById('info-kelas').textContent = `${siswa.kategori || ''} ${siswa.detailPendidikan || ''} (TA ${siswa.tahunAjaran || ''})`.toUpperCase();
    } else {
        document.getElementById('info-pangkat').textContent = '...';
        document.getElementById('info-nrp-nosis').textContent = '...';
        document.getElementById('info-kelas').textContent = '...';
    }
};

const handlePelanggaranFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan...');
    const id = document.getElementById('pelanggaran-id').value;
    let fotoUrl = document.getElementById('pelanggaran-foto-preview').src;
    const fotoFile = document.getElementById('pelanggaran-foto').files[0];

    try {
        if (fotoFile) {
            if (!window.imageCompression) {
                throw new Error('Image compression library is not loaded.');
            }
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280 };
            const compressedFile = await imageCompression(fotoFile, options);
            const formData = new FormData();
            formData.append('fotoSiswa', compressedFile, compressedFile.name); // Sesuaikan dengan backend (upload.php)
            formData.append('subfolder', 'pelanggaran'); // Folder khusus
            formData.append('api_key', UPLOAD_SECRET); // Tambah API Key

            const response = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                fotoUrl = result.url;
            } else {
                throw new Error(result.message);
            }
        } else if (fotoUrl.includes('placehold.co')) {
            fotoUrl = ''; 
        }

        const data = {
            siswaId: document.getElementById('pelanggaran-siswa-id').value,
            tanggalKejadian: document.getElementById('pelanggaran-tanggal').value,
            jenisPelanggaran: document.getElementById('pelanggaran-jenis').value,
            kategoriPelanggaran: document.getElementById('pelanggaran-kategori').value,
            uraian: document.getElementById('pelanggaran-uraian').value,
            tindakan: document.getElementById('pelanggaran-tindakan').value,
            pembina: document.getElementById('pelanggaran-pembina').value,
            fotoUrl: fotoUrl,
        };
        if (!data.siswaId || !data.tanggalKejadian || !data.jenisPelanggaran) {
            alert('Siswa, Tanggal, dan Jenis Pelanggaran wajib diisi.');
            hideLoading();
            return;
        }

        if (id) {
            await updatePelanggaran(id, data);
            alert('Catatan pelanggaran berhasil diperbarui.');
        } else {
            data.dicatatOleh = currentUser.id;
            data.dicatatPada = new Date();
            await addPelanggaran(data);
            alert('Catatan pelanggaran berhasil disimpan.');
        }
        closeModal('pelanggaran-modal');
        
        // Refresh list if currently viewing list
        if(currentView === 'list') renderPelanggaranTable();
        
    } catch (error) {
        console.error("Gagal menyimpan pelanggaran:", error);
        alert('Gagal menyimpan data: ' + error.message);
    } finally {
        hideLoading();
    }
};

const renderAdminView = () => {
    mainView.classList.toggle('hidden', currentView !== 'main');
    listView.classList.toggle('hidden', currentView !== 'list');
    backButton.classList.toggle('hidden', currentView === 'main');
    if (subtitleElement) subtitleElement.innerHTML = ''; 

    if (currentView === 'main') {
        viewTitle.textContent = 'CATATAN PELANGGARAN SISWA';
        renderMainView();
    } else {
        const { kategori, detail, tahun } = selectedFilters;
        
        let displayDetail = detail;
        if (displayDetail === '-' || !displayDetail) displayDetail = '';
        else displayDetail = ` ${displayDetail}`;

        viewTitle.textContent = `CATATAN PELANGGARAN SISWA: ${kategori}${displayDetail} (TA ${tahun})`.toUpperCase();

        if (subtitleElement) {
            const tahunAjaranData = localTahunAjaran.find(ta => 
                ta.tahun === parseInt(tahun) && 
                ta.pendidikan.some(p => p.jenis === kategori && normalizeDetail(p.detail) === normalizeDetail(detail))
            );
            const studentCount = localStudents.filter(s => 
                s.kategori === kategori && 
                normalizeDetail(s.detailPendidikan) === normalizeDetail(detail) && 
                s.tahunAjaran === parseInt(tahun)
            ).length;
            
            subtitleElement.innerHTML = `
                JUMLAH SISWA: ${studentCount} &nbsp; | &nbsp;
                TANGGAL MULAI DIK: ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
                TANGGAL SELESAI DIK: ${formatDate(tahunAjaranData?.tanggalBerakhir)}
            `;
        }
        currentPage = 1; 
        renderPelanggaranTable();
    }
};

export const initPelanggaranSiswaModule = async (appState) => {
    const section = document.getElementById('pelanggaran-siswa-section');
    if (!section) return;
    localPelanggaran = appState.pelanggaranSiswa || [];
    localStudents = appState.students || [];
    localTahunAjaran = appState.tahunAjaran || [];
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    if (currentUser.role === 'siswa') {
        if (!section.innerHTML.includes('pelanggaran-siswa-view-container')) {
             try {
                const response = await fetch('./components/pelanggaran_siswa_view.html');
                section.innerHTML = await response.text();
            } catch (error) { console.error("Gagal memuat tampilan pelanggaran siswa:", error); section.innerHTML = `<p class="text-red-500">Gagal memuat konten.</p>`; return; }
        }
        renderSiswaPelanggaranView();
    } else {
        if (!section.innerHTML.includes('pelanggaran-view-container')) {
            try {
                const response = await fetch('./components/pelanggaran_siswa_content.html');
                section.innerHTML = await response.text();
            } catch (error) { console.error("Gagal memuat konten admin pelanggaran:", error); return; }
        }
        if (!window.pelanggaranSiswaModuleInitialized) {
            mainView = document.getElementById('pelanggaran-main-view');
            listView = document.getElementById('pelanggaran-list-view');
            viewTitle = document.getElementById('pelanggaran-view-title');
            backButton = document.getElementById('btn-back-pelanggaran');
            subtitleElement = document.getElementById('pelanggaran-view-subtitle');
            
            const sectionContainer = document.getElementById('pelanggaran-siswa-section');
            if(sectionContainer) {
                sectionContainer.addEventListener('click', async (e) => {
                    const groupBtn = e.target.closest('.btn-view-pelanggaran-group');
                    const addBtn = e.target.closest('#btn-tambah-pelanggaran');
                    const editBtn = e.target.closest('.btn-edit-pelanggaran');
                    const deleteBtn = e.target.closest('.btn-hapus-pelanggaran');

                    if (groupBtn) { 
                        if (!groupBtn.disabled) {
                            currentView = 'list'; 
                            selectedFilters = { ...groupBtn.dataset }; 
                            renderAdminView(); 
                        }
                    }
                    if (addBtn) openPelanggaranModal();
                    if (editBtn) openPelanggaranModal(editBtn.dataset.id);
                    if (deleteBtn) {
                        const id = deleteBtn.dataset.id;
                        const item = localPelanggaran.find(p => p.id === id);
                        if (confirm(`Yakin ingin menghapus pelanggaran "${item.jenisPelanggaran}"?`)) {
                            showLoading('Menghapus...');
                            await deletePelanggaran(id);
                            hideLoading();
                        }
                    }
                });
            }
            if (backButton) {
                backButton.addEventListener('click', () => { currentView = 'main'; selectedFilters = {}; renderAdminView(); });
            }
            const form = document.getElementById('pelanggaran-form');
            if (form) form.addEventListener('submit', handlePelanggaranFormSubmit);
            const siswaSelect = document.getElementById('pelanggaran-siswa-id');
            if (siswaSelect) siswaSelect.addEventListener('change', (e) => updateSiswaInfo(e.target.value));
            document.querySelector('#pelanggaran-modal .btn-cancel-pelanggaran')?.addEventListener('click', () => closeModal('pelanggaran-modal'));
            
            const fotoInput = document.getElementById('pelanggaran-foto');
            const fotoPreview = document.getElementById('pelanggaran-foto-preview');
            if (fotoInput && fotoPreview) {
                fotoInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => { fotoPreview.src = event.target.result; };
                        reader.readAsDataURL(file);
                    }
                });
            }
            window.pelanggaranSiswaModuleInitialized = true;
        }
        renderAdminView();
    }
};