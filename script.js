const translations = {
    en: {
        title: "PSX Bayer Texture Generator",
        uploadTitle: "Source Image",
        dropText: "Drag & drop image here or",
        browseBtn: "Browse File",
        settingsTitle: "Conversion Settings",
        widthLabel: "Width (px):",
        heightLabel: "Height (px):",
        colorsLabel: "Color Depth (Levels per channel):",
        bayerLabel: "Bayer Matrix Intensity:",
        ditherToggle: "Enable Bayer Dithering",
        previewTitle: "PSX Preview & Export",
        downloadBtn: "Download PNG",
        statsRes: "Resolution:",
        statsColors: "Palette Mode:"
    },
    ru: {
        title: "PSX Bayer Генератор текстур",
        uploadTitle: "Исходное изображение",
        dropText: "Перетащите картинку сюда или",
        browseBtn: "Выбрать файл",
        settingsTitle: "Настройки конвертации",
        widthLabel: "Ширина (пикс):",
        heightLabel: "Высота (пикс):",
        colorsLabel: "Глубина цвета (Уровней на канал):",
        bayerLabel: "Интенсивность матрицы Байера:",
        ditherToggle: "Включить дизеринг Байера",
        previewTitle: "PSX Превью и Экспорт",
        downloadBtn: "Скачать PNG",
        statsRes: "Разрешение:",
        statsColors: "Режим палитры:"
    }
};

const bayerMatrix8x8 = [
    [ 0, 32,  8, 40,  2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44,  4, 36, 14, 46,  6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [ 3, 35, 11, 43,  1, 33,  9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47,  7, 39, 13, 45,  5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
];

let sourceImage = null;
let currentLang = 'en';

const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
fileInput.accept = "image/jpeg, image/png, image/webp, image/bmp, image/tiff, image/*";

const browseBtn = document.getElementById('browseBtn');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const widthVal = document.getElementById('widthVal');
const heightVal = document.getElementById('heightVal');
const colorLevelsInput = document.getElementById('colorLevels');
const colorLevelsVal = document.getElementById('colorLevelsVal');
const bayerIntensityInput = document.getElementById('bayerIntensity');
const bayerIntensityVal = document.getElementById('bayerIntensityVal');
const ditherCheck = document.getElementById('ditherCheck');
const downloadBtn = document.getElementById('downloadBtn');
const downloadTopBtn = document.getElementById('downloadTopBtn');
const langSelect = document.getElementById('langSelect');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const statRes = document.getElementById('statRes');
const statColors = document.getElementById('statColors');

// Элементы для URL (если добавили поле в HTML)
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');

if (loadUrlBtn && urlInput) {
    loadUrlBtn.addEventListener('click', () => {
        if (urlInput.value.trim()) {
            loadFromUrl(urlInput.value.trim());
        }
    });
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && urlInput.value.trim()) {
            loadFromUrl(urlInput.value.trim());
        }
    });
}

langSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateTexts();
});

function updateTexts() {
    const t = translations[currentLang];
    document.querySelector('header h1').textContent = t.title;
    document.querySelectorAll('.panel-header h2')[0].textContent = t.uploadTitle;
    document.querySelector('.file-drop-area p').textContent = t.dropText;
    browseBtn.textContent = t.browseBtn;
    document.querySelectorAll('.panel-header h2')[1].textContent = t.settingsTitle;
    document.querySelector('label[for="widthInput"]').childNodes[0].nodeValue = t.widthLabel + ' ';
    document.querySelector('label[for="heightInput"]').childNodes[0].nodeValue = t.heightLabel + ' ';
    document.querySelector('label[for="colorLevels"]').childNodes[0].nodeValue = t.colorsLabel + ' ';
    document.querySelector('label[for="bayerIntensity"]').childNodes[0].nodeValue = t.bayerLabel + ' ';
    document.querySelector('label[for="ditherCheck"]').childNodes[1].nodeValue = ' ' + t.ditherToggle;
    document.querySelectorAll('.panel-header h2')[2].textContent = t.previewTitle;
    downloadBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${t.downloadBtn}`;
    downloadTopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${t.downloadBtn}`;
    document.querySelectorAll('.stat-card .label')[0].textContent = t.statsRes;
    document.querySelectorAll('.stat-card .label')[1].textContent = t.statsColors;
}

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

// Глобальный Drag and Drop
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
        return;
    }
    const textData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (textData) {
        loadFromUrl(textData);
    }
});

// Исправленный перехват Ctrl+V
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            if (blob) {
                handleFile(blob);
                return;
            }
        }
    }
    // Если в буфере текст (например, скопированная ссылка на картинку)
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && pastedText.trim().startsWith('http')) {
        loadFromUrl(pastedText.trim());
    }
});

// Загрузка изображений по прямым URL (обход CORS с помощью временного создания Image)
function loadFromUrl(url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setupLoadedImage(img);
    img.onerror = () => {
        alert("Не удалось загрузить картинку по ссылке из-за ограничений безопасности (CORS) стороннего сайта. Пожалуйста, скачайте картинку на компьютер или используйте кнопку выбора файла.");
    };
    img.src = url;
}

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => setupLoadedImage(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function setupLoadedImage(img) {
    sourceImage = img;
    let targetW = img.width;
    let targetH = img.height;
    const maxDim = 256;
    if (targetW > maxDim || targetH > maxDim) {
        const ratio = targetW / targetH;
        if (targetW > targetH) {
            targetW = maxDim;
            targetH = Math.round(maxDim / ratio);
        } else {
            targetH = maxDim;
            targetW = Math.round(maxDim * ratio);
        }
    }
    widthInput.value = targetW;
    heightInput.value = targetH;
    widthVal.textContent = targetW;
    heightVal.textContent = targetH;
    
    widthInput.max = img.width * 2;
    heightInput.max = img.height * 2;

    processImage();
}

widthInput.addEventListener('input', () => {
    widthVal.textContent = widthInput.value;
    if (sourceImage) processImage();
});

heightInput.addEventListener('input', () => {
    heightVal.textContent = heightInput.value;
    if (sourceImage) processImage();
});

colorLevelsInput.addEventListener('input', () => {
    colorLevelsVal.textContent = colorLevelsInput.value;
    if (sourceImage) processImage();
});

bayerIntensityInput.addEventListener('input', () => {
    bayerIntensityVal.textContent = bayerIntensityInput.value;
    if (sourceImage) processImage();
});

ditherCheck.addEventListener('change', () => {
    if (sourceImage) processImage();
});

function processImage() {
    if (!sourceImage) return;

    const w = parseInt(widthInput.value);
    const h = parseInt(heightInput.value);
    const colorLevels = parseInt(colorLevelsInput.value);
    const bayerIntensity = parseFloat(bayerIntensityInput.value);
    const useDither = ditherCheck.checked;

    canvas.width = w;
    canvas.height = h;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(sourceImage, 0, 0, w, h);
    const imgData = tempCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const step = 255 / (colorLevels - 1);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            
            let r = data[idx];
            let g = data[idx + 1];
            let b = data[idx + 2];

            if (useDither) {
                const bayerVal = (bayerMatrix8x8[y % 8][x % 8] / 64 - 0.5) * 50 * bayerIntensity;
                r = Math.min(255, Math.max(0, r + bayerVal));
                g = Math.min(255, Math.max(0, g + bayerVal));
                b = Math.min(255, Math.max(0, b + bayerVal));
            }

            data[idx]     = Math.min(255, Math.max(0, Math.round(Math.round(r / step) * step)));
            data[idx + 1] = Math.min(255, Math.max(0, Math.round(Math.round(g / step) * step)));
            data[idx + 2] = Math.min(255, Math.max(0, Math.round(Math.round(b / step) * step)));
        }
    }

    ctx.putImageData(imgData, 0, 0);

    statRes.textContent = `${w} × ${h} px`;
    statColors.textContent = `${colorLevels} lvl/ch (${Math.pow(colorLevels, 3)} colors)`;
}

function downloadImage() {
    if (!sourceImage) return;
    const link = document.createElement('a');
    link.download = `psx-texture-${widthInput.value}x${heightInput.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

downloadBtn.addEventListener('click', downloadImage);
downloadTopBtn.addEventListener('click', downloadImage);

const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 64;
sampleCanvas.height = 64;
const sCtx = sampleCanvas.getContext('2d');
const grad = sCtx.createLinearGradient(0, 0, 64, 64);
grad.addColorStop(0, '#ff4757');
grad.addColorStop(0.5, '#2ed573');
grad.addColorStop(1, '#1e90ff');
sCtx.fillStyle = grad;
sCtx.fillRect(0, 0, 64, 64);
const sampleImg = new Image();
sampleImg.onload = () => {
    sourceImage = sampleImg;
    processImage();
};
sampleImg.src = sampleCanvas.toDataURL();