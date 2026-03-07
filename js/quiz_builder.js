// js/quiz_builder.js

import { showLoading, hideLoading } from './ui.js';
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const appId = 'default-app-id';
let currentQuizId = null;
let currentMapelId = null;

const questionsContainer = document.getElementById('questions-container');

// Fungsi untuk menambahkan pertanyaan baru dari template
const addQuestion = (type) => {
    const template = document.getElementById(`${type}-question-template`).content.cloneNode(true);
    const questionItem = template.querySelector('.question-item');
    
    // Beri nama unik untuk radio button pada Pilihan Ganda
    if (type === 'mc') {
        const questionId = `q_${Date.now()}`;
        questionItem.querySelectorAll('.correct-answer-radio').forEach(radio => {
            radio.name = `correct-answer-${questionId}`;
        });
    }
    
    questionsContainer.appendChild(template);
    setupQuestionListeners(questionItem);
};

// Setup event listener untuk satu item pertanyaan
const setupQuestionListeners = (questionItem) => {
    questionItem.querySelector('.btn-delete-question').addEventListener('click', () => {
        if (confirm('Yakin ingin menghapus pertanyaan ini?')) {
            questionItem.remove();
        }
    });
};

// Fungsi untuk menyimpan semua data kuis ke Firestore
const saveQuiz = async () => {
    showLoading('Menyimpan kuis...');
    const quizTitle = document.getElementById('quiz-title-input').value;
    const quizDuration = document.getElementById('quiz-duration').value;
    const quizDescription = document.getElementById('quiz-description-input').value;

    if (!quizTitle || !quizDuration) {
        alert('Judul dan Durasi Kuis wajib diisi.');
        hideLoading();
        return;
    }

    const questions = [];
    document.querySelectorAll('.question-item').forEach((item, index) => {
        const questionData = {
            id: `q${index + 1}`,
            type: item.dataset.type,
            text: item.querySelector('.question-text').value
        };

        if (questionData.type === 'mc') {
            questionData.options = [];
            item.querySelectorAll('.option-text').forEach(opt => {
                questionData.options.push(opt.value);
            });
            const correctAnswer = item.querySelector('.correct-answer-radio:checked');
            questionData.answer = correctAnswer ? correctAnswer.value : null;
        }
        questions.push(questionData);
    });

    const quizData = {
        mapelId: currentMapelId,
        title: quizTitle,
        description: quizDescription,
        duration: parseInt(quizDuration),
        questions: questions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    
    try {
        let docRef;
        if (currentQuizId) {
            docRef = doc(db, `artifacts/${appId}/public/data/lms_quizzes`, currentQuizId);
            await setDoc(docRef, quizData, { merge: true });
        } else {
            docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/lms_quizzes`), quizData);
            // Update URL untuk menyertakan ID kuis yang baru dibuat
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('quizId', docRef.id);
            window.history.pushState({}, '', newUrl);
            currentQuizId = docRef.id;
        }
        alert('Kuis berhasil disimpan!');
    } catch (error) {
        console.error("Gagal menyimpan kuis:", error);
        alert('Gagal menyimpan kuis.');
    } finally {
        hideLoading();
    }
};

// Fungsi untuk memuat data kuis yang sudah ada
const loadQuiz = async (quizId) => {
    showLoading('Memuat kuis...');
    const docRef = doc(db, `artifacts/${appId}/public/data/lms_quizzes`, quizId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('quiz-title-input').value = data.title;
        document.getElementById('quiz-duration').value = data.duration;
        document.getElementById('quiz-description-input').value = data.description;
        document.getElementById('quiz-title').textContent = data.title;

        questionsContainer.innerHTML = '';
        data.questions.forEach(q => {
            addQuestion(q.type);
            const newItem = questionsContainer.lastElementChild;
            newItem.querySelector('.question-text').value = q.text;
            if (q.type === 'mc') {
                newItem.querySelectorAll('.option-text').forEach((opt, index) => {
                    opt.value = q.options[index];
                });
                if (q.answer) {
                    newItem.querySelector(`.correct-answer-radio[value="${q.answer}"]`).checked = true;
                }
            }
        });
    } else {
        console.warn("Kuis tidak ditemukan.");
    }
    hideLoading();
};


// --- Inisialisasi Halaman ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            currentQuizId = urlParams.get('quizId');
            currentMapelId = urlParams.get('mapelId');

            if (currentQuizId) {
                loadQuiz(currentQuizId);
            } else if (!currentMapelId) {
                alert('ID Mata Pelajaran tidak ditemukan. Silakan kembali ke LMS.');
                document.getElementById('app-container').innerHTML = '<p class="text-red-500 text-center">Error: ID Mata Pelajaran tidak valid.</p>';
            }
        } else {
            // Redirect ke halaman login jika belum login
            window.location.href = 'index.html';
        }
    });

    document.getElementById('btn-add-mc').addEventListener('click', () => addQuestion('mc'));
    document.getElementById('btn-add-essay').addEventListener('click', () => addQuestion('essay'));
    document.getElementById('btn-save-quiz').addEventListener('click', saveQuiz);
});