// public/js/modules/preview_siswa_transkrip.js

import { showLoading, hideLoading, openModal, closeModal } from '../ui.js';
import { getAcademicScores } from '../firestore-service.js';

let localStudents = [];
let localMapels = [];
let localTahunAjaran = [];
let localSettings = {}; 
let currentUser = {};
const DEFAULT_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/id/thumb/8/88/Logo_Pataka_Korps_Airud.png/375px-Logo_Pataka_Korps_Airud.png';

const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return '-';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
};

const getNilaiKepribadianDebug = (siswa) => {
    if (!siswa) return 0;

    if (siswa.kategori === 'Dikbangspes') {
        const nilaiList = siswa.nilaiKepribadian || [];
        const validNilaiList = nilaiList.filter(n => n !== null && n !== undefined && !isNaN(parseFloat(n)));
        const nilaiInstruktur = validNilaiList.length > 0 ? parseFloat(validNilaiList[validNilaiList.length - 1]) : 0;
        const nilaiSosiometri = parseFloat(siswa.nilaiSosiometri) || 0;
        const nilaiAkhir = (nilaiInstruktur * 0.7) + (nilaiSosiometri * 0.3);
        return nilaiAkhir;
    }

    const data = siswa.nilaiKepribadian;
    if (Array.isArray(data)) {
        const validData = data.filter(n => n !== null && n !== undefined && !isNaN(parseFloat(n)));
        if (validData.length === 0) return 0;
        const sum = validData.reduce((a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0), 0);
        const avg = sum / validData.length;
        return avg;
    }

    return 0;
};

const calculateAllStudentRanks = async (studentGroup) => {
    if (!studentGroup || studentGroup.length === 0) {
        return {};
    }

    const studentScores = await Promise.all(studentGroup.map(async (siswa) => {
        const academicScores = await getAcademicScores(siswa.id);
        
        const relevantMapels = localMapels
            .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
            .map(mapel => academicScores[mapel.id] ?? 0);
        
        const totalNilaiAkademik = relevantMapels.reduce((a, b) => a + b, 0);
        const rerataAkademik_raw = relevantMapels.length > 0 ? (totalNilaiAkademik / relevantMapels.length) : 0;
        const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
        
        const rerataKepribadian = getNilaiKepribadianDebug(siswa);

        let finalScore = 0;
        if (siswa.kategori !== 'Dikbangspes') {
            const nilaiJasmaniList = siswa.nilaiJasmani || [];
            const rerataJasmani = nilaiJasmaniList.length > 0 ? (nilaiJasmaniList.reduce((a, b) => a + b, 0) / nilaiJasmaniList.length) : 0;
            finalScore = (rerataAkademik + rerataKepribadian + rerataJasmani) / 3;
        } else {
            finalScore = (rerataAkademik + rerataKepribadian) / 2;
        }

        return { studentId: siswa.id, finalScore };
    }));

    studentScores.sort((a, b) => b.finalScore - a.finalScore);

    const ranks = {};
    studentScores.forEach((score, index) => {
        ranks[score.studentId] = index + 1;
    });

    return ranks;
};

const downloadTranscriptAsPdf = () => {
    const printableElement = document.getElementById('printable-transcript');
    const siswaId = printableElement?.dataset?.siswaId;
    
    // [FIX] Gunakan fallback currentUser jika localStudents kosong
    let siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa && currentUser.id === siswaId) {
        siswa = currentUser;
    }
    
    if (siswaId && printableElement && siswa) {
        const printTitle = `Transkrip_${siswa.nama.replace(/\s/g, '_')}_${siswa.nosis}`;
        
        const printContent = printableElement.innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>${printTitle}</title>
                    <link rel="stylesheet" href="style.css"> 
                    <style>
                        body { margin: 0; }
                        @media print {
                            body { background-color: white; }
                            .page {
                                page-break-after: always;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `);
    
        printWindow.document.close();
        
        setTimeout(() => { 
            printWindow.focus();
            printWindow.print();
        }, 500); 
    } else {
        alert("Tidak dapat menemukan data siswa untuk membuat PDF.");
    }
};

const openTranskripModal = async (siswaId) => {
    const printContainer = document.getElementById('printable-transcript');
    const modernContainer = document.getElementById('modern-transcript-view'); 
    
    if (!printContainer || !modernContainer) {
        console.error("Elemen #printable-transcript atau #modern-transcript-view tidak ditemukan.");
        return;
    }

    showLoading('Memuat data transkrip...');
    
    // [PERBAIKAN UTAMA] Cari di localStudents dulu, kalau kosong pakai currentUser (Alumni)
    let siswa = localStudents.find(s => s.id === siswaId);
    if (!siswa && currentUser.id === siswaId) {
        console.log("Data siswa tidak ditemukan di daftar global, menggunakan data sesi login (Alumni).");
        siswa = currentUser;
    }

    if (!siswa) {
        alert("Data siswa tidak ditemukan!");
        hideLoading();
        return;
    }
    
    printContainer.dataset.siswaId = siswaId; 

    // Cari teman seangkatan (untuk ranking) - Jika alumni, mungkin list ini kosong, jadi ranking 1/1
    const studentGroup = localStudents.filter(s => 
        s.kategori === siswa.kategori && 
        s.detailPendidikan === siswa.detailPendidikan && 
        s.tahunAjaran === siswa.tahunAjaran
    );

    let ranks = {};
    if (studentGroup.length > 0) {
        ranks = await calculateAllStudentRanks(studentGroup);
    } else {
        // Jika tidak ada data teman sekelas (mode alumni minimalis), ranking default 1
        ranks[siswa.id] = 1; 
    }
    
    const peringkatSiswa = ranks[siswa.id] || '-';
    const totalSiswaDiKelas = studentGroup.length || '-';

    const academicScores = await getAcademicScores(siswaId);
    
    // Gunakan mapel dari settings atau global, pastikan ada
    const relevantMapels = localMapels
        .filter(m => m.tahunAjaran === siswa.tahunAjaran && m.kategori === siswa.kategori && m.detailPendidikan === siswa.detailPendidikan)
        .map(mapel => ({ ...mapel, nilai: academicScores[mapel.id] ?? 0 }))
        .sort((a, b) => (a.kode || '').localeCompare(b.kode || '')); 

    const totalNilaiAkademik = relevantMapels.reduce((sum, m) => sum + m.nilai, 0);
    
    const rerataAkademik_raw = relevantMapels.length > 0 ? (totalNilaiAkademik / relevantMapels.length) : 0;
    const rerataAkademik = Math.floor(rerataAkademik_raw * 100) / 100;
    
    const rerataKepribadian = getNilaiKepribadianDebug(siswa);

    const nilaiJasmaniList = siswa.nilaiJasmani || [];
    const rerataJasmani = nilaiJasmaniList.length > 0 ? (nilaiJasmaniList.reduce((a, b) => a + b, 0) / nilaiJasmaniList.length) : 0;
    const rekap = { totalNilaiAkademik, rerataAkademik, rerataKepribadian, rerataJasmani };

    const printHTML = generateTranscriptHTML(siswa, relevantMapels, rekap, peringkatSiswa, totalSiswaDiKelas);
    printContainer.innerHTML = printHTML;

    populateModernTranscriptView(siswa, relevantMapels, rekap);
    
    hideLoading();
};

const populateModernTranscriptView = (siswa, mapels, rekap) => {
    const s = localSettings.transcript || {};
    const logoUrl = s.logoUrl || DEFAULT_LOGO_URL;
    
    const fotoProfil = siswa.fotoUrl || 'https://ik.imagekit.io/d3nxlzdjsu/PRESISI%20POLAIR.png?updatedAt=1760423288483';

    document.getElementById('modern-transkrip-foto').src = fotoProfil;
    document.getElementById('modern-transkrip-nama').textContent = siswa.nama;
    document.getElementById('modern-transkrip-kategori').textContent = `${siswa.kategori} ${siswa.detailPendidikan} (TA ${siswa.tahunAjaran})`;
    document.getElementById('modern-transkrip-nosis').textContent = siswa.nosis || '-';
    document.getElementById('modern-transkrip-nrp').textContent = siswa.nrp || '-';

    const modernLogo = document.getElementById('modern-transkrip-logo');
    if (modernLogo) modernLogo.src = logoUrl;
    const modernHeader1 = document.getElementById('modern-transkrip-header1');
    if (modernHeader1) modernHeader1.textContent = s.headerLine1 || ''; 
    const modernHeader2 = document.getElementById('modern-transkrip-header2');
    if (modernHeader2) modernHeader2.textContent = s.headerLine2 || ''; 

    const rekapBody = document.getElementById('modern-transkrip-rekap-body');
    let rekapHtml = `
        <tr class="border-b border-main"><td class="p-3">Kepribadian</td><td class="p-3 text-center font-semibold">${rekap.rerataKepribadian.toFixed(2)}</td></tr>
        <tr class="border-b border-main"><td class="p-3">Akademis</td><td class="p-3 text-center font-semibold">${rekap.rerataAkademik.toFixed(2)}</td></tr>
    `;
    if (siswa.kategori !== 'Dikbangspes') {
        rekapHtml += `<tr><td class="p-3">Kesamaptaan Jasmani</td><td class="p-3 text-center font-semibold">${rekap.rerataJasmani.toFixed(2)}</td></tr>`;
    }
    rekapBody.innerHTML = rekapHtml;

    const akademikBody = document.getElementById('modern-transkrip-akademik-body');
    if (mapels.length > 0) {
        akademikBody.innerHTML = mapels.map((mapel, index) => `
            <tr class="border-b border-main">
                <td class="p-3">${index + 1}</td>
                <td class="p-3">${mapel.nama}</td>
                <td class="p-3 text-center font-semibold">${mapel.nilai}</td>
                <td class="p-3">${terbilang(mapel.nilai)}</td>
            </tr>
        `).join('');
    } else {
        akademikBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data nilai mata pelajaran.</td></tr>`;
    }

    document.getElementById('modern-transkrip-total-nilai').textContent = rekap.totalNilaiAkademik.toFixed(0);
    document.getElementById('modern-transkrip-total-terbilang').textContent = terbilang(rekap.totalNilaiAkademik);
};

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
    return "NILAI TERLALU BESAR";
};

const terbilangSatuan = (angkaStr) => {
    const angka = ["NOL", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN"];
    return angkaStr.split('').map(digit => angka[parseInt(digit)]).join(' ');
};

const terbilangKoma = (n) => {
    if (n === null || typeof n === 'undefined' || isNaN(n)) return '';
    const num = parseFloat(n) || 0;
    const numStr = num.toFixed(2).replace('.', ',');
    const [bulat, desimal] = numStr.split(','); 
    let hasil = terbilang(parseInt(bulat)).trim();
    const desimalInt = parseInt(desimal);
    
    if (desimalInt > 0) {
        hasil += " KOMA " + terbilangSatuan(desimal); 
    }
    return hasil.trim();
};

const generateTranscriptHTML = (siswa, mapels, rekap, peringkatSiswa, totalSiswaDiKelas) => {
    const s = localSettings.transcript || {};
    const pageStyle = `font-family: ${s.fontFamily || 'Calibri'}, sans-serif; font-size: ${s.bodyFontSize || 10}pt; padding: ${s.marginTop || 1.3}cm ${s.marginRight || 1.9}cm ${s.marginBottom || 2.54}cm ${s.marginLeft || 1.9}cm;`;
    const tableHeaderBg = s.tableHeaderBg || '#FFFFFF';
    const tableHeaderText = s.tableHeaderText || '#000000';
    const tableHeaderSize = s.tableHeaderSize || 10;
    const tableBodySize = s.tableBodySize || 10;
    const tableRowPadding = s.tableRowPadding || '1';
    const thStyle = `padding: ${tableRowPadding}pt 2pt; border: 1pt solid black; color: ${tableHeaderText};`;
    const headerLine1 = s.headerLine1 || '';
    const headerLine2 = s.headerLine2 || '';
    const headerLineWidth = s.headerLineWidth || '43'; 
    const headerLineHtml = s.headerLineShow ? `<div style="border-bottom: 1pt solid black; width: ${headerLineWidth}%; margin-top: 1px;"></div>` : '';
    const mainTitleSize = s.mainTitleSize || 12;
    const subTitleSize = s.subTitleSize || 12;
    const signer1Name = s.signer1Name || '';
    const signer1Id = s.signer1Id || '';
    const signer2Name = s.signer2Name || '';
    const signer2Id = s.signer2Id || '';
    const signer1TitleLines = (s.signer1Title || '').split('|');
    const signer2TitleLines = (s.signer2Title || '').split('|');
    const signer1TitleHtml = signer1TitleLines.map(line => `<p style="margin: 0;">${line.toUpperCase()}</p>`).join('');
    const signer2TitleHtml = signer2TitleLines.map(line => `<p style="margin: 0;">${line.toUpperCase()}</p>`).join('');
    const namaSiswa = (siswa.nama || '...').toUpperCase();
    const noIjazah = siswa.noIjazah || '...';
    const pangkat = (siswa.pangkat || '...').toUpperCase();
    const nrpSiswa = siswa.nrp || '...';
    const jenisDik_main = `${(siswa.kategori || '...')} ${(siswa.detailPendidikan || '')}`.toUpperCase();
    const jenisDik_ta = `TA.${(siswa.tahunAjaran || '...')}`.toUpperCase();
    const noSeri = siswa.noSeri || '...';
    const peringkat = peringkatSiswa || '...';
    const totalSiswa = totalSiswaDiKelas || '...';
    const paperSize = s.paperSize || 'a4';
    const paperClass = paperSize === 'folio' ? 'paper-folio' : 'paper-a4';
    const infoBlockTop = s.infoBlockTop || '0';
    const infoBlockLeft = s.infoBlockLeft || '0';
    const infoBlockStyle = `position: relative; top: ${infoBlockTop}px; left: ${infoBlockLeft}px;`;
    const signer1Top = s.signer1Top || '0';
    const signer1Left = s.signer1Left || '0';
    const signer1LineWidthStyle = s.signer1LineWidth ? `width: ${s.signer1LineWidth}px;` : '';
    const signer1BlockStyle = `width:45%; text-align:center; position: relative; top: ${signer1Top}px; left: ${signer1Left}px;`;
    const signer2Top = s.signer2Top || '0';
    const signer2Left = s.signer2Left || '0';
    const signer2LineWidthStyle = s.signer2LineWidth ? `width: ${s.signer2LineWidth}px;` : '';
    const signer2BlockStyle = `width:45%; text-align:center; position: relative; top: ${signer2Top}px; left: ${signer2Left}px;`;
    const signerL2Name = s.signerL2Name || signer2Name; 
    const signerL2Id = s.signerL2Id || signer2Id;
    const signerL2Title = s.signerL2Title || s.signer2Title;
    const signerL2Top = s.signerL2Top || signer2Top;
    const signerL2Left = s.signerL2Left || signer2Left;
    const signerL2LineWidth = s.signerL2LineWidth || s.signer2LineWidth;
    const signerL2TitleHtml = (signerL2Title || '').split('|').map(line => `<p style="margin: 0;">${line.toUpperCase()}</p>`).join('');
    const signerL2LineWidthStyle = signerL2LineWidth ? `width: ${s.signerL2LineWidth}px;` : '';
    const signerL2BlockStyle = `width:45%; text-align:center; position: relative; top: ${signerL2Top}px; left: ${signerL2Left}px;`;

    const lampiran1HTML = 
    `
      <div class="page ${paperClass}" style="${pageStyle}">
        <div style="text-align: left; font-family: 'Calibri', sans-serif; font-size: 12pt; font-weight:bold; line-height: 1.2;">
            <p style="margin: 0; padding: 0;">${headerLine1}</p>
            <p style="margin: 0; padding: 0 0 0 30px;">${headerLine2}</p>
        </div>
        ${headerLineHtml}
        <div style="display: flex; justify-content: center; margin-top: 2px;">
            <div style="font-weight: bold; font-size:12pt; text-decoration: underline; margin:0;">LAMPIRAN I</div>
        </div>
        <div style="${infoBlockStyle}">
            <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
              <table style="font-size:11pt; border-collapse:collapse; line-height: 1.2;">
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">NO IJAZAH</td>
                  <td style="vertical-align: top;">: ${noIjazah}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">NAMA</td>
                  <td style="vertical-align: top;">: ${namaSiswa}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">PANGKAT / NRP</td>
                  <td style="vertical-align: top;">: ${pangkat} / ${nrpSiswa}</td>
                </tr>
                <tr>
                  <td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td>
                  <td style="vertical-align: top; max-width: 350px;">
                    <div style="display: flex; align-items: flex-start;">
                        <span style="white-space: pre;">: </span>
                        <div style="line-height: 1.2;">
                            <span>${jenisDik_main}</span><br>
                            <span>${jenisDik_ta}</span>
                        </div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
        </div>
        <div style="text-align:center; margin-top: 0.5rem;">
            <p style="font-weight:bold; text-decoration:underline; font-size: ${mainTitleSize}pt; margin:0;">DAFTAR NILAI AKADEMIK</p>
            <p style="font-size: ${subTitleSize}pt; margin:0;">(TRANSKRIP)</p>
        </div>
        <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${noSeri}</p>
        <table style="width:100%; border-collapse: collapse; font-size:${tableBodySize}pt; text-transform: uppercase;">
          <thead style="display: table-header-group; background-color:${tableHeaderBg}; color:${tableHeaderText}; font-size:${tableHeaderSize}pt; text-align:center; font-weight: bold;">
            <tr style="height: auto;">
              <th rowspan="2" style="${thStyle} width: 5%;">NO</th>
              <th rowspan="2" style="${thStyle} width: 50%;">MATA PELAJARAN</th>
              <th colspan="2" style="${thStyle}">NILAI</th>
            </tr>
            <tr style="height: auto;">
              <th style="${thStyle} width: 15%;">ANGKA</th>
              <th style="${thStyle} width: 30%;">HURUF</th>
            </tr>
            <tr style="height: auto; text-align: center; font-size: ${tableBodySize}pt; font-weight: normal;">
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">1</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">2</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">3</td>
                <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">4</td>
            </tr>
          </thead>
          <tbody>
            ${mapels.map((mapel, index) => `
              <tr style="height: auto;">
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black; border-right: 1pt solid black; vertical-align: top;">${index + 1}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${mapel.nama.toUpperCase()}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-right: 1pt solid black; vertical-align: top;">${mapel.nilai}</td>
                  <td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-right: 1pt solid black; vertical-align: top;">${terbilang(mapel.nilai).toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="height: auto;">
                <td colspan="2" style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">JUMLAH</td>
                <td style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:center; border: 1pt solid black;">${rekap.totalNilaiAkademik.toFixed(0)}</td>
                <td style="padding: ${tableRowPadding}pt 2pt; font-weight:bold; text-align:left; border: 1pt solid black;">${terbilang(rekap.totalNilaiAkademik).toUpperCase()}</td>
            </tr>
          </tfoot>
        </table>
        <div style="padding-top:2rem; display:flex; justify-content:space-between; font-size:11pt; line-height: 1.2;">
            <div style="${signer1BlockStyle}">
                ${signer1TitleHtml}
                <div style="height:80px;"></div>
                <div style="display: inline-block; ${signer1LineWidthStyle}">
                    <p style="margin: 0; font-weight:bold;">${signer1Name}</p>
                    <div style="border-top: 1pt solid black; margin-top: 2px;"></div>
                </div>
                <p style="margin: 0;">${signer1Id}</p>
            </div>
            <div style="${signer2BlockStyle}">
                ${signer2TitleHtml}
                <div style="height:80px;"></div>
                <div style="display: inline-block; ${signer2LineWidthStyle}">
                    <p style="margin: 0; font-weight:bold;">${signer2Name}</p>
                    <div style="border-top: 1pt solid black; margin-top: 2px;"></div>
                </div>
                <p style="margin: 0;">${signer2Id}</p>
            </div>
        </div>
      </div>
    `;

    let rekapitulasiBody = `
        <tr style="height: auto;"><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">I</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black;">KEPRIBADIAN</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">${rekap.rerataKepribadian.toFixed(2).replace('.', ',')}</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black; border-right: 1pt solid black;">${terbilangKoma(rekap.rerataKepribadian).toUpperCase()}</td></tr>
        <tr style="height: auto;"><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">II</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black;">AKADEMIK</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">${rekap.rerataAkademik.toFixed(2).replace('.', ',')}</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black; border-right: 1pt solid black;">${terbilangKoma(rekap.rerataAkademik).toUpperCase()}</td></tr>
    `;
    if (siswa.kategori !== 'Dikbangspes') {
        rekapitulasiBody += `<tr style="height: auto;"><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">III</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black;">KESAMAPTAAN JASMANI</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:center; border-left: 1pt solid black;">${rekap.rerataJasmani.toFixed(2).replace('.', ',')}</td><td style="padding: ${tableRowPadding}pt 2pt; text-align:left; border-left: 1pt solid black; border-right: 1pt solid black;">${terbilangKoma(rekap.rerataJasmani).toUpperCase()}</td></tr>`;
    }

    const lampiran2HTML = `
  <div class="page ${paperClass}" style="${pageStyle}">
    <div style="font-family: 'Calibri', sans-serif; font-size: 12pt; text-align:left; font-weight:bold; line-height: 1.1;">
      <p style="margin: 0; padding: 0;">${headerLine1}</p>
      <p style="margin: 0; padding: 0 0 0 30px;">${headerLine2}</p>
    </div>
    ${headerLineHtml}
    <div style="display: flex; justify-content: center; margin-top: 2px;">
      <div style="font-weight: bold; font-size:12pt; text-decoration: underline;">LAMPIRAN II</div>
    </div>
    <div style="${infoBlockStyle}">
        <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
          <table style="font-size:11pt; border-collapse:collapse; line-height: 1.2;">
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NO IJAZAH</td><td>: ${noIjazah}</td></tr>
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">NAMA</td><td>: ${namaSiswa}</td></tr>
            <tr><td style="padding: 0 8px 0 0; vertical-align: top;">PANGKAT / NRP</td><td>: ${pangkat} / ${nrpSiswa}</td></tr>
            <tr>
              <td style="padding: 0 8px 0 0; vertical-align: top;">JENIS DIK</td>
              <td style="vertical-align: top; max-width: 350px;">
                <div style="display: flex; align-items: flex-start;">
                    <span style="white-space: pre;">: </span>
                    <div style="line-height: 1.2;">
                        <span>${jenisDik_main}</span><br>
                        <span>${jenisDik_ta}</span>
                    </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
    </div>
    <div style="text-align:center; margin-top: 0.7rem;">
      <p style="font-weight:bold; text-decoration:underline; font-size: 12pt; margin:0;">REKAPITULASI NILAI</p>
    </div>
    <p style="margin-top: 0.5rem; margin-bottom: 0.2rem; font-size: 11pt;">NO SERI : ${noSeri}</p>
    <table style="width:100%; border-collapse: collapse; font-size:${tableBodySize}pt; text-transform: uppercase;">
      <thead style="display: table-header-group; background-color:${tableHeaderBg}; color:${tableHeaderText}; font-size:${tableHeaderSize}pt; text-align:center; font-weight:bold;">
        <tr>
          <th rowspan="2" style="${thStyle}">NO</th>
          <th rowspan="2" style="${thStyle}">ASPEK YANG DINILAI</th>
          <th colspan="2" style="${thStyle}">NILAI</th>
        </tr>
        <tr>
          <th style="${thStyle}">ANGKA</th>
          <th style="${thStyle}">HURUF</th>
        </tr>
        <tr style="height: auto; text-align: center; font-size: ${tableBodySize}pt; font-weight: normal;">
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">1</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">2</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">3</td>
            <td style="padding: 0 2pt; border: 1pt solid black; color: ${tableHeaderText};">4</td>
        </tr>
      </thead>
      <tbody>
        ${rekapitulasiBody}
        <tr style="height: auto;">
            <td colspan="4" style="border: 1pt solid black; padding: 2pt; text-align: left;">
                PERINGKAT KE : ${peringkat} DARI ${totalSiswa} SISWA
            </td>
        </tr>
      </tbody>
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
  </div>
`;

    return lampiran1HTML + lampiran2HTML;
};

export const initPreviewSiswaTranskripModule = async (studentsData, mapelsData, taData, settingsData) => {
    localStudents = studentsData;
    localMapels = mapelsData;
    localTahunAjaran = taData;
    localSettings = settingsData; 
    
    // [CRITICAL UPDATE] Normalisasi Data Alumni
    let rawUser = JSON.parse(sessionStorage.getItem('loggedInUser')) || {};
    if (rawUser.role === 'alumni' && rawUser.studentData) {
        currentUser = {
            ...rawUser.studentData,
            role: 'alumni',
            uid: rawUser.uid
        };
    } else {
        currentUser = rawUser;
    }

    // [UPDATE] Izinkan role 'alumni'
    if (currentUser.role !== 'siswa' && currentUser.role !== 'alumni') {
        return; 
    }
    
    // [FIX] Jangan langsung return jika localStudents kosong (kasus Alumni)
    // if (!localStudents || localStudents.length === 0) { ... } // HAPUS INI

    const section = document.getElementById('transkrip-nilai-section');
    if (section) {
        if (!window.transkripSiswaInitialized) {
            window.transkripSiswaInitialized = true; 
            
            try {
                let viewFile = './components/transkrip_siswa_view.html'; 
    
                const response = await fetch(viewFile);
                if (!response.ok) throw new Error(`File ${viewFile} not found`);
                section.innerHTML = await response.text();
    
                const modernViewContainer = section.querySelector('#modern-transcript-view');
                if (modernViewContainer) {
                    try {
                        const modernRes = await fetch('./components/transkrip_detail_modern.html');
                        if (!modernRes.ok) throw new Error('File transkrip_detail_modern.html not found');
                        modernViewContainer.innerHTML = await modernRes.text();
                        
                        await openTranskripModal(currentUser.id);

                    } catch (err) {
                        console.error("Gagal memuat detail transkrip modern:", err);
                        modernViewContainer.innerHTML = "<p class='text-red-500 p-4'>Gagal memuat preview.</p>";
                    }
                }
                
                const downloadBtn = section.querySelector('#btn-download-pdf-view');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', downloadTranscriptAsPdf);
                }

            } catch (error) {
                console.error('Gagal memuat view transkrip siswa:', error);
                section.innerHTML = '<p class="text-red-500 text-center">Gagal memuat halaman.</p>';
                window.transkripSiswaInitialized = false; 
            }
        } else {
             await openTranskripModal(currentUser.id);
        }
    }
};

// INI FUNGSI UNTUK ADMIN SAJA
export const initTranskripModule = async (studentsData, mapelsData, taData, settingsData) => {
    // Fungsi ini dikosongkan karena logikanya sudah dipindah ke file ini
    // dan file transkrip.js hanya akan berisi logika admin.
};