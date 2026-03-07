// js/modules/admin.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addAdmin, updateAdmin, deleteAdmin, savePermissions } from '../firestore-service.js';

let localSuperadmins = [];
let localOperators = [];
let localPermissions = {};
let penggunaForm;
let permissionsForm;

const createAdminRow = (admin, role, index) => `
    <tr class="border-b border-main hover:bg-tertiary">
        <td class="p-3">${index + 1}</td>
        <td class="p-3 font-medium">${admin.nama}</td>
        <td class="p-3">${admin.username}</td>
        <td class="p-3 text-center whitespace-nowrap">
            <button class="text-green-500 hover:underline btn-detail-pengguna" data-id="${admin.id}" data-role="${role}">Detail</button>
            <button class="text-blue-500 hover:underline ml-4 btn-edit-pengguna" data-id="${admin.id}" data-role="${role}">Edit</button>
            <button class="text-red-500 hover:underline ml-4 btn-hapus-pengguna" data-id="${admin.id}" data-role="${role}">Hapus</button>
        </td>
    </tr>
`;

const renderAdminTables = () => {
    const superadminTableBody = document.getElementById('superadmin-table-body');
    const operatorTableBody = document.getElementById('operator-table-body');
    if (!superadminTableBody || !operatorTableBody) return;

    superadminTableBody.innerHTML = localSuperadmins.map((admin, index) => createAdminRow(admin, 'super_admin', index)).join('');
    operatorTableBody.innerHTML = localOperators.map((admin, index) => createAdminRow(admin, 'operator', index)).join('');

    setupActionButtons();
};

const renderPermissions = () => {
    if (!permissionsForm) return;
    
    const container = document.getElementById('permissions-container');
    container.innerHTML = ''; // Kosongkan container

    const menuConfig = {
        operator: [
            { id: 'pengumuman', label: 'Pengumuman' },
            { id: 'data_siswa', label: 'Data Siswa' },
            { id: 'data_gadik', label: 'Data Gadik' },
            { id: 'data_danton', label: 'Data Danton/Pengasuh' },
            { id: 'data_mapel', label: 'Data Mapel' },
            { id: 'master_ta', label: 'Master Tahun Ajaran' },
            { id: 'nilai_siswa', label: 'Input Nilai' },
            { id: 'jadwal', label: 'Jadwal Mengajar' },
        ],
        gadik: [
            { id: 'lms', label: 'Akses LMS' },
            { id: 'nilai_siswa', label: 'Input Nilai (Hanya Mapel Sendiri)' },
        ],
        siswa: [
            { id: 'lms', label: 'Akses LMS' },
            { id: 'nilai_siswa', label: 'Lihat Transkrip Nilai' },
        ]
    };

    const actions = ['create', 'read', 'update', 'delete'];
    const actionLabels = { create: 'ADD', read: 'VIEW', update: 'EDIT', delete: 'DELETE' };

    // Buat satu tabel utama di luar loop
    let tableHtml = `
        <div class="bg-tertiary p-4 rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b-2 border-main">
                        <th class="p-2 text-left font-semibold w-1/3 bg-blue-700 text-white">Fitur</th>
                        ${actions.map(a => `<th class="p-2 text-center font-semibold bg-blue-700 text-white">${actionLabels[a]}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    // Loop melalui setiap peran (role)
    Object.keys(menuConfig).forEach(role => {
        // Tambahkan baris sub-header untuk setiap peran
        tableHtml += `
            <tr>
                <th colspan="${actions.length + 1}" class="p-2 text-left text-base font-semibold bg-tertiary text-main">
                    Hak Akses ${role.charAt(0).toUpperCase() + role.slice(1)}
                </th>
            </tr>
        `;
        
        // Loop melalui setiap item menu dalam peran tersebut
        menuConfig[role].forEach(item => {
            tableHtml += `<tr class="border-b border-main bg-card">`;
            tableHtml += `<td class="p-2">${item.label}</td>`;
            actions.forEach(action => {
                const permissionId = `${action}_${item.id}`;
                const isChecked = localPermissions[role]?.[permissionId] !== false;
                const isDisabled = action === 'read' ? 'disabled' : '';
                const isCheckedAttr = (action === 'read' || isChecked) ? 'checked' : '';
                
                tableHtml += `
                    <td class="p-2 text-center">
                        <input type="checkbox" name="${role}" value="${permissionId}" 
                               class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                               ${isCheckedAttr} ${isDisabled}>
                    </td>
                `;
            });
            tableHtml += `</tr>`;
        });
    });

    // Tutup tabel setelah semua loop selesai
    tableHtml += `</tbody></table></div>`;
    
    // Masukkan HTML yang sudah jadi ke dalam container
    container.innerHTML = tableHtml;
};


const openPenggunaDetailModal = (role, adminId) => {
    const adminData = role === 'super_admin' 
        ? localSuperadmins.find(a => a.id === adminId) 
        : localOperators.find(a => a.id === adminId);

    if (!adminData) return;

    document.getElementById('pengguna-detail-title').textContent = `Detail ${role === 'super_admin' ? 'Super Admin' : 'Operator'}`;
    document.getElementById('detail-pengguna-foto').src = adminData.fotoUrl || 'https://placehold.co/150x150/e2e8f0/4a5568?text=Foto';
    document.getElementById('detail-pengguna-nama').textContent = adminData.nama || '-';
    document.getElementById('detail-pengguna-jabatan').textContent = adminData.jabatan || '-';
    document.getElementById('detail-pengguna-username').textContent = adminData.username || '-';
    document.getElementById('detail-pengguna-nip').textContent = adminData.nip || '-';
    
    openModal('pengguna-detail-modal');
};

const openPenggunaModal = (role, adminId = null) => {
    penggunaForm.reset();
    document.getElementById('pengguna-foto-preview').src = 'https://placehold.co/150x150/e2e8f0/4a5568?text=Foto';
    document.getElementById('pengguna-foto').value = '';

    document.getElementById('pengguna-role').value = role;
    document.getElementById('pengguna-id').value = '';

    if (adminId) {
        const adminData = role === 'super_admin' 
            ? localSuperadmins.find(a => a.id === adminId) 
            : localOperators.find(a => a.id === adminId);
        
        document.getElementById('pengguna-modal-title').textContent = `Edit ${role === 'super_admin' ? 'Super Admin' : 'Operator'}`;
        document.getElementById('pengguna-id').value = adminData.id;
        document.getElementById('pengguna-nama').value = adminData.nama;
        // [PERBAIKAN] Menggunakan 'pengguna-email' karena 'pengguna-username' tidak ada di HTML modal
        document.getElementById('pengguna-email').value = adminData.username; 
        document.getElementById('pengguna-jabatan').value = adminData.jabatan || '';
        document.getElementById('pengguna-nip').value = adminData.nip || '';
        if (adminData.fotoUrl) {
            document.getElementById('pengguna-foto-preview').src = adminData.fotoUrl;
        }
        document.getElementById('pengguna-password').placeholder = 'Kosongkan jika tidak diubah';
    } else {
        document.getElementById('pengguna-modal-title').textContent = `Tambah ${role === 'super_admin' ? 'Super Admin' : 'Operator'} Baru`;
        document.getElementById('pengguna-password').placeholder = 'Password wajib diisi';
    }
    openModal('pengguna-modal');
};

const handlePenggunaFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan...');

    const id = document.getElementById('pengguna-id').value;
    const role = document.getElementById('pengguna-role').value;
    const password = document.getElementById('pengguna-password').value;
    let fotoFile = document.getElementById('pengguna-foto').files[0];
    let fotoUrl = document.getElementById('pengguna-foto-preview').src;
    
    try {
        if (fotoFile) {
            const formData = new FormData();
            // Menggunakan kunci 'fotoPengguna' agar diterima oleh upload.php
            formData.append('fotoPengguna', fotoFile);
            // [BARU] Menambahkan subfolder agar tersimpan di /uploads/admin/
            formData.append('subfolder', 'admin'); 

            // [BARU] Menggunakan upload.php universal
            const response = await fetch('upload.php', { method: 'POST', body: formData });
            
            if (!response.ok) {
                throw new Error(`Server Error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            fotoUrl = result.url;
        } else if (fotoUrl.includes('placehold.co')) {
            fotoUrl = '';
        }

        const data = {
            nama: document.getElementById('pengguna-nama').value,
            // [PERBAIKAN] Mengambil username dari input email
            username: document.getElementById('pengguna-email').value,
            jabatan: document.getElementById('pengguna-jabatan').value,
            nip: document.getElementById('pengguna-nip').value,
            fotoUrl,
        };
        
        if (password) data.password = password;
        if (!id && !password) {
            alert('Password wajib diisi untuk pengguna baru.');
            hideLoading();
            return;
        }

        if (id) {
            await updateAdmin(id, role, data);
        } else {
            await addAdmin(role, data);
        }
        closeModal('pengguna-modal');
        alert('Data pengguna berhasil disimpan!');
    } catch (error) {
        console.error("Gagal menyimpan data pengguna:", error);
        alert('Gagal menyimpan data pengguna: ' + error.message);
    } finally {
        hideLoading();
    }
};

const handlePermissionsFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan hak akses...');

    const newPermissions = { siswa: {}, gadik: {}, operator: {} };
    document.querySelectorAll('#permissions-form input[type="checkbox"]').forEach(cb => {
        const role = cb.name;
        const key = cb.value;
        if(newPermissions[role]) {
            if (cb.disabled && cb.checked) {
                 newPermissions[role][key] = true;
            } else if (!cb.disabled) {
                 newPermissions[role][key] = cb.checked;
            }
        }
    });

    try {
        await savePermissions(newPermissions);
        alert('Hak akses berhasil disimpan!');
    } catch (error) {
        console.error("Gagal menyimpan hak akses:", error);
        alert('Gagal menyimpan hak akses.');
    } finally {
        hideLoading();
    }
};

const setupActionButtons = () => {
    document.querySelectorAll('.btn-detail-pengguna').forEach(btn => {
        btn.addEventListener('click', (e) => openPenggunaDetailModal(e.target.dataset.role, e.target.dataset.id));
    });
    document.querySelectorAll('.btn-edit-pengguna').forEach(btn => {
        btn.addEventListener('click', (e) => openPenggunaModal(e.target.dataset.role, e.target.dataset.id));
    });
    document.querySelectorAll('.btn-hapus-pengguna').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const { id, role } = e.target.dataset;
            const user = role === 'super_admin' ? localSuperadmins.find(u => u.id === id) : localOperators.find(u => u.id === id);
            if (confirm(`Yakin ingin menghapus pengguna "${user.nama}"?`)) {
                showLoading('Menghapus...');
                await deleteAdmin(role, id);
                hideLoading();
            }
        });
    });
};

export const setupAdminModuleListeners = () => {
    if (window.adminListenersReady) return;

    penggunaForm = document.getElementById('pengguna-form');
    permissionsForm = document.getElementById('permissions-form');
    
    if (penggunaForm) {
        penggunaForm.addEventListener('submit', handlePenggunaFormSubmit);
        document.getElementById('btn-upload-pengguna-foto').addEventListener('click', () => {
            document.getElementById('pengguna-foto').click();
        });
        document.getElementById('pengguna-foto').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => document.getElementById('pengguna-foto-preview').src = event.target.result;
                reader.readAsDataURL(file);
            }
        });
    }

    if (permissionsForm) permissionsForm.addEventListener('submit', handlePermissionsFormSubmit);

    document.getElementById('btn-tambah-superadmin')?.addEventListener('click', () => openPenggunaModal('super_admin'));
    document.getElementById('btn-tambah-operator')?.addEventListener('click', () => openPenggunaModal('operator'));
    
    window.adminListenersReady = true;
};

export const renderAdminModule = (superadminsData, operatorsData, permissionsData) => {
    if (!document.getElementById('master-admin-section')) return;
    
    localSuperadmins = superadminsData;
    localOperators = operatorsData;
    localPermissions = permissionsData || { siswa: {}, gadik: {}, operator: {} };
    
    renderAdminTables();

    const currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    const hakAksesSection = document.getElementById('hak-akses-section');

    if (hakAksesSection) {
        if (currentUser.role === 'super_admin') {
            hakAksesSection.style.display = 'block';
            renderPermissions(); 
        } else {
            hakAksesSection.style.display = 'none';
        }
    }
};