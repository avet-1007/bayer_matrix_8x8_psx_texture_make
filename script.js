
"use strict";

/* =========================================================
   PSX Texture Studio
   Bayer 8x8 Dithering
   ========================================================= */

const translations = {
    en: {
        subtitle: "Convert images to PS1 era textures with pixel precision",
        source: "Source File",
        drop: "Drag & drop photo or browse",
        resolution: "Resolution (Pixels)",
        width: "Width",
        height: "Height",
        aspect: "Aspect Ratio",
        fit: "Fit Mode:",
        stretch: "Stretch",
        contain: "Contain",
        cover: "Cover / Crop",
        bayer: "Bayer & PSX Settings",
        dither: "8x8 Dither Strength",
        depth: "Color Depth (Levels/Channel)",
        rgb: "Per-Channel RGB Quantization",
        gray: "Grayscale (Monochrome PSX)",
        gameboy: "Retro GameBoy (4 Tones)",
        shading: "Shading & Color Corrections",
        brightness: "Brightness",
        contrast: "Contrast",
        saturation: "Saturation",
        preview: "Live Preview",
        zoom: "Zoom:",
        fitZoom: "Auto Fit",
        placeholder: "Upload or drag & drop an image to start converting",
        reset: "Reset",
        download: "Download PNG",
        sourceLabel: "Source:",
        outputLabel: "Output:",
        loading: "Loading image...",
        unsupported: "This file is not a supported image.",
        readError: "The browser could not decode this image. It may use an unsupported format or be damaged.",
        noImage: "Load an image first.",
        renderError: "Image processing failed.",
        aspectLocked: "Aspect ratio locked",
        aspectUnlocked: "Aspect ratio unlocked",
        renderTime: "Render time:"
    },

    ru: {
        subtitle: "Преобразование изображений в текстуры в стиле PS1",
        source: "Исходное изображение",
        drop: "Перетащите изображение или выберите файл",
        resolution: "Разрешение (пиксели)",
        width: "Ширина",
        height: "Высота",
        aspect: "Соотношение сторон",
        fit: "Режим масштабирования:",
        stretch: "Растянуть",
        contain: "Вписать",
        cover: "Заполнить / Обрезать",
        bayer: "Настройки Bayer и PSX",
        dither: "Интенсивность дизеринга 8×8",
        depth: "Глубина цвета (уровней на канал)",
        rgb: "Поканальная RGB-квантизация",
        gray: "Оттенки серого",
        gameboy: "Game Boy (4 оттенка)",
        shading: "Освещение и коррекция цвета",
        brightness: "Яркость",
        contrast: "Контраст",
        saturation: "Насыщенность",
        preview: "Предпросмотр",
        zoom: "Масштаб:",
        fitZoom: "Автоматически",
        placeholder: "Загрузите или перетащите изображение сюда",
        reset: "Сбросить",
        download: "Скачать PNG",
        sourceLabel: "Исходное:",
        outputLabel: "Результат:",
        loading: "Загрузка изображения...",
        unsupported: "Этот файл не является поддерживаемым изображением.",
        readError: "Браузер не смог прочитать изображение. Возможно, его формат не поддерживается или файл повреждён.",
        noImage: "Сначала загрузите изображение.",
        renderError: "Ошибка обработки изображения.",
        aspectLocked: "Пропорции заблокированы",
        aspectUnlocked: "Пропорции разблокированы",
        renderTime: "Время обработки:"
    }
};

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const $ = id => document.getElementById(id);

const ui = {
    language: $("languageSelect"),

    dropZone: $("dropZone"),
    fileInput: $("fileInput"),

    width: $("targetWidth"),
    height: $("targetHeight"),
    widthVal: $("widthVal"),
    heightVal: $("heightVal"),

    lockAspect: $("lockAspectBtn"),
    lockIcon: $("lockIcon"),

    fitMode: $("fitMode"),

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

const ctx = ui.preview.getContext("2d", {
    willReadFrequently: true
});

if (!ctx) {
    throw new Error("Canvas 2D context is unavailable.");
}

/* =========================================================
   APPLICATION STATE
   ========================================================= */

let sourceImage = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sourceName = "texture";

let aspectLocked = false;
let currentLanguage = "en";

let renderScheduled = false;
let isLoading = false;

let currentLoadId = 0;

/* =========================================================
   BAYER 8x8 MATRIX
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

/* =========================================================
   HELPERS
   ========================================================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getText(key) {
    return translations[currentLanguage][key] ||
        translations.en[key] ||
        key;
}

function setText(id, key) {
    const element = $(id);
    if (element) element.textContent = getText(key);
}

/* =========================================================
   LANGUAGE
   ========================================================= */

function updateLanguage() {
    currentLanguage = ui.language.value === "ru" ? "ru" : "en";

    setText("i18n-subtitle", "subtitle");
    setText("i18n-lblSource", "source");
    setText("i18n-dropText", "drop");

    setText("i18n-lblResolution", "resolution");
    setText("i18n-width", "width");
    setText("i18n-height", "height");
    setText("i18n-aspectRatio", "aspect");

    setText("i18n-fitMode", "fit");
    setText("i18n-fitStretch", "stretch");
    setText("i18n-fitContain", "contain");
    setText("i18n-fitCover", "cover");

    setText("i18n-lblBayer", "bayer");
    setText("i18n-ditherStrength", "dither");
    setText("i18n-colorDepth", "depth");

    setText("i18n-palRGB", "rgb");
    setText("i18n-palGray", "gray");
    setText("i18n-palGB", "gameboy");

    setText("i18n-lblShading", "shading");
    setText("i18n-brightness", "brightness");
    setText("i18n-contrast", "contrast");
    setText("i18n-saturation", "saturation");

    setText("i18n-previewTitle", "preview");
    setText("i18n-zoom", "zoom");
    setText("i18n-zoomFit", "fitZoom");

    setText("i18n-placeholder", "placeholder");
    setText("i18n-reset", "reset");
    setText("i18n-downloadHeader", "download");
    setText("i18n-downloadToolbar", "download");

    updateAspectButton();
}

ui.language.addEventListener("change", updateLanguage);

/* =========================================================
   IMAGE FORMAT CHECK
   ========================================================= */

function isImageFile(file) {
    if (!file) return false;

    if (file.type && file.type.startsWith("image/")) {
        return true;
    }

    const name = file.name || "";

    return /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(name);
}

/* =========================================================
   IMAGE DECODING
   ========================================================= */

/*
 * First attempt: createImageBitmap.
 * Fallback: HTML Image + Object URL.
 *
 * This avoids relying on FileReader alone.
 */

function decodeImageFile(file) {
    return new Promise(async (resolve, reject) => {
        if (typeof createImageBitmap === "function") {
            try {
                const bitmap = await createImageBitmap(file);

                if (bitmap.width > 0 && bitmap.height > 0) {
                    resolve(bitmap);
                    return;
                }

                bitmap.close();
            } catch (error) {
                console.warn("createImageBitmap failed:", error);
            }
        }

        const objectURL = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectURL);

            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                resolve(image);
            } else {
                reject(new Error("Image has invalid dimensions."));
            }
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error("Browser image decoder rejected this file."));
        };

        image.src = objectURL;
    });
}

/* =========================================================
   IMAGE LOADING
   ========================================================= */

async function handleFile(file) {
    if (!file) return;

    if (!isImageFile(file)) {
        alert(getText("unsupported"));
        return;
    }

    const loadId = ++currentLoadId;

    isLoading = true;

    ui.placeholder.classList.remove("hidden");
    ui.preview.classList.add("hidden");

    $("i18n-placeholder").textContent = getText("loading");

    try {
        const decoded = await decodeImageFile(file);

        /*
         * Ignore old requests if the user selected
         * another file before decoding finished.
         */
        if (loadId !== currentLoadId) {
            if (decoded instanceof ImageBitmap) {
                decoded.close();
            }
            return;
        }

        if (sourceImage instanceof ImageBitmap) {
            sourceImage.close();
        }

        sourceImage = decoded;

        sourceWidth = decoded.width || decoded.naturalWidth;
        sourceHeight = decoded.height || decoded.naturalHeight;

        sourceName = (file.name || "texture")
            .replace(/\.[^/.]+$/, "");

        if (!sourceWidth || !sourceHeight) {
            throw new Error("Invalid image dimensions.");
        }

        setInitialResolution();

        ui.sourceInfo.textContent =
            `${getText("sourceLabel")} ${sourceWidth} × ${sourceHeight}`;

        ui.preview.classList.remove("hidden");
        ui.placeholder.classList.add("hidden");

        ui.downloadHeader.disabled = false;
        ui.downloadToolbar.disabled = false;

        renderImage();

    } catch (error) {
        console.error("Image loading failed:", error);

        if (loadId === currentLoadId) {
            sourceImage = null;

            ui.preview.classList.add("hidden");
            ui.placeholder.classList.remove("hidden");

            $("i18n-placeholder").textContent = getText("placeholder");

            ui.downloadHeader.disabled = true;
            ui.downloadToolbar.disabled = true;

            alert(
                `${getText("readError")}\n\n` +
                `File: ${file.name || "unknown"}\n` +
                `Type: ${file.type || "unknown"}\n` +
                `Size: ${file.size} bytes`
            );
        }
    } finally {
        if (loadId === currentLoadId) {
            isLoading = false;
        }
    }
}

/* =========================================================
   INITIAL RESOLUTION
   ========================================================= */

function setInitialResolution() {
    let width = sourceWidth;
    let height = sourceHeight;

    const maxDimension = 256;

    if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);

        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
    }

    ui.width.value = width;
    ui.height.value = height;

    ui.width.max = Math.max(2048, sourceWidth * 2);
    ui.height.max = Math.max(2048, sourceHeight * 2);

    updateDimensionLabels();
}

/* =========================================================
   FILE INPUT
   ========================================================= */

ui.fileInput.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (file) {
        handleFile(file);
    }

    /*
     * Reset the input so the same file can be selected again.
     */
    event.target.value = "";
});

/* =========================================================
   DROP ZONE CLICK
   ========================================================= */

ui.dropZone.addEventListener("click", event => {
    if (event.target === ui.fileInput) return;

    ui.fileInput.click();
});

/* =========================================================
   DRAG & DROP
   ========================================================= */

function dragContainsFiles(event) {
    return Array.from(event.dataTransfer?.types || [])
        .includes("Files");
}

window.addEventListener("dragover", event => {
    if (dragContainsFiles(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }
});

window.addEventListener("dragenter", event => {
    if (dragContainsFiles(event)) {
        event.preventDefault();
        ui.dropZone.classList.add("border-indigo-500");
    }
});

window.addEventListener("dragleave", event => {
    if (!event.relatedTarget) {
        ui.dropZone.classList.remove("border-indigo-500");
    }
});

window.addEventListener("drop", event => {
    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        ui.dropZone.classList.remove("border-indigo-500");

        const imageFile = files.find(isImageFile);

        if (imageFile) {
            handleFile(imageFile);
        } else {
            alert(getText("unsupported"));
        }

        return;
    }

    const text =
        event.dataTransfer?.getData("text/uri-list") ||
        event.dataTransfer?.getData("text/plain") ||
        "";

    if (text.trim().startsWith("http")) {
        event.preventDefault();
        event.stopPropagation();
        loadFromURL(text.trim().split("\n")[0]);
    }
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

        if (file) {
            event.preventDefault();
            handleFile(file);
            return;
        }
    }

    const text = clipboard.getData("text/plain");

    if (text && text.trim().startsWith("http")) {
        event.preventDefault();
        loadFromURL(text.trim());
    }
});

/* =========================================================
   IMAGE URL LOADING
   ========================================================= */

function loadFromURL(url) {
    const image = new Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
        if (sourceImage instanceof ImageBitmap) {
            sourceImage.close();
        }

        sourceImage = image;

        sourceWidth = image.naturalWidth;
        sourceHeight = image.naturalHeight;

        sourceName = "texture";

        setInitialResolution();

        ui.sourceInfo.textContent =
            `${getText("sourceLabel")} ${sourceWidth} × ${sourceHeight}`;

        ui.preview.classList.remove("hidden");
        ui.placeholder.classList.add("hidden");

        ui.downloadHeader.disabled = false;
        ui.downloadToolbar.disabled = false;

        renderImage();
    };

    image.onerror = () => {
        alert(
            "Could not load this image URL. " +
            "The remote server may block access through CORS."
        );
    };

    image.src = url;
}

/* =========================================================
   IMAGE FITTING
   ========================================================= */

function drawFittedImage(context, image, width, height, mode) {
    const sourceW = image.width || image.naturalWidth;
    const sourceH = image.height || image.naturalHeight;

    if (mode === "stretch") {
        context.drawImage(image, 0, 0, width, height);
        return;
    }

    const scale = mode === "contain"
        ? Math.min(width / sourceW, height / sourceH)
        : Math.max(width / sourceW, height / sourceH);

    const drawW = sourceW * scale;
    const drawH = sourceH * scale;

    const x = (width - drawW) / 2;
    const y = (height - drawH) / 2;

    context.drawImage(image, x, y, drawW, drawH);
}

/* =========================================================
   COLOR CORRECTION
   ========================================================= */

function adjustColor(r, g, b) {
    const brightness = Number(ui.brightness.value);
    const contrast = Number(ui.contrast.value);
    const saturation = Number(ui.saturation.value);

    const brightnessOffset = brightness * 1.5;

    r += brightnessOffset;
    g += brightnessOffset;
    b += brightnessOffset;

    const factor =
        (259 * (contrast + 255)) /
        (255 * (259 - contrast));

    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    const gray =
        0.299 * r +
        0.587 * g +
        0.114 * b;

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

/* =========================================================
   BAYER DITHERING AND QUANTIZATION
   ========================================================= */

function quantize(value, levels, threshold) {
    const step = 255 / (levels - 1);

    const adjusted = clamp(value + threshold, 0, 255);

    return clamp(
        Math.round(adjusted / step) * step,
        0,
        255
    );
}

function processPixel(r, g, b, x, y, levels, strength) {
    const matrixValue = BAYER_8X8[y % 8][x % 8];

    const threshold =
        ((matrixValue + 0.5) / 64 - 0.5) *
        (255 / (levels - 1)) *
        strength;

    const palette = ui.palette.value;

    if (palette === "grayscale") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const value = quantize(gray, levels, threshold);

        return [value, value, value];
    }

    if (palette === "gameboy") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        const tone = clamp(
            Math.round((gray + threshold) / 255 * 3),
            0,
            3
        );

        const shades = [
            [15, 56, 15],
            [48, 98, 48],
            [139, 172, 15],
            [202, 220, 159]
        ];

        return shades[tone];
    }

    return [
        quantize(r, levels, threshold),
        quantize(g, levels, threshold),
        quantize(b, levels, threshold)
    ];
}

/* =========================================================
   MAIN IMAGE RENDERER
   ========================================================= */

function renderImage() {
    if (!sourceImage) return;

    const startTime = performance.now();

    try {
        const width = clamp(
            parseInt(ui.width.value, 10) || 128,
            1,
            2048
        );

        const height = clamp(
            parseInt(ui.height.value, 10) || 128,
            1,
            2048
        );

        const levels = clamp(
            parseInt(ui.colorLevels.value, 10) || 8,
            2,
            32
        );

        const strength = clamp(
            Number(ui.dither.value),
            0,
            1
        );

        const tempCanvas = document.createElement("canvas");

        tempCanvas.width = width;
        tempCanvas.height = height;

        const tempCtx = tempCanvas.getContext("2d", {
            willReadFrequently: true
        });

        if (!tempCtx) {
            throw new Error("Temporary canvas is unavailable.");
        }

        tempCtx.clearRect(0, 0, width, height);
        tempCtx.fillStyle = "#000000";
        tempCtx.fillRect(0, 0, width, height);

        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = "high";

        drawFittedImage(
            tempCtx,
            sourceImage,
            width,
            height,
            ui.fitMode.value
        );

        const imageData = tempCtx.getImageData(
            0,
            0,
            width,
            height
        );

        const pixels = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                let r = pixels[index];
                let g = pixels[index + 1];
                let b = pixels[index + 2];

                [r, g, b] = adjustColor(r, g, b);

                [r, g, b] = processPixel(
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

        ui.preview.width = width;
        ui.preview.height = height;

        ctx.putImageData(imageData, 0, 0);

        ui.outputInfo.textContent =
            `${getText("outputLabel")} ${width} × ${height}`;

        ui.renderTime.textContent =
            `${getText("renderTime")} ${(performance.now() - startTime).toFixed(1)} ms`;

        updatePreviewScale();

    } catch (error) {
        console.error("Render error:", error);
        alert(`${getText("renderError")}\n${error.message}`);
    }
}

/* =========================================================
   RENDER SCHEDULER
   ========================================================= */

function requestRender() {
    if (renderScheduled) return;

    renderScheduled = true;

    requestAnimationFrame(() => {
        renderScheduled = false;
        renderImage();
    });
}

/* =========================================================
   DIMENSIONS
   ========================================================= */

function updateDimensionLabels() {
    ui.widthVal.textContent = `${ui.width.value}px`;
    ui.heightVal.textContent = `${ui.height.value}px`;
}

function changeDimension(input, amount) {
    input.value = clamp(
        Number(input.value) + amount,
        1,
        2048
    );

    if (aspectLocked && sourceWidth && sourceHeight) {
        if (input === ui.width) {
            ui.height.value = Math.max(
                1,
                Math.round(Number(input.value) * sourceHeight / sourceWidth)
            );
        } else {
            ui.width.value = Math.max(
                1,
                Math.round(Number(input.value) * sourceWidth / sourceHeight)
            );
        }
    }

    updateDimensionLabels();
    requestRender();
}

ui.width.addEventListener("input", () => {
    if (aspectLocked && sourceWidth && sourceHeight) {
        ui.height.value = Math.max(
            1,
            Math.round(Number(ui.width.value) * sourceHeight / sourceWidth)
        );
    }

    updateDimensionLabels();
    requestRender();
});

ui.height.addEventListener("input", () => {
    if (aspectLocked && sourceWidth && sourceHeight) {
        ui.width.value = Math.max(
            1,
            Math.round(Number(ui.height.value) * sourceWidth / sourceHeight)
        );
    }

    updateDimensionLabels();
    requestRender();
});

/* =========================================================
   DIMENSION BUTTONS
   ========================================================= */

const dimensionButtons = [
    ["wSub10", ui.width, -10],
    ["wSub1", ui.width, -1],
    ["wAdd1", ui.width, 1],
    ["wAdd10", ui.width, 10],

    ["hSub10", ui.height, -10],
    ["hSub1", ui.height, -1],
    ["hAdd1", ui.height, 1],
    ["hAdd10", ui.height, 10]
];

for (const [id, input, amount] of dimensionButtons) {
    $(id).addEventListener("click", () => {
        changeDimension(input, amount);
    });
}

/* =========================================================
   QUICK PRESETS
   ========================================================= */

document.querySelectorAll(".preset-btn").forEach(button => {
    button.addEventListener("click", () => {
        ui.width.value = button.dataset.w;
        ui.height.value = button.dataset.h;

        updateDimensionLabels();
        requestRender();
    });
});

/* =========================================================
   ASPECT RATIO LOCK
   ========================================================= */

function updateAspectButton() {
    ui.lockIcon.className = aspectLocked
        ? "fa-solid fa-lock text-indigo-400"
        : "fa-solid fa-lock-open text-gray-500";

    ui.lockAspect.title = aspectLocked
        ? getText("aspectLocked")
        : getText("aspectUnlocked");
}

ui.lockAspect.addEventListener("click", () => {
    aspectLocked = !aspectLocked;

    if (aspectLocked && sourceWidth && sourceHeight) {
        ui.height.value = Math.max(
            1,
            Math.round(Number(ui.width.value) * sourceHeight / sourceWidth)
        );

        updateDimensionLabels();
        requestRender();
    }

    updateAspectButton();
});

/* =========================================================
   SETTINGS
   ========================================================= */

function bindSetting(input, output, formatter = value => value) {
    input.addEventListener("input", () => {
        output.textContent = formatter(input.value);
        requestRender();
    });
}

bindSetting(
    ui.dither,
    ui.ditherVal,
    value => Number(value).toFixed(2)
);

bindSetting(
    ui.colorLevels,
    ui.colorLevelsVal,
    value => `${value} (${Math.pow(Number(value), 3)} colors)`
);

bindSetting(ui.brightness, ui.brightnessVal);
bindSetting(ui.contrast, ui.contrastVal);
bindSetting(ui.saturation, ui.saturationVal);

ui.palette.addEventListener("change", requestRender);
ui.fitMode.addEventListener("change", requestRender);

/* =========================================================
   PREVIEW ZOOM
   ========================================================= */

function updatePreviewScale() {
    const scale = ui.previewScale.value;

    if (scale === "fit") {
        ui.preview.style.width = "auto";
        ui.preview.style.height = "auto";
        ui.preview.style.maxWidth = "100%";
        ui.preview.style.maxHeight = "100%";
        return;
    }

    const multiplier = Number(scale);

    ui.preview.style.width =
        `${ui.preview.width * multiplier}px`;

    ui.preview.style.height =
        `${ui.preview.height * multiplier}px`;

    ui.preview.style.maxWidth = "none";
    ui.preview.style.maxHeight = "none";
}

ui.previewScale.addEventListener("change", updatePreviewScale);

/* =========================================================
   PNG EXPORT
   ========================================================= */

function downloadImage() {
    if (!sourceImage) {
        alert(getText("noImage"));
        return;
    }

    ui.preview.toBlob(blob => {
        if (!blob) {
            alert("PNG export failed.");
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;

        link.download =
            `psx-${sourceName}-${ui.preview.width}x${ui.preview.height}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1500);

    }, "image/png");
}

ui.downloadHeader.addEventListener("click", downloadImage);
ui.downloadToolbar.addEventListener("click", downloadImage);

/* =========================================================
   RESET
   ========================================================= */

ui.reset.addEventListener("click", () => {
    ui.width.value = 128;
    ui.height.value = 128;

    ui.dither.value = 0.8;
    ui.colorLevels.value = 8;

    ui.brightness.value = 0;
    ui.contrast.value = 0;
    ui.saturation.value = 0;

    ui.fitMode.value = "cover";
    ui.palette.value = "rgb";
    ui.previewScale.value = "3";

    aspectLocked = false;

    ui.ditherVal.textContent = "0.80";
    ui.colorLevelsVal.textContent = "8 (512 colors)";

    ui.brightnessVal.textContent = "0";
    ui.contrastVal.textContent = "0";
    ui.saturationVal.textContent = "0";

    updateDimensionLabels();
    updateAspectButton();

    requestRender();
});

/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {
    ui.downloadHeader.disabled = true;
    ui.downloadToolbar.disabled = true;

    ui.width.value = 128;
    ui.height.value = 128;

    ui.ditherVal.textContent = "0.80";
    ui.colorLevelsVal.textContent = "8 (512 colors)";

    updateDimensionLabels();
    updateLanguage();

    ui.sourceInfo.textContent =
        `${getText("sourceLabel")} -`;

    ui.outputInfo.textContent =
        `${getText("outputLabel")} -`;

    ui.preview.classList.add("hidden");
    ui.placeholder.classList.remove("hidden");

    console.log("PSX Texture Studio initialized successfully.");
}

initialize();
