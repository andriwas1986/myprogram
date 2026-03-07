// js/firestore-service.js

import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs, 
    serverTimestamp, arrayUnion, query, where, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appId = 'default-app-id';

export const getCollectionRef = (collectionName) => collection(db, `artifacts/${appId}/public/data/${collectionName}`);

export const getTahunAjaranForLogin = async () => {
    try {
        const querySnapshot = await getDocs(getCollectionRef('master_tahun_ajaran'));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.error("Gagal mengambil data Tahun Ajaran untuk login:", error);
        return [];
    }
};

export const getSettings = async () => {
    try {
        const docRef = doc(db, `artifacts/${appId}/public/data/settings/config`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : {};
    } catch (error) {
        console.error("Gagal mengambil data settings:", error);
        return {};
    }
};

const subscribeToCollection = (collectionName, callback) => {
    const q = query(getCollectionRef(collectionName));
    return onSnapshot(q, (snapshot) => {
        const dataList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(dataList);
    });
};

export const subscribeToTahunAjaran = (cb) => subscribeToCollection('master_tahun_ajaran', cb);
export const subscribeToStudents = (cb) => subscribeToCollection('students', cb);
export const subscribeToMapels = (cb) => subscribeToCollection('subjects', cb);
export const subscribeToGadik = (cb) => subscribeToCollection('gadik', cb);
export const subscribeToDanton = (cb) => subscribeToCollection('danton', cb);
export const subscribeToAnnouncements = (cb) => subscribeToCollection('announcements', cb);
export const subscribeToSuperadmins = (cb) => subscribeToCollection('superadmins', cb);
export const subscribeToOperators = (cb) => subscribeToCollection('operators', cb);
export const subscribeToSchedules = (cb) => subscribeToCollection('schedules', cb);
export const subscribeToMaterials = (cb) => subscribeToCollection('lms_materials', cb);
export const subscribeToAssignments = (cb) => subscribeToCollection('lms_assignments', cb);
export const subscribeToForumTopics = (cb) => subscribeToCollection('lms_forum_topics', cb);
export const subscribeToAbsences = (cb) => subscribeToCollection('gadik_absences', cb);
export const subscribeToQuizzes = (cb) => subscribeToCollection('lms_quizzes', cb);
export const subscribeToPelanggaran = (cb) => subscribeToCollection('pelanggaran_siswa', cb);

export const subscribeToPermissions = (callback) => {
    const docRef = doc(db, `artifacts/${appId}/public/data/permissions/config`);
    return onSnapshot(docRef, (docSnap) => callback(docSnap.exists() ? docSnap.data() : {}));
};
export const savePermissions = (data) => setDoc(doc(db, `artifacts/${appId}/public/data/permissions/config`), data);

export const subscribeToSettings = (callback) => {
    const docRef = doc(db, `artifacts/${appId}/public/data/settings/config`);
    return onSnapshot(docRef, (docSnap) => callback(docSnap.exists() ? docSnap.data() : {}));
};
export const saveSettings = (data) => setDoc(doc(db, `artifacts/${appId}/public/data/settings/config`), data, { merge: true });

export const addTahunAjaran = (data) => addDoc(getCollectionRef('master_tahun_ajaran'), data);
export const addStudent = (data) => addDoc(getCollectionRef('students'), data);
export const addMapel = (data) => addDoc(getCollectionRef('subjects'), { ...data, isLmsActive: false });
export const addGadik = (data) => addDoc(getCollectionRef('gadik'), data);
export const addDanton = (data) => addDoc(getCollectionRef('danton'), data);
export const addAnnouncement = (data) => addDoc(getCollectionRef('announcements'), { ...data, createdAt: serverTimestamp() });
export const addAdmin = (role, data) => addDoc(getCollectionRef(role === 'super_admin' ? 'superadmins' : 'operators'), data);
export const addSchedule = (data) => addDoc(getCollectionRef('schedules'), data);
export const addMaterial = (data) => addDoc(getCollectionRef('lms_materials'), { ...data, uploadedAt: serverTimestamp() });
export const addAssignment = (data) => addDoc(getCollectionRef('lms_assignments'), { ...data, createdAt: serverTimestamp() });
export const addForumTopic = (data) => addDoc(getCollectionRef('lms_forum_topics'), { ...data, createdAt: serverTimestamp(), replies: [] });
export const addPelanggaran = (data) => addDoc(getCollectionRef('pelanggaran_siswa'), data);


export const addForumReply = (topicId, replyData) => {
    const topicRef = doc(db, getCollectionRef('lms_forum_topics').path, topicId);
    const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newReply = { ...replyData, id: replyId, repliedAt: new Date() };
    return updateDoc(topicRef, { replies: arrayUnion(newReply) });
};

export const updateForumReply = async (topicId, replyId, newIsi) => {
    const topicRef = doc(db, getCollectionRef('lms_forum_topics').path, topicId);
    const topicSnap = await getDoc(topicRef);
    if (topicSnap.exists()) {
        const topicData = topicSnap.data();
        const replies = topicData.replies || [];
        const updatedReplies = replies.map(reply => {
            if (reply.id === replyId) {
                return { ...reply, isi: newIsi, editedAt: new Date() };
            }
            return reply;
        });
        return updateDoc(topicRef, { replies: updatedReplies });
    }
};

export const deleteForumReply = async (topicId, replyId) => {
    const topicRef = doc(db, getCollectionRef('lms_forum_topics').path, topicId);
    const topicSnap = await getDoc(topicRef);
    if (topicSnap.exists()) {
        const topicData = topicSnap.data();
        const replies = topicData.replies || [];
        const updatedReplies = replies.filter(reply => reply.id !== replyId);
        return updateDoc(topicRef, { replies: updatedReplies });
    }
};

export const deleteForumTopic = (id) => deleteDoc(doc(db, getCollectionRef('lms_forum_topics').path, id));

export const addAbsence = (data) => addDoc(getCollectionRef('gadik_absences'), data);
export const updateTahunAjaran = (id, data) => updateDoc(doc(db, getCollectionRef('master_tahun_ajaran').path, id), data);
export const updateStudent = (id, data) => setDoc(doc(db, getCollectionRef('students').path, id), data, { merge: true });
export const updateMapel = (id, data) => updateDoc(doc(db, getCollectionRef('subjects').path, id), data);
export const updateGadik = (id, data) => setDoc(doc(db, getCollectionRef('gadik').path, id), data, { merge: true });
export const updateDanton = (id, data) => setDoc(doc(db, getCollectionRef('danton').path, id), data, { merge: true });
export const updateAnnouncement = (id, data) => updateDoc(doc(db, getCollectionRef('announcements').path, id), data);
export const updateAdmin = (id, role, data) => updateDoc(doc(db, getCollectionRef(role === 'super_admin' ? 'superadmins' : 'operators').path, id), data);
export const updateSchedule = (id, data) => updateDoc(doc(db, getCollectionRef('schedules').path, id), data);
export const updateMapelLmsStatus = (id, isActive) => updateDoc(doc(db, getCollectionRef('subjects').path, id), { isLmsActive: isActive });
export const updateEnrolledStudents = (mapelId, enrolledStudentIds) => updateDoc(doc(db, getCollectionRef('subjects').path, mapelId), { enrolledStudents: enrolledStudentIds });
export const updateAbsence = (id, data) => updateDoc(doc(db, getCollectionRef('gadik_absences').path, id), data);
export const updatePelanggaran = (id, data) => updateDoc(doc(db, getCollectionRef('pelanggaran_siswa').path, id), data);


export const deleteTahunAjaran = (id) => deleteDoc(doc(db, getCollectionRef('master_tahun_ajaran').path, id));
export const deleteStudent = (id) => deleteDoc(doc(db, getCollectionRef('students').path, id));
export const deleteMapel = (id) => deleteDoc(doc(db, getCollectionRef('subjects').path, id));
export const deleteGadik = (id) => deleteDoc(doc(db, getCollectionRef('gadik').path, id));
export const deleteDanton = (id) => deleteDoc(doc(db, getCollectionRef('danton').path, id));
export const deleteAnnouncement = (id) => deleteDoc(doc(db, getCollectionRef('announcements').path, id));
export const deleteAdmin = (role, id) => deleteDoc(doc(db, getCollectionRef(role === 'super_admin' ? 'superadmins' : 'operators').path, id));
export const deleteSchedule = (id) => deleteDoc(doc(db, getCollectionRef('schedules').path, id));
export const deleteMaterial = (id) => deleteDoc(doc(db, getCollectionRef('lms_materials').path, id));
export const deleteAssignment = (id) => deleteDoc(doc(db, getCollectionRef('lms_assignments').path, id));
export const deletePelanggaran = (id) => deleteDoc(doc(db, getCollectionRef('pelanggaran_siswa').path, id));


export const getAcademicScores = async (siswaId) => {
    const scoreDocRef = doc(db, getCollectionRef('academic_scores').path, siswaId);
    const docSnap = await getDoc(scoreDocRef);
    return docSnap.exists() ? docSnap.data().scores : {};
};
export const saveAcademicScores = (siswaId, scores) => setDoc(doc(db, getCollectionRef('academic_scores').path, siswaId), { scores }, { merge: true });
export const addSimpleScore = (siswaId, field, nilai) => updateDoc(doc(db, getCollectionRef('students').path, siswaId), { [field]: arrayUnion(nilai) });

export const updateNilaiInArray = async (siswaId, field, scoreIndex, newScore) => {
    const studentRef = doc(db, getCollectionRef('students').path, siswaId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        const scores = studentData[field] || [];
        if (scores.length > scoreIndex) {
            scores[scoreIndex] = newScore;
            return updateDoc(studentRef, { [field]: scores });
        }
    }
};

export const deleteNilaiInArray = async (siswaId, field, scoreIndex) => {
    const studentRef = doc(db, getCollectionRef('students').path, siswaId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        const scores = studentData[field] || [];
        if (scores.length > scoreIndex) {
            scores.splice(scoreIndex, 1);
            return updateDoc(studentRef, { [field]: scores });
        }
    }
};

export const subscribeToSchedulePdfs = (cb) => subscribeToCollection('schedules_pdf', cb);

export const saveSchedulePdf = (id, data) => {
    const docRef = doc(db, getCollectionRef('schedules_pdf').path, id);
    return setDoc(docRef, data, { merge: true });
};

// [BARU] FUNGSI HAPUS MASSAL UNTUK SISWA
export const deleteStudentsBulk = async (ids) => {
    // Firestore batch limit adalah 500 operasi.
    // Kita buat chunking (misal per 400) untuk aman.
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
            // Menggunakan getCollectionRef yang konsisten dengan fungsi lain
            const docRef = doc(db, getCollectionRef('students').path, id);
            batch.delete(docRef);
        });

        // Eksekusi batch
        await batch.commit();
    }
};

// [UPDATE] Cari kandidat alumni berdasarkan NOSIS & NRP (Untuk Auth 2 Langkah)
export const findAlumniCandidate = async (nosis, nrp) => {
    try {
        const q = query(
            getCollectionRef('students'), 
            where('nosis', '==', nosis),
            where('nrp', '==', nrp)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            // Kita dapatkan datanya, tapi belum kita izinkan login
            // Data ini akan dipakai di Auth.js untuk membandingkan No. Telp
            const studentDoc = querySnapshot.docs[0];
            return { ...studentDoc.data(), id: studentDoc.id };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error finding alumni:", error);
        throw error;
    }
};