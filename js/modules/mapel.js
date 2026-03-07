// js/modules/mapel.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { addMapel, updateMapel, deleteMapel, updateMapelLmsStatus, updateEnrolledStudents } from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localMapels = [];
let localTahunAjaran = [];
let localStudents = [];
let selectedMapelFilters = {};

// --- STATE UNTUK PAGINATION ---
let mapelCurrentPage = 1;
const MAPEL_ROWS_PER_PAGE = 10;

// --- ELEMEN-ELEMEN DOM ---
let mapelModal, mapelForm, mapelListTableBody, searchMapelInput, btnTambahMapel;
let lmsEnrollModal, currentEnrollMapelId, tempEnrolledIds;
let mainMapView, mapelListView, backButtonMapel, mapelViewTitle;

const renderMapelMainView = () => {
    const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
    const allActivePendidikan = activeTAs.flatMap(ta => ta.pendidikan.map(p => ({ ...p, tahun: ta.tahun })));

    const renderCategoryTable = (kategori, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        
        // Filter dan urutkan
        const pendidikanGroups = allActivePendidikan.filter(p => p.jenis === kategori).sort((a,b) => b.tahun - a.tahun);
        
        tableBody.innerHTML = '';
        if (pendidikanGroups.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-3 text-subtle text-xs">Tidak ada data aktif.</td></tr>`;
            return;
        }

        pendidikanGroups.forEach((p, index) => {
             // Hitung jumlah mapel
            const count = localMapels.filter(m => 
                m.kategori === p.jenis && 
                m.detailPendidikan === p.detail && 
                m.tahunAjaran === p.tahun
            ).length;

            // [UPDATE] Logic tampilan nama
            // Jika detailnya "-" atau kosong, gunakan Nama Jenis Pendidikan.
            // Jika ada detail (misal Gelombang I), gunakan detailnya.
            let displayName = p.detail;
            if (p.detail === '-' || !p.detail) {
                displayName = p.jenis;
            }

            const row = document.createElement('tr');
            row.className = 'border-b border-main hover:bg-tertiary';
            
            row.innerHTML = `
                <td class="p-3 text-center w-12">${index + 1}</td>
                <td class="p-3">
                    <div class="font-medium text-main text-sm uppercase">${displayName}</div>
                    <div class="text-xs text-subtle">TA ${p.tahun} • ${count} Mapel</div>
                </td>
                <td class="p-3 text-center">
                    <button class="bg-blue-600 text-white text-xs py-1 px-3 rounded hover:bg-blue-700 btn-view-mapel-group" 
                        data-kategori="${p.jenis}" 
                        data-detail="${p.detail}" 
                        data-tahun="${p.tahun}">
                        Lihat
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    renderCategoryTable('Diktuk Tamtama', 'mapel-diktuk-tamtama-table-body');
    renderCategoryTable('Diktuk Bintara', 'mapel-diktuk-bintara-table-body');
    renderCategoryTable('Dikbangspes', 'mapel-dikbangspes-table-body');
    // [UPDATE] Panggil dengan Nama Baru dan ID Baru
    renderCategoryTable('DIKBANGUM SEKOLAH BINTARA POLISI', 'mapel-dikbangum-sekolah-bintara-polisi-table-body');
};

// --- FUNGSI PAGINATION ---
const renderMapelPagination = (totalPages, totalItems) => {
    const paginationContainer = document.getElementById('mapel-pagination');
    if (!paginationContainer) return;

    if (totalItems === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (mapelCurrentPage - 1) * MAPEL_ROWS_PER_PAGE + 1;
    const endItem = Math.min(startItem + MAPEL_ROWS_PER_PAGE - 1, totalItems);

    let paginationHTML = `
        <span class="text-sm text-subtle">
            Menampilkan ${startItem} - ${endItem} dari ${totalItems} mapel
        </span>
    `;

    if (totalPages > 1) {
        paginationHTML += `
            <div class="inline-flex mt-2 xs:mt-0">
                <button id="prev-mapel-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-l hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Sebelumnya
                </button>
                <button id="next-mapel-page" class="flex items-center justify-center px-3 h-8 text-sm font-medium text-main bg-tertiary rounded-r border-0 border-l border-main hover:bg-main disabled:opacity-50 disabled:cursor-not-allowed">
                    Selanjutnya
                </button>
            </div>
        `;
    }
    paginationContainer.innerHTML = paginationHTML;

    const prevButton = document.getElementById('prev-mapel-page');
    const nextButton = document.getElementById('next-mapel-page');

    if (prevButton) {
        prevButton.disabled = (mapelCurrentPage === 1);
        prevButton.addEventListener('click', () => {
            if (mapelCurrentPage > 1) {
                mapelCurrentPage--;
                renderMapelListView();
            }
        });
    }
    
    if (nextButton) {
        nextButton.disabled = (mapelCurrentPage >= totalPages);
        nextButton.addEventListener('click', () => {
            if (mapelCurrentPage < totalPages) {
                mapelCurrentPage++;
                renderMapelListView();
            }
        });
    }
};

const renderMapelListView = () => {
    if (!mapelListTableBody) return;
    mapelListTableBody.innerHTML = '';

    const searchQuery = searchMapelInput ? searchMapelInput.value.toLowerCase() : '';

    const filteredMapels = localMapels.filter(m => 
        m.kategori === selectedMapelFilters.kategori &&
        m.detailPendidikan === selectedMapelFilters.detail &&
        m.tahunAjaran === parseInt(selectedMapelFilters.tahun) &&
        (m.nama.toLowerCase().includes(searchQuery) || m.kode.toLowerCase().includes(searchQuery))
    ).sort((a, b) => a.kode.localeCompare(b.kode));

    const totalItems = filteredMapels.length;
    const totalPages = Math.ceil(totalItems / MAPEL_ROWS_PER_PAGE);
    mapelCurrentPage = Math.min(Math.max(1, mapelCurrentPage), totalPages || 1);
    
    const startIndex = (mapelCurrentPage - 1) * MAPEL_ROWS_PER_PAGE;
    const paginatedMapels = filteredMapels.slice(startIndex, startIndex + MAPEL_ROWS_PER_PAGE);

    if (paginatedMapels.length === 0) {
        mapelListTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-subtle">Tidak ada mata pelajaran ditemukan.</td></tr>`;
        renderMapelPagination(0, 0);
        return;
    }

    paginatedMapels.forEach((mapel, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-main hover:bg-tertiary';
        
        const isLmsActive = mapel.isLmsActive;
        const lmsStatusClass = isLmsActive ? 'bg-green-500' : 'bg-gray-400';
        const lmsStatusText = isLmsActive ? 'ON' : 'OFF';
        const kategoriDisplay = mapel.kategoriMapel || 'Utama';

        row.innerHTML = `
            <td class="p-3 text-center">${startIndex + index + 1}</td>
            <td class="p-3 font-mono text-sm">${mapel.kode}</td>
            <td class="p-3 font-medium">${mapel.nama}</td>
            <td class="p-3 text-sm text-subtle">${kategoriDisplay}</td>
            <td class="p-3 text-center">
                 <button class="px-2 py-1 text-xs font-bold text-white rounded cursor-pointer btn-toggle-lms ${lmsStatusClass}" data-id="${mapel.id}" data-status="${isLmsActive}">
                    ${lmsStatusText}
                </button>
            </td>
            <td class="p-3 text-center flex justify-center gap-2">
                 <button class="text-blue-600 hover:text-blue-800 btn-edit-mapel" data-id="${mapel.id}" title="Edit" data-permission-action="update_data_mapel"><i class="fas fa-edit"></i></button>
                 <button class="text-red-600 hover:text-red-800 btn-hapus-mapel" data-id="${mapel.id}" title="Hapus" data-permission-action="delete_data_mapel"><i class="fas fa-trash"></i></button>
                 ${isLmsActive ? `<button class="text-purple-600 hover:text-purple-800 btn-enroll-siswa" data-id="${mapel.id}" title="Enroll Siswa"><i class="fas fa-users-cog"></i></button>` : ''}
            </td>
        `;
        mapelListTableBody.appendChild(row);
    });

    renderMapelPagination(totalPages, totalItems);
    setupActionButtons();
};

const openMapelModal = async (mapelId = null) => {
    mapelForm.reset();
    
    const modalTitle = document.getElementById('mapel-modal-title');
    const mapelIdInput = document.getElementById('mapel-id');
    const mapelKodeInput = document.getElementById('mapel-kode');
    const mapelNamaInput = document.getElementById('mapel-nama');
    const mapelKategoriSelect = document.getElementById('mapel-kategori');

    const { kategori, detail, tahun } = selectedMapelFilters;

    if (mapelId) {
        if(modalTitle) modalTitle.textContent = 'Edit Mata Pelajaran';
        const mapel = localMapels.find(m => m.id === mapelId);
        if (mapel) {
            if(mapelIdInput) mapelIdInput.value = mapel.id;
            if(mapelKodeInput) mapelKodeInput.value = mapel.kode;
            if(mapelNamaInput) mapelNamaInput.value = mapel.nama;
            
            if(mapelKategoriSelect) {
                mapelKategoriSelect.innerHTML = `<option value="${mapel.kategoriMapel || 'Utama'}">${mapel.kategoriMapel || 'Utama'}</option>
                                                 <option value="Utama">Utama</option>
                                                 <option value="Pendukung">Pendukung</option>
                                                 <option value="Lainnya">Lainnya</option>`;
                mapelKategoriSelect.value = mapel.kategoriMapel || 'Utama';
            }
        }
    } else {
        if(modalTitle) modalTitle.textContent = 'Tambah Mata Pelajaran';
        if(mapelIdInput) mapelIdInput.value = '';
        if(mapelNamaInput) mapelNamaInput.value = '';

        if(mapelKategoriSelect) {
            mapelKategoriSelect.innerHTML = `<option value="Utama">Utama</option>
                                             <option value="Pendukung">Pendukung</option>
                                             <option value="Lainnya">Lainnya</option>`;
            mapelKategoriSelect.value = 'Utama';
        }

        if(mapelKodeInput) {
            mapelKodeInput.value = 'Membuat kode...';
            mapelKodeInput.value = await generateNextMapelCode(kategori, parseInt(tahun), detail);
        }
    }
    openModal('mapel-modal');
};

const handleMapelFormSubmit = async (e) => {
    e.preventDefault();
    const mapelId = document.getElementById('mapel-id').value;
    const mapelNama = document.getElementById('mapel-nama').value;
    const mapelKode = document.getElementById('mapel-kode').value;
    const mapelKategori = document.getElementById('mapel-kategori').value;

    if (!mapelNama.trim()) {
        alert('Nama Mata Pelajaran tidak boleh kosong.');
        return;
    }

    showLoading('Menyimpan Mapel...');
    try {
        const { kategori, detail, tahun } = selectedMapelFilters;
        
        const data = {
            nama: mapelNama,
            detailPendidikan: detail,
            tahunAjaran: parseInt(tahun),
            kategori: kategori,
            kategoriMapel: mapelKategori, 
            jumlahJp: 0,
            deskripsi: '-'
        };

        if (mapelId) {
            await updateMapel(mapelId, data);
        } else {
            data.kode = mapelKode;
            data.isLmsActive = false;
            data.enrolledStudents = [];
            await addMapel(data);
        }
        closeModal('mapel-modal');
    } catch (error) {
        console.error("Error saving mapel:", error);
        alert("Gagal menyimpan mata pelajaran: " + error.message);
    } finally {
        hideLoading();
    }
};

const generateNextMapelCode = async (kategori, tahunAjaran, detail) => {
    const filteredMapels = localMapels.filter(m => 
        m.kategori === kategori && 
        m.tahunAjaran === tahunAjaran &&
        m.detailPendidikan === detail
    );
    const highestNumber = filteredMapels.reduce((max, mapel) => {
        const num = (mapel.kode && typeof mapel.kode === 'string') ? parseInt(mapel.kode.replace('MP', ''), 10) : 0;
        return num > max ? num : max;
    }, 0);
    return 'MP' + String(highestNumber + 1).padStart(2, '0');
};

const toggleLmsStatus = async (mapelId, currentStatus) => {
    const isCurrentlyActive = (String(currentStatus) === 'true');
    const isNowActive = !isCurrentlyActive;

    if (confirm(`Apakah Anda yakin ingin ${isNowActive ? 'mengaktifkan' : 'menonaktifkan'} LMS untuk mapel ini?`)) {
        showLoading('Mengupdate status...');
        try {
            await updateMapelLmsStatus(mapelId, isNowActive);
        } catch (error) {
            console.error(error);
            alert('Gagal update status LMS');
        } finally {
            hideLoading();
        }
    }
};

const setupActionButtons = () => {
    // 1. Tombol Edit
    document.querySelectorAll('.btn-edit-mapel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.btn-edit-mapel');
            if (targetBtn) {
                openMapelModal(targetBtn.dataset.id);
            }
        });
    });

    // 2. Tombol Hapus (PERBAIKAN UTAMA)
    document.querySelectorAll('.btn-hapus-mapel').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Gunakan .closest() agar ID terbaca meski ikon sampah diklik
            const targetBtn = e.target.closest('.btn-hapus-mapel');
            if (!targetBtn) return;

            const mapelId = targetBtn.dataset.id;
            const mapel = localMapels.find(m => m.id === mapelId);

            // Validasi: Cegah error jika data mapel tidak ditemukan di array lokal
            if (!mapel) {
                console.error("Data mapel tidak ditemukan untuk ID:", mapelId);
                return;
            }

            if (confirm(`Yakin ingin menghapus mapel "${mapel.nama}"?`)) {
                showLoading('Menghapus...');
                try {
                    await deleteMapel(mapelId);
                    
                    // Update state lokal: Hapus mapel dari array localMapels
                    const index = localMapels.findIndex(m => m.id === mapelId);
                    if (index > -1) {
                        localMapels.splice(index, 1);
                    }
                    
                    // Render ulang tabel agar baris hilang tanpa refresh halaman
                    renderMapelListView(); 
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    alert("Gagal menghapus data: " + error.message);
                } finally {
                    hideLoading();
                }
            }
        });
    });

    // 3. Tombol Toggle LMS
    document.querySelectorAll('.btn-toggle-lms').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.btn-toggle-lms');
            if (targetBtn) {
                toggleLmsStatus(targetBtn.dataset.id, targetBtn.dataset.status);
            }
        });
    });
    
    // 4. Tombol Enroll Siswa
    document.querySelectorAll('.btn-enroll-siswa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.btn-enroll-siswa');
            if (targetBtn) {
                openEnrollModal(targetBtn.dataset.id);
            }
        });
    });
};

// --- LMS ENROLLMENT LOGIC ---
const openEnrollModal = (mapelId) => {
    currentEnrollMapelId = mapelId;
    const mapel = localMapels.find(m => m.id === mapelId);
    if(!mapel) return;

    const relevantStudents = localStudents.filter(s => 
        s.kategori === mapel.kategori && 
        s.detailPendidikan === mapel.detailPendidikan &&
        s.tahunAjaran === mapel.tahunAjaran
    );

    const enrolledIds = mapel.enrolledStudents || [];
    tempEnrolledIds = [...enrolledIds]; 

    renderEnrollmentLists(relevantStudents);
    openModal('lms-enroll-modal');
};

const renderEnrollmentLists = (studentsData = null) => {
    if(!currentEnrollMapelId) return;
    const mapel = localMapels.find(m => m.id === currentEnrollMapelId);
    
    let sourceStudents = studentsData;
    if (!sourceStudents) {
         sourceStudents = localStudents.filter(s => 
            s.kategori === mapel.kategori && 
            s.detailPendidikan === mapel.detailPendidikan &&
            s.tahunAjaran === mapel.tahunAjaran
        );
    }

    const availableList = document.getElementById('available-students-list');
    const enrolledList = document.getElementById('enrolled-students-list');
    
    const searchAvailable = document.getElementById('search-available-students').value.toLowerCase();
    const searchEnrolled = document.getElementById('search-enrolled-students').value.toLowerCase();

    availableList.innerHTML = '';
    enrolledList.innerHTML = '';

    sourceStudents.forEach(s => {
        const isEnrolled = tempEnrolledIds.includes(s.id);
        if (!isEnrolled) {
            if (s.nama.toLowerCase().includes(searchAvailable) || (s.nosis && s.nosis.includes(searchAvailable))) {
                const div = document.createElement('div');
                div.className = 'flex justify-between items-center p-2 bg-gray-50 border border-gray-200 rounded mb-1';
                div.innerHTML = `<span class="text-sm text-gray-700">${s.nama} (${s.nosis || '-'})</span> <button class="text-green-600 hover:text-green-800 btn-add-enroll" data-id="${s.id}"><i class="fas fa-plus-circle"></i></button>`;
                availableList.appendChild(div);
            }
        } else {
             if (s.nama.toLowerCase().includes(searchEnrolled) || (s.nosis && s.nosis.includes(searchEnrolled))) {
                const div = document.createElement('div');
                div.className = 'flex justify-between items-center p-2 bg-blue-50 border border-blue-200 rounded mb-1';
                div.innerHTML = `<span class="text-sm text-gray-700">${s.nama} (${s.nosis || '-'})</span> <button class="text-red-600 hover:text-red-800 btn-remove-enroll" data-id="${s.id}"><i class="fas fa-minus-circle"></i></button>`;
                enrolledList.appendChild(div);
             }
        }
    });

    availableList.querySelectorAll('.btn-add-enroll').forEach(btn => {
        btn.onclick = () => {
            tempEnrolledIds.push(btn.dataset.id);
            renderEnrollmentLists(); 
        };
    });
    
    enrolledList.querySelectorAll('.btn-remove-enroll').forEach(btn => {
        btn.onclick = () => {
            tempEnrolledIds = tempEnrolledIds.filter(id => id !== btn.dataset.id);
            renderEnrollmentLists();
        };
    });

    document.getElementById('enroll-count-badge').textContent = `${tempEnrolledIds.length} Siswa`;
};

const handleSaveEnrollment = async () => {
    if (!currentEnrollMapelId) return;
    showLoading('Menyimpan Enrollment...');
    try {
        await updateEnrolledStudents(currentEnrollMapelId, tempEnrolledIds);
        closeModal('lms-enroll-modal');
    } catch (error) {
        console.error(error);
        alert('Gagal menyimpan enrollment.');
    } finally {
        hideLoading();
    }
};

const exportMapelToExcel = () => {
    const filteredMapels = localMapels.filter(m => 
        m.kategori === selectedMapelFilters.kategori &&
        m.detailPendidikan === selectedMapelFilters.detail &&
        m.tahunAjaran === parseInt(selectedMapelFilters.tahun)
    );

    if (filteredMapels.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const data = filteredMapels.map((m, i) => ({
        "No": i + 1,
        "Kode": m.kode,
        "Mata Pelajaran": m.nama,
        "Kategori": m.kategoriMapel,
        "JP": m.jumlahJp,
        "Deskripsi": m.deskripsi
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mapel");
    XLSX.writeFile(wb, `Mapel_${selectedMapelFilters.kategori}_${selectedMapelFilters.detail}.xlsx`);
};

const importMapelFromExcel = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ".xlsx, .xls";
    
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Mengimpor mapel...');
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    throw new Error("File Excel kosong atau format tidak sesuai.");
                }
                
                const { kategori, detail, tahun } = selectedMapelFilters;
                let nextCodeNumber = await generateNextMapelCode(kategori, parseInt(tahun), detail); 

                const promises = jsonData.map(row => {
                    const kodeMapel = row["Kode"] ? String(row["Kode"]) : `MP${String(nextCodeNumber++).padStart(2, '0')}`;
                    
                    const newMapelData = {
                        kode: kodeMapel,
                        nama: String(row["Mata Pelajaran"] || row["Nama"] || ''),
                        kategoriMapel: String(row["Kategori"] || 'Utama'),
                        jumlahJp: parseInt(row["JP"] || 0),
                        deskripsi: String(row["Deskripsi"] || ''),
                        
                        kategori: kategori,
                        detailPendidikan: detail,
                        tahunAjaran: parseInt(tahun),
                        
                        isLmsActive: false,
                        enrolledStudents: []
                    };
                    
                    if (!newMapelData.nama) return Promise.resolve();
                    return addMapel(newMapelData);
                });

                await Promise.all(promises);
                alert(`Berhasil mengimpor ${jsonData.length} mata pelajaran!`);
            } catch (error) {
                console.error("Gagal mengimpor Excel:", error);
                alert("Gagal mengimpor data: " + error.message);
            } finally {
                hideLoading();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    fileInput.click();
};

export const initMapelModule = (mapelsData, taData, studentsData) => {
    if (!window.mapelModuleInitialized) {
        mainMapView = document.getElementById('mapel-main-view');
        mapelListView = document.getElementById('mapel-list-view');
        mapelListTableBody = document.getElementById('mapel-list-table-body');
        backButtonMapel = document.getElementById('btn-back-mapel');
        mapelViewTitle = document.getElementById('mapel-view-title');
        
        mapelModal = document.getElementById('mapel-modal');
        mapelForm = document.getElementById('mapel-form');
        btnTambahMapel = document.getElementById('btn-tambah-mapel');
        searchMapelInput = document.getElementById('search-mapel-input');

        document.getElementById('mapel-view-container').addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.btn-view-mapel-group');
            if (viewBtn) {
                // [UPDATE] Logic tampilan Judul View Detail
                const kategori = viewBtn.dataset.kategori;
                const detail = viewBtn.dataset.detail;
                const tahun = viewBtn.dataset.tahun;

                selectedMapelFilters = { kategori, detail, tahun };
                
                let displayTitle = detail;
                if(detail === '-' || !detail) {
                    displayTitle = kategori;
                }

                mapelViewTitle.textContent = `${displayTitle} (TA ${tahun})`;
                mainMapView.classList.add('hidden');
                mapelListView.classList.remove('hidden');
                mapelCurrentPage = 1; 
                renderMapelListView();
            }
        });

        if (btnTambahMapel) {
            btnTambahMapel.addEventListener('click', () => openMapelModal());
        }

        document.getElementById('btn-export-mapel')?.addEventListener('click', exportMapelToExcel);
        document.getElementById('btn-import-mapel')?.addEventListener('click', importMapelFromExcel); 
        
        if (backButtonMapel) {
            backButtonMapel.addEventListener('click', () => {
                mapelListView.classList.add('hidden');
                mainMapView.classList.remove('hidden');
                mapelViewTitle.textContent = 'Manajemen Mata Pelajaran';
            });
        }

        if (mapelForm) mapelForm.addEventListener('submit', handleMapelFormSubmit);
        
        if (searchMapelInput) {
            searchMapelInput.addEventListener('input', () => {
                mapelCurrentPage = 1;
                renderMapelListView();
            });
        }
        
        lmsEnrollModal = document.getElementById('lms-enroll-modal');
        if (lmsEnrollModal) {
            document.getElementById('btn-save-enrollment').addEventListener('click', handleSaveEnrollment);
            document.getElementById('search-available-students').addEventListener('input', () => renderEnrollmentLists());
            document.getElementById('search-enrolled-students').addEventListener('input', () => renderEnrollmentLists());
        }
        window.mapelModuleInitialized = true;
    }

    localMapels = mapelsData;
    localTahunAjaran = taData;
    localStudents = studentsData;

    renderMapelMainView();
    if (mapelListView && !mapelListView.classList.contains('hidden')) {
        renderMapelListView();
    }
};