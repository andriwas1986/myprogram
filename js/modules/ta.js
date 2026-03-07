// js/modules/ta.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addTahunAjaran, updateTahunAjaran, deleteTahunAjaran } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localTahunAjaran = [];
let localStudents = [];
let localMapels = []; 
let currentUser = {};

// --- STATE UNTUK PAGINATION ---
let taCurrentPages = {
    'ta-diktuk-tamtama-table-body': 1,
    'ta-diktuk-bintara-table-body': 1,
    'ta-dikbangspes-table-body': 1,
    // [UPDATE] ID Table body disesuaikan dengan normalisasi nama baru
    'ta-dikbangum-sekolah-bintara-polisi-table-body': 1 
};
const TA_ROWS_PER_PAGE = 5; 

// --- ELEMEN-ELEMEN DOM ---
let taModal, taForm, btnTambahTA, activeYearDisplays;

// --- FUNGSI FORMAT TANGGAL ---
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`; 
};

/**
 * Mengatur tab mana yang aktif
 */
const switchTab = (activeTab) => {
    sessionStorage.setItem('lastActiveTaTab', activeTab);
    const slider = document.getElementById('ta-tab-slider');
    const allTabs = document.querySelectorAll('#master-ta-section .ta-tab-btn');
    const activeButton = document.querySelector(`#master-ta-section .ta-tab-btn[data-tab='${activeTab}']`);
    
    document.querySelectorAll('#master-ta-section .ta-tab-content').forEach(panel => {
        panel.classList.add('hidden');
    });

    if (slider && activeButton) {
        slider.style.width = `${activeButton.offsetWidth}px`;
        slider.style.transform = `translateX(${activeButton.offsetLeft}px)`;
        allTabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });
    }

    const activePanel = document.getElementById(`tab-content-${activeTab}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }
};

// --- RENDER PAGINATION ---
const renderTaPagination = (tableBodyId, tabId, totalPages, totalItems) => {
    const paginationContainer = document.getElementById(`pagination-${tabId}`);
    if (!paginationContainer) return;

    let currentPage = taCurrentPages[tableBodyId] || 1;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * TA_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + TA_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} data
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-ta-page-${tabId}" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-ta-page-${tabId}" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById(`prev-ta-page-${tabId}`);
    const nextButton = document.getElementById(`next-ta-page-${tabId}`);

    if (prevButton) {
        prevButton.disabled = (currentPage === 1);
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                taCurrentPages[tableBodyId]--;
                renderTahunAjaran(); 
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (currentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                taCurrentPages[tableBodyId]++;
                renderTahunAjaran(); 
            }
        });
    }
};

/**
 * Merender data Tahun Ajaran
 */
const renderTahunAjaran = () => {
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    const renderCategoryTable = (kategori) => {
        // [UPDATE] Logic normalisasi ID agar sesuai dengan 'ta-dikbangum-sekolah-bintara-polisi-table-body'
        const normalizedId = kategori.toLowerCase().replace(/ /g, '-');
        const tableBodyId = `ta-${normalizedId}-table-body`;
        const tabId = normalizedId; 
        
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;

        const relevantPendidikan = localTahunAjaran
            .flatMap(ta => ta.pendidikan.map(p => ({ ...p, ...ta })))
            .filter(p => p.jenis === kategori)
            .sort((a, b) => {
                if (a.isActive !== b.isActive) {
                    return a.isActive ? -1 : 1; 
                }
                return b.tahun - a.tahun; 
            });

        // Pagination Logic
        const totalItems = relevantPendidikan.length;
        const totalPages = Math.ceil(totalItems / TA_ROWS_PER_PAGE);
        let currentPage = taCurrentPages[tableBodyId] || 1;
        currentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
        taCurrentPages[tableBodyId] = currentPage;
        
        const startIndex = (currentPage - 1) * TA_ROWS_PER_PAGE;
        const paginatedPendidikan = relevantPendidikan.slice(startIndex, startIndex + TA_ROWS_PER_PAGE);

        tableBody.innerHTML = '';
        if (paginatedPendidikan.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-subtle">Tidak ada data.</td></tr>`;
            renderTaPagination(tableBodyId, tabId, 0, 0); 
            return;
        }

        paginatedPendidikan.forEach((p, index) => {
            const statusClass = p.isActive ? 'bg-green-500' : 'bg-gray-500';
            const statusText = p.isActive ? 'Aktif' : 'Arsip';
            
            const jumlahSiswa = localStudents.filter(s => 
                s.kategori === p.jenis && 
                s.detailPendidikan === p.detail && 
                s.tahunAjaran === p.tahun
            ).length;

            const jumlahMapel = localMapels.filter(m =>
                m.kategori === p.jenis &&
                m.detailPendidikan === p.detail &&
                m.tahunAjaran === p.tahun
            ).length;

            // [UPDATE] Tampilan Nama: Jika detailnya '-', jangan tampilkan detailnya
            let detailDisplay = p.detail === '-' ? '' : p.detail;
            const namaPendidikanLengkap = `${p.jenis} ${detailDisplay} TA ${p.tahun}`.trim();
            
            const buttonClass = 'bg-blue-600 hover:bg-blue-700';

            const row = document.createElement('tr');
            row.className = 'border-b border-main';
            row.innerHTML = `
                <td class="p-3 text-center">${startIndex + index + 1}</td> 
                <td class="p-3 font-medium uppercase">${namaPendidikanLengkap.toUpperCase()}</td> 
                <td class="p-3 text-center">
                    <a href="#" class="text-blue-500 hover:underline nav-link" data-section="siswa-section" data-kategori="${p.jenis}" data-detail="${p.detail}" data-tahun="${p.tahun}">
                        ${jumlahSiswa} Siswa
                    </a>
                </td>
                <td class="p-3 text-center">
                    <a href="#" class="text-blue-500 hover:underline nav-link" data-section="mapel-section" data-kategori="${p.jenis}" data-detail="${p.detail}" data-tahun="${p.tahun}">
                        ${jumlahMapel} Mapel
                    </a>
                </td>
                <td class="p-3 text-center">${formatDate(p.tanggalMulai)}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 text-xs rounded-full text-white ${statusClass}">${statusText}</span></td>
                <td class="p-3 text-center">
                    <button class="bg-blue-600 text-white text-xs py-1 px-3 rounded-md ${buttonClass} btn-detail-ta" 
                            data-id="${p.id}" title="Lihat Detail">
                        Detail
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        renderTaPagination(tableBodyId, tabId, totalPages, totalItems); 
    };

    renderCategoryTable('Diktuk Tamtama');
    renderCategoryTable('Diktuk Bintara');
    renderCategoryTable('Dikbangspes');
    // [UPDATE] Panggil dengan nama Kategori BARU
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI'); 
    
    updateDashboardActiveYear(localTahunAjaran.filter(ta => ta.isActive));
    setupActionButtons();
};

/**
 * Membuka modal detail Tahun Ajaran.
 */
const openTADetailModal = (taId) => {
    const ta = localTahunAjaran.find(t => t.id === taId);
    if (!ta) return;

    const p = ta.pendidikan && ta.pendidikan.length > 0 ? ta.pendidikan[0] : { jenis: 'N/A', detail: '' };
    
    const jumlahPeserta = localStudents.filter(s => 
        s.kategori === p.jenis && 
        s.detailPendidikan === p.detail && 
        s.tahunAjaran === ta.tahun
    ).length;

    // [UPDATE] Format Detail di Modal View
    const detailText = p.detail === '-' ? '' : p.detail;
    document.getElementById('detail-ta-pendidikan').textContent = `${p.jenis} ${detailText}`;
    
    document.getElementById('detail-ta-tahun').textContent = ta.tahun;
    document.getElementById('detail-ta-status').innerHTML = `<span class="px-2 py-1 text-xs rounded-full text-white ${ta.isActive ? 'bg-green-500' : 'bg-gray-500'}">${ta.isActive ? 'Aktif' : 'Arsip'}</span>`;
    document.getElementById('detail-ta-peserta').textContent = `${jumlahPeserta} Siswa`;
    document.getElementById('detail-ta-durasi').textContent = ta.lamaPendidikan || '-';
    document.getElementById('detail-ta-mulai').textContent = formatDate(ta.tanggalMulai);
    document.getElementById('detail-ta-berakhir').textContent = formatDate(ta.tanggalBerakhir);

    const actionsContainer = document.getElementById('ta-detail-actions');
    actionsContainer.innerHTML = '';

    let actionButton = '';
    if (currentUser.role === 'super_admin' || currentUser.role === 'operator') {
        actionButton = ta.isActive 
            ? `<button class="text-yellow-500 hover:underline text-sm btn-nonaktifkan" data-id="${ta.id}">Nonaktifkan</button>`
            : `<button class="text-green-500 hover:underline text-sm btn-aktifkan" data-id="${ta.id}">Aktifkan</button>`;
    }
    
    const deleteButton = (currentUser.role === 'super_admin' || currentUser.role === 'operator')
        ? `<button class="text-red-500 hover:underline text-sm btn-hapus-ta" data-id="${ta.id}" data-permission-action="delete_master_ta">Hapus</button>`
        : '';
        
    actionsContainer.innerHTML = `
        ${deleteButton}
        <button class="text-blue-500 hover:underline text-sm btn-edit-ta" data-id="${ta.id}" data-permission-action="update_master_ta">Edit</button>
        ${actionButton}
    `;
    
    openModal('ta-detail-modal');
    setupActionButtons(); 
};

// ... (Fungsi updateDashboardActiveYear tetap sama, tidak ada perubahan) ...
const updateDashboardActiveYear = (activeTAs) => {
    if (!activeYearDisplays) return;
    const displayHtml = activeTAs.length > 0
        ? activeTAs.map(ta => `<p class="font-bold text-main text-lg">${ta.tahun} <span class="text-sm text-subtle">(${ta.pendidikan.map(p => p.jenis).join(', ')})</span></p>`).join('')
        : '<p class="font-bold text-main text-lg">Tidak Ada</p>';
    
    activeYearDisplays.forEach(el => {
        el.innerHTML = displayHtml;
    });
};


/**
 * Membuka modal untuk menambah atau mengedit Tahun Ajaran.
 */
const openTAModal = (taId = null) => {
    taForm.reset();
    document.getElementById('diktuk-options').classList.add('hidden');
    document.getElementById('dikbangspes-options').classList.add('hidden');
    
    if (taId) {
        document.getElementById('ta-modal-title').textContent = 'Edit Tahun Ajaran';
        document.getElementById('ta-id').value = taId;
        const taToEdit = localTahunAjaran.find(ta => ta.id === taId);
        
        document.getElementById('ta-tahun').value = taToEdit.tahun;
        document.getElementById('ta-lama-pendidikan').value = taToEdit.lamaPendidikan || '';
        document.getElementById('ta-tanggal-mulai').value = taToEdit.tanggalMulai || '';
        document.getElementById('ta-tanggal-berakhir').value = taToEdit.tanggalBerakhir || '';
        
        taToEdit.pendidikan.forEach(p => {
            if (p.jenis === 'Diktuk Bintara') {
                document.getElementById('jenis-diktuk-bintara').checked = true;
                document.getElementById('ta-gelombang-diktuk').value = p.detail;
                document.getElementById('diktuk-options').classList.remove('hidden');
            }
            if (p.jenis === 'Diktuk Tamtama') {
                document.getElementById('jenis-diktuk-tamtama').checked = true;
                document.getElementById('ta-gelombang-diktuk').value = p.detail;
                 document.getElementById('diktuk-options').classList.remove('hidden');
            }
            if (p.jenis === 'Dikbangspes') {
                document.getElementById('jenis-dikbangspes').checked = true;
                const [nama, ...gelombangArr] = p.detail.split(' Gelombang ');
                document.getElementById('ta-nama-dikbangspes').value = nama;
                if (gelombangArr.length > 0) {
                    document.getElementById('ta-gelombang-dikbangspes').value = `Gelombang ${gelombangArr.join(' ')}`;
                }
                document.getElementById('dikbangspes-options').classList.remove('hidden');
            }
            // [UPDATE] Handle Edit untuk nama kategori BARU
            if (p.jenis === 'DIKBANGUM SEKOLAH BINTARA POLISI') {
                document.getElementById('jenis-dikbangum-sekolah-bintara-polisi').checked = true;
                // Tidak ada options yang perlu ditampilkan
            }
        });
        
    } else {
        document.getElementById('ta-modal-title').textContent = 'Tambah Tahun Ajaran';
        document.getElementById('ta-id').value = '';
    }
    
    openModal('ta-modal');
};

const handleAktivasiTA = async (idToActivate) => {
    showLoading('Mengaktifkan...');
    try {
        await updateTahunAjaran(idToActivate, { isActive: true });
        closeModal('ta-detail-modal');
    } catch (error) {
        console.error("Gagal mengaktifkan Tahun Ajaran:", error);
        alert("Gagal mengaktifkan data.");
    } finally {
        hideLoading();
    }
};

/**
 * Menangani submit form tambah/edit tahun ajaran.
 */
const handleTAFormSubmit = async (e) => {
    e.preventDefault();
    const taId = document.getElementById('ta-id').value;
    const tahun = document.getElementById('ta-tahun').value;
    const selectedPendidikan = [];

    const lamaPendidikan = document.getElementById('ta-lama-pendidikan').value;
    const tanggalMulai = document.getElementById('ta-tanggal-mulai').value;
    const tanggalBerakhir = document.getElementById('ta-tanggal-berakhir').value;

    if (document.getElementById('jenis-diktuk-bintara').checked) {
        selectedPendidikan.push({ jenis: 'Diktuk Bintara', detail: document.getElementById('ta-gelombang-diktuk').value });
    }
    if (document.getElementById('jenis-diktuk-tamtama').checked) {
        selectedPendidikan.push({ jenis: 'Diktuk Tamtama', detail: document.getElementById('ta-gelombang-diktuk').value });
    }
    if (document.getElementById('jenis-dikbangspes').checked) {
        const namaDikbangspes = document.getElementById('ta-nama-dikbangspes').value;
        const gelombangDikbangspes = document.getElementById('ta-gelombang-dikbangspes').value;
        const detailLengkap = `${namaDikbangspes} ${gelombangDikbangspes}`;
        selectedPendidikan.push({ jenis: 'Dikbangspes', detail: detailLengkap.trim() });
    }
    
    // [UPDATE] Simpan data DIKBANGUM SEKOLAH BINTARA POLISI tanpa gelombang
    if (document.getElementById('jenis-dikbangum-sekolah-bintara-polisi').checked) {
        // Detail diset menjadi '-' agar konsisten "tidak ada detail"
        selectedPendidikan.push({ jenis: 'DIKBANGUM SEKOLAH BINTARA POLISI', detail: '-' });
    }

    if (!tahun || selectedPendidikan.length === 0) {
        alert('Harap isi semua data (Tahun dan minimal satu Jenis Pendidikan).');
        return;
    }
    
    const data = {
        tahun: parseInt(tahun),
        pendidikan: selectedPendidikan,
        lamaPendidikan,
        tanggalMulai,
        tanggalBerakhir
    };

    showLoading('Menyimpan...');
    try {
        if (taId) {
            await updateTahunAjaran(taId, data);
        } else {
            data.isActive = false; 
            await addTahunAjaran(data);
        }
        closeModal('ta-modal');
    } catch (error) {
        console.error("Gagal menyimpan Tahun Ajaran:", error);
        alert("Gagal menyimpan data.");
    } finally {
        hideLoading();
    }
};

const setupActionButtons = () => {
    document.querySelectorAll('.btn-aktifkan').forEach(btn => btn.onclick = null);
    document.querySelectorAll('.btn-nonaktifkan').forEach(btn => btn.onclick = null);
    document.querySelectorAll('.btn-edit-ta').forEach(btn => btn.onclick = null);
    document.querySelectorAll('.btn-hapus-ta').forEach(btn => btn.onclick = null);
    document.querySelectorAll('.btn-detail-ta').forEach(btn => btn.onclick = null);
    document.querySelectorAll('.nav-link').forEach(link => link.onclick = null);

    document.querySelectorAll('.btn-aktifkan').forEach(btn => btn.onclick = (e) => handleAktivasiTA(e.target.dataset.id));
    
    document.querySelectorAll('.btn-nonaktifkan').forEach(btn => btn.onclick = async (e) => {
        showLoading('Menonaktifkan...');
        await updateTahunAjaran(e.target.dataset.id, { isActive: false });
        closeModal('ta-detail-modal');
        hideLoading();
    });

    document.querySelectorAll('.btn-edit-ta').forEach(btn => btn.onclick = (e) => {
        closeModal('ta-detail-modal');
        openTAModal(e.target.dataset.id);
    });

    document.querySelectorAll('.btn-hapus-ta').forEach(btn => btn.onclick = async (e) => {
        const taId = e.target.dataset.id;
        const ta = localTahunAjaran.find(t => t.id === taId);
        if (confirm(`Yakin ingin menghapus Tahun Ajaran ${ta.tahun}?`)) {
            showLoading('Menghapus...');
            await deleteTahunAjaran(taId);
            closeModal('ta-detail-modal');
            hideLoading();
        }
    });
    
    document.querySelectorAll('.btn-detail-ta').forEach(btn => {
        btn.onclick = (e) => openTADetailModal(e.target.dataset.id);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            sessionStorage.setItem('ta_redirect_filter', JSON.stringify(this.dataset));
            document.querySelector(`.nav-item[data-section="${section}"]`).click();
        });
    });
};

export const initTAModule = (taData, studentsData, mapelsData) => {
    localTahunAjaran = taData || [];
    localStudents = studentsData || [];
    localMapels = mapelsData || []; 

    if (!window.taModuleInitialized) {
        taModal = document.getElementById('ta-modal');
        taForm = document.getElementById('ta-form');
        btnTambahTA = document.getElementById('btn-tambah-ta');
        activeYearDisplays = document.querySelectorAll('.active-year-display');

        document.querySelectorAll('#master-ta-section .ta-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        if (btnTambahTA) btnTambahTA.addEventListener('click', () => openTAModal());
        if (taForm) {
            taForm.addEventListener('submit', handleTAFormSubmit);
            taForm.addEventListener('change', (e) => {
                if (e.target.name === 'jenis_pendidikan') {
                    const bintaraChecked = document.getElementById('jenis-diktuk-bintara').checked;
                    const tamtamaChecked = document.getElementById('jenis-diktuk-tamtama').checked;
                    const dikbangspesChecked = document.getElementById('jenis-dikbangspes').checked;
                    // [UPDATE] Cek Checkbox dengan ID BARU
                    const sbpChecked = document.getElementById('jenis-dikbangum-sekolah-bintara-polisi').checked;

                    // Tampilkan opsi Diktuk jika Bintara/Tamtama dipilih
                    document.getElementById('diktuk-options').classList.toggle('hidden', !bintaraChecked && !tamtamaChecked);
                    // Tampilkan opsi Dikbangspes jika Dikbangspes dipilih
                    document.getElementById('dikbangspes-options').classList.toggle('hidden', !dikbangspesChecked);
                }
            });
        }
        
        document.querySelector('.btn-cancel-ta-detail')?.addEventListener('click', () => closeModal('ta-detail-modal'));

        window.taModuleInitialized = true;
    }
    
    renderTahunAjaran();

    const lastTab = sessionStorage.getItem('lastActiveTaTab');
    const defaultTab = 'dikbangspes'; 
    
    requestAnimationFrame(() => {
        if (!document.querySelector('#master-ta-section .ta-tab-btn.active')) {
            switchTab(lastTab || defaultTab);
        }
    });
};