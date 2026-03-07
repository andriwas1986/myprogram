// js/modules/settings_petikan.js

import { showLoading, hideLoading } from '../ui.js';
import { saveSettings } from '../firestore-service.js';

// ==========================================================================
// ===                          STATE & KONSTANTA                        ===
// ==========================================================================

let ptInputs = {};
let isScaling = false;
const DEFAULT_LOGO_URL = 'https://ik.imagekit.io/d3nxlzdjsu/LOGO%20TRIBRATA%20VEKTOR.png';

// ==========================================================================
// ===                        DATA SAMPLE (DUMMY)                        ===
// ==========================================================================
const getSamplePetikanData = () => {
    return {
        nama: 'ADITHYA PRANANDA, S.H.',
        pangkat: 'BRIPDA',
        nrp: '99010023',
        nosis: '202501001',
        kategori: 'DIKBANGSPES',
        detail: 'KEPALA KAMAR MESIN KAPAL',
        tahun: '2025',
        tglMulai: '29 Juli 2025',
        tglSelesai: '27 Agustus 2025',
        noKep: 'KEP/34/XII/2025',
        tglKep: '27 Agustus 2025',
        nilaiAkhir: '80.50',
        ranking: 5, // Contoh Ranking 5
        totalStudents: 530, // Total Siswa
        nomorUrut: 5, // Contoh Nomor Urut 5
        noUrut: 5
    };
};

// ==========================================================================
// ===                        FUNGSI FORMATTING TEKS                      ===
// ==========================================================================
const toSmartTitleCase = (str) => {
    if (!str) return '';
    const keepUppercase = [
        'TA', 'TA.', 'SAR', 'POLAIR', 'SBP', 'TNI', 'POLRI', 'PNS', 
        'KB', 'SD', 'SMP', 'SMA', 'S1', 'S2', 'S3', 
        'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'X'
    ];
    
    return str.toLowerCase().split(' ').map(word => {
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (keepUppercase.includes(cleanWord)) {
            return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

// ==========================================================================
// ===                  GENERATOR HTML DOKUMEN (INTI)                     ===
// ==========================================================================
export const generatePetikanPreviewHTML = (s, data) => {
    
    // Ukuran F4 Standar Indonesia 215mm x 330mm
    const w = s.paperSize === 'f4' ? '216mm' : '210mm';
    const h = s.paperSize === 'f4' ? '356mm' : '297mm';
    
    // 1. Indentasi & Posisi
    const indentLine2 = s.headerLine2Indent || 0; 
    const dateLeft = s.dateLeft || 0;
    const dateTop = s.dateTop || 0;
    const dateBlockStyle = `position: relative; left: ${dateLeft}px; top: ${dateTop}px; text-align: left; margin-bottom: 2px;`;

    // --- POSISI TTD ATAS (SIGNER 1 - KEPALA) ---
    const signer1BlockLeft = s.signer1BlockLeft || 0;
    const signer1BlockTop = s.signer1BlockTop || 0;
    const signer1BlockStyle = `width: 350px; position: relative; left: ${signer1BlockLeft}px; top: ${signer1BlockTop}px; text-align: left;`;

    const ttdLeft = s.ttdLeft || 0;
    const ttdTop = s.ttdTop || 0;
    const ttdStyle = `margin:0; text-align:center; position: relative; left: ${ttdLeft}px; top: ${ttdTop}px; margin-bottom: 10px;`;

    // --- POSISI TTD BAWAH (SIGNER 2 - a.n.) ---
    const signer2BlockLeft = s.signer2BlockLeft || 0; 
    const signer2BlockStyle = `width: 350px; position: relative; left: ${signer2BlockLeft}px; text-align: left;`;

    // 2. Indentasi Body Text
    const bodyTextIndent = '118px'; 

    // 3. Style Tabel
    const tableHeaderStyle = `border: 1px solid black; padding: 6px 5px; color:black; font-weight: normal; font-family: '${s.fontFamily}', sans-serif;`; 
    const tableCellStyle = `border: 1px solid black; padding: 6px 5px; font-weight: normal; font-family: '${s.fontFamily}', sans-serif;`; 

    // 4. Garis Bawah Judul
    const customUnderline = `border-bottom: 1px solid black; display: inline-block; line-height: 1.2;`;

    // 5. Nama Pendidikan
    const namaDikBody = toSmartTitleCase(`${data.kategori} ${data.detail}`); 

    // Margin
    const mt = (s.marginTop !== undefined && s.marginTop !== '') ? s.marginTop : '1';
    const mr = (s.marginRight !== undefined && s.marginRight !== '') ? s.marginRight : '1.5';
    const mb = (s.marginBottom !== undefined && s.marginBottom !== '') ? s.marginBottom : '1';
    const ml = (s.marginLeft !== undefined && s.marginLeft !== '') ? s.marginLeft : '2';

    const style = `
        width: ${w}; min-height: ${h}; 
        padding: ${mt}cm ${mr}cm ${mb}cm ${ml}cm;
        font-family: '${s.fontFamily}', sans-serif;
        font-size: ${s.fontSize}pt;
        color: #000;
        background: white;
        box-shadow: 0 0 15px rgba(0,0,0,0.1);
        position: relative;
        line-height: 1.15;
        box-sizing: border-box;
    `;

    // --- LOGIKA GARIS BAWAH (PENGATURAN KHUSUS) ---
    const s1Width = parseInt(s.signer1LineWidth) || 0; 
    const s1Left = s.signer1LineLeft || 0;
    let signer1NameStyle = "margin:0; font-weight: bold; text-transform: uppercase;";
    let signer1LineHtml = "";
    if (s1Width > 0) {
        signer1LineHtml = `<div style="border-top: 1px solid black; width: ${s1Width}px; margin: 0 auto; position: relative; left: ${s1Left}px; height: 0px;"></div>`;
    } else {
        signer1NameStyle += " text-decoration: underline;";
    }

    const s2Width = parseInt(s.signer2LineWidth) || 0; 
    const s2Left = s.signer2LineLeft || 0;
    let signer2NameStyle = "margin:0; font-weight: bold; text-transform: uppercase;";
    let signer2LineHtml = "";
    if (s2Width > 0) {
        signer2LineHtml = `<div style="border-top: 1px solid black; width: ${s2Width}px; margin: 0 auto; position: relative; left: ${s2Left}px; height: 0px;"></div>`;
    } else {
        signer2NameStyle += " text-decoration: underline;";
    }
    // ------------------------------------------------

    const logoUrl = s.logoUrl || DEFAULT_LOGO_URL;
    const logoHeight = s.logoHeight || 60; 
    const logoTop = s.logoTop || 0;
    const logoLeft = s.logoLeft || 0;
    const logoStyle = `height:${logoHeight}px; position: relative; top: ${logoTop}px; left: ${logoLeft}px; display: block; margin: 0 auto;`;
    const logoHtml = s.showLogo ? `<div style="text-align:center; margin-bottom: 2px; z-index: 10;"><img src="${logoUrl}" style="${logoStyle}" alt="Logo Polri"></div>` : '';

    const headerLineHtml = s.headerLineShow ? `<div style="border-bottom: 1px solid black; width: ${s.headerLineWidth}%; margin: 2px 0 5px 0;"></div>` : '';

    const jabatanAtas = s.jabatanSK || 'KEPALA PUSAT PENDIDIKAN POLISI PERAIRAN'; 
    const jabatanBawah = s.jabatanTTD || 'KEPALA PUSAT PENDIDIKAN POL AIR';
    const rightSignerTitle = s.signer2Title || 'KABAGDIKLAT';
    const subSatuan = "PUSDIKPOLAIR LEMDIKLAT POLRI";

    // --- [UPDATE PERBAIKAN] LOGIKA NOMOR URUT DINAMIS ---
    let noUrutRaw = data.noUrut || data.nomorUrut || (data.ranking || 1);
    let noUrutDisplay = noUrutRaw;

    // Menampilkan "[No Urut] S.D [Total Siswa]"
    if (data.totalStudents && data.totalStudents > 0) {
        noUrutDisplay = `${noUrutRaw} S.D ${data.totalStudents}`;
    }
    // -----------------------------------------------------

    const dashedLineStyle = `flex-grow: 1; border-bottom: 1px dashed black; height: 1px; margin: 0 5px;`;

    return `
    <div class="page" style="${style}">
        
        <div style="text-align: left; font-size:12pt;">
            <p style="margin:0; text-transform:uppercase;">${s.headerLine1}</p>
            <p style="margin:0; text-transform:uppercase; margin-left: ${indentLine2}cm;">${s.headerLine2}</p>
        </div>
        ${headerLineHtml}

        ${logoHtml}

        <div style="text-align: center; margin-bottom: 5px;">
            <p style="font-weight:bold; font-size: 13pt; margin-bottom: 1px;">PETIKAN</p>
            <div style="margin-bottom: 1px;"><span style="${customUnderline}">KEPUTUSAN ${jabatanAtas}</span></div>
            <p style="margin:0;">Nomor: ${data.noKep}</p>
            <p style="margin:1px 0;">tentang</p>
            <p style="margin:0;">KELULUSAN PROSES PEMBELAJARAN</p>
            <div><span style="${customUnderline} text-transform:uppercase;">${data.kategori} ${data.detail} TA. ${data.tahun}</span></div>
        </div>

        <div style="text-align: center; margin-bottom: 5px;">
            <p style="margin:0;">${jabatanAtas}</p>
        </div>

        <div style="margin-bottom: 3px;">
            <table style="width:100%; border-collapse: collapse; border: none; font-weight: normal;">
                <tr><td style="width: 100px; vertical-align: top;">Menimbang</td><td style="width: 10px; vertical-align: top;">:</td><td>dsb</td></tr>
                <tr><td style="vertical-align: top;">Mengingat</td><td style="vertical-align: top;">:</td><td>dsb</td></tr>
            </table>
        </div>

        <div style="text-align: center; margin-bottom: 3px; font-weight: bold;">MEMUTUSKAN</div>

        <div style="text-align: justify;">
            <table style="width:100%; margin-bottom:3px; font-weight: normal;">
                <tr>
                    <td style="width: 100px; vertical-align: top;">Menetapkan</td>
                    <td style="width: 10px; vertical-align: top;">:</td>
                    <td style="vertical-align: top;">
                        yang nama-namanya tersebut dalam lampiran Keputusan ini terhitung mulai tanggal :
                        <div style="display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 3px;">
                            <div style="${dashedLineStyle}"></div>
                            <div style="white-space: nowrap;">${data.tglSelesai}</div>
                            <div style="${dashedLineStyle}"></div>
                        </div>
                    </td>
                </tr>
            </table>

            <div style="margin-left: ${bodyTextIndent};">
                <p style="margin-bottom: 3px; text-indent: 0;">
                    Dinyatakan telah selesai mengikuti ${namaDikBody} TA. ${data.tahun} yang diselenggarakan mulai tanggal ${data.tglMulai} sampai dengan tanggal ${data.tglSelesai} dan dinyatakan lulus sesuai dengan peringkat kecakapannya.
                </p>

                <div style="margin-bottom: 3px;">
                    <span style="${customUnderline}">Dengan catatan</span>:<br>
                    Apabila dikemudian hari terdapat kekeliruan dalam penetapan ini akan diadakan pembetulan sebagaimana mestinya.
                </div>

                <div style="margin-bottom: 5px;">
                    <div>SALINAN:</div>
                    <div style="margin-top: 1px;">PETIKAN: Keputusan ini disampaikan kepada yang bersangkutan untuk diketahui dan diindahkan sebagaimana mestinya.</div>
                </div>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; margin-top: 5px; page-break-inside: avoid;">
            <div style="${signer1BlockStyle}">
                <div style="${dateBlockStyle}">
                    <p style="margin:0;">Ditetapkan di ${s.kota}</p>
                    <div style="margin-bottom: 2px;"><span style="${customUnderline}">Pada tanggal: ${data.tglKep}</span></div>
                </div>
                <div style="height: 3px;"></div>
                
                <div style="text-align: center;">
                    <p style="margin:0; text-transform:uppercase;">${jabatanBawah}</p>
                    <p style="${ttdStyle}">ttd</p>
                    <div>
                        <p style="${signer1NameStyle}">${s.signer1Name || '....................'}</p>
                        ${signer1LineHtml}
                    </div>
                    <p style="margin:0; margin-top: 2px; text-transform:uppercase; font-weight: normal;">${s.signer1Id || '....................'}</p>
                </div>
            </div>
        </div>
        
        <div style="clear:both;"></div>

        <div style="margin-top: 10px;"></div> 
        <table style="width:100%; font-size: ${s.fontSize}pt; margin-bottom: 3px; border-collapse: collapse;">
            <tr><td style="width: 100px; font-weight: bold; vertical-align: top;">LAMPIRAN</td><td style="width: 10px; vertical-align: top;">:</td><td style="vertical-align: top;">KEPUTUSAN ${jabatanAtas}</td></tr>
            <tr><td style="font-weight: bold; vertical-align: top;"></td><td style="vertical-align: top;"></td><td style="vertical-align: top;"><span style="${customUnderline}">NOMOR : ${data.noKep} TANGGAL ${data.tglKep}</span></td></tr>
        </table>

        <table style="width:100%; border-collapse: collapse; margin-top: 3px; font-size: ${s.fontSize}pt;">
            <thead>
                <tr style="text-align: center; color:black;">
                    <th style="${tableHeaderStyle} width: 12%;">NO. URUT</th>
                    <th style="${tableHeaderStyle} width: 35%;">N A M A</th>
                    <th style="${tableHeaderStyle} width: 18%;">NOSIS</th>
                    <th style="${tableHeaderStyle} width: 10%;">BAIK</th>
                    <th style="${tableHeaderStyle} width: 15%;">NILAI AKHIR</th>
                    <th style="${tableHeaderStyle} width: 10%;">RANGKING</th>
                    <th style="${tableHeaderStyle} width: 10%;">KET</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="${tableCellStyle} text-align: center;">${noUrutDisplay}</td>
                    <td style="${tableCellStyle}">
                        ${data.nama}
                    </td>
                    <td style="${tableCellStyle} text-align: center;">${data.nosis}</td>
                    <td style="${tableCellStyle} text-align: center;">BAIK</td>
                    <td style="${tableCellStyle} text-align: center;">${data.nilaiAkhir || '0.00'}</td>
                    <td style="${tableCellStyle} text-align: center;">${data.ranking || 1}</td>
                    <td style="${tableCellStyle} text-align: center;">LULUS</td>
                </tr>
            </tbody>
        </table>
             
        <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
            <div style="width: 400px; text-align: left;">
                <p style="margin:0;text-align:center;">Untuk petikan sesuai dengan aslinya</p>
                <p style="margin:0;text-align:center;">
                    <span style="text-transform:lowercase;">a.n.</span>
                    <span style="text-transform:uppercase;"> ${jabatanBawah}</span>
                </p>
                
                <p style="margin:0; text-align:center;">
                    ${rightSignerTitle} ${subSatuan}
                </p>
                
                <div style="height: 80px;"></div>
                
                <div style="text-align:center;">
                    <p style="${signer2NameStyle}">${s.signer2Name || '....................'}</p>
                    ${signer2LineHtml}
                </div>
                <p style="margin:0; text-align:center; text-transform:uppercase; margin-top: 2px; font-weight: normal;">${s.signer2Id}</p>
            </div>
        </div>
        <div style="clear:both;"></div>
    </div>
    `;
};

// ==========================================================================
// ===                        UTILITY FUNCTIONS                           ===
// ==========================================================================

const scalePreview = () => {
    if (isScaling) return; 
    isScaling = true;
    const wrapper = document.getElementById('petikan-preview-wrapper');
    const preview = document.getElementById('petikan-preview');
    if (!preview || !wrapper) { isScaling = false; return; }

    setTimeout(() => {
        preview.style.transform = ''; 
        wrapper.style.height = 'auto';
        const containerWidth = wrapper.clientWidth;
        const pageNaturalWidth = 794; 
        const horizontalPadding = 34; 

        if (containerWidth > 0) {
            const scale = (containerWidth - horizontalPadding) / pageNaturalWidth;
            preview.style.transform = `scale(${Math.min(scale, 1)})`;
            preview.style.transformOrigin = 'top center';
            const h = preview.offsetHeight * Math.min(scale, 1);
            wrapper.style.height = `${h + 50}px`;
        }
        setTimeout(() => { isScaling = false; }, 100);
    }, 50);
};

const updatePetikanPreview = () => {
    const preview = document.getElementById('petikan-preview');
    if (!preview) return;

    const s = {};
    for (const key in ptInputs) {
        if (ptInputs[key]) {
            s[key] = ptInputs[key].type === 'checkbox' ? ptInputs[key].checked : ptInputs[key].value;
        }
    }
    const sampleData = getSamplePetikanData();
    preview.innerHTML = generatePetikanPreviewHTML(s, sampleData);
    scalePreview();
};

const populatePetikanForm = (settingsData) => {
    if (settingsData?.petikan_settings) {
        const ps = settingsData.petikan_settings;
        for (const key in ps) {
            if (ptInputs[key]) {
                if (ptInputs[key].type === 'checkbox') ptInputs[key].checked = ps[key];
                else ptInputs[key].value = ps[key];
            }
        }
    }
    updatePetikanPreview();
};

const handlePetikanFormSubmit = async (e) => {
    e.preventDefault();
    showLoading('Menyimpan Pengaturan Petikan...');
    const data = {};
    for (const key in ptInputs) {
        if (ptInputs[key]) {
            data[key] = ptInputs[key].type === 'checkbox' ? ptInputs[key].checked : ptInputs[key].value;
        }
    }
    try {
        await saveSettings({ petikan_settings: data });
        alert('Pengaturan Petikan berhasil disimpan!');
    } catch (error) {
        console.error(error);
        alert('Gagal menyimpan pengaturan petikan.');
    } finally {
        hideLoading();
    }
};

export const initPetikanSettingsModule = (settingsData) => {
    const form = document.getElementById('settings-petikan-form');
    if (!form) return;

    ptInputs = {
        paperSize: document.getElementById('pt-paper-size'),
        fontFamily: document.getElementById('pt-font-family'),
        fontSize: document.getElementById('pt-font-size'),
        marginTop: document.getElementById('pt-margin-top'),
        marginBottom: document.getElementById('pt-margin-bottom'),
        marginLeft: document.getElementById('pt-margin-left'),
        marginRight: document.getElementById('pt-margin-right'),
        logoUrl: document.getElementById('pt-logo-url'),
        logoHeight: document.getElementById('pt-logo-height'),
        logoTop: document.getElementById('pt-logo-top'),
        logoLeft: document.getElementById('pt-logo-left'),
        showLogo: document.getElementById('pt-show-logo'),
        headerLine1: document.getElementById('pt-header-line1'),
        headerLine2: document.getElementById('pt-header-line2'),
        headerLine2Indent: document.getElementById('pt-header-line2-indent'),
        headerLineWidth: document.getElementById('pt-header-line-width'),
        headerLineShow: document.getElementById('pt-header-line-show'),
        jabatanSK: document.getElementById('pt-jabatan-sk'),   
        jabatanTTD: document.getElementById('pt-jabatan-ttd'), 
        kota: document.getElementById('pt-kota'),
        signer1Title: document.getElementById('pt-signer1-title'),
        signer1Name: document.getElementById('pt-signer1-name'),
        signer1Id: document.getElementById('pt-signer1-id'),
        signer2Title: document.getElementById('pt-signer2-title'),
        signer2Name: document.getElementById('pt-signer2-name'),
        signer2Id: document.getElementById('pt-signer2-id'),
        
        dateLeft: document.getElementById('pt-date-left'),
        dateTop: document.getElementById('pt-date-top'),
        signer1BlockLeft: document.getElementById('pt-signer1-block-left'),
        signer1BlockTop: document.getElementById('pt-signer1-block-top'),
        
        signer2BlockLeft: document.getElementById('pt-signer2-block-left'), // Input Geser TTD Bawah

        ttdLeft: document.getElementById('pt-ttd-left'),
        ttdTop: document.getElementById('pt-ttd-top'),
        signer1LineWidth: document.getElementById('pt-signer1-line-width'),
        signer1LineLeft: document.getElementById('pt-signer1-line-left'),
        signer2LineWidth: document.getElementById('pt-signer2-line-width'),
        signer2LineLeft: document.getElementById('pt-signer2-line-left'),
        dateTextLeft: document.getElementById('pt-date-text-left')
    };

    // --- FITUR AUTO SYNC: Saat ATAS digeser, BAWAH ikut ---
    if (ptInputs.signer1BlockLeft && ptInputs.signer2BlockLeft) {
        ptInputs.signer1BlockLeft.addEventListener('input', (e) => {
            const val = e.target.value;
            ptInputs.signer2BlockLeft.value = val; 
            updatePetikanPreview();
        });
    }

    Object.values(ptInputs).forEach(input => { if (input) input.addEventListener('input', updatePetikanPreview); });
    
    const wrapper = document.getElementById('petikan-preview-wrapper');
    if (wrapper) {
        const ro = new ResizeObserver(scalePreview);
        ro.observe(wrapper);
    }

    form.addEventListener('submit', handlePetikanFormSubmit);
    populatePetikanForm(settingsData);
};

// [PERBAIKAN] CSS Print Memaksa Margin 0
const openPrintWindow = (content, paperSize) => {
    // 'f4' -> 215mm 330mm (Ukuran F4/Folio standar Indonesia)
    const cssSize = paperSize === 'f4' || paperSize === 'F4' ? '216mm 356mm' : 'F4';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Cetak Petikan Kelulusan</title>
                <style>
                    /* Reset CSS dasar */
                    * { 
                        box-sizing: border-box; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    body { 
                        font-family: 'Bookman Old Style', serif; 
                        margin: 0; 
                        padding: 0;
                        background: #eee;
                    }

                    /* Tampilan Layar (Preview Popup) */
                    .page {
                        background: white;
                        margin: 20px auto;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    }

                    /* Tampilan Cetak (Print) */
                    @media print {
                        @page { 
                            size: ${cssSize}; 
                            margin: 0mm !important; /* Paksa margin browser 0 */
                        }

                        html, body {
                            width: 100%;
                            height: 100%;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: visible;
                        }
                        
                        .page { 
                            margin: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            width: 100% !important;
                            height: auto !important;
                            overflow: visible !important;
                            page-break-after: always;
                        }
                        
                        body::before, body::after {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 1000);
};