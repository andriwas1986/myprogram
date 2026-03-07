// public/js/modules/profil.js

import { showLoading, hideLoading } from '../ui.js';
import { updateStudent, updateGadik, updateAdmin, getAcademicScores } from '../firestore-service.js';

let currentUser = {};
let profilForm;
let performanceChartInstance = null;

// --- VARIABEL GLOBAL UNTUK MAPEL GADIK ---
let localMapels = [];
let localTahunAjaran = [];
let selectedMapels = new Map();

// Helper function
const getEl = (id) => document.getElementById(id);
// URL Foto Default
const defaultFotoUrl = 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';

// --- FUNGSI FORMAT TANGGAL ---
const formatDisplayDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return '...'; 
    }
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`; 
};

// --- FUNGSI LOGIKA MAPEL GADIK ---
const renderMapelDropdown = () => {
    const dropdown = getEl('profile-mapel-dropdown');
    const searchInput = getEl('profile-mapel-search-input');
    if (!dropdown || !searchInput) return;
    const searchTerm = searchInput.value.toLowerCase();

    const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
    const activeYears = activeTAs.map(ta => ta.tahun);
    const availableMapels = localMapels.filter(m => activeYears.includes(m.tahunAjaran));

    dropdown.innerHTML = '';
    const filteredMapels = availableMapels.filter(mapel => 
        !selectedMapels.has(mapel.id) &&
        mapel.nama.toLowerCase().includes(searchTerm)
    );

    if (filteredMapels.length === 0) {
        dropdown.innerHTML = `<div class="p-2 text-sm text-subtle text-center">Tidak ada hasil</div>`;
    } else {
        filteredMapels.forEach(mapel => {
            const item = document.createElement('div');
            item.className = 'p-2 text-sm hover:bg-tertiary cursor-pointer'; 
            item.textContent = `${mapel.nama} (${mapel.kategori} - ${mapel.tahunAjaran})`;
            item.dataset.mapel = JSON.stringify({ id: mapel.id, nama: mapel.nama, kategori: mapel.kategori, tahun: mapel.tahunAjaran });
            item.addEventListener('click', () => selectMapel(item.dataset.mapel));
            dropdown.appendChild(item);
        });
    }
};

const selectMapel = (mapelStr) => {
    const mapel = JSON.parse(mapelStr);
    selectedMapels.set(mapel.id, mapel);
    getEl('profile-mapel-search-input').value = '';
    renderSelectedMapels();
    renderMapelDropdown();
};

const removeMapel = (mapelId) => {
    selectedMapels.delete(mapelId);
    renderSelectedMapels();
    renderMapelDropdown();
};

const renderSelectedMapels = () => {
    const pillsContainer = getEl('profile-mapel-pills-container');
    const searchInput = getEl('profile-mapel-search-input');
    if (!pillsContainer || !searchInput) return;

    pillsContainer.querySelectorAll('.mapel-pill').forEach(pill => pill.remove());

    selectedMapels.forEach(mapel => {
        const pill = document.createElement('div');
        pill.className = 'mapel-pill flex items-center bg-blue-600 text-white text-sm rounded-full px-3 py-1'; 
        pill.innerHTML = `
            <span class="mr-2">${mapel.nama}</span>
            <button type="button" class="mapel-pill-remove font-bold" data-id="${mapel.id}">&times;</button>
        `;
        pillsContainer.insertBefore(pill, searchInput);
        pill.querySelector('.mapel-pill-remove').addEventListener('click', (e) => {
            e.stopPropagation(); 
            removeMapel(mapel.id);
        });
    });
};

/**
 * Mengatur mode tampilan (display) atau mode edit
 */
const toggleEditMode = (isEditing) => {
    const role = currentUser.role;

    // [PENTING] JIKA ALUMNI, MATIKAN MODE EDIT
    if (role === 'alumni') {
        isEditing = false; 
        document.querySelectorAll('.edit-foto-btn').forEach(btn => btn.classList.add('hidden'));
        const btnEdit = document.getElementById('btn-edit-profile-siswa');
        if (btnEdit) btnEdit.style.display = 'none';
        return; 
    }

    const views = {
        siswa: ['contact-display-view-siswa', 'biodata-display-view-siswa', 'contact-edit-view-siswa', 'biodata-edit-view-siswa'],
        gadik: [
            'contact-display-view-gadik', 'biodata-display-view-gadik', 'kompetensi-display-view-gadik', 'contact-display-view-gadik-clone', 'kompetensi-display-view-gadik-clone',
            'contact-edit-view-gadik', 'biodata-edit-view-gadik', 'kompetensi-edit-view-gadik', 'contact-edit-view-gadik-clone', 'kompetensi-edit-view-gadik-clone'
        ],
        super_admin: ['biodata-display-view-admin', 'biodata-edit-view-admin'],
        operator: ['biodata-display-view-admin', 'biodata-edit-view-admin'] 
    };

    const buttonRoleSuffix = (role === 'super_admin' || role === 'operator') ? 'admin' : role;

    if (views[role]) {
        views[role].forEach(viewId => {
            const el = getEl(viewId);
            if (el) {
                if (viewId.includes('-edit-')) {
                    el.classList.toggle('hidden', !isEditing);
                } else {
                    el.classList.toggle('hidden', isEditing);
                }
            }
        });
    }
    
    if (role === 'gadik' && isEditing) {
        renderSelectedMapels();
        renderMapelDropdown();
    }

    document.querySelectorAll('.edit-foto-btn').forEach(btn => {
        btn.classList.toggle('hidden', !isEditing);
    });

    const editModeButtons = getEl(`edit-mode-buttons-${buttonRoleSuffix}`);
    const editProfileButton = getEl(`btn-edit-profile-${buttonRoleSuffix}`);

    if (editModeButtons) editModeButtons.classList.toggle('hidden', !isEditing);
    if (editProfileButton) editProfileButton.classList.toggle('hidden', isEditing);
};

export const renderPerformanceChart = async () => {
    const canvas = getEl('performance-chart');
    const profilSection = getEl('profil-section');
    
    // Jangan render jika canvas tidak ada atau section tersembunyi
    if (!canvas || (profilSection && profilSection.classList.contains('hidden'))) {
        if (performanceChartInstance) {
            performanceChartInstance.destroy();
            performanceChartInstance = null;
        }
        return;
    }

    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }
    performanceChartInstance = null;
    
    // [UPDATE] Ambil data user, handle jika ALUMNI
    let user = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    if (user.role === 'alumni' && user.studentData) {
        // Normalisasi data alumni agar bisa dibaca chart
        user = { ...user.studentData, role: 'alumni', id: user.uid };
    }

    if (!user.id || (user.role !== 'siswa' && user.role !== 'alumni')) {
        return; 
    }

    let rerataAkademik = 0;
    try {
        const academicScores = await getAcademicScores(user.id); 
        const academicValues = Object.values(academicScores);
        rerataAkademik = academicValues.length > 0 ? academicValues.reduce((a, b) => a + b, 0) / academicValues.length : 0;
    } catch (e) { console.warn("Tidak dapat mengambil skor akademik:", e); }

    const kepribadianValues = user.nilaiKepribadian || []; 
    const rerataKepribadian = kepribadianValues.length > 0 ? kepribadianValues.reduce((a, b) => a + b, 0) / kepribadianValues.length : 0;
    
    const jasmaniValues = user.nilaiJasmani || []; 
    const rerataJasmani = jasmaniValues.length > 0 ? jasmaniValues.reduce((a, b) => a + b, 0) / jasmaniValues.length : 0;

    performanceChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['Akademik', 'Mental Kepribadian', 'Kesamaptaan Jasmani'],
            datasets: [{
                label: 'Nilai Rata-rata',
                data: [rerataAkademik, rerataKepribadian, rerataJasmani],
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(59, 130, 246)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 100 } },
            plugins: { legend: { display: false } }
        }
    });
};

const populateForm = async () => {
    let rawUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    
    // [CRITICAL UPDATE] Normalisasi Data Alumni
    // Jika role alumni, kita ambil data 'studentData' dan menjadikannya level atas
    if (rawUser.role === 'alumni' && rawUser.studentData) {
        currentUser = {
            ...rawUser.studentData, 
            role: 'alumni',         
            uid: rawUser.uid        
        };
    } else {
        currentUser = rawUser;
    }

    if (!profilForm || !currentUser.role) return;

    const role = currentUser.role;

    // Tampilkan view siswa jika role = siswa ATAU alumni
    getEl('profil-view-siswa').classList.toggle('hidden', role !== 'siswa' && role !== 'alumni');
    getEl('profil-view-gadik').classList.toggle('hidden', role !== 'gadik');
    getEl('profil-view-admin').classList.toggle('hidden', role !== 'super_admin' && role !== 'operator');

    const fotoProfil = (currentUser.fotoUrl && currentUser.fotoUrl.trim() !== '') ? currentUser.fotoUrl : defaultFotoUrl;

    // [PERBAIKAN UTAMA] Tambahkan kondisi OR role === 'alumni'
    if (role === 'siswa' || role === 'alumni') {
        getEl('profile-main-photo').src = fotoProfil;
        getEl('profile-main-name').textContent = currentUser.nama || 'Nama Siswa';
        getEl('profile-main-category').textContent = `${currentUser.kategori || ''} ${currentUser.detailPendidikan || ''} TA ${currentUser.tahunAjaran || ''}`;
        getEl('profile-main-nosis').textContent = currentUser.nosis || '-';
        getEl('profile-main-nrp').textContent = currentUser.nrp || '-';

        getEl('display-email-siswa').textContent = currentUser.email || '-';
        getEl('display-telepon-siswa').textContent = currentUser.telepon || '-';
        
        // Input edit tetap diisi, tapi tombolnya nanti disembunyikan jika alumni
        getEl('edit-email-siswa').value = currentUser.email || '';
        getEl('edit-telepon-siswa').value = currentUser.telepon || '';

        ['facebook', 'instagram', 'tiktok', 'x'].forEach(s => {
            const linkEl = getEl(`display-${s}-siswa`);
            const editEl = getEl(`edit-${s}-siswa`);
            if (linkEl) {
                if (currentUser[s]) {
                    linkEl.href = currentUser[s].startsWith('http') ? currentUser[s] : `https://${currentUser[s]}`;
                    linkEl.classList.remove('text-gray-400', 'pointer-events-none');
                } else {
                    linkEl.href = '#';
                    linkEl.classList.add('text-gray-400', 'pointer-events-none');
                }
            }
            if (editEl) {
                editEl.value = currentUser[s] || '';
            }
        });

        getEl('display-ttl-siswa').textContent = `${currentUser.tempatLahir || '...'}, ${formatDisplayDate(currentUser.tanggalLahir)}`;
        getEl('display-asal-polda-siswa').textContent = currentUser.asalPolda || '-';
        getEl('display-alamat-siswa').textContent = currentUser.alamat || '-';
        
        getEl('edit-tempat-lahir-siswa').value = currentUser.tempatLahir || '';
        getEl('edit-tanggal-lahir-siswa').value = currentUser.tanggalLahir || '';
        getEl('edit-asal-polda-siswa').value = currentUser.asalPolda || '';
        getEl('edit-alamat-siswa').value = currentUser.alamat || '';

        // [UPDATE] Sembunyikan tombol edit JIKA ALUMNI
        if (role === 'alumni') {
            const btnEdit = document.getElementById('btn-edit-profile-siswa');
            if(btnEdit) btnEdit.style.display = 'none';
            // Sembunyikan input foto juga
            const inputFoto = document.getElementById('profil-foto-input-siswa');
            if(inputFoto && inputFoto.parentElement) inputFoto.parentElement.style.display = 'none';
        }

        await renderPerformanceChart();

    } else if (role === 'gadik') {
        getEl('profile-gadik-photo').src = fotoProfil;
        getEl('profile-gadik-name').textContent = currentUser.nama || 'Nama Gadik';
        
        const pangkat = (currentUser.pangkat || 'PANGKAT').toUpperCase();
        const nrp = currentUser.nrp || '00000000';
        getEl('profile-gadik-pangkat-nrp').textContent = `${pangkat} NRP ${nrp}`;

        const jabatan = (currentUser.jabatan || 'JABATAN BELUM DIISI').toUpperCase();
        getEl('profile-gadik-jabatan').textContent = `JABATAN : ${jabatan}`;
        
        getEl('profile-gadik-nrp').textContent = currentUser.nrp || '-';

        selectedMapels.clear(); 
        if (currentUser.mapelDiampu) {
            currentUser.mapelDiampu.forEach(mapel => selectedMapels.set(mapel.id, mapel));
        }

        getEl('display-email-gadik').textContent = currentUser.email || 'Belum diisi';
        getEl('display-telepon-gadik').textContent = currentUser.telepon || 'Belum diisi';
        getEl('edit-email-gadik').value = currentUser.email || '';
        getEl('edit-telepon-gadik').value = currentUser.telepon || '';
        
        ['facebook', 'instagram', 'tiktok', 'x'].forEach(s => {
            const linkEl = getEl(`display-${s}-gadik`);
            const editEl = getEl(`edit-${s}-gadik`);
            if (linkEl) {
                if (currentUser[s]) {
                    linkEl.href = currentUser[s].startsWith('http') ? currentUser[s] : `https://${currentUser[s]}`;
                    linkEl.classList.remove('text-gray-400', 'pointer-events-none');
                } else {
                    linkEl.href = '#';
                    linkEl.classList.add('text-gray-400', 'pointer-events-none');
                }
            }
            if (editEl) {
                editEl.value = currentUser[s] || '';
            }
        });

        getEl('display-ttl-gadik').textContent = `${currentUser.tempatLahir || '...'}, ${formatDisplayDate(currentUser.tanggalLahir)}`;
        getEl('display-alamat-gadik').textContent = currentUser.alamat || 'Belum diisi';
        getEl('edit-tempat-lahir-gadik').value = currentUser.tempatLahir || '';
        getEl('edit-tanggal-lahir-gadik').value = currentUser.tanggalLahir || '';
        getEl('edit-alamat-gadik').value = currentUser.alamat || '';

        getEl('display-pendidikan-terakhir-gadik').textContent = currentUser.pendidikanTerakhir || 'Belum diisi';
        getEl('display-keahlian-gadik').textContent = currentUser.keahlian || 'Belum diisi';
        const mapelContainer = getEl('display-mapel-diampu-gadik');
        mapelContainer.innerHTML = (currentUser.mapelDiampu && currentUser.mapelDiampu.length > 0)
            ? currentUser.mapelDiampu.map(m => `<span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full dark:bg-indigo-900 dark:text-indigo-300">${m.nama} TA ${m.tahun}</span>`).join(' ')
            : '<span class="text-subtle">Tidak ada mapel yang diampu</span>';
        getEl('edit-pendidikan-terakhir-gadik').value = currentUser.pendidikanTerakhir || '';
        getEl('edit-keahlian-gadik').value = currentUser.keahlian || '';

    } else if (role === 'super_admin' || role === 'operator') {
        getEl('profile-admin-photo').src = fotoProfil;
        getEl('profile-admin-name').textContent = currentUser.nama || 'Nama Admin';
        getEl('profile-admin-jabatan').textContent = currentUser.jabatan || 'Jabatan Belum Diisi';

        getEl('display-username-admin').textContent = currentUser.username || '-';
        getEl('display-nip-admin').textContent = currentUser.nip || '-';

        getEl('edit-nama-admin').value = currentUser.nama || '';
        getEl('edit-jabatan-admin').value = currentUser.jabatan || '';
        getEl('edit-username-admin').value = currentUser.username || '';
        getEl('edit-nip-admin').value = currentUser.nip || '';
        getEl('edit-password-admin').value = ''; 
    }

    toggleEditMode(false);
};

const handleProfilFormSubmit = async (e) => {
    e.preventDefault();
    // [UPDATE] Cegah alumni melakukan submit
    if (currentUser.role === 'alumni') {
        alert("Alumni tidak dapat mengubah data.");
        return;
    }

    showLoading('Menyimpan profil...');

    const id = currentUser.id;
    const role = currentUser.role;
    let dataToUpdate = {}, fotoFile, uploadUrl, formFieldName;
    let updateFunction;
    let newFotoUrl = null; 

    if (role === 'siswa') {
        fotoFile = getEl('profil-foto-input-siswa').files[0];
        uploadUrl = 'upload.php';
        formFieldName = 'fotoSiswa';
        dataToUpdate = {
            tempatLahir: getEl('edit-tempat-lahir-siswa').value,
            tanggalLahir: getEl('edit-tanggal-lahir-siswa').value,
            asalPolda: getEl('edit-asal-polda-siswa').value,
            email: getEl('edit-email-siswa').value,
            telepon: getEl('edit-telepon-siswa').value,
            alamat: getEl('edit-alamat-siswa').value,
            facebook: getEl('edit-facebook-siswa').value,
            instagram: getEl('edit-instagram-siswa').value,
            tiktok: getEl('edit-tiktok-siswa').value,
            x: getEl('edit-x-siswa').value,
        };
        updateFunction = updateStudent;

    } else if (role === 'gadik') {
        fotoFile = getEl('profil-foto-input-gadik').files[0];
        uploadUrl = 'upload_gadik.php';
        formFieldName = 'fotoGadik';
        
        dataToUpdate = {
            tempatLahir: getEl('edit-tempat-lahir-gadik').value,
            tanggalLahir: getEl('edit-tanggal-lahir-gadik').value,
            email: getEl('edit-email-gadik').value,
            telepon: getEl('edit-telepon-gadik').value,
            alamat: getEl('edit-alamat-gadik').value,
            pendidikanTerakhir: getEl('edit-pendidikan-terakhir-gadik').value,
            keahlian: getEl('edit-keahlian-gadik').value,
            mapelDiampu: Array.from(selectedMapels.values()),
            tahunAjaran: [...new Set(Array.from(selectedMapels.values()).map(m => m.tahun))],
            
            facebook: getEl('edit-facebook-gadik').value,
            instagram: getEl('edit-instagram-gadik').value,
            tiktok: getEl('edit-tiktok-gadik').value,
            x: getEl('edit-x-gadik').value,
        };
        
        updateFunction = updateGadik;

    } else if (role === 'super_admin' || role === 'operator') {
        fotoFile = getEl('profil-foto-input-admin').files[0];
        uploadUrl = 'upload_admin.php';
        formFieldName = 'fotoPengguna';
        dataToUpdate = {
            nama: getEl('edit-nama-admin').value,
            jabatan: getEl('edit-jabatan-admin').value,
            username: getEl('edit-username-admin').value,
            nip: getEl('edit-nip-admin').value,
        };
        const newPassword = getEl('edit-password-admin').value;
        if (newPassword) {
            dataToUpdate.password = newPassword;
        }
        updateFunction = updateAdmin;
    }

    try {
        if (fotoFile) {
            const formData = new FormData();
            formData.append(formFieldName, fotoFile, fotoFile.name);
            const response = await fetch(uploadUrl, { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            newFotoUrl = result.url;
            dataToUpdate.fotoUrl = newFotoUrl;
        }

        if (role === 'super_admin' || role === 'operator') {
            await updateFunction(id, role, dataToUpdate);
        } else {
            await updateFunction(id, dataToUpdate);
        }

        const updatedUser = { ...currentUser, ...dataToUpdate };
        if (newFotoUrl) {
            updatedUser.fotoUrl = newFotoUrl;
        } else if (!dataToUpdate.hasOwnProperty('fotoUrl') && currentUser.fotoUrl) {
             updatedUser.fotoUrl = currentUser.fotoUrl;
        }

        if (updatedUser.password) delete updatedUser.password;
        sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        currentUser = updatedUser; 

        await populateForm();
        toggleEditMode(false);
        alert('Profil berhasil diperbarui!');

    } catch (error) {
        console.error("Gagal menyimpan profil:", error);
        alert("Gagal menyimpan profil: " + error.message);
    } finally {
        hideLoading();
    }
};

export const initProfilModule = (appData) => { 
    
    localMapels = appData.mapels || [];
    localTahunAjaran = appData.tahunAjaran || [];

    // [PENTING] Panggil populateForm di awal untuk set currentUser
    populateForm(); 

    if (window.profilModuleInitialized) {
        return;
    }

    profilForm = getEl('profil-form');
    if (!profilForm) {
        return; 
    }

    profilForm.addEventListener('submit', handleProfilFormSubmit);

    ['siswa', 'gadik', 'admin'].forEach(roleSuffix => {
        getEl(`btn-edit-profile-${roleSuffix}`)?.addEventListener('click', () => toggleEditMode(true));
        getEl(`btn-cancel-edit-${roleSuffix}`)?.addEventListener('click', () => {
            toggleEditMode(false);
            populateForm(); 
        });

        const fotoInput = getEl(`profil-foto-input-${roleSuffix}`);
        if (fotoInput) {
            fotoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imgId = roleSuffix === 'siswa' ? 'profile-main-photo' : `profile-${roleSuffix}-photo`;
                        const imgElement = getEl(imgId);
                        if (imgElement) imgElement.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });

    const mapelSearchInput = getEl('profile-mapel-search-input');
    const mapelDropdown = getEl('profile-mapel-dropdown');
    const mapelPillsContainer = getEl('profile-mapel-pills-container');

    if(mapelPillsContainer) mapelPillsContainer.addEventListener('click', () => mapelSearchInput?.focus());
    if(mapelSearchInput) mapelSearchInput.addEventListener('focus', () => {
        renderMapelDropdown();
        mapelDropdown?.classList.remove('hidden');
    });
    if(mapelSearchInput) mapelSearchInput.addEventListener('blur', () => setTimeout(() => mapelDropdown?.classList.add('hidden'), 200));
    if(mapelSearchInput) mapelSearchInput.addEventListener('input', renderMapelDropdown);

    window.profilModuleInitialized = true; 
};