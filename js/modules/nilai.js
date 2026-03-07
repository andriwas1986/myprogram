// js/modules/nilai.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { getAcademicScores, saveAcademicScores, addSimpleScore, updateNilaiInArray, deleteNilaiInArray, updateStudent } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localStudents = [];
let localMapels = [];
let localTahunAjaran = [];
let currentUser = {};
let selectedNilaiFilters = {};
let selectedKepribadianFilters = {};
let selectedJasmaniFilters = {};

// [BARU] State Cache untuk Nilai Akademik & Peringkat
let currentAkademikScoresCache = {};
let currentAkademikRanksCache = {};

// --- PAGINATION STATE ---
const ROWS_PER_CATEGORY_TABLE = 4;
let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1
};

// --- VARIABEL UI ---
let mainAkademikView, listAkademikView, backButtonAkademik, titleAkademik, subtitleAkademik;
let mainKepribadianView, listKepribadianView, backButtonKepribadian, titleKepribadian, subtitleKepribadian;
let mainJasmaniView, listJasmaniView, backButtonJasmani, titleJasmani, subtitleJasmani;
let nilaiSiswaTableBody, searchNilaiSiswaInput, filterNilaiBatalyon, filterNilaiKompi, filterNilaiPeleton, inputNilaiForm;
let nilaiKepribadianTableBody, searchKepribadianInput, kepribadianModal, kepribadianForm;
let nilaiJasmaniTableBody, searchJasmaniInput, jasmaniModal, jasmaniForm;

let akademikCurrentPage = 1;
const AKADEMIK_ROWS_PER_PAGE = 10;

const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return '-';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
};


// ======================================================
// --- FUNGSI TAMPILAN SISWA (READ-ONLY) ---
// ======================================================

const renderStudentAkademikView = (allMapels, academicScores) => {
    const tableBody = document.getElementById('view-nilai-akademik-table-body');
    const infoContainer = document.getElementById('info-siswa-akademik');
    if (!tableBody || !infoContainer) return;

    infoContainer.innerHTML = `<strong>${currentUser.nama}</strong><br>Nosis: ${currentUser.nosis}`;
    
    const relevantMapels = allMapels
        .filter(m => m.tahunAjaran === currentUser.tahunAjaran && m.kategori === currentUser.kategori && m.detailPendidikan === currentUser.detailPendidikan)
        .map(mapel => ({ ...mapel, nilai: academicScores[mapel.id] ?? 0 }))
        .sort((a, b) => a.kode.localeCompare(b.kode));
    
    if (relevantMapels.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-subtle">Belum ada mata pelajaran yang tersedia.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    relevantMapels.forEach((mapel, index) => {
        const nilai = mapel.nilai;
        const keterangan = nilai >= 70 ? 'Lulus' : 'Belum Lulus';
        const keteranganClass = nilai >= 70 ? 'text-green-500' : 'text-yellow-500';
        
        const row = document.createElement('tr');
        row.className = 'border-b border-main';
        row.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3">${mapel.kode}</td>
            <td class="p-3 font-medium">${mapel.nama}</td>
            <td class="p-3 text-center font-semibold">${nilai}</td>
            <td class="p-3 text-center font-semibold ${keteranganClass}">${keterangan}</td>
        `;
        tableBody.appendChild(row);
    });
};

const renderStudentSimpleScoreView = (infoId, tableBodyId, avgId, scoreField) => {
    const tableBody = document.getElementById(tableBodyId);
    const infoContainer = document.getElementById(infoId);
    const avgContainer = document.getElementById(avgId);
    if (!tableBody || !infoContainer || !avgContainer) return;

    infoContainer.innerHTML = `<strong>${currentUser.nama}</strong><br>Nosis: ${currentUser.nosis}`;

    const nilaiList = currentUser[scoreField] || [];
    const total = nilaiList.reduce((a, b) => a + b, 0);
    const rata2 = nilaiList.length > 0 ? (total / nilaiList.length).toFixed(2) : "0.00";
    avgContainer.textContent = rata2;

    if (nilaiList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="2" class="text-center p-4 text-subtle">Belum ada nilai yang diinput.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = '';
    nilaiList.forEach((nilai, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main';
        row.innerHTML = `
            <td class="p-3">Penilaian Ke-${index + 1}</td>
            <td class="p-3 text-center font-semibold">${(typeof nilai === 'number' ? nilai.toFixed(2) : nilai)}</td>
        `;
        tableBody.appendChild(row);
    });
};

const renderStudentViews = async () => {
    showLoading('Memuat nilai...');
    const academicScores = await getAcademicScores(currentUser.id);
    
    renderStudentAkademikView(localMapels, academicScores);
    renderStudentSimpleScoreView('info-siswa-kepribadian', 'view-nilai-kepribadian-table-body', 'rata-rata-kepribadian', 'nilaiKepribadian');
    
    if (currentUser.kategori !== 'Dikbangspes') {
        renderStudentSimpleScoreView('info-siswa-jasmani', 'view-nilai-jasmani-table-body', 'rata-rata-jasmani', 'nilaiJasmani');
    } else {
        const jasmaniSection = document.getElementById('nilai-jasmani-section');
        if (jasmaniSection) jasmaniSection.classList.add('hidden');
    }

    hideLoading();
};

const loadStudentNilaiViews = async () => {
    const sections = {
        'nilai-akademik-section': './components/nilai_siswa_akademik_view.html',
        'nilai-kepribadian-section': './components/nilai_siswa_kepribadian_view.html',
        'nilai-jasmani-section': './components/nilai_siswa_jasmani_view.html'
    };

    for (const sectionId in sections) {
        try {
            const response = await fetch(sections[sectionId]);
            const html = await response.text();
            document.getElementById(sectionId).innerHTML = html;
        } catch (error) {
            console.error(`Gagal memuat view untuk ${sectionId}:`, error);
            document.getElementById(sectionId).innerHTML = `<p class="text-red-500">Gagal memuat konten.</p>`;
        }
    }
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


// ======================================================
// --- BAGIAN NILAI AKADEMIK (ADMIN/GADIK) ---
// ======================================================

const renderAkademikMainView = () => {
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
            
            let displayName = p.detail;
            if (p.detail === '-' || !p.detail) {
                displayName = p.jenis;
            } else {
                displayName = `${p.jenis} ${p.detail}`;
            }
            
            const statusBadge = p.isActive 
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded border border-red-400">ARSIP</span>`;

            const btnText = p.isActive ? 'Input' : 'Lihat';
            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';

            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${displayName.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-nilai-group" 
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

    renderCategoryTable('Diktuk Tamtama', 'nilai-akademik-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'nilai-akademik-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'nilai-akademik-dikbangspes-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'nilai-akademik-dikbangum-sekolah-bintara-polisi-table-body');
};

const renderAkademikPagination = (totalItems, totalPages) => {
    const paginationContainer = document.getElementById('nilai-akademik-pagination');
    if (!paginationContainer) return;

    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = `<span class="text-sm text-subtle">Menampilkan ${totalItems} dari ${totalItems} siswa</span>`;
        return;
    };

    const startItem = (akademikCurrentPage - 1) * AKADEMIK_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + AKADEMIK_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} siswa
        </span>
        <div class="inline-flex mt-2 xs:mt-0">
            <button id="prev-akademik-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                Sebelumnya
            </button>
            <button id="next-akademik-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                Selanjutnya
            </button>
        </div>
    `;
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-akademik-page');
    const nextButton = document.getElementById('next-akademik-page');

    if (akademikCurrentPage === 1) {
        prevButton.disabled = true;
    }
    if (akademikCurrentPage >= totalPages) {
        nextButton.disabled = true;
    }
};

// [BARU] Fungsi Menghitung Semua Peringkat Sekaligus 
const refreshAkademikRanks = async (filters) => {
    const { kategori, detail, tahun } = filters;
    const groupStudents = localStudents.filter(s => 
        s.kategori === kategori && 
        s.detailPendidikan === detail && 
        s.tahunAjaran === parseInt(tahun)
    );

    const allScoresPromises = groupStudents.map(async s => {
        const scores = await getAcademicScores(s.id);
        const totalNilai = Object.values(scores).reduce((sum, score) => sum + (parseFloat(score) || 0), 0);
        return { id: s.id, totalNilai };
    });

    const studentsWithScores = await Promise.all(allScoresPromises);

    // Sort descending by score
    studentsWithScores.sort((a, b) => b.totalNilai - a.totalNilai);

    let lastScore = -1;
    let rank = 0;
    let rankCounter = 0;

    currentAkademikScoresCache = {};
    currentAkademikRanksCache = {};

    studentsWithScores.forEach(s => {
        rankCounter++;
        if (s.totalNilai !== lastScore) rank = rankCounter;
        currentAkademikRanksCache[s.id] = rank;
        currentAkademikScoresCache[s.id] = s.totalNilai;
        lastScore = s.totalNilai;
    });
};

const renderNilaiAkademikSiswaTable = async () => {
    if (!nilaiSiswaTableBody) return;
    
    const { kategori, detail, tahun } = selectedNilaiFilters;
    const isActive = selectedNilaiFilters.active === 'true';

    if (subtitleAkademik) {
        const tahunAjaranData = localTahunAjaran.find(ta => ta.tahun === parseInt(tahun) && ta.pendidikan.some(p => p.jenis === kategori && p.detail === detail));
        const studentCount = localStudents.filter(s => s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === parseInt(tahun)).length;
        
        // [UPDATE] Membuat container badge biru dengan teks putih
        subtitleAkademik.innerHTML = `
            <div class="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-md font-medium shadow mt-2">
                Jumlah Siswa : ${studentCount} &nbsp; | &nbsp;
                Tanggal Mulai Dik : ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
                Tanggal Selesai Dik : ${formatDate(tahunAjaranData?.tanggalBerakhir)}
                ${!isActive ? '&nbsp; <span class="text-red-300 font-bold">(ARSIP - View Only)</span>' : ''}
            </div>
        `;
    }
    
    let filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun) &&
        (filterNilaiBatalyon.value ? s.batalyon === filterNilaiBatalyon.value : true) &&
        (filterNilaiKompi.value ? s.kompi === filterNilaiKompi.value : true) &&
        (filterNilaiPeleton.value ? s.peleton === filterNilaiPeleton.value : true) &&
        (searchNilaiSiswaInput.value ? s.nama.toLowerCase().includes(searchNilaiSiswaInput.value.toLowerCase()) || (s.nosis && String(s.nosis).includes(searchNilaiSiswaInput.value)) : true)
    );

    // [BARU] Ambil nilai dari dropdown sort
    const sortSelect = document.getElementById('sort-nilai-akademik-select');
    const sortValue = sortSelect ? sortSelect.value : 'nosis_asc';

    // [BARU] Terapkan Sorting
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
            const rankA = currentAkademikRanksCache[a.id] || 999999;
            const rankB = currentAkademikRanksCache[b.id] || 999999;
            return rankA - rankB; 
        }
        return 0;
    });

    const totalItems = filteredSiswa.length;
    const totalPages = Math.ceil(totalItems / AKADEMIK_ROWS_PER_PAGE);
    akademikCurrentPage = Math.min(Math.max(1, akademikCurrentPage), totalPages || 1);

    const startIndex = (akademikCurrentPage - 1) * AKADEMIK_ROWS_PER_PAGE;
    const endIndex = startIndex + AKADEMIK_ROWS_PER_PAGE;
    const paginatedSiswa = filteredSiswa.slice(startIndex, endIndex);

    if (totalItems === 0) {
        nilaiSiswaTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-subtle">Tidak ada data siswa yang cocok.</td></tr>`;
        renderAkademikPagination(0, 1);
        return;
    }

    nilaiSiswaTableBody.innerHTML = '';
    paginatedSiswa.forEach((siswa, index) => {
        const totalNilai = currentAkademikScoresCache[siswa.id] || 0;
        const ranking = currentAkademikRanksCache[siswa.id] || '-';
        const originalIndex = startIndex + index + 1;

        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        
        const inputBtn = isActive 
            ? `<button class="bg-blue-600 text-white text-xs py-1 px-3 rounded-md hover:bg-blue-700 btn-input-nilai ml-2" data-id="${siswa.id}"><i class="fas fa-edit mr-1"></i> Input</button>`
            : '';

        let detailPendidikanDisplay = siswa.detailPendidikan;
        if(detailPendidikanDisplay === '-' || !detailPendidikanDisplay) detailPendidikanDisplay = "";

        row.innerHTML = `
            <td class="p-3 text-center">${originalIndex}</td>
            <td class="p-3 font-medium">${siswa.nama}</td>
            <td class="p-3 text-center">${siswa.nosis}</td>
            <td class="p-3 text-center uppercase">${siswa.kategori} ${detailPendidikanDisplay}</td>
            <td class="p-3 text-center font-semibold">${totalNilai.toFixed(0)}</td>
            <td class="p-3 text-center font-bold text-blue-600">${ranking}</td> 
            <td class="p-3 text-center whitespace-nowrap">
                <button class="bg-green-600 text-white text-xs py-1 px-3 rounded-md hover:bg-green-700 btn-detail-nilai" data-id="${siswa.id}">
                    <i class="fas fa-eye mr-1"></i> Detail
                </button>
                ${inputBtn}
            </td>
        `;
        nilaiSiswaTableBody.appendChild(row);
    });
    renderAkademikPagination(totalItems, totalPages);
};

const openInputNilaiModal = async (siswaId) => {
    inputNilaiForm.reset();
    const mapelTableBody = document.getElementById('input-nilai-mapel-table-body');
    mapelTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Memuat...</td></tr>';
    openModal('input-nilai-modal');

    const siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa) {
        alert("Data siswa tidak ditemukan!");
        closeModal('input-nilai-modal');
        return;
    }

    document.getElementById('input-nilai-siswa-id').value = siswaId;
    document.getElementById('input-nilai-siswa-info').textContent = `${siswa.nama} - Nosis: ${siswa.nosis}`;

    const relevantMapels = localMapels
        .filter(m => 
            m.tahunAjaran === siswa.tahunAjaran && 
            m.kategori === siswa.kategori &&
            m.detailPendidikan === siswa.detailPendidikan
        )
        .sort((a, b) => a.kode.localeCompare(b.kode));

    if (relevantMapels.length === 0) {
        mapelTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle">Tidak ada mata pelajaran untuk kategori siswa ini.</td></tr>`;
        return;
    }

    const isGadik = currentUser.role === 'gadik';
    const isAdmin = currentUser.role === 'operator' || currentUser.role === 'super_admin';
    const gadikMapelIds = isGadik ? (currentUser.mapelDiampu || []).map(m => m.id) : [];
    const existingScores = await getAcademicScores(siswaId);

    mapelTableBody.innerHTML = '';
    relevantMapels.forEach((mapel, index) => {
        const canEdit = isAdmin || (isGadik && gadikMapelIds.includes(mapel.id));
        const existingValue = existingScores[mapel.id] ?? 0;
        const row = document.createElement('tr');
        row.className = 'border-b border-main';
        row.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3">${mapel.kode}</td>
            <td class="p-3 font-medium">${mapel.nama}</td>
            <td class="p-3">
                <input type="number" min="0" max="100" class="nilai-input bg-input border border-main text-main text-sm rounded-lg block w-full p-2.5 ${!canEdit ? 'bg-gray-600 cursor-not-allowed' : ''}" data-mapel-id="${mapel.id}" value="${existingValue}" ${!canEdit ? 'readonly' : ''}>
            </td>
        `;
        mapelTableBody.appendChild(row);
    });
};

const openNilaiAkademikDetailModal = async (siswaId) => {
    showLoading('Memuat detail nilai...');
    const siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa) {
        alert("Data siswa tidak ditemukan!");
        hideLoading();
        return;
    }

    document.getElementById('detail-akademik-foto').src = siswa.fotoUrl || 'https://placehold.co/150x150/e2e8f0/4a5568?text=Foto';
    document.getElementById('detail-akademik-nama').textContent = siswa.nama;
    
    let detailPendidikan = siswa.detailPendidikan;
    if (detailPendidikan === '-' || !detailPendidikan) detailPendidikan = "";
    
    document.getElementById('detail-akademik-kategori').textContent = `${siswa.kategori} ${detailPendidikan} (TA ${siswa.tahunAjaran})`.toUpperCase();
    document.getElementById('detail-akademik-nosis').textContent = siswa.nosis || '-';
    document.getElementById('detail-akademik-nrp').textContent = siswa.nrp || '-';


    const academicScores = await getAcademicScores(siswaId);
    const relevantMapels = localMapels
        .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
        .sort((a, b) => a.kode.localeCompare(b.kode));

    const tableBody = document.getElementById('akademik-detail-table-body');
    tableBody.innerHTML = '';
    let totalNilai = 0;

    if (relevantMapels.length > 0) {
        relevantMapels.forEach((mapel, index) => {
            const nilai = academicScores[mapel.id] ?? 0;
            totalNilai += nilai;
            const row = document.createElement('tr');
            row.className = 'border-b border-main';
            row.innerHTML = `
                <td class="p-3">${index + 1}</td>
                <td class="p-3">${mapel.nama}</td>
                <td class="p-3 text-center font-semibold">${nilai}</td>
                <td class="p-3">${terbilang(nilai)}</td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle">Belum ada mata pelajaran.</td></tr>`;
    }

    document.getElementById('akademik-detail-total-nilai').textContent = totalNilai.toFixed(0);
    document.getElementById('akademik-detail-total-terbilang').textContent = terbilang(totalNilai);
    
    hideLoading();
    openModal('nilai-akademik-detail-modal');
};

const handleNilaiAkademikSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan nilai...');
    const siswaId = document.getElementById('input-nilai-siswa-id').value;
    const scores = {};
    document.querySelectorAll('#input-nilai-modal .nilai-input').forEach(input => {
        if (input.value !== '' && !input.readOnly) {
            scores[input.dataset.mapelId] = parseFloat(input.value);
        }
    });

    try {
        await saveAcademicScores(siswaId, scores);
        alert('Nilai berhasil disimpan!');
        closeModal('input-nilai-modal');
        
        // [UPDATE] Hitung ulang peringkat sebelum render
        showLoading('Memperbarui peringkat...');
        await refreshAkademikRanks(selectedNilaiFilters);
        await renderNilaiAkademikSiswaTable();
    } catch (error) {
        console.error("Gagal menyimpan nilai akademik: ", error);
        alert('Gagal menyimpan nilai.');
    } finally {
        hideLoading();
    }
};


// ======================================================
// --- FUNGSI EKSPOR / IMPOR EXCEL ---
// ======================================================

const getWeekCount = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;
    try {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        let current = new Date(startDate);
        current.setDate(current.getDate() - (current.getDay() === 0 ? 6 : current.getDay() - 1));
        
        let totalWeeks = 0;
        while (current <= endDate) {
            let endOfWeek = new Date(current);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            if (endOfWeek >= startDate && current <= endDate) {
                totalWeeks++;
            }
            current.setDate(current.getDate() + 7);
        }
        return totalWeeks;
    } catch (e) { 
        console.error("Error calculating week count:", e);
        return 0; 
    }
};

const exportNilaiToExcel = async (type) => {
    let filters, students, mapels;
    
    if (type === 'akademik') {
        filters = selectedNilaiFilters;
    } else if (type === 'kepribadian') {
        filters = selectedKepribadianFilters;
    } else {
        filters = selectedJasmaniFilters;
    }

    students = localStudents.filter(s => 
        s.kategori === filters.kategori &&
        s.detailPendidikan === filters.detail &&
        s.tahunAjaran === parseInt(filters.tahun)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

    if (students.length === 0) {
        alert('Tidak ada data siswa untuk diekspor.');
        return;
    }

    showLoading('Mempersiapkan data ekspor...');
    
    let dataForSheet = [];
    const fileName = `Nilai_${type}_${filters.kategori}_${filters.detail}_TA${filters.tahun}.xlsx`;

    try {
        if (type === 'akademik') {
            mapels = localMapels.filter(m => m.kategori === filters.kategori && m.tahunAjaran === parseInt(filters.tahun) && m.detailPendidikan === filters.detail)
                                .sort((a, b) => a.kode.localeCompare(b.kode));
            
            for (const siswa of students) {
                const scores = await getAcademicScores(siswa.id);
                const row = {
                    'Nosis': siswa.nosis,
                    'Nama Lengkap': siswa.nama,
                };
                mapels.forEach(mapel => {
                    row[mapel.kode] = scores[mapel.id] ?? 0;
                });
                dataForSheet.push(row);
            }
        
        } else if (type === 'kepribadian' && (filters.kategori === 'Dikbangspes' || filters.kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI')) { 
            const tahunAjaranData = localTahunAjaran.find(ta => ta.tahun === parseInt(filters.tahun) && ta.pendidikan.some(p => p.jenis === filters.kategori && p.detail === filters.detail));
            const totalWeeks = getWeekCount(tahunAjaranData?.tanggalMulai, tahunAjaranData?.tanggalBerakhir);
            
            if (totalWeeks > 0) {
                const weekHeaderNames = Array.from({ length: totalWeeks }, (_, i) => `Minggu ${toRoman(i + 1)}`);
                
                dataForSheet = students.map(siswa => {
                    const row = {
                        'Nosis': siswa.nosis,
                        'Nama Lengkap': siswa.nama,
                    };
                    const nilaiList = siswa.nilaiKepribadian || [];
                    weekHeaderNames.forEach((header, index) => {
                        row[header] = (nilaiList[index] !== undefined && nilaiList[index] !== null) ? nilaiList[index] : '';
                    });
                    row['Nilai Sosiometri'] = (siswa.nilaiSosiometri !== undefined && siswa.nilaiSosiometri !== null) ? siswa.nilaiSosiometri : '';
                    return row;
                });
            } else {
                dataForSheet = students.map(siswa => ({
                    'Nosis': siswa.nosis,
                    'Nama Lengkap': siswa.nama,
                    'Nilai': (siswa.nilaiKepribadian || []).join(', '),
                    'Nilai Sosiometri': (siswa.nilaiSosiometri !== undefined && siswa.nilaiSosiometri !== null) ? siswa.nilaiSosiometri : ''
                }));
            }

        } else { 
            dataForSheet = students.map(siswa => {
                const nilaiField = type === 'jasmani' ? 'nilaiJasmani' : 'nilaiKepribadian';
                const nilaiArray = siswa[nilaiField] || [];
                return {
                    'Nosis': siswa.nosis,
                    'Nama Lengkap': siswa.nama,
                    'Nilai': nilaiArray.join(', ')
                };
            });
        }

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Nilai ${type}`);
        XLSX.writeFile(workbook, fileName);

    } catch (error) {
        console.error(`Gagal mengekspor ${type} ke Excel:`, error);
        alert('Gagal membuat file Excel.');
    } finally {
        hideLoading();
    }
};

const importNilaiFromExcel = (type) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ".xlsx, .xls";
    
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Mengimpor data nilai...');
        const reader = new FileReader();
        reader.onload = async (event) => {
            let processedCount = 0;
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                const jsonDataRaw = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: null });

                if (jsonDataRaw.length < 2) throw new Error("File Excel kosong atau hanya berisi header.");
                
                const headers = jsonDataRaw[0].map(h => String(h).trim());
                const dataRows = jsonDataRaw.slice(1);
                
                const nosisIndex = headers.indexOf('Nosis');
                if (nosisIndex === -1) throw new Error("Kolom 'Nosis' tidak ditemukan di file Excel.");

                let promises = [];
                if (type === 'akademik') {
                    const filters = selectedNilaiFilters;
                    const mapels = localMapels.filter(m => m.kategori === filters.kategori && m.tahunAjaran === parseInt(filters.tahun) && m.detailPendidikan === filters.detail);
                    const mapelCodeToId = Object.fromEntries(mapels.map(m => [m.kode, m.id]));

                    const mapelHeaderIndices = {}; 
                    headers.forEach((header, index) => {
                        const mapelId = mapelCodeToId[header];
                        if (mapelId) {
                            mapelHeaderIndices[index] = mapelId;
                        }
                    });

                    promises = dataRows.map(row => {
                        const nosis = String(row[nosisIndex] || '');
                        if (!nosis) return Promise.resolve(); 

                        const siswa = localStudents.find(s => String(s.nosis) === nosis && s.kategori === filters.kategori && s.tahunAjaran === parseInt(filters.tahun) && s.detailPendidikan === filters.detail);
                        if (siswa) {
                            processedCount++;
                            const scores = {};
                            Object.keys(mapelHeaderIndices).forEach(index => {
                                const mapelId = mapelHeaderIndices[index];
                                const scoreValue = row[index];
                                
                                if (scoreValue !== null && scoreValue !== undefined) {
                                    const parsedScore = parseFloat(String(scoreValue).replace(',', '.'));
                                    scores[mapelId] = isNaN(parsedScore) ? 0 : Math.max(0, Math.min(100, parsedScore));
                                } else {
                                    scores[mapelId] = 0;
                                }
                            });
                            return saveAcademicScores(siswa.id, scores);
                        }
                        return Promise.resolve();
                    });

                } else {
                    const filters = type === 'jasmani' ? selectedJasmaniFilters : selectedKepribadianFilters;
                    const nilaiField = type === 'jasmani' ? 'nilaiJasmani' : 'nilaiKepribadian';
                    
                    if (type === 'kepribadian' && (filters.kategori === 'Dikbangspes' || filters.kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI')) { 
                        const weekIndices = []; 
                        headers.forEach((h, i) => {
                            if (/^Minggu\s+[IVXLCDM]+$/i.test(h)) {
                                weekIndices.push(i);
                            }
                        });
                        
                        const sosiometriIndex = headers.indexOf('Nilai Sosiometri');
                        
                        promises = dataRows.map(row => {
                            const nosis = String(row[nosisIndex] || '');
                            if (!nosis) return Promise.resolve();
                            
                            const siswa = localStudents.find(s => String(s.nosis) === nosis && s.kategori === filters.kategori && s.tahunAjaran === parseInt(filters.tahun) && s.detailPendidikan === filters.detail);
                            if (siswa) {
                                processedCount++;
                                const nilaiArray = [];
                                weekIndices.forEach(index => {
                                    const scoreValue = row[index];
                                    if (scoreValue !== null && scoreValue !== undefined && String(scoreValue).trim() !== '') {
                                        const parsedScore = parseFloat(String(scoreValue).replace(',', '.'));
                                        nilaiArray.push(isNaN(parsedScore) ? null : Math.max(0, Math.min(100, parsedScore)));
                                    } else {
                                        nilaiArray.push(null);
                                    }
                                });
                                
                                while (nilaiArray.length > 0 && nilaiArray[nilaiArray.length - 1] === null) {
                                    nilaiArray.pop();
                                }
                                
                                const updateData = { [nilaiField]: nilaiArray };
                                
                                if (sosiometriIndex !== -1) {
                                    const sosiometriValue = row[sosiometriIndex];
                                    if (sosiometriValue !== null && sosiometriValue !== undefined && String(sosiometriValue).trim() !== '') {
                                        const parsedSosiometri = parseFloat(String(sosiometriValue).replace(',', '.'));
                                        if (!isNaN(parsedSosiometri)) {
                                            updateData.nilaiSosiometri = Math.max(0, Math.min(100, parsedSosiometri));
                                        }
                                    } else {
                                        updateData.nilaiSosiometri = null;
                                    }
                                }
                                
                                return updateStudent(siswa.id, updateData);
                            }
                            return Promise.resolve();
                        });

                    } else {
                        const nilaiIndex = headers.indexOf('Nilai');
                        if (nilaiIndex === -1) throw new Error("Kolom 'Nilai' tidak ditemukan. Pastikan file Excel memiliki kolom 'Nilai'.");

                        promises = dataRows.map(row => {
                            const nosis = String(row[nosisIndex] || '');
                            if (!nosis) return Promise.resolve();
                            
                            const siswa = localStudents.find(s => String(s.nosis) === nosis && s.kategori === filters.kategori && s.tahunAjaran === parseInt(filters.tahun) && s.detailPendidikan === filters.detail);
                            if (siswa) {
                                processedCount++;
                                const nilaiStr = String(row[nilaiIndex] || '');
                                const nilaiArray = nilaiStr.split(',')
                                                    .map(n => n.trim())
                                                    .filter(n => n !== '')
                                                    .map(n => parseFloat(n.replace(',', '.')))
                                                    .filter(n => !isNaN(n) && n >= 0 && n <= 100);
                                return updateStudent(siswa.id, { [nilaiField]: nilaiArray });
                            }
                            return Promise.resolve();
                        });
                    }
                }
                
                await Promise.all(promises);
                alert(`Berhasil mengimpor dan memproses ${processedCount} dari ${dataRows.length} baris data nilai! Data akan diperbarui secara otomatis.`);

                if (type === 'akademik' && typeof renderNilaiAkademikSiswaTable === 'function') {
                    // [UPDATE] Hitung ulang Peringkat setelah Impor
                    showLoading('Memperbarui peringkat...');
                    await refreshAkademikRanks(selectedNilaiFilters);
                    await renderNilaiAkademikSiswaTable();
                }
                if (type === 'kepribadian' && typeof renderNilaiKepribadianSiswaTable === 'function') {
                    renderNilaiKepribadianSiswaTable();
                }
                if (type === 'jasmani' && typeof renderNilaiJasmaniSiswaTable === 'function') {
                    renderNilaiJasmaniSiswaTable();
                }

            } catch (error) {
                console.error(`Gagal mengimpor nilai ${type}:`, error);
                alert(`Gagal mengimpor: ${error.message}`);
            } finally {
                hideLoading();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    fileInput.click();
};


// ======================================================
// --- BAGIAN NILAI KEPRIBADIAN & JASMANI (ADMIN/GADIK) ---
// ======================================================

const renderKepribadianMainView = () => {
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
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded border border-red-400">ARSIP</span>`;

            let namaPendidikan = p.detail;
            if (p.detail === '-' || !p.detail) {
                namaPendidikan = p.jenis;
            } else {
                namaPendidikan = `${p.jenis} ${p.detail}`;
            }
            
            const btnText = p.isActive ? 'Input' : 'Lihat';
            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';

            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${namaPendidikan.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-kepribadian-group" 
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

    renderCategoryTable('Diktuk Tamtama', 'nilai-kepribadian-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'nilai-kepribadian-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'nilai-kepribadian-dikbangspes-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'nilai-kepribadian-dikbangum-sekolah-bintara-polisi-table-body');
};

const toRoman = (num) => {
    if (isNaN(num) || num < 1) return String(num);
    
    const romanNumerals = [
        { value: 1000, numeral: "M" },
        { value: 900, numeral: "CM" },
        { value: 500, numeral: "D" },
        { value: 400, numeral: "CD" },
        { value: 100, numeral: "C" },
        { value: 90, numeral: "XC" },
        { value: 50, numeral: "L" },
        { value: 40, numeral: "XL" },
        { value: 10, numeral: "X" },
        { value: 9, numeral: "IX" },
        { value: 5, numeral: "V" },
        { value: 4, numeral: "IV" },
        { value: 1, numeral: "I" }
    ];
    
    let result = "";
    let number = num;

    for (const { value, numeral } of romanNumerals) {
        while (number >= value) {
            result += numeral;
            number -= value;
        }
    }
    return result;
};

const generateWeeklyHeaders = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) {
        return { monthHeaders: '', weekHeaders: '', totalWeeks: 0 };
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    let weeksByMonth = {};
    let current = new Date(startDate);
    
    current.setDate(current.getDate() - (current.getDay() === 0 ? 6 : current.getDay() - 1));

    let totalWeeks = 0;
    while (current <= endDate) {
        let endOfWeek = new Date(current);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        if (endOfWeek >= startDate && current <= endDate) {
            let thursday = new Date(current);
            thursday.setDate(thursday.getDate() + 3);
            
            const month = thursday.getMonth();
            const year = thursday.getFullYear();
            const monthYearKey = `${year}-${String(month).padStart(2, '0')}`;

            if (!weeksByMonth[monthYearKey]) {
                weeksByMonth[monthYearKey] = {
                    name: `${monthNames[month]} ${year}`,
                    weekLabels: []
                };
            }
            
            const firstDayOfMonth = new Date(year, month, 1);
            const firstMondayOfMonth = new Date(firstDayOfMonth);
            firstMondayOfMonth.setDate(firstMondayOfMonth.getDate() - (firstMondayOfMonth.getDay() === 0 ? 6 : firstMondayOfMonth.getDay() - 1));
            
            if (firstMondayOfMonth > firstDayOfMonth) {
                 firstMondayOfMonth.setDate(firstMondayOfMonth.getDate() - 7);
            }

            const weekNumber = Math.floor((current.getTime() - firstMondayOfMonth.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
            weeksByMonth[monthYearKey].weekLabels.push(toRoman(weekNumber));
            
            totalWeeks++;
        }
        
        current.setDate(current.getDate() + 7);
    }

    let monthHeaders = '';
    let weekHeaders = '';
    const sortedMonthKeys = Object.keys(weeksByMonth).sort();

    for (const key of sortedMonthKeys) {
        const monthData = weeksByMonth[key];
        monthHeaders += `<th colspan="${monthData.weekLabels.length}" class="p-2 text-center border-l border-main">${monthData.name}</th>`;
        weekHeaders += monthData.weekLabels.map(label => `<th class="p-2 text-center border-l border-main">${label}</th>`).join('');
    }

    return { monthHeaders, weekHeaders, totalWeeks };
};


const renderNilaiKepribadianSiswaTable = () => {
    if (!nilaiKepribadianTableBody) return;
    
    const { kategori, detail, tahun } = selectedKepribadianFilters;
    const searchTerm = searchKepribadianInput.value.toLowerCase();
    const isActive = selectedKepribadianFilters.active === 'true';
    
    const tahunAjaranData = localTahunAjaran.find(ta => ta.tahun === parseInt(tahun) && ta.pendidikan.some(p => p.jenis === kategori && p.detail === detail));
    
    let displayTitle = detail;
    if(detail === '-' || !detail) displayTitle = kategori;

    if (titleKepribadian) {
        titleKepribadian.textContent = `INPUT NILAI MENTAL KEPRIBADIAN: ${displayTitle.toUpperCase()} (TA ${tahun})`;
    }

    if (subtitleKepribadian) {
        const studentCount = localStudents.filter(s => s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === parseInt(tahun)).length;
        subtitleKepribadian.innerHTML = `
            Jumlah Siswa : ${studentCount} &nbsp; | &nbsp;
            Tanggal Mulai Dik : ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
            Tanggal Selesai Dik : ${formatDate(tahunAjaranData?.tanggalBerakhir)}
            ${!isActive ? '&nbsp; <span class="text-red-500 font-bold">(ARSIP - View Only)</span>' : ''}
        `;
    }

    const filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun) &&
        (searchTerm ? s.nama.toLowerCase().includes(searchTerm) || (s.nosis && String(s.nosis).includes(searchTerm)) : true)
    ); 
    
    const tableHead = document.getElementById('nilai-kepribadian-table-head');
    nilaiKepribadianTableBody.innerHTML = '';

    if (kategori === 'Dikbangspes' || kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI') { 
        const { monthHeaders, weekHeaders, totalWeeks } = generateWeeklyHeaders(tahunAjaranData?.tanggalMulai, tahunAjaranData?.tanggalBerakhir);
        
        tableHead.innerHTML = `
            <tr>
                <th rowspan="2" class="p-3 text-center sticky left-0 bg-tertiary z-10">No</th>
                <th rowspan="2" class="p-3 sticky left-12 bg-tertiary z-10 min-w-[200px]">Nama Lengkap</th>
                ${monthHeaders}
                <th rowspan="2" class="p-3 text-center">Nilai Instruktur</th>
                <th rowspan="2" class="p-3 text-center">Nilai Sosiometri</th>
                <th rowspan="2" class="p-3 text-center">Nilai Akhir</th>
                <th rowspan="2" class="p-3 text-center">Ranking</th>
            </tr>
            <tr>
                ${weekHeaders}
            </tr>
        `;

        if (filteredSiswa.length === 0) {
            nilaiKepribadianTableBody.innerHTML = `<tr><td colspan="${6 + totalWeeks}" class="text-center p-4">Tidak ada data siswa yang cocok.</td></tr>`;
            return;
        }

        const rankedSiswa = filteredSiswa.map(siswa => {
            const nilaiList = siswa.nilaiKepribadian || [];
            const validNilaiList = nilaiList.filter(n => n !== null && n !== undefined && !isNaN(n));
            const nilaiInstruktur = validNilaiList.length > 0 ? validNilaiList[validNilaiList.length - 1] : 0;
            const nilaiSosiometri = siswa.nilaiSosiometri || 0;
            const nilaiAkhir = (nilaiInstruktur * 0.7) + (nilaiSosiometri * 0.3);
            return { ...siswa, nilaiAkhir, nilaiInstruktur, nilaiSosiometri };
        }).sort((a, b) => b.nilaiAkhir - a.nilaiAkhir); 

        let lastScore = -1;
        let rank = 0;
        let rankCounter = 0;
        rankedSiswa.forEach((siswa) => {
            rankCounter++;
            if (siswa.nilaiAkhir !== lastScore) {
                rank = rankCounter;
            }
            siswa.rank = rank;
            lastScore = siswa.nilaiAkhir;
        });
        
        const finalSiswaList = rankedSiswa.sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

        finalSiswaList.forEach((siswa, index) => {
            const nilaiList = siswa.nilaiKepribadian || [];
            
            let weeklyScoresHtml = '';
            for (let i = 0; i < totalWeeks; i++) {
                const nilai = nilaiList[i];
                const pillClass = isActive ? 'score-pill' : 'px-2 py-1 bg-gray-100 rounded text-gray-600 cursor-default';
                const deleteBtn = isActive ? `<button class="score-delete-btn" data-siswa-id="${siswa.id}" data-index="${i}" title="Hapus nilai">&times;</button>` : '';
                const title = isActive ? 'Klik untuk input/edit' : 'View Only';

                weeklyScoresHtml += `<td class="p-2 text-center">
                    <span class="${pillClass} ${nilai !== undefined && nilai !== null ? '' : 'score-pill-empty'}" 
                          data-siswa-id="${siswa.id}" data-index="${i}" title="${title}">
                        ${(nilai !== undefined && nilai !== null) ? parseFloat(nilai).toFixed(2) : '-'}
                        ${(nilai !== undefined && nilai !== null) ? deleteBtn : ''}
                    </span>
                </td>`;
            }
            
            const tr = document.createElement("tr");
            tr.className = "border-b border-main hover:bg-tertiary";
            
            const sosiometriClass = isActive ? 'score-pill sosiometri-score' : 'px-2 py-1 bg-gray-100 rounded text-gray-600 cursor-default';
            const sosiometriTitle = isActive ? 'Klik untuk input/edit nilai sosiometri' : 'View Only';

            tr.innerHTML = `
                <td class="p-3 text-center sticky left-0 bg-card z-0">${index + 1}</td>
                <td class="p-3 font-medium sticky left-12 bg-card z-0">${siswa.nama}</td>
                ${weeklyScoresHtml}
                <td class="p-3 text-center font-semibold">${siswa.nilaiInstruktur.toFixed(2)}</td>
                <td class="p-3 text-center font-semibold">
                    <span class="${sosiometriClass}" data-siswa-id="${siswa.id}" title="${sosiometriTitle}">
                        ${(siswa.nilaiSosiometri ? parseFloat(siswa.nilaiSosiometri).toFixed(2) : '-')}
                    </span>
                </td>
                <td class="p-3 text-center font-bold text-blue-400">${siswa.nilaiAkhir.toFixed(2)}</td>
                <td class="p-3 text-center font-bold">${siswa.rank}</td>
            `;
            nilaiKepribadianTableBody.appendChild(tr);
        });

    } else { 
        tableHead.innerHTML = `
             <tr>
                <th class="p-3">No</th>
                <th class="p-3">Nama Lengkap</th>
                <th class="p-3">Nosis</th>
                <th class="p-3">Daftar Nilai</th>
                <th class="p-3 text-center">Rata-rata</th>
                <th class="p-3 text-center">Aksi</th>
                <th class="p-3 text-center">Ranking</th>
            </tr>
        `;

        if (filteredSiswa.length === 0) {
            nilaiKepribadianTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">Tidak ada data siswa yang cocok.</td></tr>`;
            return;
        }
        
        const rankedSiswa = filteredSiswa.map(siswa => {
            const nilaiList = siswa.nilaiKepribadian || [];
            const total = nilaiList.reduce((a, b) => a + b, 0);
            const rata2 = nilaiList.length > 0 ? (total / nilaiList.length) : 0;
            return { ...siswa, rata2 };
        }).sort((a, b) => b.rata2 - a.rata2); 

        let lastScore = -1;
        let rank = 0;
        let rankCounter = 0;
        rankedSiswa.forEach((siswa) => {
            rankCounter++;
            if (siswa.rata2 !== lastScore) {
                rank = rankCounter;
            }
            siswa.rank = rank;
            lastScore = siswa.rata2;
        });

        const finalSiswaList = rankedSiswa.sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

        finalSiswaList.forEach((siswa, index) => {
            const nilaiList = siswa.nilaiKepribadian || [];
            
            const nilaiHtml = nilaiList.map((nilai, i) => {
                const pillClass = isActive ? 'score-pill' : 'px-2 py-1 bg-gray-100 rounded text-gray-600 cursor-default inline-block mr-1 mb-1';
                const deleteBtn = isActive ? `<button class="score-delete-btn" data-siswa-id="${siswa.id}" data-index="${i}" title="Hapus nilai">&times;</button>` : '';
                const title = isActive ? 'Klik untuk edit' : 'View Only';

                return `<span class="${pillClass}" data-siswa-id="${siswa.id}" data-index="${i}" title="${title}">
                    ${parseFloat(nilai).toFixed(2)}
                    ${deleteBtn}
                </span>`;
            }).join('');

            const tr = document.createElement("tr");
            tr.className = "border-b border-main hover:bg-tertiary";
            
            const inputBtn = isActive 
                ? `<button class="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 text-sm btn-input-simple" data-score-type="kepribadian" data-id="${siswa.id}" data-nama="${siswa.nama}">Input Nilai</button>`
                : '';

            tr.innerHTML = `
                <td class="p-3">${index + 1}</td>
                <td class="p-3 font-medium">${siswa.nama}</td>
                <td class="p-3">${siswa.nosis}</td>
                <td class="p-3 flex flex-wrap items-center gap-1">${nilaiHtml || "Belum ada"}</td>
                <td class="p-3 text-center font-semibold">${siswa.rata2.toFixed(2)}</td>
                <td class="p-3 text-center">
                    ${inputBtn}
                </td>
                <td class="p-3 text-center font-bold">${siswa.rank}</td>
            `;
            nilaiKepribadianTableBody.appendChild(tr);
        });
    }
};

const renderJasmaniMainView = () => {
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
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded border border-red-400">ARSIP</span>`;

            let displayDetail = p.detail;
            if (p.detail === '-' || !p.detail) {
                displayDetail = p.jenis;
            } else {
                displayDetail = `${p.jenis} ${p.detail}`;
            }

            const btnText = p.isActive ? 'Input Nilai' : 'Lihat';
            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';

            row.innerHTML = `
                <td class="p-3 text-center w-12">${start + index + 1}</td>
                <td class="p-3 font-medium">${displayDetail.toUpperCase()} (TA ${p.tahun})</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button class="${btnClass} text-white text-xs py-1 px-3 rounded-md btn-view-jasmani-group" 
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

    renderCategoryTable('Diktuk Tamtama', 'nilai-jasmani-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'nilai-jasmani-diktuk-bintara-table-body');
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'nilai-jasmani-dikbangum-sekolah-bintara-polisi-table-body');
};

const renderNilaiJasmaniSiswaTable = () => {
    if (!nilaiJasmaniTableBody) return;

    const { kategori, detail, tahun } = selectedJasmaniFilters;
    const searchTerm = searchJasmaniInput.value.toLowerCase();
    const isActive = selectedJasmaniFilters.active === 'true';

    let displayTitle = detail;
    if(detail === '-' || !detail) displayTitle = kategori;

    if (titleJasmani) {
        titleJasmani.textContent = `INPUT NILAI JASMANI: ${displayTitle.toUpperCase()} (TA ${tahun})`;
    }

    if (subtitleJasmani) {
        const tahunAjaranData = localTahunAjaran.find(ta => ta.tahun === parseInt(tahun) && ta.pendidikan.some(p => p.jenis === kategori && p.detail === detail));
        const studentCount = localStudents.filter(s => s.kategori === kategori && s.detailPendidikan === detail && s.tahunAjaran === parseInt(tahun)).length;
        subtitleJasmani.innerHTML = `
            Jumlah Siswa : ${studentCount} &nbsp; | &nbsp;
            Tanggal Mulai Dik : ${formatDate(tahunAjaranData?.tanggalMulai)} &nbsp; | &nbsp;
            Tanggal Selesai Dik : ${formatDate(tahunAjaranData?.tanggalBerakhir)}
            ${!isActive ? '&nbsp; <span class="text-red-500 font-bold">(ARSIP - View Only)</span>' : ''}
        `;
    }

    const filteredSiswa = localStudents.filter(s =>
        s.kategori === kategori &&
        s.detailPendidikan === detail &&
        s.tahunAjaran === parseInt(tahun) &&
        (searchTerm ? s.nama.toLowerCase().includes(searchTerm) || (s.nosis && String(s.nosis).includes(searchTerm)) : true)
    ).sort((a, b) => String(a.nosis || '').localeCompare(String(b.nosis || '')));

    nilaiJasmaniTableBody.innerHTML = '';
    if (filteredSiswa.length === 0) {
        nilaiJasmaniTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">Tidak ada data siswa yang cocok.</td></tr>`;
        return;
    }

    filteredSiswa.forEach((siswa, index) => {
        const nilaiList = siswa.nilaiJasmani || [];
        
        const nilaiHtml = nilaiList.map((nilai, i) => {
            const pillClass = isActive ? 'score-pill' : 'px-2 py-1 bg-gray-100 rounded text-gray-600 cursor-default inline-block mr-1 mb-1';
            const deleteBtn = isActive ? `<button class="score-delete-btn" data-siswa-id="${siswa.id}" data-index="${i}" title="Hapus nilai">&times;</button>` : '';
            const title = isActive ? 'Klik untuk edit' : 'View Only';

            // [UPDATE] Tampilkan desimal jika ada
            const displayNilai = (nilai % 1 !== 0) ? parseFloat(nilai).toFixed(2) : nilai;

            return `<span class="${pillClass}" data-siswa-id="${siswa.id}" data-index="${i}" title="${title}">
                ${displayNilai}
                ${deleteBtn}
            </span>`;
        }).join('');

        const tr = document.createElement("tr");
        tr.className = "border-b border-main hover:bg-tertiary";
        
        const inputBtn = isActive 
            ? `<button class="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 text-sm btn-input-simple" data-score-type="jasmani" data-id="${siswa.id}" data-nama="${siswa.nama}" data-kategori="${siswa.kategori}">Input Nilai</button>`
            : '';

        tr.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3 font-medium">${siswa.nama}</td>
            <td class="p-3">${siswa.nosis}</td>
            <td class="p-3">${siswa.kategori}</td>
            <td class="p-3 flex flex-wrap items-center gap-1">${nilaiHtml || "Belum ada"}</td>
            <td class="p-3 text-center">
                ${inputBtn}
            </td>
        `;
        nilaiJasmaniTableBody.appendChild(tr);
    });
};

const openKepribadianModal = (id, nama) => {
    kepribadianForm.reset();
    document.getElementById("kepribadian-siswa-id").value = id;
    document.getElementById("kepribadian-siswa-nama").value = nama;
    openModal("kepribadian-modal");
};

const openJasmaniModal = (id, nama, kategori) => {
    jasmaniForm.reset();
    document.getElementById("jasmani-siswa-id").value = id;
    document.getElementById("jasmani-siswa-nama").value = nama;
    document.getElementById("jasmani-siswa-kategori").value = kategori;
    
    // [UPDATE] Izinkan input desimal di modal
    const inputNilai = document.getElementById("jasmani-form").querySelector('input[type="number"]');
    if(inputNilai) inputNilai.step = "0.01";

    openModal("jasmani-modal");
};

const handleSimpleScoreSubmit = async (e, field, modalId) => {
    e.preventDefault();
    const id = e.target.querySelector('input[type="hidden"]').value;
    const nilaiInput = e.target.querySelector('input[type="number"]');
    
    // [UPDATE] Parse sebagai Float dan handle koma
    const nilai = parseFloat(nilaiInput.value.replace(',', '.'));

    if (isNaN(nilai) || nilai < 0 || nilai > 100) {
        alert('Masukkan nilai yang valid (0-100).');
        return;
    }
    
    showLoading('Menyimpan...');
    try {
        await addSimpleScore(id, field, nilai);
    } catch (error) {
        console.error("Gagal menyimpan nilai:", error);
        alert("Gagal menyimpan nilai.");
    } finally {
        hideLoading();
        closeModal(modalId);
    }
};

const updateDikbangspesScore = async (siswaId, index, newScore) => {
    const student = localStudents.find(s => s.id === siswaId);
    if (!student) return;

    showLoading('Memperbarui nilai...');
    try {
        const currentScores = student.nilaiKepribadian || [];
        const newScores = [...currentScores];
        
        while (newScores.length <= index) {
            newScores.push(null);
        }

        newScores[parseInt(index)] = (newScore === null || isNaN(newScore)) ? null : parseFloat(newScore);

        await updateStudent(siswaId, { nilaiKepribadian: newScores });
    } catch (error) {
        console.error("Gagal memperbarui nilai:", error);
        alert("Gagal memperbarui nilai.");
    } finally {
        hideLoading();
    }
};

const handleDikbangspesScoreUpdate = async (siswaId, index, oldScore) => {
    const student = localStudents.find(s => s.id === siswaId);
    if (!student) return;

    const newScoreStr = prompt(`Input nilai untuk ${student.nama} (0.00 - 100.00). Kosongkan untuk menghapus:`, oldScore !== undefined && oldScore !== null ? oldScore : '');

    if (newScoreStr === null) return; 

    if (newScoreStr.trim() === '') {
        await updateDikbangspesScore(siswaId, index, null);
    } else {
        const newScore = parseFloat(newScoreStr.replace(',', '.')); // Ganti koma dengan titik
        if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
            const roundedScore = parseFloat(newScore.toFixed(2));
            await updateDikbangspesScore(siswaId, index, roundedScore);
        } else {
            alert('Input tidak valid. Harap masukkan angka antara 0.00 dan 100.00.');
        }
    }
};

const handleSosiometriScoreUpdate = async (siswaId) => {
    const student = localStudents.find(s => s.id === siswaId);
    if (!student) return;
    
    const oldScore = student.nilaiSosiometri;
    const newScoreStr = prompt(`Input nilai sosiometri manual untuk ${student.nama} (0.00 - 100.00). Kosongkan untuk menghapus:`, oldScore !== undefined && oldScore !== null ? oldScore : '');

    if (newScoreStr === null) return; 

    const newScore = parseFloat(newScoreStr.replace(',', '.'));

    if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
        const roundedScore = parseFloat(newScore.toFixed(2));
        showLoading('Menyimpan nilai sosiometri...');
        try {
            await updateStudent(siswaId, { nilaiSosiometri: roundedScore });
        } catch (error) {
            console.error("Gagal update nilai sosiometri:", error);
            alert("Gagal menyimpan nilai.");
        } finally {
            hideLoading();
        }
    } else if (newScoreStr.trim() === '') {
        showLoading('Menghapus nilai sosiometri...');
        try {
            await updateStudent(siswaId, { nilaiSosiometri: null });

            const targetSiswa = localStudents.find(s => s.id === siswaId);
            if (targetSiswa) {
                const peers = localStudents
                    .filter(s =>
                        s.tahunAjaran === targetSiswa.tahunAjaran &&
                        s.kategori === targetSiswa.kategori &&
                        s.detailPendidikan === targetSiswa.detailPendidikan &&
                        s.role === 'siswa'
                    )
                    .sort((a, b) => String(a.nosis || '0').localeCompare(String(b.nosis || '0'), undefined, { numeric: true }));

                if (peers.length >= 2) {
                    const targetIndex = peers.findIndex(s => s.id === targetSiswa.id);
                    
                    if (targetIndex > -1) {
                        const submitterIndex = (targetIndex === 0) ? peers.length - 1 : targetIndex - 1;
                        const submitterSiswa = peers[submitterIndex];

                        if (submitterSiswa) {
                            await updateStudent(submitterSiswa.id, { sosiometriCompleted: false });
                            console.log(`Status sosiometri untuk ${submitterSiswa.nama} (submitter) telah direset.`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Gagal hapus/reset nilai sosiometri:", error);
            alert("Gagal menghapus atau me-reset nilai.");
        } finally {
            hideLoading();
        }
    } else {
        alert('Input tidak valid. Harap masukkan angka antara 0.00 dan 100.00.');
    }
};


// ======================================================
// --- INISIALISASI MODUL ---
// ======================================================
export const initNilaiModule = async (studentsData, mapelsData, taData) => {
    localStudents = studentsData;
    localMapels = mapelsData;
    localTahunAjaran = taData;
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    if (currentUser.role === 'siswa') {
        await loadStudentNilaiViews();
        renderStudentViews();
    } else {
        if (!window.nilaiModuleInitialized) {
            mainAkademikView = document.getElementById('nilai-akademik-main-view');
            listAkademikView = document.getElementById('nilai-akademik-list-view');
            backButtonAkademik = document.getElementById('btn-back-nilai-akademik');
            titleAkademik = document.getElementById('nilai-akademik-view-title');
            subtitleAkademik = document.getElementById('nilai-akademik-subtitle'); // <--- UBAH JADI SEPERTI INI

            const containerAkademik = document.getElementById('nilai-akademik-view-container');

            if (containerAkademik) {
                containerAkademik.addEventListener('click', async (e) => {
                    const groupBtn = e.target.closest('.btn-view-nilai-group');
                    const inputBtn = e.target.closest('.btn-input-nilai');
                    const detailBtn = e.target.closest('.btn-detail-nilai');
                    
                    const prevBtn = e.target.closest('.btn-prev-cat');
                    const nextBtn = e.target.closest('.btn-next-cat');

                    if (prevBtn) {
                        const kategori = prevBtn.dataset.kategori;
                        if (categoryPageMap[kategori] > 1) {
                            categoryPageMap[kategori]--;
                            renderAkademikMainView();
                            renderKepribadianMainView(); 
                        }
                    } else if (nextBtn) {
                        const kategori = nextBtn.dataset.kategori;
                        categoryPageMap[kategori]++;
                        renderAkademikMainView();
                        renderKepribadianMainView(); 
                    }

                    else if (groupBtn) {
                        selectedNilaiFilters = { ...groupBtn.dataset };
                        mainAkademikView.classList.add('hidden');
                        listAkademikView.classList.remove('hidden');
                        backButtonAkademik.classList.remove('hidden');
                        
                        let displayDetail = selectedNilaiFilters.detail;
                        if(displayDetail === '-' || !displayDetail) displayDetail = selectedNilaiFilters.kategori;

                        titleAkademik.textContent = `INPUT NILAI AKADEMIK: ${displayDetail.toUpperCase()} (TA ${selectedNilaiFilters.tahun})`;
                        akademikCurrentPage = 1;
                        
                        // [UPDATE] Hitung peringkat saat tombol grup diklik
                        showLoading('Memuat data dan menghitung peringkat...');
                        await refreshAkademikRanks(selectedNilaiFilters);
                        hideLoading();
                        
                        await renderNilaiAkademikSiswaTable();
                    }
                    else if (inputBtn) {
                        openInputNilaiModal(inputBtn.dataset.id);
                    }
                    else if (detailBtn) {
                        openNilaiAkademikDetailModal(detailBtn.dataset.id);
                    }
                });
            }
            if (backButtonAkademik) {
                backButtonAkademik.addEventListener('click', () => {
                    mainAkademikView.classList.remove('hidden');
                    listAkademikView.classList.add('hidden');
                    backButtonAkademik.classList.add('hidden');
                    titleAkademik.textContent = 'Manajemen Nilai Akademik';
                    if (subtitleAkademik) subtitleAkademik.innerHTML = '';
                    
                    // Reset text filter
                    const searchInput = document.getElementById('search-nilai-siswa-input');
                    if (searchInput) searchInput.value = '';
                });
            }
            
            mainKepribadianView = document.getElementById('nilai-kepribadian-main-view');
            listKepribadianView = document.getElementById('nilai-kepribadian-list-view');
            backButtonKepribadian = document.getElementById('btn-back-nilai-kepribadian');
            titleKepribadian = document.getElementById('nilai-kepribadian-view-title');
            subtitleKepribadian = document.getElementById('nilai-kepribadian-view-subtitle');
            const containerKepribadian = document.getElementById('nilai-kepribadian-view-container');

            if (containerKepribadian) {
                 containerKepribadian.addEventListener('click', async (e) => {
                    const groupBtn = e.target.closest('.btn-view-kepribadian-group');
                    const simpleBtn = e.target.closest('.btn-input-simple');
                    
                    const editPill = e.target.closest('.score-pill');
                    const deletePillBtn = e.target.closest('.score-delete-btn');
                    const sosiometriPill = e.target.closest('.sosiometri-score'); 
                    
                    const prevBtn = e.target.closest('.btn-prev-cat');
                    const nextBtn = e.target.closest('.btn-next-cat');

                    if (prevBtn) {
                        const kategori = prevBtn.dataset.kategori;
                        if (categoryPageMap[kategori] > 1) {
                            categoryPageMap[kategori]--;
                            renderKepribadianMainView();
                        }
                    } else if (nextBtn) {
                        const kategori = nextBtn.dataset.kategori;
                        categoryPageMap[kategori]++;
                        renderKepribadianMainView();
                    }

                    else if (groupBtn) {
                        selectedKepribadianFilters = { ...groupBtn.dataset };
                        mainKepribadianView.classList.add('hidden');
                        listKepribadianView.classList.remove('hidden');
                        backButtonKepribadian.classList.remove('hidden');
                        renderNilaiKepribadianSiswaTable();
                    } else if (simpleBtn && simpleBtn.dataset.scoreType === 'kepribadian') {
                         const { id, nama } = simpleBtn.dataset;
                         openKepribadianModal(id, nama);
                    
                    } else if (sosiometriPill) { 
                        handleSosiometriScoreUpdate(sosiometriPill.dataset.siswaId);
                    
                    } else if (deletePillBtn) {
                        e.stopPropagation();
                        const { siswaId, index } = deletePillBtn.dataset;
                        const student = localStudents.find(s => s.id === siswaId);
                        
                        const isDikbangspes = student.kategori === 'Dikbangspes' || student.kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI';

                        if (confirm('Apakah Anda yakin ingin menghapus nilai ini?')) {
                            if (isDikbangspes) {
                                await updateDikbangspesScore(siswaId, parseInt(index), null);
                            } else {
                                showLoading('Menghapus...');
                                await deleteNilaiInArray(siswaId, 'nilaiKepribadian', parseInt(index));
                                hideLoading();
                            }
                        }
                    } else if (editPill && !sosiometriPill) { 
                        const { siswaId, index } = editPill.dataset;
                        const student = localStudents.find(s => s.id === siswaId);
                        
                        const isDikbangspes = student.kategori === 'Dikbangspes' || student.kategori === 'DIKBANGUM SEKOLAH BINTARA POLISI';
                        const oldScore = (student.nilaiKepribadian || [])[parseInt(index)];

                        if (isDikbangspes) {
                            handleDikbangspesScoreUpdate(siswaId, parseInt(index), oldScore);
                        } else {
                             const newScoreStr = prompt('Masukkan nilai baru:', oldScore);
                            if (newScoreStr) {
                                const newScore = parseFloat(newScoreStr);
                                if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
                                    showLoading('Memperbarui...');
                                    await updateNilaiInArray(siswaId, 'nilaiKepribadian', parseInt(index), newScore);
                                    hideLoading();
                                } else {
                                    alert('Input tidak valid. Harap masukkan angka antara 0 and 100.');
                                }
                            }
                        }
                    }
                });
            }
            if(backButtonKepribadian) {
                backButtonKepribadian.addEventListener('click', () => {
                    mainKepribadianView.classList.remove('hidden');
                    listKepribadianView.classList.add('hidden');
                    backButtonKepribadian.classList.add('hidden');
                    titleKepribadian.textContent = 'Manajemen Nilai Mental Kepribadian';
                    if (subtitleKepribadian) subtitleKepribadian.innerHTML = '';
                });
            }

            mainJasmaniView = document.getElementById('nilai-jasmani-main-view');
            listJasmaniView = document.getElementById('nilai-jasmani-list-view');
            backButtonJasmani = document.getElementById('btn-back-nilai-jasmani');
            titleJasmani = document.getElementById('nilai-jasmani-view-title');
            subtitleJasmani = document.getElementById('nilai-jasmani-view-subtitle');
            const containerJasmani = document.getElementById('nilai-jasmani-view-container');

            if (containerJasmani) {
                 containerJasmani.addEventListener('click', async (e) => {
                    const groupBtn = e.target.closest('.btn-view-jasmani-group');
                    const simpleBtn = e.target.closest('.btn-input-simple');
                    const editPill = e.target.closest('.score-pill');
                    const deletePillBtn = e.target.closest('.score-delete-btn');

                    if (groupBtn) {
                        selectedJasmaniFilters = { ...groupBtn.dataset };
                        mainJasmaniView.classList.add('hidden');
                        listJasmaniView.classList.remove('hidden');
                        backButtonJasmani.classList.remove('hidden');
                        
                        let displayDetail = selectedJasmaniFilters.detail;
                        if(displayDetail === '-' || !displayDetail) displayDetail = selectedJasmaniFilters.kategori;

                        titleJasmani.textContent = `INPUT NILAI JASMANI: ${displayDetail.toUpperCase()} (TA ${selectedJasmaniFilters.tahun})`;
                        renderNilaiJasmaniSiswaTable();
                    } else if (simpleBtn && simpleBtn.dataset.scoreType === 'jasmani') {
                         const { id, nama, kategori } = simpleBtn.dataset;
                         openJasmaniModal(id, nama, kategori);
                    } else if (deletePillBtn) {
                        e.stopPropagation();
                        const { siswaId, index } = deletePillBtn.dataset;
                        if (confirm('Apakah Anda yakin ingin menghapus nilai ini?')) {
                            showLoading('Menghapus...');
                            await deleteNilaiInArray(siswaId, 'nilaiJasmani', parseInt(index));
                            hideLoading();
                        }
                    } else if (editPill) {
                        const { siswaId, index } = editPill.dataset;
                        const student = localStudents.find(s => s.id === siswaId);
                        const oldScore = student.nilaiJasmani[index];
                        const newScoreStr = prompt('Masukkan nilai baru:', oldScore);

                        if (newScoreStr) {
                            // [UPDATE] Parse Float & Handle Koma
                            const newScore = parseFloat(newScoreStr.replace(',', '.'));
                            
                            if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
                                showLoading('Memperbarui...');
                                await updateNilaiInArray(siswaId, 'nilaiJasmani', parseInt(index), newScore);
                                hideLoading();
                            } else {
                                alert('Input tidak valid. Harap masukkan angka antara 0 dan 100.');
                            }
                        }
                    }
                });
            }
            if(backButtonJasmani) {
                backButtonJasmani.addEventListener('click', () => {
                    mainJasmaniView.classList.remove('hidden');
                    listJasmaniView.classList.add('hidden');
                    backButtonJasmani.classList.add('hidden');
                    titleJasmani.textContent = 'Input Nilai Jasmani';
                    if (subtitleJasmani) subtitleJasmani.innerHTML = '';
                });
            }

            nilaiSiswaTableBody = document.getElementById('nilai-siswa-table-body');
            searchNilaiSiswaInput = document.getElementById('search-nilai-siswa-input');
            filterNilaiBatalyon = document.getElementById('filter-nilai-batalyon');
            filterNilaiKompi = document.getElementById('filter-nilai-kompi');
            filterNilaiPeleton = document.getElementById('filter-nilai-peleton');
            inputNilaiForm = document.getElementById('input-nilai-form');
            
            [searchNilaiSiswaInput, filterNilaiBatalyon, filterNilaiKompi, filterNilaiPeleton].forEach(el => {
                if(el) el.addEventListener('input', () => {
                    akademikCurrentPage = 1;
                    renderNilaiAkademikSiswaTable();
                });
            });

            // [BARU] Event Listener untuk Dropdown Sort Akademik
            const sortAkademikSelect = document.getElementById('sort-nilai-akademik-select');
            if (sortAkademikSelect) {
                sortAkademikSelect.addEventListener('change', () => {
                    akademikCurrentPage = 1;
                    renderNilaiAkademikSiswaTable();
                });
            }

            if(inputNilaiForm) inputNilaiForm.addEventListener('submit', handleNilaiAkademikSubmit);
            
            const paginationContainer = document.getElementById('nilai-akademik-pagination');
            if (paginationContainer) {
                paginationContainer.addEventListener('click', e => {
                    const prevBtn = e.target.closest('#prev-akademik-page');
                    const nextBtn = e.target.closest('#next-akademik-page');

                    if (prevBtn && !prevBtn.disabled) {
                        akademikCurrentPage--;
                        renderNilaiAkademikSiswaTable();
                    }
                    if (nextBtn && !nextBtn.disabled) {
                        akademikCurrentPage++;
                        renderNilaiAkademikSiswaTable();
                    }
                });
            }

            nilaiKepribadianTableBody = document.getElementById('nilai-kepribadian-table-body');
            searchKepribadianInput = document.getElementById('search-kepribadian-input');
            kepribadianModal = document.getElementById('kepribadian-modal');
            kepribadianForm = document.getElementById('kepribadian-form');
            if(searchKepribadianInput) searchKepribadianInput.addEventListener('input', renderNilaiKepribadianSiswaTable);
            if(kepribadianForm) kepribadianForm.addEventListener("submit", (e) => handleSimpleScoreSubmit(e, 'nilaiKepribadian', 'kepribadian-modal'));
            
            nilaiJasmaniTableBody = document.getElementById('nilai-jasmani-table-body');
            searchJasmaniInput = document.getElementById('search-jasmani-input');
            jasmaniModal = document.getElementById('jasmani-modal');
            jasmaniForm = document.getElementById('jasmani-form');
            if(searchJasmaniInput) searchJasmaniInput.addEventListener('input', renderNilaiJasmaniSiswaTable);
            if(jasmaniForm) jasmaniForm.addEventListener("submit", (e) => handleSimpleScoreSubmit(e, 'nilaiJasmani', 'jasmani-modal'));
            
            document.querySelectorAll('.btn-export-excel').forEach(btn => {
                btn.addEventListener('click', () => exportNilaiToExcel(btn.dataset.type));
            });
            document.querySelectorAll('.btn-import-excel').forEach(btn => {
                btn.addEventListener('click', () => importNilaiFromExcel(btn.dataset.type));
            });
            
            window.nilaiModuleInitialized = true;
        }
        
        renderAkademikMainView();
        renderKepribadianMainView();
        renderJasmaniMainView();

        if (listAkademikView && !listAkademikView.classList.contains('hidden')) {
            // Kita bungkus pemanggilan ini agar rank terbaru dihitung ulang kalau di-refresh
            showLoading('Memuat...');
            refreshAkademikRanks(selectedNilaiFilters).then(() => {
                hideLoading();
                renderNilaiAkademikSiswaTable();
            });
        }
        if (listKepribadianView && !listKepribadianView.classList.contains('hidden')) {
            renderNilaiKepribadianSiswaTable();
        }
        if (listJasmaniView && !listJasmaniView.classList.contains('hidden')) {
            renderNilaiJasmaniSiswaTable();
        }
    }
};