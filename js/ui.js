// public/js/ui.js

// --- [MODIFIKASI] Variabel global baru untuk menyimpan callback render ---
let sectionRenderCallbacks = {};

// --- ELEMEN UTAMA ---
const mainContent = document.getElementById('main-content');
const loadingOverlay = document.getElementById('loading-overlay');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileOverlay = document.getElementById('mobile-menu-overlay');

let AppState = {};

export const setAppState = (state) => {
    AppState = state;
};

// --- FUNGSI TEMA ---
export const applyTheme = (theme) => {
    document.body.className = theme;
    localStorage.setItem('siakad-theme', theme);
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeIcon) {
        themeIcon.className = theme === 'theme-dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
};

// --- FUNGSI NAVIGASI ---
/**
 * [MODIFIKASI] Menerima parameter callbacks
 */
export const setupNavigation = (chartRenderCallbacks = {}) => {
    // --- [MODIFIKASI] Simpan callbacks ke variabel global ---
    sectionRenderCallbacks = chartRenderCallbacks;
    // --- [AKHIR MODIFIKASI] ---
    
    // --- Submenu Toggles ---
    document.querySelectorAll('[id$="-toggle"]').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const submenu = document.getElementById(toggle.id.replace('-toggle', '-submenu'));
            const arrow = toggle.querySelector('.sidebar-arrow');
            if (submenu) {
                submenu.classList.toggle('hidden');
                if (arrow) arrow.classList.toggle('rotate-180');
            }
        });
    });

    // --- Main Navigation Links ---
    document.querySelectorAll('.nav-item').forEach(item => {
        if (!item.id.endsWith('-toggle')) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = item.dataset.section;

                if (sectionId) {
                    // Tampilkan section yang sesuai
                    showSection(sectionId);

                    // Perbarui status aktif pada navigasi
                    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    // Jika item berada di dalam submenu, pastikan induknya juga ditandai aktif.
                    const parentToggle = item.closest('.submenu')?.previousElementSibling;
                    if (parentToggle) {
                        parentToggle.classList.add('active');
                    }

                    // Untuk tampilan mobile, sembunyikan sidebar setelah item dipilih.
                    if (window.innerWidth < 768 && sidebar && mobileOverlay) {
                        sidebar.classList.add('-translate-x-full');
                        mobileOverlay.classList.add('hidden');
                    }
                }
            });
        }
    });

    // [MODIFIKASI] Tambahkan listener untuk tombol tema (yang tidak ada) dengan aman
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
            applyTheme(currentTheme);
        });
    }
};


export const showSection = (sectionId) => {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.toggle('hidden', section.id !== sectionId);
    });
    sessionStorage.setItem('lastActiveSection', sectionId);
    
    // --- [MODIFIKASI DI SINI] ---
    // Panggil callback render-ulang jika ada untuk section ini
    if (sectionRenderCallbacks[sectionId]) {
        console.log(`UI Debug: Merender ulang grafik untuk section: ${sectionId}`);
        // Panggil setelah jeda singkat agar DOM selesai di-render
        setTimeout(() => {
            sectionRenderCallbacks[sectionId]();
        }, 0);
    }
    // --- [AKHIR MODIFIKASI] ---
};


// --- FUNGSI UTILITAS (MODAL, LOADING, DLL) ---
export const showLoading = (message = 'Memuat...') => {
    const loadingMessage = document.getElementById('loading-text');
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
};

export const hideLoading = () => {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
};

export const showLogin = () => {
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
};

export const showApp = () => {
    if (loginContainer) loginContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
};

export const openModal = (modalId) => {
    console.log(`UI Debug: openModal dipanggil untuk #${modalId}`); // DEBUG LOG
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Tambahkan flex untuk positioning
        setTimeout(() => modal.classList.add('opacity-100'), 10); // Transisi fade-in
    }
};

export const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log(`UI Debug: closeModal dipanggil untuk #${modalId}.`); // DEBUG LOG
        modal.classList.remove('opacity-100'); // Transisi fade-out
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            // Reset embed/iframe src
            const embed = modal.querySelector('embed');
            const iframe = modal.querySelector('iframe');
            if (embed) embed.src = 'about:blank';
            if (iframe) iframe.src = 'about:blank';
        }, 300); // Sesuaikan dengan durasi transisi
    } else {
        console.warn(`UI Warning: closeModal gagal menemukan modal dengan ID #${modalId}`);
    }
};

/**
 * [PERBAIKAN UTAMA] Fungsi untuk menangani penutupan modal secara universal.
 * Mencari atribut data-dismiss="modal".
 */
export const setupModalClosers = () => {
    console.log('UI Debug: setupModalClosers dipanggil dan memasang listener.'); // DEBUG LOG
    
    // Periksa apakah listener sudah terpasang untuk menghindari duplikasi
    if (document.body.getAttribute('data-modal-closers-set') === 'true') {
        return;
    }
    
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. Logika untuk tombol dengan atribut universal data-dismiss="modal"
        const dismissButton = target.closest('[data-dismiss="modal"]');

        if (dismissButton) {
            const modal = dismissButton.closest('.modal');
            if (modal) {
                console.log(`UI Debug: Tombol [data-dismiss="modal"] terdeteksi di modal #${modal.id}. Menutup modal.`); // DEBUG LOG
                closeModal(modal.id); 
                e.preventDefault(); 
                e.stopPropagation(); 
                return; 
            } else {
                console.warn("UI Warning: Tombol dismiss terdeteksi, tapi modal induk dengan class 'modal' tidak ditemukan.");
            }
        }
        
        // 2. Logika Lama/Background (Tombol close (X) dengan class .btn-close-modal ATAU background .modal-background)
        if (target.closest('.btn-close-modal') || target.classList.contains('modal-background')) {
            const modal = target.closest('.modal');
            if (modal) {
                console.log(`UI Debug: Logika lama/background klik terdeteksi di modal #${modal.id}. Menutup modal.`); // DEBUG LOG
                closeModal(modal.id);
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    document.body.setAttribute('data-modal-closers-set', 'true');
};

export const setupSidebarToggle = () => {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            document.getElementById('main-content').classList.toggle('md:ml-64');
            document.getElementById('main-content').classList.toggle('md:ml-20');
        });
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            if (mobileOverlay) mobileOverlay.classList.remove('hidden');
        });
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            mobileOverlay.classList.add('hidden');
        });
    }
};

export const updateWelcomeMessage = () => {
    const welcomeUserSpans = document.querySelectorAll('#dashboard-welcome-user');
    const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (currentUser && welcomeUserSpans.length > 0) {
        welcomeUserSpans.forEach(span => {
            span.textContent = currentUser.nama || 'Pengguna';
        });
    }
    
    // [MODIFIKASI] Add update for student welcome text
    const studentWelcomeEl = document.getElementById('student-dashboard-welcome');
    if (studentWelcomeEl && currentUser && currentUser.role === 'siswa') {
        studentWelcomeEl.textContent = `Selamat Datang, ${currentUser.nama.toUpperCase()}!`;
    }
    
    const adminWelcomeEl = document.getElementById('admin-dashboard-welcome');
    if (adminWelcomeEl) {
         if (currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'operator')) {
             adminWelcomeEl.textContent = `Selamat Datang, ${currentUser.nama}!`;
         }
    }
    
    const gadikWelcomeEl = document.getElementById('gadik-dashboard-welcome');
    if (gadikWelcomeEl) {
         if (currentUser && currentUser.role === 'gadik') {
             gadikWelcomeEl.textContent = `Selamat Datang, ${currentUser.nama}!`;
         }
    }
};

// --- FUNGSI BARU UNTUK FOTO PROFIL DEFAULT ---
/**
 * Memeriksa URL foto dan mengembalikan URL default jika kosong.
 * @param {string | null | undefined} url - URL foto yang akan diperiksa.
 * @returns {string} URL foto yang valid atau URL default.
 */
export const getDefaultAvatar = (url) => {
    const defaultAvatarUrl = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    return url ? url : defaultAvatarUrl;
};

// =========================================================================
// --- [INISIALISASI OTOMATIS] ---
// Memastikan semua setup dijalankan saat DOM siap.
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('UI Debug: DOMContentLoaded, menjalankan setup UI...');
    // Memastikan listener penutup modal terpasang
    setupModalClosers();
    
    // Panggil setup UI lainnya yang ada di file ini
    setupSidebarToggle();
});