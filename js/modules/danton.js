// public/js/modules/danton.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addDanton, deleteDanton } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localDantons = [];
let localTahunAjaran = [];
let localGadik = [];
let dantonModal, dantonForm, dantonTableBody, searchDantonInput, btnTambahDanton;
let mainDantonView, dantonListView, backButtonDanton, dantonViewTitle;
let selectedDantonFilters = {};

// --- STATE UNTUK PAGINATION ---
let dantonCurrentPage = 1;
const DANTON_ROWS_PER_PAGE = 10;
const ROWS_PER_CATEGORY_TABLE = 4;

// [UPDATE] Menggunakan Nama Kategori Lengkap sesuai Database
let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1 
};

// --- FUNGSI HELPER TITLE CASE ---
const toTitleCase = (str) => {
    const abbreviations = ['SAR', 'TA', 'LAKA', 'SBP', 'POLAIR', 'POLAIRUD', 'DIKBANGUM']; 
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        if (abbreviations.includes(word.toUpperCase())) {
            return word.toUpperCase();
        }
        if (/^[IVXLCDM]+$/i.test(word)) {
             return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

// --- URUTAN PANGKAT ---
const rankOrder = {
    'KOMJEN': 20, 'IRJEN': 19, 'BRIGJEN': 18,
    'KOMBES': 17, 'AKBP': 16, 'KOMPOL': 15,
    'AKP': 14, 'IPTU': 13, 'IPDA': 12,
    'AIPTU': 11, 'AIPDA': 10,
    'BRIPKA': 9, 'BRIGPOL': 8, 'BRIPTU': 7, 'BRIPDA': 6,
    'ABRIP': 5, 'ABRIPTU': 4, 'ABRIPDA': 3, 'BHARAKA': 2, 'BHARATU': 1, 'BHARADA': 0,
    'PEMBINA UTAMA': -1, 'IV/E': -1,
    'PEMBINA UTAMA MADYA': -2, 'IV/D': -2,
    'PEMBINA UTAMA MUDA': -3, 'IV/C': -3,
    'PEMBINA TINGKAT I': -4, 'IV/B': -4,
    'PEMBINA': -5, 'IV/A': -5,
    'PENATA TINGKAT I': -6, 'III/D': -6, 'PENATATKI':-6,
    'PENATA': -7, 'III/C': -7,
    'PENATA MUDA TINGKAT I': -8, 'III/B': -8,
    'PENATA MUDA': -9, 'III/A': -9,
    'PENGATUR TINGKAT I': -10, 'II/D': -10,
    'PENGATUR': -11, 'II/C': -11,
    'PENGATUR MUDA TINGKAT I': -12, 'II/B': -12,
    'PENGATUR MUDA': -13, 'II/A': -13,
    'JURU TINGKAT I': -14, 'I/D': -14,
    'JURU': -15, 'I/C': -15,
    'JURU MUDA TINGKAT I': -16, 'I/B': -16,
    'JURU MUDA': -17, 'I/A': -17
};

const getRankValue = (rank) => {
    if (!rank) return -99; 
    const normalizedRank = (rank || '').toUpperCase().replace(/[\s.]/g, ''); 
    return rankOrder[normalizedRank] !== undefined ? rankOrder[normalizedRank] : -99; 
};


const renderDantonMainView = () => {
    const allPendidikanData = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ 
            ...p, 
            tahun: ta.tahun, 
            isActive: ta.isActive 
        }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
        // Filter menggunakan Nama Kategori yang dikirim (harus sama persis dengan DB)
        const allItems = allPendidikanData
            .filter(p => p.jenis === kategori)
            .sort((a,b) => (b.tahun - a.tahun) || (b.isActive - a.isActive));
        
        const currentPage = categoryPageMap[kategori] || 1;
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / ROWS_PER_CATEGORY_TABLE);
        const start = (currentPage - 1) * ROWS_PER_CATEGORY_TABLE;
        const end = start + ROWS_PER_CATEGORY_TABLE;
        const paginatedItems = allItems.slice(start, end);

        tableBody.innerHTML = '';
        if (totalItems === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle text-xs">Tidak ada data.</td></tr>`;
            return;
        }

        paginatedItems.forEach((p, index) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-main hover:bg-tertiary';
            
            // Format tampilan nama agar lebih rapi (hilangkan detail jika '-')
            let namaPendidikan = p.detail;
            if (p.detail === '-' || !p.detail) {
                namaPendidikan = p.jenis;
            } else {
                namaPendidikan = `${p.jenis} ${p.detail}`;
            }
            
            const statusBadge = p.isActive 
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded border border-red-400">ARSIP</span>`;

            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';
            const btnText = p.isActive ? 'Kelola' : 'Lihat';

            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${namaPendidikan.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-danton-group" 
                        data-kategori="${p.jenis}" 
                        data-detail="${p.detail}" 
                        data-tahun="${p.tahun}"
                        data-active="${p.isActive}">
                        ${btnText}
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (totalPages > 1) {
            const paginationRow = document.createElement('tr');
            paginationRow.innerHTML = `
                <td colspan="4" class="p-2 text-center bg-tertiary">
                    <div class="flex justify-between items-center text-xs px-2">
                        <span class="text-subtle">${start + 1}-${Math.min(end, totalItems)} dari ${totalItems}</span>
                        <div class="flex gap-1">
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-prev-cat" 
                                data-kategori="${kategori}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-next-cat" 
                                data-kategori="${kategori}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(paginationRow);
        }
    };

    renderCategoryTable('Diktuk Tamtama', 'danton-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'danton-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'danton-dikbangspes-table-body');
    
    // [UPDATE FINAL] Gunakan Nama Kategori Panjang (Filter DB) dan ID Tabel Pendek (HTML)
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'danton-dikbagum-sbp-table-body');
};

const renderDantonPagination = (totalPages, totalItems) => {
    const paginationContainer = document.getElementById('danton-pagination');
    if (!paginationContainer) return;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (dantonCurrentPage - 1) * DANTON_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + DANTON_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} danton
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-danton-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-danton-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-danton-page');
    const nextButton = document.getElementById('next-danton-page');

    if (prevButton) {
        prevButton.disabled = (dantonCurrentPage === 1);
        prevButton.addEventListener('click', () => {
            if (dantonCurrentPage > 1) {
                dantonCurrentPage--;
                renderDantonListView();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (dantonCurrentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (dantonCurrentPage < totalPages) {
                dantonCurrentPage++;
                renderDantonListView();
            }
        });
    }
};

const renderDantonListView = () => {
    if (!dantonTableBody) return;
    dantonTableBody.innerHTML = '';

    const searchTerm = searchDantonInput.value.toLowerCase();
    
    const { kategori, detail, tahun } = selectedDantonFilters;

    const filteredDantons = localDantons.filter(d => 
        d.kategori === kategori &&
        d.detailPendidikan === detail &&
        d.tahunAjaran == tahun && 
        ((d.nama && d.nama.toLowerCase().includes(searchTerm)) || 
         (d.nrp && d.nrp.toLowerCase().includes(searchTerm)))
    );

    filteredDantons.sort((a, b) => {
        const rankValueA = getRankValue(a.pangkat);
        const rankValueB = getRankValue(b.pangkat);
        return rankValueB - rankValueA;
    });

    const totalItems = filteredDantons.length;
    const totalPages = Math.ceil(totalItems / DANTON_ROWS_PER_PAGE);
    dantonCurrentPage = Math.min(Math.max(1, dantonCurrentPage), totalPages || 1);
    
    const startIndex = (dantonCurrentPage - 1) * DANTON_ROWS_PER_PAGE;
    const endIndex = startIndex + DANTON_ROWS_PER_PAGE;
    const paginatedDantons = filteredDantons.slice(startIndex, endIndex);

    if (paginatedDantons.length === 0) {
        dantonTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-subtle">Tidak ada data danton untuk kelas ini.</td></tr>`;
        renderDantonPagination(0, 0); 
        return;
    }

    paginatedDantons.forEach((d, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        
        const isActive = selectedDantonFilters.active === 'true';
        const deleteBtn = isActive 
            ? `<button class="text-red-500 hover:underline ml-4 btn-hapus-danton" data-id="${d.id}" data-permission-action="delete_data_danton">Hapus</button>`
            : '';

        row.innerHTML = `
            <td class="p-3">${startIndex + index + 1}</td> <td class="p-3 font-medium">${d.nama}</td>
            <td class="p-3">${d.nrp}</td>
            <td class="p-3">${d.pangkat || '-'}</td>
            <td class="p-3">${d.jabatan || '-'}</td>
            <td class="p-3 text-center">
                <button class="text-green-500 hover:underline btn-detail-danton" data-id="${d.id}">Detail</button>
                ${deleteBtn}
            </td>
        `;
        dantonTableBody.appendChild(row);
    });

    renderDantonPagination(totalPages, totalItems); 
    setupActionButtons();
};

// --- [FUNGSI UTAMA YANG DIMODIFIKASI] ---
const openDantonModal = () => {
    dantonForm.reset();
    
    const educationSelect = document.getElementById('danton-education-select');
    const gadikSelect = document.getElementById('gadik-select');
    
    // 1. Reset dan Populate Dropdown Pendidikan (Hanya yang AKTIF)
    educationSelect.innerHTML = '<option value="">-- Pilih Pendidikan --</option>';
    gadikSelect.innerHTML = '<option value="">-- Pilih Pendidikan Terlebih Dahulu --</option>';
    gadikSelect.disabled = true;

    // Ambil data pendidikan aktif
    const activeEducations = [];
    localTahunAjaran.filter(ta => ta.isActive).forEach(ta => {
        if (ta.pendidikan) {
            ta.pendidikan.forEach(p => {
                activeEducations.push({
                    kategori: p.jenis,
                    detail: p.detail,
                    tahun: ta.tahun
                });
            });
        }
    });

    activeEducations.forEach(edu => {
        // Kita simpan data dalam bentuk string JSON agar mudah diambil nanti
        const val = JSON.stringify(edu);
        // Tampilan di dropdown: "JENIS DETAIL (TA 2024)"
        let labelDetail = edu.detail === '-' ? '' : edu.detail;
        const label = `${edu.kategori} ${labelDetail} (TA ${edu.tahun})`.toUpperCase();
        educationSelect.innerHTML += `<option value='${val}'>${label}</option>`;
    });

    // 2. Pre-select jika sedang membuka list view (dan statusnya aktif)
    if (selectedDantonFilters.kategori && selectedDantonFilters.active === 'true') {
        const { kategori, detail, tahun } = selectedDantonFilters;
        // Cari option yang cocok
        Array.from(educationSelect.options).forEach(opt => {
            if (opt.value) {
                const data = JSON.parse(opt.value);
                // Bandingkan dengan detail yang mungkin '-' atau ''
                // Agar aman, kita bandingkan kategori dan tahun saja dulu jika detail membingungkan
                if (data.kategori === kategori && data.detail === detail && data.tahun == tahun) {
                    educationSelect.value = opt.value;
                    renderGadikOptions(data); // Trigger load gadik
                }
            }
        });
    }

    // 3. Listener perubahan pendidikan
    educationSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            const data = JSON.parse(e.target.value);
            renderGadikOptions(data);
        } else {
            gadikSelect.innerHTML = '<option value="">-- Pilih Pendidikan Terlebih Dahulu --</option>';
            gadikSelect.disabled = true;
        }
    });
    
    openModal('danton-modal');
};

// --- [FUNGSI BARU] Render Gadik berdasarkan Pendidikan ---
const renderGadikOptions = (educationData) => {
    const gadikSelect = document.getElementById('gadik-select');
    gadikSelect.disabled = false;
    gadikSelect.innerHTML = '<option value="">Memuat...</option>';

    // Filter Danton yang SUDAH ada di pendidikan ini
    const currentClassDantons = localDantons.filter(d => 
        d.kategori === educationData.kategori && 
        d.detailPendidikan === educationData.detail && 
        d.tahunAjaran == educationData.tahun
    );
    const existingDantonNRPs = new Set(currentClassDantons.map(d => d.nrp));
    
    // Filter gadik yang BELUM jadi danton di kelas ini
    const availableGadik = localGadik.filter(g => !existingDantonNRPs.has(g.nrp));

    if (availableGadik.length === 0) {
        gadikSelect.innerHTML = '<option value="">Tidak ada Gadik tersedia (Semua sudah terdaftar)</option>';
    } else {
        gadikSelect.innerHTML = '<option value="">-- Pilih Gadik --</option>';
        availableGadik.sort((a,b) => a.nama.localeCompare(b.nama)).forEach(g => {
            gadikSelect.innerHTML += `<option value="${g.id}">${g.nama} (NRP: ${g.nrp})</option>`;
        });
    }
};

const openDantonDetailModal = (dantonId) => {
    const danton = localDantons.find(d => d.id === dantonId);
    if (!danton) return;

    document.getElementById('detail-gadik-foto-preview').src = danton.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    document.getElementById('detail-gadik-nama').textContent = danton.nama || '-';
    document.getElementById('detail-gadik-nrp').textContent = danton.nrp || '-';
    document.getElementById('detail-gadik-pangkat').textContent = danton.pangkat || '-';
    document.getElementById('detail-gadik-jabatan').textContent = danton.jabatan || '-';
    document.getElementById('detail-gadik-ttl').textContent = `${danton.tempatLahir || ''}, ${danton.tanggalLahir || ''}`;
    document.getElementById('detail-gadik-telepon').textContent = danton.telepon || '-';
    document.getElementById('detail-gadik-email').textContent = danton.email || '-';
    document.getElementById('detail-gadik-alamat').textContent = danton.alamat || '-';
    document.getElementById('detail-gadik-pendidikan').textContent = danton.pendidikanTerakhir || '-';
    document.getElementById('detail-gadik-keahlian').textContent = danton.keahlian || '-';
    document.getElementById('detail-gadik-sertifikasi').textContent = danton.sertifikasi || '-';
    
    const mapelEl = document.getElementById('detail-gadik-mapel');
    if (mapelEl) {
        mapelEl.innerHTML = '<i>(Data mapel diampu tidak ditampilkan di profil Danton)</i>';
    }

    openModal('gadik-detail-modal'); 
};

// --- [MODIFIKASI] Handle Submit dengan Data Pendidikan ---
const handleDantonFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan data...');
    
    const educationSelect = document.getElementById('danton-education-select');
    const gadikSelect = document.getElementById('gadik-select');

    if (!educationSelect.value) {
        alert('Harap pilih pendidikan terlebih dahulu.');
        hideLoading();
        return;
    }
    
    if (!gadikSelect.value) {
        alert('Harap pilih Gadik terlebih dahulu.');
        hideLoading();
        return;
    }

    const selectedEducation = JSON.parse(educationSelect.value);
    const selectedGadik = localGadik.find(g => g.id === gadikSelect.value);

    if (!selectedGadik) {
        alert('Data Gadik tidak ditemukan.');
        hideLoading();
        return;
    }

    try {
        const data = {
            nama: selectedGadik.nama,
            nrp: selectedGadik.nrp,
            pangkat: selectedGadik.pangkat || '',
            jabatan: selectedGadik.jabatan || '',
            telepon: selectedGadik.telepon || '',
            email: selectedGadik.email || '',
            fotoUrl: selectedGadik.fotoUrl || '',
            tempatLahir: selectedGadik.tempatLahir || '',
            tanggalLahir: selectedGadik.tanggalLahir || '',
            alamat: selectedGadik.alamat || '',
            pendidikanTerakhir: selectedGadik.pendidikanTerakhir || '',
            keahlian: selectedGadik.keahlian || '',
            sertifikasi: selectedGadik.sertifikasi || '',
            
            role: 'danton', 
            gadikAsalId: selectedGadik.id,
            
            // Simpan data pendidikan dari dropdown
            kategori: selectedEducation.kategori,
            detailPendidikan: selectedEducation.detail,
            tahunAjaran: parseInt(selectedEducation.tahun)
        };

        await addDanton(data);
        closeModal('danton-modal');
        // Reload list view jika sedang membuka pendidikan yang sama
        if (selectedDantonFilters.kategori === data.kategori && 
            selectedDantonFilters.detail === data.detailPendidikan) {
            renderDantonListView(); 
        } else {
            alert("Danton berhasil ditambahkan!"); // Beri feedback jika di view lain
        }

    } catch (error) {
        console.error("Gagal menyimpan data danton: ", error);
        alert("Gagal menyimpan data: " + error.message);
    } finally {
        hideLoading();
    }
};

const setupActionButtons = () => {
    document.querySelectorAll('.btn-detail-danton').forEach(btn => {
        btn.addEventListener('click', (e) => openDantonDetailModal(e.target.dataset.id));
    });
    
    document.querySelectorAll('.btn-hapus-danton').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const dantonId = e.target.dataset.id;
            const danton = localDantons.find(d => d.id === dantonId);
            if (confirm(`Yakin ingin menghapus danton "${danton.nama}"?`)) {
                showLoading('Menghapus...');
                await deleteDanton(dantonId);
                hideLoading();
            }
        });
    });
};

export const initDantonModule = (dantonsData, taData, gadikData) => {
    if (!window.dantonModuleInitialized) {
        dantonModal = document.getElementById('danton-modal');
        dantonForm = document.getElementById('danton-form');
        dantonTableBody = document.getElementById('danton-table-body');
        searchDantonInput = document.getElementById('search-danton-input');
        btnTambahDanton = document.getElementById('btn-tambah-danton');
        
        mainDantonView = document.getElementById('danton-main-view');
        dantonListView = document.getElementById('danton-list-view');
        backButtonDanton = document.getElementById('btn-back-danton');
        dantonViewTitle = document.getElementById('danton-view-title');

        if (mainDantonView) {
            mainDantonView.addEventListener('click', (e) => {
                // Pagination Handlers
                const prevBtn = e.target.closest('.btn-prev-cat');
                const nextBtn = e.target.closest('.btn-next-cat');

                if (prevBtn) {
                    const kategori = prevBtn.dataset.kategori;
                    if (categoryPageMap[kategori] > 1) {
                        categoryPageMap[kategori]--;
                        renderDantonMainView();
                    }
                } else if (nextBtn) {
                    const kategori = nextBtn.dataset.kategori;
                    categoryPageMap[kategori]++;
                    renderDantonMainView();
                }

                // View Group Handler
                const groupBtn = e.target.closest('.btn-view-danton-group');
                if (groupBtn) {
                    selectedDantonFilters = { ...groupBtn.dataset };
                    mainDantonView.classList.add('hidden');
                    dantonListView.classList.remove('hidden');
                    backButtonDanton.classList.remove('hidden');
                    
                    const titleDetail = toTitleCase(selectedDantonFilters.detail);
                    const isActive = selectedDantonFilters.active === 'true';
                    
                    dantonViewTitle.textContent = `Daftar Danton/Pengasuh ${titleDetail} (TA ${selectedDantonFilters.tahun})`;
                    if(!isActive) {
                        dantonViewTitle.innerHTML += ` <span class="text-red-500 font-bold ml-2">(ARSIP)</span>`;
                    }
                    
                    dantonCurrentPage = 1; 
                    renderDantonListView();
                }
            });
        }
        
        if (backButtonDanton) {
            backButtonDanton.addEventListener('click', () => {
                dantonListView.classList.add('hidden');
                mainDantonView.classList.remove('hidden');
                backButtonDanton.classList.add('hidden');
                dantonViewTitle.textContent = 'Manajemen Data Danton/Pengasuh';
            });
        }

        if (btnTambahDanton) btnTambahDanton.addEventListener('click', () => openDantonModal());
        if (dantonForm) dantonForm.addEventListener('submit', handleDantonFormSubmit);
        
        if (searchDantonInput) {
            searchDantonInput.addEventListener('input', () => {
                dantonCurrentPage = 1;
                renderDantonListView();
            });
        }
        
        window.dantonModuleInitialized = true;
    }

    localDantons = dantonsData;
    localTahunAjaran = taData;
    localGadik = gadikData; 
    
    renderDantonMainView();
    
    if (dantonListView && !dantonListView.classList.contains('hidden')) {
        renderDantonListView();
    }
};