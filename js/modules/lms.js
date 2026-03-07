// js/modules/lms.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { 
    addMaterial, deleteMaterial, 
    addAssignment, deleteAssignment, 
    addForumTopic, deleteForumTopic, 
    addForumReply, updateForumReply, deleteForumReply 
} from '../firestore-service.js';

// --- STATE LOKAL MODUL ---
let localMapels = [], localMaterials = [], localAssignments = [], localForumTopics = [], localQuizzes = [];
let localGadik = [], localTahunAjaran = [], localStudents = [], localOnlineUsers = {};
let currentUser = {}, currentOpenMapel = null;

// --- ELEMEN-ELEMEN DOM (akan diinisialisasi nanti) ---
let lmsGridContainer, lmsDetailView, lmsDetailTitle, lmsDetailHeader, lmsUploadModal, lmsUploadForm, lmsClassSubtitle;
let lmsTugasModal, lmsTugasForm, lmsForumModal, lmsForumForm;

/**
 * Merender kartu-kartu mata pelajaran di halaman utama LMS.
 */
const renderLmsGrid = () => {
    if (!lmsGridContainer) return;
    lmsGridContainer.innerHTML = '';
    const activeTAs = localTahunAjaran.filter(ta => ta.isActive);
    if (activeTAs.length === 0) {
        lmsGridContainer.innerHTML = '<p class="text-subtle col-span-full text-center">Tidak ada Tahun Ajaran yang aktif.</p>';
        return;
    }
    const activeMapels = localMapels.filter(m => activeTAs.map(ta => ta.tahun).includes(m.tahunAjaran) && m.isLmsActive);
    if (activeMapels.length === 0) {
        lmsGridContainer.innerHTML = '<p class="text-subtle col-span-full text-center">Tidak ada kelas yang aktif di LMS saat ini.</p>';
        return;
    }
    let userMapels = [];
    if (currentUser.role === 'gadik' && currentUser.mapelDiampu) {
        const gadikMapelIds = currentUser.mapelDiampu.map(m => m.id);
        userMapels = activeMapels.filter(m => gadikMapelIds.includes(m.id));
    } else if (currentUser.role === 'siswa') {
        userMapels = activeMapels.filter(m => m.enrolledStudents && m.enrolledStudents.includes(currentUser.id));
    } else {
        userMapels = activeMapels;
    }
    if (userMapels.length === 0) {
        lmsGridContainer.innerHTML = '<p class="text-subtle col-span-full text-center">Anda belum terdaftar di kelas manapun.</p>';
        return;
    }
    userMapels.forEach(mapel => {
        const card = document.createElement('div');
        card.className = 'bg-card rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-200 flex flex-col';
        card.dataset.mapelId = mapel.id;
        const gadikPengampu = localGadik.find(g => g.mapelDiampu && g.mapelDiampu.some(m => m.id === mapel.id));
        card.innerHTML = `
            <div class="h-24 p-4 flex flex-col justify-between text-white" style="background-color: ${getCardColor(mapel.nama)};">
                <h3 class="text-xl font-bold truncate">${mapel.nama}</h3>
                <p class="text-sm">${mapel.kategori}</p>
            </div>
            <div class="p-4 flex-grow flex flex-col justify-between">
                <div>
                    <p class="text-xs text-subtle">TA ${mapel.tahunAjaran}</p>
                    <p class="text-sm text-subtle mt-1">${gadikPengampu ? gadikPengampu.nama : 'Belum ada Gadik'}</p>
                </div>
                <div class="mt-4 text-right">
                    <span class="text-xs font-semibold text-blue-600">Masuk Kelas &rarr;</span>
                </div>
            </div>`;
        lmsGridContainer.appendChild(card);
    });
};

/**
 * Menampilkan detail mata pelajaran (daftar materi, tugas, dll.).
 */
const showLmsDetail = (mapelId) => {
    currentOpenMapel = localMapels.find(m => m.id === mapelId);
    if (!currentOpenMapel) return;
    lmsGridContainer.parentElement.classList.add('hidden');
    lmsDetailView.classList.remove('hidden');
    lmsDetailHeader.style.backgroundColor = getCardColor(currentOpenMapel.nama);
    lmsDetailTitle.textContent = currentOpenMapel.nama;
    lmsClassSubtitle.textContent = `Tahun Ajaran ${currentOpenMapel.tahunAjaran}`;
    switchLmsTab('stream');
};

/**
 * Mengganti tab yang aktif di dalam tampilan detail LMS.
 */
const switchLmsTab = (tabName) => {
    document.querySelectorAll('.lms-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('border-blue-500', isActive);
        btn.classList.toggle('text-main', isActive);
        btn.classList.toggle('border-transparent', !isActive);
        btn.classList.toggle('text-subtle', !isActive);
    });
    document.querySelectorAll('.lms-tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `lms-tab-content-${tabName}`);
    });
    if (tabName === 'stream') renderMaterials();
    else if (tabName === 'tugas') renderAssignments();
    else if (tabName === 'anggota') renderAnggota();
    else if (tabName === 'forum') renderForum();
    else if (tabName === 'kuis') renderQuizzes();
};

/**
 * Merender daftar materi, sekarang dengan kemampuan embed video.
 */
const renderMaterials = () => {
    const container = document.getElementById('lms-materials-container');
    if (!container || !currentOpenMapel) return;

    const materialsForThisMapel = localMaterials.filter(m => m.mapelId === currentOpenMapel.id);
    
    if (materialsForThisMapel.length === 0) {
        container.innerHTML = `<div class="text-center p-8 bg-tertiary rounded-lg"><p class="text-subtle">Belum ada materi yang diunggah.</p></div>`;
        return;
    }

    container.innerHTML = '';
    materialsForThisMapel
        .sort((a, b) => (b.uploadedAt?.toDate() || 0) - (a.uploadedAt?.toDate() || 0))
        .forEach(materi => {
            const uploadedDate = materi.uploadedAt ? materi.uploadedAt.toDate().toLocaleDateString('id-ID') : 'N/A';
            const canDelete = currentUser.role === 'gadik' || currentUser.role === 'operator' || currentUser.role === 'super_admin';
            let contentHtml = '';

            if (materi.type === 'youtube') {
                contentHtml = `
                    <div class="aspect-video w-full rounded-lg overflow-hidden mt-2">
                        <iframe src="${materi.embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
                    </div>`;
            } else if (materi.type === 'googledrive') {
                 contentHtml = `
                    <a href="${materi.fileUrl}" target="_blank" class="block mt-2 bg-tertiary p-4 rounded-lg hover:bg-gray-600">
                        <div class="flex items-center">
                            <i class="fab fa-google-drive text-2xl text-gray-400 mr-3"></i>
                            <div>
                                <p class="font-semibold text-main">Google Drive File</p>
                                <p class="text-xs text-subtle">${materi.fileName || 'Klik untuk membuka'}</p>
                            </div>
                        </div>
                    </a>`;
            } else { // Tipe 'file'
                contentHtml = `
                    <a href="${materi.fileUrl}" target="_blank" class="block mt-2 bg-tertiary p-4 rounded-lg hover:bg-gray-600">
                        <div class="flex items-center">
                            <i class="fas fa-file-alt text-2xl text-blue-500 mr-3"></i>
                            <div>
                                <p class="font-semibold text-main">${materi.fileName || 'File'}</p>
                                <p class="text-xs text-subtle">Klik untuk mengunduh</p>
                            </div>
                        </div>
                    </a>`;
            }

            const item = document.createElement('div');
            item.className = 'bg-card p-4 rounded-lg shadow-sm';
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-semibold text-main text-lg">${materi.judul}</h4>
                        <p class="text-sm text-subtle">${materi.deskripsi || ''}</p>
                        <p class="text-xs text-subtle mt-1">Diunggah oleh ${materi.uploaderName} pada ${uploadedDate}</p>
                    </div>
                    ${canDelete ? `<button class="text-red-500 hover:underline text-sm btn-hapus-materi" data-id="${materi.id}">Hapus</button>` : ''}
                </div>
                ${contentHtml}
            `;
            container.appendChild(item);
        });
        
    container.querySelectorAll('.btn-hapus-materi').forEach(btn => {
        btn.addEventListener('click', async e => {
            if (confirm('Apakah Anda yakin ingin menghapus materi ini?')) {
                showLoading('Menghapus...');
                await deleteMaterial(e.target.dataset.id);
                hideLoading();
            }
        });
    });
};

/**
 * Merender daftar tugas.
 */
const renderAssignments = () => {
    const container = document.getElementById('lms-assignments-container');
    const btnWrapper = document.getElementById('btn-buat-tugas-wrapper');
    if (!container || !currentOpenMapel || !btnWrapper) return;

    const canCreate = currentUser.role === 'gadik' || currentUser.role === 'operator' || currentUser.role === 'super_admin';
    btnWrapper.classList.toggle('hidden', !canCreate);

    const assignmentsForThisMapel = localAssignments.filter(a => a.mapelId === currentOpenMapel.id);
    
    if (assignmentsForThisMapel.length === 0) {
        container.innerHTML = `<div class="text-center p-8 bg-tertiary rounded-lg"><p class="text-subtle">Belum ada tugas yang dibuat untuk kelas ini.</p></div>`;
        return;
    }

    container.innerHTML = '';
    assignmentsForThisMapel
        .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0))
        .forEach(tugas => {
            const dueDate = tugas.dueDate?.toDate() ? new Date(tugas.dueDate.toDate()).toLocaleString('id-ID') : 'N/A';
            const item = document.createElement('div');
            item.className = 'flex items-start sm:items-center justify-between p-4 bg-card rounded-lg shadow-sm hover:bg-tertiary transition-colors duration-200 flex-col sm:flex-row gap-4';
            
            item.innerHTML = `
                <div class="flex items-start">
                    <i class="fas fa-clipboard-list text-2xl text-green-500 mr-4 mt-1"></i>
                    <div>
                        <h4 class="font-semibold text-main">${tugas.judul}</h4>
                        <p class="text-sm text-subtle">Batas Waktu: ${dueDate}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-end sm:self-center">
                    <button class="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 text-sm whitespace-nowrap">Lihat Detail</button>
                    ${canCreate ? `<button class="text-red-500 hover:underline btn-hapus-tugas" data-id="${tugas.id}">Hapus</button>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
        
    container.querySelectorAll('.btn-hapus-tugas').forEach(btn => {
        btn.addEventListener('click', async e => {
            if (confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
                showLoading('Menghapus...');
                await deleteAssignment(e.target.dataset.id);
                hideLoading();
            }
        });
    });
};

/**
 * Merender daftar anggota kelas (Gadik & Siswa).
 */
const renderAnggota = () => {
    const instructorsContainer = document.getElementById('lms-instructors-list');
    const studentsContainer = document.getElementById('lms-students-list');
    const studentCountEl = document.getElementById('lms-student-count');

    if (!instructorsContainer || !studentsContainer || !studentCountEl || !currentOpenMapel) return;

    const instructors = localGadik.filter(g => g.mapelDiampu && g.mapelDiampu.some(m => m.id === currentOpenMapel.id));
    instructorsContainer.innerHTML = '';
    if (instructors.length > 0) {
        instructors.forEach(gadik => {
            instructorsContainer.innerHTML += `
                <div class="flex items-center p-2 rounded-lg">
                    <img src="${gadik.fotoUrl || 'https://placehold.co/40x40/e2e8f0/4a5568?text=G'}" alt="Foto Gadik" class="w-10 h-10 rounded-full mr-4 object-cover">
                    <span class="text-main font-medium">${gadik.nama}</span>
                </div>
            `;
        });
    } else {
        instructorsContainer.innerHTML = `<p class="text-subtle p-2">Belum ada Gadik yang ditugaskan.</p>`;
    }

    const students = localStudents.filter(s => currentOpenMapel.enrolledStudents && currentOpenMapel.enrolledStudents.includes(s.id));
    studentsContainer.innerHTML = '';
    studentCountEl.textContent = `${students.length} Siswa`;
    if (students.length > 0) {
        students.sort((a, b) => a.nama.localeCompare(b.nama)).forEach(siswa => {
            const isOnline = localOnlineUsers[siswa.id] === true;
            const onlineIndicator = isOnline 
                ? '<span class="w-2.5 h-2.5 bg-green-500 rounded-full ml-2"></span>' 
                : '';

            studentsContainer.innerHTML += `
                <div class="flex items-center justify-between p-2 rounded-lg border-b border-tertiary">
                    <div class="flex items-center">
                        <img src="${siswa.fotoUrl || 'https://placehold.co/40x40/e2e8f0/4a5568?text=S'}" alt="Foto Siswa" class="w-10 h-10 rounded-full mr-4 object-cover">
                        <span class="text-main">${siswa.nama}</span>
                    </div>
                    <div class="flex items-center">
                        ${onlineIndicator}
                    </div>
                </div>
            `;
        });
    } else {
        studentsContainer.innerHTML = `<p class="text-subtle p-2">Belum ada siswa yang terdaftar.</p>`;
    }
};

/**
 * Merender forum diskusi.
 */
const renderForum = () => {
    const container = document.getElementById('lms-forum-container');
    if (!container || !currentOpenMapel) return;

    const topicsForThisMapel = localForumTopics.filter(t => t.mapelId === currentOpenMapel.id);

    if (topicsForThisMapel.length === 0) {
        container.innerHTML = `<div class="text-center p-8 bg-tertiary rounded-lg"><p class="text-subtle">Belum ada topik diskusi.</p></div>`;
        return;
    }

    container.innerHTML = '';
    topicsForThisMapel
        .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0))
        .forEach(topic => {
            const createdAt = topic.createdAt?.toDate() ? new Date(topic.createdAt.toDate()).toLocaleString('id-ID') : 'N/A';
            const author = localStudents.find(s => s.id === topic.authorId) || localGadik.find(g => g.id === topic.authorId) || { nama: 'Tidak Dikenal', fotoUrl: '' };

            let repliesHtml = (topic.replies || []).sort((a, b) => (a.repliedAt?.toDate() || 0) - (b.repliedAt?.toDate() || 0)).map(reply => {
                const replier = localStudents.find(s => s.id === reply.authorId) || localGadik.find(g => g.id === reply.authorId) || { nama: 'Tidak Dikenal', fotoUrl: '' };
                const repliedAt = reply.repliedAt?.toDate() ? new Date(reply.repliedAt.toDate()).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                
                const isAuthor = currentUser.id === reply.authorId;
                const isModerator = ['super_admin', 'operator', 'gadik'].includes(currentUser.role);
                
                let actionButtons = '';
                if (isAuthor || isModerator) {
                    actionButtons += `<div class="absolute top-2 right-2 flex gap-2">`;
                    if (isAuthor) {
                        actionButtons += `<button class="text-blue-500 hover:text-blue-400 text-xs btn-edit-reply" data-topic-id="${topic.id}" data-reply-id="${reply.id}" data-isi="${reply.isi}"><i class="fas fa-edit"></i></button>`;
                    }
                    if (isAuthor || isModerator) {
                        actionButtons += `<button class="text-red-500 hover:text-red-400 text-xs btn-delete-reply" data-topic-id="${topic.id}" data-reply-id="${reply.id}"><i class="fas fa-trash"></i></button>`;
                    }
                    actionButtons += `</div>`;
                }

                return `
                    <div class="flex items-start mt-4 ml-8">
                        <img src="${replier.fotoUrl || 'https://placehold.co/40x40/e2e8f0/4a5568?text=U'}" alt="Foto" class="w-8 h-8 rounded-full mr-3 object-cover">
                        <div class="bg-tertiary p-3 rounded-lg flex-1 relative">
                            ${actionButtons}
                            <div class="flex items-center justify-between pr-10">
                                <p class="font-semibold text-main text-sm">${replier.nama}</p>
                                <p class="text-xs text-subtle">${repliedAt} ${reply.editedAt ? '(edited)' : ''}</p>
                            </div>
                            <p class="text-sm text-main mt-1 whitespace-pre-wrap">${reply.isi}</p>
                        </div>
                    </div>`;
            }).join('');

            const topicElement = document.createElement('div');
            topicElement.className = 'bg-card p-4 rounded-lg shadow-sm';
            topicElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-start">
                        <img src="${author.fotoUrl || 'https://placehold.co/40x40/e2e8f0/4a5568?text=U'}" alt="Foto Penulis" class="w-10 h-10 rounded-full mr-4 object-cover">
                        <div>
                            <h4 class="font-bold text-main">${topic.judul}</h4>
                            <p class="text-xs text-subtle">Oleh ${author.nama} - ${createdAt}</p>
                        </div>
                    </div>
                    ${currentUser.role === 'super_admin' ? 
                        `<button class="text-red-500 hover:text-red-400 text-sm btn-delete-topic" data-topic-id="${topic.id}">
                            <i class="fas fa-trash-alt mr-1"></i> Hapus Topik
                         </button>` : ''
                    }
                </div>
                <p class="text-sm text-main mt-2 whitespace-pre-wrap">${topic.isi}</p>
                <div class="replies-container">${repliesHtml}</div>
                <form class="reply-form mt-4 ml-8 flex gap-2">
                    <input type="hidden" name="topicId" value="${topic.id}">
                    <textarea name="reply-text" class="bg-input border border-main text-main text-sm rounded-lg block w-full p-2" rows="1" placeholder="Tulis balasan..."></textarea>
                    <button type="submit" class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm">Kirim</button>
                </form>
            `;
            container.appendChild(topicElement);
        });

    container.querySelectorAll('.reply-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const formButton = form.querySelector('button[type="submit"]');
            const formTextarea = form.querySelector('textarea[name="reply-text"]');
            const topicId = form.querySelector('input[name="topicId"]').value;
            const isi = formTextarea.value;
            if (!isi.trim()) return;
            formButton.disabled = true;
            formButton.textContent = 'Mengirim...';
            try {
                const replyData = { authorId: currentUser.id, isi: isi.trim() };
                await addForumReply(topicId, replyData);
                form.reset();
            } catch (error) {
                console.error("Gagal mengirim balasan:", error);
                alert("Gagal mengirim balasan. Silakan coba lagi.");
            } finally {
                formButton.disabled = false;
                formButton.textContent = 'Kirim';
            }
        });
    });
};

/**
 * Merender daftar kuis.
 */
const renderQuizzes = () => {
    const container = document.getElementById('lms-quizzes-container');
    const btnWrapper = document.getElementById('btn-buat-kuis-wrapper');
    if (!container || !currentOpenMapel || !btnWrapper) return;

    const canCreate = currentUser.role === 'gadik' || currentUser.role === 'operator' || currentUser.role === 'super_admin';
    btnWrapper.classList.toggle('hidden', !canCreate);
    document.getElementById('btn-buat-kuis').href = `quiz_builder.html?mapelId=${currentOpenMapel.id}`;

    const quizzesForThisMapel = localQuizzes.filter(q => q.mapelId === currentOpenMapel.id);
    if (quizzesForThisMapel.length === 0) {
        container.innerHTML = `<div class="text-center p-8 bg-tertiary rounded-lg"><p class="text-subtle">Belum ada kuis yang dibuat.</p></div>`;
        return;
    }
    container.innerHTML = '';
    quizzesForThisMapel.forEach(quiz => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-4 bg-card rounded-lg shadow-sm';
        item.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-file-signature text-2xl text-purple-400 mr-4"></i>
                <div>
                    <h4 class="font-semibold text-main">${quiz.title}</h4>
                    <p class="text-sm text-subtle">${quiz.questions.length} pertanyaan - ${quiz.duration} menit</p>
                </div>
            </div>
            <div>
                ${canCreate ? `<a href="quiz_builder.html?quizId=${quiz.id}&mapelId=${currentOpenMapel.id}" class="text-blue-500 hover:underline text-sm mr-4">Edit</a>` : ''}
                <button class="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 text-sm">Mulai Kuis</button>
            </div>`;
        container.appendChild(item);
    });
};

/**
 * Menangani submit form unggah materi (versi gabungan).
 */
const handleLmsUploadFormSubmit = async (e) => {
    e.preventDefault();
    const judul = document.getElementById('lms-upload-judul').value;
    const deskripsi = document.getElementById('lms-upload-deskripsi').value;
    const link = document.getElementById('lms-upload-link').value.trim();
    const fileInput = document.getElementById('lms-upload-file');
    const file = fileInput.files[0];

    if (!judul.trim()) return alert('Judul materi wajib diisi.');
    if (!link && !file) return alert('Harap isi salah satu, Link atau File.');
    if (link && file) return alert('Harap isi salah satu saja, Link atau File, tidak keduanya.');

    let materialData = {
        mapelId: currentOpenMapel.id, judul, deskripsi,
        uploaderId: currentUser.id, uploaderName: currentUser.nama,
        type: '', fileUrl: '', fileName: '', embedUrl: ''
    };

    showLoading('Menyimpan materi...');
    try {
        if (link) {
            materialData.fileUrl = link;
            materialData.fileName = link;
            if (link.includes("youtube.com/watch?v=")) {
                const videoId = new URL(link).searchParams.get('v');
                materialData.type = 'youtube';
                materialData.embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (link.includes("youtu.be/")) {
                const videoId = new URL(link).pathname.slice(1);
                materialData.type = 'youtube';
                materialData.embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (link.includes("drive.google.com")) {
                materialData.type = 'googledrive';
            } else {
                throw new Error('Link tidak valid. Harap masukkan link YouTube atau Google Drive.');
            }
        } else if (file) {
            materialData.type = 'file';
            if (file.size > 20 * 1024 * 1024) throw new Error('Ukuran file terlalu besar. Maksimal 20MB.');
            const formData = new FormData();
            formData.append('materiFile', file);
            const response = await fetch('upload_materi.php', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            materialData.fileUrl = result.url;
            materialData.fileName = file.name;
        }
        await addMaterial(materialData);
        closeModal('lms-upload-modal');
    } catch (error) {
        alert('Gagal menyimpan materi: ' + error.message);
    } finally {
        hideLoading();
    }
};

/**
 * Menangani submit form buat tugas baru.
 */
const handleTugasFormSubmit = async (e) => {
    e.preventDefault();
    const judul = document.getElementById('lms-tugas-judul').value;
    const deskripsi = document.getElementById('lms-tugas-deskripsi').value;
    const dueDateValue = document.getElementById('lms-tugas-duedate').value;
    const fileInput = document.getElementById('lms-tugas-file');
    const file = fileInput.files[0];

    if (!judul.trim() || !dueDateValue) {
        alert('Judul dan Batas Waktu wajib diisi.');
        return;
    }
    
    const dueDate = new Date(dueDateValue);

    showLoading('Menyimpan tugas...');
    try {
        let fileUrl = '', fileName = '';
        if (file) {
            if (file.size > 20 * 1024 * 1024) throw new Error('Ukuran file lampiran terlalu besar. Maksimal 20MB.');
            const formData = new FormData();
            formData.append('materiFile', file);
            const response = await fetch('upload_materi.php', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            fileUrl = result.url;
            fileName = file.name;
        }

        const assignmentData = {
            mapelId: currentOpenMapel.id, judul, deskripsi, dueDate, fileUrl, fileName,
            creatorId: currentUser.id, creatorName: currentUser.nama
        };
        await addAssignment(assignmentData);
        closeModal('lms-tugas-modal');
    } catch (error) {
        alert('Gagal menyimpan tugas: ' + error.message);
    } finally {
        hideLoading();
    }
};

/**
 * Menangani submit form buat topik forum.
 */
const handleForumFormSubmit = async (e) => {
    e.preventDefault();
    const judul = document.getElementById('lms-forum-judul').value;
    const isi = document.getElementById('lms-forum-isi').value;
    if (!judul.trim() || !isi.trim()) return alert('Judul dan Isi Topik tidak boleh kosong.');

    const topicData = {
        mapelId: currentOpenMapel.id,
        judul, isi,
        authorId: currentUser.id,
    };
    showLoading('Membuat topik...');
    await addForumTopic(topicData);
    hideLoading();
    closeModal('lms-forum-modal');
};

/**
 * Menghasilkan warna unik untuk setiap kartu berdasarkan nama mapel.
 */
const getCardColor = (str) => {
    let hash = 0;
    if (!str) return '#4A90E2';
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0', '#9013FE', '#B8E986', '#7ED321', '#E53E3E'];
    return colors[Math.abs(hash) % colors.length];
};

/**
 * Fungsi inisialisasi untuk modul LMS.
 */
export const initLmsModule = (mapelsData, materialsData, assignmentsData, forumTopicsData, quizzesData, gadikData, taData, studentsData, onlineUsersData) => { 
    if (!window.lmsModuleInitialized) {
        lmsGridContainer = document.getElementById('lms-class-grid');
        lmsDetailView = document.getElementById('lms-class-view');
        lmsDetailTitle = document.getElementById('lms-class-title');
        lmsDetailHeader = document.getElementById('lms-class-header-bg');
        lmsClassSubtitle = document.getElementById('lms-class-subtitle');
        lmsUploadModal = document.getElementById('lms-upload-modal');
        lmsUploadForm = document.getElementById('lms-upload-form');
        lmsTugasModal = document.getElementById('lms-tugas-modal');
        lmsTugasForm = document.getElementById('lms-tugas-form');
        lmsForumModal = document.getElementById('lms-forum-modal');
        lmsForumForm = document.getElementById('lms-forum-form');

        if (lmsGridContainer) {
            lmsGridContainer.addEventListener('click', (e) => {
                const card = e.target.closest('[data-mapel-id]');
                if (card) showLmsDetail(card.dataset.mapelId);
            });
        }
        
        const lmsForumContainer = document.getElementById('lms-tab-content-forum');
        if (lmsForumContainer) {
            lmsForumContainer.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.btn-edit-reply');
                const deleteBtn = e.target.closest('.btn-delete-reply');
                const deleteTopicBtn = e.target.closest('.btn-delete-topic');

                if (editBtn) {
                    const { topicId, replyId, isi } = editBtn.dataset;
                    const newIsi = prompt("Edit balasan Anda:", isi);
                    if (newIsi && newIsi.trim() !== "" && newIsi.trim() !== isi) {
                        showLoading('Memperbarui...');
                        try {
                           await updateForumReply(topicId, replyId, newIsi.trim());
                        } catch (error) {
                           console.error("Gagal memperbarui balasan:", error);
                           alert("Gagal memperbarui balasan.");
                        } finally {
                           hideLoading();
                        }
                    }
                }

                if (deleteBtn) {
                    const { topicId, replyId } = deleteBtn.dataset;
                    if (confirm("Apakah Anda yakin ingin menghapus balasan ini?")) {
                        showLoading('Menghapus...');
                         try {
                           await deleteForumReply(topicId, replyId);
                        } catch (error) {
                           console.error("Gagal menghapus balasan:", error);
                           alert("Gagal menghapus balasan.");
                        } finally {
                           hideLoading();
                        }
                    }
                }
                
                if (deleteTopicBtn) {
                    const { topicId } = deleteTopicBtn.dataset;
                    if (confirm("PERINGATAN: Menghapus topik ini juga akan menghapus SEMUA balasannya. Lanjutkan?")) {
                        showLoading('Menghapus Topik...');
                        try {
                           await deleteForumTopic(topicId);
                        } catch (error) {
                           console.error("Gagal menghapus topik:", error);
                           alert("Gagal menghapus topik.");
                        } finally {
                           hideLoading();
                        }
                    }
                }
            });
        }

        document.getElementById('btn-back-to-classes')?.addEventListener('click', () => {
            lmsGridContainer.parentElement.classList.remove('hidden');
            lmsDetailView.classList.add('hidden');
            currentOpenMapel = null;
        });
        document.querySelectorAll('.lms-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchLmsTab(btn.dataset.tab));
        });
        document.getElementById('btn-upload-materi-trigger')?.addEventListener('click', () => {
            if (['gadik', 'operator', 'super_admin'].includes(currentUser.role)) {
                if(lmsUploadForm) lmsUploadForm.reset();
                openModal('lms-upload-modal');
            } else {
                alert('Hanya Gadik atau Admin yang dapat mengunggah materi.');
            }
        });
        if (lmsUploadForm) lmsUploadForm.addEventListener('submit', handleLmsUploadFormSubmit);
        document.getElementById('btn-buat-tugas')?.addEventListener('click', () => {
            if (lmsTugasForm) lmsTugasForm.reset();
            openModal('lms-tugas-modal');
        });
        if (lmsTugasForm) lmsTugasForm.addEventListener('submit', handleTugasFormSubmit);
        document.getElementById('btn-buat-topik')?.addEventListener('click', () => {
            if(lmsForumForm) lmsForumForm.reset();
            openModal('lms-forum-modal');
        });
        if (lmsForumForm) lmsForumForm.addEventListener('submit', handleForumFormSubmit);
        window.lmsModuleInitialized = true;
    }

    localMapels = mapelsData;
    localMaterials = materialsData;
    localAssignments = assignmentsData;
    localForumTopics = forumTopicsData;
    localQuizzes = quizzesData;
    localGadik = gadikData;
    localTahunAjaran = taData;
    localStudents = studentsData;
    localOnlineUsers = onlineUsersData || {};
    currentUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};

    if (currentOpenMapel) {
        const activeTab = document.querySelector('.lms-tab-btn.border-blue-500')?.dataset.tab || 'stream';
        switchLmsTab(activeTab);
    } else {
        renderLmsGrid();
    }
};