// public/js/modules/dashboard.js

import { openSiswaDetailModalFromData } from './siswa.js';
import { getAcademicScores } from '../firestore-service.js';
import { showLoading, hideLoading, showSection } from '../ui.js';

let AppState = {};
let peringkatSiswaChartInstance = null;
let topStudentChartInstance = null;
let allRankedData = [];
let currentSlideIndex = 0;
let sliderInterval = null;
let isChartPluginRegistered = false;
let areDashboardLinksSetup = false;

/**
 * Fungsi helper untuk mengubah string menjadi Title Case dengan pengecualian untuk singkatan.
 */
const toTitleCaseWithAbbr = (str, abbrs = ['SAR', 'TA', 'POLAIR', 'V']) => { // Tambahkan singkatan lain jika perlu
    if (!str) return '';
    const upperAbbrs = abbrs.map(a => a.toUpperCase());
    return str.toLowerCase().split(' ').map(word => {
        if (upperAbbrs.includes(word.toUpperCase())) {
            return word.toUpperCase();
        }
        // Handle angka romawi (misal: V) - Jika kata hanya terdiri dari huruf I, V, X, L, C, D, M
        if (/^[IVXLCDM]+$/i.test(word)) {
            return word.toUpperCase();
        }
        if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return ''; // Handle spasi ganda
    }).join(' ');
};


/**
 * Fungsi utama untuk inisialisasi modul dashboard.
 */
export const initDashboardModule = (user, appData) => {
    if (!user || !user.role) return;
    AppState = appData;

    switch (user.role) {
        case 'super_admin':
        case 'operator':
        case 'gadik':
            renderAdminDashboard(user);
            break;
        case 'siswa':
        case 'alumni': // [UPDATE] Alumni menggunakan dashboard siswa
            renderSiswaDashboard(user);
            break;
    }
    setupDashboardLinks();
};

// --- [FUNGSI BARU] Diekspor untuk dipanggil oleh ui.js ---
export const reRenderDashboardCharts = () => {
    const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!currentUser) return;
    
    console.log(`[Dashboard] Merender ulang grafik untuk ${currentUser.role}`);
    
    // Panggil fungsi render yang sesuai
    if (currentUser.role === 'siswa' || currentUser.role === 'alumni') {
        renderSiswaDashboard(currentUser); 
    } else {
        renderAdminDashboard(currentUser);
    }
};
// --- [AKHIR FUNGSI BARU] ---


const setupDashboardLinks = () => {
    if (areDashboardLinksSetup) return;
    document.body.addEventListener('click', (e) => {
        
        // --- PERBAIKAN DI SINI ---
        // Menambahkan '.dashboard-icon-btn' agar menu ikon di HP bisa diklik
        const link = e.target.closest('.dashboard-stat-link, .dashboard-action-btn, .dashboard-icon-btn'); 
        // --- AKHIR PERBAIKAN ---

        if (link) {
            e.preventDefault();
            const sectionId = link.dataset.section;
            if (sectionId) {
                document.querySelector(`.nav-item[data-section="${sectionId}"]`)?.click();
            }
        }
    });
    areDashboardLinksSetup = true;
};


// =============================================
// FUNGSI UNTUK DASBOR ADMIN & GADIK
// =============================================
function renderAdminDashboard(user) {
    // [MODIFIKASI] Pengecekan 'hidden' dipindahkan ke sini
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection && dashboardSection.classList.contains('hidden')) {
        return; // Jangan render jika section tidak terlihat
    }
    
    // Cek elemen dashboard admin dan gadik
    const adminPhoto = document.getElementById('admin-dashboard-photo');
    const gadikPhoto = document.getElementById('gadik-dashboard-photo');

    if (user.role === 'gadik' && gadikPhoto) {
        gadikPhoto.src = user.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    } else if ((user.role === 'super_admin' || user.role === 'operator') && adminPhoto) {
        adminPhoto.src = user.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    }
    updateDashboardStats();
    calculateAndStoreRankings();
}

const updateDashboardStats = () => {
    const totalSiswaEl = document.getElementById('stat-total-siswa');
    const totalGadikEl = document.getElementById('stat-total-gadik');
    const totalMapelEl = document.getElementById('stat-total-mapel');
    const tahunAktifEl = document.getElementById('stat-tahun-ajaran');

    if (!totalSiswaEl || !totalGadikEl || !totalMapelEl || !tahunAktifEl || !AppState.tahunAjaran) return;

    const activeTAs = (AppState.tahunAjaran || []).filter(ta => ta.isActive === true);
    const allActivePendidikan = activeTAs.flatMap(ta =>
        (ta.pendidikan || []).map(p => ({ tahun: ta.tahun, kategori: p.jenis, detail: p.detail }))
    );
    const activeStudents = (AppState.students || []).filter(s =>
        allActivePendidikan.some(p => p.tahun === s.tahunAjaran && p.kategori === s.kategori && p.detail === s.detailPendidikan)
    );
    const activeMapels = (AppState.mapels || []).filter(m =>
        allActivePendidikan.some(p => p.tahun === m.tahunAjaran && p.kategori === m.kategori && p.detail === m.detailPendidikan)
    );
    const uniqueYears = [...new Set(activeTAs.map(ta => ta.tahun))];

    totalSiswaEl.textContent = activeStudents.length;
    totalGadikEl.textContent = (AppState.gadik || []).length;
    totalMapelEl.textContent = activeMapels.length;
    tahunAktifEl.textContent = uniqueYears.join(', ') || '-';
};

const calculateAndStoreRankings = async () => {
    const sliderContainer = document.getElementById('peringkat-slider-container');
    if (!sliderContainer) return;

    // [MODIFIKASI] Cek jika dashboard tidak terlihat
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection && dashboardSection.classList.contains('hidden')) {
        return; 
    }
    // [AKHIR MODIFIKASI]

    sliderContainer.innerHTML = '<p class="text-subtle text-center">Menghitung peringkat...</p>';

    try {
        const activeTAs = (AppState.tahunAjaran || []).filter(ta => ta.isActive === true);
        if (activeTAs.length === 0) {
            sliderContainer.innerHTML = '<p class="text-subtle text-center">Tidak ada Tahun Ajaran aktif.</p>';
            return;
        }

        const allActivePendidikan = activeTAs.flatMap(ta =>
            (ta.pendidikan || []).map(p => ({ tahun: ta.tahun, ...p }))
        );

        allRankedData = [];

        for (const pendidikan of allActivePendidikan) {
            const studentsInCategory = (AppState.students || []).filter(s =>
                s.kategori === pendidikan.jenis && s.detailPendidikan === pendidikan.detail && s.tahunAjaran === pendidikan.tahun
            );

            if (studentsInCategory.length === 0) continue;

            const studentScores = await Promise.all(studentsInCategory.map(async (siswa) => {
                const academicScores = await getAcademicScores(siswa.id);
                const relevantMapels = (AppState.mapels || [])
                    .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
                    .map(mapel => academicScores[mapel.id] ?? 0);

                const rerataAkademik = relevantMapels.length > 0 ? (relevantMapels.reduce((a, b) => a + b, 0) / relevantMapels.length) : 0;

                let rerataKepribadian = 0;
                if (siswa.kategori === 'Dikbangspes') {
                    const nilaiList = siswa.nilaiKepribadian || [];
                    const validNilaiList = nilaiList.filter(n => n !== null && n !== undefined && !isNaN(n));
                    const rerataInstruktur = validNilaiList.length > 0 ? (validNilaiList.reduce((a, b) => a + b, 0) / validNilaiList.length) : 0;
                    const nilaiSosiometri = siswa.nilaiSosiometri || 0;
                    rerataKepribadian = (rerataInstruktur * 0.7) + (nilaiSosiometri * 0.3);
                } else {
                    const nilaiKepribadianList = siswa.nilaiKepribadian || [];
                    const validNilaiList = nilaiKepribadianList.filter(n => n !== null && n !== undefined && !isNaN(n));
                    rerataKepribadian = validNilaiList.length > 0 ? (validNilaiList.reduce((a, b) => a + b, 0) / validNilaiList.length) : 0;
                }

                let finalScore = 0;
                let rerataJasmani = 0;
                if (siswa.kategori !== 'Dikbangspes') {
                    const nilaiJasmaniList = siswa.nilaiJasmani || [];
                    const validJasmaniList = nilaiJasmaniList.filter(n => n !== null && n !== undefined && !isNaN(n));
                    rerataJasmani = validJasmaniList.length > 0 ? (validJasmaniList.reduce((a, b) => a + b, 0) / validJasmaniList.length) : 0;
                    finalScore = (rerataAkademik * 0.5) + (rerataKepribadian * 0.3) + (rerataJasmani * 0.2);
                } else {
                    finalScore = (rerataAkademik * 0.6) + (rerataKepribadian * 0.4);
                }

                return { ...siswa, finalScore, rerataAkademik, rerataKepribadian, rerataJasmani };
            }));

            studentScores.sort((a, b) => b.finalScore - a.finalScore);

            allRankedData.push({
                title: toTitleCaseWithAbbr(`${pendidikan.jenis} ${pendidikan.detail}`),
                students: studentScores.slice(0, 5) // Admin dashboard tetap top 5
            });
        }

        currentSlideIndex = 0;
        renderSlider(); // Render slide pertama
        startSliderInterval(); // Mulai interval

    } catch (error) {
        console.error("Gagal memuat peringkat siswa:", error);
        sliderContainer.innerHTML = '<p class="text-red-500 text-center">Gagal memuat data peringkat.</p>';
    }
};


const renderSlider = () => {
    const sliderContainer = document.getElementById('peringkat-slider-container');
    const titleElement = document.getElementById('peringkat-slider-title');

    if (!sliderContainer || !titleElement) return;

    if (allRankedData.length === 0) {
        sliderContainer.innerHTML = '<p class="text-subtle text-center pt-10">Belum ada siswa aktif untuk diperingkatkan.</p>';
        titleElement.textContent = '🏆 Peringkat Siswa Terbaik';
        updateChart(-1); // Update chart dengan data kosong
        return;
    }

    // Pastikan index valid
    if(currentSlideIndex >= allRankedData.length) currentSlideIndex = 0;

    // Render semua slide, tapi hanya satu yang visible
    sliderContainer.innerHTML = allRankedData.map((data, index) => `
        <div class="slider-item absolute top-0 left-0 w-full h-full transition-opacity duration-700 ease-in-out ${index === currentSlideIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
            ${data.students.length > 0 ? data.students.map((siswa, rankIndex) => `
                <div class="flex items-center p-3 rounded-lg hover:bg-tertiary transition-colors">
                    <span class="text-lg font-bold w-8 text-center ${rankIndex < 3 ? 'text-yellow-400' : 'text-subtle'}">${rankIndex + 1}</span>
                    <img src="${siswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483'}" class="w-10 h-10 rounded-full object-cover ml-2 mr-4">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-main truncate">${siswa.nama}</p>
                        <p class="text-xs text-subtle truncate">${toTitleCaseWithAbbr(siswa.kategori + ' ' + siswa.detailPendidikan)}</p>
                    </div>
                    <span class="font-bold text-lg text-main">${siswa.finalScore.toFixed(2)}</span>
                </div>
            `).join('') : '<p class="text-subtle text-center pt-10">Tidak ada data nilai untuk kategori ini.</p>'}
        </div>
    `).join('');

    // Update judul slider
    titleElement.textContent = `🏆 Peringkat: ${allRankedData[currentSlideIndex].title}`; // Judul sudah diformat

    updateChart(currentSlideIndex); // Update chart sesuai slide aktif
};

const startSliderInterval = () => {
    if (sliderInterval) clearInterval(sliderInterval); // Hapus interval lama jika ada
    if (allRankedData.length > 1) { // Hanya jalankan jika ada lebih dari 1 slide
        sliderInterval = setInterval(() => {
            currentSlideIndex = (currentSlideIndex + 1) % allRankedData.length;
            renderSlider(); // Render ulang slider dengan index baru
        }, 5000); // Ganti slide setiap 5 detik
    }
};

const updateChart = (index) => {
    const chartCanvas = document.getElementById('topStudentChart');
    if (!chartCanvas) return;

    if (topStudentChartInstance) {
        topStudentChartInstance.destroy(); // Hapus chart lama
    }

    // Jika index tidak valid atau tidak ada data, buat chart kosong
    if (index < 0 || !allRankedData[index] || allRankedData[index].students.length === 0) {
        topStudentChartInstance = new Chart(chartCanvas.getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ data: [] }] }});
        return;
    }

    const topStudents = allRankedData[index].students;
    const chartLabels = topStudents.map(s => s.nosis); // Label pakai Nosis
    const chartData = topStudents.map(s => s.finalScore); // Data pakai finalScore

    topStudentChartInstance = new Chart(chartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Nilai Akhir',
                data: chartData,
                backgroundColor: ['#00a65a', '#f39c12', '#00c0ef', '#dd4b39', '#3c8dbc'].slice(0, topStudents.length) // Warna sesuai jumlah siswa
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Buat jadi bar horizontal
            scales: {
                x: { beginAtZero: true, max: 100 },
                y: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false } // Sembunyikan legenda
            }
        }
    });
};


// =============================================
// FUNGSI UNTUK DASBOR SISWA & ALUMNI
// =============================================
function renderSiswaDashboard(user) {
    // --- [MODIFIKASI DI SINI] ---
    // Cek apakah section dashboard sedang aktif/terlihat
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection && dashboardSection.classList.contains('hidden')) {
        // Jika section dashboard tidak aktif, jangan render ulang grafiknya
        return; 
    }
    // --- [AKHIR MODIFIKASI] ---
    
    const detailsEl = document.getElementById('student-dashboard-details');
    if (detailsEl) detailsEl.textContent = `Siswa ${toTitleCaseWithAbbr(user.detailPendidikan || user.kategori)} TA. ${user.tahunAjaran || '...'}`;

    renderNewKTSCard(user);
    renderPeringkatSiswa(user);

    // ============================================
    // === [UPDATE] LOGIKA TAMPILAN KHUSUS ALUMNI ===
    // ============================================
    if (user.role === 'alumni') {
        
        // 1. Ubah Judul Selamat Datang
        const welcomeUser = document.getElementById('dashboard-welcome-user');
        if (welcomeUser) welcomeUser.textContent = "Alumni";
        
        if (detailsEl) {
            detailsEl.textContent = `Alumni ${toTitleCaseWithAbbr(user.detailPendidikan || user.kategori)} TA. ${user.tahunAjaran}`;
        }

        // 2. Sembunyikan Tombol/Icon Menu yang tidak relevan di Dashboard
        const forbiddenSections = [
            'jadwal-mengajar-section', 
            'lms-section', 
            'pelanggaran-siswa-section', 
            'sosiometri-section', 
            'pengumuman-section'
        ];

        document.querySelectorAll('.dashboard-icon-btn').forEach(btn => {
            const section = btn.dataset.section;
            if (forbiddenSections.includes(section)) {
                btn.style.display = 'none'; // Sembunyikan icon
            }
        });

        // 3. Sembunyikan Card Peringkat (Kiri Bawah) - Alumni tidak ikut ranking aktif
        const peringkatCard = document.getElementById('peringkat-card');
        if (peringkatCard) peringkatCard.style.display = 'none';

        // 4. Sembunyikan Card Pengumuman (Opsional, jika alumni tidak perlu info)
        const pengumumanCard = document.getElementById('pengumuman-card');
        if (pengumumanCard) pengumumanCard.style.display = 'none';

        // 5. Modifikasi Layout Grafik (Kanan Bawah)
        const grafikContainer = document.getElementById('grafik-card');
        if (grafikContainer) {
            // Sembunyikan Grafik Batang Peringkat (Top 5)
            const colTop5 = grafikContainer.querySelector('.md\\:col-span-2');
            if (colTop5) colTop5.style.display = 'none';
            
            // Perlebar Grafik Donut (Nilai Sendiri) agar memenuhi lebar card
            const colNilaiSendiri = grafikContainer.querySelector('.md\\:col-span-1');
            if (colNilaiSendiri) {
                // Hapus kelas kolom sempit dan border
                colNilaiSendiri.classList.remove('md:col-span-1', 'border-l', 'pl-4');
                // Tambahkan kelas lebar penuh dan layout flex
                colNilaiSendiri.classList.add('w-full', 'md:col-span-3', 'flex', 'flex-row', 'justify-around', 'items-center', 'flex-wrap');
                
                // Styling manual untuk memastikan layout bagus
                colNilaiSendiri.style.borderLeft = 'none';
                colNilaiSendiri.style.paddingLeft = '0';
            }
        }
    }
}

const renderNewKTSCard = (user) => {
    const ktsCard = document.getElementById('new-kts-card'),
          ktsFoto = document.getElementById('kts-foto'),
          ktsNama = document.getElementById('kts-nama'),
          ktsNosis = document.getElementById('kts-nosis'),
          ktsPendidikan = document.getElementById('kts-pendidikan');

    if (!user || !ktsCard || !ktsFoto || !ktsNama || !ktsNosis || !ktsPendidikan) {
        return;
    }

    // 1. Ambil pengaturan KTS KUSTOM (TANPA nilai default hardcoded)
    const ktsSettings = AppState.settings?.kts; 

    const pendidikanText = `SISWA ${toTitleCaseWithAbbr(user.detailPendidikan || user.kategori)} (TA ${user.tahunAjaran || '...'})`;
    ktsFoto.src = user.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    ktsNama.textContent = user.nama || 'NAMA SISWA';
    ktsNosis.textContent = `NOSIS : ${user.nosis || '-'}`;
    ktsPendidikan.textContent = pendidikanText;

    // 2. HANYA terapkan style dinamis JIKA ADA pengaturan kustom
    if (ktsSettings) {
        // Terapkan style foto kustom (jika ada)
        if (ktsSettings.fotoWidth) ktsFoto.style.width = `${ktsSettings.fotoWidth}px`;
        if (ktsSettings.fotoHeight) ktsFoto.style.height = `${ktsSettings.fotoHeight}px`;
        if (ktsSettings.fotoTop) ktsFoto.style.top = `${ktsSettings.fotoTop}px`;
        if (ktsSettings.fotoRight) ktsFoto.style.right = `${ktsSettings.fotoRight}px`;

        // Terapkan style teks kustom (jika ada)
        [ktsNama, ktsNosis, ktsPendidikan].forEach(el => {
            if (el) {
                if (ktsSettings.fontFamily) {
                    el.style.fontFamily = ktsSettings.fontFamily.replace(/'/g, "");
                    el.style.fontWeight = ktsSettings.fontFamily.includes('Bold') ? 'bold' : 'normal';
                }
                if (ktsSettings.fontColor) el.style.color = ktsSettings.fontColor;
            }
        });

        if (ktsSettings.fontSizeNama) ktsNama.style.fontSize = `${ktsSettings.fontSizeNama}px`;
        if (ktsSettings.namaTop) ktsNama.style.top = `${ktsSettings.namaTop}px`;
        if (ktsSettings.namaLeft) ktsNama.style.left = `${ktsSettings.namaLeft}px`;

        if (ktsSettings.fontSizeNosis) ktsNosis.style.fontSize = `${ktsSettings.fontSizeNosis}px`;
        if (ktsSettings.nosisTop) ktsNosis.style.top = `${ktsSettings.nosisTop}px`;
        if (ktsSettings.nosisLeft) ktsNosis.style.left = `${ktsSettings.nosisLeft}px`;

        if (ktsSettings.fontSizePendidikan) ktsPendidikan.style.fontSize = `${ktsSettings.fontSizePendidikan}px`;
        if (ktsSettings.pendidikanTop) ktsPendidikan.style.top = `${ktsSettings.pendidikanTop}px`;
        if (ktsSettings.pendidikanLeft) ktsPendidikan.style.left = `${ktsSettings.pendidikanLeft}px`;
    } else {
        // 3. JIKA TIDAK ADA setting kustom, hapus inline style yang mungkin tersisa
        //    (dari login/logout user lain) agar style dari CSS (style.css) yang dipakai.
        ktsFoto.style.cssText = "";
        ktsNama.style.cssText = "";
        ktsNosis.style.cssText = "";
        ktsPendidikan.style.cssText = "";
    }

    // Tambahkan event listener untuk membuka detail modal jika fungsi tersedia
    ktsCard.addEventListener('click', () => {
        if (typeof openSiswaDetailModalFromData === 'function') {
            openSiswaDetailModalFromData(user);
        }
    });
};

async function renderPeringkatSiswa(currentUser) {
    const peringkatContainer = document.getElementById('peringkat-siswa-container');
    const peringkatTitle = document.getElementById('peringkat-title');
    if (!peringkatContainer || !peringkatTitle) return;

    peringkatTitle.textContent = `Peringkat: ${toTitleCaseWithAbbr(currentUser.detailPendidikan || currentUser.kategori)}`;

    const studentsInClass = (AppState.students || []).filter(s =>
        s.kategori === currentUser.kategori &&
        s.detailPendidikan === currentUser.detailPendidikan &&
        s.tahunAjaran === currentUser.tahunAjaran
    );

    if (studentsInClass.length === 0) {
        peringkatContainer.innerHTML = '<p class="text-subtle text-sm text-center">Data peringkat belum tersedia.</p>';
        return;
    }

    const studentScores = await Promise.all(studentsInClass.map(async (siswa) => {
        const academicScores = await getAcademicScores(siswa.id);
        const relevantMapels = (AppState.mapels || [])
            .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
            .map(mapel => academicScores[mapel.id] ?? 0);

        const rerataAkademik = relevantMapels.length > 0 ? (relevantMapels.reduce((a, b) => a + b, 0) / relevantMapels.length) : 0;

        let rerataKepribadian = 0;
        if (siswa.kategori === 'Dikbangspes') {
            const nilaiList = siswa.nilaiKepribadian || [];
            const validNilaiList = nilaiList.filter(n => n !== null && n !== undefined && !isNaN(n));
            const rerataInstruktur = validNilaiList.length > 0 ? (validNilaiList.reduce((a, b) => a + b, 0) / validNilaiList.length) : 0;
            const nilaiSosiometri = siswa.nilaiSosiometri || 0;
            rerataKepribadian = (rerataInstruktur * 0.7) + (nilaiSosiometri * 0.3);
        } else {
            const nilaiKepribadianList = siswa.nilaiKepribadian || [];
            const validNilaiList = nilaiKepribadianList.filter(n => n !== null && n !== undefined && !isNaN(n));
            rerataKepribadian = validNilaiList.length > 0 ? (validNilaiList.reduce((a, b) => a + b, 0) / validNilaiList.length) : 0;
        }

        let finalScore = 0;
        let rerataJasmani = 0;
        if (siswa.kategori !== 'Dikbangspes') {
            const nilaiJasmaniList = siswa.nilaiJasmani || [];
            const validJasmaniList = nilaiJasmaniList.filter(n => n !== null && n !== undefined && !isNaN(n));
            rerataJasmani = validJasmaniList.length > 0 ? (validJasmaniList.reduce((a, b) => a + b, 0) / validJasmaniList.length) : 0;
            finalScore = (rerataAkademik * 0.5) + (rerataKepribadian * 0.3) + (rerataJasmani * 0.2);
        } else {
            finalScore = (rerataAkademik * 0.6) + (rerataKepribadian * 0.4);
        }
        
        return { ...siswa, finalScore, rerataAkademik, rerataKepribadian, rerataJasmani };
    }));

    studentScores.sort((a, b) => b.finalScore - a.finalScore);
    
    // --- KEMBALI KE TOP 5 (FIX SCROLL) ---
    const top5 = studentScores.slice(0, 5);

    peringkatContainer.innerHTML = top5.map((siswa, index) => {
        const isCurrentUser = siswa.id === currentUser.id;
        const bgClass = isCurrentUser ? 'bg-blue-800' : ''; // Highlight user saat ini
        const textClass = isCurrentUser ? 'text-white' : 'text-main';
        const rankColor = index < 3 ? 'text-yellow-400' : (isCurrentUser ? 'text-gray-300' : 'text-subtle');

        return `
            <div class="flex items-center p-2 rounded-lg ${bgClass}">
                <span class="text-lg font-bold w-8 text-center ${rankColor}">${index + 1}</span>
                <img src="${siswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483'}" class="w-8 h-8 rounded-full object-cover ml-2 mr-3">
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm truncate ${textClass}">${siswa.nama}</p>
                </div>
                <span class="font-bold text-sm ${textClass}">${siswa.finalScore.toFixed(2)}</span>
            </div>
        `;
    }).join('');
    
    // ==================================================================
    // ===                 PERUBAHAN LOGIKA TRY/CATCH                 ===
    // ==================================================================
    // Ini untuk memastikan jika salah satu grafik gagal, yang lain tetap jalan

    try {
        const currentUserData = studentScores.find(s => s.id === currentUser.id);
        if (currentUserData) {
            renderDonutCharts(currentUserData);
        } else {
            // Jika data user tidak ada (misal baru dibuat), sembunyikan donut
            renderDonutCharts({ rerataAkademik: 0, rerataKepribadian: 0, rerataJasmani: 0, kategori: 'Diktuk' }); 
        }
    } catch (e) {
        console.error("Gagal merender Donut Chart:", e);
    }

    try {
        renderPeringkatGrafik(top5); // Kirim data top5 ke fungsi grafik
    } catch (e) {
        console.error("Gagal merender Bar Chart Peringkat:", e);
    }
}


//
// ==================================================================
// === FUNGSI GRAFIK YANG DIPERBARUI (DIGITAL LOOK) ===
// ==================================================================
//
function renderPeringkatGrafik(top5Data) { // Mengganti nama parameter
    const chartCanvas = document.getElementById('peringkatSiswaChart');
    if (!chartCanvas) return;

    if (peringkatSiswaChartInstance) {
        peringkatSiswaChartInstance.destroy(); // Hapus chart lama
    }

    if (!top5Data || top5Data.length === 0) {
        // Jangan tampilkan pesan error, cukup canvas kosong
        return;
    }

    // 1. Ambil Nama Depan Saja
    const chartLabels = top5Data.map(s => s.nama.split(' ')[0]);
    
    // 2. Buat data palsu untuk "pemanis" (panjang ke pendek untuk 5 data)
    const fakeDataAkademik = [100, 85, 75, 60, 50].slice(0, top5Data.length);
    const fakeDataMental = [95, 80, 70, 55, 45].slice(0, top5Data.length);

    // 3. Buat datasets (Sesuai request warna)
    const datasets = [
        {
            label: 'Akademik',
            data: fakeDataAkademik,
            backgroundColor: 'rgba(255, 0, 0, 0.7)', // Merah (#FF0000)
            borderColor: 'rgb(255, 0, 0)',
            borderWidth: 1,
            borderRadius: 0, // <-- Diubah jadi "kotak"
            borderSkipped: false,
            barPercentage: 0.5, // <-- Dibuat "kecil" (kurus)
            categoryPercentage: 0.7 // Jarak antar grup
        },
        {
            label: 'Mental',
            data: fakeDataMental,
            backgroundColor: 'rgba(13, 0, 255, 0.7)', // Biru (#0D00FF)
            borderColor: 'rgb(13, 0, 255)',
            borderWidth: 1,
            borderRadius: 0, // <-- Diubah jadi "kotak"
            borderSkipped: false,
            barPercentage: 0.5, // <-- Dibuat "kecil" (kurus)
            categoryPercentage: 0.7 // Jarak antar grup
        }
    ];

    // --- PERUBAHAN TEMA "DIGITAL" ---
    const isDarkMode = document.body.classList.contains('theme-dark');
    const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.1)' : 'rgba(209, 213, 219, 0.3)';
    const labelColor = isDarkMode ? '#E5E7EB' : '#374151';
    // --- AKHIR PERUBAHAN TEMA ---

    // 5. Buat chart baru
    peringkatSiswaChartInstance = new Chart(chartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { // Animasi "hidup dan bergerak"
                duration: 1000,
                easing: 'easeInOutCubic',
                delay: (context) => {
                    // Animasi berurutan per bar
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default') {
                        delay = context.dataIndex * 300 + context.datasetIndex * 100;
                    }
                    return delay;
                },
            },
            scales: {
                y: {
                    display: false, // Sembunyikan sumbu Y (Sesuai request)
                    beginAtZero: true,
                    max: 100, // Tetap set max agar data 100 terlihat penuh
                    grid: { 
                        display: true, // Tampilkan grid Y (untuk efek digital)
                        color: gridColor,
                        drawBorder: false
                    }
                },
                x: {
                    grid: { 
                        display: false // Sembunyikan grid X
                    },
                    ticks: {
                        color: labelColor // Warna label nama siswa
                    }
                }
            },
            plugins: {
                legend: {
                    display: true, // Tampilkan legenda (Akademik, Mental)
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        boxWidth: 12,
                        color: labelColor // Warna label legenda
                    }
                },
                tooltip: {
                    // Nonaktifkan tooltip karena nilainya palsu
                    enabled: false 
                }
            },
            interaction: {
                // Nonaktifkan interaksi hover
                mode: 'index',
                intersect: false,
            },
        }
    });
}

//
// ==================================================================
// === FUNGSI BARU UNTUK DONUT CHART (BULAT-BULAT) ===
// ==================================================================
//
/**
 * Helper function untuk membuat satu donut chart
 */
function createDonutChart(canvasId, value, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas dengan ID "${canvasId}" tidak ditemukan.`);
        return; // Hentikan jika canvas tidak ada
    }

    // Hancurkan chart lama jika ada
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Tentukan warna latar belakang berdasarkan tema
    const isDarkMode = document.body.classList.contains('theme-dark');
    const bgColor = isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.7)'; // gray-700/50 atau gray-200/70

    // Pastikan nilai adalah angka valid
    const numericValue = parseFloat(value) || 0;
    
    const data = {
        datasets: [{
            data: [numericValue, 100 - numericValue], // Nilai dan sisa
            backgroundColor: [color, bgColor], // Warna nilai dan warna background
            borderColor: 'rgba(0,0,0,0)', // Transparan
            borderRadius: 5,
            cutout: '75%', // Ukuran lubang tengah
        }]
    };

    new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } // Matikan tooltip
            },
            animation: {
                animateRotate: true,
                animateScale: false,
                duration: 1500
            }
        }
    });
}

/**
 * Merender 3 donut chart untuk nilai pribadi siswa
 */
function renderDonutCharts(siswaData) {
    // Pastikan siswaData ada
    if (!siswaData) {
        console.error("renderDonutCharts dipanggil tanpa data siswa.");
        return;
    }

    // Pastikan nilai adalah angka sebelum toFixed
    const valAkademik = (typeof siswaData.rerataAkademik === 'number' ? siswaData.rerataAkademik : 0).toFixed(0);
    const valMental = (typeof siswaData.rerataKepribadian === 'number' ? siswaData.rerataKepribadian : 0).toFixed(0);
    const valJasmani = (typeof siswaData.rerataJasmani === 'number' ? siswaData.rerataJasmani : 0).toFixed(0);

    // Update Teks Persentase
    const elAkademikVal = document.getElementById('donutAkademikValue');
    const elMentalVal = document.getElementById('donutMentalValue');
    const elJasmaniVal = document.getElementById('donutJasmaniValue');
    
    if (elAkademikVal) elAkademikVal.textContent = `${valAkademik}%`;
    if (elMentalVal) elMentalVal.textContent = `${valMental}%`;
    if (elJasmaniVal) elJasmaniVal.textContent = `${valJasmani}%`;

    // Buat Donut Charts (sesuai request warna)
    createDonutChart('donutAkademik', valAkademik, '#FF0000'); // Merah
    createDonutChart('donutMental', valMental, '#0D00FF');   // Biru

    // Sembunyikan/Tampilkan Jasmani
    const jasmaniContainer = document.getElementById('donutJasmaniContainer');
    if (jasmaniContainer) {
        if (siswaData.kategori === 'Dikbangspes') {
            jasmaniContainer.style.display = 'none';
        } else {
            jasmaniContainer.style.display = 'flex';
            createDonutChart('donutJasmani', valJasmani, '#10B981'); // Hijau (biar beda)
        }
    }
}