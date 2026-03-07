// js/modules/gadik.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addGadik, updateGadik, deleteGadik } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localGadik = [];
let localMapels = [];
let localTahunAjaran = [];
let selectedMapels = new Map(); // Untuk menyimpan mapel yang dipilih

// --- [BARU] STATE UNTUK PAGINATION ---
let gadikCurrentPage = 1;
const GADIK_ROWS_PER_PAGE = 10;
// --- AKHIR STATE BARU ---

// --- ELEMEN-ELEMEN DOM (akan diinisialisasi nanti) ---
let gadikModal, gadikForm, gadikTableBody, searchGadikInput, btnTambahGadik, filterGadikTahun, filterGadikKategori;

// --- Objek untuk menentukan urutan pangkat ---
const rankOrder = {
    // Perwira Tinggi
    'KOMJEN': 20, 'IRJEN': 19, 'BRIGJEN': 18,
    // Perwira Menengah
    'KOMBES': 17, 'AKBP': 16, 'KOMPOL': 15,
    // Perwira Pertama
    'AKP': 14, 'IPTU': 13, 'IPDA': 12,
    // Bintara Tinggi
    'AIPTU': 11, 'AIPDA': 10,
    // Bintara
    'BRIPKA': 9, 'BRIGPOL': 8, 'BRIPTU': 7, 'BRIPDA': 6,
    // Tamtama
    'ABRIP': 5, 'ABRIPTU': 4, 'ABRIPDA': 3, 'BHARAKA': 2, 'BHARATU': 1, 'BHARADA': 0,
    // PNS / Golongan (dengan nilai negatif agar di paling bawah)
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

// --- [BARU] FUNGSI UNTUK MERENDER KONTROL PAGINATION ---
const renderGadikPagination = (totalPages, totalItems) => {
    const paginationContainer = document.getElementById('gadik-pagination');
    if (!paginationContainer) return;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (gadikCurrentPage - 1) * GADIK_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + GADIK_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} gadik
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-gadik-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-gadik-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-gadik-page');
    const nextButton = document.getElementById('next-gadik-page');

    if (prevButton) {
        prevButton.disabled = (gadikCurrentPage === 1);
        prevButton.addEventListener('click', () => {
            if (gadikCurrentPage > 1) {
                gadikCurrentPage--;
                renderGadikTable();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (gadikCurrentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (gadikCurrentPage < totalPages) {
                gadikCurrentPage++;
                renderGadikTable();
            }
        });
    }
};


/**
 * Merender tabel data gadik berdasarkan filter yang aktif.
 * --- [DIMODIFIKASI UNTUK PAGINATION] ---
 */
const renderGadikTable = () => {
    if (!gadikTableBody) return;
    gadikTableBody.innerHTML = '';

    const tahun = filterGadikTahun.value;
    const kategori = filterGadikKategori.value;
    const searchTerm = searchGadikInput.value.toLowerCase();

    const filteredGadik = localGadik.filter(g => {
        const matchTahun = tahun ? (g.tahunAjaran && g.tahunAjaran.includes(parseInt(tahun))) : true;
        const matchKategori = kategori ? (g.mapelDiampu && g.mapelDiampu.some(m => m.kategori === kategori)) : true;
        const matchSearch = searchTerm ? g.nama.toLowerCase().includes(searchTerm) || (g.nrp && g.nrp.toLowerCase().includes(searchTerm)) : true;
        return matchTahun && matchKategori && matchSearch;
    });

    // --- Logika sorting berdasarkan pangkat ---
    filteredGadik.sort((a, b) => {
        const normalizeRank = (rank) => (rank || '').toUpperCase().replace(/[\s.]/g, '');
        const rankValueA = rankOrder[normalizeRank(a.pangkat)] ?? -99;
        const rankValueB = rankOrder[normalizeRank(b.pangkat)] ?? -99;
        return rankValueB - rankValueA;
    });

    // --- [BARU] Logika Pagination ---
    const totalItems = filteredGadik.length;
    const totalPages = Math.ceil(totalItems / GADIK_ROWS_PER_PAGE);
    gadikCurrentPage = Math.min(Math.max(1, gadikCurrentPage), totalPages || 1);
    
    const startIndex = (gadikCurrentPage - 1) * GADIK_ROWS_PER_PAGE;
    const endIndex = startIndex + GADIK_ROWS_PER_PAGE;
    const paginatedGadik = filteredGadik.slice(startIndex, endIndex);
    // --- AKHIR LOGIKA BARU ---

    if (paginatedGadik.length === 0) {
        gadikTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-subtle">Tidak ada data gadik yang cocok.</td></tr>`;
        renderGadikPagination(0, 0); // Render pagination kosong
        return;
    }

    paginatedGadik.forEach((g, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        row.innerHTML = `
            <td class="p-3">${startIndex + index + 1}</td> <td class="p-3 font-medium">${g.nama}</td>
            <td class="p-3">${g.nrp}</td>
            <td class="p-3">${g.pangkat || '-'}</td>
            <td class="p-3">${g.jabatan || '-'}</td>
            <td class="p-3 text-center">
                <button class="text-green-500 hover:underline btn-detail-gadik" data-id="${g.id}">Detail</button>
                <button class="text-blue-500 hover:underline ml-4 btn-edit-gadik" data-id="${g.id}" data-permission-action="update_data_gadik">Edit</button>
                <button class="text-red-500 hover:underline ml-4 btn-hapus-gadik" data-id="${g.id}" data-permission-action="delete_data_gadik">Hapus</button>
            </td>
        `;
        gadikTableBody.appendChild(row);
    });

    renderGadikPagination(totalPages, totalItems); // [BARU] Render tombol pagination
    setupActionButtons();
};

/**
 * Membuka modal HANYA UNTUK MELIHAT detail data gadik.
 */
const openGadikDetailModal = (gadikId) => {
    const gadik = localGadik.find(g => g.id === gadikId);
    if (!gadik) return;

    document.getElementById('detail-gadik-foto-preview').src = gadik.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    document.getElementById('detail-gadik-nama').textContent = gadik.nama || '-';
    document.getElementById('detail-gadik-nrp').textContent = gadik.nrp || '-';
    document.getElementById('detail-gadik-pangkat').textContent = gadik.pangkat || '-';
    document.getElementById('detail-gadik-jabatan').textContent = gadik.jabatan || '-';
    document.getElementById('detail-gadik-ttl').textContent = `${gadik.tempatLahir || ''}, ${gadik.tanggalLahir || ''}`;
    document.getElementById('detail-gadik-telepon').textContent = gadik.telepon || '-';
    document.getElementById('detail-gadik-email').textContent = gadik.email || '-';
    document.getElementById('detail-gadik-alamat').textContent = gadik.alamat || '-';
    document.getElementById('detail-gadik-pendidikan').textContent = gadik.pendidikanTerakhir || '-';
    document.getElementById('detail-gadik-keahlian').textContent = gadik.keahlian || '-';
    document.getElementById('detail-gadik-sertifikasi').textContent = gadik.sertifikasi || '-';
    
    const mapelDiampu = gadik.mapelDiampu && gadik.mapelDiampu.length > 0 
        ? gadik.mapelDiampu.map(m => `&bull; ${m.nama} (${m.tahun})`).join('<br>')
        : '-';
    document.getElementById('detail-gadik-mapel').innerHTML = mapelDiampu;

    openModal('gadik-detail-modal');
};

/**
 * --- Logika untuk Custom Multi-Select ---
 */
const renderMapelDropdown = () => {
    const dropdown = document.getElementById('mapel-dropdown');
    const searchInput = document.getElementById('mapel-search-input');
    const searchTerm = searchInput.value.toLowerCase();
    
    const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
    const activeYears = activeTAs.map(ta => ta.tahun);
    const availableMapels = localMapels.filter(m => activeYears.includes(m.tahunAjaran));
    
    dropdown.innerHTML = '';
    const filteredMapels = availableMapels.filter(mapel => 
        !selectedMapels.has(mapel.id) &&
        mapel.nama.toLowerCase().includes(searchTerm)
    );

    if (filteredMapels.length === 0) {
        dropdown.innerHTML = `<div class="p-2 text-sm text-subtle text-center">Tidak ada hasil</div>`;
    } else {
        filteredMapels.forEach(mapel => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = `${mapel.nama} (${mapel.kategori} - ${mapel.tahunAjaran})`;
            item.dataset.mapel = JSON.stringify({ id: mapel.id, nama: mapel.nama, kategori: mapel.kategori, tahun: mapel.tahunAjaran });
            item.addEventListener('click', () => selectMapel(item.dataset.mapel));
            dropdown.appendChild(item);
        });
    }
};

const selectMapel = (mapelStr) => {
    const mapel = JSON.parse(mapelStr);
    selectedMapels.set(mapel.id, mapel);
    document.getElementById('mapel-search-input').value = '';
    renderSelectedMapels();
    renderMapelDropdown();
};

const removeMapel = (mapelId) => {
    selectedMapels.delete(mapelId);
    renderSelectedMapels();
    renderMapelDropdown();
};

const renderSelectedMapels = () => {
    const pillsContainer = document.getElementById('mapel-pills-container');
    const searchInput = document.getElementById('mapel-search-input');
    
    pillsContainer.querySelectorAll('.mapel-pill').forEach(pill => pill.remove());

    selectedMapels.forEach(mapel => {
        const pill = document.createElement('div');
        pill.className = 'mapel-pill';
        pill.innerHTML = `
            <span>${mapel.nama}</span>
            <button type="button" class="mapel-pill-remove" data-id="${mapel.id}">&times;</button>
        `;
        pillsContainer.insertBefore(pill, searchInput);
        pill.querySelector('.mapel-pill-remove').addEventListener('click', () => removeMapel(mapel.id));
    });
};

/**
 * Membuka modal untuk menambah atau mengedit data gadik.
 */
const openGadikModal = (gadikId = null) => {
    gadikForm.reset();
    document.getElementById('gadik-foto-preview').src = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    document.getElementById('gadik-foto').value = '';
    
    selectedMapels.clear();

    if (gadikId) {
        const currentGadik = localGadik.find(g => g.id === gadikId);
        document.getElementById('gadik-modal-title').textContent = 'Edit Data Gadik';
        document.getElementById('gadik-id').value = currentGadik.id;
        document.getElementById('gadik-nama').value = currentGadik.nama;
        document.getElementById('gadik-nrp').value = currentGadik.nrp;
        document.getElementById('gadik-pangkat').value = currentGadik.pangkat || '';
        document.getElementById('gadik-jabatan').value = currentGadik.jabatan || '';
        document.getElementById('gadik-tempat-lahir').value = currentGadik.tempatLahir || '';
        document.getElementById('gadik-tanggal-lahir').value = currentGadik.tanggalLahir || '';
        document.getElementById('gadik-telepon').value = currentGadik.telepon || '';
        document.getElementById('gadik-email').value = currentGadik.email || '';
        document.getElementById('gadik-alamat').value = currentGadik.alamat || '';
        document.getElementById('gadik-pendidikan-terakhir').value = currentGadik.pendidikanTerakhir || '';
        document.getElementById('gadik-keahlian').value = currentGadik.keahlian || '';
        document.getElementById('gadik-sertifikasi').value = currentGadik.sertifikasi || '';
        if (currentGadik.fotoUrl) document.getElementById('gadik-foto-preview').src = currentGadik.fotoUrl;
        
        if (currentGadik.mapelDiampu) {
            currentGadik.mapelDiampu.forEach(mapel => selectedMapels.set(mapel.id, mapel));
        }
    } else {
        document.getElementById('gadik-modal-title').textContent = 'Tambah Gadik Baru';
        document.getElementById('gadik-id').value = '';
    }
    
    renderSelectedMapels();
    renderMapelDropdown();
    openModal('gadik-modal');
};

/**
 * Menangani submit form gadik.
 */
const handleGadikFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan data gadik...');
    const gadikId = document.getElementById('gadik-id').value;
    
    const mapelDiampu = Array.from(selectedMapels.values());

    let fotoFile = document.getElementById('gadik-foto').files[0];
    let fotoUrl = document.getElementById('gadik-foto-preview').src;

    try {
        if (fotoFile) {
            if (window.imageCompression) {
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024 };
                fotoFile = await imageCompression(fotoFile, options);
            }
            const formData = new FormData();
            formData.append('fotoGadik', fotoFile, fotoFile.name);
            const response = await fetch('upload_gadik.php', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                fotoUrl = result.url;
            } else {
                throw new Error(result.message);
            }
        } else if (fotoUrl.includes('placehold.co') || fotoUrl.includes('ik.imagekit.io')) {
            fotoUrl = '';
        }

        const data = {
            nama: document.getElementById('gadik-nama').value,
            nrp: document.getElementById('gadik-nrp').value,
            pangkat: document.getElementById('gadik-pangkat').value,
            jabatan: document.getElementById('gadik-jabatan').value,
            fotoUrl,
            tempatLahir: document.getElementById('gadik-tempat-lahir').value,
            tanggalLahir: document.getElementById('gadik-tanggal-lahir').value,
            telepon: document.getElementById('gadik-telepon').value,
            email: document.getElementById('gadik-email').value,
            alamat: document.getElementById('gadik-alamat').value,
            pendidikanTerakhir: document.getElementById('gadik-pendidikan-terakhir').value,
            keahlian: document.getElementById('gadik-keahlian').value,
            sertifikasi: document.getElementById('gadik-sertifikasi').value,
            mapelDiampu,
            tahunAjaran: [...new Set(mapelDiampu.map(m => m.tahun))],
            role: 'gadik'
        };

        if (gadikId) {
            await updateGadik(gadikId, data);
        } else {
            await addGadik(data);
        }
        closeModal('gadik-modal');
    } catch (error) {
        console.error("Gagal menyimpan data gadik: ", error);
        alert("Gagal menyimpan data gadik: " + error.message);
    } finally {
        hideLoading();
    }
};

const populateGadikFilters = () => {
    if (!filterGadikTahun || !filterGadikKategori) return;
    const years = [...new Set(localTahunAjaran.map(ta => ta.tahun))].sort((a, b) => b - a);
    filterGadikTahun.innerHTML = '<option value="">Semua Tahun</option>';
    years.forEach(year => filterGadikTahun.innerHTML += `<option value="${year}">${year}</option>`);
    const categories = [...new Set(localTahunAjaran.flatMap(ta => ta.pendidikan.map(p => p.jenis)))];
    filterGadikKategori.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(cat => filterGadikKategori.innerHTML += `<option value="${cat}">${cat}</option>`);
};

const setupActionButtons = () => {
    document.querySelectorAll('.btn-detail-gadik').forEach(btn => {
        btn.addEventListener('click', (e) => openGadikDetailModal(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-edit-gadik').forEach(btn => {
        btn.addEventListener('click', (e) => openGadikModal(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-hapus-gadik').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const gadikId = e.target.dataset.id;
            const gadik = localGadik.find(g => g.id === gadikId);
            if (confirm(`Yakin ingin menghapus gadik "${gadik.nama}"?`)) {
                showLoading('Menghapus...');
                await deleteGadik(gadikId);
                hideLoading();
            }
        });
    });
};

export const initGadikModule = (gadikData, mapelsData, taData) => {
    if (!window.gadikModuleInitialized) {
        gadikModal = document.getElementById('gadik-modal');
        gadikForm = document.getElementById('gadik-form');
        gadikTableBody = document.getElementById('gadik-table-body');
        searchGadikInput = document.getElementById('search-gadik-input');
        btnTambahGadik = document.getElementById('btn-tambah-gadik');
        filterGadikTahun = document.getElementById('filter-gadik-tahun');
        filterGadikKategori = document.getElementById('filter-gadik-kategori');
        
        if (gadikForm && btnTambahGadik && searchGadikInput && filterGadikTahun && filterGadikKategori) {
            btnTambahGadik.addEventListener('click', () => openGadikModal());
            gadikForm.addEventListener('submit', handleGadikFormSubmit);

            [searchGadikInput, filterGadikTahun, filterGadikKategori].forEach(el => {
                if (el) {
                    // --- [PERUBAHAN] Reset halaman saat filter ---
                    el.addEventListener('input', () => {
                        gadikCurrentPage = 1;
                        renderGadikTable();
                    });
                    // --- AKHIR PERUBAHAN ---
                }
            });
            
            gadikModal.querySelectorAll('.tab-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tabId = button.dataset.tab;
                    
                    gadikModal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    gadikModal.querySelectorAll('.tab-content').forEach(content => {
                        if (content.id === `${tabId}-tab`) {
                            content.classList.remove('hidden');
                            content.classList.add('active');
                        } else {
                            content.classList.add('hidden');
                            content.classList.remove('active');
                        }
                    });
                });
            });

            document.getElementById('btn-upload-gadik-foto').addEventListener('click', () => document.getElementById('gadik-foto').click());
            document.getElementById('gadik-foto').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => document.getElementById('gadik-foto-preview').src = event.target.result;
                    reader.readAsDataURL(file);
                }
            });

            const searchInput = document.getElementById('mapel-search-input');
            const dropdown = document.getElementById('mapel-dropdown');
            const pillsContainer = document.getElementById('mapel-pills-container');

            if(pillsContainer) pillsContainer.addEventListener('click', () => searchInput.focus());
            if(searchInput) searchInput.addEventListener('focus', () => dropdown.classList.remove('hidden'));
            if(searchInput) searchInput.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));
            if(searchInput) searchInput.addEventListener('input', renderMapelDropdown);
        }
        window.gadikModuleInitialized = true;
    }

    localGadik = gadikData;
    localMapels = mapelsData;
    localTahunAjaran = taData;

    populateGadikFilters();
    renderGadikTable();
};