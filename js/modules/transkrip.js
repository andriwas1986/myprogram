// js/modules/transkrip.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { getAcademicScores, updateStudent } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localStudents = [];
let localMapels = [];
let localTahunAjaran = [];
let localSettings = {}; 
let currentUser = {};
let selectedTranskripFilters = {};
let currentTranskripRanks = {}; // [BARU] Menyimpan data peringkat sementara
const DEFAULT_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/id/thumb/8/88/Logo_Pataka_Korps_Airud.png/375px-Logo_Pataka_Korps_Airud.png';

// --- ELEMEN DOM ---
let transkripSiswaTableBody, searchTranskripInput;
let mainTranskripView, listTranskripView, backButtonTranskrip, titleTranskrip;
let modernTranscriptView, transkripEditModal, transkripEditForm;

// --- PAGINATION STATE ---
let transkripCurrentPage = 1;
const TRANSKRIP_ROWS_PER_PAGE = 10;
const ROWS_PER_CATEGORY_TABLE = 4;
let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1
};


// --- FUNGSI BANTUAN ---
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
};

const terbilang = (n) => {
    if (n === null || typeof n === 'undefined' || isNaN(n)) return '';
    const angka = ["", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN", "SEPULUH", "SEBELAS"];
    let num = Math.round(n);
    if (num < 12) return angka[num];
    if (num < 20) return terbilang(num - 10) + " BELAS";
    if (num < 100) return (terbilang(Math.floor(num / 10)) + " PULUH " + terbilang(num % 10)).trim();
    if (num < 200) return "SERATUS " + terbilang(num - 100);
    if (num < 1000) return terbilang(Math.floor(num / 100)) + " RATUS " + terbilang(num % 100);
    if (num < 2000) return "SERIBU " + terbilang(num - 1000);
    if (num < 1000000) return terbilang(Math.floor(num / 1000)) + " RIBU " + terbilang(num % 1000);
    return "Nilai terlalu besar";
};

const terbilangSatuan = (angkaStr) => {
    const angka = ["NOL", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN"];
    return angkaStr.split('').map(digit => angka[parseInt(digit)]).join(' ');
};

const terbilangKoma = (n) => {
    if (n === null || typeof n === 'undefined' || isNaN(n)) return '';
    const num = parseFloat(n) || 0;
    const numStr = num.toFixed(2).replace('.', ',');
    const [bulat, desimal] = numStr.split(',');
    let hasil = terbilang(parseInt(bulat)).trim();
    const desimalInt = parseInt(desimal);
    
    if (desimalInt > 0) {
        hasil += " KOMA " + terbilangSatuan(desimal); 
    }
    return hasil.trim();
};

// --- LOGIKA NILAI KEPRIBADIAN ---
const getNilaiKepribadianDebug = (siswa) => {
    if (!siswa) return 0;

    // KASUS 1: DIKBANGSPES & SBP (Mingguan + Sosiometri)
    if (siswa.kategori === 'Dikbangspes' || siswa.kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI') {
        const nilaiList = siswa.nilaiKepribadian || [];
        const validNilaiList = nilaiList.filter(n => n !== null && n !== undefined && !isNaN(parseFloat(n)));
        
        const nilaiInstruktur = validNilaiList.length > 0 ? parseFloat(validNilaiList[validNilaiList.length - 1]) : 0;
        const nilaiSosiometri = parseFloat(siswa.nilaiSosiometri) || 0;
        
        return (nilaiInstruktur * 0.7) + (nilaiSosiometri * 0.3);
    }

    // KASUS 2: DIKTUK (Rata-rata Array)
    const data = siswa.nilaiKepribadian;
    if (Array.isArray(data)) {
        const validData = data.filter(n => n !== null && n !== undefined && !isNaN(parseFloat(n)));
        if (validData.length === 0) return 0;
        const sum = validData.reduce((a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0), 0);
        return sum / validData.length;
    }

    return 0;
};

// --- KALKULASI PERINGKAT ---
const calculateAllStudentRanks = async (studentGroup) => {
    if (!studentGroup || studentGroup.length === 0) return {};

    const studentScores = await Promise.all(studentGroup.map(async (siswa) => {
        const academicScores = await getAcademicScores(siswa.id);
        const relevantMapels = localMapels
            .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
            .map(mapel => academicScores[mapel.id] ?? 0);
        
        const totalNilaiAkademik = relevantMapels.reduce((a, b) => a + b, 0);
        const rerataAkademik_raw = relevantMapels.length > 0 ? (totalNilaiAkademik / relevantMapels.length) : 0;
        const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
        
        const rerataKepribadian = getNilaiKepribadianDebug(siswa);

        let finalScore = 0;
        
        // [LOGIKA PEMBOBOTAN NILAI AKHIR 4-4-2]
        if (siswa.kategori !== 'Dikbangspes') {
            const nilaiJasmaniList = siswa.nilaiJasmani || [];
            const rerataJasmani = nilaiJasmaniList.length > 0 ? (nilaiJasmaniList.reduce((a, b) => a + b, 0) / nilaiJasmaniList.length) : 0;
            
            // Rumus: ((Akademik * 4) + (Mental * 4) + (Jasmani * 2)) / 10
            finalScore = ((rerataAkademik * 4) + (rerataKepribadian * 4) + (rerataJasmani * 2)) / 10;
            
        } else {
            // Dikbangspes (Tanpa Jasmani): Rata-rata Akademik & Mental
            finalScore = (rerataAkademik + rerataKepribadian) / 2;
        }

        return { studentId: siswa.id, finalScore };
    }));

    // Urutkan berdasarkan nilai akhir tertinggi
    studentScores.sort((a, b) => b.finalScore - a.finalScore);

    const ranks = {};
    studentScores.forEach((score, index) => {
        ranks[score.studentId] = index + 1;
    });

    return ranks;
};

// --- RENDER MAIN VIEW ---
const renderTranskripMainView = () => {
    const allPendidikanData = localTahunAjaran.flatMap(ta => 
        (ta.pendidikan || []).map(p => ({ ...p, tahun: ta.tahun, isActive: ta.isActive }))
    );

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
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
            
            const statusBadge = p.isActive 
                ? `<span class="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded shadow-sm">AKTIF</span>`
                : `<span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded shadow-sm">ARSIP</span>`;

            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';
            
            let displayName = p.detail;
            if (p.detail === '-' || !p.detail) {
                displayName = p.jenis;
            } else {
                displayName = `${p.jenis} ${p.detail}`;
            }

            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${displayName.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-transkrip-group" 
                        data-kategori="${p.jenis}" 
                        data-detail="${p.detail}" 
                        data-tahun="${p.tahun}"
                        data-active="${p.isActive}">
                        Lihat
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

    renderCategoryTable('Diktuk Tamtama', 'transkrip-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'transkrip-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'transkrip-dikbangspes-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'transkrip-dikbangum-sekolah-bintara-polisi-table-body');
};

// --- LIST SISWA VIEW ---
const renderTranskripSiswaListView = () => {
    if (!transkripSiswaTableBody) return;
    transkripSiswaTableBody.innerHTML = '';

    const { kategori, detail, tahun } = selectedTranskripFilters;
    
    const searchTerm = searchTranskripInput ? searchTranskripInput.value.toLowerCase() : '';

    const subtitleElement = document.getElementById('transkrip-view-subtitle');
    if (subtitleElement) {
        const tahunAjaranData = localTahunAjaran.find(ta =>
            ta.tahun === parseInt(tahun) &&
            ta.pendidikan.some(p => p.jenis === kategori && p.detail === detail)
        );
        const studentCount = localStudents.filter(s =>
            s.kategori === kategori &&
            s.detailPendidikan === detail &&
            s.tahunAjaran === parseInt(tahun)
        ).length;

        subtitleElement.innerHTML = `
            Jumlah Siswa : ${studentCount} &nbsp; | &nbsp;
            Tanggal Mulai Dik : ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
            Tanggal Selesai Dik : ${formatDate(tahunAjaranData?.tanggalBerakhir)}
        `;
    }

    let filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun) &&
        (searchTerm ? s.nama.toLowerCase().includes(searchTerm) || (s.nosis && s.nosis.toLowerCase().includes(searchTerm)) : true)
    );

    // [BARU] Ambil nilai dari dropdown sort
    const sortSelect = document.getElementById('sort-transkrip-siswa-select');
    const sortValue = sortSelect ? sortSelect.value : 'nosis_asc';

    // [BARU] Lakukan pengurutan berdasarkan pilihan
    filteredSiswa.sort((a, b) => {
        if (sortValue === 'nosis_asc') {
            return String(a.nosis || '').localeCompare(String(b.nosis || ''));
        } else if (sortValue === 'nosis_desc') {
            return String(b.nosis || '').localeCompare(String(a.nosis || ''));
        } else if (sortValue === 'nama_asc') {
            return String(a.nama || '').localeCompare(String(b.nama || ''));
        } else if (sortValue === 'nama_desc') {
            return String(b.nama || '').localeCompare(String(a.nama || ''));
        } else if (sortValue === 'rank_asc') {
            // Urutkan peringkat, jika belum ada nilainya taruh di urutan terbawah
            const rankA = currentTranskripRanks[a.id] || 999999;
            const rankB = currentTranskripRanks[b.id] || 999999;
            return rankA - rankB; 
        }
        return 0;
    });

    const totalItems = filteredSiswa.length;
    const totalPages = Math.ceil(totalItems / TRANSKRIP_ROWS_PER_PAGE);
    transkripCurrentPage = Math.min(Math.max(1, transkripCurrentPage), totalPages || 1);
    
    const startIndex = (transkripCurrentPage - 1) * TRANSKRIP_ROWS_PER_PAGE;
    const paginatedSiswa = filteredSiswa.slice(startIndex, startIndex + TRANSKRIP_ROWS_PER_PAGE);

    if (paginatedSiswa.length === 0) {
        transkripSiswaTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">Tidak ada data siswa yang cocok.</td></tr>`;
        renderTranskripPagination(0, 0); 
        return;
    }

    paginatedSiswa.forEach((siswa, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        
        // [BARU] Ambil data peringkat dari variabel state yang sudah dihitung
        const peringkat = currentTranskripRanks[siswa.id] || '-';

        row.innerHTML = `
            <td class="p-3 text-center">${startIndex + index + 1}</td>
            <td class="p-3 font-medium">${siswa.nama}</td>
            <td class="p-3 text-center">${siswa.nosis}</td>
            <td class="p-3 text-center">${siswa.noIjazah || '-'}</td>
            <td class="p-3 text-center">${siswa.noSeri || '-'}</td>
            
            <td class="p-3 text-center font-bold text-blue-600">${peringkat}</td>
            
            <td class="p-3 text-center whitespace-nowrap">
                <button class="bg-green-600 text-white text-xs py-1 px-3 rounded-md hover:bg-green-700 btn-lihat-transkrip" data-id="${siswa.id}">
                    <i class="fas fa-eye mr-1"></i> Lihat
                </button>
                <button class="bg-yellow-500 text-white text-xs py-1 px-3 rounded-md hover:bg-yellow-600 ml-2 btn-edit-transkrip-data" data-id="${siswa.id}">
                    <i class="fas fa-pencil-alt mr-1"></i> Edit
                </button>
            </td>
        `;
        transkripSiswaTableBody.appendChild(row);
    });

    renderTranskripPagination(totalPages, totalItems); 
};

const renderTranskripPagination = (totalPages, totalItems) => {
    const paginationContainer = document.getElementById('transkrip-pagination');
    if (!paginationContainer) return;
    
    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (transkripCurrentPage - 1) * TRANSKRIP_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + TRANSKRIP_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} siswa
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-transkrip-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-transkrip-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-transkrip-page');
    const nextButton = document.getElementById('next-transkrip-page');

    if (prevButton) {
        prevButton.disabled = (transkripCurrentPage === 1);
        prevButton.addEventListener('click', () => {
            if (transkripCurrentPage > 1) {
                transkripCurrentPage--;
                renderTranskripSiswaListView();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (transkripCurrentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (transkripCurrentPage < totalPages) {
                transkripCurrentPage++;
                renderTranskripSiswaListView();
            }
        });
    }
};

const openTranskripModal = async (siswaId) => {
    const container = document.getElementById('printable-transcript');
    if (!container) return;

    showLoading('Memuat data transkrip...');
    const siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa) {
        alert("Data siswa tidak ditemukan!");
        hideLoading();
        return;
    }
    
    container.dataset.siswaId = siswaId;

    const studentGroup = localStudents.filter(s => 
        s.kategori === siswa.kategori && 
        s.detailPendidikan === siswa.detailPendidikan && 
        s.tahunAjaran === siswa.tahunAjaran
    );

    const ranks = await calculateAllStudentRanks(studentGroup);
    const peringkatSiswa = ranks[siswa.id];
    const totalSiswaDiKelas = studentGroup.length;

    const academicScores = await getAcademicScores(siswaId);
    
    const relevantMapels = localMapels
        .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
        .map(mapel => ({ ...mapel, nilai: academicScores[mapel.id] ?? 0 }))
        .sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));

    const totalNilaiAkademik = relevantMapels.reduce((sum, m) => sum + m.nilai, 0);
    
    const rerataAkademik_raw = relevantMapels.length > 0 ? (totalNilaiAkademik / relevantMapels.length) : 0;
    const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
    
    const rerataKepribadian = getNilaiKepribadianDebug(siswa);

    let nilaiJasmaniList = [];
    let rerataJasmani = 0;
    let nilaiAkhir = 0;

    // [UPDATE] Hitung Nilai Akhir (4-4-2)
    if (siswa.kategori !== 'Dikbangspes') {
        nilaiJasmaniList = siswa.nilaiJasmani || [];
        rerataJasmani = nilaiJasmaniList.length > 0 ? (nilaiJasmaniList.reduce((a, b) => a + b, 0) / nilaiJasmaniList.length) : 0;
        
        nilaiAkhir = ((rerataAkademik * 4) + (rerataKepribadian * 4) + (rerataJasmani * 2)) / 10;
    } else {
        nilaiAkhir = (rerataAkademik + rerataKepribadian) / 2;
    }

    const rekap = { totalNilaiAkademik, rerataAkademik, rerataKepribadian, rerataJasmani, nilaiAkhir };

    const printHTML = generateTranscriptHTML(siswa, relevantMapels, rekap, peringkatSiswa, totalSiswaDiKelas);
    container.innerHTML = printHTML;

    if (currentUser.role !== 'siswa') {
        populateModernTranscriptView(siswa, relevantMapels, rekap);
        openModal('transkrip-detail-modal');
    }

    hideLoading();
};

const populateModernTranscriptView = (siswa, mapels, rekap) => {
    if (!modernTranscriptView) return;

    const s = localSettings.transcript || {};
    const logoUrl = s.logoUrl || DEFAULT_LOGO_URL;
    
    document.getElementById('modern-transkrip-foto').src = siswa.fotoUrl || 'https://placehold.co/150x150/e2e8f0/4a5568?text=Foto';
    document.getElementById('modern-transkrip-nama').textContent = siswa.nama;
    
    let detailPendidikanDisplay = siswa.detailPendidikan;
    if(detailPendidikanDisplay === '-' || !detailPendidikanDisplay) detailPendidikanDisplay = "";
    
    document.getElementById('modern-transkrip-kategori').textContent = `${siswa.kategori} ${detailPendidikanDisplay} (TA ${siswa.tahunAjaran})`;
    document.getElementById('modern-transkrip-nosis').textContent = siswa.nosis || '-';
    document.getElementById('modern-transkrip-nrp').textContent = siswa.nrp || '-';

    const modernLogo = document.getElementById('modern-transkrip-logo');
    if (modernLogo) modernLogo.src = logoUrl;
    const modernHeader1 = document.getElementById('modern-transkrip-header1');
    if (modernHeader1) modernHeader1.textContent = s.headerLine1 || '';
    const modernHeader2 = document.getElementById('modern-transkrip-header2');
    if (modernHeader2) modernHeader2.textContent = s.headerLine2 || '';

    const rekapBody = document.getElementById('modern-transkrip-rekap-body');
    
    let rekapHtml = `
        <tr class="border-b border-main"><td class="p-3">Mental Kepribadian</td><td class="p-3 text-center font-semibold">${rekap.rerataKepribadian.toFixed(2)}</td></tr>
        <tr class="border-b border-main"><td class="p-3">Akademik</td><td class="p-3 text-center font-semibold">${rekap.rerataAkademik.toFixed(2)}</td></tr>
    `;
    
    if (siswa.kategori !== 'Dikbangspes') {
        rekapHtml += `<tr><td class="p-3">Kesehatan Jasmani</td><td class="p-3 text-center font-semibold">${rekap.rerataJasmani.toFixed(2)}</td></tr>`;
    }

    rekapHtml += `
        <tr class="border-b border-main bg-gray-100 font-bold">
            <td class="p-3">NILAI AKHIR</td>
            <td class="p-3 text-center font-bold text-blue-600 text-lg">${rekap.nilaiAkhir.toFixed(2)}</td>
        </tr>
    `;

    rekapBody.innerHTML = rekapHtml;

    const akademikBody = document.getElementById('modern-transkrip-akademik-body');
    akademikBody.innerHTML = mapels.map((mapel, index) => `
        <tr class="border-b border-main">
            <td class="p-3 text-center">${index + 1}</td>
            <td class="p-3">${mapel.nama}</td>
            <td class="p-3 text-center font-semibold">${mapel.nilai}</td>
            <td class="p-3 text-center">${terbilang(mapel.nilai)}</td>
        </tr>
    `).join('');

    document.getElementById('modern-transkrip-total-nilai').textContent = rekap.totalNilaiAkademik.toFixed(0);
    document.getElementById('modern-transkrip-total-terbilang').textContent = terbilang(rekap.totalNilaiAkademik);
};

const generateTranscriptHTML = (siswa, mapels, rekap, peringkatSiswa, totalSiswaDiKelas) => {
    const s = localSettings.transcript || {};

    const pageStyle = `font-family: ${s.fontFamily || 'Calibri'}, sans-serif; font-size: ${s.bodyFontSize || 10}pt; padding: ${s.marginTop || 1.3}cm ${s.marginRight || 1.9}cm ${s.marginBottom || 2.54}cm ${s.marginLeft || 1.9}cm;`;
    
    const tableHeaderBg = s.tableHeaderBg || '#FFFFFF';
    const tableHeaderText = s.tableHeaderText || '#000000';
    const tableHeaderSize = s.tableHeaderSize || 10;
    const tableBodySize = s.tableBodySize || 10;
    const tableRowPadding = s.tableRowPadding || '1';
    const thStyle = `padding: ${tableRowPadding}pt 2pt; border: 1pt solid black; color: ${tableHeaderText};`;
    
    const headerLine1 = s.headerLine1 || '';
    const headerLine2 = s.headerLine2 || '';
    const headerLineWidth = s.headerLineWidth || '43'; 
    const headerLineHtml = s.headerLineShow ? `<div style="border-bottom: 1pt solid black; width: ${headerLineWidth}%; margin-top: 1px;"></div>` : '';

    const mainTitleSize = s.mainTitleSize || 12;
    const subTitleSize = s.subTitleSize || 12;
    
    const signer1Name = s.signer1Name || '';
    const signer1Id = s.signer1Id || '';
    const signer2Name = s.signer2Name || '';
    const signer2Id = s.signer2Id || '';
    
    // [UPDATE] Remove toUpperCase() to allow mixed case
    const signer1TitleLines = (s.signer1Title || '').split('|');
    const signer2TitleLines = (s.signer2Title || '').split('|');

    const signer1TitleHtml = signer1TitleLines.map(line => `<p style="margin: 0;">${line}</p>`).join('');
    const signer2TitleHtml = signer2TitleLines.map(line => `<p style="margin: 0;">${line}</p>`).join('');

    const namaSiswa = (siswa.nama || '...').toUpperCase();
    const noIjazah = siswa.noIjazah || '...';
    const pangkat = (siswa.pangkat || '...').toUpperCase();
    const nrpSiswa = siswa.nrp || '...';
    
    let detailPendidikanDisplay = siswa.detailPendidikan;
    if(detailPendidikanDisplay === '-' || !detailPendidikanDisplay) detailPendidikanDisplay = "";
    const jenisDik_main = `${(siswa.kategori || '...')} ${detailPendidikanDisplay}`.toUpperCase();
    
    const jenisDik_ta = `TA.${(siswa.tahunAjaran || '...')}`.toUpperCase();
    const noSeri = siswa.noSeri || '...';
    
    const peringkat = peringkatSiswa || '...';
    const totalSiswa = totalSiswaDiKelas || '...';
    
    const paperSize = s.paperSize || 'a4';
    const paperClass = paperSize === 'folio' ? 'paper-folio' : 'paper-a4';

    const infoBlockTop = s.infoBlockTop || '0';
    const infoBlockLeft = s.infoBlockLeft || '0';
    const infoBlockStyle = `position: relative; top: ${infoBlockTop}px; left: ${infoBlockLeft}px;`;

    const signer1Top = s.signer1Top || '0';
    const signer1Left = s.signer1Left || '0';
    const signer1LineWidthStyle = s.signer1LineWidth ? `width: ${s.signer1LineWidth}px;` : '';
    const signer1BlockStyle = `width:45%; text-align:center; position: relative; top: ${signer1Top}px; left: ${signer1Left}px;`;

    const signer2Top = s.signer2Top || '0';
    const signer2Left = s.signer2Left || '0';
    const signer2LineWidthStyle = s.signer2LineWidth ? `width: ${s.signer2LineWidth}px;` : '';
    const signer2BlockStyle = `width:45%; text-align:center; position: relative; top: ${signer2Top}px; left: ${signer2Left}px;`;

    const signerL2Name = s.signerL2Name || signer2Name;
    const signerL2Id = s.signerL2Id || signer2Id;
    const signerL2Title = s.signerL2Title || s.signer2Title;
    const signerL2Top = s.signerL2Top || signer2Top;
    const signerL2Left = s.signerL2Left || signer2Left;
    const signerL2LineWidth = s.signerL2LineWidth || s.signer2LineWidth;
    
    // [UPDATE] Remove toUpperCase()
    const signerL2TitleHtml = (signerL2Title || '').split('|').map(line => `<p style="margin: 0;">${line}</p>`).join('');
    const signerL2LineWidthStyle = signerL2LineWidth ? `width: ${s.signerL2LineWidth}px;` : '';
    const signerL2BlockStyle = `width:45%; text-align:center; position: relative; top: ${signerL2Top}px; left: ${signerL2Left}px;`;


    const lampiran1HTML = 
    `
      <div class="page ${paperClass}" style="${pageStyle}">
        <div style="text-align: left; font-family: 'Calibri', sans-serif; font-size: 12pt; font-weight:bold; line-height: 1.2;">
            <p style="margin: 0; padding: 0;">${headerLine1}</p>
            <p style="margin: 0; padding: 0 0 0 30px;">${headerLine2}</p>
        </div>
        ${headerLineHtml}
        
        <div style="display: flex; justify-content: center; margin-top: 2px;">
            <div style="font-weight: bold; font-size:12pt; text-decoration: underline; margin:0;">LAMPIRAN I</div>
        </div>
        
        <div style="${infoBlockStyle}">
            <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
              <table style="font-size:11pt; border-collapse:collapse; line-height: 1.2;">
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">NO IJAZAH</td>
                  <td style="vertical-align: top;">: ${noIjazah}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">NAMA</td>
                  <td style="vertical-align: top;">: ${namaSiswa}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">PANGKAT / NRP</td>
                  <td style="vertical-align: top;">: ${pangkat} / ${nrpSiswa}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td>
                  <td style="vertical-align: top; max-width: 350px;">
                    <div style="display: flex; align-items: flex-start;">
                        <span style="white-space: pre;">: </span>
                        <div style="line-height: 1.2;">
                            <span>${jenisDik_main}</span><br>
                            <span>${jenisDik_ta}</span>
                        </div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
        </div>
        
        <div style="text-align:center; margin-top: 0.5rem;">
            <p style="font-weight:bold; text-decoration:underline; font-size: ${mainTitleSize}pt; margin:0;">DAFTAR NILAI AKADEMIK</p>
            <p style="font-size: ${subTitleSize}pt; margin:0;">(TRANSKRIP)</p>
        </div>

        <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${noSeri}</p>

        <table style="width:100%; border-collapse: collapse; font-size:${tableBodySize}pt; text-transform: uppercase;">
          <thead style="display: table-header-group; background-color:${tableHeaderBg}; color:${tableHeaderText}; font-size:${tableHeaderSize}pt; text-align:center; font-weight: bold;">
            <tr style="height: auto;">
              <th rowspan="2" style="${thStyle} width: 5%;">NO</th>
              <th rowspan="2" style="${thStyle} width: 50%;">MATA PELAJARAN</th>
              <th colspan="2" style="${thStyle}">NILAI</th>
            </tr>
            <tr style="height: auto;">
              <th style="${thStyle} width: 15%;">ANGKA</th>
              <th style="${thStyle} width: 30%;">HURUF</th>
            </tr>
            <tr style="height: auto; text-align: center; font-size: ${tableBodySize}pt; font-weight: normal;">
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">1</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">2</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">3</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">4</td>
            </tr>
          </thead>
          <tbody>
            ${mapels.map((mapel, index) => `
              <tr style="height: auto;">
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black; border-right: 1pt solid black; vertical-align: top;">${index + 1}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${mapel.nama.toUpperCase()}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-right: 1pt solid black; vertical-align: top;">${mapel.nilai}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${terbilang(mapel.nilai).toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="height: auto;">
                <td colspan="2" style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">JUMLAH</td>
                <td style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">${rekap.totalNilaiAkademik.toFixed(0)}</td>
                <td style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:left; border: 1pt solid black;">${terbilang(rekap.totalNilaiAkademik).toUpperCase()}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="padding-top:2rem; display:flex; justify-content:space-between; font-size:11pt; line-height: 1;">
            
            <div style="${signer1BlockStyle}">
                ${signer1TitleHtml}
                <div style="height:80px;"></div>
                <div style="display: inline-block; ${signer1LineWidthStyle}">
                    <p style="margin: 0; font-weight:bold; text-transform: uppercase; padding: 0 4px;">${signer1Name}</p>
                    <div style="border-top: 1pt solid black; margin-top: 1px; margin-bottom: 1px;"></div>
                </div>
                <p style="margin: 0; text-transform: uppercase;">${signer1Id}</p>
            </div>

            <div style="${signer2BlockStyle}">
                ${signer2TitleHtml}
                <div style="height:80px;"></div>
                <div style="display: inline-block; ${signer2LineWidthStyle}">
                    <p style="margin: 0; font-weight:bold; text-transform: uppercase; padding: 0 10px;">${signer2Name}</p>
                    <div style="border-top: 1pt solid black; margin-top: 1px; margin-bottom: 1px;"></div>
                </div>
                <p style="margin: 0; text-transform: uppercase;">${signer2Id}</p>
            </div>

        </div>
      </div>
    `;

    // REKAPITULASI (PRINT) DENGAN MERGE CELL & FULL BORDER
    let rekapitulasiBody = `
        <tr style="height: auto;">
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">I</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">MENTAL KEPRIBADIAN</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">${rekap.rerataKepribadian.toFixed(2).replace('.', ',')}</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">${terbilangKoma(rekap.rerataKepribadian).toUpperCase()}</td>
        </tr>
        <tr style="height: auto;">
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">II</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">AKADEMIK</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">${rekap.rerataAkademik.toFixed(2).replace('.', ',')}</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">${terbilangKoma(rekap.rerataAkademik).toUpperCase()}</td>
        </tr>
    `;
    
    if (siswa.kategori !== 'Dikbangspes') {
        rekapitulasiBody += `
        <tr style="height: auto;">
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">III</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">KESEHATAN JASMANI</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">${rekap.rerataJasmani.toFixed(2).replace('.', ',')}</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">${terbilangKoma(rekap.rerataJasmani).toUpperCase()}</td>
        </tr>
        <tr style="height: auto; font-weight: bold;">
            <td colspan="2" style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">NILAI AKHIR</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">${rekap.nilaiAkhir.toFixed(2).replace('.', ',')}</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">${terbilangKoma(rekap.nilaiAkhir).toUpperCase()}</td>
        </tr>`;
    } else {
        rekapitulasiBody += `
        <tr style="height: auto; font-weight: bold;">
            <td colspan="2" style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">NILAI AKHIR</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border: 1pt solid black;">${rekap.nilaiAkhir.toFixed(2).replace('.', ',')}</td>
            <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border: 1pt solid black;">${terbilangKoma(rekap.nilaiAkhir).toUpperCase()}</td>
        </tr>`;
    }

    const lampiran2HTML = `
  <div class="page ${paperClass}" style="${pageStyle}">
    <div style="font-family: 'Calibri', sans-serif; font-size: 12pt; text-align:left; font-weight:bold; line-height: 1.1;">
      <p style="margin: 0; padding: 0;">${headerLine1}</p>
      <p style="margin: 0; padding: 0 0 0 30px;">${headerLine2}</p>
    </div>
    ${headerLineHtml}

    <div style="display: flex; justify-content: center; margin-top: 2px;">
      <div style="font-weight: bold; font-size:12pt; text-decoration: underline;">LAMPIRAN II</div>
    </div>
    
    <div style="${infoBlockStyle}">
        <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
          <table style="font-size:11pt; border-collapse:collapse; line-height: 1.2;">
            
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NO IJAZAH</td><td>: ${noIjazah}</td></tr>
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NAMA</td><td>: ${namaSiswa}</td></tr>
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">PANGKAT / NRP</td><td>: ${pangkat} / ${nrpSiswa}</td></tr>
            <tr>
              <td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td>
              <td style="vertical-align: top; max-width: 350px;">
                <div style="display: flex; align-items: flex-start;">
                    <span style="white-space: pre;">: </span>
                    <div style="line-height: 1.2;">
                        <span>${jenisDik_main}</span><br>
                        <span>${jenisDik_ta}</span>
                    </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
    </div>

    <div style="text-align:center; margin-top: 0.7rem;">
      <p style="font-weight:bold; text-decoration:underline; font-size: 12pt; margin:0;">REKAPITULASI NILAI</p>
    </div>

    <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${noSeri}</p>

    <table style="width:100%; border-collapse: collapse; font-size:${tableBodySize}pt; text-transform: uppercase;">
      <thead style="display: table-header-group; background-color:${tableHeaderBg}; color:${tableHeaderText}; font-size:${tableHeaderSize}pt; text-align:center; font-weight:bold;">
        <tr>
          <th rowspan="2" style="${thStyle}">NO</th>
          <th rowspan="2" style="${thStyle}">ASPEK YANG DINILAI</th>
          <th colspan="2" style="${thStyle}">NILAI</th>
        </tr>
        <tr>
          <th style="${thStyle}">ANGKA</th>
          <th style="${thStyle}">HURUF</th>
        </tr>
        <tr style="height: auto; text-align: center; font-size: ${tableBodySize}pt; font-weight: normal;">
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">1</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">2</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">3</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">4</td>
        </tr>
      </thead>
      <tbody>
        ${rekapitulasiBody}
        <tr style="height: auto;">
            <td colspan="4" style="border: 1pt solid black; padding: 2pt; text-align: left;">
                PERINGKAT KE : ${peringkat} DARI ${totalSiswa} SISWA
            </td>
        </tr>
      </tbody>
    </table>

    <div style="padding-top:2rem; display: flex; justify-content: flex-end; font-size:11pt; line-height: 1;">
        <div style="${signerL2BlockStyle}">
            ${signerL2TitleHtml}
            <div style="height:80px;"></div>
            <div style="display: inline-block; ${signerL2LineWidthStyle}">
                <p style="margin: 0; font-weight:bold; text-transform: uppercase; padding: 0 4px;">${signerL2Name}</p>
                <div style="border-top: 1pt solid black; margin-top: 1px; margin-bottom: 1px;"></div>
            </div>
            <p style="margin: 0; text-transform: uppercase;">${signerL2Id}</p>
        </div>
    </div>
  </div>
`;

    return lampiran1HTML + lampiran2HTML;
};


const openTranskripEditModal = (siswaId) => {
    const siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa) return;

    document.getElementById('transkrip-edit-siswa-id').value = siswa.id;
    document.getElementById('transkrip-edit-nama').value = siswa.nama;
    document.getElementById('transkrip-edit-ijazah').value = siswa.noIjazah || '';
    document.getElementById('transkrip-edit-seri').value = siswa.noSeri || '';
    
    openModal('transkrip-edit-modal');
};

const handleTranskripEditFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan data...');

    const siswaId = document.getElementById('transkrip-edit-siswa-id').value;
    const dataToUpdate = {
        noIjazah: document.getElementById('transkrip-edit-ijazah').value,
        noSeri: document.getElementById('transkrip-edit-seri').value
    };

    try {
        await updateStudent(siswaId, dataToUpdate);
        alert('Data transkrip berhasil diperbarui!');
        closeModal('transkrip-edit-modal');
        const siswaIndex = localStudents.findIndex(s => s.id === siswaId);
        if (siswaIndex > -1) {
            localStudents[siswaIndex] = { ...localStudents[siswaIndex], ...dataToUpdate };
        }
        renderTranskripSiswaListView();
    } catch (error) {
        console.error("Gagal memperbarui data transkrip:", error);
        alert('Gagal menyimpan perubahan.');
    } finally {
        hideLoading();
    }
};

const handlePrintAllTranscripts = async () => {
    const { kategori, detail, tahun } = selectedTranskripFilters;
    const searchTerm = searchTranskripInput ? searchTranskripInput.value.toLowerCase() : '';
    
    // 1. Ambil Siswa sesuai filter
    let filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun) &&
        (searchTerm ? s.nama.toLowerCase().includes(searchTerm) || (s.nosis && s.nosis.toLowerCase().includes(searchTerm)) : true)
    );

    if (filteredSiswa.length === 0) {
        alert('Tidak ada siswa untuk dicetak.');
        return;
    }

    if (!confirm(`Anda akan mencetak ${filteredSiswa.length} transkrip. Proses ini mungkin membutuhkan waktu. Lanjutkan?`)) {
        return;
    }

    showLoading(`Menghitung peringkat untuk ${filteredSiswa.length} siswa...`);

    // 2. Hitung Peringkat DULU untuk semua siswa yang difilter
    const ranks = await calculateAllStudentRanks(filteredSiswa);
    const totalSiswaDiKelas = filteredSiswa.length;

    // 3. [BARU] Urutkan Array Siswa Berdasarkan Peringkat (1 ke Terbesar)
    filteredSiswa.sort((a, b) => {
        const rankA = ranks[a.id] || 999999; // Default rank besar jika tidak ada
        const rankB = ranks[b.id] || 999999;
        return rankA - rankB; // Ascending (Kecil ke Besar)
    });

    showLoading(`Mempersiapkan halaman cetak... (0%)`);

    let allTranscriptsHtml = '';
    let count = 0;

    // 4. Loop siswa yang SUDAH TERURUT peringkatnya
    for (const siswa of filteredSiswa) {
        count++;
        if (count % 5 === 0) {
             showLoading(`Mempersiapkan halaman cetak... (${Math.round((count/totalSiswaDiKelas)*100)}%)`);
        }

        const peringkatSiswa = ranks[siswa.id];
        const academicScores = await getAcademicScores(siswa.id);
        const relevantMapels = localMapels
            .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
            .map(mapel => ({ ...mapel, nilai: academicScores[mapel.id] ?? 0 }))
            .sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));

        const totalNilaiAkademik = relevantMapels.reduce((sum, m) => sum + m.nilai, 0);
        
        const rerataAkademik_raw = relevantMapels.length > 0 ? (totalNilaiAkademik / relevantMapels.length) : 0;
        const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
        
        const rerataKepribadian = getNilaiKepribadianDebug(siswa);
        
        let nilaiJasmaniList = [];
        let rerataJasmani = 0;
        let nilaiAkhir = 0;

        if (siswa.kategori !== 'Dikbangspes') {
            nilaiJasmaniList = siswa.nilaiJasmani || [];
            rerataJasmani = nilaiJasmaniList.length > 0 ? (nilaiJasmaniList.reduce((a, b) => a + b, 0) / nilaiJasmaniList.length) : 0;
            nilaiAkhir = ((rerataAkademik * 4) + (rerataKepribadian * 4) + (rerataJasmani * 2)) / 10;
        } else {
            nilaiAkhir = (rerataAkademik + rerataKepribadian) / 2;
        }

        const rekap = { totalNilaiAkademik, rerataAkademik, rerataKepribadian, rerataJasmani, nilaiAkhir };

        allTranscriptsHtml += generateTranscriptHTML(siswa, relevantMapels, rekap, peringkatSiswa, totalSiswaDiKelas);
    }

    showLoading('Membuka jendela cetak...');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Cetak Semua Transkrip (Urut Peringkat) - ${kategori} ${detail} (TA ${tahun})</title>
                <link rel="stylesheet" href="style.css"> 
                <style>
                    body { margin: 0; background-color: #ccc; }
                    @media print { body { background-color: white; } }
                </style>
            </head>
            <body>${allTranscriptsHtml}</body>
        </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
        hideLoading();
        printWindow.focus();
        printWindow.print();
    }, 1500);
};

const exportTranskripDataToExcel = () => {
    const { kategori, detail, tahun } = selectedTranskripFilters;
    const filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

    if (filteredSiswa.length === 0) {
        alert('Tidak ada data untuk diekspor.');
        return;
    }
    showLoading('Mengekspor data...');
    try {
        const dataForSheet = filteredSiswa.map(s => ({
            'Nosis': s.nosis,
            'Nama Lengkap': s.nama,
            'No. Ijazah': s.noIjazah || '',
            'No. Seri': s.noSeri || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Transkrip");

        const fileName = `Data_Ijazah_${kategori}_${detail}_TA${tahun}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Gagal mengekspor data ijazah:", error);
        alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
        hideLoading();
    }
};

const importTranskripDataFromExcel = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ".xlsx, .xls";
    
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Mengimpor data ijazah...');
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

                let updatedCount = 0;
                let notFoundCount = 0;
                let notFoundNosis = [];
                const { kategori, detail, tahun } = selectedTranskripFilters;

                const updatePromises = jsonData.map(row => {
                    const nosis = String(row['Nosis']);
                    const siswa = localStudents.find(s => 
                        String(s.nosis) === nosis &&
                        s.kategori === kategori &&
                        s.detailPendidikan === detail &&
                        s.tahunAjaran === parseInt(tahun)
                    );

                    if (siswa) {
                        const dataToUpdate = {
                            noIjazah: String(row['No. Ijazah'] || ''),
                            noSeri: String(row['No. Seri'] || '')
                        };
                        
                        if (siswa.noIjazah === dataToUpdate.noIjazah && siswa.noSeri === dataToUpdate.noSeri) {
                            return Promise.resolve();
                        }
                        
                        updatedCount++;
                        return updateStudent(siswa.id, dataToUpdate);
                    } else {
                        notFoundCount++;
                        notFoundNosis.push(nosis);
                        return Promise.resolve();
                    }
                });

                await Promise.all(updatePromises);
                
                let message = `Proses impor selesai. ${updatedCount} data siswa berhasil diperbarui.`;
                if(notFoundCount > 0) {
                    message += `\n\n${notFoundCount} data tidak ditemukan di grup ini (Nosis: ${notFoundNosis.join(', ')}).`;
                }
                
                alert(message);

                if (updatedCount > 0) {
                    jsonData.forEach(row => {
                         const nosis = String(row['Nosis']);
                         const siswaIndex = localStudents.findIndex(s => 
                            String(s.nosis) === nosis &&
                            s.kategori === kategori &&
                            s.detailPendidikan === detail &&
                            s.tahunAjaran === parseInt(tahun)
                         );
                         if (siswaIndex > -1) {
                            localStudents[siswaIndex].noIjazah = String(row['No. Ijazah'] || '');
                            localStudents[siswaIndex].noSeri = String(row['No. Seri'] || '');
                         }
                    });
                    renderTranskripSiswaListView();
                }

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

export const initTranskripModule = async (studentsData, mapelsData, taData, settingsData) => {
    localStudents = studentsData;
    localMapels = mapelsData;
    localTahunAjaran = taData;
    localSettings = settingsData; 
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    window.debugTranskrip = true; 

    if (currentUser.role === 'siswa') {
        
        if (!localStudents || localStudents.length === 0) {
            console.log("Transkrip: Menunggu data siswa...");
            return; 
        }

        const section = document.getElementById('transkrip-nilai-section');
        if (section) {
            try {
                const template = localSettings?.transcript?.template || 'klasik';
                let viewFile = './components/transkrip_siswa_view.html'; 
                
                if (template === 'modern') {
                     viewFile = './components/transkrip_siswa_view.html';
                } else {
                     viewFile = './components/transkrip_siswa_view.html';
                }

                const response = await fetch(viewFile);
                if (!response.ok) throw new Error(`File ${viewFile} not found`);
                section.innerHTML = await response.text();
                
                const downloadBtn = section.querySelector('#btn-download-pdf-view');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', downloadTranscriptAsPdf);
                } else {
                    console.warn("Tombol download PDF tidak dapat diinisialisasi di view siswa.");
                }
                
                await openTranskripModal(currentUser.id);
                
                if (template === 'klasik') {
                    const modernView = document.getElementById('modern-transcript-view-siswa');
                    if (modernView) modernView.classList.add('hidden');
                    const printView = document.getElementById('printable-transcript');
                    if(printView) printView.classList.remove('hidden'); 
                }

            } catch (error) {
                console.error('Gagal memuat view transkrip siswa:', error);
                section.innerHTML = '<p class="text-red-500 text-center">Gagal memuat halaman.</p>';
            }
        }
    } else {
        if (!window.transkripModuleInitialized) {
            mainTranskripView = document.getElementById('transkrip-main-view');
            listTranskripView = document.getElementById('transkrip-list-view');
            backButtonTranskrip = document.getElementById('btn-back-transkrip');
            titleTranskrip = document.getElementById('transkrip-view-title');
            transkripSiswaTableBody = document.getElementById('transkrip-siswa-table-body');
            searchTranskripInput = document.getElementById('search-transkrip-siswa-input'); // [FIXED ID]
            modernTranscriptView = document.getElementById('modern-transcript-view');
            transkripEditModal = document.getElementById('transkrip-edit-modal');
            transkripEditForm = document.getElementById('transkrip-edit-form');
            
            if (transkripEditForm) {
                transkripEditForm.addEventListener('submit', handleTranskripEditFormSubmit);
            }

            if (modernTranscriptView) {
                fetch('./components/transkrip_detail_modern.html')
                    .then(res => res.text())
                    .then(html => modernTranscriptView.innerHTML = html)
                    .catch(err => console.error("Gagal memuat detail transkrip modern:", err));
            }

            const viewContainer = document.getElementById('transkrip-view-container');
            if (viewContainer) {
                viewContainer.addEventListener('click', (e) => {
                    const groupBtn = e.target.closest('.btn-view-transkrip-group');
                    const viewBtn = e.target.closest('.btn-lihat-transkrip');
                    const editBtn = e.target.closest('.btn-edit-transkrip-data');
                    
                    // --- PAGINATION HANDLERS ---
                    const prevBtn = e.target.closest('.btn-prev-cat');
                    const nextBtn = e.target.closest('.btn-next-cat');

                    if (prevBtn) {
                        const kategori = prevBtn.dataset.kategori;
                        if (categoryPageMap[kategori] > 1) {
                            categoryPageMap[kategori]--;
                            renderTranskripMainView();
                        }
                    } else if (nextBtn) {
                        const kategori = nextBtn.dataset.kategori;
                        categoryPageMap[kategori]++;
                        renderTranskripMainView();
                    }
                    // --------------------------

                    else if (groupBtn) {
                        selectedTranskripFilters = { ...groupBtn.dataset };
                        mainTranskripView.classList.add('hidden');
                        listTranskripView.classList.remove('hidden');
                        backButtonTranskrip.classList.remove('hidden');
                        
                        // [UPDATE] Tampilan Judul
                        let displayDetail = selectedTranskripFilters.detail;
                        if(displayDetail === '-' || !displayDetail) displayDetail = selectedTranskripFilters.kategori;

                        titleTranskrip.textContent = `${displayDetail} (TA ${selectedTranskripFilters.tahun})`.toUpperCase();
                        
                        transkripCurrentPage = 1;

                        // [BARU] Hitung peringkat dulu sebelum me-render tabel
                        showLoading('Memuat daftar siswa & peringkat...');
                        const studentGroup = localStudents.filter(s =>
                            s.kategori === selectedTranskripFilters.kategori &&
                            s.detailPendidikan === selectedTranskripFilters.detail &&
                            s.tahunAjaran === parseInt(selectedTranskripFilters.tahun)
                        );
                        
                        calculateAllStudentRanks(studentGroup).then(ranks => {
                            currentTranskripRanks = ranks;
                            hideLoading();
                            renderTranskripSiswaListView();
                        }).catch(err => {
                            console.error("Gagal menghitung peringkat", err);
                            currentTranskripRanks = {};
                            hideLoading();
                            renderTranskripSiswaListView();
                        });
                    }
                    else if (viewBtn) {
                        openTranskripModal(viewBtn.dataset.id);
                    }
                    else if (editBtn) {
                        openTranskripEditModal(editBtn.dataset.id);
                    }
                });
            }

            if (backButtonTranskrip) {
                backButtonTranskrip.addEventListener('click', () => {
                    mainTranskripView.classList.remove('hidden');
                    listTranskripView.classList.add('hidden');
                    backButtonTranskrip.classList.add('hidden');
                    titleTranskrip.textContent = 'Transkrip Nilai Siswa';
                    const subtitle = document.getElementById('transkrip-view-subtitle');
                    if(subtitle) subtitle.innerHTML = '';
                    if (searchTranskripInput) searchTranskripInput.value = ''; 
                });
            }

            if (searchTranskripInput) {
                searchTranskripInput.addEventListener('input', () => {
                    transkripCurrentPage = 1;
                    renderTranskripSiswaListView();
                });
            }

            // [BARU] Event Listener untuk Dropdown Sort
            const sortSelect = document.getElementById('sort-transkrip-siswa-select');
            if (sortSelect) {
                sortSelect.addEventListener('change', () => {
                    transkripCurrentPage = 1; // reset ke halaman 1
                    renderTranskripSiswaListView();
                });
            }

            document.getElementById('btn-print-transkrip')?.addEventListener('click', () => {
                const printableElement = document.getElementById('printable-transcript');
                const siswaId = printableElement?.dataset?.siswaId;
                
                if(siswaId && printableElement) {
                     const siswa = localStudents.find(s => s.id === siswaId);
                     const printTitle = `Transkrip_${siswa.nama.replace(/\s/g, '_')}_${siswa.nosis}`;
                     const printContent = printableElement.innerHTML;
                     const printWindow = window.open('', '_blank');
                     
                     printWindow.document.write(`
                         <html>
                             <head>
                                 <title>${printTitle}</title>
                                 <link rel="stylesheet" href="style.css"> 
                                 <style>
                                     body { margin: 0; }
                                     @media print {
                                         body { background-color: white; }
                                         .page { page-break-after: always; }
                                     }
                                 </style>
                             </head>
                             <body>${printContent}</body>
                         </html>
                     `);
                
                     printWindow.document.close();
                     setTimeout(() => { 
                         printWindow.focus();
                         printWindow.print();
                     }, 500);
                }
            });

            const btnPrintAll = document.getElementById('btn-print-all-transcripts');
            if (btnPrintAll) {
                btnPrintAll.addEventListener('click', handlePrintAllTranscripts);
            }

            const btnExportExcel = document.getElementById('btn-export-transkrip-excel');
            if(btnExportExcel) btnExportExcel.addEventListener('click', exportTranskripDataToExcel);

            const btnImportExcel = document.getElementById('btn-import-transkrip-excel');
            if(btnImportExcel) btnImportExcel.addEventListener('click', importTranskripDataFromExcel);
            
            window.transkripModuleInitialized = true;
        }
        renderTranskripMainView();
    }
};