// js/modules/petikan.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { db } from '../firebase-config.js';
import { getCollectionRef, getAcademicScores } from '../firestore-service.js'; 
import { doc, getDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generatePetikanPreviewHTML } from './settings_petikan.js';

// --- STATE ---
let localStudents = []; 
let localTaList = [];   
let localMapels = []; 
let globalSettings = {}; 
let selectedPetikanFilters = {}; 
let currentSKSettings = {}; 
let isPetikanInitialized = false;
let calculatedStudentList = []; 

// --- PAGINATION STATE ---
let petikanCurrentPage = 1;
const PETIKAN_ROWS_PER_PAGE = 10;
const ROWS_PER_CATEGORY_TABLE = 4; 

let categoryPageMap = {
    'Diktuk Tamtama': 1,
    'Diktuk Bintara': 1,
    'Dikbangspes': 1,
    'DIKBANGUM SEKOLAH BINTARA POLISI': 1
};

// --- CONSTANTS ---
const SESSION_KEY_TA = 'petikan_active_ta_id';
const SESSION_KEY_JENIS = 'petikan_active_jenis';
const SESSION_KEY_DETAIL = 'petikan_active_detail';

// --- ELEMEN DOM ---
let mainPetikanView, detailPetikanView;
let petikanTableBody, searchPetikanInput, paginationContainer;
let backButtonPetikan, titlePetikan, subtitlePetikan, petikanViewInfo;

// ==========================================================
// ===            FUNGSI INIT & LIFECYCLE                 ===
// ==========================================================

export const initPetikanModule = (taData, studentsData, settingsData, mapelsData) => {
    if (taData) localTaList = taData;
    if (studentsData) localStudents = studentsData;
    if (settingsData) globalSettings = settingsData;
    
    if (mapelsData && Array.isArray(mapelsData) && mapelsData.length > 0) {
        localMapels = mapelsData;
    }
    
    if (!isPetikanInitialized) {
        initializeElements();
        setupEventListeners();
        isPetikanInitialized = true;
    }

    if (localTaList.length === 0) return;

    const savedTaId = sessionStorage.getItem(SESSION_KEY_TA);
    const savedJenis = sessionStorage.getItem(SESSION_KEY_JENIS);
    const savedDetail = sessionStorage.getItem(SESSION_KEY_DETAIL);

    if (savedTaId && savedJenis && savedDetail) {
        const foundTa = localTaList.find(t => t.id === savedTaId);
        if (foundTa) {
            selectedPetikanFilters = { 
                jenis: savedJenis, 
                detail: savedDetail, 
                tahun: foundTa.tahun, 
                taId: savedTaId 
            };
            showDetailView();
        } else {
            resetSession();
            renderPetikanMainView();
        }
    } else {
        renderPetikanMainView();
    }
};

const initializeElements = () => {
    mainPetikanView = document.getElementById('petikan-main-view');
    detailPetikanView = document.getElementById('petikan-detail-view');
    backButtonPetikan = document.getElementById('btn-back-petikan');
    titlePetikan = document.getElementById('petikan-view-title');
    subtitlePetikan = document.getElementById('petikan-view-subtitle');
    petikanViewInfo = document.getElementById('petikan-view-info');
    
    petikanTableBody = document.getElementById('petikan-table-body');
    searchPetikanInput = document.getElementById('petikan-search');
    paginationContainer = document.getElementById('petikan-pagination');
};

const setupEventListeners = () => {
    if (backButtonPetikan) {
        backButtonPetikan.addEventListener('click', () => {
            resetSession();
            showMainView();
        });
    }

    if (searchPetikanInput) {
        searchPetikanInput.addEventListener('input', () => {
            petikanCurrentPage = 1; 
            renderPetikanSiswaListView();
        });
    }

    document.getElementById('btn-petikan-settings')?.addEventListener('click', openSettingsModal);
    
    // [FIX] Update ID Form menjadi 'settings-petikan-form' sesuai HTML terbaru
    document.getElementById('settings-petikan-form')?.addEventListener('submit', saveSKSettings);
    
    document.getElementById('btn-print-all-petikan')?.addEventListener('click', handlePrintAllPetikan);

    const container = document.getElementById('petikan-view-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('.btn-prev-cat');
            const nextBtn = e.target.closest('.btn-next-cat');

            if (prevBtn) {
                const kategori = prevBtn.dataset.kategori;
                if (categoryPageMap[kategori] > 1) {
                    categoryPageMap[kategori]--;
                    renderPetikanMainView();
                }
            } else if (nextBtn) {
                const kategori = nextBtn.dataset.kategori;
                categoryPageMap[kategori]++;
                renderPetikanMainView();
            }

            const btnGroup = e.target.closest('.btn-view-petikan-group');
            if (btnGroup) {
                const { jenis, detail, taId, tahun } = btnGroup.dataset;
                selectedPetikanFilters = { jenis, detail, taId, tahun };
                
                sessionStorage.setItem(SESSION_KEY_TA, taId);
                sessionStorage.setItem(SESSION_KEY_JENIS, jenis);
                sessionStorage.setItem(SESSION_KEY_DETAIL, detail);
                
                showDetailView();
            }

            const btnPrint = e.target.closest('.btn-print-petikan');
            if (btnPrint) {
                const studentId = btnPrint.dataset.id;
                handlePrintSinglePetikan(studentId);
            }
        });
    }
};

const resetSession = () => {
    sessionStorage.removeItem(SESSION_KEY_TA);
    sessionStorage.removeItem(SESSION_KEY_JENIS);
    sessionStorage.removeItem(SESSION_KEY_DETAIL);
    selectedPetikanFilters = {};
    currentSKSettings = {};
    calculatedStudentList = [];
};

// ==========================================================
// ===      LOGIKA PERHITUNGAN NILAI & URUTAN             ===
// ==========================================================

const getNilaiKepribadianCalc = (siswa) => {
    const kat = (siswa.kategori || '').toLowerCase();
    
    if (kat.includes('dikbangspes') || kat.includes('sekolah bintara polisi')) {
        const nilaiList = siswa.nilaiKepribadian || [];
        const validNilaiList = Array.isArray(nilaiList) 
            ? nilaiList.map(n => parseFloat(n)).filter(n => !isNaN(n))
            : [];
        
        const nilaiInstruktur = validNilaiList.length > 0 ? validNilaiList[validNilaiList.length - 1] : 0;
        const nilaiSosiometri = parseFloat(siswa.nilaiSosiometri) || 0;
        
        return (nilaiInstruktur * 0.7) + (nilaiSosiometri * 0.3);
    }

    let data = siswa.nilaiKepribadian;
    if (data && typeof data === 'object' && !Array.isArray(data) && data.nilaiAkhir) {
        return parseFloat(data.nilaiAkhir) || 0;
    }
    if (Array.isArray(data)) {
        const validData = data.map(n => parseFloat(n)).filter(n => !isNaN(n));
        if (validData.length === 0) return 0;
        const sum = validData.reduce((a, b) => a + b, 0);
        return sum / validData.length;
    }
    return 0;
};

const calculateRankingAndScores = async (studentsGroup) => {
    if (!studentsGroup || studentsGroup.length === 0) return [];

    if (!localMapels || localMapels.length === 0) {
        try {
            const mapelRef = getCollectionRef('mata_pelajaran');
            const snapshot = await getDocs(mapelRef);
            localMapels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("[Petikan] Gagal mengambil data mapel:", e);
        }
    }

    const processedData = await Promise.all(studentsGroup.map(async (siswa) => {
        const academicScores = await getAcademicScores(siswa.id);
        const relevantMapelsData = localMapels.filter(m => {
            const mapelTahun = String(m.tahunAjaran || '').trim();
            const siswaTahun = String(siswa.tahunAjaran || '').trim();
            const mapelKat = String(m.kategori || '').trim().toLowerCase();
            const siswaKat = String(siswa.kategori || '').trim().toLowerCase();
            const mapelDet = String(m.detailPendidikan || '').trim().toLowerCase();
            const siswaDet = String(siswa.detailPendidikan || '').trim().toLowerCase();
            return mapelTahun === siswaTahun && mapelKat === siswaKat && mapelDet === siswaDet;
        });
        
        const scoreValues = relevantMapelsData.map(mapel => {
            const val = academicScores[mapel.id];
            return val ? parseFloat(val) : 0;
        });
        
        const totalNilaiAkademik = scoreValues.reduce((a, b) => a + b, 0);
        const rerataAkademik_raw = scoreValues.length > 0 ? (totalNilaiAkademik / scoreValues.length) : 0;
        const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
        const rerataKepribadian = getNilaiKepribadianCalc(siswa);

        let rerataJasmani = 0;
        const katLower = (siswa.kategori || '').toLowerCase();
        const isDikbangspesOnly = katLower.includes('dikbangspes'); 

        if (!isDikbangspesOnly) {
            const nilaiJasmaniList = siswa.nilaiJasmani || [];
            if (Array.isArray(nilaiJasmaniList) && nilaiJasmaniList.length > 0) {
                const totalJasmani = nilaiJasmaniList.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
                rerataJasmani = totalJasmani / nilaiJasmaniList.length;
            }
        }

        let finalScore = 0;
        if (!isDikbangspesOnly) {
            finalScore = ((rerataAkademik * 4) + (rerataKepribadian * 4) + (rerataJasmani * 2)) / 10;
        } else {
            finalScore = (rerataAkademik + rerataKepribadian) / 2;
        }

        return {
            ...siswa,
            nilaiAkademik: rerataAkademik,      
            nilaiKepribadian: rerataKepribadian,
            nilaiJasmani: rerataJasmani, 
            finalScore: finalScore,
            cleanNosis: siswa.nosis ? String(siswa.nosis).trim().replace(/\D/g, '') : '9999999999'
        };
    }));

    // [LANGKAH 1] URUTKAN BERDASARKAN NOSIS (ASC) UNTUK NOMOR URUT SKEP
    processedData.sort((a, b) => {
        return a.cleanNosis.localeCompare(b.cleanNosis, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Beri Nomor Urut Permanen
    processedData.forEach((siswa, index) => {
        siswa.nomorUrutSkep = index + 1; 
    });

    // [LANGKAH 2] URUTKAN BERDASARKAN NILAI (DESC) UNTUK RANKING
    processedData.sort((a, b) => b.finalScore - a.finalScore);

    // Beri Ranking
    processedData.forEach((siswa, index) => {
        siswa.ranking = index + 1;
    });

    return processedData;
};


// ==========================================================
// ===                  VIEW LOGIC                        ===
// ==========================================================

const showMainView = () => { 
    mainPetikanView.classList.remove('hidden'); 
    detailPetikanView.classList.add('hidden'); 
    backButtonPetikan.classList.add('hidden'); 
    document.getElementById('btn-petikan-settings').classList.add('hidden'); 
    if (petikanViewInfo) petikanViewInfo.classList.add('hidden'); 
    titlePetikan.textContent = 'PETIKAN KELULUSAN'; 
    subtitlePetikan.textContent = 'Kelola dan cetak Petikan Keputusan Kelulusan Siswa.'; 
    if (searchPetikanInput) searchPetikanInput.value = ''; 
    renderPetikanMainView(); 
};

const showDetailView = async () => { 
    mainPetikanView.classList.add('hidden'); 
    detailPetikanView.classList.remove('hidden'); 
    backButtonPetikan.classList.remove('hidden'); 
    document.getElementById('btn-petikan-settings').classList.remove('hidden'); 
    
    const { jenis, detail, tahun, taId } = selectedPetikanFilters; 
    const currentTA = localTaList.find(t => t.id === taId);
    const isArchive = !currentTA?.isActive;
    
    let detailClean = (detail || '').toString().trim();
    if (detailClean === '-') detailClean = '';
    const detailDisplay = detailClean ? ` ${detailClean.toUpperCase()}` : '';
    
    titlePetikan.textContent = `${jenis.toUpperCase()}${detailDisplay} (TA ${tahun})`; 
    
    if (isArchive) {
        subtitlePetikan.innerHTML = '<span class="text-red-500 font-bold">(ARSIP)</span>';
    } else {
        subtitlePetikan.innerHTML = ''; 
    }
    
    showLoading("Menghitung Peringkat & Nilai...");
    
    await loadSKSettings(); 
    
    const rawStudents = localStudents.filter(s => 
        s.kategori === jenis && 
        s.detailPendidikan === detail && 
        s.tahunAjaran == tahun
    );
    
    calculatedStudentList = await calculateRankingAndScores(rawStudents);
    
    hideLoading();

    if (petikanViewInfo) { 
        const tglMulai = currentTA?.tanggalMulai ? formatDateIndo(currentTA.tanggalMulai) : '-'; 
        const tglSelesai = currentTA?.tanggalBerakhir ? formatDateIndo(currentTA.tanggalBerakhir) : '-'; 
        petikanViewInfo.textContent = `Jumlah Siswa : ${calculatedStudentList.length}  |  Tanggal Mulai Dik : ${tglMulai}  |  Tanggal Selesai Dik : ${tglSelesai}`; 
        petikanViewInfo.classList.remove('hidden'); 
    } 
    
    petikanCurrentPage = 1; 
    renderPetikanSiswaListView(); 
};

const renderPetikanMainView = () => { 
    const allActivePendidikan = []; 
    localTaList.forEach(ta => { 
        if(ta.pendidikan) { 
            ta.pendidikan.forEach(p => { 
                allActivePendidikan.push({ 
                    ...p, 
                    tahun: ta.tahun, 
                    taId: ta.id,
                    isActive: ta.isActive 
                }); 
            }); 
        } 
    }); 
    
    const renderCategoryTable = (kategori, tableBodyId) => { 
        const tableBody = document.getElementById(tableBodyId); 
        if (!tableBody) return; 
        
        const allItems = allActivePendidikan
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
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle italic">Tidak ada data.</td></tr>`; 
            return; 
        } 

        paginatedItems.forEach((p, index) => { 
            const row = document.createElement('tr'); 
            row.className = 'border-b border-main hover:bg-tertiary transition-colors'; 
            
            const statusBadge = p.isActive 
                ? `<span class="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded border border-green-400">AKTIF</span>`
                : `<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded border border-red-400">ARSIP</span>`;

            const btnClass = p.isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600';
            const btnText = p.isActive ? 'Kelola' : 'Lihat';
            
            let detailClean = (p.detail || '').toString().trim();
            if (detailClean === '-') detailClean = '';
            const detailText = detailClean ? ` ${detailClean}` : '';
            const displayName = `${p.jenis}${detailText}`;

            row.innerHTML = ` 
                <td class="p-3 text-center">${start + index + 1}</td> 
                <td class="p-3 font-medium">${displayName.toUpperCase()} <span class="text-xs text-subtle ml-1">(TA ${p.tahun})</span></td> 
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center"> 
                    <button class="${btnClass} text-white text-xs py-1.5 px-3 rounded btn-view-petikan-group shadow transition-colors" 
                        data-jenis="${p.jenis}" 
                        data-detail="${p.detail}" 
                        data-tahun="${p.tahun}" 
                        data-ta-id="${p.taId}"> 
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
    
    renderCategoryTable('Diktuk Tamtama', 'list-diktuk-tamtama'); 
    renderCategoryTable('Diktuk Bintara', 'list-diktuk-bintara'); 
    renderCategoryTable('Dikbangspes', 'list-dikbangspes'); 
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'list-dikbagum-sbp'); 
};

const renderPetikanSiswaListView = () => { 
    if (!petikanTableBody) return; 
    petikanTableBody.innerHTML = ''; 
    
    const searchTerm = searchPetikanInput.value.toLowerCase(); 
    
    let filteredSiswa = calculatedStudentList.filter(s => 
        (searchTerm ? (s.nama && s.nama.toLowerCase().includes(searchTerm)) || (s.nosis && s.nosis.includes(searchTerm)) : true) 
    ); 
    
    filteredSiswa.sort((a, b) => { 
        return a.cleanNosis.localeCompare(b.cleanNosis, undefined, { numeric: true, sensitivity: 'base' }); 
    }); 
    
    const totalItems = filteredSiswa.length; 
    const totalPages = Math.ceil(totalItems / PETIKAN_ROWS_PER_PAGE); 
    petikanCurrentPage = Math.min(Math.max(1, petikanCurrentPage), totalPages || 1); 
    const startIndex = (petikanCurrentPage - 1) * PETIKAN_ROWS_PER_PAGE; 
    const paginatedSiswa = filteredSiswa.slice(startIndex, startIndex + PETIKAN_ROWS_PER_PAGE); 
    
    if (paginatedSiswa.length === 0) { 
        petikanTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-subtle italic">Tidak ada data siswa ditemukan.</td></tr>`; 
        renderPetikanPagination(0, 0); 
        return; 
    } 
    
    paginatedSiswa.forEach((s) => { 
        const row = document.createElement('tr'); 
        row.className = 'border-b border-main hover:bg-tertiary transition-colors'; 
        
        const noUrutTabel = s.nomorUrutSkep || '-';
        const nomorKep = currentSKSettings.noKep || '-'; 
        const nilaiAkhir = s.finalScore.toFixed(2); 
        const nilaiAkademik = s.nilaiAkademik.toFixed(2);
        const nilaiKepribadian = s.nilaiKepribadian.toFixed(2);
        
        let nilaiJasmaniDisplay = '-';
        const katLower = (s.kategori || '').toLowerCase();
        const isDikbangspesOnly = katLower.includes('dikbangspes');

        if (!isDikbangspesOnly) {
             nilaiJasmaniDisplay = (s.nilaiJasmani !== undefined && s.nilaiJasmani !== null) ? s.nilaiJasmani.toFixed(2) : '0.00';
        }
        
        row.innerHTML = ` 
            <td class="p-3 text-center text-subtle font-bold">${noUrutTabel}</td> 
            <td class="p-3 font-semibold text-main uppercase">${s.nama}</td> 
            <td class="p-3 text-center text-subtle font-bold">${s.nosis || '-'}</td> 
            <td class="p-3 text-center text-subtle uppercase">${s.pangkat || '-'} / ${s.nrp || '-'}</td> 
            <td class="p-3 text-center text-subtle">${nomorKep}</td> 
            <td class="p-3 text-center text-subtle font-semibold text-blue-700">${nilaiAkademik}</td> 
            <td class="p-3 text-center text-subtle font-semibold text-green-700">${nilaiKepribadian}</td> 
            <td class="p-3 text-center text-subtle font-semibold text-red-700">${nilaiJasmaniDisplay}</td> 
            <td class="p-3 text-center text-subtle font-bold text-lg">${nilaiAkhir}</td> 
            <td class="p-3 text-center"> 
                <button class="bg-purple-600 text-white text-xs py-1.5 px-3 rounded hover:bg-purple-700 btn-print-petikan transition-colors flex items-center justify-center mx-auto shadow" data-id="${s.id}"> 
                    <i class="fas fa-print mr-1.5"></i> Cetak 
                </button> 
            </td> 
        `; 
        petikanTableBody.appendChild(row); 
    }); 
    renderPetikanPagination(totalPages, totalItems); 
};

const renderPetikanPagination = (totalPages, totalItems) => { if (!paginationContainer) return; if (totalItems === 0) { paginationContainer.innerHTML = ''; return; } const startItem = (petikanCurrentPage - 1) * PETIKAN_ROWS_PER_PAGE + 1; const endItem = Math.min(startItem + PETIKAN_ROWS_PER_PAGE - 1, totalItems); let paginationHTML = ` <span class="text-sm text-subtle"> Menampilkan ${startItem} - ${endItem} dari ${totalItems} data (Urut NOSIS) </span> `; if (totalPages > 1) { paginationHTML += ` <div class="inline-flex mt-2 xs:mt-0"> <button id="prev-petikan-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed border border-main"> Sebelumnya </button> <button id="next-petikan-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-t border-b border-r border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed"> Selanjutnya </button> </div> `; } paginationContainer.innerHTML = paginationHTML; const prevButton = document.getElementById('prev-petikan-page'); const nextButton = document.getElementById('next-petikan-page'); if (prevButton) { prevButton.disabled = (petikanCurrentPage === 1); prevButton.addEventListener('click', () => { if (petikanCurrentPage > 1) { petikanCurrentPage--; renderPetikanSiswaListView(); } }); } if (nextButton) { nextButton.disabled = (petikanCurrentPage >= totalPages); nextButton.addEventListener('click', () => { if (petikanCurrentPage < totalPages) { petikanCurrentPage++; renderPetikanSiswaListView(); } }); } };
const loadSKSettings = async () => { const { taId, jenis, detail } = selectedPetikanFilters; const settingsId = `${taId}_${jenis.replace(/\s/g, '_')}_${detail.replace(/\s/g, '_')}`; try { const settingsCollectionPath = getCollectionRef('petikan_settings').path; const settingsDocRef = doc(db, settingsCollectionPath, settingsId); const snapshot = await getDoc(settingsDocRef); if (snapshot.exists()) { currentSKSettings = snapshot.data(); } else { currentSKSettings = { noKep: '', tglKep: '' }; } } catch (error) { console.error("Error loading settings:", error); } };
const openSettingsModal = () => { if (!selectedPetikanFilters.jenis) return; document.getElementById('set-no-kep').value = currentSKSettings.noKep || ''; document.getElementById('set-tgl-kep').value = currentSKSettings.tglKep || ''; openModal('petikan-settings-modal'); };

const saveSKSettings = async (e) => { 
    // Jangan preventDefault di sini jika settings_petikan.js juga menangani event yang sama
    // atau jika Anda ingin keduanya berjalan.
    // Namun untuk amannya kita bisa prevent default agar tidak refresh halaman.
    if(e) e.preventDefault();
    
    showLoading('Menyimpan Data SK...'); 
    const { taId, jenis, detail } = selectedPetikanFilters; 
    const settingsId = `${taId}_${jenis.replace(/\s/g, '_')}_${detail.replace(/\s/g, '_')}`; 
    const newData = { 
        taId, 
        jenis, 
        detail, 
        noKep: document.getElementById('set-no-kep').value, 
        tglKep: document.getElementById('set-tgl-kep').value, 
        updatedAt: new Date().toISOString() 
    }; 
    try { 
        const settingsCollectionPath = getCollectionRef('petikan_settings').path; 
        const settingsDocRef = doc(db, settingsCollectionPath, settingsId); 
        await setDoc(settingsDocRef, newData, { merge: true }); 
        currentSKSettings = newData; 
        closeModal('petikan-settings-modal'); 
        alert('Data SK berhasil disimpan.'); 
        showDetailView(); 
    } catch (error) { 
        console.error('Save failed:', error); 
        alert('Gagal menyimpan SK.'); 
    } 
    hideLoading(); 
};

// --- LOGIKA CETAK (DIPERBAIKI UNTUK CETAK RAPAT ATAS) ---
const checkSettingsBeforePrint = () => {
    if (!currentSKSettings || !currentSKSettings.noKep || !currentSKSettings.tglKep) { alert('Data SK (Nomor Kep & Tanggal) belum lengkap.'); return false; }
    const ps = globalSettings.petikan_settings || {};
    // Validasi opsional
    // if (!ps.signer2Name || !ps.signer2Id) { alert('Data Pejabat Penandatangan belum diatur di Settings.'); return false; }
    return true;
};

const formatDateIndo = (dateStr) => {
    if (!dateStr) return '...';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const preparePrintData = () => {
    const { taId } = selectedPetikanFilters;
    const currentTA = localTaList.find(t => t.id === taId);
    const ps = globalSettings.petikan_settings || {};

    return {
        // Data SK Lokal
        noKep: currentSKSettings.noKep,
        tglKep: formatDateIndo(currentSKSettings.tglKep),
        
        // Data TA
        tglMulai: currentTA?.tanggalMulai ? formatDateIndo(currentTA.tanggalMulai) : '...',
        tglSelesai: currentTA?.tanggalBerakhir ? formatDateIndo(currentTA.tanggalBerakhir) : '...',
        
        // Data Global (Signer)
        signer2Name: ps.signer2Name,
        signer2Id: ps.signer2Id,
        signer2Title: ps.signer2Title,
        kopSuratUrl: ps.kopSuratUrl || 'https://placeholder.com/kop.png'
    };
};

const openPrintWindow = (content, size = 'F4') => {
    const printWindow = window.open('', '_blank');
    
    // [FIX] Update ukuran F4 menjadi 215mm x 330mm (Standar Indonesia)
    const cssSize = size === 'f4' || size === 'F4' ? '216mm 356mm' : 'F4';
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Cetak Petikan</title>
                <style>
                    /* Reset CSS dasar */
                    * { 
                        box-sizing: border-box; 
                        -webkit-print-color-adjust: exact !important;   /* Chrome, Safari */
                        print-color-adjust: exact !important;           /* Firefox */
                    }
                    
                    body { 
                        font-family: 'Bookman Old Style', serif; 
                        margin: 0; 
                        padding: 0;
                        background: #eee;
                    }

                    /* Tampilan Layar (Preview Popup) */
                    .page {
                        background: white;
                        margin: 20px auto;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    }

                    /* Tampilan Cetak (Print) */
                    @media print {
                        @page { 
                            size: ${cssSize}; 
                            margin: 0mm !important; /* Paksa margin browser 0 */
                        }

                        html, body {
                            width: 100%;
                            height: 100%;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: visible;
                        }
                        
                        .page { 
                            margin: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            width: 100% !important;
                            height: auto !important;
                            overflow: visible !important;
                            page-break-after: always;
                        }
                        
                        /* Sembunyikan elemen UI browser jika ada (header/footer default) */
                        body::before, body::after {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
};

const handlePrintSinglePetikan = (studentId) => {
    if (!checkSettingsBeforePrint()) return;
    const settings = globalSettings.petikan_settings || {};

    const student = calculatedStudentList.find(s => s.id === studentId);
    if (!student) return;

    const totalStudents = calculatedStudentList.length;

    // Gunakan nomor urut SKEP yang sudah distempel di awal
    const fixedNomorUrut = student.nomorUrutSkep; 

    const studentData = {
        nama: student.nama,
        pangkat: student.pangkat || '',
        nrp: student.nrp || '',
        nosis: student.nosis || '',
        kategori: student.kategori || '',
        detail: student.detailPendidikan || '',
        tahun: student.tahunAjaran || '',
        tglMulai: preparePrintData().tglMulai,
        tglSelesai: preparePrintData().tglSelesai,
        noKep: currentSKSettings.noKep,
        tglKep: formatDateIndo(currentSKSettings.tglKep),
        nilaiAkademik: student.nilaiAkademik.toFixed(2),
        nilaiKepribadian: student.nilaiKepribadian.toFixed(2),
        nilaiJasmani: (student.nilaiJasmani !== undefined && student.nilaiJasmani !== null) ? student.nilaiJasmani.toFixed(2) : '-', 
        nilaiAkhir: student.finalScore.toFixed(2), 
        
        // PASTIKAN INI DIKIRIM KE TEMPLATE
        nomorUrut: fixedNomorUrut,
        noUrut: fixedNomorUrut,
        
        ranking: student.ranking,
        totalStudents: totalStudents
    };

    const htmlContent = generatePetikanPreviewHTML(settings, studentData);
    openPrintWindow(htmlContent, settings.paperSize);
};

const handlePrintAllPetikan = () => {
    if (!checkSettingsBeforePrint()) return;
    
    const settings = globalSettings.petikan_settings || {};
    const searchTerm = searchPetikanInput.value.toLowerCase();
    
    let filteredStudents = calculatedStudentList.filter(s =>
        (searchTerm ? (s.nama && s.nama.toLowerCase().includes(searchTerm)) || (s.nosis && s.nosis.includes(searchTerm)) : true)
    );

    if (filteredStudents.length === 0) { alert('Tidak ada siswa.'); return; }
    if (!confirm(`Cetak ${filteredStudents.length} Petikan (Urut NOSIS)?`)) return;
    
    showLoading('Menyiapkan dokumen...');
    
    // Sortir output cetakan berdasarkan NOSIS
    filteredStudents.sort((a, b) => {
        return a.cleanNosis.localeCompare(b.cleanNosis, undefined, { numeric: true, sensitivity: 'base' });
    });

    const totalStudents = calculatedStudentList.length; // Total satu angkatan

    let combinedHTML = '';
    
    filteredStudents.forEach(student => {
         // Ambil nomor urut yang sudah distempel
         const fixedNomorUrut = student.nomorUrutSkep; 

         const studentData = {
            nama: student.nama,
            pangkat: student.pangkat || '',
            nrp: student.nrp || '',
            nosis: student.nosis || '',
            kategori: student.kategori || '',
            detail: student.detailPendidikan || '',
            tahun: student.tahunAjaran || '',
            tglMulai: preparePrintData().tglMulai,
            tglSelesai: preparePrintData().tglSelesai,
            noKep: currentSKSettings.noKep,
            tglKep: formatDateIndo(currentSKSettings.tglKep),
            nilaiAkademik: student.nilaiAkademik.toFixed(2),
            nilaiKepribadian: student.nilaiKepribadian.toFixed(2),
            nilaiJasmani: (student.nilaiJasmani !== undefined && student.nilaiJasmani !== null) ? student.nilaiJasmani.toFixed(2) : '-',
            nilaiAkhir: student.finalScore.toFixed(2), 
            
            // PASTIKAN INI DIKIRIM KE TEMPLATE
            nomorUrut: fixedNomorUrut,
            noUrut: fixedNomorUrut,
            
            ranking: student.ranking,
            totalStudents: totalStudents
        };
        combinedHTML += generatePetikanPreviewHTML(settings, studentData);
    });

    hideLoading();
    openPrintWindow(combinedHTML, settings.paperSize);
};