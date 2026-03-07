// js/auth.js

import { auth } from './firebase-config.js';
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js';
// [UPDATE] Import findAlumniCandidate
import { getCollectionRef, findAlumniCandidate } from './firestore-service.js';

let onLoginSuccess = () => {};
let verificationMethod = 'none';
let verificationSiteKey = '';

// --- KONSTANTA KEAMANAN ---
const MAX_ATTEMPTS = 5; // Maksimal percobaan salah
const LOCKOUT_TIME = 10 * 60 * 1000; // Waktu blokir (10 menit)

// --- HELPER KEAMANAN ---
const checkLockout = () => {
    const lockoutUntil = localStorage.getItem('alumni_lockout_until');
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
        const remainingTime = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 60000);
        return `Sistem terkunci demi keamanan.\nTerlalu banyak percobaan gagal.\nSilakan coba lagi dalam ${remainingTime} menit.`;
    }
    // Jika waktu blokir sudah lewat, reset
    if (lockoutUntil) {
        localStorage.removeItem('alumni_lockout_until');
        localStorage.removeItem('alumni_failed_attempts');
    }
    return null;
};

const recordFailedAttempt = () => {
    let attempts = parseInt(localStorage.getItem('alumni_failed_attempts') || '0');
    attempts++;
    localStorage.setItem('alumni_failed_attempts', attempts);

    if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem('alumni_lockout_until', Date.now() + LOCKOUT_TIME);
        return true; // Terkunci
    }
    return false; // Belum terkunci
};

const generateMathCaptcha = () => {
    const questionEl = document.getElementById('math-question');
    const answerInput = document.getElementById('math-answer');
    
    if (!questionEl || !answerInput) return 0;

    // Angka acak 1-10
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    
    questionEl.textContent = `${num1} + ${num2} = ?`;
    answerInput.value = ''; 
    
    return num1 + num2;
};

export const populateLoginTahunAjaran = (taData) => {
    const select = document.getElementById('login-pendidikan');
    if (!select) return;

    const activeTAs = taData.filter(ta => ta.isActive);
    
    select.innerHTML = '<option value="">Pilih Pendidikan Anda...</option>';
    
    activeTAs.forEach(ta => {
        ta.pendidikan.forEach(p => {
            const optionText = `${p.jenis} ${p.detail || ''} (T.A ${ta.tahun})`;
            const optionValue = `${ta.tahun}|${p.jenis}|${p.detail || ''}`;
            select.innerHTML += `<option value="${optionValue}">${optionText}</option>`;
        });
    });
};

const handleLogin = async (e) => {
    e.preventDefault();
    if (verificationMethod === 'recaptcha' && verificationSiteKey && window.grecaptcha) {
        showLoading('Memverifikasi...');
        grecaptcha.ready(async function() {
            try {
                const token = await grecaptcha.execute(verificationSiteKey, {action: 'login'});
                await processLogin(token); 
            } catch (error) {
                console.error("[AUTH] Gagal mengeksekusi reCAPTCHA:", error);
                alert('Gagal melakukan verifikasi, silakan coba lagi.');
                hideLoading();
            }
        });
    } else if (verificationMethod === 'cloudflare' && verificationSiteKey && window.turnstile) {
        showLoading('Memverifikasi...');
        try {
            const token = window.turnstile.getResponse(document.getElementById('cf-turnstile'));
            if (!token) {
                throw new Error('Verifikasi gagal. Silakan centang kotak verifikasi.');
            }
            await processLogin(token); 
        } catch (error) {
             console.error("[AUTH] Gagal mengeksekusi Cloudflare:", error);
             alert(error.message);
             if (window.turnstile) {
                window.turnstile.reset(document.getElementById('cf-turnstile'));
             }
             hideLoading();
        }
    } else {
        await processLogin(null); 
    }
};

const processLogin = async (verificationToken) => {
    console.log("Token Verifikasi:", verificationToken); 
    
    showLoading('Mencoba login...');
    const role = sessionStorage.getItem('loginRole');
    const rememberMe = document.getElementById('remember-me').checked;
    let userFound = null;
    let username = '';
    let password = '';
    
    let selectedPendidikanContext = null;

    try {
        if (role === 'siswa') {
            const selectedPendidikan = document.getElementById('login-pendidikan').value;
            password = document.getElementById('login-password').value; // nosis
            if (!selectedPendidikan || !password) {
                throw new Error('Silakan pilih pendidikan dan masukkan Nosis Anda.');
            }
            
            const [tahunAjaran, kategori, detail] = selectedPendidikan.split('|');
            const detailPendidikan = detail || ''; 
            
            const q = query(getCollectionRef('students'), 
                where("tahunAjaran", "==", parseInt(tahunAjaran)), 
                where("kategori", "==", kategori), 
                where("detailPendidikan", "==", detailPendidikan),
                where("nosis", "==", password)
            );
            
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                userFound = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id, role: "siswa" };
                selectedPendidikanContext = {
                    tahun: parseInt(tahunAjaran),
                    kategori: kategori,
                    detail: detailPendidikan
                };
            }
        } else if (role === 'gadik') {
            password = document.getElementById('login-password').value; // nrp
            if (!password) {
                throw new Error('Silakan masukkan NRP Anda sebagai password.');
            }
            
            let q = query(getCollectionRef('gadik'), where("nrp", "==", password));
            let querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                userFound = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id, role: 'gadik' };
            } else {
                q = query(getCollectionRef('danton'), where("nrp", "==", password));
                querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    userFound = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id, role: 'danton' };
                }
            }
        } else if (role === 'admin_staff') {
            username = document.getElementById('login-id').value;
            password = document.getElementById('login-password').value;
            let q = query(getCollectionRef('superadmins'), where("username", "==", username));
            let querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                if (userData && userData.password === password) {
                     userFound = { ...userData, id: querySnapshot.docs[0].id, role: 'super_admin' };
                }
            }
            if (!userFound) {
                q = query(getCollectionRef('operators'), where("username", "==", username));
                querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    if (userData && userData.password === password) {
                        userFound = { ...userData, id: querySnapshot.docs[0].id, role: 'operator' };
                    }
                }
            }
        }

        if (userFound) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('loggedInUser', JSON.stringify(userFound));

            if (userFound.role === 'siswa' && selectedPendidikanContext) {
                sessionStorage.setItem('selectedPendidikan', JSON.stringify(selectedPendidikanContext));
            } else {
                sessionStorage.removeItem('selectedPendidikan');
            }

            if (rememberMe) {
                localStorage.setItem('rememberedUser', JSON.stringify({ role, username, password }));
            } else {
                localStorage.removeItem('rememberedUser');
            }

            document.getElementById('loading-text').textContent = `Selamat datang, ${userFound.nama}`;
            setTimeout(() => {
                hideLoading();
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
                onLoginSuccess();
            }, 700);
        } else {
            throw new Error('Login gagal. Periksa kembali data yang Anda masukkan.');
        }
    } catch (error) {
        sessionStorage.clear(); 
        alert(error.message + "\n\nSistem akan dimuat ulang. Silakan coba login kembali.");
        hideLoading();
        setTimeout(() => {
            location.reload();
        }, 500);
    }
};


const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.clear();
        localStorage.removeItem('rememberedUser'); 
        location.reload();
    }
};

export const checkLoginStatus = async () => {
    console.log("🕵️‍♂️ Memeriksa status login...");
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        console.log("✅ Pengguna sudah login dari sesi sebelumnya.");
        const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        if (currentUser) {
            const userNameDisplay = document.getElementById('sidebar-username');
            if(userNameDisplay) {
                userNameDisplay.textContent = `${currentUser.nama} (${currentUser.role})`;
            }
        }
        
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        hideLoading();
        
        await signInAnonymously(auth);
        onLoginSuccess();
    } else {
        console.log("👤 Pengguna belum login.");
        try {
            await signInAnonymously(auth);
            hideLoading(); 
        } catch (error) {
            console.error("Gagal login anonim:", error);
            hideLoading();
        }
    }
};

const fillRememberedUser = () => {
    const rememberedUserJSON = localStorage.getItem('rememberedUser');
    if (rememberedUserJSON) {
        try {
            const rememberedUser = JSON.parse(rememberedUserJSON);
            const role = rememberedUser.role;
            const roleBtn = document.querySelector(`.login-role-btn[data-role='${role}']`);

            if (roleBtn) {
                roleBtn.click();
                
                setTimeout(() => {
                    if (role === 'admin_staff') {
                        document.getElementById('login-id').value = rememberedUser.username || '';
                    }
                    document.getElementById('login-password').value = rememberedUser.password || '';
                    document.getElementById('remember-me').checked = true;
                }, 100);
            }
        } catch (e) {
            console.error("Gagal mem-parsing data 'rememberedUser':", e);
            localStorage.removeItem('rememberedUser');
        }
    }
};


export const setupAuthListeners = (initAppCallback, method, siteKey) => {
    onLoginSuccess = initAppCallback;
    verificationMethod = method;
    verificationSiteKey = siteKey;
    
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    const widgetContainer = document.getElementById('verification-widget-container');
    if (widgetContainer) {
        if (verificationMethod === 'cloudflare' && verificationSiteKey) {
            widgetContainer.innerHTML = `<div id="cf-turnstile" data-sitekey="${verificationSiteKey}"></div>`;
            if (window.turnstile) {
                setTimeout(() => { 
                    try {
                        window.turnstile.render('#cf-turnstile', {
                            sitekey: verificationSiteKey,
                        });
                    } catch (e) {
                        console.error("Gagal me-render widget Cloudflare Turnstile:", e);
                    }
                }, 500);
            }
        } else {
            widgetContainer.innerHTML = '';
        }
    }

    // =======================================================
    // ===       LOGIKA LOGIN ALUMNI (2-STEP SECURE)       ===
    // =======================================================
    const formStep1 = document.getElementById('alumni-step-1');
    const formStep2 = document.getElementById('alumni-step-2');
    let currentCaptchaAnswer = 0;
    let candidateData = null; // Menyimpan data sementara alumni yang ditemukan di Step 1

    if (formStep1 && formStep2) {
        // Cek Status Lockout Saat Load
        const lockMsg = checkLockout();
        if (lockMsg) {
            formStep1.innerHTML = `<div class="p-4 bg-red-900/50 text-red-200 text-center rounded border border-red-500 font-bold text-sm whitespace-pre-line animate-pulse">${lockMsg}</div>`;
        } else {
            currentCaptchaAnswer = generateMathCaptcha();
        }

        // Listener Refresh Captcha
        document.getElementById('refresh-captcha')?.addEventListener('click', () => {
            currentCaptchaAnswer = generateMathCaptcha();
        });

        // Listener Tombol Menu Alumni (Untuk generate soal baru saat dibuka)
        const btnMenuAlumni = document.getElementById('btn-menu-alumni');
        if (btnMenuAlumni) {
            btnMenuAlumni.addEventListener('click', () => {
                // Reset form jika sebelumnya sudah dipakai
                formStep1.classList.remove('hidden');
                formStep2.classList.add('hidden');
                candidateData = null;
                document.getElementById('alumni-nosis').value = '';
                document.getElementById('alumni-nrp').value = '';
                document.getElementById('math-answer').value = '';
                
                // Cek lockout lagi
                const lockMsg = checkLockout();
                if (!lockMsg) {
                    setTimeout(() => currentCaptchaAnswer = generateMathCaptcha(), 100);
                }
            });
        }

        // Listener Tombol Batal di Step 2
        document.getElementById('btn-cancel-step-2')?.addEventListener('click', () => {
            formStep2.classList.add('hidden');
            formStep1.classList.remove('hidden');
            candidateData = null;
            document.getElementById('alumni-phone-auth').value = '';
            currentCaptchaAnswer = generateMathCaptcha();
        });

        // --- HANDLER STEP 1: IDENTIFIKASI ---
        formStep1.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 1. Cek Lockout
            const lockMsg = checkLockout();
            if (lockMsg) { alert(lockMsg); return; }

            const nosis = document.getElementById('alumni-nosis').value.trim();
            const nrp = document.getElementById('alumni-nrp').value.trim();
            const mathAns = parseInt(document.getElementById('math-answer').value);

            // 2. Cek Captcha
            if (isNaN(mathAns) || mathAns !== currentCaptchaAnswer) {
                alert('Jawaban matematika salah! Harap fokus.');
                const isLocked = recordFailedAttempt();
                if (isLocked) {
                    alert("Terlalu banyak percobaan gagal. Akses diblokir sementara.");
                    location.reload();
                } else {
                    currentCaptchaAnswer = generateMathCaptcha(); // Ganti soal
                }
                return;
            }

            showLoading('Mencari Data Alumni...');

            try {
                // 3. Cek Database (Hanya NOSIS & NRP)
                // Pastikan fungsi ini ada di firestore-service.js
                candidateData = await findAlumniCandidate(nosis, nrp);

                if (candidateData) {
                    // Data ditemukan -> Lanjut ke Step 2
                    hideLoading();
                    
                    const nama = candidateData.nama || 'Siswa';
                    // Samarkan nama untuk keamanan (Contoh: Budi Santoso -> B*** S******)
                    // const maskedName = nama.replace(/\b(\w)\w+/g, '$1***'); 
                    
                    document.getElementById('verify-name').textContent = nama;
                    formStep1.classList.add('hidden');
                    formStep2.classList.remove('hidden');
                    
                    // Fokus otomatis ke input telepon
                    setTimeout(() => document.getElementById('alumni-phone-auth').focus(), 100);
                } else {
                    hideLoading();
                    const isLocked = recordFailedAttempt();
                    if (isLocked) {
                        alert("Terlalu banyak percobaan gagal. Akses diblokir sementara.");
                        location.reload();
                    } else {
                        alert('Data tidak ditemukan! Periksa kembali NOSIS dan NRP.');
                        currentCaptchaAnswer = generateMathCaptcha();
                    }
                }
            } catch (error) {
                console.error(error);
                hideLoading();
                alert('Terjadi kesalahan koneksi.');
            }
        });

        // --- HANDLER STEP 2: AUTENTIKASI ---
        formStep2.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 1. Cek Lockout lagi (Safety)
            if (checkLockout()) { alert(checkLockout()); location.reload(); return; }

            const inputPhone = document.getElementById('alumni-phone-auth').value.trim();
            const actualPhone = (candidateData.telepon || '').trim();

            // Normalisasi nomor telepon (Hapus karakter non-digit)
            // Contoh: "081-234" -> "081234"
            const cleanInput = inputPhone.replace(/\D/g, '');
            const cleanActual = actualPhone.replace(/\D/g, '');

            // Validasi Input Kosong
            if (cleanInput.length < 5) {
                alert("Masukkan nomor telepon yang valid.");
                return;
            }

            // 2. Bandingkan Nomor Telepon
            if (cleanInput === cleanActual) {
                // --- SUKSES LOGIN ---
                
                // Reset Security Counter
                localStorage.removeItem('alumni_failed_attempts');
                localStorage.removeItem('alumni_lockout_until');
                
                // Simpan Sesi
                const sessionData = {
                    uid: candidateData.id,
                    email: '-',         
                    role: 'alumni',     
                    nama: candidateData.nama,
                    fotoUrl: candidateData.fotoUrl || 'https://placehold.co/150x150?text=Alumni',
                    studentData: candidateData // Data lengkap untuk dashboard
                };

                sessionStorage.setItem('isLoggedIn', 'true'); 
                sessionStorage.setItem('loggedInUser', JSON.stringify(sessionData));
                
                document.getElementById('loading-text').textContent = `Berhasil Masuk, ${candidateData.nama}`;
                showLoading('Menyiapkan Dashboard...');
                
                setTimeout(() => {
                    hideLoading();
                    document.getElementById('login-container').classList.add('hidden');
                    document.getElementById('app-container').classList.remove('hidden');
                    onLoginSuccess();
                }, 800);

            } else {
                // --- GAGAL LOGIN ---
                const isLocked = recordFailedAttempt();
                
                if (isLocked) {
                    alert("Terlalu banyak percobaan gagal. Akun dikunci sementara demi keamanan.");
                    location.reload();
                } else {
                    alert("Nomor telepon tidak cocok dengan data kami.\nSilakan coba lagi.");
                    document.getElementById('alumni-phone-auth').value = '';
                    document.getElementById('alumni-phone-auth').focus();
                }
            }
        });
    }
    // =======================================================
    // ===             AKHIR LOGIKA ALUMNI                 ===
    // =======================================================

    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('.login-role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = e.target.dataset.role;
            sessionStorage.setItem('loginRole', role);
            
            const usernameInput = document.getElementById('login-id');
            const usernameLabel = document.querySelector('label[for="login-id"]');
            const passwordInput = document.getElementById('login-password');
            const passwordLabel = document.querySelector('label[for="login-password"]');
            const pendidikanWrapper = document.getElementById('pendidikan-wrapper');
            
            usernameInput.parentElement.style.display = 'block';
            pendidikanWrapper.style.display = 'none';

            if (role === 'siswa' || role === 'gadik') {
                usernameInput.required = false; 
                usernameInput.parentElement.style.display = 'none';
                
                if (role === 'siswa') {
                    passwordLabel.textContent = 'Nosis';
                    passwordInput.placeholder = 'Masukkan Nosis Anda';
                    pendidikanWrapper.style.display = 'block';
                } else {
                    passwordLabel.textContent = 'NRP';
                    passwordInput.placeholder = 'Masukkan NRP Anda';
                }
            } else {
                usernameInput.required = true;
                usernameLabel.textContent = 'Username';
                usernameInput.placeholder = 'Masukkan Username';
                passwordLabel.textContent = 'Password';
                passwordInput.placeholder = 'Masukkan password';
            }

            document.getElementById('login-selection').classList.add('hidden');
            document.getElementById('login-form-container').classList.remove('hidden');
        });
    });

    const backButton = document.getElementById('back-to-selection-btn');
    if (backButton) {
        backButton.addEventListener('click', () => {
            document.getElementById('login-selection').classList.remove('hidden');
            document.getElementById('login-form-container').classList.add('hidden');
        });
    }
    
    fillRememberedUser();
};

export const applyPermissions = (role, permissions) => {
    console.log(`[AUTH] Menerapkan hak akses untuk peran: ${role}`);
    const rolePermissions = permissions[role] || {};

    const adminMenu = document.getElementById('nilai-menu-admin');
    const siswaMenu = document.getElementById('nilai-menu-siswa');

    // Default: Semua tampil dulu (kecuali diatur hidden di CSS), nanti kita hide via JS
    
    // --- [KHUSUS ALUMNI: Hide Menu yang tidak diizinkan] ---
    if (role === 'alumni') {
        if (adminMenu) adminMenu.style.display = 'none';
        if (siswaMenu) siswaMenu.style.display = 'flex'; // Tampilkan menu transkrip (mode siswa)

        // Daftar ID section yang BOLEH diakses Alumni
        const allowedSections = ['dashboard-section', 'profil-section', 'transkrip-nilai-section', 'e-album-section'];

        document.querySelectorAll('.nav-item').forEach(el => {
            const sectionId = el.dataset.section;
            // Jika tidak ada dataset section (misal tombol toggle), atau section tidak ada di list allowed
            if (sectionId && !allowedSections.includes(sectionId)) {
                el.style.display = 'none'; // Sembunyikan
            } else {
                el.style.display = ''; // Tampilkan yang boleh
            }
        });
        
        // Sembunyikan tombol toggle yang tidak relevan (Master Data, Sistem, Nilai Admin)
        const togglesToHide = ['master-toggle', 'sistem-toggle', 'nilai-menu-admin'];
        togglesToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        return; // Selesai untuk alumni, tidak perlu logika bawah
    }
    // --- [AKHIR KHUSUS ALUMNI] ---


    if (adminMenu && siswaMenu) {
        if (role === 'siswa') {
            adminMenu.style.display = 'none';
            siswaMenu.style.display = 'flex'; 
        } else {
            adminMenu.style.display = 'block';
            siswaMenu.style.display = 'none';
        }
    }
    
    document.querySelectorAll('[data-permission-id]').forEach(el => {
        if (el.id === 'nilai-menu-admin' || el.id === 'nilai-menu-siswa') return;
        
        const permissionMenuId = el.dataset.permissionId;
        const readPermissionKey = `read_${permissionMenuId}`;
        let canView = rolePermissions[readPermissionKey] !== false;

        const adminOnlyMenus = ['master_admin', 'master_ta', 'setting', 'data_siswa', 'data_gadik', 'data_danton', 'data_mapel'];
        if ((role === 'gadik' || role === 'siswa') && adminOnlyMenus.includes(permissionMenuId)) {
            canView = false;
        } 
		
        const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
        if (permissionMenuId === 'sosiometri') {
            canView = (role === 'siswa' && currentUser.kategori === 'Dikbangspes');
        }
        
        if (permissionMenuId === 'master_admin' && role !== 'super_admin') {
            canView = false;
        }
       
		if (permissionMenuId === 'pelanggaran_siswa') {
            canView = (role === 'siswa' || role === 'operator' || role === 'super_admin' || role === 'gadik' || role === 'danton');
        }
        
        if (permissionMenuId === 'pengumuman' && role === 'siswa') {
            canView = false;
        }
        
        el.style.display = canView ? '' : 'none';
    });
    
    document.querySelectorAll('[data-permission-action]').forEach(el => {
        const permissionAction = el.dataset.permissionAction;
        const canPerform = rolePermissions[permissionAction] !== false;
        el.style.display = canPerform ? '' : 'none';
    });
};