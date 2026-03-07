// public/js/modules/e_album.js

// --- State Management ---
let localStudents = [];
let localTahunAjaran = [];
let currentUser = {};

let allSiswaAngkatan = []; // Master list untuk grid
let filteredSiswa = [];     // List setelah search/filter
let currentPage = 1;
const itemsPerPage = 10;    // Pagination untuk Grid Album

// Pagination untuk Tampilan Utama Admin
const MAIN_VIEW_ROWS_PER_PAGE = 5;
let mainViewCurrentPages = {
    'e-album-diktuk-tamtama-table-body': 1,
    'e-album-diktuk-bintara-table-body': 1,
    'e-album-dikbangspes-table-body': 1,
    'e-album-dikbagum-sbp-table-body': 1 
};
let selectedClass = {};

// --- DOM Elements ---
let grid, noData, searchInput, paginationContainer, titleElement, subtitleElement;
let mainView, gridView, backButton, eAlbumHeader;

// --- Callbacks ---
let openDetailModal = null; // Callback untuk buka modal

// --- Konstanta Placeholder Foto ---
const PLACEHOLDER_FOTO_URL = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';

// --- Styles ---
const GRID_BASE_STYLE = "py-2 px-3 sm:px-4 rounded-lg transition-colors duration-200 text-sm font-medium";
const GRID_NORMAL_STYLE = "bg-card text-main border border-border hover:bg-tertiary";
const GRID_ACTIVE_STYLE = "bg-primary text-white border border-primary";
const GRID_DISABLED_STYLE = "bg-card text-subtle opacity-50 cursor-not-allowed border border-border";

// ==========================================================================
// FUNGSI UTAMA: RENDER HALAMAN & NAVIGASI
// ==========================================================================

function displayPage(page) {
    currentPage = page;
    const query = searchInput.value.toLowerCase();
    
    // Filter berdasarkan pencarian
    filteredSiswa = query 
        ? allSiswaAngkatan.filter(s => s.dataSearchable.includes(query))
        : [...allSiswaAngkatan];

    // Tampilkan pesan jika tidak ada data
    if (filteredSiswa.length === 0) {
        grid.innerHTML = ''; 
        noData.classList.remove('hidden');
        noData.querySelector('p').textContent = query ? "Tidak ada siswa yang cocok dengan pencarian." : "Album tidak ditemukan untuk angkatan Anda.";
        renderGridPagination(); 
        return;
    }

    noData.classList.add('hidden');

    // Hitung index untuk pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredSiswa.slice(startIndex, endIndex);

    renderCards(pageItems);
    renderGridPagination();
}

function renderCards(siswaList) {
    if (!grid) return;

    let cardsHtml = '';
    siswaList.forEach(siswa => {
        const fotoUrl = siswa.fotoUrl || PLACEHOLDER_FOTO_URL;
        const nama = siswa.nama || 'Nama Siswa';
        const nosis = siswa.nosis || 'Nosis';
        const pangkat = siswa.pangkat || 'Siswa';

        // Tautan Medsos
        const igLink = siswa.instagram 
            ? `<a href="https://instagram.com/${siswa.instagram}" target="_blank" class="text-subtle hover:text-pink-500 transition-colors">
                 <i class="fab fa-instagram fa-lg"></i>
               </a>` 
            : '';
        const fbLink = siswa.facebook 
            ? `<a href="https://facebook.com/${siswa.facebook}" target="_blank" class="text-subtle hover:text-blue-600 transition-colors">
                 <i class="fab fa-facebook fa-lg"></i>
               </a>` 
            : '';
        const tkLink = siswa.tiktok 
            ? `<a href="https://tiktok.com/@${siswa.tiktok}" target="_blank" class="text-subtle hover:text-black dark:hover:text-white transition-colors">
                 <i class="fab fa-tiktok fa-lg"></i>
               </a>` 
            : '';
        const hasSocialMedia = igLink || fbLink || tkLink;

        cardsHtml += `
            <div class="e-album-card bg-card/70 backdrop-blur-sm border border-border/50 rounded-2xl shadow-lg overflow-hidden 
                        transition-all duration-300 transform hover:shadow-2xl hover:-translate-y-2 cursor-pointer 
                        flex flex-col items-center text-center p-4"
                 data-id="${siswa.id}">
                
                <div class="w-24 h-24 rounded-full overflow-hidden shadow-md mb-4 border-2 border-border/50">
                    <img class="w-full h-full object-cover object-center" 
                         src="${fotoUrl}" 
                         alt="Foto ${nama}" 
                         onerror="this.onerror=null;this.src='${PLACEHOLDER_FOTO_URL}';">
                </div>
                
                <div class="flex-grow w-full mb-3">
                    <h3 class="font-bold text-main text-sm md:text-base truncate" title="${nama}">${nama}</h3>
                    <p class="text-xs text-subtle truncate">${pangkat}</p>
                    <p class="text-xs text-subtle truncate">Nosis: ${nosis}</p>
                </div>

                ${hasSocialMedia ? `
                    <div class="flex-shrink-0 w-full pt-3 border-t border-border/50">
                        <div class="flex justify-center items-center space-x-4">
                            ${igLink}
                            ${fbLink}
                            ${tkLink}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    grid.innerHTML = cardsHtml;
}

function renderGridPagination() {
    if (!paginationContainer) return;

    const totalItems = filteredSiswa.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHtml = '<nav class="flex justify-center items-center space-x-1 sm:space-x-2">';

    // Tombol Prev
    const isFirstPage = currentPage === 1;
    paginationHtml += `
        <a href="#" data-page="${currentPage - 1}" 
           class="page-link-grid ${GRID_BASE_STYLE} ${isFirstPage ? GRID_DISABLED_STYLE : GRID_NORMAL_STYLE}">
           Prev
        </a>`;
    
    // Logika angka pagination (Ellipsis)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        paginationHtml += `<a href="#" data-page="1" class="page-link-grid ${GRID_BASE_STYLE} ${GRID_NORMAL_STYLE}">1</a>`;
        if (startPage > 2) {
            paginationHtml += `<span class="${GRID_BASE_STYLE} text-subtle">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <a href="#" data-page="${i}" 
               class="page-link-grid ${GRID_BASE_STYLE} ${i === currentPage ? GRID_ACTIVE_STYLE : GRID_NORMAL_STYLE}">
               ${i}
            </a>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `<span class="${GRID_BASE_STYLE} text-subtle">...</span>`;
        }
        paginationHtml += `<a href="#" data-page="${totalPages}" class="page-link-grid ${GRID_BASE_STYLE} ${GRID_NORMAL_STYLE}">${totalPages}</a>`;
    }

    // Tombol Next
    const isLastPage = currentPage === totalPages;
    paginationHtml += `
        <a href="#" data-page="${currentPage + 1}" 
           class="page-link-grid ${GRID_BASE_STYLE} ${isLastPage ? GRID_DISABLED_STYLE : GRID_NORMAL_STYLE}">
           Next
        </a>`;

    paginationHtml += '</nav>';
    paginationContainer.innerHTML = paginationHtml;
}

// Handler klik pagination Grid
function handleGridPaginationClick(e) {
    e.preventDefault();
    const link = e.target.closest('.page-link-grid');
    
    if (!link || link.classList.contains(GRID_DISABLED_STYLE)) return;

    const page = parseInt(link.dataset.page, 10);
    if (isNaN(page) || page === currentPage) return;

    displayPage(page);
}

function handleSearch() {
    displayPage(1); // Reset ke halaman 1 saat mencari
}

function handleGridClick(e) {
    const card = e.target.closest('.e-album-card');
    if (!card) return; 

    const siswaId = card.dataset.id;
    const siswaData = allSiswaAngkatan.find(s => s.id === siswaId);
    
    if (siswaData && typeof openDetailModal === 'function') {
        openDetailModal(siswaData);
    } else {
        console.error('Fungsi modal tidak ditemukan atau data siswa tidak ada.');
        alert('Gagal memuat detail siswa.');
    }
}

// ==========================================================================
// FUNGSI ADMIN: TABS & TABEL UTAMA
// ==========================================================================

const switchAdminTab = (activeTab) => {
    sessionStorage.setItem('lastActiveEAlbumTab', activeTab);
    const slider = document.getElementById('e-album-tab-slider');
    const allTabs = document.querySelectorAll('#e-album-main-view .ta-tab-btn');
    const activeButton = document.querySelector(`#e-album-main-view .ta-tab-btn[data-tab='${activeTab}']`);
    
    document.querySelectorAll('#e-album-main-view .ta-tab-content').forEach(panel => {
        panel.classList.add('hidden');
    });

    if (slider && activeButton) {
        slider.style.width = `${activeButton.offsetWidth}px`;
        slider.style.transform = `translateX(${activeButton.offsetLeft}px)`;
        allTabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });
    }

    const activePanel = document.getElementById(`e-album-tab-content-${activeTab}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }
};

const renderMainPaginationControls = (tableBodyId, tabId, totalPages, totalItems) => {
    const paginationContainer = document.getElementById(`pagination-e-album-${tabId}`);
    if (!paginationContainer) return;

    let currentPage = mainViewCurrentPages[tableBodyId] || 1;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * MAIN_VIEW_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + MAIN_VIEW_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `<span class="text-sm text-subtle">Menampilkan ${startItem} - ${endItem} dari ${totalItems} data</span>`;

    if (totalPages > 1) {
        const baseStyle = "page-link-main flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed";
        const normalStyle = "rounded";
        const activeStyle = "rounded bg-blue-600 text-white hover:bg-blue-700";
        const disabledStyle = "opacity-50 cursor-not-allowed";

        let numbersHtml = '';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
            numbersHtml += `<button class="${baseStyle} ${normalStyle}" data-page="1" data-table-id="${tableBodyId}">1</button>`;
            if (startPage > 2) {
                numbersHtml += `<span class="flex items-center justify-center px-3 h-8 text-sm font-medium text-subtle">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            numbersHtml += `<button class="${baseStyle} ${i === currentPage ? activeStyle : normalStyle}" data-page="${i}" data-table-id="${tableBodyId}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                numbersHtml += `<span class="flex items-center justify-center px-3 h-8 text-sm font-medium text-subtle">...</span>`;
            }
            numbersHtml += `<button class="${baseStyle} ${normalStyle}" data-page="${totalPages}" data-table-id="${tableBodyId}">${totalPages}</button>`;
        }

        paginationHTML += `
            <div class="inline-flex items-center mt-2 xs:mt-0 space-x-1">
                <button class="${baseStyle} rounded-l ${currentPage === 1 ? disabledStyle : ''} page-link-main" 
                        data-page="${currentPage - 1}" 
                        data-table-id="${tableBodyId}" 
                        ${currentPage === 1 ? 'disabled' : ''}>
                    Sebelumnya
                </button>
                ${numbersHtml}
                <button class="${baseStyle} rounded-r ${currentPage >= totalPages ? disabledStyle : ''} page-link-main" 
                        data-page="${currentPage + 1}" 
                        data-table-id="${tableBodyId}" 
                        ${currentPage >= totalPages ? 'disabled' : ''}>
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;
};

const renderAdminMainViewTables = () => {
    const allPendidikan = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ ...p, tahun: ta.tahun, isActive: ta.isActive }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
        const tabId = tableBodyId.replace('e-album-', '').replace('-table-body', '');
        
        const pendidikanGroups = allPendidikan
            .filter(p => p.jenis.toUpperCase() === kategori.toUpperCase())
            .sort((a, b) => (b.isActive - a.isActive) || (b.tahun - a.tahun)); 
        
        const totalItems = pendidikanGroups.length;
        const totalPages = Math.ceil(totalItems / MAIN_VIEW_ROWS_PER_PAGE);
        let currentPage = mainViewCurrentPages[tableBodyId] || 1;
        currentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
        mainViewCurrentPages[tableBodyId] = currentPage;
        
        const startIndex = (currentPage - 1) * MAIN_VIEW_ROWS_PER_PAGE;
        const paginatedGroups = pendidikanGroups.slice(startIndex, startIndex + MAIN_VIEW_ROWS_PER_PAGE);
        
        tableBody.innerHTML = '';
        if (paginatedGroups.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-subtle">Tidak ada data.</td></tr>`;
            renderMainPaginationControls(tableBodyId, tabId, 0, 0);
            return;
        }

        paginatedGroups.forEach((p, index) => {
            const jumlahSiswa = localStudents.filter(s =>
                s.kategori === p.jenis &&
                s.detailPendidikan === p.detail &&
                s.tahunAjaran === p.tahun
            ).length;

            const statusText = p.isActive ? 'Aktif' : 'Arsip';
            const statusClass = p.isActive ? 'bg-green-500' : 'bg-red-500'; 
            
            const buttonClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700';
            const buttonTitle = 'Lihat Album';

            let displayName = p.detail === '-' ? p.jenis : `${p.jenis} ${p.detail}`;

            const row = document.createElement('tr');
            row.className = 'border-b border-main';
            row.innerHTML = `
                <td class="p-3 text-center">${startIndex + index + 1}</td>
                <td class="p-3 font-medium uppercase">${displayName} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${jumlahSiswa}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 text-xs rounded-full text-white ${statusClass}">${statusText}</span></td>
                <td class="p-3 text-center">
                    <button class="text-white text-xs py-1 px-3 rounded-md ${buttonClass} btn-view-e-album-group" 
                            data-kategori="${p.jenis}" 
                            data-detail="${p.detail}" 
                            data-tahun="${p.tahun}"
                            title="${buttonTitle}">
                        Lihat Album
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        renderMainPaginationControls(tableBodyId, tabId, totalPages, totalItems);
    };

    // Render tabel per kategori
    renderCategoryTable('DIKTUK TAMTAMA', 'e-album-diktuk-tamtama-table-body');
    renderCategoryTable('DIKTUK BINTARA', 'e-album-diktuk-bintara-table-body');
    renderCategoryTable('DIKBANGSPES', 'e-album-dikbangspes-table-body');
    // Tambahkan tabel SBP
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'e-album-dikbagum-sbp-table-body');
};

// ==========================================================================
// INISIALISASI MODUL & VIEW SISWA/ALUMNI
// ==========================================================================

export function initEAlbumModule(AppState, openSiswaDetailModalFromData) {
    grid = document.getElementById('e-album-grid');
    noData = document.getElementById('e-album-no-data');
    searchInput = document.getElementById('e-album-search');
    paginationContainer = document.getElementById('e-album-pagination');
    titleElement = document.getElementById('e-album-title');
    subtitleElement = document.getElementById('e-album-subtitle');
    mainView = document.getElementById('e-album-main-view');
    gridView = document.getElementById('e-album-grid-view');
    backButton = document.getElementById('btn-back-e-album');
    eAlbumHeader = document.getElementById('e-album-header');
    
    openDetailModal = openSiswaDetailModalFromData;

    // --- [UPDATE] AMBIL USER DENGAN NORMALISASI ALUMNI ---
    let rawUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    
    if (rawUser && rawUser.role === 'alumni' && rawUser.studentData) {
        currentUser = {
            ...rawUser.studentData, // Ambil data siswa (nama, kategori, dll)
            role: 'alumni',         // Pastikan role tetap alumni
            uid: rawUser.uid        // ID dokumen
        };
    } else {
        currentUser = rawUser;
    }

    localStudents = AppState.students || [];
    localTahunAjaran = AppState.tahunAjaran || [];

    if (!grid || !noData || !searchInput || !paginationContainer || !titleElement || !mainView || !gridView || !backButton) {
        // console.error("Elemen E-Album tidak ditemukan dalam DOM.");
        return;
    }

    // [UPDATE] Logika Akses Role
    if (currentUser.role === 'siswa' || currentUser.role === 'alumni') {
        initSiswaView();
    } else if (currentUser.role === 'super_admin' || currentUser.role === 'operator') {
        initAdminView();
    } else {
        // Fallback untuk role lain (Gadik/Danton) jika tidak punya akses
        mainView.innerHTML = '<p class="text-subtle text-center p-4">Anda tidak memiliki akses ke modul ini.</p>';
        gridView.classList.add('hidden');
    }
}

function initSiswaView() {
    mainView.classList.add('hidden');
    gridView.classList.remove('hidden');
    backButton.classList.add('hidden');
    
    // [UPDATE] Cari data siswa di localStudents
    let currentUserSiswa = localStudents.find(s => s.id === currentUser.id);

    // [UPDATE] Fallback: Jika tidak ada di localStudents, gunakan currentUser (Alumni)
    if (!currentUserSiswa && currentUser.role === 'alumni') {
        currentUserSiswa = currentUser;
    }

    if (!currentUserSiswa) {
        noData.classList.remove('hidden');
        noData.querySelector('p').textContent = "Data profil siswa tidak ditemukan.";
        return;
    }

    const pendidikanDetail = `${currentUserSiswa.kategori || ''} ${currentUserSiswa.detailPendidikan || ''}`.trim();
    const tahun = currentUserSiswa.tahunAjaran;
    titleElement.textContent = `E-Album ${pendidikanDetail || 'Angkatan'}`;
    subtitleElement.textContent = `Tahun Ajaran ${tahun || 'N/A'}`;

    // Filter teman seangkatan
    allSiswaAngkatan = localStudents.filter(s => 
        s.tahunAjaran === currentUserSiswa.tahunAjaran && 
        s.kategori === currentUserSiswa.kategori &&
        s.detailPendidikan === currentUserSiswa.detailPendidikan
    ).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    
    // Jika alumni dan list kosong (karena keamanan database), tampilkan diri sendiri saja
    if (allSiswaAngkatan.length === 0 && currentUser.role === 'alumni') {
        allSiswaAngkatan = [currentUserSiswa];
    }

    // Siapkan data pencarian
    allSiswaAngkatan.forEach(s => {
        s.dataSearchable = `${s.nama || ''} ${s.nosis || ''} ${s.pangkat || ''} ${s.ton || ''}`.toLowerCase();
    });

    filteredSiswa = [...allSiswaAngkatan]; 

    // Setup Listeners
    searchInput.removeEventListener('input', handleSearch); // Hapus listener lama untuk mencegah duplikasi
    searchInput.addEventListener('input', handleSearch);
    
    paginationContainer.removeEventListener('click', handleGridPaginationClick);
    paginationContainer.addEventListener('click', handleGridPaginationClick);
    
    grid.removeEventListener('click', handleGridClick);
    grid.addEventListener('click', handleGridClick);

    displayPage(1);
}

function initAdminView() {
    mainView.classList.remove('hidden');
    gridView.classList.add('hidden');
    backButton.classList.add('hidden');
    titleElement.textContent = 'E-Album Angkatan';
    subtitleElement.textContent = 'Pilih kategori pendidikan untuk melihat album.';

    // Setup Tab Switcher (Diktuk/Dikbangspes/SBP)
    document.querySelectorAll('#e-album-main-view .ta-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
    });

    // Delegasi Event untuk Tabel Utama
    mainView.removeEventListener('click', handleMainViewClick);
    mainView.addEventListener('click', handleMainViewClick);

    searchInput.removeEventListener('input', handleSearch);
    searchInput.addEventListener('input', handleSearch);
    
    paginationContainer.removeEventListener('click', handleGridPaginationClick);
    paginationContainer.addEventListener('click', handleGridPaginationClick);
    
    grid.removeEventListener('click', handleGridClick);
    grid.addEventListener('click', handleGridClick);

    backButton.addEventListener('click', () => {
        mainView.classList.remove('hidden');
        gridView.classList.add('hidden');
        backButton.classList.add('hidden');
        
        titleElement.textContent = 'E-Album Angkatan';
        subtitleElement.textContent = 'Pilih kategori pendidikan untuk melihat album.';
        
        allSiswaAngkatan = [];
        filteredSiswa = [];
        searchInput.value = '';
    });

    renderAdminMainViewTables();
    
    requestAnimationFrame(() => {
        const lastTab = sessionStorage.getItem('lastActiveEAlbumTab');
        switchAdminTab(lastTab || 'dikbangspes');
    });
}

// Handler Terpisah untuk Main View (Admin)
function handleMainViewClick(e) {
    const groupBtn = e.target.closest('.btn-view-e-album-group');
    const pageLink = e.target.closest('.page-link-main'); 

    if (groupBtn && !groupBtn.disabled) {
        const { kategori, detail, tahun } = groupBtn.dataset;
        selectedClass = { kategori, detail, tahun: parseInt(tahun) };
        
        allSiswaAngkatan = localStudents.filter(s => 
            s.tahunAjaran === selectedClass.tahun && 
            s.kategori === selectedClass.kategori &&
            s.detailPendidikan === selectedClass.detail
        ).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        
        allSiswaAngkatan.forEach(s => {
            s.dataSearchable = `${s.nama || ''} ${s.nosis || ''} ${s.pangkat || ''} ${s.ton || ''}`.toLowerCase();
        });

        mainView.classList.add('hidden');
        gridView.classList.remove('hidden');
        backButton.classList.remove('hidden');
        titleElement.textContent = `Album: ${kategori} ${detail} (TA ${tahun})`;
        subtitleElement.textContent = `${allSiswaAngkatan.length} Siswa`;
        
        displayPage(1);
    }
    
    else if (pageLink && !pageLink.disabled) { 
        e.preventDefault();
        const newPage = parseInt(pageLink.dataset.page, 10);
        const tableId = pageLink.dataset.tableId;
        if (newPage && tableId) {
            mainViewCurrentPages[tableId] = newPage;
            renderAdminMainViewTables(); 
        }
    }
}