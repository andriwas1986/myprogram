// js/modules/panduan.js

export const initPanduanModule = () => {
    // Gunakan event delegation untuk efisiensi
    const panduanContainer = document.getElementById('panduan-container');
    if (!panduanContainer) return;

    // Fungsi untuk mengganti tab
    const switchTab = (targetId) => {
        const navButtons = panduanContainer.querySelectorAll('.panduan-nav-btn');
        const contentDivs = panduanContainer.querySelectorAll('.panduan-content');

        navButtons.forEach(btn => {
            const isActive = btn.dataset.target === targetId;
            btn.classList.toggle('bg-blue-600', isActive);
            btn.classList.toggle('text-white', isActive);
            btn.classList.toggle('bg-tertiary', !isActive); // Atur style non-aktif
        });

        contentDivs.forEach(div => {
            div.classList.toggle('hidden', div.id !== targetId);
        });
    };

    // Tambahkan satu event listener ke container utama
    panduanContainer.addEventListener('click', (event) => {
        // Cari elemen tombol terdekat dari target klik
        const targetButton = event.target.closest('.panduan-nav-btn');
        if (targetButton) {
            switchTab(targetButton.dataset.target);
        }
    });

    // Tampilkan tab pertama saat modul diinisialisasi
    const firstButton = panduanContainer.querySelector('.panduan-nav-btn');
    if (firstButton) {
        // Sedikit penundaan untuk memastikan semua konten sudah dimuat oleh main.js
        setTimeout(() => switchTab(firstButton.dataset.target), 100);
    }
};

