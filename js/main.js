// js/main.js

import { checkLoginStatus, setupAuthListeners, populateLoginTahunAjaran, applyPermissions } from './auth.js';
import { applyTheme, setupNavigation, setupSidebarToggle, setupModalClosers, showSection, updateWelcomeMessage, openModal, setAppState, showApp, showLogin } from './ui.js'; 
import { initPresenceSystem, subscribeToPresence } from './presence.js';
import {
    getTahunAjaranForLogin,
    getSettings,
    subscribeToTahunAjaran, subscribeToStudents, subscribeToMapels, subscribeToGadik,
    subscribeToAnnouncements, subscribeToSuperadmins, subscribeToOperators,
    subscribeToPermissions, subscribeToMaterials,
    subscribeToAssignments, subscribeToForumTopics, subscribeToSettings, subscribeToAbsences,
    subscribeToQuizzes, subscribeToDanton, subscribeToSchedulePdfs, subscribeToSchedules,
    subscribeToPelanggaran
} from './firestore-service.js';

// Impor semua modul
import { initDashboardModule, reRenderDashboardCharts } from './modules/dashboard.js';
import { initSiswaModule, openSiswaDetailModalFromData } from './modules/siswa.js';
import { initKartuSiswaModule } from './modules/kartu_siswa.js';
import { initIdLemariModule } from './modules/id_lemari.js'; 
import { initGadikModule } from './modules/gadik.js';
import { initDantonModule } from './modules/danton.js';
import { initMapelModule } from './modules/mapel.js';
import { initTAModule } from './modules/ta.js';
import { initPengumumanModule } from './modules/pengumuman.js';
import { initNilaiModule } from './modules/nilai.js';
import { initPetikanModule } from './modules/petikan.js'; 
import { initTranskripModule } from './modules/transkrip.js';
import { initPreviewSiswaTranskripModule } from './modules/preview_siswa_transkrip.js';
import { setupAdminModuleListeners, renderAdminModule } from './modules/admin.js';
import { initPanduanModule } from './modules/panduan.js';
import { initJadwalModule } from './modules/jadwal.js';
// [BARU] Import module Nominatif
import { initNominatifModule } from './modules/nominatif.js';
import { initLmsModule } from './modules/lms.js';
import { initSettingsModule } from './modules/settings.js';
import { initPetikanSettingsModule } from './modules/settings_petikan.js'; 
import { initELibraryModule } from './modules/elibrary.js';
import { initAbsensiModule } from './modules/absensi.js';
import { initProfilModule, renderPerformanceChart } from './modules/profil.js';
import { initPelanggaranSiswaModule } from './modules/pelanggaran_siswa.js';
import { initSosiometriModule } from './modules/sosiometri.js';
import { initEAlbumModule } from './modules/e_album.js';


// State utama aplikasi untuk menampung semua data
const AppState = {
    tahunAjaran: [], students: [], mapels: [], gadik: [], danton: [], announcements: [], superadmins: [],
    operators: [], permissions: {}, materials: [], assignments: [],
    forumTopics: [], onlineUsers: {}, settings: {}, absences: [], quizzes: [], schedulePdfs: [],
    schedules: [], pelanggaranSiswa: []
};

// Fungsi untuk memuat komponen HTML dasbor yang sesuai dengan peran pengguna
const loadDashboardComponent = async (role) => {
    let dashboardPath;
    if (role === 'siswa') {
        dashboardPath = './components/dashboard_siswa.html';
    } else if (role === 'alumni') { 
        dashboardPath = './components/dashboard_siswa.html'; 
    } else if (role === 'gadik') {
        dashboardPath = './components/dashboard_gadik.html';
    } else if (role === 'super_admin' || role === 'operator') {
        dashboardPath = './components/dashboard_admin.html';
    } else { // Fallback
        dashboardPath = './components/dashboard_admin.html';
    }

    try {
        const response = await fetch(dashboardPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        const container = document.getElementById('dashboard-section');
        if (container) container.innerHTML = html;
        console.log(`✅ Dashboard untuk peran '${role}' berhasil dimuat.`);
    } catch (error) {
        console.error(`🔴 Gagal memuat komponen dashboard: ${dashboardPath}`, error);
    }
};

// Fungsi untuk memuat komponen sisanya SETELAH login
const loadAppComponents = async () => {
    console.log('🚀 Memuat komponen aplikasi...');
    const components = [
        { container: 'siswa-section', path: './components/siswa_content.html' },
        { container: 'pelanggaran-siswa-section', path: './components/pelanggaran_siswa_content.html' },
        { container: 'kartu-siswa-section', path: './components/kartu_siswa_content.html' },
        { container: 'id-lemari-section', path: './components/id_lemari_content.html' }, 
        { container: 'gadik-section', path: './components/gadik_content.html' },
        { container: 'danton-section', path: './components/danton_content.html' },
        { container: 'mapel-section', path: './components/mapel_content.html' },
        { container: 'master-ta-section', path: './components/master_ta_content.html' },
        { container: 'master-admin-section', path: './components/master_admin_content.html' },
        { container: 'pengumuman-section', path: './components/pengumuman_content.html' },
        { container: 'nilai-akademik-section', path: './components/nilai_akademik_content.html' },
        { container: 'nilai-kepribadian-section', path: './components/nilai_kepribadian_content.html' },
        { container: 'nilai-jasmani-section', path: './components/nilai_jasmani_content.html' },
        { container: 'transkrip-nilai-section', path: './components/transkrip_nilai_content.html' },
        { container: 'petikan-section', path: './components/petikan_content.html' },
        // [BARU] Load Content Nominatif
        { container: 'nominatif-section', path: './components/nominatif_content.html' },
        
        { container: 'lms-section', path: './components/lms_content.html' },
        { container: 'setting-section', path: './components/settings_content.html' },
        { container: 'elibrary-section', path: './components/elibrary_content.html' },
        { container: 'absensi-section', path: './components/absensi_gadik_content.html' },
        { container: 'jadwal-mengajar-section', path: './components/jadwal_content.html' },
        { container: 'panduan-container', path: './components/panduan_content.html' },
        { container: 'profil-section', path: './components/profil_content.html' },
        { container: 'sosiometri-section', path: './components/sosiometri_content.html' },
        { container: 'e-album-section', path: './components/e_album_content.html' },
        
        // Modals
        { container: 'siswa-detail-modal-container', path: './components/modal_siswa_detail.html' },
        { container: 'gadik-modal-container', path: './components/modal_gadik.html' },
        { container: 'gadik-detail-modal-container', path: './components/modal_gadik_detail.html' },
        { container: 'danton-modal-container', path: './components/modal_danton.html' },
        { container: 'danton-detail-modal-container', path: './components/modal_danton_detail.html' },
        { container: 'ta-modal-container', path: './components/modal_ta.html' },
        { container: 'ta-detail-modal-container', path: './components/modal_ta_detail.html' },
        { container: 'mapel-modal-container', path: './components/modal_mapel.html' },
        { container: 'pengguna-modal-container', path: './components/modal_pengguna.html' },
        { container: 'pengguna-detail-modal-container', path: './components/modal_pengguna_detail.html' },
        { container: 'pengumuman-modal-container', path: './components/modal_pengumuman.html' },
        { container: 'pengumuman-detail-modal-container', path: './components/modal_pengumuman_detail.html' },
        { container: 'input-nilai-modal-container', path: './components/modal_input_nilai.html' },
        { container: 'nilai-akademik-detail-modal-container', path: './components/modal_nilai_akademik_detail.html' },
        { container: 'kepribadian-modal-container', path: './components/modal_kepribadian.html' },
        { container: 'jasmani-modal-container', path: './components/modal_jasmani.html' },
        { container: 'transkrip-detail-modal-container', path: './components/modal_transkrip_detail.html' },
        { container: 'transkrip-edit-modal-container', path: './components/modal_transkrip_edit.html' },
        
        { container: 'petikan-settings-modal-container', path: './components/modal_petikan_settings.html' },
        
        { container: 'jadwal-pdf-viewer-modal-container', path: './components/modal_jadwal_pdf_viewer.html' },
        { container: 'lms-upload-modal-container', path: './components/modal_lms_upload.html' },
        { container: 'lms-tugas-modal-container', path: './components/modal_lms_tugas.html' },
        { container: 'lms-forum-modal-container', path: './components/modal_lms_forum.html' },
        { container: 'lms-enroll-modal-container', path: './components/modal_lms_enroll.html' },
        { container: 'absensi-modal-container', path: './components/modal_absensi.html' },
        { container: 'pelanggaran-siswa-modal-container', path: './components/modal_pelanggaran_siswa.html' },
        { container: 'siswa-diktuk-modal-container', path: './components/modal_siswa_diktuk.html' },
        { container: 'siswa-dikbangspes-modal-container', path: './components/modal_siswa_dikbangspes.html' }
    ];

    // Muat komponen secara paralel
    await Promise.all(components.map(async (component) => {
        try {
            const response = await fetch(component.path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            const container = document.getElementById(component.container);
            if (container) container.innerHTML = html;
        } catch (error) {
            console.error(`🔴 Gagal memuat komponen: ${component.path}`, error);
        }
    }));
};

// Fungsi yang dipanggil setiap kali ada pembaruan data dari Firestore
function updateAllModules() {
    setAppState(AppState); 
    const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    
    // Inisialisasi atau perbarui semua modul dengan data terbaru dari AppState
    initDashboardModule(currentUser, AppState);
    initTAModule(AppState.tahunAjaran, AppState.students, AppState.mapels);
    initSiswaModule(AppState.students, AppState.tahunAjaran);
    initPelanggaranSiswaModule(AppState);
    initKartuSiswaModule(AppState);
    initIdLemariModule(AppState.students, AppState.tahunAjaran); 
    initMapelModule(AppState.mapels, AppState.tahunAjaran, AppState.students);
    initGadikModule(AppState.gadik, AppState.mapels, AppState.tahunAjaran);
    initDantonModule(AppState.danton, AppState.tahunAjaran, AppState.gadik);
    initNilaiModule(AppState.students, AppState.mapels, AppState.tahunAjaran);
    
    if (currentUser.role === 'siswa' || currentUser.role === 'alumni') {
        initPreviewSiswaTranskripModule(AppState.students, AppState.mapels, AppState.tahunAjaran, AppState.settings);
    } else {
        initTranskripModule(AppState.students, AppState.mapels, AppState.tahunAjaran, AppState.settings);
        initPetikanModule(AppState.tahunAjaran, AppState.students, AppState.settings, AppState.mapels);
        
        // [BARU] Inisialisasi Module Nominatif hanya untuk admin/staf
        initNominatifModule(AppState.tahunAjaran, AppState.students, AppState.settings, AppState.mapels);
    }
    
    initJadwalModule(AppState.tahunAjaran, AppState.schedulePdfs);
    initLmsModule(AppState.mapels, AppState.materials, AppState.assignments, AppState.forumTopics, AppState.quizzes, AppState.gadik, AppState.tahunAjaran, AppState.students, AppState.onlineUsers);
    
    initSettingsModule(AppState.settings, AppState.students, AppState.mapels);
    initPetikanSettingsModule(AppState.settings);

    initELibraryModule(AppState.settings);
    initAbsensiModule(AppState);
    initPengumumanModule(AppState.announcements);
    initSosiometriModule(AppState.students);
    initProfilModule(AppState);
    initEAlbumModule(AppState, openSiswaDetailModalFromData);
    renderAdminModule(AppState.superadmins, AppState.operators, AppState.permissions);
    updateWelcomeMessage();
}

// Fungsi utama yang dijalankan setelah login berhasil
const initializeApp = async () => {
    showApp();
    await loadAppComponents(); // Muat semua HTML aplikasi

    const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (currentUser) {
        initPresenceSystem(currentUser);
        await loadDashboardComponent(currentUser.role);
    }

    // Setup UI dasar
    applyTheme(localStorage.getItem('siakad-theme') || 'theme-light');
    
    setupNavigation({
        'dashboard-section': reRenderDashboardCharts,
        'profil-section': renderPerformanceChart
    });
    
    setupSidebarToggle();
    setupModalClosers();
    setupAdminModuleListeners();
    initPanduanModule();
    
    // Mulai langganan (subscribe) ke semua data dari Firestore
    subscribeToTahunAjaran((data) => { AppState.tahunAjaran = data; updateAllModules(); });
    subscribeToStudents((data) => { AppState.students = data; updateAllModules(); });
    subscribeToMapels((data) => { AppState.mapels = data; updateAllModules(); });
    subscribeToGadik((data) => { AppState.gadik = data; updateAllModules(); });
    subscribeToDanton((data) => { AppState.danton = data; updateAllModules(); });
    subscribeToSchedulePdfs((data) => { AppState.schedulePdfs = data; updateAllModules(); });
    subscribeToMaterials((data) => { AppState.materials = data; updateAllModules(); });
    subscribeToAssignments((data) => { AppState.assignments = data; updateAllModules(); });
    subscribeToForumTopics((data) => { AppState.forumTopics = data; updateAllModules(); });
    subscribeToQuizzes((data) => { AppState.quizzes = data; updateAllModules(); });
    subscribeToAbsences((data) => { AppState.absences = data; updateAllModules(); });
    subscribeToPelanggaran((data) => { AppState.pelanggaranSiswa = data; updateAllModules(); });
    subscribeToAnnouncements((data) => { AppState.announcements = data; updateAllModules(); });
    subscribeToSuperadmins((data) => { AppState.superadmins = data; updateAllModules(); });
    subscribeToOperators((data) => { AppState.operators = data; updateAllModules(); });
    subscribeToSchedules((data) => { AppState.schedules = data; updateAllModules(); });
    subscribeToPermissions((data) => {
        AppState.permissions = data;
        if (currentUser) applyPermissions(currentUser.role, AppState.permissions);
        updateAllModules();
    });
    subscribeToSettings((data) => {
        AppState.settings = data;
        updateAllModules(); 
    });
    subscribeToPresence((onlineUsers) => {
        AppState.onlineUsers = onlineUsers;
        updateAllModules();
    });

    // Menampilkan section terakhir yang dibuka atau default ke dashboard
    const lastSection = sessionStorage.getItem('lastActiveSection');
    if (lastSection) {
        showSection(lastSection);
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const activeNavItem = document.querySelector(`.nav-item[data-section="${lastSection}"]`);
        if(activeNavItem) {
            activeNavItem.classList.add('active');
            const parentToggle = activeNavItem.closest('.submenu')?.previousElementSibling;
            if (parentToggle) {
                parentToggle.classList.add('active');
            }
        }
    } else {
        showSection('dashboard-section');
    }
};

// Fungsi untuk menyuntikkan script reCAPTCHA jika ada site key
function injectRecaptchaScript(siteKey) {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Fungsi untuk menyuntikkan script Cloudflare Turnstile
function injectCloudflareScript() {
    if (document.querySelector('script[src*="challenges.cloudflare.com"]')) {
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Event listeners untuk Mobile Header
const logoMobileLink = document.getElementById('logo-mobile-link');
if (logoMobileLink) {
    logoMobileLink.addEventListener('click', (e) => {
        e.preventDefault();
        const dashboardButton = document.querySelector('a[data-section="dashboard-section"]');
        if (dashboardButton) {
            dashboardButton.click();
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('translate-x-0')) {
             document.getElementById('hamburger-btn').click();
        }
    });
}
const bellMobileBtn = document.getElementById('mobile-bell-btn');
if (bellMobileBtn) {
    bellMobileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const pengumumanButton = document.querySelector('a[data-section="pengumuman-section"]');
        if (pengumumanButton) {
            pengumumanButton.click();
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('translate-x-0')) {
             document.getElementById('hamburger-btn').click();
        }
    });
}

// Event listener yang dijalankan saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', async () => {
    const settings = await getSettings();

    let activeVerificationMethod = 'none';
    let activeSiteKey = '';

    if (settings.verification) {
        activeVerificationMethod = settings.verification.method || 'none';
        
        if (activeVerificationMethod === 'recaptcha') {
            activeSiteKey = settings.verification.recaptcha ? settings.verification.recaptcha.siteKey : '';
            if (activeSiteKey) {
                console.log("Mengaktifkan Google reCAPTCHA...");
                injectRecaptchaScript(activeSiteKey);
            }
        } else if (activeVerificationMethod === 'cloudflare') {
            activeSiteKey = settings.verification.cloudflare ? settings.verification.cloudflare.siteKey : '';
            if (activeSiteKey) {
                console.log("Mengaktifkan Cloudflare Turnstile...");
                injectCloudflareScript(); 
            }
        }
    }
    
    if (activeVerificationMethod === 'none') {
        console.log("Verifikasi login dinonaktifkan.");
    }
    
    const taForLogin = await getTahunAjaranForLogin();
    populateLoginTahunAjaran(taForLogin);
    
    setupAuthListeners(initializeApp, activeVerificationMethod, activeSiteKey); 
    checkLoginStatus();
});