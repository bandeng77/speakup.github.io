// Konfigurasi EmailJS
const EMAILJS_PUBLIC_KEY = "STBRxktGl6mM6Zi95";
const EMAILJS_SERVICE_ID = "carbonio_mail";
const EMAILJS_TEMPLATE_ID = "template_08n414a";
const RECIPIENT_EMAIL = "contoh@genetek.co.id";

// Konfigurasi n8n upload webhook
const N8N_UPLOAD_URL = "https://n8n.genetek.co.id/webhook/upload";

// Konfigurasi SMB (akan digunakan oleh n8n webhook)
const SMB_CONFIG = {
  server: "192.168.104.33",
  share: "Data-4TB",
  path: "/speakup"
};

// ============ MODE TESTING ============
// SET ke true untuk skip upload ke n8n (testing email & form saja)
// SET ke false untuk upload real ke n8n
const TESTING_MODE = true;  // <-- GANTI ke false jika n8n sudah siap

emailjs.init(EMAILJS_PUBLIC_KEY);

let selectedCategory = "";
let uploadedFiles = [];

// DOM Elements
const heroHeader = document.getElementById('heroHeader');
const reportCard = document.getElementById('reportCard');
const newReportBtn = document.getElementById('newReportBtn');
const formContainer = document.getElementById('formContainer');
const emptyStateDiv = document.getElementById('emptyState');
const categoryGroup = document.getElementById('categoryGroup');
const customCategoryDiv = document.getElementById('customCategoryDiv');
const customCategoryInput = document.getElementById('customCategoryInput');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const filePreviewList = document.getElementById('filePreviewList');
const reportForm = document.getElementById('reportForm');
const backCheckBtn = document.getElementById('backCheckBtn');

// Buat elemen progress bar jika belum ada
let uploadProgressDiv = document.getElementById('uploadProgress');
let uploadProgressBar = document.getElementById('uploadProgressBar');

if (!uploadProgressDiv && dropzone && dropzone.parentNode) {
  const progressDiv = document.createElement('div');
  progressDiv.id = 'uploadProgress';
  progressDiv.className = 'upload-progress hidden';
  progressDiv.innerHTML = '<div id="uploadProgressBar" class="upload-progress-bar"></div>';
  dropzone.parentNode.appendChild(progressDiv);
  uploadProgressDiv = document.getElementById('uploadProgress');
  uploadProgressBar = document.getElementById('uploadProgressBar');
}

const kategoriList = ["HR & Hubungan Kerja", "Kompensasi & Benefit", "Operasional & Proses Kerja", "K3 / Safety", "Administrasi & Dokumen", "Fasilitas & Infrastruktur", "Etika & Perilaku", "Manajemen & Kebijakan", "Pelanggaran / Fraud", "Lainnya"];

// Fungsi untuk menampilkan card dan membuka form laporan baru
function revealAndOpenForm() {
    if (!reportCard.classList.contains('visible')) {
        reportCard.classList.add('visible');
        setTimeout(() => {
            reportCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    resetFormFields();
    formContainer.classList.remove('hidden');
    emptyStateDiv.classList.add('hidden');
    if (heroHeader) {
        heroHeader.classList.add('hero-click-effect');
        setTimeout(() => heroHeader.classList.remove('hero-click-effect'), 300);
    }
}

// Fungsi untuk reset form
function resetFormFields() {
    const judulInput = document.getElementById('judul');
    const kronologiInput = document.getElementById('kronologi');
    const pihakNama = document.getElementById('pihakNama');
    const pihakJabatan = document.getElementById('pihakJabatan');
    const pihakDivisi = document.getElementById('pihakDivisi');
    const tanggalKejadian = document.getElementById('tanggalKejadian');
    const lokasiProject = document.getElementById('lokasiProject');
    const statusKejadian = document.getElementById('statusKejadian');
    
    if (judulInput) judulInput.value = "";
    if (kronologiInput) kronologiInput.value = "";
    if (pihakNama) pihakNama.value = "";
    if (pihakJabatan) pihakJabatan.value = "";
    if (pihakDivisi) pihakDivisi.value = "";
    if (tanggalKejadian) tanggalKejadian.value = "";
    if (lokasiProject) lokasiProject.value = "";
    if (statusKejadian) statusKejadian.value = "Masih terjadi";
    
    selectedCategory = "";
    if (customCategoryDiv) customCategoryDiv.classList.add('hidden');
    if (customCategoryInput) customCategoryInput.value = "";
    uploadedFiles = [];
    updateFilePreview();
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
}

// Event: Klik pada Hero (termasuk logo) akan memunculkan card dan membuka form laporan
if (heroHeader) {
    heroHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        revealAndOpenForm();
    });
}

// Tombol "Buat Laporan Baru"
if (newReportBtn) {
    newReportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        revealAndOpenForm();
    });
}

// ========== FUNGSI UPLOAD KE N8N WEBHOOK (dengan handle response kosong) ==========
async function uploadFileToN8N(file, reportId) {
    // Jika mode testing, skip upload real
    if (TESTING_MODE) {
        console.log(`[TESTING] Simulasi upload: ${file.name}`);
        return {
            success: true,
            name: file.name,
            size: file.size,
            path: `[TESTING] //${SMB_CONFIG.server}/${SMB_CONFIG.share}${SMB_CONFIG.path}/${reportId}/${file.name}`,
            message: 'Mode testing - file tidak benar-benar diupload'
        };
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportId', reportId);
    formData.append('originalName', file.name);
    formData.append('smbServer', SMB_CONFIG.server);
    formData.append('smbShare', SMB_CONFIG.share);
    formData.append('smbPath', SMB_CONFIG.path);
    
    try {
        const response = await fetch(N8N_UPLOAD_URL, {
            method: 'POST',
            body: formData,
        });
        
        // Baca response sebagai text terlebih dahulu (jangan langsung json)
        const responseText = await response.text();
        console.log('Response dari n8n (raw):', responseText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${responseText || 'No response'}`);
        }
        
        // Jika response kosong, tetap anggap sukses (file mungkin tetap terupload)
        if (!responseText || responseText.trim() === '') {
            return {
                success: true,
                name: file.name,
                size: file.size,
                path: `//${SMB_CONFIG.server}/${SMB_CONFIG.share}${SMB_CONFIG.path}/${reportId}/${file.name}`,
                warning: 'Response dari server kosong, tapi upload mungkin berhasil'
            };
        }
        
        // Coba parse JSON jika ada konten
        let result = {};
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.warn('Response bukan JSON:', responseText);
            result = { rawResponse: responseText };
        }
        
        return {
            success: true,
            name: file.name,
            size: file.size,
            path: result.filePath || result.path || `//${SMB_CONFIG.server}/${SMB_CONFIG.share}${SMB_CONFIG.path}/${reportId}/${file.name}`,
            url: result.url || null,
            rawResponse: result
        };
        
    } catch (error) {
        console.error('Upload error:', error);
        return {
            success: false,
            name: file.name,
            error: error.message
        };
    }
}

async function uploadAllFiles(files, reportId) {
    if (uploadProgressDiv) uploadProgressDiv.classList.remove('hidden');
    
    let results = [];
    for (let i = 0; i < files.length; i++) {
        if (uploadProgressBar) {
            const percent = ((i + 1) / files.length) * 100;
            uploadProgressBar.style.width = `${percent}%`;
        }
        
        showToast(`📤 ${TESTING_MODE ? '[TEST] ' : ''}Upload ${files[i].name}...`, false);
        const result = await uploadFileToN8N(files[i].file, reportId);
        results.push(result);
        
        if (result.success) {
            showToast(`✅ ${result.name} ${TESTING_MODE ? '(simulasi)' : 'berhasil'}`, false);
        } else {
            showToast(`❌ Gagal: ${result.name} - ${result.error}`, true);
        }
    }
    
    if (uploadProgressBar) uploadProgressBar.style.width = '100%';
    setTimeout(() => {
        if (uploadProgressDiv) uploadProgressDiv.classList.add('hidden');
        if (uploadProgressBar) uploadProgressBar.style.width = '0%';
    }, 1000);
    
    return results;
}

// ========== FILE HANDLERS ==========
function handleFiles(files) {
    if (!files || !files.length) return;
    
    for (let f of files) {
        if (f.size > 5 * 1024 * 1024) {
            showToast(`⚠️ ${f.name} >5MB diabaikan`, true);
            continue;
        }
        uploadedFiles.push({ file: f, name: f.name, size: f.size });
    }
    updateFilePreview();
}

function updateFilePreview() {
    if (!filePreviewList) return;
    filePreviewList.innerHTML = "";
    uploadedFiles.forEach((item, idx) => {
        const badge = document.createElement('div');
        badge.className = 'file-badge';
        badge.innerHTML = `<i class="fas fa-file-alt"></i> ${item.name.substring(0, 30)} (${(item.size / 1024).toFixed(1)}KB) <span class="remove-file" data-idx="${idx}">✖</span>`;
        badge.querySelector('.remove-file').addEventListener('click', () => {
            uploadedFiles.splice(idx, 1);
            updateFilePreview();
        });
        filePreviewList.appendChild(badge);
    });
}

if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.style.background = "#eef2ff";
    });
    dropzone.addEventListener('dragleave', () => dropzone.style.background = "#fbfdff");
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.background = "#fbfdff";
        handleFiles(e.dataTransfer.files);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', e => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });
}

// ========== RENDER KATEGORI ==========
function renderCategories() {
    if (!categoryGroup) return;
    categoryGroup.innerHTML = "";
    kategoriList.forEach(kat => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "cat-btn";
        btn.innerText = kat;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = kat;
            if (customCategoryDiv) {
                customCategoryDiv.classList.toggle('hidden', kat !== "Lainnya");
            }
        });
        categoryGroup.appendChild(btn);
    });
}

const infoIcon = document.getElementById('infoCatIcon');
if (infoIcon) {
    infoIcon.addEventListener('click', () => alert("Pilih kategori yang paling sesuai untuk mempercepat tindak lanjut."));
}

// ========== EMAIL & LAPORAN ==========
async function sendEmail(reportData, uploadedFilesInfo) {
    let lampiranText = "Tidak ada lampiran";
    if (uploadedFilesInfo?.length) {
        const successFiles = uploadedFilesInfo.filter(f => f.success);
        if (successFiles.length) {
            lampiranText = successFiles.map(f => 
                `• ${f.name} (${(f.size / 1024).toFixed(1)}KB)\n  Lokasi: ${f.path || 'Tersimpan'}`
            ).join("\n\n");
        } else {
            lampiranText = "Upload file gagal, silakan lampirkan manual";
        }
    }
    
    const params = {
        to_email: RECIPIENT_EMAIL,
        from_email: "noreply@speakup.genetek.co.id",
        kategori: reportData.kategori,
        judul: reportData.judul,
        kronologi: reportData.kronologi,
        pihak_nama: reportData.pihakTerkait.nama,
        pihak_jabatan: reportData.pihakTerkait.jabatan,
        pihak_divisi: reportData.pihakTerkait.divisi,
        tanggal_kejadian: reportData.detailTambahan.tanggalKejadian || "-",
        lokasi: reportData.detailTambahan.lokasiProject || "-",
        status: reportData.detailTambahan.status,
        lampiran: lampiranText,
        tanggal_laporan: new Date().toLocaleString('id-ID'),
        message: `LAPORAN SPEAKUP\n\nKategori: ${reportData.kategori}\nJudul: ${reportData.judul}\nKronologi: ${reportData.kronologi}\n\nFile yang tersimpan:\n${lampiranText}`
    };
    
    return await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
}

function saveToLocal(reportData, uploadedFilesInfo) {
    let reports = JSON.parse(localStorage.getItem('speakup_reports') || '[]');
    reports.push({
        ...reportData,
        files: uploadedFilesInfo.filter(f => f.success).map(f => ({ 
            name: f.name, 
            size: f.size,
            path: f.path 
        })),
        id: Date.now(),
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('speakup_reports', JSON.stringify(reports));
}

// ========== SUBMIT HANDLER ==========
async function submitReportHandler(e) {
    e.preventDefault();
    
    let finalCat = selectedCategory;
    if (selectedCategory === "Lainnya") {
        if (!customCategoryInput.value.trim()) return alert("Isi kategori lainnya");
        finalCat = customCategoryInput.value.trim();
    } else if (!selectedCategory) return alert("Pilih salah satu kategori");

    const judul = document.getElementById('judul').value.trim();
    const kronologi = document.getElementById('kronologi').value.trim();
    if (!judul || !kronologi) return alert("Judul dan kronologi wajib diisi");

    const submitBtn = document.getElementById('submitReportBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Mengirim...';
    submitBtn.disabled = true;
    
    try {
        const reportId = Date.now().toString();
        let uploadResults = [];
        
        // Upload file ke TrueNAS via n8n webhook
        if (uploadedFiles.length > 0) {
            showToast(`📤 ${TESTING_MODE ? '[TESTING MODE] ' : ''}Mengupload ${uploadedFiles.length} file...`, false);
            uploadResults = await uploadAllFiles(uploadedFiles, reportId);
        }
        
        const reportData = {
            kategori: finalCat,
            judul,
            kronologi,
            pihakTerkait: {
                nama: document.getElementById('pihakNama').value.trim() || "Anonim",
                jabatan: document.getElementById('pihakJabatan').value.trim() || "-",
                divisi: document.getElementById('pihakDivisi').value.trim() || "-"
            },
            detailTambahan: {
                tanggalKejadian: document.getElementById('tanggalKejadian').value,
                lokasiProject: document.getElementById('lokasiProject').value,
                status: document.getElementById('statusKejadian').value
            }
        };
        
        // Kirim email dengan info file
        await sendEmail(reportData, uploadResults);
        
        // Simpan ke localStorage
        saveToLocal(reportData, uploadResults);
        
        const successCount = uploadResults.filter(r => r.success).length;
        const failCount = uploadResults.filter(r => !r.success).length;
        
        let successMessage = `✅ Laporan terkirim ke HR & tim internal\n`;
        if (successCount > 0) {
            successMessage += `📁 ${successCount} file berhasil ${TESTING_MODE ? '(simulasi) ' : ''}disimpan\n`;
        }
        if (failCount > 0) {
            successMessage += `⚠️ ${failCount} file gagal diupload`;
        }
        
        alert(successMessage);
        showToast("Laporan anonim berhasil dikirim!", false);
        
        resetFormFields();
        formContainer.classList.remove('hidden');
        emptyStateDiv.classList.add('hidden');
        reportCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (err) {
        console.error('Error:', err);
        showToast("Gagal mengirim laporan: " + err.message, true);
        alert(`❌ Gagal mengirim laporan: ${err.message}\nSilakan coba lagi.`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

if (backCheckBtn) {
    backCheckBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

if (reportForm) {
    reportForm.addEventListener('submit', submitReportHandler);
}

renderCategories();

function showToast(msg, isErr) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.style.background = isErr ? '#dc2626e6' : '#0f172ad9';
    toast.innerHTML = `<i class="fas ${isErr ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
