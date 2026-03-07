// js/modules/elibrary.js

let API_KEY = '';
let FOLDER_ID = ''; // ID Folder Root E-Library

let breadcrumb = [];
let elibraryContainer, breadcrumbContainer, searchInput;
let searchTimeout = null; // Untuk debounce

// Fungsi untuk mengambil data file dari Google Drive API
// **MODIFIKASI**: Tambahkan parameter searchTerm
const fetchDriveFiles = async (folderId, searchTerm = null) => {
    const loadingEl = document.getElementById('elibrary-loading');

    if (!API_KEY || !FOLDER_ID) {
         if(loadingEl) loadingEl.classList.add('hidden');
         elibraryContainer.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6';
         elibraryContainer.innerHTML = `<div class="col-span-full text-center p-8"><p class="text-red-500">API Key atau Folder ID Google Drive belum diatur di menu Setting.</p></div>`;
        return;
    }

     if(loadingEl) loadingEl.classList.remove('hidden');
     elibraryContainer.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6';
     elibraryContainer.innerHTML = ''; // Kosongkan container

    // --- MODIFIKASI QUERY ---
    let query = '';
    if (searchTerm && searchTerm.trim() !== '') {
        // Jika ada search term, cari secara global berdasarkan nama
        // Kita tambahkan "'FOLDER_ID' in parents" untuk mencoba membatasi pencarian
        // ke dalam struktur folder utama kita, meskipun ini tidak sepenuhnya rekursif.
        // Google mungkin akan mencari di level pertama FOLDER_ID dan mungkin beberapa level di bawahnya.
        // Untuk pencarian global *semua* file yang bisa diakses API Key: hapus "'${FOLDER_ID}' in parents and "
        query = `name contains '${searchTerm.replace(/'/g, "\\'")}' and '${FOLDER_ID}' in parents and trashed=false`;
        // Tampilkan indikator pencarian di breadcrumb
        renderBreadcrumb(true, searchTerm);
    } else {
        // Jika tidak ada search term, tampilkan isi folder saat ini
        query = `'${folderId}' in parents and trashed=false`;
        // Render breadcrumb normal
        renderBreadcrumb();
    }
    // --- AKHIR MODIFIKASI QUERY ---

     const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,iconLink)`;

    try {
         const response = await fetch(url);
        if (!response.ok) {
             const error = await response.json();
             // Menangani error 'invalidParents' yang mungkin muncul saat pencarian global dengan 'in parents'
             if (error?.error?.errors[0]?.reason === 'invalidParentsInTeamDriveQuery') {
                console.warn("Query 'in parents' mungkin tidak optimal untuk pencarian global. Mencoba tanpa 'in parents'...");
                // Coba lagi tanpa 'in parents' untuk pencarian global
                query = `name contains '${searchTerm.replace(/'/g, "\\'")}' and trashed=false`;
                const fallbackUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,iconLink)`;
                const fallbackResponse = await fetch(fallbackUrl);
                 if (!fallbackResponse.ok) {
                    const fallbackError = await fallbackResponse.json();
                    throw new Error(`Google Drive API Error (Fallback): ${fallbackError.error.message}`);
                 }
                 const fallbackData = await fallbackResponse.json();
                 renderFiles(fallbackData.files, true); // Tandai sebagai hasil pencarian
             } else {
                throw new Error(`Google Drive API Error: ${error.error.message}`);
             }
        } else {
             const data = await response.json();
             // Beri tanda jika ini hasil pencarian
             renderFiles(data.files, (searchTerm && searchTerm.trim() !== ''));
        }
    } catch (error) {
         console.error("Gagal mengambil file dari Google Drive:", error);
         elibraryContainer.innerHTML = `<div class="col-span-full text-center p-8"><p class="text-red-500">Gagal memuat file: ${error.message}. Periksa konsol untuk detail.</p></div>`;
    } finally {
         if(loadingEl) loadingEl.classList.add('hidden');
    }
};

// **MODIFIKASI**: Tambahkan parameter isSearchResult
const renderFiles = (files, isSearchResult = false) => {
     elibraryContainer.innerHTML = ''; // Kosongkan sebelum render
    if (!files || files.length === 0) {
         const message = isSearchResult ? "Tidak ada file yang cocok ditemukan." : "Folder ini kosong.";
         elibraryContainer.innerHTML = `<div class="col-span-full text-center p-8"><p class="text-subtle">${message}</p></div>`;
        return;
    }

    // Urutkan: folder dulu, baru file, lalu berdasarkan nama
     files.sort((a, b) => {
        const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
        if (aIsFolder !== bIsFolder) {
            return aIsFolder ? -1 : 1; // Folder duluan
        }
        return a.name.localeCompare(b.name); // Urutkan berdasarkan nama
    });

    // Tidak perlu filter search term lagi di sini karena sudah dilakukan di API
    // const searchTerm = searchInput.value.toLowerCase(); // HAPUS INI

     files
        // .filter(file => file.name.toLowerCase().includes(searchTerm)) // HAPUS INI
        .forEach(file => {
             const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
             const isPdf = file.mimeType === 'application/pdf';

            let iconHtml = '';
            const ebookImageUrl = 'https://ik.imagekit.io/d3nxlzdjsu/e-book-pusdik-polair.jpg?updatedAt=1761136715243';

            if (isFolder || isPdf) {
                 iconHtml = `<img src="${ebookImageUrl}" alt="${isFolder ? 'Folder' : 'E-Book'} Icon" class="w-48 h-auto max-h-64 object-contain mb-3">`;
            } else {
                 iconHtml = `<img src="${file.iconLink}" alt="File Icon" class="w-16 h-16 mb-3">`;
            }

             const itemEl = document.createElement('div');
             itemEl.className = 'bg-tertiary p-4 rounded-lg text-center cursor-pointer hover:bg-gray-600 transition-colors flex flex-col items-center';
             itemEl.innerHTML = `
                ${iconHtml}
                <p class="text-sm font-semibold text-main break-words w-full">${file.name}</p>
            `;

            if (isFolder) {
                 // **MODIFIKASI**: Saat klik folder dari hasil search, clear search
                 itemEl.addEventListener('click', () => {
                     searchInput.value = ''; // Hapus teks pencarian
                     navigateToFolder(file.id, file.name);
                 });
            } else {
                 itemEl.addEventListener('click', () => window.open(file.webViewLink, '_blank'));
            }
             elibraryContainer.appendChild(itemEl);
        });
};

// Fungsi untuk navigasi antar folder
const navigateToFolder = (folderId, folderName) => {
     // **MODIFIKASI**: Pastikan search term kosong saat navigasi folder
     searchInput.value = '';
     breadcrumb.push({ id: folderId, name: folderName });
     renderBreadcrumb();
     fetchDriveFiles(folderId); // Panggil tanpa search term
};

// **MODIFIKASI**: Tambahkan parameter isSearching dan searchTerm
const renderBreadcrumb = (isSearching = false, searchTerm = '') => {
     breadcrumbContainer.innerHTML = '';
     if (isSearching) {
        // Tampilkan status pencarian
         breadcrumbContainer.innerHTML = `<span class="font-semibold text-main">Hasil pencarian untuk: "${searchTerm}"</span>`;
     } else {
        // Render breadcrumb normal
         breadcrumb.forEach((crumb, index) => {
            if (index > 0) {
                 breadcrumbContainer.innerHTML += `<span class="mx-1">/</span>`;
            }
             const crumbEl = document.createElement('button');
             // **MODIFIKASI**: Pastikan tombol terakhir tidak bisa diklik ulang
             crumbEl.className = index === breadcrumb.length - 1 ? 'font-semibold text-main' : 'hover:underline';
             crumbEl.textContent = crumb.name;
             if (index < breadcrumb.length - 1) {
                 crumbEl.onclick = () => {
                     // **MODIFIKASI**: Pastikan search term kosong saat klik breadcrumb
                     searchInput.value = '';
                     breadcrumb = breadcrumb.slice(0, index + 1);
                     renderBreadcrumb();
                     fetchDriveFiles(crumb.id); // Panggil tanpa search term
                };
             }
             breadcrumbContainer.appendChild(crumbEl);
        });
     }
};

// Fungsi inisialisasi modul
export const initELibraryModule = (settings) => {
    if (!elibraryContainer) {
         elibraryContainer = document.getElementById('elibrary-container');
         breadcrumbContainer = document.getElementById('elibrary-breadcrumb');
         searchInput = document.getElementById('elibrary-search');

        if(searchInput) {
             // **MODIFIKASI**: Event listener dengan debounce
             searchInput.addEventListener('input', () => {
                 clearTimeout(searchTimeout); // Hapus timeout sebelumnya
                 searchTimeout = setTimeout(() => {
                     const searchTerm = searchInput.value;
                     if (searchTerm && searchTerm.trim() !== '') {
                         // Lakukan pencarian global jika ada teks
                         fetchDriveFiles(null, searchTerm); // folderId null untuk indikasi pencarian global
                     } else {
                         // Kembali ke tampilan folder jika search kosong
                         const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : FOLDER_ID;
                         fetchDriveFiles(currentFolderId);
                     }
                 }, 500); // Tunggu 500ms setelah user berhenti mengetik
            });
        }
    }

    // Ambil konfigurasi dari settings
    if (settings && settings.elibrary) {
         API_KEY = settings.elibrary.apiKey || '';
         FOLDER_ID = settings.elibrary.folderId || '';
    } else {
         API_KEY = '';
         FOLDER_ID = '';
    }

    // Reset dan mulai dari folder root
     breadcrumb = [{ id: FOLDER_ID, name: 'Home' }];
     renderBreadcrumb();
     fetchDriveFiles(FOLDER_ID); // Panggil tanpa search term awal
};