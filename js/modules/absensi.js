// js/modules/absensi.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addAbsence, updateAbsence } from '../firestore-service.js';

let localAppState = {};
let currentUser = {};
let absensiForm;

// Fungsi untuk render tampilan Gadik
const renderGadikView = () => {
    const container = document.getElementById('jadwal-hari-ini-container');
    if (!container) return;

    const today = new Date();
    const namaHariIni = today.toLocaleDateString('id-ID', { weekday: 'long' });
    const tanggalHariIniEl = document.getElementById('absensi-tanggal-hari-ini');
    if(tanggalHariIniEl) tanggalHariIniEl.textContent = today.toLocaleDateString('id-ID', { dateStyle: 'full' });

    // PERBAIKAN DI SINI: Menambahkan pengecekan (localAppState.schedules || [])
    const jadwalHariIni = (localAppState.schedules || []).filter(j => j.gadikId === currentUser.id && j.hari === namaHariIni);

    if (jadwalHariIni.length === 0) {
        container.innerHTML = '<p class="text-subtle text-center p-4">Tidak ada jadwal mengajar hari ini.</p>';
        return;
    }

    container.innerHTML = '';
    jadwalHariIni.sort((a,b) => a.jam.localeCompare(b.jam)).forEach(jadwal => {
        const tglCek = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
        const sudahAbsen = (localAppState.absences || []).find(a => a.jadwalId === jadwal.id && a.tanggal === tglCek);

        let statusHtml = '';
        if (sudahAbsen) {
            const statusClass = sudahAbsen.status === 'Hadir' ? 'bg-green-500' : 'bg-yellow-500';
            statusHtml = `
                <div class="text-right">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full text-white ${statusClass}">${sudahAbsen.status}</span>
                    <button class="text-blue-500 hover:underline text-sm ml-2 btn-edit-absen" data-absen-id="${sudahAbsen.id}">Edit</button>
                </div>
            `;
        } else {
            statusHtml = `<button class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 btn-isi-absen" data-jadwal-id="${jadwal.id}">Isi Absensi</button>`;
        }

        container.innerHTML += `
            <div class="bg-tertiary p-4 rounded-lg flex justify-between items-center">
                <div>
                    <p class="font-bold text-main">${jadwal.mapelNama}</p>
                    <p class="text-sm text-subtle">${jadwal.jam} - Kelas ${jadwal.kelas}</p>
                </div>
                <div>${statusHtml}</div>
            </div>
        `;
    });

    setupGadikButtons();
};

// Fungsi untuk render tampilan Admin
const renderAdminView = async () => {
    const absensiSection = document.getElementById('absensi-section');
    if (!absensiSection) return;
    
    // Cek jika konten sudah ada
    if (!document.getElementById('rekap-absensi-table-body')) {
        const response = await fetch('./components/absensi_admin_content.html');
        absensiSection.innerHTML = await response.text();
    }


    const tableBody = document.getElementById('rekap-absensi-table-body');
    const gadikFilter = document.getElementById('filter-absensi-gadik');
    const tglFilter = document.getElementById('filter-absensi-tanggal');
    
    // Isi filter Gadik
    gadikFilter.innerHTML = '<option value="">Semua Gadik</option>';
    (localAppState.gadik || []).forEach(g => {
        gadikFilter.innerHTML += `<option value="${g.id}">${g.nama}</option>`;
    });

    // Set tanggal hari ini sebagai default
    if(!tglFilter.value) {
        tglFilter.value = new Date().toISOString().split('T')[0];
    }


    const renderTable = () => {
        const tgl = tglFilter.value;
        const gadikId = gadikFilter.value;
        const filteredAbsences = (localAppState.absences || []).filter(a => 
            (tgl ? a.tanggal === tgl : true) &&
            (gadikId ? a.gadikId === gadikId : true)
        );

        tableBody.innerHTML = '';
        if (filteredAbsences.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-subtle">Tidak ada data absensi.</td></tr>`;
            return;
        }

        filteredAbsences.forEach(absen => {
            const gadik = (localAppState.gadik || []).find(g => g.id === absen.gadikId) || {};
            const jadwal = (localAppState.schedules || []).find(j => j.id === absen.jadwalId) || {};
            tableBody.innerHTML += `
                <tr class="border-b border-main hover:bg-tertiary">
                    <td class="p-3">${new Date(absen.tanggal).toLocaleDateString('id-ID')}</td>
                    <td class="p-3">${jadwal.jam || '-'}</td>
                    <td class="p-3 font-medium">${gadik.nama || '-'}</td>
                    <td class="p-3">${jadwal.mapelNama || '-'}</td>
                    <td class="p-3">${absen.status}</td>
                    <td class="p-3">${absen.keterangan || '-'}</td>
                </tr>
            `;
        });
    };

    tglFilter.addEventListener('change', renderTable);
    gadikFilter.addEventListener('change', renderTable);
    renderTable();
};

const openAbsensiModal = (jadwalId, absenId = null) => {
    if (!absensiForm) absensiForm = document.getElementById('absensi-form');
    absensiForm.reset();
    document.getElementById('absensi-jadwal-id').value = jadwalId;
    document.getElementById('absensi-id').value = absenId || '';
    
    const jadwal = (localAppState.schedules || []).find(j => j.id === jadwalId);
    document.getElementById('absensi-modal-jadwal-info').textContent = `${jadwal.mapelNama} (${jadwal.jam})`;

    if (absenId) {
        const absen = (localAppState.absences || []).find(a => a.id === absenId);
        document.getElementById('absensi-status').value = absen.status;
        document.getElementById('absensi-keterangan').value = absen.keterangan;
    }

    openModal('absensi-modal');
};

const handleAbsensiFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan...');

    const absenId = document.getElementById('absensi-id').value;
    const jadwalId = document.getElementById('absensi-jadwal-id').value;

    const data = {
        jadwalId,
        gadikId: currentUser.id,
        tanggal: new Date().toISOString().split('T')[0],
        status: document.getElementById('absensi-status').value,
        keterangan: document.getElementById('absensi-keterangan').value,
    };

    try {
        if (absenId) {
            await updateAbsence(absenId, data);
        } else {
            await addAbsence(data);
        }
        closeModal('absensi-modal');
    } catch (error) {
        console.error("Gagal menyimpan absensi:", error);
        alert('Gagal menyimpan absensi.');
    } finally {
        hideLoading();
    }
};

const setupGadikButtons = () => {
    document.querySelectorAll('.btn-isi-absen').forEach(btn => {
        btn.addEventListener('click', (e) => openAbsensiModal(e.target.dataset.jadwalId));
    });
    document.querySelectorAll('.btn-edit-absen').forEach(btn => {
        const absen = (localAppState.absences || []).find(a => a.id === btn.dataset.absenId);
        btn.addEventListener('click', () => openAbsensiModal(absen.jadwalId, absen.id));
    });
};

export const initAbsensiModule = (appState) => {
    localAppState = appState;
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    
    if (!absensiForm) {
        absensiForm = document.getElementById('absensi-form');
        if (absensiForm) {
            absensiForm.addEventListener('submit', handleAbsensiFormSubmit);
        }
    }

    if (currentUser.role === 'gadik') {
        renderGadikView();
    } else if (currentUser.role === 'super_admin' || currentUser.role === 'operator') {
        renderAdminView();
    } else {
        const absensiSection = document.getElementById('absensi-section');
        if(absensiSection) absensiSection.innerHTML = '<p class="text-center p-8 text-subtle">Menu ini hanya untuk Gadik dan Admin.</p>';
    }
};