// js/modules/pengumuman.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addAnnouncement, updateAnnouncement, deleteAnnouncement } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localAnnouncements = [];
let currentUser = {};

// --- ELEMEN-ELEMEN DOM (akan diinisialisasi nanti) ---
let pengumumanModal, pengumumanForm, pengumumanTableBody, btnTambahPengumuman, pengumumanDetailModal;

/**
 * Merender tabel manajemen pengumuman.
 */
const renderPengumumanTable = () => {
    if (!pengumumanTableBody) return;
    pengumumanTableBody.innerHTML = '';
    
    // [UPDATE] Definisi Role yang Diizinkan Mengelola (Admin & Gadik)
    const allowedRoles = ['super_admin', 'operator', 'gadik'];
    const canManage = allowedRoles.includes(currentUser.role);

    const sortedAnnouncements = [...localAnnouncements].sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        return dateB - dateA;
    });

    if (sortedAnnouncements.length === 0) {
        pengumumanTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-subtle">Belum ada pengumuman.</td></tr>`;
        return;
    }

    sortedAnnouncements.forEach(item => {
        const statusClass = item.status === 'published' ? 'bg-green-500' : 'bg-yellow-500';
        const statusText = item.status === 'published' ? 'Published' : 'Draft';
        const tanggal = item.createdAt?.toDate() ? item.createdAt.toDate().toLocaleDateString('id-ID') : 'N/A';
        
        // [UPDATE] Render Tombol Aksi hanya jika punya akses
        const actionButtons = canManage ? `
            <button class="text-blue-500 hover:underline btn-edit-pengumuman" data-id="${item.id}">Edit</button>
            <button class="text-red-500 hover:underline ml-4 btn-hapus-pengumuman" data-id="${item.id}">Hapus</button>
        ` : '<span class="text-gray-400 text-xs italic">Read Only</span>';

        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        row.innerHTML = `
            <td class="p-3 font-medium">${item.judul}</td>
            <td class="p-3">${item.penulis || 'Admin'}</td>
            <td class="p-3">${tanggal}</td>
            <td class="p-3"><span class="px-2 py-1 text-xs rounded-full text-white ${statusClass}">${statusText}</span></td>
            <td class="p-3 text-center">
                ${actionButtons}
            </td>
        `;
        pengumumanTableBody.appendChild(row);
    });

    // Hanya pasang listener jika tombol aksi dirender
    if (canManage) {
        setupTableButtons();
    }
};

/**
 * Merender daftar pengumuman di halaman dashboard (Tampilan Ringkas).
 */
const renderDashboardPengumuman = () => {
    // Mencari semua kemungkinan kontainer pengumuman di berbagai jenis dasbor
    const containers = [
        document.getElementById('dashboard-pengumuman-container'),
        document.getElementById('dashboard-pengumuman-container-admin'),
        document.getElementById('dashboard-pengumuman-container-gadik')
    ].filter(el => el != null);

    if (containers.length === 0) return;

    const published = localAnnouncements
        .filter(a => a.status === 'published')
        .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    containers.forEach(container => {
        container.innerHTML = ''; 

        if (published.length === 0) {
            container.innerHTML = '<p class="text-subtle text-sm">Tidak ada pengumuman saat ini.</p>';
            return;
        }

        published.slice(0, 5).forEach(item => {
            const snippet = item.isi.length > 100 ? item.isi.substring(0, 100) + '...' : item.isi;
            const tanggal = item.createdAt?.toDate() ? item.createdAt.toDate().toLocaleDateString('id-ID') : 'N/A';
            
            const itemEl = document.createElement('div');
            itemEl.className = 'border-b border-main pb-3 mb-2 last:border-0';
            itemEl.innerHTML = `
                <h4 class="font-semibold text-main text-sm">${item.judul}</h4>
                <p class="text-xs text-subtle mb-1">Oleh ${item.penulis || 'Admin'} - ${tanggal}</p>
                <p class="text-sm text-subtle line-clamp-2">${snippet}</p>
                <button class="text-blue-500 hover:underline text-xs mt-1 btn-lihat-pengumuman" data-id="${item.id}">Lihat Selengkapnya</button>
            `;
            container.appendChild(itemEl);
        });
        
        container.querySelectorAll('.btn-lihat-pengumuman').forEach(btn => {
            btn.addEventListener('click', e => openPengumumanDetailModal(e.target.dataset.id));
        });
    });
};


/**
 * Membuka modal untuk menambah atau mengedit pengumuman.
 */
const openPengumumanModal = (id = null) => {
    pengumumanForm.reset();
    if (id) {
        const item = localAnnouncements.find(a => a.id === id);
        document.getElementById('pengumuman-modal-title').textContent = 'Edit Pengumuman';
        document.getElementById('pengumuman-id').value = item.id;
        document.getElementById('pengumuman-judul').value = item.judul;
        document.getElementById('pengumuman-isi').value = item.isi;
        document.getElementById('pengumuman-status').value = item.status;
    } else {
        document.getElementById('pengumuman-modal-title').textContent = 'Buat Pengumuman Baru';
        document.getElementById('pengumuman-id').value = '';
    }
    openModal('pengumuman-modal');
};

/**
 * Membuka modal untuk melihat detail pengumuman.
 */
const openPengumumanDetailModal = (id) => {
    const item = localAnnouncements.find(a => a.id === id);
    if (!item) return;

    const tanggal = item.createdAt?.toDate() ? item.createdAt.toDate().toLocaleString('id-ID') : 'N/A';
    document.getElementById('pengumuman-detail-content').innerHTML = `
        <div class="mb-4">
            <span class="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                ${item.penulis || 'Admin'}
            </span>
            <span class="text-xs text-subtle ml-2">${tanggal}</span>
        </div>
        <div class="whitespace-pre-wrap text-main text-sm leading-relaxed">${item.isi}</div>
    `;
    document.getElementById('pengumuman-detail-title').textContent = item.judul;
    openModal('pengumuman-detail-modal');
};

/**
 * Menangani submit form pengumuman.
 */
const handlePengumumanFormSubmit = async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const id = formData.get('pengumuman-id');
    const judul = formData.get('pengumuman-judul');
    const isi = formData.get('pengumuman-isi');
    const status = formData.get('pengumuman-status');

    if (!judul || judul.trim() === '' || !isi || isi.trim() === '') {
        alert('Judul dan Isi tidak boleh kosong!');
        return;
    }

    const data = { 
        judul, 
        isi, 
        status, 
        penulis: currentUser.nama || 'Admin' 
    };

    showLoading('Menyimpan...');
    try {
        if (id) {
            await updateAnnouncement(id, data);
        } else {
            await addAnnouncement(data);
        }
        closeModal('pengumuman-modal');
        // Render ulang akan ditangani oleh listener snapshot di main.js
    } catch(error) {
        console.error("Gagal menyimpan pengumuman:", error);
        alert("Gagal menyimpan pengumuman.");
    } finally {
        hideLoading();
    }
};

/**
 * Menambahkan event listener ke tombol-tombol di tabel.
 */
const setupTableButtons = () => {
    document.querySelectorAll('.btn-edit-pengumuman').forEach(btn => {
        btn.addEventListener('click', (e) => openPengumumanModal(e.target.dataset.id));
    });

    document.querySelectorAll('.btn-hapus-pengumuman').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const item = localAnnouncements.find(a => a.id === id);
            if (confirm(`Yakin ingin menghapus pengumuman "${item.judul}"?`)) {
                showLoading('Menghapus...');
                await deleteAnnouncement(id);
                hideLoading();
            }
        });
    });
};

/**
 * Fungsi inisialisasi untuk modul pengumuman.
 */
export const initPengumumanModule = (announcementsData) => {
    if (!window.pengumumanModuleInitialized) {
        pengumumanModal = document.getElementById('pengumuman-modal');
        pengumumanForm = document.getElementById('pengumuman-form');
        pengumumanTableBody = document.getElementById('pengumuman-table-body');
        btnTambahPengumuman = document.getElementById('btn-tambah-pengumuman');
        pengumumanDetailModal = document.getElementById('pengumuman-detail-modal');

        if (pengumumanForm) {
            pengumumanForm.addEventListener('submit', handlePengumumanFormSubmit);
        }
        if (btnTambahPengumuman) {
            btnTambahPengumuman.addEventListener('click', () => openPengumumanModal());
        }
        window.pengumumanModuleInitialized = true;
    }

    localAnnouncements = announcementsData;
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    // [BARU] Logika Kontrol Tombol Tambah (Hanya Admin & Gadik)
    if (btnTambahPengumuman) {
        const allowedRoles = ['super_admin', 'operator', 'gadik'];
        if (!allowedRoles.includes(currentUser.role)) {
            btnTambahPengumuman.style.display = 'none'; // Sembunyikan untuk siswa/lainnya
        } else {
            btnTambahPengumuman.style.display = ''; // Tampilkan untuk admin/gadik
        }
    }

    renderPengumumanTable();
    renderDashboardPengumuman();
};