import { showLoading, hideLoading } from '../ui.js';
import { getCollectionRef, getAcademicScores } from '../firestore-service.js'; 
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let localStudents = []; 
let localTaList = [];   
let localMapels = []; 
let selectedFilters = {}; 
let isInitialized = false;
let calculatedStudentList = []; 

let currentPage = 1;
const ROWS_PER_PAGE = 10;
const ROWS_PER_CAT = 4; 
let categoryPageMap = {
    'Diktuk Tamtama': 1, 'Diktuk Bintara': 1, 'Dikbangspes': 1, 'DIKBANGUM SEKOLAH BINTARA POLISI': 1
};

const SESSION_KEY_TA = 'nom_ta_id';
const SESSION_KEY_JENIS = 'nom_jenis';
const SESSION_KEY_DETAIL = 'nom_detail';

let mainView, detailView, tableBody, searchInput, paginationContainer, backButton, titleText, subtitleText, infoBadge;

export const initNominatifModule = (taData, studentsData, settingsData, mapelsData) => {
    if (taData) localTaList = taData;
    if (studentsData) localStudents = studentsData;
    if (mapelsData && Array.isArray(mapelsData) && mapelsData.length > 0) localMapels = mapelsData;
    
    if (!isInitialized) {
        initializeElements();
        setupEventListeners();
        isInitialized = true;
    }

    if (localTaList.length === 0) return;

    const savedTaId = sessionStorage.getItem(SESSION_KEY_TA);
    const savedJenis = sessionStorage.getItem(SESSION_KEY_JENIS);
    const savedDetail = sessionStorage.getItem(SESSION_KEY_DETAIL);

    if (savedTaId && savedJenis && savedDetail) {
        const foundTa = localTaList.find(t => t.id === savedTaId);
        if (foundTa) {
            selectedFilters = { jenis: savedJenis, detail: savedDetail, tahun: foundTa.tahun, taId: savedTaId };
            showDetailView();
        } else {
            resetSession();
            renderMainView();
        }
    } else {
        renderMainView();
    }
};

const initializeElements = () => {
    mainView = document.getElementById('nominatif-main-view');
    detailView = document.getElementById('nominatif-detail-view');
    backButton = document.getElementById('btn-back-nominatif');
    titleText = document.getElementById('nominatif-view-title');
    subtitleText = document.getElementById('nominatif-view-subtitle');
    infoBadge = document.getElementById('nominatif-view-info');
    tableBody = document.getElementById('nominatif-table-body');
    searchInput = document.getElementById('nominatif-search');
    paginationContainer = document.getElementById('nominatif-pagination');
};

const setupEventListeners = () => {
    if (backButton) {
        backButton.addEventListener('click', () => { resetSession(); showMainView(); });
    }

    const filters = ['nominatif-search', 'filter-nominatif-batalyon', 'filter-nominatif-kompi', 'filter-nominatif-peleton', 'sort-nominatif-select'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(id.includes('search') ? 'input' : 'change', () => {
            currentPage = 1; 
            renderSiswaList();
        });
    });

    document.getElementById('btn-export-excel-nominatif')?.addEventListener('click', exportToExcel);
    document.getElementById('btn-print-pdf-nominatif')?.addEventListener('click', printToPDF);

    const container = document.getElementById('nominatif-view-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('.btn-prev-cat');
            const nextBtn = e.target.closest('.btn-next-cat');

            if (prevBtn) {
                const cat = prevBtn.dataset.kategori;
                if (categoryPageMap[cat] > 1) { categoryPageMap[cat]--; renderMainView(); }
            } else if (nextBtn) {
                const cat = nextBtn.dataset.kategori;
                categoryPageMap[cat]++; renderMainView();
            }

            const btnGroup = e.target.closest('.btn-view-nom-group');
            if (btnGroup) {
                const { jenis, detail, taId, tahun } = btnGroup.dataset;
                selectedFilters = { jenis, detail, taId, tahun };
                sessionStorage.setItem(SESSION_KEY_TA, taId);
                sessionStorage.setItem(SESSION_KEY_JENIS, jenis);
                sessionStorage.setItem(SESSION_KEY_DETAIL, detail);
                showDetailView();
            }
        });
    }
};

const resetSession = () => {
    sessionStorage.removeItem(SESSION_KEY_TA);
    sessionStorage.removeItem(SESSION_KEY_JENIS);
    sessionStorage.removeItem(SESSION_KEY_DETAIL);
    selectedFilters = {}; calculatedStudentList = [];
};

const formatDateIndo = (dateStr) => {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateStr));
};

// --- LOGIKA HITUNG NILAI & RANKING (Persis seperti Petikan) ---
const getNilaiKepribadianCalc = (siswa) => {
    const kat = (siswa.kategori || '').toLowerCase();
    if (kat.includes('dikbangspes') || kat.includes('sekolah bintara polisi')) {
        const nList = Array.isArray(siswa.nilaiKepribadian) ? siswa.nilaiKepribadian.map(n=>parseFloat(n)).filter(n=>!isNaN(n)) : [];
        const nInstruktur = nList.length > 0 ? nList[nList.length - 1] : 0;
        const nSos = parseFloat(siswa.nilaiSosiometri) || 0;
        return (nInstruktur * 0.7) + (nSos * 0.3);
    }
    let data = siswa.nilaiKepribadian;
    if (data && !Array.isArray(data) && data.nilaiAkhir) return parseFloat(data.nilaiAkhir) || 0;
    if (Array.isArray(data)) {
        const valid = data.map(n=>parseFloat(n)).filter(n=>!isNaN(n));
        return valid.length === 0 ? 0 : valid.reduce((a,b)=>a+b,0) / valid.length;
    }
    return 0;
};

const calculateRankingAndScores = async (group) => {
    if (!group || group.length === 0) return [];
    if (!localMapels || localMapels.length === 0) {
        try {
            const snap = await getDocs(getCollectionRef('mata_pelajaran'));
            localMapels = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) { console.error(e); }
    }

    const processed = await Promise.all(group.map(async (siswa) => {
        const acad = await getAcademicScores(siswa.id);
        const relMapels = localMapels.filter(m => String(m.tahunAjaran).trim() === String(siswa.tahunAjaran).trim() && String(m.kategori).trim().toLowerCase() === String(siswa.kategori).trim().toLowerCase() && String(m.detailPendidikan).trim().toLowerCase() === String(siswa.detailPendidikan).trim().toLowerCase());
        const scores = relMapels.map(m => acad[m.id] ? parseFloat(acad[m.id]) : 0);
        
        const rerataAkademik = scores.length > 0 ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
        const rerataKep = getNilaiKepribadianCalc(siswa);
        let rerataJas = 0;
        const isDikbangspes = (siswa.kategori || '').toLowerCase().includes('dikbangspes');
        
        if (!isDikbangspes && Array.isArray(siswa.nilaiJasmani) && siswa.nilaiJasmani.length > 0) {
            rerataJas = siswa.nilaiJasmani.reduce((a,b)=>a+(parseFloat(b)||0),0)/siswa.nilaiJasmani.length;
        }

        const finalScore = isDikbangspes ? (rerataAkademik + rerataKep)/2 : ((rerataAkademik*4) + (rerataKep*4) + (rerataJas*2))/10;

        return { ...siswa, finalScore, cleanNosis: siswa.nosis ? String(siswa.nosis).trim().replace(/\D/g, '') : '99999999' };
    }));

    processed.sort((a, b) => b.finalScore - a.finalScore);
    processed.forEach((s, i) => s.ranking = i + 1);
    return processed;
};

// --- VIEW LOGIC ---
const showMainView = () => { 
    mainView.classList.remove('hidden'); detailView.classList.add('hidden'); backButton.classList.add('hidden'); infoBadge.classList.add('hidden');
    titleText.textContent = 'DAFTAR NOMINATIF SISWA'; subtitleText.textContent = 'Daftar nominatif siswa beserta peringkat kelulusan.';
    if (searchInput) searchInput.value = ''; renderMainView(); 
};

const showDetailView = async () => { 
    mainView.classList.add('hidden'); detailView.classList.remove('hidden'); backButton.classList.remove('hidden'); 
    
    const { jenis, detail, tahun, taId } = selectedFilters; 
    const currentTA = localTaList.find(t => t.id === taId);
    let detailClean = detail !== '-' && detail ? ` ${detail.toUpperCase()}` : '';
    titleText.textContent = `${jenis.toUpperCase()}${detailClean} (TA ${tahun})`; 
    subtitleText.innerHTML = currentTA?.isActive ? '' : '<span class="text-red-500 font-bold">(ARSIP)</span>';
    
    showLoading("Menghitung Peringkat & Data...");
    const rawStudents = localStudents.filter(s => s.kategori === jenis && s.detailPendidikan === detail && s.tahunAjaran == tahun);
    calculatedStudentList = await calculateRankingAndScores(rawStudents);
    hideLoading();

    if (infoBadge) { 
        infoBadge.textContent = `Total Siswa : ${calculatedStudentList.length} | Mulai : ${formatDateIndo(currentTA?.tanggalMulai)} | Selesai : ${formatDateIndo(currentTA?.tanggalBerakhir)}`; 
        infoBadge.classList.remove('hidden'); 
    } 
    currentPage = 1; renderSiswaList(); 
};

const renderMainView = () => { 
    const allActive = []; 
    localTaList.forEach(ta => { if(ta.pendidikan) ta.pendidikan.forEach(p => allActive.push({ ...p, tahun: ta.tahun, taId: ta.id, isActive: ta.isActive })); }); 
    
    const renderTable = (kat, bodyId) => { 
        const tBody = document.getElementById(bodyId); 
        if (!tBody) return; 
        const items = allActive.filter(p => p.jenis === kat).sort((a,b) => (b.tahun - a.tahun) || (b.isActive - a.isActive));
        const cPage = categoryPageMap[kat] || 1;
        const start = (cPage - 1) * ROWS_PER_CAT; const end = start + ROWS_PER_CAT;
        const pItems = items.slice(start, end);

        tBody.innerHTML = ''; 
        if (items.length === 0) { tBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-subtle italic">Tidak ada data.</td></tr>`; return; } 

        pItems.forEach((p, i) => { 
            const status = p.isActive ? `<span class="bg-green-700 text-white text-xs font-bold px-3 py-1 rounded">AKTIF</span>` : `<span class="bg-red-700 text-white text-xs font-bold px-3 py-1 rounded">ARSIP</span>`;
            const btnClass = p.isActive ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-600 hover:bg-gray-700';
            const detailText = p.detail && p.detail !== '-' ? ` ${p.detail}` : '';

            tBody.innerHTML += ` 
                <tr class="border-b border-main hover:bg-tertiary">
                    <td class="p-3 text-center">${start + i + 1}</td> 
                    <td class="p-3 font-medium">${p.jenis}${detailText} <span class="text-xs text-subtle ml-1">(TA ${p.tahun})</span></td> 
                    <td class="p-3 text-center">${status}</td>
                    <td class="p-3 text-center"> 
                        <button class="${btnClass} w-full text-white text-xs py-1.5 px-3 rounded btn-view-nom-group shadow transition-colors" data-jenis="${p.jenis}" data-detail="${p.detail}" data-tahun="${p.tahun}" data-ta-id="${p.taId}"> ${p.isActive ? 'Kelola' : 'Lihat'} </button> 
                    </td> 
                </tr>`; 
        }); 
        
        if (Math.ceil(items.length / ROWS_PER_CAT) > 1) {
            tBody.innerHTML += `<tr><td colspan="4" class="p-2 text-center bg-tertiary"><div class="flex justify-between items-center text-xs px-2"><span class="text-subtle">${start + 1}-${Math.min(end, items.length)} dari ${items.length}</span><div class="flex gap-1"><button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-prev-cat" data-kategori="${kat}" ${cPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button><button class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 btn-next-cat" data-kategori="${kat}" ${cPage === Math.ceil(items.length / ROWS_PER_CAT) ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button></div></div></td></tr>`;
        }
    }; 
    
    renderTable('Diktuk Tamtama', 'list-nom-diktuk-tamtama'); 
    renderTable('Diktuk Bintara', 'list-nom-diktuk-bintara'); 
    renderTable('Dikbangspes', 'list-nom-dikbangspes'); 
    renderTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'list-nom-dikbagum-sbp'); 
};

const renderSiswaList = () => { 
    if (!tableBody) return; tableBody.innerHTML = ''; 
    const search = searchInput ? searchInput.value.toLowerCase() : ''; 
    const fBat = document.getElementById('filter-nominatif-batalyon')?.value;
    const fKom = document.getElementById('filter-nominatif-kompi')?.value;
    const fPel = document.getElementById('filter-nominatif-peleton')?.value;
    const sortVal = document.getElementById('sort-nominatif-select')?.value || 'rank_asc';

    let filtered = calculatedStudentList.filter(s => 
        (search ? (s.nama && s.nama.toLowerCase().includes(search)) || (s.nosis && s.nosis.includes(search)) : true) &&
        (fBat ? s.batalyon === fBat : true) && (fKom ? s.kompi === fKom : true) && (fPel ? s.peleton === fPel : true)
    ); 

    filtered.sort((a, b) => {
        if (sortVal === 'nosis_asc') return a.cleanNosis.localeCompare(b.cleanNosis, undefined, { numeric: true });
        if (sortVal === 'nosis_desc') return b.cleanNosis.localeCompare(a.cleanNosis, undefined, { numeric: true });
        if (sortVal === 'nama_asc') return String(a.nama||'').localeCompare(String(b.nama||''));
        if (sortVal === 'nama_desc') return String(b.nama||'').localeCompare(String(a.nama||''));
        if (sortVal === 'rank_asc') return (a.ranking||999) - (b.ranking||999);
        return 0;
    });
    
    const tPages = Math.ceil(filtered.length / ROWS_PER_PAGE); 
    currentPage = Math.min(Math.max(1, currentPage), tPages || 1); 
    const start = (currentPage - 1) * ROWS_PER_PAGE; 
    const pSiswa = filtered.slice(start, start + ROWS_PER_PAGE); 
    
    if (pSiswa.length === 0) { 
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-subtle italic">Tidak ada data siswa ditemukan.</td></tr>`; 
        renderPagination(0, 0); return; 
    } 
    
    pSiswa.forEach((s, i) => { 
        const fotoHTML = s.fotoUrl ? `<img src="${s.fotoUrl}" class="w-10 h-12 object-cover rounded shadow-sm mx-auto">` : `<div class="w-10 h-12 bg-gray-300 rounded mx-auto flex items-center justify-center text-xs text-gray-500">No Pic</div>`;
        const polda = s.asalPengiriman || s.polda || '-';
        tableBody.innerHTML += ` 
            <tr class="border-b border-main hover:bg-tertiary"> 
                <td class="p-3 text-center text-subtle font-bold">${start + i + 1}</td> 
                <td class="p-2 text-center">${fotoHTML}</td>
                <td class="p-3 font-bold text-main uppercase">${s.nama}</td> 
                <td class="p-3 text-center text-subtle font-bold">${s.nosis || '-'}</td> 
                <td class="p-3 text-center text-subtle font-medium">${s.pangkat || '-'} / ${s.nrp || '-'}</td> 
                <td class="p-3 text-center text-subtle font-medium uppercase">${polda}</td> 
                <td class="p-3 text-center text-blue-700 font-extrabold text-lg">${s.finalScore.toFixed(2)}</td> 
                <td class="p-3 text-center text-green-600 font-extrabold text-xl">${s.ranking || '-'}</td> 
            </tr>`; 
    }); 
    renderPagination(tPages, filtered.length); 
};

const renderPagination = (tPages, tItems) => { 
    if (!paginationContainer) return; 
    if (tItems === 0) { paginationContainer.innerHTML = ''; return; } 
    const start = (currentPage - 1) * ROWS_PER_PAGE + 1; 
    const end = Math.min(start + ROWS_PER_PAGE - 1, tItems); 
    
    let html = `<span class="text-sm text-subtle">Menampilkan ${start} - ${end} dari ${tItems} data</span>`; 
    if (tPages > 1) { 
        html += `<div class="inline-flex mt-2 xs:mt-0"><button id="prev-nom-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main border border-main disabled:opacity-50">Sebelumnya</button><button id="next-nom-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-t border-b border-r border-main hover:bg-main disabled:opacity-50">Selanjutnya</button></div>`; 
    } 
    paginationContainer.innerHTML = html; 
    
    const pBtn = document.getElementById('prev-nom-page'); const nBtn = document.getElementById('next-nom-page'); 
    if (pBtn) { pBtn.disabled = (currentPage === 1); pBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderSiswaList(); }}); } 
    if (nBtn) { nBtn.disabled = (currentPage >= tPages); nBtn.addEventListener('click', () => { if (currentPage < tPages) { currentPage++; renderSiswaList(); }}); } 
};

// ==========================================================
// ===             EXPORT EXCEL & PDF                     ===
// ==========================================================

const getFilteredAndSortedStudents = () => {
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const fBat = document.getElementById('filter-nominatif-batalyon')?.value;
    const fKom = document.getElementById('filter-nominatif-kompi')?.value;
    const fPel = document.getElementById('filter-nominatif-peleton')?.value;
    const sortVal = document.getElementById('sort-nominatif-select')?.value || 'rank_asc';

    let filtered = calculatedStudentList.filter(s => 
        (search ? (s.nama && s.nama.toLowerCase().includes(search)) || (s.nosis && s.nosis.includes(search)) : true) &&
        (fBat ? s.batalyon === fBat : true) && (fKom ? s.kompi === fKom : true) && (fPel ? s.peleton === fPel : true)
    ); 

    filtered.sort((a, b) => {
        if (sortVal === 'nosis_asc') return a.cleanNosis.localeCompare(b.cleanNosis, undefined, { numeric: true });
        if (sortVal === 'nosis_desc') return b.cleanNosis.localeCompare(a.cleanNosis, undefined, { numeric: true });
        if (sortVal === 'nama_asc') return String(a.nama||'').localeCompare(String(b.nama||''));
        if (sortVal === 'nama_desc') return String(b.nama||'').localeCompare(String(a.nama||''));
        if (sortVal === 'rank_asc') return (a.ranking||999) - (b.ranking||999);
        return 0;
    });
    return filtered;
};

const exportToExcel = () => {
    const students = getFilteredAndSortedStudents();
    if (students.length === 0) { alert('Tidak ada data siswa.'); return; }

    showLoading('Exporting Excel...');
    try {
        let detailClean = selectedFilters.detail !== '-' ? ` ${selectedFilters.detail.toUpperCase()}` : '';
        const judul = `DAFTAR NOMINATIF ${selectedFilters.jenis.toUpperCase()}${detailClean} TA ${selectedFilters.tahun}`;
        
        const header = ["No", "Nama Lengkap", "Nosis", "Pangkat / NRP", "Asal Pengiriman", "Nilai Akhir", "Peringkat", "Foto URL"];
        const rows = students.map((s, i) => [
            i + 1, s.nama.toUpperCase(), s.nosis || '-', `${s.pangkat || '-'} / ${s.nrp || '-'}`,
            (s.asalPengiriman || s.polda || '-').toUpperCase(), parseFloat(s.finalScore.toFixed(2)), s.ranking || '-', s.fotoUrl || 'Tidak ada'
        ]);

        const wsData = [ ["POLRI"], ["LEMDIKLAT"], ["PUSDIK POLAIR"], [], [judul], [], header, ...rows ];
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        
        worksheet['!cols'] = [{wch: 5}, {wch: 35}, {wch: 15}, {wch: 25}, {wch: 25}, {wch: 12}, {wch: 10}, {wch: 50}];
        worksheet['!merges'] = [ {s:{r:0,c:0},e:{r:0,c:3}}, {s:{r:1,c:0},e:{r:1,c:3}}, {s:{r:2,c:0},e:{r:2,c:3}}, {s:{r:4,c:0},e:{r:4,c:6}} ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, "Nominatif");
        XLSX.writeFile(wb, `Nominatif_${selectedFilters.jenis}_TA${selectedFilters.tahun}.xlsx`.replace(/\s+/g, '_'));
    } catch (e) {
        console.error(e); alert('Gagal Export Excel');
    }
    hideLoading();
};

const printToPDF = () => {
    const students = getFilteredAndSortedStudents();
    if (students.length === 0) { alert('Tidak ada data siswa.'); return; }

    let detailClean = selectedFilters.detail !== '-' ? ` ${selectedFilters.detail.toUpperCase()}` : '';
    const title = `DAFTAR NOMINATIF SISWA ${selectedFilters.jenis.toUpperCase()}${detailClean}<br>TAHUN AJARAN ${selectedFilters.tahun}`;

    let rowsHTML = students.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${s.fotoUrl ? `<img src="${s.fotoUrl}" style="width: 45px; height: 55px; object-fit: cover; border-radius: 4px;">` : 'No Pic'}</td>
            <td style="text-align: left; padding-left: 10px; font-weight: bold;">${s.nama.toUpperCase()}</td>
            <td>${s.nosis || '-'}</td>
            <td>${s.pangkat || '-'} / ${s.nrp || '-'}</td>
            <td>${(s.asalPengiriman || s.polda || '-').toUpperCase()}</td>
            <td>${s.finalScore.toFixed(2)}</td>
            <td style="font-weight: bold;">${s.ranking || '-'}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>Cetak Nominatif</title>
        <style>
            body { font-family: 'Arial', sans-serif; margin: 20px; color: #000; }
            .kop { margin-bottom: 20px; font-size: 14px; font-weight: bold; line-height: 1.2; }
            .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 30px; text-decoration: underline; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; }
            th, td { border: 1px solid #000; padding: 6px; }
            th { background-color: #f2f2f2; text-transform: uppercase; }
            @media print { @page { size: A4 portrait; margin: 10mm; } }
        </style></head><body>
            <div class="kop">KEPOLISIAN NEGARA REPUBLIK INDONESIA<br>LEMBAGA PENDIDIKAN DAN PELATIHAN<br>PUSAT PENDIDIKAN KEPOLISIAN PERAIRAN</div>
            <div class="title">${title}</div>
            <table><thead><tr>
                <th style="width: 5%;">No</th><th style="width: 10%;">Foto</th><th style="width: 25%;">Nama Lengkap</th>
                <th style="width: 10%;">Nosis</th><th style="width: 20%;">Pangkat/NRP</th><th style="width: 15%;">Asal Pengiriman</th>
                <th style="width: 10%;">Nilai Akhir</th><th style="width: 5%;">Rank</th>
            </tr></thead><tbody>${rowsHTML}</tbody></table>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 800);
};