// public/js/modules/id_lemari.js

import { showLoading, hideLoading } from '../ui.js';

// --- STATE ---
let localStudents = [];
let localTahunAjaran = [];
let selectedFilters = {};
let isInitialized = false;
let selectedStudentIds = new Set(); 

const PLACEHOLDER_FOTO = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';

// --- PILIHAN FONT ---
const FONT_OPTIONS = [
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Arial Black', value: '"Arial Black", Gadget, sans-serif' },
    { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { name: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { name: 'Impact', value: 'Impact, Charcoal, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { name: 'Courier New', value: '"Courier New", Courier, monospace' },
    { name: 'Roboto', value: '"Roboto", sans-serif' },
    { name: 'Inter', value: '"Inter", sans-serif' }
];

// --- SETTINGS DEFAULT LENGKAP ---
const DEFAULT_SETTINGS = {
    bgUrl: 'https://ik.imagekit.io/d3nxlzdjsu/TEMPLATE-KARTU-NAMA-ALMARI.jpg?updatedAt=1767690945080',
    
    // Header
    headerFont: 'Arial, sans-serif',
    headerSize: 16,
    headerTop: 1.8,

    // Nama
    namaFont: '"Arial Black", Gadget, sans-serif',
    namaSize: 42,
    namaTop: 2.5,
    namaLeft: 5.5,

    // Nosis
    nosisFont: '"Arial Black", Gadget, sans-serif',
    nosisSize: 32,
    nosisTop: 4.0,
    nosisLeft: 5.5,

    // Pangkat
    pangkatFont: 'Arial, sans-serif',
    pangkatSize: 18,
    pangkatTop: 5.2,
    pangkatLeft: 5.5,

    // Polda
    poldaFont: 'Arial, sans-serif',
    poldaSize: 18,
    poldaTop: 6.0,
    poldaLeft: 5.5,

    // Foto
    photoTop: 2.7,
    photoRight: 1.8,
    photoWidth: 3.5,
    photoHeight: 4.5
};

let lemariSettings = { ...DEFAULT_SETTINGS };

// --- [UPDATE] HELPER SINGKAT TEKS ---
const shortenText = (text, maxLength) => {
    let words = text.split(' ');
    
    // Jika sudah cukup pendek, kembalikan
    if (words.join(' ').length <= maxLength) return text;

    // Loop dari kata terakhir ke kata kedua (kata pertama jangan disingkat)
    for (let i = words.length - 1; i > 0; i--) {
        words[i] = words[i].charAt(0) + '.';
        
        if (words.join(' ').length <= maxLength) {
            break;
        }
    }
    return words.join(' ');
};

// --- [UPDATE] FUNGSI SMART SHORTEN DENGAN DETEKSI GELAR ---
const smartShortenName = (fullName, maxChars = 15) => {
    if (!fullName) return '';
    
    // Bersihkan spasi dan uppercase
    let name = fullName.replace(/\s+/g, ' ').trim().toUpperCase();

    // 1. Cek apakah ada gelar (ditandai dengan koma)
    if (name.includes(',')) {
        const parts = name.split(',');
        
        // Bagian Nama Utama (sebelum koma pertama)
        let mainName = parts[0].trim();
        
        // Bagian Gelar (gabungkan sisanya, biarkan utuh)
        const degree = parts.slice(1).join(',').trim();

        // Hitung sisa ruang untuk nama depan
        // (MaxChars - Panjang Gelar - 2 karakter untuk ", ")
        let availableForName = maxChars - degree.length - 2;
        
        // Beri batas minimal untuk nama depan (misal 3 huruf) agar tidak hilang/error
        if (availableForName < 3) availableForName = 3;

        // Singkat HANYA nama depannya
        const shortenedMainName = shortenText(mainName, availableForName);

        // Gabungkan kembali: "NAMA SINGKAT, GELAR"
        return `${shortenedMainName}, ${degree}`;
    } 
    
    // 2. Jika tidak ada gelar, singkat seperti biasa
    return shortenText(name, maxChars);
};

// --- PAGINATION STATE ---
let currentPage = 1;
const ROWS_PER_PAGE = 10;
const ROWS_PER_CATEGORY_TABLE = 4;

let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1 
};

// --- DOM ELEMENTS ---
let mainView, detailView, tableBody, searchInput, paginationContainer;
let backButton, title, subtitle, totalDataLabel;
let btnPrintSelected, checkAllBox, countSelectedLabel;

export const initIdLemariModule = (studentsData, taData) => {
    localStudents = studentsData || [];
    localTahunAjaran = taData || [];

    if (!isInitialized) {
        const savedSettings = localStorage.getItem('idLemariSettings');
        if (savedSettings) {
            lemariSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
        }

        fetch('./components/modal_id_lemari_settings.html')
            .then(res => res.text())
            .then(html => {
                const container = document.getElementById('id-lemari-settings-modal-container');
                if (container) {
                    container.innerHTML = html;
                    setupSettingsListeners();
                }
            });

        initializeElements();
        setupEventListeners();
        isInitialized = true;
    }
    
    renderMainView();
};

const initializeElements = () => {
    mainView = document.getElementById('id-lemari-main-view');
    detailView = document.getElementById('id-lemari-detail-view');
    tableBody = document.getElementById('id-lemari-table-body');
    searchInput = document.getElementById('id-lemari-search');
    paginationContainer = document.getElementById('id-lemari-pagination');
    backButton = document.getElementById('btn-back-id-lemari');
    title = document.getElementById('id-lemari-view-title');
    subtitle = document.getElementById('id-lemari-view-subtitle');
    totalDataLabel = document.getElementById('id-lemari-total-data');
    
    btnPrintSelected = document.getElementById('btn-print-selected-id-lemari');
    checkAllBox = document.getElementById('id-lemari-check-all');
    countSelectedLabel = document.getElementById('count-selected-lemari');
};

const setupEventListeners = () => {
    if (backButton) {
        backButton.addEventListener('click', () => {
            mainView.classList.remove('hidden');
            detailView.classList.add('hidden');
            backButton.classList.add('hidden');
            title.textContent = 'Cetak ID Lemari';
            subtitle.textContent = 'Pilih kelas untuk mencetak Label Identitas Lemari Siswa.';
            searchInput.value = '';
            selectedStudentIds.clear(); 
            updateSelectionUI();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            renderStudentList();
        });
    }

    document.getElementById('btn-print-all-id-lemari')?.addEventListener('click', () => handlePrint(null, 'all'));
    
    const btnSelected = document.getElementById('btn-print-selected-id-lemari');
    if(btnSelected) btnSelected.addEventListener('click', () => handlePrint(null, 'selected'));

    if (checkAllBox) {
        checkAllBox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const visibleCheckboxes = document.querySelectorAll('.check-student-lemari');
            
            visibleCheckboxes.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) selectedStudentIds.add(cb.value);
                else selectedStudentIds.delete(cb.value);
            });
            updateSelectionUI();
        });
    }

    document.getElementById('btn-settings-id-lemari')?.addEventListener('click', openSettingsModal);

    const container = document.getElementById('id-lemari-view-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const groupBtn = e.target.closest('.btn-view-group-lemari');
            if (groupBtn) {
                const { kategori, detail, tahun } = groupBtn.dataset;
                selectedFilters = { kategori, detail, tahun: parseInt(tahun) };
                
                mainView.classList.add('hidden');
                detailView.classList.remove('hidden');
                backButton.classList.remove('hidden');
                
                // [LOGIKA JUDUL]
                let displayTitle = detail;
                if (detail === '-' || !detail) {
                    displayTitle = kategori;
                }
                
                title.textContent = `ID LEMARI: ${displayTitle.toUpperCase()}`;
                subtitle.textContent = `TAHUN AJARAN ${tahun}`;
                
                selectedStudentIds.clear(); 
                updateSelectionUI();
                currentPage = 1;
                renderStudentList();
            }

            const printBtn = e.target.closest('.btn-print-single-lemari');
            if (printBtn) {
                const studentId = printBtn.dataset.id;
                handlePrint(studentId, 'single');
            }

            if (e.target.classList.contains('check-student-lemari')) {
                if (e.target.checked) selectedStudentIds.add(e.target.value);
                else selectedStudentIds.delete(e.target.value);
                updateSelectionUI();
            }

            const prevCat = e.target.closest('.btn-prev-cat-lemari');
            const nextCat = e.target.closest('.btn-next-cat-lemari');
            if (prevCat) {
                const cat = prevCat.dataset.kategori;
                if (categoryPageMap[cat] > 1) { categoryPageMap[cat]--; renderMainView(); }
            }
            if (nextCat) {
                const cat = nextCat.dataset.kategori;
                categoryPageMap[cat]++;
                renderMainView();
            }

            const prevPage = e.target.closest('#prev-id-lemari-page');
            const nextPage = e.target.closest('#next-id-lemari-page');
            if (prevPage && !prevPage.disabled) {
                currentPage--;
                renderStudentList();
            }
            if (nextPage && !nextPage.disabled) {
                currentPage++;
                renderStudentList();
            }
        });
    }
};

const updateSelectionUI = () => {
    if (!btnPrintSelected) btnPrintSelected = document.getElementById('btn-print-selected-id-lemari');
    if (!countSelectedLabel) countSelectedLabel = document.getElementById('count-selected-lemari');
    if (!checkAllBox) checkAllBox = document.getElementById('id-lemari-check-all');

    const count = selectedStudentIds.size;
    if (countSelectedLabel) countSelectedLabel.textContent = count;
    
    if (btnPrintSelected) {
        if (count > 0) {
            btnPrintSelected.classList.remove('hidden');
        } else {
            btnPrintSelected.classList.add('hidden');
            if (checkAllBox) checkAllBox.checked = false;
        }
    }
};

const setupSettingsListeners = () => {
    const form = document.getElementById('id-lemari-settings-form');
    if (!form) return;
    const fontSelects = form.querySelectorAll('.font-select');
    fontSelects.forEach(select => {
        select.innerHTML = FONT_OPTIONS.map(opt => `<option value='${opt.value}'>${opt.name}</option>`).join('');
    });
    const inputs = form.querySelectorAll('.preview-trigger');
    inputs.forEach(input => { input.addEventListener('input', updatePreview); });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        lemariSettings = {
            bgUrl: document.getElementById('set-bg').value,
            headerFont: document.getElementById('set-header-font').value, headerSize: parseFloat(document.getElementById('set-header-size').value) || 16, headerTop: parseFloat(document.getElementById('set-header-top').value) || 1.8,
            namaFont: document.getElementById('set-nama-font').value, namaSize: parseFloat(document.getElementById('set-nama-size').value) || 42, namaTop: parseFloat(document.getElementById('set-nama-top').value) || 2.5, namaLeft: parseFloat(document.getElementById('set-nama-left').value) || 5.5,
            nosisFont: document.getElementById('set-nosis-font').value, nosisSize: parseFloat(document.getElementById('set-nosis-size').value) || 32, nosisTop: parseFloat(document.getElementById('set-nosis-top').value) || 4.0, nosisLeft: parseFloat(document.getElementById('set-nosis-left').value) || 5.5,
            pangkatFont: document.getElementById('set-pangkat-font').value, pangkatSize: parseFloat(document.getElementById('set-pangkat-size').value) || 18, pangkatTop: parseFloat(document.getElementById('set-pangkat-top').value) || 5.2, pangkatLeft: parseFloat(document.getElementById('set-pangkat-left').value) || 5.5,
            poldaFont: document.getElementById('set-polda-font').value, poldaSize: parseFloat(document.getElementById('set-polda-size').value) || 18, poldaTop: parseFloat(document.getElementById('set-polda-top').value) || 6.0, poldaLeft: parseFloat(document.getElementById('set-polda-left').value) || 5.5,
            photoTop: parseFloat(document.getElementById('set-foto-top').value) || 2.7, photoRight: parseFloat(document.getElementById('set-foto-right').value) || 1.8, photoWidth: parseFloat(document.getElementById('set-foto-w').value) || 3.5, photoHeight: parseFloat(document.getElementById('set-foto-h').value) || 4.5
        };
        localStorage.setItem('idLemariSettings', JSON.stringify(lemariSettings));
        document.getElementById('id-lemari-settings-modal').classList.add('hidden');
        alert('Pengaturan berhasil disimpan.');
    });
};

const updatePreview = () => {
    const bgUrl = document.getElementById('set-bg').value;
    document.getElementById('lemari-preview-card').style.backgroundImage = `url('${bgUrl}')`;
    const applyStyle = (id, fontId, sizeId, topId, leftId) => {
        const el = document.getElementById(id);
        if(el) {
            if(fontId) el.style.fontFamily = document.getElementById(fontId).value;
            if(sizeId) el.style.fontSize = `${document.getElementById(sizeId).value}pt`;
            if(topId) el.style.top = `${document.getElementById(topId).value}cm`;
            if(leftId) el.style.left = `${document.getElementById(leftId).value}cm`;
        }
    };
    applyStyle('preview-header', 'set-header-font', 'set-header-size', 'set-header-top', null);
    applyStyle('preview-nama', 'set-nama-font', 'set-nama-size', 'set-nama-top', 'set-nama-left');
    applyStyle('preview-nosis', 'set-nosis-font', 'set-nosis-size', 'set-nosis-top', 'set-nosis-left');
    applyStyle('preview-pangkat', 'set-pangkat-font', 'set-pangkat-size', 'set-pangkat-top', 'set-pangkat-left');
    applyStyle('preview-polda', 'set-polda-font', 'set-polda-size', 'set-polda-top', 'set-polda-left');
    
    const photo = document.getElementById('preview-photo-box');
    photo.style.top = `${document.getElementById('set-foto-top').value}cm`;
    photo.style.right = `${document.getElementById('set-foto-right').value}cm`;
    photo.style.width = `${document.getElementById('set-foto-w').value}cm`;
    photo.style.height = `${document.getElementById('set-foto-h').value}cm`;
};

const openSettingsModal = () => {
    const modal = document.getElementById('id-lemari-settings-modal');
    if (modal) {
        // Load values into inputs
        const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };

        setVal('set-bg', lemariSettings.bgUrl);

        setVal('set-header-font', lemariSettings.headerFont);
        setVal('set-header-size', lemariSettings.headerSize);
        setVal('set-header-top', lemariSettings.headerTop);

        setVal('set-nama-font', lemariSettings.namaFont);
        setVal('set-nama-size', lemariSettings.namaSize);
        setVal('set-nama-top', lemariSettings.namaTop);
        setVal('set-nama-left', lemariSettings.namaLeft);

        setVal('set-nosis-font', lemariSettings.nosisFont);
        setVal('set-nosis-size', lemariSettings.nosisSize);
        setVal('set-nosis-top', lemariSettings.nosisTop);
        setVal('set-nosis-left', lemariSettings.nosisLeft);

        setVal('set-pangkat-font', lemariSettings.pangkatFont);
        setVal('set-pangkat-size', lemariSettings.pangkatSize);
        setVal('set-pangkat-top', lemariSettings.pangkatTop);
        setVal('set-pangkat-left', lemariSettings.pangkatLeft);

        setVal('set-polda-font', lemariSettings.poldaFont);
        setVal('set-polda-size', lemariSettings.poldaSize);
        setVal('set-polda-top', lemariSettings.poldaTop);
        setVal('set-polda-left', lemariSettings.poldaLeft);

        setVal('set-foto-top', lemariSettings.photoTop);
        setVal('set-foto-right', lemariSettings.photoRight);
        setVal('set-foto-w', lemariSettings.photoWidth);
        setVal('set-foto-h', lemariSettings.photoHeight);

        updatePreview();
        modal.classList.remove('hidden');
    }
};

const renderMainView = () => {
    const allPendidikanData = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ 
            ...p, 
            tahun: ta.tahun, 
            isActive: ta.isActive 
        }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;
        
        const allItems = allPendidikanData
            .filter(p => p.jenis === kategori)
            .sort((a,b) => (b.isActive - a.isActive) || (b.tahun - a.tahun));

        const page = categoryPageMap[kategori] || 1;
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / ROWS_PER_CATEGORY_TABLE);
        const start = (page - 1) * ROWS_PER_CATEGORY_TABLE;
        const items = allItems.slice(start, start + ROWS_PER_CATEGORY_TABLE);

        tbody.innerHTML = '';
        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle text-xs">Tidak ada data.</td></tr>`;
            return;
        }

        items.forEach((p, index) => {
            const statusBadge = p.isActive 
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded border border-red-400">ARSIP</span>`;
            
            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';

            // [LOGIKA TAMPILAN NAMA TABEL]
            let displayName = p.detail;
            if (p.detail === '-' || !p.detail) {
                displayName = p.jenis;
            }

            const row = document.createElement('tr');
            row.className = 'border-b border-main hover:bg-tertiary';
            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${displayName.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-group-lemari" 
                        data-kategori="${p.jenis}" data-detail="${p.detail}" data-tahun="${p.tahun}">
                        Buka
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (totalPages > 1) {
            const paginationRow = document.createElement('tr');
            paginationRow.innerHTML = `
                <td colspan="4" class="p-2 text-center bg-tertiary">
                    <div class="flex justify-between items-center text-xs px-2">
                        <span class="text-subtle">${start + 1}-${Math.min(start + items.length, totalItems)} dari ${totalItems}</span>
                        <div class="flex gap-1">
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-prev-cat-lemari" 
                                data-kategori="${kategori}" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                            <button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-next-cat-lemari" 
                                data-kategori="${kategori}" ${page === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                </td>`;
            tbody.appendChild(paginationRow);
        }
    };

    renderCategoryTable('Diktuk Tamtama', 'id-lemari-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'id-lemari-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'id-lemari-dikbangspes-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'id-lemari-dikbangum-sekolah-bintara-polisi-table-body');
};

const renderStudentList = () => {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const { kategori, detail, tahun } = selectedFilters;
    const term = searchInput.value.toLowerCase();

    const filtered = localStudents.filter(s => 
        s.kategori === kategori && 
        s.detailPendidikan === detail && 
        s.tahunAjaran === tahun &&
        (s.nama.toLowerCase().includes(term) || (s.nosis || '').includes(term))
    ).sort((a,b) => (a.nosis || '').localeCompare(b.nosis || ''));

    if (totalDataLabel) totalDataLabel.textContent = `Total: ${filtered.length}`;

    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
    currentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const paginated = filtered.slice(start, start + ROWS_PER_PAGE);

    if (paginated.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-subtle">Tidak ada data siswa.</td></tr>`;
        paginationContainer.innerHTML = '';
        return;
    }

    paginated.forEach((s, idx) => {
        const isSelected = selectedStudentIds.has(s.id) ? 'checked' : '';
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        row.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" class="check-student-lemari w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" value="${s.id}" ${isSelected}>
            </td>
            <td class="p-3 text-center text-subtle">${start + idx + 1}</td>
            <td class="p-3 font-semibold text-main uppercase">${s.nama}</td>
            <td class="p-3 text-center text-subtle font-bold">${s.nosis || '-'}</td>
            <td class="p-3 text-center text-subtle uppercase">${s.pangkat || '-'} / ${s.nrp || '-'}</td>
            <td class="p-3 text-center">
                <button class="bg-purple-600 text-white text-xs py-1.5 px-3 rounded hover:bg-purple-700 btn-print-single-lemari shadow" data-id="${s.id}">
                    <i class="fas fa-print mr-1"></i> Cetak
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    renderPaginationControls(totalPages, filtered.length);
};

const renderPaginationControls = (totalPages, totalItems) => {
    if (totalItems === 0 || totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    paginationContainer.innerHTML = `
        <span class="text-sm text-subtle">Halaman ${currentPage} dari ${totalPages}</span>
        <div class="inline-flex mt-2 xs:mt-0">
            <button id="prev-id-lemari-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
            <button id="next-id-lemari-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-l border-main hover:bg-main disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
};

// --- PRINT LOGIC ---
const handlePrint = (target, type) => {
    const { kategori, detail, tahun } = selectedFilters;
    let studentsToPrint = [];

    if (type === 'single') {
        const s = localStudents.find(st => st.id === target);
        if (s) studentsToPrint = [s];
    } else if (type === 'all') {
        const term = searchInput.value.toLowerCase();
        studentsToPrint = localStudents.filter(s => 
            s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === tahun &&
            (s.nama.toLowerCase().includes(term) || (s.nosis || '').includes(term))
        ).sort((a,b) => (a.nosis || '').localeCompare(b.nosis || ''));
        
        if (studentsToPrint.length === 0) { alert("Tidak ada data."); return; }
        if (!confirm(`Cetak SEMUA (${studentsToPrint.length}) ID Lemari?`)) return;
    } else if (type === 'selected') {
        if (selectedStudentIds.size === 0) { alert("Pilih minimal satu siswa."); return; }
        studentsToPrint = localStudents.filter(s => selectedStudentIds.has(s.id))
            .sort((a,b) => (a.nosis || '').localeCompare(b.nosis || ''));
        
        if (!confirm(`Cetak ${studentsToPrint.length} ID Lemari terpilih?`)) return;
    }

    showLoading("Menyiapkan dokumen...");
    
    let htmlContent = '';
    const s = lemariSettings;

    studentsToPrint.forEach(student => {
        const foto = student.fotoUrl || PLACEHOLDER_FOTO;
        
        // [LOGIKA TITLE]
        let displayTitle = student.detailPendidikan;
        if (displayTitle === '-' || !displayTitle) {
            displayTitle = student.kategori;
        }
        const titleText = `${displayTitle} TA. ${student.tahunAjaran}`.toUpperCase();
        
        // [PENERAPAN SMART SHORTEN]
        const displayName = smartShortenName(student.nama, 15);

        htmlContent += `
        <div class="card-lemari">
            <div class="header-title">${titleText}</div>
            
            <div class="nama">${displayName}</div>
            <div class="nosis">NOSIS : ${student.nosis}</div>
            <div class="rank">${student.pangkat ? student.pangkat.toUpperCase() : ''}${student.nrp ? '/' + student.nrp : ''}</div>
            <div class="polda">${student.asalPolda ? student.asalPolda.toUpperCase() : ''}</div>

            <div class="photo-box"><img src="${foto}" onerror="this.src='${PLACEHOLDER_FOTO}'"></div>
        </div>`;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cetak ID Lemari</title>
            <style>
                @media print {
                    @page { size: A4 landscape; margin: 1cm; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; align-items: center; }
                }
                body { font-family: 'Arial', sans-serif; background: #fff; display: flex; flex-direction: column; align-items: center; }
                
                .card-lemari {
                    width: 26cm;
                    height: 7.8cm;
                    position: relative;
                    background-image: url('${s.bgUrl}');
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    overflow: hidden;
                    margin-bottom: 2cm;
                    page-break-inside: avoid;
                }

                .card-lemari:nth-of-type(2n) { page-break-after: always; margin-bottom: 0; }
                .card-lemari:last-child { page-break-after: auto; }

                /* CSS Menggunakan Absolute Positioning dari Settings */
                .header-title {
                    position: absolute;
                    width: 100%; text-align: center; font-weight: 900; color: #000; z-index: 10;
                    top: ${s.headerTop}cm;
                    font-family: ${s.headerFont};
                    font-size: ${s.headerSize}pt;
                }

                .nama {
                    position: absolute; font-weight: 900; color: #000; z-index: 10; white-space: nowrap;
                    top: ${s.namaTop}cm; left: ${s.namaLeft}cm;
                    font-family: ${s.namaFont};
                    font-size: ${s.namaSize}pt;
                }

                .nosis {
                    position: absolute; font-weight: 800; color: #000; z-index: 10; white-space: nowrap;
                    top: ${s.nosisTop}cm; left: ${s.nosisLeft}cm;
                    font-family: ${s.nosisFont};
                    font-size: ${s.nosisSize}pt;
                }

                .rank {
                    position: absolute; font-weight: 700; color: #000; z-index: 10; white-space: nowrap;
                    top: ${s.pangkatTop}cm; left: ${s.pangkatLeft}cm;
                    font-family: ${s.pangkatFont};
                    font-size: ${s.pangkatSize}pt;
                }

                .polda {
                    position: absolute; font-weight: 700; color: #000; z-index: 10; white-space: nowrap;
                    top: ${s.poldaTop}cm; left: ${s.poldaLeft}cm;
                    font-family: ${s.poldaFont};
                    font-size: ${s.poldaSize}pt;
                }

                .photo-box {
                    position: absolute; background: #f0f0f0; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.3); overflow: hidden; z-index: 10;
                    top: ${s.photoTop}cm; right: ${s.photoRight}cm;
                    width: ${s.photoWidth}cm; height: ${s.photoHeight}cm;
                }
                .photo-box img { width: 100%; height: 100%; object-fit: cover; }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    hideLoading();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 1500);
};