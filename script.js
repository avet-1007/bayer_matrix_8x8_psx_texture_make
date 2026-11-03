
"use strict";

/* =========================================================
   PSX Texture Studio
   Bayer 8x8 image converter
   ========================================================= */

const BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
];

const $ = id => document.getElementById(id);

const el = {
    dropZone: $("dropZone"),
    fileInput: $("fileInput"),

    width: $("targetWidth"),
    height: $("targetHeight"),
    widthVal: $("widthVal"),
    heightVal: $("heightVal"),

    fitMode: $("fitMode"),
    lockAspect: $("lockAspectBtn"),
    lockIcon: $("lockIcon"),

    dither: $("ditherAmount"),
    ditherVal: $("ditherAmountVal"),

    colorLevels: $("colorLevels"),
    colorLevelsVal: $("colorLevelsVal"),

    palette: $("paletteMode"),

    brightness: $("brightness"),
    brightnessVal: $("brightnessVal"),

    contrast: $("contrast"),
    contrastVal: $("contrastVal"),

    saturation: $("saturation"),
    saturationVal: $("saturationVal"),

    language: $("languageSelect"),
    reset: $("resetBtn"),

    preview: $("outputCanvas"),
    viewport: $("canvasViewport"),
    placeholder: $("placeholderText"),

    previewScale: $("previewScale"),
    renderTime: $("renderTime"),

    sourceInfo: $("imageDimensionsInfo"),
    outputInfo: $("outputDimensionsInfo"),

    downloadHeader: $("headerDownloadBtn"),
    downloadToolbar: $("toolbarDownloadBtn")
};

const ctx = el.preview.getContext("2d", {
    willReadFrequently: true
});

let sourceImage = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sourceName = "image";

let aspectLocked = false;
let isRendering = false;

let currentObjectURL = null;
let renderRequest = 0;

/* =========================================================
   TRANSLATIONS
   ========================================================= */

const translations = {
    en: {
        source: "Source File",
        drop: "Drag & drop photo or browse",
        resolution: "Resolution (Pixels)",
        aspect: "Aspect Ratio",
        bayer: "Bayer & PSX Settings",
        shading: "Shading & Color Corrections",
        brightness: "Brightness",
        contrast: "Contrast",
        saturation: "Saturation",
        preview: "Live Preview",
        placeholder: "Upload or drag & drop an image to start converting",
        reset: "Reset",
        download: "Download PNG",
        fit: "Fit Mode:",
        dither: "8x8 Dither Strength",
        depth: "Color Depth (Levels/Channel)",
        palette: "Palette Mode",
        zoom: "Zoom:",
        locked: "Aspect ratio locked",
        unlocked: "Aspect ratio unlocked",
        loading: "Loading image...",
        loaded: "Image loaded",
        readError: "The image could not be read. Try another image format.",
        unsupported: "Please select a valid image file.",
        sourceLabel: "Source:",
        outputLabel: "Output:"
    },

    ru: {
        source: "Исходное изображение",
        drop: "Перетащите изображение или выберите файл",
        resolution: "Разрешение (пиксели)",
        aspect: "Соотношение сторон",
        bayer: "Настройки Bayer и PSX",
        shading: "Освещение и коррекция цвета",
        brightness: "Яркость",
        contrast: "Контраст",
        saturation: "Насыщенность",
        preview: "Предпросмотр",
        placeholder: "Загрузите изображение или перетащите его сюда",
        reset: "Сбросить",
        download: "Скачать PNG",
        fit: "Режим масштабирования:",
        dither: "Интенсивность дизеринга 8×8",
        depth: "Глубина цвета (уровней на канал)",
        palette: "Цветовая палитра",
        zoom: "Масштаб:",
        locked: "Пропорции заблокированы",
        unlocked: "Пропорции разблокированы",
        loading: "Загрузка изображения...",
        loaded: "Изображение загружено",
        readError: "Не удалось прочитать изображение. Попробуйте другой формат.",
        unsupported: "Выберите корректный файл изображения.",
        sourceLabel: "Исходное:",
        outputLabel: "Результат:"
    }
};

function tr(key) {
    const lang = el.language.value || "en";
    return translations[lang]?.[key] || translations.en[key] || key;
}

function applyLanguage() {
    const ru = el.language.value === "ru";

    $("i18n-lblSource").textContent = ru ? "Исходный файл" : "Source File";
    $("i18n-lblResolution").textContent = ru ? "Разрешение (пиксели)" : "Resolution (Pixels)";
    $("i18n-lblBayer").textContent = ru ? "Настройки Bayer и PSX" : "Bayer & PSX Settings";
    $("i18n-lblShading").textContent = ru ? "Освещение и коррекция цвета" : "Shading & Color Corrections";

    $("i18n-width").textContent = ru ? "Ширина" : "Width";
    $("i18n-height").textContent = ru ? "Высота" : "Height";

    $("i18n-aspectRatio").textContent = tr("aspect");
    $("i18n-fitMode").textContent = tr("fit");
    $("i18n-ditherStrength").textContent = tr("dither");
    $("i18n-colorDepth").textContent = tr("depth");
    $("i18n-paletteMode").textContent = tr("palette");

    $("i18n-brightness").textContent = tr("brightness");
    $("i18n-contrast").textContent = tr("contrast");
    $("i18n-saturation").textContent = tr("saturation");

    $("i18n-previewTitle").textContent = tr("preview");
    $("i18n-zoom").textContent = tr("zoom");
    $("i18n-placeholder").textContent = tr("placeholder");

    $("i18n-reset").textContent = tr("reset");
    $("i18n-downloadHeader").textContent = tr("download");
    $("i18n-downloadToolbar").textContent = tr("download");

    $("i18n-dropText").textContent = tr("drop");

    updateAspectButton();
}

/* =========================================================
   IMAGE LOADING
   ========================================================= */

function isImageFile(file) {
    if (!file) return false;

    if (file.type && file.type.startsWith("image/")) {
        return true;
    }

    const name = (file.name || "").toLowerCase();

    return /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(name);
}

function showLoading() {
    if (el.placeholder) {
        el.placeholder.classList.remove("hidden");
        $("i18n-placeholder").textContent = tr("loading");
    }
}

function showPlaceholder() {
    el.preview.classList.add("hidden");

    if (el.placeholder) {
        el.placeholder.classList.remove("hidden");
        $("i18n-placeholder").textContent = tr("placeholder");
    }

    el.downloadHeader.disabled = true;
    el.downloadToolbar.disabled = true;
}

function showPreview() {
    el.preview.classList.remove("hidden");

    if (el.placeholder) {
        el.placeholder.classList.add("hidden");
    }

    el.downloadHeader.disabled = false;
    el.downloadToolbar.disabled = false;
}

/*
 * All local image sources use this function:
 * File Explorer, Drag & Drop and clipboard.
 */
async function handleFile(file) {
    if (!file) return;

    if (!isImageFile(file)) {
        alert(tr("unsupported"));
        return;
    }

    showLoading();

    try {
        let decodedImage;

        /*
         * createImageBitmap is preferred because it reads
         * local File/Blob objects directly.
         */
        if ("createImageBitmap" in window) {
            try {
                decodedImage = await createImageBitmap(file);
            } catch (error) {
                decodedImage = await loadWithImageElement(file);
            }
        } else {
            decodedImage = await loadWithImageElement(file);
        }

        sourceImage = decodedImage;
        sourceWidth = decodedImage.width;
        sourceHeight = decodedImage.height;

        sourceName = (file.name || "image")
            .replace(/\.[^/.]+$/, "");

        if (sourceWidth <= 0 || sourceHeight <= 0) {
            throw new Error("Invalid image dimensions");
        }

        setInitialDimensions(sourceWidth, sourceHeight);

        el.sourceInfo.textContent =
            `${tr("sourceLabel")} ${sourceWidth} × ${sourceHeight}`;

        showPreview();
        renderImage();

    } catch (error) {
        console.error("Image loading error:", error);

        showPlaceholder();
        alert(tr("readError"));
    }
}

/*
 * Fallback for browsers that cannot decode with createImageBitmap.
 */
function loadWithImageElement(file) {
    return new Promise((resolve, reject) => {
        const objectURL = URL.createObjectURL(file);

        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(objectURL);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error("Image decoding failed"));
        };

        img.src = objectURL;
    });
}

function setInitialDimensions(width, height) {
    const maxDimension = 256;

    let w = width;
    let h = height;

    if (w > maxDimension || h > maxDimension) {
        const scale = maxDimension / Math.max(w, h);

        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
    }

    el.width.value = w;
    el.height.value = h;

    el.width.max = Math.max(2048, width * 2);
    el.height.max = Math.max(2048, height * 2);

    updateDimensionLabels();
}

/* =========================================================
   FILE INPUT
   ========================================================= */

el.fileInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];

    if (file) {
        await handleFile(file);
    }

    // Allows selecting the same file again.
    event.target.value = "";
});

/*
 * Clicking anywhere inside the drop zone opens Windows Explorer.
 */
el.dropZone.addEventListener("click", event => {
    if (event.target === el.fileInput) return;

    el.fileInput.click();
});

/* =========================================================
   DRAG & DROP
   ========================================================= */

function containsFiles(event) {
    return Array.from(event.dataTransfer?.types || [])
        .includes("Files");
}

function preventFileNavigation(event) {
    if (containsFiles(event)) {
        event.preventDefault();
    }
}

window.addEventListener("dragover", preventFileNavigation);

window.addEventListener("drop", event => {
    if (!containsFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files || []);
    const imageFile = files.find(isImageFile);

    if (imageFile) {
        handleFile(imageFile);
    } else if (files.length) {
        alert(tr("unsupported"));
    }

    el.dropZone.classList.remove("drag-active");
});

el.dropZone.addEventListener("dragenter", event => {
    if (!containsFiles(event)) return;

    event.preventDefault();
    el.dropZone.classList.add("drag-active");
});

el.dropZone.addEventListener("dragover", event => {
    if (!containsFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    el.dropZone.classList.add("drag-active");
});

el.dropZone.addEventListener("dragleave", event => {
    if (!el.dropZone.contains(event.relatedTarget)) {
        el.dropZone.classList.remove("drag-active");
    }
});

el.dropZone.addEventListener("drop", event => {
    event.preventDefault();
    event.stopPropagation();

    el.dropZone.classList.remove("drag-active");
});

/* =========================================================
   CLIPBOARD
   ========================================================= */

window.addEventListener("paste", event => {
    const clipboard = event.clipboardData;

    if (!clipboard) return;

    const items = Array.from(clipboard.items || []);

    for (const item of items) {
        if (item.kind !== "file") continue;

        const file = item.getAsFile();

        if (file && isImageFile(file)) {
            event.preventDefault();
            handleFile(file);
            return;
        }
    }
});

/* =========================================================
   IMAGE PROCESSING
   ========================================================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function fitImage(context, image, width, height, mode) {
    const sw = image.width;
    const sh = image.height;

    if (mode === "stretch") {
        context.drawImage(image, 0, 0, width, height);
        return;
    }

    const scale = mode === "contain"
        ? Math.min(width / sw, height / sh)
        : Math.max(width / sw, height / sh);

    const dw = sw * scale;
    const dh = sh * scale;

    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    context.drawImage(image, dx, dy, dw, dh);
}

function adjustColor(r, g, b) {
    const brightness = Number(el.brightness.value);
    const contrast = Number(el.contrast.value);
    const saturation = Number(el.saturation.value);

    r += brightness * 1.5;
    g += brightness * 1.5;
    b += brightness * 1.5;

    const contrastFactor =
        (259 * (contrast + 255)) /
        (255 * (259 - contrast));

    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const saturationFactor = 1 + saturation / 100;

    r = gray + (r - gray) * saturationFactor;
    g = gray + (g - gray) * saturationFactor;
    b = gray + (b - gray) * saturationFactor;

    return [
        clamp(r, 0, 255),
        clamp(g, 0, 255),
        clamp(b, 0, 255)
    ];
}

function quantize(value, levels, threshold) {
    const step = 255 / (levels - 1);

    const adjusted = clamp(
        value + threshold,
        0,
        255
    );

    return clamp(
        Math.round(Math.round(adjusted / step) * step),
        0,
        255
    );
}

function applyPalette(r, g, b, x, y, levels, strength) {
    const palette = el.palette.value;

    const matrixValue = BAYER_8X8[y % 8][x % 8];

    const threshold =
        ((matrixValue + 0.5) / 64 - 0.5) *
        255 / (levels - 1) *
        strength;

    if (palette === "grayscale") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        const value = quantize(gray, levels, threshold);

        return [value, value, value];
    }

    if (palette === "gameboy") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        const tone = Math.round(
            clamp(gray + threshold, 0, 255) / 255 * 3
        );

        const shades = [15, 55, 139, 202];

        const value = shades[tone];

        return [
            value,
            value,
            value
        ];
    }

    return [
        quantize(r, levels, threshold),
        quantize(g, levels, threshold),
        quantize(b, levels, threshold)
    ];
}

function renderImage() {
    if (!sourceImage || isRendering) {
        if (!sourceImage) return;
    }

    isRendering = true;

    const requestId = ++renderRequest;
    const startTime = performance.now();

    try {
        const width = clamp(
            parseInt(el.width.value, 10) || 128,
            1,
            4096
        );

        const height = clamp(
            parseInt(el.height.value, 10) || 128,
            1,
            4096
        );

        const levels = clamp(
            parseInt(el.colorLevels.value, 10) || 8,
            2,
            32
        );

        const strength = clamp(
            Number(el.dither.value),
            0,
            1
        );

        const tempCanvas = document.createElement("canvas");

        tempCanvas.width = width;
        tempCanvas.height = height;

        const tempContext = tempCanvas.getContext("2d", {
            willReadFrequently: true
        });

        if (!tempContext) {
            throw new Error("Canvas context unavailable");
        }

        tempContext.imageSmoothingEnabled = true;
        tempContext.imageSmoothingQuality = "high";

        tempContext.fillStyle = "#000000";
        tempContext.fillRect(0, 0, width, height);

        fitImage(
            tempContext,
            sourceImage,
            width,
            height,
            el.fitMode.value
        );

        const imageData = tempContext.getImageData(
            0, 0, width, height
        );

        const pixels = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                let r = pixels[index];
                let g = pixels[index + 1];
                let b = pixels[index + 2];

                [r, g, b] = adjustColor(r, g, b);

                [r, g, b] = applyPalette(
                    r,
                    g,
                    b,
                    x,
                    y,
                    levels,
                    strength
                );

                pixels[index] = r;
                pixels[index + 1] = g;
                pixels[index + 2] = b;
            }
        }

        if (requestId !== renderRequest) return;

        el.preview.width = width;
        el.preview.height = height;

        ctx.putImageData(imageData, 0, 0);

        el.outputInfo.textContent =
            `${tr("outputLabel")} ${width} × ${height}`;

        el.renderTime.textContent =
            `Render time: ${(performance.now() - startTime).toFixed(1)} ms`;

        updatePreviewScale();

        showPreview();

    } catch (error) {
        console.error("Rendering error:", error);
    } finally {
        isRendering = false;
    }
}

/* =========================================================
   DIMENSION CONTROLS
   ========================================================= */

function updateDimensionLabels() {
    el.widthVal.textContent = `${el.width.value}px`;
    el.heightVal.textContent = `${el.height.value}px`;
}

function changeDimension(input, amount) {
    input.value = clamp(
        Number(input.value) + amount,
        1,
        4096
    );

    if (aspectLocked && sourceWidth && sourceHeight) {
        if (input === el.width) {
            el.height.value = Math.max(
                1,
                Math.round(input.value * sourceHeight / sourceWidth)
            );
        } else {
            el.width.value = Math.max(
                1,
                Math.round(input.value * sourceWidth / sourceHeight)
            );
        }
    }

    updateDimensionLabels();
    renderImage();
}

el.width.addEventListener("input", () => {
    if (aspectLocked && sourceWidth && sourceHeight) {
        el.height.value = Math.max(
            1,
            Math.round(el.width.value * sourceHeight / sourceWidth)
        );
    }

    updateDimensionLabels();
    renderImage();
});

el.height.addEventListener("input", () => {
    if (aspectLocked && sourceWidth && sourceHeight) {
        el.width.value = Math.max(
            1,
            Math.round(el.height.value * sourceWidth / sourceHeight)
        );
    }

    updateDimensionLabels();
    renderImage();
});

[
    ["wSub10", el.width, -10],
    ["wSub1", el.width, -1],
    ["wAdd1", el.width, 1],
    ["wAdd10", el.width, 10],

    ["hSub10", el.height, -10],
    ["hSub1", el.height, -1],
    ["hAdd1", el.height, 1],
    ["hAdd10", el.height, 10]
].forEach(([id, input, amount]) => {
    $(id).addEventListener("click", () => {
        changeDimension(input, amount);
    });
});

/* =========================================================
   PRESETS
   ========================================================= */

document.querySelectorAll(".preset-btn").forEach(button => {
    button.addEventListener("click", () => {
        el.width.value = button.dataset.w;
        el.height.value = button.dataset.h;

        updateDimensionLabels();
        renderImage();
    });
});

/* =========================================================
   ASPECT RATIO
   ========================================================= */

function updateAspectButton() {
    el.lockIcon.className = aspectLocked
        ? "fa-solid fa-lock text-indigo-400"
        : "fa-solid fa-lock-open text-gray-500";

    el.lockAspect.title = aspectLocked
        ? tr("locked")
        : tr("unlocked");
}

el.lockAspect.addEventListener("click", () => {
    aspectLocked = !aspectLocked;

    if (aspectLocked && sourceWidth && sourceHeight) {
        el.height.value = Math.max(
            1,
            Math.round(el.width.value * sourceHeight / sourceWidth)
        );

        updateDimensionLabels();
        renderImage();
    }

    updateAspectButton();
});

/* =========================================================
   SETTINGS
   ========================================================= */

function bindSetting(input, output, format = value => value) {
    input.addEventListener("input", () => {
        output.textContent = format(input.value);
        renderImage();
    });
}

bindSetting(el.dither, el.ditherVal, value =>
    Number(value).toFixed(2)
);

bindSetting(el.colorLevels, el.colorLevelsVal, value => {
    return `${value} (${Math.pow(Number(value), 3)} colors)`;
});

bindSetting(el.brightness, el.brightnessVal);
bindSetting(el.contrast, el.contrastVal);
bindSetting(el.saturation, el.saturationVal);

el.palette.addEventListener("change", renderImage);
el.fitMode.addEventListener("change", renderImage);

/* =========================================================
   PREVIEW ZOOM
   ========================================================= */

function updatePreviewScale() {
    if (!sourceImage) return;

    const scale = el.previewScale.value;

    if (scale === "fit") {
        el.preview.style.width = "auto";
        el.preview.style.height = "auto";
        el.preview.style.maxWidth = "100%";
        el.preview.style.maxHeight = "100%";
        return;
    }

    const multiplier = Number(scale);

    el.preview.style.width = `${el.preview.width * multiplier}px`;
    el.preview.style.height = `${el.preview.height * multiplier}px`;

    el.preview.style.maxWidth = "none";
    el.preview.style.maxHeight = "none";
}

el.previewScale.addEventListener("change", updatePreviewScale);

/* =========================================================
   EXPORT PNG
   ========================================================= */

function downloadImage() {
    if (!sourceImage || !el.preview.width) return;

    el.preview.toBlob(blob => {
        if (!blob) {
            alert("PNG export failed.");
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download =
            `psx-${sourceName}-${el.preview.width}x${el.preview.height}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
}

el.downloadHeader.addEventListener("click", downloadImage);
el.downloadToolbar.addEventListener("click", downloadImage);

/* =========================================================
   RESET
   ========================================================= */

el.reset.addEventListener("click", () => {
    el.width.value = 128;
    el.height.value = 128;

    el.dither.value = 0.8;
    el.colorLevels.value = 8;

    el.brightness.value = 0;
    el.contrast.value = 0;
    el.saturation.value = 0;

    el.palette.value = "rgb";
    el.fitMode.value = "cover";
    el.previewScale.value = "3";

    aspectLocked = false;

    el.ditherVal.textContent = "0.80";
    el.colorLevelsVal.textContent = "8 (512 colors)";

    el.brightnessVal.textContent = "0";
    el.contrastVal.textContent = "0";
    el.saturationVal.textContent = "0";

    updateDimensionLabels();
    updateAspectButton();

    renderImage();
});

/* =========================================================
   LANGUAGE
   ========================================================= */

el.language.addEventListener("change", () => {
    applyLanguage();

    if (sourceImage) {
        renderImage();
    }
});

/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {
    applyLanguage();

    updateDimensionLabels();
    updateAspectButton();

    el.ditherVal.textContent = "0.80";
    el.colorLevelsVal.textContent = "8 (512 colors)";

    el.brightnessVal.textContent = "0";
    el.contrastVal.textContent = "0";
    el.saturationVal.textContent = "0";

    showPlaceholder();

    console.log("PSX Texture Studio initialized.");
}

initialize();
