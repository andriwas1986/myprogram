// public/js/modules/kartu_siswa.js

import { showLoading, hideLoading } from '../ui.js';
import { saveSettings } from '../firestore-service.js';

// State lokal modul
let localStudents = [];
let localTahunAjaran = [];
let AppState = {};

// State untuk pagination
let currentPage = 1;
const itemsPerPage = 8; // Menampilkan 8 kartu per halaman di grid admin

// State untuk pengaturan KTS
let ktsSettings = {
    bgUrl: 'https://ik.imagekit.io/d3nxlzdjsu/TEMPLATE%20KTS%20POLAIR.png?updatedAt=1760422816258', 
    fotoWidth: 65, fotoHeight: 81, fotoTop: 24, fotoRight: 21,
    fontFamily: "'Roboto Bold', sans-serif",
    fontColor: '#0D2B5B',
    fontSizeNama: 16, namaTop: 108, namaLeft: 27,
    fontSizeNosis: 12, nosisTop: 128, nosisLeft: 27,
    fontSizePendidikan: 11, pendidikanTop: 142, pendidikanLeft: 27
};
let settingsInputs = {};

// Elemen DOM
let kartuSiswaGrid, searchInput, selectAllCheckbox, pendidikanFilter, paginationContainer;
let printAllBtn, printSelectedBtn;
let tampilanTabBtn, pengaturanTabBtn, tampilanContent, pengaturanContent, ktsPreviewContainer;

/**
 * Fungsi cerdas untuk menyingkat nama yang panjang.
 */
const truncateName = (name, maxLength = 22) => {
    if (!name || name.length <= maxLength) {
        return name;
    }
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length > 1) {
        let shortenedName = words.slice(0, -1).join(' ') + ' ' + words[words.length - 1].charAt(0);
        if (shortenedName.length > maxLength) {
            return shortenedName.substring(0, maxLength - 3) + '...';
        }
        return shortenedName;
    } else {
        return name.substring(0, maxLength - 3) + '...';
    }
};

/**
 * Menerapkan style dari objek settings ke elemen kartu (DOM Manipulation).
 */
const applyKtsStyles = (cardElement) => {
    const foto = cardElement.querySelector('.kts-foto');
    const nama = cardElement.querySelector('.kts-nama-print');
    const nosis = cardElement.querySelector('.kts-nosis-print');
    const pendidikan = cardElement.querySelector('.kts-pendidikan-print');

    // Terapkan style foto
    if (foto) {
        foto.style.width = `${ktsSettings.fotoWidth}px`;
        foto.style.height = `${ktsSettings.fotoHeight}px`;
        foto.style.top = `${ktsSettings.fotoTop}px`;
        foto.style.right = `${ktsSettings.fotoRight}px`;
        foto.style.position = 'absolute';
        foto.style.objectFit = 'cover';
    }
    
    // Terapkan style teks
    [nama, nosis, pendidikan].forEach(el => {
        if (el) {
            el.style.fontFamily = ktsSettings.fontFamily.replace(/'/g, "");
            if (ktsSettings.fontFamily.includes('Bold')) {
                el.style.fontWeight = 'bold';
            } else {
                el.style.fontWeight = 'normal';
            }
            el.style.color = ktsSettings.fontColor;
            el.style.position = 'absolute';
            el.style.whiteSpace = 'nowrap';
        }
    });

    if (nama) {
        nama.style.fontSize = `${ktsSettings.fontSizeNama}px`;
        nama.style.top = `${ktsSettings.namaTop}px`;
        nama.style.left = `${ktsSettings.namaLeft}px`;
    }
    if (nosis) {
        nosis.style.fontSize = `${ktsSettings.fontSizeNosis}px`;
        nosis.style.top = `${ktsSettings.nosisTop}px`;
        nosis.style.left = `${ktsSettings.nosisLeft}px`;
    }
    if (pendidikan) {
        pendidikan.style.fontSize = `${ktsSettings.fontSizePendidikan}px`;
        pendidikan.style.top = `${ktsSettings.pendidikanTop}px`;
        pendidikan.style.left = `${ktsSettings.pendidikanLeft}px`;
    }
};

/**
 * Merender kartu siswa di Grid Admin.
 */
const renderKartuSiswa = () => {
    if (!kartuSiswaGrid) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = pendidikanFilter.value;
    let studentsToRender = [];

    if (filterValue && filterValue !== 'all') {
        const [kategori, detail, tahun] = filterValue.split('|');
        studentsToRender = localStudents.filter(s =>
            s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === parseInt(tahun)
        );
    } else {
        const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
        const activeIdentifiers = activeTAs.flatMap(ta =>
            ta.pendidikan.map(p => `${p.jenis}|${p.detail}|${ta.tahun}`)
        );
        studentsToRender = localStudents.filter(s => {
            const studentIdentifier = `${s.kategori}|${s.detailPendidikan}|${s.tahunAjaran}`;
            return activeIdentifiers.includes(studentIdentifier);
        });
    }

    if (searchTerm) {
        studentsToRender = studentsToRender.filter(s =>
            s.nama.toLowerCase().includes(searchTerm) || (s.nosis && s.nosis.toLowerCase().includes(searchTerm))
        );
    }

    studentsToRender.sort((a, b) => a.nama.localeCompare(b.nama));
    
    const totalItems = studentsToRender.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedStudents = studentsToRender.slice(startIndex, startIndex + itemsPerPage);

    kartuSiswaGrid.innerHTML = '';
    if (paginatedStudents.length === 0) {
        kartuSiswaGrid.innerHTML = '<p class="text-subtle col-span-full text-center py-8">Tidak ada data siswa yang cocok.</p>';
        renderPaginationControls(0, 1);
        renderPreviewCard();
        return;
    }

    paginatedStudents.forEach(siswa => {
        // [UPDATE] Logika Tampilan Nama Pendidikan
        let displayPendidikan = siswa.detailPendidikan;
        if (displayPendidikan === '-' || !displayPendidikan) {
            displayPendidikan = siswa.kategori;
        }
        const pendidikanText = `SISWA ${displayPendidikan} (TA ${siswa.tahunAjaran || '...'})`;

        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'p-4 rounded-lg shadow-sm bg-card border border-border flex flex-col items-center';
        
        const fotoUrl = siswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
        
        const cardInnerHtml = `
            <div class="new-kts-card relative overflow-hidden shadow-md mb-3" 
                 style="width: 86mm; height: 54mm; background-image: url('${ktsSettings.bgUrl}'); background-size: 100% 100%;">
                <img src="${fotoUrl}" class="kts-foto" onerror="this.src='https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483'">
                <div class="kts-nama-print">${truncateName(siswa.nama || 'NAMA SISWA')}</div>
                <div class="kts-nosis-print">NOSIS : ${siswa.nosis || '-'}</div>
                <div class="kts-pendidikan-print">${pendidikanText}</div>
            </div>
        `;

        cardWrapper.innerHTML = `
            ${cardInnerHtml}
            <label class="flex items-center mt-2 cursor-pointer">
                <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 kts-checkbox" data-student-id="${siswa.id}">
                <span class="ml-2 text-sm text-subtle font-medium">Pilih Cetak</span>
            </label>
        `;

        applyKtsStyles(cardWrapper.querySelector('.new-kts-card'));
        kartuSiswaGrid.appendChild(cardWrapper);
    });

    renderPaginationControls(totalPages, currentPage);
    renderPreviewCard(paginatedStudents[0]);
};

/**
 * Merender kartu preview di tab pengaturan.
 */
const renderPreviewCard = (sampleSiswa = null) => {
    if (!ktsPreviewContainer) return;
    
    const defaultFoto = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    
    const siswa = sampleSiswa || {
        nama: 'NAMA CONTOH SISWA', nosis: '202501001', kategori: 'DIKBANGSPES',
        detailPendidikan: 'CONTOH PENDIDIKAN', tahunAjaran: '2025', fotoUrl: defaultFoto
    };

    // [UPDATE] Logika Preview
    let displayPendidikan = siswa.detailPendidikan;
    if (displayPendidikan === '-' || !displayPendidikan) {
        displayPendidikan = siswa.kategori;
    }
    const pendidikanText = `SISWA ${displayPendidikan} (TA ${siswa.tahunAjaran || '...'})`;

    const previewCard = document.createElement('div');
    previewCard.className = 'new-kts-card relative overflow-hidden shadow-lg mx-auto';
    previewCard.style.width = '86mm';
    previewCard.style.height = '54mm';
    previewCard.style.backgroundImage = `url('${ktsSettings.bgUrl}')`;
    
    previewCard.style.backgroundSize = '100% 100%';

    previewCard.innerHTML = `
        <img src="${siswa.fotoUrl || defaultFoto}" class="kts-foto" onerror="this.src='${defaultFoto}'">
        <div class="kts-nama-print">${truncateName(siswa.nama)}</div>
        <div class="kts-nosis-print">NOSIS : ${siswa.nosis}</div>
        <div class="kts-pendidikan-print">${pendidikanText}</div>
    `;
    
    applyKtsStyles(previewCard);
    ktsPreviewContainer.innerHTML = '';
    ktsPreviewContainer.appendChild(previewCard);
};

// --- FUNGSI UTAMA CETAK (WINDOW BARU) ---
const executePrint = (studentsToPrint) => {
    if (studentsToPrint.length === 0) return;

    showLoading('Menyiapkan dokumen cetak...');

    let cardsHtml = '';
    studentsToPrint.forEach(siswa => {
        // [UPDATE] Logika Cetak
        let displayPendidikan = siswa.detailPendidikan;
        if (displayPendidikan === '-' || !displayPendidikan) {
            displayPendidikan = siswa.kategori;
        }
        const pendidikanText = `SISWA ${displayPendidikan} (TA ${siswa.tahunAjaran || '...'})`;

        const fotoUrl = siswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';

        const tempDiv = document.createElement('div');
        tempDiv.className = 'card-item';
        tempDiv.innerHTML = `
            <div class="new-kts-card">
                <img src="${fotoUrl}" class="kts-foto" onerror="this.src='https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483'">
                <div class="kts-nama-print">${truncateName(siswa.nama || 'NAMA SISWA')}</div>
                <div class="kts-nosis-print">NOSIS : ${siswa.nosis || '-'}</div>
                <div class="kts-pendidikan-print">${pendidikanText}</div>
            </div>
        `;
        
        const cardInner = tempDiv.querySelector('.new-kts-card');
        
        cardInner.style.width = '86mm';
        cardInner.style.height = '54mm';
        cardInner.style.position = 'relative';
        cardInner.style.backgroundImage = `url('${ktsSettings.bgUrl}')`;
        cardInner.style.backgroundSize = '100% 100%';
        cardInner.style.overflow = 'hidden';
        cardInner.style.border = 'none'; 
        cardInner.style.boxSizing = 'border-box';

        applyKtsStyles(cardInner);
        cardsHtml += tempDiv.outerHTML;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cetak Kartu Siswa</title>
            <style>
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 6mm; /* Margin kertas */
                    }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        margin: 0;
                        padding: 0;
                    }
                }
                body { 
                    font-family: Arial, sans-serif; 
                    background: #fff;
                    display: flex;
                    justify-content: center;
                }
                .container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px; /* Jarak antar kartu */
                    width: 100%;
                    max-width: 210mm;
                    justify-items: center;
                }
                .card-item {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .new-kts-card {
                    width: 86mm; height: 54mm;
                    position: relative;
                    background-size: 100% 100%; /* Force Full Background */
                    overflow: hidden;
                    border: none;
                    box-sizing: border-box;
                }
            </style>
        </head>
        <body>
            <div class="container">
                ${cardsHtml}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    
    setTimeout(() => {
        hideLoading();
        printWindow.focus();
        printWindow.print();
    }, 1000);
};

// --- HANDLERS CETAK ---

const handlePrintAll = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = pendidikanFilter.value;
    let studentsToPrint = [];

    if (filterValue && filterValue !== 'all') {
        const [kategori, detail, tahun] = filterValue.split('|');
        studentsToPrint = localStudents.filter(s =>
            s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === parseInt(tahun)
        );
    } else {
        const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
        const activeIdentifiers = activeTAs.flatMap(ta =>
            ta.pendidikan.map(p => `${p.jenis}|${p.detail}|${ta.tahun}`)
        );
        studentsToPrint = localStudents.filter(s => {
            const studentIdentifier = `${s.kategori}|${s.detailPendidikan}|${s.tahunAjaran}`;
            return activeIdentifiers.includes(studentIdentifier);
        });
    }

    if (searchTerm) {
        studentsToPrint = studentsToPrint.filter(s =>
            s.nama.toLowerCase().includes(searchTerm) || (s.nosis && s.nosis.toLowerCase().includes(searchTerm))
        );
    }
    
    studentsToPrint.sort((a, b) => a.nama.localeCompare(b.nama));

    if (studentsToPrint.length === 0) {
        alert('Tidak ada data siswa untuk dicetak.');
        return;
    }

    if (confirm(`Cetak ${studentsToPrint.length} kartu siswa?`)) {
        executePrint(studentsToPrint);
    }
};

const handlePrintSelected = () => {
    const selectedCheckboxes = document.querySelectorAll('.kts-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert('Pilih minimal satu kartu untuk dicetak.');
        return;
    }

    const ids = Array.from(selectedCheckboxes).map(cb => cb.dataset.studentId);
    const studentsToPrint = localStudents.filter(s => ids.includes(s.id));
    
    if (confirm(`Cetak ${studentsToPrint.length} kartu terpilih?`)) {
        executePrint(studentsToPrint);
    }
};

// --- SETTINGS LOGIC ---

const populateKtsSettingsForm = () => {
    for (const key in settingsInputs) {
        if (settingsInputs[key] && ktsSettings[key] !== undefined) {
            settingsInputs[key].value = ktsSettings[key];
        }
    }
};

const handleSaveSettings = async () => {
    showLoading('Menyiapkan penyimpanan...');
    try {
        await saveSettings({ kts: ktsSettings });
        alert('Pengaturan berhasil disimpan!');
    } catch (error) {
        console.error("Save error:", error);
        alert('Gagal menyimpan pengaturan.');
    } finally {
        hideLoading();
    }
};

// --- INIT & EVENT LISTENERS ---

const renderPaginationControls = (totalPages, page) => {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (text, pageNum, isDisabled, isActive) => {
        const cls = isDisabled ? 'bg-gray-300 cursor-not-allowed text-gray-500' : (isActive ? 'bg-blue-800 text-white' : 'bg-blue-600 text-white hover:bg-blue-700');
        return `<button class="px-3 py-1 rounded-md text-sm font-medium ${cls} mx-1" onclick="window.handleKartuSiswaPageChange(${pageNum})" ${isDisabled?'disabled':''}>${text}</button>`;
    };

    let html = createButton('Prev', page - 1, page === 1, false);
    for(let i=1; i<=totalPages; i++) {
        if (i===1 || i===totalPages || (i >= page-1 && i <= page+1)) {
            html += createButton(i, i, false, i === page);
        } else if (i === page-2 || i === page+2) {
            html += `<span class="px-2">...</span>`;
        }
    }
    html += createButton('Next', page + 1, page === totalPages, false);
    paginationContainer.innerHTML = html;
};

const populatePendidikanFilter = () => {
    if (!pendidikanFilter) return;
    const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
    pendidikanFilter.innerHTML = '<option value="all">Semua Pendidikan Aktif</option>';
    activeTAs.forEach(ta => {
        ta.pendidikan.forEach(p => {
            // [UPDATE] Tampilan opsi filter agar bersih jika detail '-'
            let detailDisplay = p.detail === '-' ? '' : p.detail;
            pendidikanFilter.innerHTML += `<option value="${p.jenis}|${p.detail}|${ta.tahun}">${p.jenis} ${detailDisplay} (${ta.tahun})</option>`;
        });
    });
    pendidikanFilter.addEventListener('change', () => { currentPage=1; renderKartuSiswa(); });
};

const setupEventListeners = () => {
    tampilanTabBtn.addEventListener('click', () => {
        tampilanTabBtn.classList.add('active');
        pengaturanTabBtn.classList.remove('active');
        tampilanContent.classList.remove('hidden');
        pengaturanContent.classList.add('hidden');
    });

    pengaturanTabBtn.addEventListener('click', () => {
        pengaturanTabBtn.classList.add('active');
        tampilanTabBtn.classList.remove('active');
        pengaturanContent.classList.remove('hidden');
        tampilanContent.classList.add('hidden');
        renderPreviewCard(localStudents[0]);
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.kts-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    printAllBtn.addEventListener('click', handlePrintAll);
    printSelectedBtn.addEventListener('click', handlePrintSelected);
    
    const saveBtn = document.getElementById('save-settings-kts-btn');
    if(saveBtn) saveBtn.addEventListener('click', handleSaveSettings);

    const handleSettingsChange = () => {
        for (const key in settingsInputs) {
            if (settingsInputs[key]) {
                const val = settingsInputs[key].value;
                if (key.includes('Color') || key.includes('Font') || key.includes('Family')) {
                    ktsSettings[key] = val;
                } else {
                    ktsSettings[key] = isNaN(parseFloat(val)) ? val : Number(val);
                }
            }
        }
        renderKartuSiswa();
        renderPreviewCard(localStudents[0]);
    };

    for (const key in settingsInputs) {
        if (settingsInputs[key]) {
            settingsInputs[key].addEventListener('input', handleSettingsChange);
            settingsInputs[key].addEventListener('change', handleSettingsChange);
        }
    }
};

export const initKartuSiswaModule = (appState) => {
    if (window.kartuSiswaModuleInitialized) {
        localStudents = appState.students || [];
        localTahunAjaran = appState.tahunAjaran || [];
        if (appState.settings && appState.settings.kts) {
            ktsSettings = { ...ktsSettings, ...appState.settings.kts };
        }
        populateKtsSettingsForm();
        renderKartuSiswa();
        return;
    }

    AppState = appState;
    localStudents = AppState.students || [];
    localTahunAjaran = AppState.tahunAjaran || [];
    
    if (AppState.settings && AppState.settings.kts) {
        ktsSettings = { ...ktsSettings, ...AppState.settings.kts };
    }

    kartuSiswaGrid = document.getElementById('kartu-siswa-grid');
    searchInput = document.getElementById('search-kartu-siswa');
    selectAllCheckbox = document.getElementById('select-all-kts');
    pendidikanFilter = document.getElementById('filter-pendidikan-kartu');
    printAllBtn = document.getElementById('print-all-kts-btn');
    printSelectedBtn = document.getElementById('print-selected-kts-btn');
    tampilanTabBtn = document.getElementById('tab-kartu');
    pengaturanTabBtn = document.getElementById('tab-pengaturan');
    tampilanContent = document.getElementById('tab-content-tampilan');
    pengaturanContent = document.getElementById('tab-content-pengaturan');
    paginationContainer = document.getElementById('kartu-siswa-pagination');
    ktsPreviewContainer = document.getElementById('kts-preview-container');

    settingsInputs = {
        fotoWidth: document.getElementById('kts-foto-width'), fotoHeight: document.getElementById('kts-foto-height'),
        fotoTop: document.getElementById('kts-foto-top'), fotoRight: document.getElementById('kts-foto-right'),
        fontFamily: document.getElementById('kts-font-family'), fontColor: document.getElementById('kts-font-color'),
        fontSizeNama: document.getElementById('kts-font-size-nama'), namaTop: document.getElementById('kts-nama-top'), namaLeft: document.getElementById('kts-nama-left'),
        fontSizeNosis: document.getElementById('kts-font-size-nosis'), nosisTop: document.getElementById('kts-nosis-top'), nosisLeft: document.getElementById('kts-nosis-left'),
        fontSizePendidikan: document.getElementById('kts-font-size-pendidikan'), pendidikanTop: document.getElementById('kts-pendidikan-top'), pendidikanLeft: document.getElementById('kts-pendidikan-left')
    };
    
    if (!kartuSiswaGrid) return; 

    window.handleKartuSiswaPageChange = (newPage) => { currentPage = newPage; renderKartuSiswa(); };
    
    populateKtsSettingsForm();
    setupEventListeners();
    populatePendidikanFilter();
    
    searchInput.addEventListener('input', () => { currentPage=1; renderKartuSiswa(); });
    renderKartuSiswa();

    window.kartuSiswaModuleInitialized = true;
};