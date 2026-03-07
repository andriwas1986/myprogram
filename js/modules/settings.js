// js/modules/settings.js

import { showLoading, hideLoading } from '../ui.js';
import { saveSettings, getAcademicScores } from '../firestore-service.js';
// [BARU] Import modul petikan settings yang terpisah
import { initPetikanSettingsModule } from './settings_petikan.js';

// --- ELEMEN-ELEMEN DOM ---
let recaptchaForm, siteKeyInput, secretKeyInput, recaptchaKeysContainer;
let elibraryForm, apiKeyInput, folderIdInput;
let transcriptForm;
let tsInputs = {};

// --- Elemen DOM untuk Verifikasi ---
let verificationMethodRadios = [];
let cloudflareKeysContainer, cloudflareSiteKeyInput, cloudflareSecretKeyInput;


// --- STATE LOKAL ---
let localStudents = [];
let localMapels = [];
const DEFAULT_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/id/thumb/8/88/Logo_Pataka_Korps_Airud.png/375px-Logo_Pataka_Korps_Airud.png';

// Flag untuk mencegah loop pada ResizeObserver
let isScaling = false;

// --- FUNGSI HELPER ---
const terbilang = (n) => {
    if (n === null || typeof n === 'undefined' || isNaN(n)) return '';
    const angka = ["", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN", "SEPULUH", "SEBELAS"];
    let num = Math.round(n);
    if (num < 12) return angka[num];
    if (num < 20) return terbilang(num - 10) + " BELAS";
    if (num < 100) return (terbilang(Math.floor(num / 10)) + " PULUH " + terbilang(num % 10)).trim();
    if (num < 200) return "SERATUS " + terbilang(num - 100);
    if (num < 1000) return terbilang(Math.floor(num / 100)) + " RATUS " + terbilang(num % 100);
    if (num < 2000) return "SERIBU " + terbilang(num - 1000);
    if (num < 1000000) return terbilang(Math.floor(num / 1000)) + " RIBU " + terbilang(num % 1000);
    return "..."
};

const terbilangKoma = (n) => {
    if (n === null || typeof n === 'undefined' || isNaN(n)) return '';
    const numStr = n.toFixed(2).replace('.', ',');
    const [bulat, desimal] = numStr.split(',');
    let hasil = terbilang(parseInt(bulat)).trim();
    const desimalInt = parseInt(desimal);
    if (desimalInt > 0) {
        hasil += " KOMA " + terbilang(desimalInt);
    }
    return hasil.trim();
};

// --- DATA SAMPLE GENERATOR ---
const getSampleData = async (mode) => {
    // MODE 1: DIKBANGUM SEKOLAH BINTARA POLISI (Rumus 4-4-2 & Ada Jasmani)
    if (mode === 'DIKBANGUM SEKOLAH BINTARA POLISI') {
        const sbpStudent = {
            nama: "BHAYANGKARA SATU",
            pangkat: "BRIPDA",
            nrp: "12345678",
            nosis: "202601001",
            noIjazah: "DIKBANGUM.SBP/001/II/2026",
            noSeri: "SR-998877",
            kategori: "DIKBANGUM SEKOLAH BINTARA POLISI",
            detailPendidikan: "GELOMBANG I",
            tahunAjaran: 2026
        };

        const sbpMapels = [
            { kode: 'MP01', nama: "FUNGSI TEKNIS POLAIRUD", nilai: 80 },
            { kode: 'MP02', nama: "HUKUM LAUT INTERNASIONAL", nilai: 82 },
            { kode: 'MP03', nama: "SAR DAN SELAM POLRI", nilai: 78 },
            { kode: 'MP04', nama: "NAVIGASI DAN PERKAPALAN", nilai: 85 },
            { kode: 'MP05', nama: "KOMUNIKASI ELEKTRONIKA", nilai: 79 }
        ];

        // Nilai Dummy SBP
        const rerataAkademik = 80.80;
        const totalNilaiAkademik = 404;
        const rerataKepribadian = 81.50;
        const rerataJasmani = 78.00; // Ada nilai jasmani
        
        // Rumus 4-4-2: ((Akademik * 4) + (Mental * 4) + (Jasmani * 2)) / 10
        const nilaiAkhir = ((rerataAkademik * 4) + (rerataKepribadian * 4) + (rerataJasmani * 2)) / 10;

        return { 
            sampleStudent: sbpStudent, 
            sampleMapels: sbpMapels, 
            sampleRekap: { totalNilaiAkademik, rerataAkademik, rerataKepribadian, rerataJasmani, nilaiAkhir } 
        };
    } 
    
    // MODE DEFAULT: DIKBANGSPES (Tanpa Jasmani & Rumus 50:50)
    else {
        // Cek data lokal dulu
        let sampleStudent = localStudents.find(s => s.kategori === 'Dikbangspes' && s.noIjazah && s.noSeri);
        if (!sampleStudent) sampleStudent = localStudents.find(s => s.kategori === 'Dikbangspes');
        
        // Data Dummy Default Dikbangspes
        let defaultStudent = { 
            nama: 'ADITHYA PRANANDA', nosis: '12345', pangkat: 'BRIPDA', nrp: '04020064', 
            kategori: 'DIKBANGSPES', detailPendidikan: 'BINTARA SAR POLAIR GELOMBANG V', tahunAjaran: '2025', 
            noIjazah: 'NOMOR/IJAZAH/2025', noSeri: 'SERI/TRANSKRIP/2025' 
        };
        
        // Data Mapel Dummy
        let defaultMapels = [ 
            { kode: 'MP01', nama: 'PENGANTAR SAR POLAIR', nilai: 80 }, 
            { kode: 'MP02', nama: 'PENGANTAR PEMELIHARAAN DAN PERAWATAN', nilai: 78 }, 
            { kode: 'MP03', nama: 'PENGANTAR KEPOLISIAN', nilai: 82 }, 
            { kode: 'MP04', nama: 'TEKNIK SAR AIR', nilai: 85 }, 
            { kode: 'MP05', nama: 'PERTOLONGAN PERTAMA', nilai: 90 } 
        ];

        let totalNilaiAkademik = 415;
        let rerataAkademik = 83.00;
        let rerataKepribadian = 85.00;
        let rerataJasmani = 80; 

        // Gunakan data real jika ada
        if (sampleStudent) {
            try {
                const academicScores = await getAcademicScores(sampleStudent.id);
                const relevantMapels = localMapels
                    .filter(m => m.tahunAjaran === sampleStudent.tahunAjaran && m.kategori === sampleStudent.kategori && m.detailPendidikan === sampleStudent.detailPendidikan)
                    .map(mapel => ({ ...mapel, nilai: academicScores[mapel.id] ?? 0 }));
                
                if(relevantMapels.length > 0) {
                    defaultStudent = { ...sampleStudent, noIjazah: sampleStudent.noIjazah || 'NO/IJAZAH', noSeri: sampleStudent.noSeri || 'NO/SERI' };
                    defaultMapels = relevantMapels;
                    totalNilaiAkademik = relevantMapels.reduce((sum, m) => sum + m.nilai, 0);
                    rerataAkademik = totalNilaiAkademik / relevantMapels.length;
                    
                    const mentalList = sampleStudent.nilaiKepribadian || [];
                    if(mentalList.length > 0) rerataKepribadian = mentalList.reduce((a,b)=>a+b,0)/mentalList.length;
                }
            } catch (e) { console.log("Gagal load real data, pakai dummy"); }
        }

        // Rumus 50:50
        const nilaiAkhir = (rerataAkademik + rerataKepribadian) / 2;

        return { 
            sampleStudent: defaultStudent, 
            sampleMapels: defaultMapels, 
            sampleRekap: { totalNilaiAkademik, rerataAkademik, rerataKepribadian, rerataJasmani, nilaiAkhir } 
        };
    }
};

// --- FUNGSI GENERATE PREVIEW HTML ---
const generateModernTranscriptPreviewHTML = async (s, sampleData) => {
    const { sampleStudent, sampleMapels, sampleRekap } = sampleData;
    const peringkat = '1';
    const totalSiswa = '150';

    const paperClass = s.paperSize === 'folio' ? 'paper-folio' : 'paper-a4';
    const pageStyle = `font-family: ${s.fontFamily}, sans-serif; font-size: ${s.bodyFontSize}pt; padding: ${s.marginTop}cm ${s.marginRight}cm ${s.marginBottom}cm ${s.marginLeft}cm; background-color: white !important; color: #333;`;
    const logoUrl = s.logoUrl || DEFAULT_LOGO_URL;

    return `
    <div class="page ${paperClass}" style="${pageStyle}">
        <div style="display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="Logo" style="height: 70px; margin-right: 20px;">
            <div>
                <p style="font-size: 14pt; font-weight: bold; color: #003d80; margin: 0;">${s.headerLine1}</p>
                <p style="font-size: 12pt; margin: 0;">${s.headerLine2}</p>
            </div>
        </div>
        <div style="text-align: center; margin-bottom: 25px;">
            <p style="font-size: ${s.mainTitleSize}pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">TRANSKRIP AKADEMIK</p>
            <p style="margin: 2px 0 0;">Nomor Ijazah: ${sampleStudent.noIjazah}</p>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 20px; background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
            <div style="width: 60%;">
                <h3 style="font-size: 11pt; font-weight: bold; color: #0056b3; margin:0 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">DATA SISWA</h3>
                <table style="font-size: 10pt; width: 100%;">
                    <tr><td style="width: 120px; padding: 4px 0;">NAMA</td><td>: <strong>${sampleStudent.nama.toUpperCase()}</strong></td></tr>
                    <tr><td style="padding: 4px 0;">PANGKAT / NRP</td><td>: ${sampleStudent.pangkat} / ${sampleStudent.nrp}</td></tr>
                    <tr><td style="padding: 4px 0;">NO. SISWA</td><td>: ${sampleStudent.nosis}</td></tr>
                    <tr><td style="padding: 4px 0;">PENDIDIKAN</td><td>: ${sampleStudent.kategori} ${sampleStudent.detailPendidikan} (TA ${sampleStudent.tahunAjaran})</td></tr>
                </table>
            </div>
            <div style="width: 35%;">
                <h3 style="font-size: 11pt; font-weight: bold; color: #0056b3; margin:0 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">REKAPITULASI</h3>
                <table style="font-size: 10pt; width: 100%;">
                    <tr><td style="padding: 4px 0;">KEPRIBADIAN</td><td style="text-align: right;"><strong>${sampleRekap.rerataKepribadian.toFixed(2)}</strong></td></tr>
                    <tr><td style="padding: 4px 0;">AKADEMIK</td><td style="text-align: right;"><strong>${sampleRekap.rerataAkademik.toFixed(2)}</strong></td></tr>
                    ${sampleStudent.kategori !== 'DIKBANGSPES' && sampleStudent.kategori !== 'Dikbangspes' ? `<tr><td style="padding: 4px 0;">JASMANI</td><td style="text-align: right;"><strong>${sampleRekap.rerataJasmani.toFixed(2)}</strong></td></tr>` : ''}
                    <tr style="border-top:1px solid #ccc;"><td style="padding: 4px 0;"><strong>NILAI AKHIR</strong></td><td style="text-align: right;"><strong>${sampleRekap.nilaiAkhir.toFixed(2)}</strong></td></tr>
                    <tr><td style="padding-top: 8px; border-top: 1px solid #ccc;"><strong>PERINGKAT</strong></td><td style="padding-top: 8px; text-align: right; border-top: 1px solid #ccc;"><strong>${peringkat} dari ${totalSiswa} Siswa</strong></td></tr>
                </table>
            </div>
        </div>
        <h3 style="font-size: 11pt; font-weight: bold; color: #0056b3; margin:0 0 10px;">DAFTAR NILAI MATA PELAJARAN</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: ${s.tableBodySize}pt;">
            <thead style="background-color: #0056b3; color: white; font-size: ${s.tableHeaderSize}pt;">
                <tr><th style="padding: 8px; text-align: center; border: 1px solid #004a99;">NO</th><th style="padding: 8px; text-align: left; border: 1px solid #004a99;">MATA PELAJARAN</th><th style="padding: 8px; text-align: center; border: 1px solid #004a99;">NILAI</th><th style="padding: 8px; text-align: left; border: 1px solid #004a99;">TERBILANG</th></tr>
            </thead>
            <tbody>
                ${sampleMapels.map((mapel, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f8f9fa'};"><td style="border: 1px solid #dee2e6; padding: 6px; text-align: center;">${index + 1}</td><td style="border: 1px solid #dee2e6; padding: 6px;">${mapel.nama}</td><td style="border: 1px solid #dee2e6; padding: 6px; text-align: center;">${mapel.nilai}</td><td style="border: 1px solid #dee2e6; padding: 6px;">${terbilang(mapel.nilai)}</td></tr>
                `).join('')}
            </tbody>
            <tfoot style="font-weight: bold;">
                <tr><td colspan="2" style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">JUMLAH</td><td style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">${sampleRekap.totalNilaiAkademik.toFixed(0)}</td><td style="border: 1px solid #dee2e6; padding: 8px;">${terbilang(sampleRekap.totalNilaiAkademik)}</td></tr>
            </tfoot>
        </table>
        <div style="padding-top: 3rem; display: flex; justify-content: space-between; font-size: 11pt;">
            <div style="width:45%; text-align:center;">${s.signer1Title.split('|').map(l => `<p style="margin:0;">${l}</p>`).join('')}<div style="height:80px;"></div><p style="margin: 0; font-weight:bold;"><u>${s.signer1Name}</u></p><p style="margin: 0;">${s.signer1Id}</p></div>
            <div style="width:45%; text-align:center;">${s.signer2Title.split('|').map(l => `<p style="margin:0;">${l}</p>`).join('')}<div style="height:80px;"></div><p style="margin: 0; font-weight:bold;"><u>${s.signer2Name}</u></p><p style="margin: 0;">${s.signer2Id}</p></div>
        </div>
    </div>`;
};

const generateClassicTranscriptPreviewHTML = async (s, sampleData) => {
    const { sampleStudent, sampleMapels, sampleRekap } = sampleData;
    const peringkat = '1';
    const totalSiswa = '30';
    const paperClass = s.paperSize === 'folio' ? 'paper-folio' : 'paper-a4';
    const pageStyle = `font-family: ${s.fontFamily || 'Calibri'}, sans-serif; font-size: ${s.bodyFontSize || 10}pt; padding: ${s.marginTop || 1.3}cm ${s.marginRight || 1.9}cm ${s.marginBottom || 2.54}cm ${s.marginLeft || 1.9}cm; background-color: white !important;`;
    const headerLineHtml = s.headerLineShow ? `<div style="border-bottom: 1pt solid black; width: ${s.headerLineWidth}%; margin-top: 1px;"></div>` : '';
    const thStyle = `padding: ${s.tableRowPadding}pt 2pt; border: 1pt solid black; color: ${s.tableHeaderText};`;
    
    // [UPDATE] MENGHAPUS .toUpperCase() agar bisa huruf kecil/mix
    const signer1TitleHtml = (s.signer1Title || '').split('|').map(line => `<p style="margin: 0;">${line}</p>`).join('');
    const signer2TitleHtml = (s.signer2Title || '').split('|').map(line => `<p style="margin: 0;">${line}</p>`).join('');

    // --- LOGIKA BARU: Fallback untuk Penanda Tangan Lampiran II ---
    const signerL2Name = s.signerL2Name || s.signer2Name; 
    const signerL2Id = s.signerL2Id || s.signer2Id;
    const signerL2Title = s.signerL2Title || s.signer2Title;
    const signerL2Top = s.signerL2Top || s.signer2Top;
    const signerL2Left = s.signerL2Left || s.signer2Left;
    const signerL2LineWidth = s.signerL2LineWidth || s.signer2LineWidth;

    // [UPDATE] MENGHAPUS .toUpperCase()
    const signerL2TitleHtml = (signerL2Title || '').split('|').map(line => `<p style="margin: 0;">${line}</p>`).join('');

    const infoBlockStyle = `position: relative; top: ${s.infoBlockTop}px; left: ${s.infoBlockLeft}px;`;
    const signer1BlockStyle = `width:45%; text-align:center; position: relative; top: ${s.signer1Top}px; left: ${s.signer1Left}px;`;
    const signer2BlockStyle = `width:45%; text-align:center; position: relative; top: ${s.signer2Top}px; left: ${s.signer2Left}px;`;
    const signerL2BlockStyle = `width:45%; text-align:center; position: relative; top: ${signerL2Top}px; left: ${signerL2Left}px;`;
    
    const signer1LineWidthStyle = s.signer1LineWidth ? `width: ${s.signer1LineWidth}px;` : '';
    const signer2LineWidthStyle = s.signer2LineWidth ? `width: ${s.signer2LineWidth}px;` : '';
    const signerL2LineWidthStyle = signerL2LineWidth ? `width: ${s.signerL2LineWidth}px;` : '';
    
    const lampiran1 = `
      <div class="page ${paperClass}" style="${pageStyle}">
        <div style="font-family: 'Calibri', sans-serif; font-size: 12pt; font-weight:bold; line-height: 1.2;">
            <p style="margin: 0; padding: 0;">${s.headerLine1}</p>
            <p style="margin: 0; padding: 0 0 0 30px;">${s.headerLine2}</p>
        </div>
        ${headerLineHtml}
        <div style="display: flex; justify-content: center; margin-top: 2px;"><div style="font-weight: bold; font-size:12pt; text-decoration: underline; margin:0;">LAMPIRAN I</div></div>
        <div style="${infoBlockStyle}">
            <div style="display: flex; justify-content: flex-end; margin-top: 5px; font-size: 11pt;">
                <table style="border-collapse:collapse; line-height: 1.2;">
                    <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NO IJAZAH</td><td style="vertical-align: top;">: ${sampleStudent.noIjazah}</td></tr>
                    <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NAMA</td><td style="vertical-align: top;">: ${sampleStudent.nama.toUpperCase()}</td></tr>
                    <tr><td style="padding: 0 8px 0 0; vertical-align: top;">PANGKAT / NRP</td><td style="vertical-align: top;">: ${sampleStudent.pangkat} / ${sampleStudent.nrp}</td></tr>
                    <tr><td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td><td style="vertical-align: top; max-width: 350px;"><div style="display: flex; align-items: flex-start;"><span style="white-space: pre;">: </span><div style="line-height: 1.2;"><span>${(sampleStudent.kategori + ' ' + sampleStudent.detailPendidikan).toUpperCase()}</span><br><span>TA.${sampleStudent.tahunAjaran}</span></div></div></td></tr>
                </table>
            </div>
        </div>
        <div style="text-align:center; margin-top: 0.5rem;"><p style="font-weight:bold; text-decoration:underline; font-size: ${s.mainTitleSize}pt; margin:0;">DAFTAR NILAI AKADEMIK</p><p style="font-size: ${s.subTitleSize}pt; margin:0;">(TRANSKRIP)</p></div>
        <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${sampleStudent.noSeri}</p>
        <table style="width:100%; border-collapse: collapse; font-size:${s.tableBodySize}pt; text-transform: uppercase;">
            <thead style="background-color:${s.tableHeaderBg}; font-size:${s.tableHeaderSize}pt; text-align:center; font-weight: bold;">
                <tr style="height: auto;"><th rowspan="2" style="${thStyle} width: 5%;">NO</th><th rowspan="2" style="${thStyle} width: 50%;">MATA PELAJARAN</th><th colspan="2" style="${thStyle}">NILAI</th></tr>
                <tr style="height: auto;"><th style="${thStyle} width: 15%;">ANGKA</th><th style="${thStyle} width: 30%;">HURUF</th></tr>
                <tr style="height: auto; text-align: center; font-size: ${s.tableBodySize}pt; font-weight: normal;"><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">1</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">2</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">3</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">4</td></tr>
            </thead>
            <tbody>${sampleMapels.map((mapel, index) => `<tr style="height: auto;"><td style="padding: ${s.tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black; border-right: 1pt solid black; vertical-align: top;">${index + 1}</td><td style="padding: ${s.tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${mapel.nama.toUpperCase()}</td><td style="padding: ${s.tableRowPadding}pt 2pt; text-align:center; border-right: 1pt solid black; vertical-align: top;">${mapel.nilai}</td><td style="padding: ${s.tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${terbilang(mapel.nilai).toUpperCase()}</td></tr>`).join('')}</tbody>
            <tfoot><tr style="height: auto;"><td colspan="2" style="padding: ${s.tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">JUMLAH</td><td style="padding: ${s.tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">${sampleRekap.totalNilaiAkademik.toFixed(0)}</td><td style="padding: ${s.tableRowPadding}pt 2pt; font-weight:bold; text-align:left; border: 1pt solid black;">${terbilang(sampleRekap.totalNilaiAkademik).toUpperCase()}</td></tr></tfoot>
        </table>
        <div style="padding-top:2rem; display:flex; justify-content:space-between; font-size:11pt; line-height: 1.2;">
            <div style="${signer1BlockStyle}">${signer1TitleHtml}<div style="height:80px;"></div><div style="display: inline-block; ${signer1LineWidthStyle}"><p style="margin: 0; font-weight:bold;">${s.signer1Name}</p><div style="border-top: 1pt solid black; margin-top: 2px;"></div></div><p style="margin: 0;">${s.signer1Id}</p></div>
            <div style="${signer2BlockStyle}">${signer2TitleHtml}<div style="height:80px;"></div><div style="display: inline-block; ${signer2LineWidthStyle}"><p style="margin: 0; font-weight:bold;">${s.signer2Name}</p><div style="border-top: 1pt solid black; margin-top: 2px;"></div></div><p style="margin: 0;">${s.signer2Id}</p></div>
        </div>
      </div>`;
    
    // [UPDATE] REKAPITULASI DENGAN MERGE CELL SEMUA KOLOM + LEBAR ATAS BAWAH (PADDING 10pt)
    // Tampilan preview di Setting disesuaikan dengan transkrip.js terbaru
    const tdStyleRekap = `padding: 10pt 5pt; border: 1pt solid black;`;

    let rekapBody = `
        <tr style="height: auto;">
            <td colspan="2" style="${tdStyleRekap} text-align:left;">I. MENTAL KEPRIBADIAN</td>
            <td style="${tdStyleRekap} text-align:center;">${sampleRekap.rerataKepribadian.toFixed(2).replace('.', ',')}</td>
            <td style="${tdStyleRekap} text-align:left;">${terbilangKoma(sampleRekap.rerataKepribadian).toUpperCase()}</td>
        </tr>
        <tr style="height: auto;">
            <td colspan="2" style="${tdStyleRekap} text-align:left;">II. AKADEMIK</td>
            <td style="${tdStyleRekap} text-align:center;">${sampleRekap.rerataAkademik.toFixed(2).replace('.', ',')}</td>
            <td style="${tdStyleRekap} text-align:left;">${terbilangKoma(sampleRekap.rerataAkademik).toUpperCase()}</td>
        </tr>`;

    if (sampleStudent.kategori !== 'DIKBANGSPES' && sampleStudent.kategori !== 'Dikbangspes') {
        rekapBody += `
        <tr style="height: auto;">
            <td colspan="2" style="${tdStyleRekap} text-align:left;">III. KESEHATAN JASMANI</td>
            <td style="${tdStyleRekap} text-align:center;">${sampleRekap.rerataJasmani.toFixed(2).replace('.', ',')}</td>
            <td style="${tdStyleRekap} text-align:left;">${terbilangKoma(sampleRekap.rerataJasmani).toUpperCase()}</td>
        </tr>
        <tr style="height: auto; font-weight: bold;">
            <td colspan="2" style="${tdStyleRekap} text-align:center;">NILAI AKHIR</td>
            <td style="${tdStyleRekap} text-align:center;">${sampleRekap.nilaiAkhir.toFixed(2).replace('.', ',')}</td>
            <td style="${tdStyleRekap} text-align:left;">${terbilangKoma(sampleRekap.nilaiAkhir).toUpperCase()}</td>
        </tr>`;
    } else {
        rekapBody += `
        <tr style="height: auto; font-weight: bold;">
            <td colspan="2" style="${tdStyleRekap} text-align:center;">NILAI AKHIR</td>
            <td style="${tdStyleRekap} text-align:center;">${sampleRekap.nilaiAkhir.toFixed(2).replace('.', ',')}</td>
            <td style="${tdStyleRekap} text-align:left;">${terbilangKoma(sampleRekap.nilaiAkhir).toUpperCase()}</td>
        </tr>`;
    }

    const lampiran2 = `
      <div class="page ${paperClass}" style="${pageStyle}">
        <div style="font-family: 'Calibri', sans-serif; font-size: 12pt; font-weight:bold; line-height: 1.1;"><p style="margin: 0; padding: 0;">${s.headerLine1}</p><p style="margin: 0; padding: 0 0 0 30px;">${s.headerLine2}</p></div>
        ${headerLineHtml}
        <div style="display: flex; justify-content: center; margin-top: 2px;"><div style="font-weight: bold; font-size:12pt; text-decoration: underline;">LAMPIRAN II</div></div>
        <div style="${infoBlockStyle}"><div style="display: flex; justify-content: flex-end; margin-top: 5px; font-size:11pt;"><table style="border-collapse:collapse; line-height: 1.2;"><tr><td style="padding: 0 8px 0 0;">NO IJAZAH</td><td>: ${sampleStudent.noIjazah}</td></tr><tr><td style="padding: 0 8px 0 0;">NAMA</td><td>: ${sampleStudent.nama.toUpperCase()}</td></tr><tr><td style="padding: 0 8px 0 0;">PANGKAT / NRP</td><td>: ${sampleStudent.pangkat} / ${sampleStudent.nrp}</td></tr><tr><td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td><td style="vertical-align: top; max-width: 350px;"><div style="display: flex; align-items: flex-start;"><span style="white-space: pre;">: </span><div style="line-height: 1.2;"><span>${(sampleStudent.kategori + ' ' + sampleStudent.detailPendidikan).toUpperCase()}</span><br><span>TA.${sampleStudent.tahunAjaran}</span></div></div></td></tr></table></div></div>
        <div style="text-align:center; margin-top: 0.7rem;"><p style="font-weight:bold; text-decoration:underline; font-size: 12pt; margin:0;">REKAPITULASI NILAI</p></div>
        <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${sampleStudent.noSeri}</p>
        <table style="width:100%; border-collapse: collapse; font-size:${s.tableBodySize}pt; text-transform: uppercase;">
            <thead style="background-color:${s.tableHeaderBg}; font-size:${s.tableHeaderSize}pt; text-align:center; font-weight:bold;">
                <tr><th rowspan="2" style="${thStyle}">NO</th><th rowspan="2" style="${thStyle}">ASPEK YANG DINILAI</th><th colspan="2" style="${thStyle}">NILAI</th></tr>
                <tr><th style="${thStyle}">ANGKA</th><th style="${thStyle}">HURUF</th></tr>
                <tr style="height: auto; text-align: center; font-size: ${s.tableBodySize}pt; font-weight: normal;"><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">1</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">2</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">3</td><td style="padding: 0 2pt; border: 1pt solid black; color: ${s.tableHeaderText};">4</td></tr>
            </thead>
            <tbody>${rekapBody}<tr style="height: auto;"><td colspan="4" style="border: 1pt solid black; padding: 2pt; text-align: left;">PERINGKAT KE : ${peringkat} DARI ${totalSiswa} SISWA</td></tr></tbody>
        </table>
        <div style="padding-top:2rem; display: flex; justify-content: flex-end; font-size:11pt; line-height: 1.2;">
            <div style="${signerL2BlockStyle}">
                ${signerL2TitleHtml}
                <div style="height:80px;"></div>
                <div style="display: inline-block; ${signerL2LineWidthStyle}">
                    <p style="margin: 0; font-weight:bold;">${signerL2Name}</p>
                    <div style="border-top: 1pt solid black; margin-top: 2px;"></div>
                </div>
                <p style="margin: 0;">${signerL2Id}</p>
            </div>
        </div>
      </div>`;
    return lampiran1 + lampiran2;
};

// --- FUNGSI PENYESUAIAN UKURAN PRATINJAU ---
const scalePreview = () => {
    if (isScaling) return; 
    isScaling = true;

    const previewWrapper = document.getElementById('transcript-preview-wrapper');
    const preview = document.getElementById('transcript-preview');
    const firstPage = preview ? preview.querySelector('.page') : null;

    if (!preview || !previewWrapper || !firstPage) {
        isScaling = false;
        return;
    }

    setTimeout(() => {
        const containerWidth = previewWrapper.clientWidth;
        const pageNaturalWidth = 210 * 3.78; // Approx width of A4 in px (at standard DPI)
        const horizontalPadding = 34; 

        if (containerWidth > 0 && pageNaturalWidth > (containerWidth - horizontalPadding)) {
            const scale = (containerWidth - horizontalPadding) / pageNaturalWidth;
            // Limit scaling to sensible max
            const finalScale = Math.min(scale, 1.2); 
            
            preview.style.transform = `scale(${finalScale})`;
            preview.style.transformOrigin = 'top center';
            
            const totalHeight = Array.from(preview.querySelectorAll('.page')).reduce((acc, page) => acc + page.offsetHeight, 0);
            previewWrapper.style.height = `${(totalHeight * finalScale) + 50}px`;
        } else {
            preview.style.transform = '';
            const totalHeight = Array.from(preview.querySelectorAll('.page')).reduce((acc, page) => acc + page.offsetHeight, 0);
            previewWrapper.style.height = `${totalHeight + 50}px`;
        }
        
        setTimeout(() => { isScaling = false; }, 100);

    }, 50); 
};

const updateTranscriptPreview = async () => {
    const preview = document.getElementById('transcript-preview');
    if (!preview) return;

    const s = {};
    for (const key in tsInputs) {
        if (tsInputs[key]) {
            s[key] = tsInputs[key].type === 'checkbox' ? tsInputs[key].checked : tsInputs[key].value;
        }
    }

    // [BARU] Ambil Mode Preview dari Dropdown (Jika ada)
    const previewModeInput = document.getElementById('ts-preview-mode');
    const selectedMode = previewModeInput ? previewModeInput.value : 'Dikbangspes';

    const sampleData = await getSampleData(selectedMode);
    
    if (s.template === 'modern') {
        preview.innerHTML = await generateModernTranscriptPreviewHTML(s, sampleData);
    } else {
        preview.innerHTML = await generateClassicTranscriptPreviewHTML(s, sampleData);
    }
    
    scalePreview(); 
};

const updateVerificationView = () => {
    const selectedMethod = document.querySelector('input[name="verification_method"]:checked')?.value || 'none';
    
    if (recaptchaKeysContainer) {
        recaptchaKeysContainer.style.display = (selectedMethod === 'recaptcha') ? 'block' : 'none';
    }
    if (cloudflareKeysContainer) {
        cloudflareKeysContainer.style.display = (selectedMethod === 'cloudflare') ? 'block' : 'none';
    }
};

// --- FUNGSI POPULASI FORM ---
const populateSettingsForm = (settingsData) => {
    
    // 1. Verifikasi
    if (settingsData?.verification) {
        const v = settingsData.verification;
        const method = v.method || 'none';
        const radio = document.getElementById(`verification-method-${method}`);
        if (radio) radio.checked = true;

        if (v.recaptcha) {
            siteKeyInput.value = v.recaptcha.siteKey || '';
            secretKeyInput.value = v.recaptcha.secretKey || '';
        }
        if (v.cloudflare) {
            cloudflareSiteKeyInput.value = v.cloudflare.siteKey || '';
            cloudflareSecretKeyInput.value = v.cloudflare.secretKey || '';
        }
    } else {
        const radioNone = document.getElementById('verification-method-none');
        if (radioNone) radioNone.checked = true;
    }
    updateVerificationView();

    // 2. E-Library
    if (settingsData?.elibrary) {
        apiKeyInput.value = settingsData.elibrary.apiKey || '';
        folderIdInput.value = settingsData.elibrary.folderId || '';
    }

    // 3. Transkrip
    if (settingsData?.transcript) {
        const ts = settingsData.transcript;
        for (const key in ts) {
            if (tsInputs[key]) {
                if (tsInputs[key].type === 'checkbox') {
                    tsInputs[key].checked = ts[key];
                } else {
                    tsInputs[key].value = ts[key];
                }
            }
        }
    }

    updateTranscriptPreview();
};

const handleTranscriptFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan Transkrip...');
    const transcriptData = {};
    for (const key in tsInputs) {
        if (tsInputs[key]) { 
            if (tsInputs[key].type === 'checkbox') {
                transcriptData[key] = tsInputs[key].checked;
            } else {
                transcriptData[key] = tsInputs[key].value;
            }
        }
    }
    try {
        await saveSettings({ transcript: transcriptData });
        alert('Pengaturan Transkrip berhasil disimpan!');
    } catch (error) {
        console.error("Gagal menyimpan pengaturan transkrip:", error);
        alert('Gagal menyimpan pengaturan transkrip.');
    } finally {
        hideLoading();
    }
};

const handleVerificationFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan Verifikasi...');
    
    const settingsData = {
        verification: {
            method: document.querySelector('input[name="verification_method"]:checked')?.value || 'none',
            recaptcha: {
                siteKey: siteKeyInput.value.trim(),
                secretKey: secretKeyInput.value.trim()
            },
            cloudflare: {
                siteKey: cloudflareSiteKeyInput.value.trim(),
                secretKey: cloudflareSecretKeyInput.value.trim()
            }
        }
    };
    
    try {
        await saveSettings(settingsData);
        alert('Pengaturan Verifikasi berhasil disimpan!');
    } catch (error) {
        console.error("Gagal menyimpan pengaturan:", error);
        alert('Gagal menyimpan pengaturan.');
    } finally {
        hideLoading();
    }
};

const handleELibraryFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan E-Library...');
    const settingsData = {
        elibrary: {
            apiKey: apiKeyInput.value.trim(),
            folderId: folderIdInput.value.trim()
        }
    };
    try {
        await saveSettings(settingsData);
        alert('Pengaturan E-Library berhasil disimpan! Halaman akan dimuat ulang.');
        location.reload(); 
    } catch (error) {
        console.error("Gagal menyimpan pengaturan E-Library:", error);
        alert('Gagal menyimpan pengaturan E-Library.');
    } finally {
        hideLoading();
    }
};

const setupTabs = () => {
    const tabs = document.querySelectorAll('.setting-tab');
    const tabContents = document.querySelectorAll('.setting-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => {
                t.classList.remove('active-tab');
                t.classList.add('inactive-tab');
            });
            tab.classList.add('active-tab');
            tab.classList.remove('inactive-tab');
            tabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== `tab-content-${target}`);
            });
            
            // [MODIFIKASI] Event Trigger untuk masing-masing module
            if (target === 'transcript') {
                updateTranscriptPreview();
            } else if (target === 'petikan') {
                // Memicu event resize global agar modul Petikan (yang terpisah) bisa merespons
                window.dispatchEvent(new Event('resize')); 
            }
        });
    });
};

export const initSettingsModule = (settingsData, studentsData, mapelsData) => {
    localStudents = studentsData || [];
    localMapels = mapelsData || [];

    if (window.settingsModuleInitialized) {
        populateSettingsForm(settingsData);
        return;
    }
    
    setupTabs();

    // [MODIFIKASI UTAMA] INIT PETIKAN MODULE (Terpisah)
    initPetikanSettingsModule(settingsData);

    // --- Init Elemen Verifikasi ---
    recaptchaForm = document.getElementById('settings-recaptcha-form');
    siteKeyInput = document.getElementById('recaptcha-site-key');
    secretKeyInput = document.getElementById('recaptcha-secret-key');
    recaptchaKeysContainer = document.getElementById('recaptcha-keys-container');
    
    verificationMethodRadios = document.querySelectorAll('input[name="verification_method"]');
    cloudflareKeysContainer = document.getElementById('cloudflare-keys-container');
    cloudflareSiteKeyInput = document.getElementById('cloudflare-site-key');
    cloudflareSecretKeyInput = document.getElementById('cloudflare-secret-key');

    // --- Init Elemen Lain ---
    elibraryForm = document.getElementById('settings-elibrary-form');
    apiKeyInput = document.getElementById('elibrary-api-key');
    folderIdInput = document.getElementById('elibrary-folder-id');
    transcriptForm = document.getElementById('settings-transcript-form');

    // Listener Radio Button Verifikasi
    if (verificationMethodRadios.length > 0) {
        verificationMethodRadios.forEach(radio => {
            radio.addEventListener('change', updateVerificationView);
        });
    }

    // Listener Form Transkrip
    if (transcriptForm) {
        
        // [BARU] Init Input Dropdown Preview (ts-preview-mode)
        const previewModeSelect = document.getElementById('ts-preview-mode');
        if (previewModeSelect) {
            previewModeSelect.addEventListener('change', updateTranscriptPreview);
        }

        tsInputs = {
            template: document.getElementById('transcript-template'),
            logoUrl: document.getElementById('ts-logo-url'),
            headerLine1: document.getElementById('ts-header-line1'),
            headerLine2: document.getElementById('ts-header-line2'),
            headerLineShow: document.getElementById('ts-header-line-show'),
            headerLineWidth: document.getElementById('ts-header-line-width'),
            mainTitleSize: document.getElementById('ts-main-title-size'),
            subTitleSize: document.getElementById('ts-sub-title-size'),
            bodyFontSize: document.getElementById('ts-body-font-size'),
            infoBlockTop: document.getElementById('ts-info-block-top'),
            infoBlockLeft: document.getElementById('ts-info-block-left'),
            tableHeaderBg: document.getElementById('ts-table-header-bg'),
            tableHeaderText: document.getElementById('ts-table-header-text'),
            tableHeaderSize: document.getElementById('ts-table-header-size'),
            tableBodySize: document.getElementById('ts-table-body-size'),
            tableRowPadding: document.getElementById('ts-table-row-padding'),
            signer1Name: document.getElementById('ts-signer1-name'),
            signer1Id: document.getElementById('ts-signer1-id'),
            signer1Title: document.getElementById('ts-signer1-title'),
            signer2Name: document.getElementById('ts-signer2-name'),
            signer2Id: document.getElementById('ts-signer2-id'),
            signer2Title: document.getElementById('ts-signer2-title'),
            signer1Top: document.getElementById('ts-signer1-top'),
            signer1Left: document.getElementById('ts-signer1-left'),
            signer1LineWidth: document.getElementById('ts-signer1-line-width'),
            signer2Top: document.getElementById('ts-signer2-top'),
            signer2Left: document.getElementById('ts-signer2-left'),
            signer2LineWidth: document.getElementById('ts-signer2-line-width'),
            
            // Lampiran II
            signerL2Name: document.getElementById('ts-signerL2-name'),
            signerL2Id: document.getElementById('ts-signerL2-id'),
            signerL2Title: document.getElementById('ts-signerL2-title'),
            signerL2Top: document.getElementById('ts-signerL2-top'),
            signerL2Left: document.getElementById('ts-signerL2-left'),
            signerL2LineWidth: document.getElementById('ts-signerL2-line-width'),
            
            fontFamily: document.getElementById('ts-font-family'),
            paperSize: document.getElementById('transcript-paper-size'),
            marginTop: document.getElementById('ts-margin-top'),
            marginBottom: document.getElementById('ts-margin-bottom'),
            marginLeft: document.getElementById('ts-margin-left'),
            marginRight: document.getElementById('ts-margin-right'),
        };

        Object.values(tsInputs).forEach(input => {
            if (input) input.addEventListener('input', updateTranscriptPreview);
        });

        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const arrow = header.querySelector('.accordion-arrow');
                content.classList.toggle('hidden');
                arrow.classList.toggle('rotate-180');
            });
        });
        
        const previewWrapper = document.getElementById('transcript-preview-wrapper');
        if (previewWrapper) {
            const resizeObserver = new ResizeObserver(scalePreview);
            resizeObserver.observe(previewWrapper);
        }
    }

    // --- ATTACH SUBMIT HANDLERS ---
    if (recaptchaForm) recaptchaForm.addEventListener('submit', handleVerificationFormSubmit);
    if (elibraryForm) elibraryForm.addEventListener('submit', handleELibraryFormSubmit);
    if (transcriptForm) transcriptForm.addEventListener('submit', handleTranscriptFormSubmit);
    
    populateSettingsForm(settingsData);
    window.settingsModuleInitialized = true;
};