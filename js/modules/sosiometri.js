// js/modules/sosiometri.js

import { showLoading, hideLoading } from '../ui.js';
import { updateStudent } from '../firestore-service.js';

let currentUser = {};
let allStudents = [];

const renderSosiometriView = () => {
    const loadingView = document.getElementById('sosiometri-loading');
    const completedView = document.getElementById('sosiometri-completed');
    const noTargetView = document.getElementById('sosiometri-no-target');
    const formWrapper = document.getElementById('sosiometri-form-wrapper');

    if (!loadingView || !completedView || !formWrapper || !noTargetView) {
        console.error("Elemen UI Sosiometri tidak ditemukan!");
        return;
    }

    loadingView.classList.remove('hidden');
    completedView.classList.add('hidden');
    noTargetView.classList.add('hidden');
    formWrapper.classList.add('hidden');

    // [UPDATE] Izinkan akses untuk Dikbangspes DAN DIKBANGUM SEKOLAH BINTARA POLISI
    const allowedCategories = ['Dikbangspes', 'DIKBANGUM SEKOLAH BINTARA POLISI'];
    const isAllowed = currentUser && currentUser.role === 'siswa' && allowedCategories.includes(currentUser.kategori);

    if (!isAllowed) {
        loadingView.classList.add('hidden');
        noTargetView.classList.remove('hidden');
        noTargetView.querySelector('p').textContent = 'Fitur penilaian sosiometri hanya tersedia untuk siswa Dikbangspes dan Dikbangum.';
        return;
    }

    if (currentUser.sosiometriCompleted === true) {
        loadingView.classList.add('hidden');
        completedView.classList.remove('hidden');
        return;
    }

    const peers = allStudents
        .filter(s =>
            s.tahunAjaran === currentUser.tahunAjaran &&
            s.kategori === currentUser.kategori &&
            s.detailPendidikan === currentUser.detailPendidikan &&
            s.role === 'siswa'
        )
        .sort((a, b) => String(a.nosis || '0').localeCompare(String(b.nosis || '0'), undefined, { numeric: true }));

    if (peers.length < 2) {
        loadingView.classList.add('hidden');
        noTargetView.classList.remove('hidden');
        noTargetView.querySelector('p').textContent = 'Jumlah siswa di kelas ini tidak cukup untuk melakukan penilaian sosiometri.';
        return;
    }

    const currentUserIndex = peers.findIndex(s => s.id === currentUser.id);

    if (currentUserIndex === -1) {
        console.error("Sosiometri: User saat ini tidak ditemukan dalam daftar peers.");
        loadingView.classList.add('hidden');
        noTargetView.classList.remove('hidden');
        noTargetView.querySelector('p').textContent = 'Terjadi kesalahan: data Anda tidak ditemukan dalam daftar kelas.';
        return;
    }

    const targetIndex = (currentUserIndex + 1) % peers.length;
    const targetSiswa = peers[targetIndex];

    document.getElementById('target-siswa-foto').src = targetSiswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';
    document.getElementById('target-siswa-nama').textContent = targetSiswa.nama;
    document.getElementById('target-siswa-nosis').textContent = targetSiswa.nosis;
    document.getElementById('target-siswa-pendidikan').textContent = targetSiswa.detailPendidikan || 'Detail Pendidikan Tidak Tersedia';
    document.getElementById('target-siswa-id').value = targetSiswa.id;

    loadingView.classList.add('hidden');
    formWrapper.classList.remove('hidden');
};

const handleSosiometriSubmit = async (e) => {
    e.preventDefault();
    const targetSiswaId = document.getElementById('target-siswa-id').value;
    const nilaiInput = document.getElementById('nilai-sosiometri-input');
    const nilai = parseFloat(nilaiInput.value);

    if (isNaN(nilai) || nilai < 0 || nilai > 100) {
        alert('Masukkan nilai yang valid (angka antara 0.00 dan 100.00).');
        nilaiInput.focus();
        return;
    }

    const nilaiRounded = parseFloat(nilai.toFixed(2));

    const targetSiswa = allStudents.find(s => s.id === targetSiswaId);
    if (!confirm(`Anda akan memberikan nilai ${nilaiRounded} kepada ${targetSiswa?.nama || 'rekan Anda'}. Aksi ini tidak dapat diubah. Lanjutkan?`)) {
        return;
    }

    showLoading('Mengirim penilaian...');

    try {
        await updateStudent(targetSiswaId, { nilaiSosiometri: nilaiRounded });
        console.log(`Sosiometri: Nilai ${nilaiRounded} berhasil disimpan untuk ${targetSiswa?.nama}`);

        await updateStudent(currentUser.id, { sosiometriCompleted: true });
        console.log(`Sosiometri: Status completed berhasil disimpan untuk ${currentUser.nama}`);

        currentUser.sosiometriCompleted = true;
        sessionStorage.setItem('loggedInUser', JSON.stringify(currentUser));

        hideLoading();
        alert('Penilaian berhasil dikirim! Terima kasih.');

        document.getElementById('sosiometri-form-wrapper').classList.add('hidden');
        document.getElementById('sosiometri-completed').classList.remove('hidden');

    } catch (error) {
        console.error("Gagal menyimpan nilai sosiometri:", error);
        hideLoading();
        alert('Terjadi kesalahan saat menyimpan penilaian. Silakan coba lagi.');
    }
};

export const initSosiometriModule = (studentsData) => {
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    allStudents = studentsData || [];

    const sosiometriSection = document.getElementById('sosiometri-section');
    
    // Kita hanya perlu mengecek apakah elemennya ada, 
    // jangan cek apakah elemennya sedang 'hidden'.
    if (!sosiometriSection) {
        return;
    }

    console.log("Menginisialisasi modul Sosiometri...");

    renderSosiometriView();

    const form = document.getElementById('sosiometri-form');
    if(form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleSosiometriSubmit);
    } else {
        console.error("Form Sosiometri tidak ditemukan saat inisialisasi listener.");
    }
};