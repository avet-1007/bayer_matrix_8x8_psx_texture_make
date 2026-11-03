
(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const elements = {
        dropZone: $("dropZone"),
        fileInput: $("fileInput"),
        languageSelect: $("languageSelect"),
        resetBtn: $("resetBtn"),
        headerDownloadBtn: $("headerDownloadBtn"),
        toolbarDownloadBtn: $("toolbarDownloadBtn"),
        targetWidth: $("targetWidth"),
        targetHeight: $("targetHeight"),
        widthVal: $("widthVal"),
        heightVal: $("heightVal"),
        fitMode: $("fitMode"),
        ditherAmount: $("ditherAmount"),
        ditherAmountVal: $("ditherAmountVal"),
        colorLevels: $("colorLevels"),
        colorLevelsVal: $("colorLevelsVal"),
        paletteMode: $("paletteMode"),
        brightness: $("brightness"),
        brightnessVal: $("brightnessVal"),
        contrast: $("contrast"),
        contrastVal: $("contrastVal"),
        saturation: $("saturation"),
        saturationVal: $("saturationVal"),
        previewScale: $("previewScale"),
        lockAspectBtn: $("lockAspectBtn"),
        lockIcon: $("lockIcon"),
        aspectRatioText: $("i18n-aspectRatio"),
        outputCanvas: $("outputCanvas"),
        placeholderText: $("placeholderText"),
        renderTime: $("renderTime"),
        imageDimensionsInfo: $("imageDimensionsInfo"),
        outputDimensionsInfo: $("outputDimensionsInfo")
    };

    const requiredIds = [
        "dropZone",
        "fileInput",
        "languageSelect",
        "targetWidth",
        "targetHeight",
        "outputCanvas",
        "toolbarDownloadBtn",
        "headerDownloadBtn"
    ];

    const missing = requiredIds.filter((id) => !$(id));

    if (missing.length) {
        console.error(
            "Missing HTML elements:",
            missing
        );
        return;
    }

    const ctx = elements.outputCanvas.getContext(
        "2d",
        { willReadFrequently: true }
    );

    if (!ctx) {
        console.error("Canvas 2D is not supported.");
        return;
    }

    const bayerMatrix8x8 = [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21]
    ];

    const defaults = {
        width: 128,
        height: 128,
        fitMode: "cover",
        ditherAmount: 0.8,
        colorLevels: 8,
        paletteMode: "rgb",
        brightness: 0,
        contrast: 0,
        saturation: 0,
        previewScale: "3"
    };

    let sourceImage = null;
    let sourceName = "image";
    let sourceAspect = 1;
    let lockAspect = false;
    let currentObjectUrl = null;
    let renderQueued = false;

    let currentLang =
        elements.languageSelect.value || "en";

    const translations = {
        en: {
            loaded: "Image loaded",
            source: "Source",
            output: "Output",
            render: "Render time",
            aspect: "Aspect Ratio",
            drop: "Drop an image here or click to browse",
            invalid: "Please choose a valid image file.",
            readError: "The image could not be read.",
            pasteHint: "Image pasted from clipboard"
        },

        ru: {
            loaded: "Изображение загружено",
            source: "Исходное",
            output: "Результат",
            render: "Время обработки",
            aspect: "Пропорции",
            drop: "Перетащите изображение сюда или нажмите для выбора",
            invalid: "Выберите корректный файл изображения.",
            readError: "Не удалось прочитать изображение.",
            pasteHint: "Изображение вставлено из буфера обмена"
        }
    };

    function t(key) {
        return (
            translations[currentLang]?.[key] ||
            translations.en[key] ||
            key
        );
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function safeDimension(value, fallback) {
        const number = Math.round(Number(value));

        return Number.isFinite(number)
            ? clamp(number, 1, 2048)
            : fallback;
    }

    function updateDimensionLabels() {
        if (elements.widthVal) {
            elements.widthVal.textContent =
                `${elements.targetWidth.value}px`;
        }

        if (elements.heightVal) {
            elements.heightVal.textContent =
                `${elements.targetHeight.value}px`;
        }
    }

    function updateValueLabels() {
        if (elements.ditherAmountVal) {
            elements.ditherAmountVal.textContent =
                Number(elements.ditherAmount.value).toFixed(2);
        }

        if (elements.colorLevelsVal) {
            const levels = Number(elements.colorLevels.value);

            elements.colorLevelsVal.textContent =
                `${levels} (${levels === 8 ? "15-bit PSX" : "levels/channel"})`;
        }

        if (elements.brightnessVal) {
            elements.brightnessVal.textContent =
                elements.brightness.value;
        }

        if (elements.contrastVal) {
            elements.contrastVal.textContent =
                elements.contrast.value;
        }

        if (elements.saturationVal) {
            elements.saturationVal.textContent =
                elements.saturation.value;
        }
    }

    function updateAspectButton() {
        if (!elements.lockAspectBtn) return;

        if (elements.lockIcon) {
            elements.lockIcon.className = lockAspect
                ? "fa-solid fa-lock text-indigo-400"
                : "fa-solid fa-lock-open text-gray-500";
        }

        if (elements.aspectRatioText) {
            elements.aspectRatioText.textContent = t("aspect");
        }

        elements.lockAspectBtn.setAttribute(
            "aria-pressed",
            String(lockAspect)
        );
    }

    function updateCanvasScale() {
        const canvas = elements.outputCanvas;

        const scale = elements.previewScale
            ? elements.previewScale.value
            : "3";

        canvas.style.width = "";
        canvas.style.height = "";
        canvas.style.maxWidth = "100%";
        canvas.style.maxHeight = "100%";

        if (scale === "fit") {
            canvas.style.width = "auto";
            canvas.style.height = "auto";
            canvas.style.maxWidth = "100%";
            canvas.style.maxHeight = "100%";
        } else {
            const multiplier = clamp(
                Number(scale) || 3,
                1,
                4
            );

            canvas.style.width =
                `${canvas.width * multiplier}px`;

            canvas.style.height =
                `${canvas.height * multiplier}px`;

            canvas.style.maxWidth = "none";
            canvas.style.maxHeight = "none";
        }
    }

    function showLoadedImage() {
        elements.outputCanvas.classList.remove("hidden");

        if (elements.placeholderText) {
            elements.placeholderText.classList.add("hidden");
        }

        elements.headerDownloadBtn.disabled = false;
        elements.toolbarDownloadBtn.disabled = false;
    }

    function showEmptyState() {
        elements.outputCanvas.classList.add("hidden");

        if (elements.placeholderText) {
            elements.placeholderText.classList.remove("hidden");
        }

        elements.headerDownloadBtn.disabled = true;
        elements.toolbarDownloadBtn.disabled = true;
    }

    function setStatus(message) {
        const node = $("i18n-placeholder");

        if (node && !sourceImage) {
            node.textContent = message;
        }
    }

    // Main image loading function.
    function loadImageFromBlob(blob, name) {
        if (
            !(blob instanceof Blob) ||
            !blob.type.startsWith("image/")
        ) {
            alert(t("invalid"));
            return;
        }

        const imageUrl = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }

            currentObjectUrl = imageUrl;

            sourceImage = image;

            sourceName =
                (name || "image").replace(/\.[^.]+$/, "") ||
                "image";

            sourceAspect =
                image.naturalWidth / image.naturalHeight;

            let width = image.naturalWidth;
            let height = image.naturalHeight;

            const maxDimension = 256;

            if (Math.max(width, height) > maxDimension) {
                const factor =
                    maxDimension / Math.max(width, height);

                width = Math.max(
                    1,
                    Math.round(width * factor)
                );

                height = Math.max(
                    1,
                    Math.round(height * factor)
                );
            }

            elements.targetWidth.value = width;
            elements.targetHeight.value = height;

            updateDimensionLabels();

            if (elements.imageDimensionsInfo) {
                elements.imageDimensionsInfo.textContent =
                    `${t("source")}: ${image.naturalWidth} × ${image.naturalHeight}`;
            }

            showLoadedImage();
            renderImage();
        };

        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            alert(t("readError"));
        };

        image.src = imageUrl;
    }

    // Unified file handler.
    function handleFile(file) {
        if (!file) return;

        loadImageFromBlob(
            file,
            file.name || "pasted-image"
        );
    }

    function handleFileList(fileList) {
        if (!fileList || !fileList.length) return;

        const imageFile = Array.from(fileList).find(
            file =>
                file.type &&
                file.type.startsWith("image/")
        );

        if (imageFile) {
            handleFile(imageFile);
        } else {
            alert(t("invalid"));
        }
    }

    // Loading an image from a direct URL.
    function loadImageFromUrl(rawUrl) {
        const url = String(rawUrl || "").trim();

        if (!/^https?:\/\//i.test(url)) {
            return;
        }

        const image = new Image();

        image.crossOrigin = "anonymous";

        image.onload = () => {
            sourceImage = image;
            sourceName = "image-from-url";

            sourceAspect =
                image.naturalWidth / image.naturalHeight;

            let width = image.naturalWidth;
            let height = image.naturalHeight;

            const factor = Math.min(
                1,
                256 / Math.max(width, height)
            );

            width = Math.max(
                1,
                Math.round(width * factor)
            );

            height = Math.max(
                1,
                Math.round(height * factor)
            );

            elements.targetWidth.value = width;
            elements.targetHeight.value = height;

            updateDimensionLabels();

            if (elements.imageDimensionsInfo) {
                elements.imageDimensionsInfo.textContent =
                    `${t("source")}: ${image.naturalWidth} × ${image.naturalHeight}`;
            }

            showLoadedImage();
            renderImage();
        };

        image.onerror = () => {
            alert(
                currentLang === "ru"
                    ? "Не удалось загрузить изображение по URL. Возможно, сайт запрещает доступ через CORS."
                    : "Could not load the image URL. The remote site may block access through CORS."
            );
        };

        image.src = url;
    }

    function drawSourceToCanvas(
        targetContext,
        width,
        height
    ) {
        const mode = elements.fitMode
            ? elements.fitMode.value
            : "cover";

        const sourceWidth = sourceImage.naturalWidth;
        const sourceHeight = sourceImage.naturalHeight;

        if (mode === "stretch") {
            targetContext.drawImage(
                sourceImage,
                0,
                0,
                width,
                height
            );

            return;
        }

        const scale = mode === "contain"
            ? Math.min(
                width / sourceWidth,
                height / sourceHeight
            )
            : Math.max(
                width / sourceWidth,
                height / sourceHeight
            );

        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;

        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        if (mode === "contain") {
            targetContext.clearRect(
                0,
                0,
                width,
                height
            );
        }

        targetContext.drawImage(
            sourceImage,
            x,
            y,
            drawWidth,
            drawHeight
        );
    }

    function applyColorAdjustments(r, g, b) {
        const brightness =
            Number(elements.brightness?.value || 0) * 2.55;

        const contrastValue =
            Number(elements.contrast?.value || 0);

        const contrastFactor =
            (259 * (contrastValue + 255)) /
            (255 * (259 - contrastValue));

        r += brightness;
        g += brightness;
        b += brightness;

        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        const saturation =
            1 + Number(elements.saturation?.value || 0) / 100;

        const gray =
            0.299 * r +
            0.587 * g +
            0.114 * b;

        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;

        return [
            clamp(r, 0, 255),
            clamp(g, 0, 255),
            clamp(b, 0, 255)
        ];
    }

    function quantize(value, levels) {
        const step = 255 / (levels - 1);

        return clamp(
            Math.round(Math.round(value / step) * step),
            0,
            255
        );
    }

    // Main PSX image renderer.
    function renderImage() {
        if (!sourceImage) return;

        const startTime = performance.now();

        const width = safeDimension(
            elements.targetWidth.value,
            128
        );

        const height = safeDimension(
            elements.targetHeight.value,
            128
        );

        const levels = clamp(
            Number(elements.colorLevels?.value || 8),
            2,
            32
        );

        const ditherStrength = clamp(
            Number(elements.ditherAmount?.value || 0),
            0,
            1
        );

        const palette = elements.paletteMode
            ? elements.paletteMode.value
            : "rgb";

        elements.targetWidth.value = width;
        elements.targetHeight.value = height;

        elements.outputCanvas.width = width;
        elements.outputCanvas.height = height;

        const workCanvas =
            document.createElement("canvas");

        workCanvas.width = width;
        workCanvas.height = height;

        const workContext = workCanvas.getContext(
            "2d",
            { willReadFrequently: true }
        );

        if (!workContext) return;

        workContext.clearRect(
            0,
            0,
            width,
            height
        );

        drawSourceToCanvas(
            workContext,
            width,
            height
        );

        let imageData;

        try {
            imageData = workContext.getImageData(
                0,
                0,
                width,
                height
            );
        } catch (error) {
            console.error(
                "Could not read source pixels:",
                error
            );

            alert(
                currentLang === "ru"
                    ? "Браузер не разрешил обработать пиксели этого изображения."
                    : "The browser did not allow reading pixels from this image."
            );

            return;
        }

        const pixels = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                const alpha = pixels[index + 3];

                if (alpha === 0) continue;

                let [r, g, b] =
                    applyColorAdjustments(
                        pixels[index],
                        pixels[index + 1],
                        pixels[index + 2]
                    );

                // Bayer 8x8 dithering.
                if (ditherStrength > 0) {
                    const threshold =
                        (
                            bayerMatrix8x8[y & 7][x & 7] / 64 -
                            0.5
                        ) *
                        64 *
                        ditherStrength;

                    r = clamp(r + threshold, 0, 255);
                    g = clamp(g + threshold, 0, 255);
                    b = clamp(b + threshold, 0, 255);
                }

                if (palette === "grayscale") {
                    const gray =
                        0.299 * r +
                        0.587 * g +
                        0.114 * b;

                    const value = quantize(
                        gray,
                        levels
                    );

                    r = g = b = value;

                } else if (palette === "gameboy") {
                    const gray =
                        0.299 * r +
                        0.587 * g +
                        0.114 * b;

                    const tone = Math.round(
                        gray / 255 * 3
                    );

                    const gameBoyPalette = [
                        15,
                        65,
                        139,
                        199
                    ];

                    r = g = b =
                        gameBoyPalette[tone];

                } else {
                    r = quantize(r, levels);
                    g = quantize(g, levels);
                    b = quantize(b, levels);
                }

                pixels[index] = r;
                pixels[index + 1] = g;
                pixels[index + 2] = b;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        showLoadedImage();
        updateCanvasScale();
        updateDimensionLabels();
        updateValueLabels();

        if (elements.outputDimensionsInfo) {
            elements.outputDimensionsInfo.textContent =
                `${t("output")}: ${width} × ${height}`;
        }

        if (elements.renderTime) {
            elements.renderTime.textContent =
                `${t("render")}: ${(performance.now() - startTime).toFixed(1)} ms`;
        }
    }

    function scheduleRender() {
        if (!sourceImage || renderQueued) return;

        renderQueued = true;

        requestAnimationFrame(() => {
            renderQueued = false;
            renderImage();
        });
    }

    // PNG export.
    function downloadImage() {
        if (!sourceImage) return;

        elements.outputCanvas.toBlob((blob) => {
            if (!blob) {
                alert(
                    currentLang === "ru"
                        ? "Не удалось экспортировать PNG."
                        : "Could not export the PNG image."
                );

                return;
            }

            const url = URL.createObjectURL(blob);

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                `psx-${sourceName}-${elements.outputCanvas.width}x${elements.outputCanvas.height}.png`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(
                () => URL.revokeObjectURL(url),
                1000
            );

        }, "image/png");
    }

    function changeDimension(input, delta) {
        input.value = safeDimension(
            Number(input.value) + delta,
            128
        );

        if (lockAspect && sourceAspect > 0) {
            if (input === elements.targetWidth) {
                elements.targetHeight.value =
                    safeDimension(
                        Math.round(
                            Number(input.value) / sourceAspect
                        ),
                        128
                    );
            } else {
                elements.targetWidth.value =
                    safeDimension(
                        Math.round(
                            Number(input.value) * sourceAspect
                        ),
                        128
                    );
            }
        }

        updateDimensionLabels();
        scheduleRender();
    }

    function resetSettings() {
        elements.targetWidth.value = defaults.width;
        elements.targetHeight.value = defaults.height;

        if (elements.fitMode) {
            elements.fitMode.value = defaults.fitMode;
        }

        if (elements.ditherAmount) {
            elements.ditherAmount.value =
                defaults.ditherAmount;
        }

        if (elements.colorLevels) {
            elements.colorLevels.value =
                defaults.colorLevels;
        }

        if (elements.paletteMode) {
            elements.paletteMode.value =
                defaults.paletteMode;
        }

        if (elements.brightness) {
            elements.brightness.value =
                defaults.brightness;
        }

        if (elements.contrast) {
            elements.contrast.value =
                defaults.contrast;
        }

        if (elements.saturation) {
            elements.saturation.value =
                defaults.saturation;
        }

        if (elements.previewScale) {
            elements.previewScale.value =
                defaults.previewScale;
        }

        lockAspect = false;

        updateAspectButton();
        updateDimensionLabels();
        updateValueLabels();

        if (sourceImage) {
            renderImage();
        }
    }

    // -----------------------------------------
    // FILE PICKER
    // -----------------------------------------

    elements.dropZone.addEventListener(
        "click",
        (event) => {
            if (event.target === elements.fileInput) {
                return;
            }

            elements.fileInput.click();
        }
    );

    elements.fileInput.accept = "image/*";

    elements.fileInput.addEventListener(
        "change",
        (event) => {
            handleFileList(event.target.files);

            // Allows selecting the same file again.
            event.target.value = "";
        }
    );

    // -----------------------------------------
    // DRAG AND DROP
    // -----------------------------------------

    ["dragenter", "dragover"].forEach(
        (eventName) => {
            elements.dropZone.addEventListener(
                eventName,
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    elements.dropZone.classList.add(
                        "border-indigo-500",
                        "drag-active"
                    );

                    if (event.dataTransfer) {
                        event.dataTransfer.dropEffect = "copy";
                    }
                }
            );
        }
    );

    ["dragleave", "dragend"].forEach(
        (eventName) => {
            elements.dropZone.addEventListener(
                eventName,
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    elements.dropZone.classList.remove(
                        "border-indigo-500",
                        "drag-active"
                    );
                }
            );
        }
    );

    elements.dropZone.addEventListener(
        "drop",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            elements.dropZone.classList.remove(
                "border-indigo-500",
                "drag-active"
            );

            handleFileList(
                event.dataTransfer &&
                event.dataTransfer.files
            );
        }
    );

    // Prevent browser from opening dropped files.
    window.addEventListener(
        "dragover",
        (event) => {
            event.preventDefault();
        }
    );

    window.addEventListener(
        "drop",
        (event) => {
            event.preventDefault();

            if (
                event.target !== elements.dropZone &&
                !elements.dropZone.contains(event.target)
            ) {
                handleFileList(
                    event.dataTransfer &&
                    event.dataTransfer.files
                );
            }
        }
    );

    // -----------------------------------------
    // CLIPBOARD (CTRL + V)
    // -----------------------------------------

    window.addEventListener(
        "paste",
        (event) => {
            const clipboard = event.clipboardData;

            if (!clipboard) return;

            const items = Array.from(
                clipboard.items || []
            );

            const imageItem = items.find(
                (item) =>
                    item.kind === "file" &&
                    item.type.startsWith("image/")
            );

            if (imageItem) {
                const imageFile =
                    imageItem.getAsFile();

                if (imageFile) {
                    event.preventDefault();
                    handleFile(imageFile);
                    return;
                }
            }

            // Also accept a direct image URL copied as text.
            const text = clipboard
                .getData("text/plain")
                .trim();

            if (/^https?:\/\/\S+$/i.test(text)) {
                event.preventDefault();
                loadImageFromUrl(text);
            }
        }
    );

    // -----------------------------------------
    // RESOLUTION CONTROLS
    // -----------------------------------------

    elements.targetWidth.addEventListener(
        "input",
        () => {
            if (lockAspect && sourceAspect > 0) {
                elements.targetHeight.value =
                    safeDimension(
                        Math.round(
                            Number(elements.targetWidth.value) /
                            sourceAspect
                        ),
                        128
                    );
            }

            updateDimensionLabels();
            scheduleRender();
        }
    );

    elements.targetHeight.addEventListener(
        "input",
        () => {
            if (lockAspect && sourceAspect > 0) {
                elements.targetWidth.value =
                    safeDimension(
                        Math.round(
                            Number(elements.targetHeight.value) *
                            sourceAspect
                        ),
                        128
                    );
            }

            updateDimensionLabels();
            scheduleRender();
        }
    );

    const dimensionButtons = [
        ["wSub10", elements.targetWidth, -10],
        ["wSub1", elements.targetWidth, -1],
        ["wAdd1", elements.targetWidth, 1],
        ["wAdd10", elements.targetWidth, 10],

        ["hSub10", elements.targetHeight, -10],
        ["hSub1", elements.targetHeight, -1],
        ["hAdd1", elements.targetHeight, 1],
        ["hAdd10", elements.targetHeight, 10]
    ];

    dimensionButtons.forEach(
        ([id, input, delta]) => {
            const button = $(id);

            if (button) {
                button.addEventListener(
                    "click",
                    () => changeDimension(input, delta)
                );
            }
        }
    );

    // Resolution presets.
    document.querySelectorAll(
        ".preset-btn"
    ).forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                elements.targetWidth.value =
                    safeDimension(button.dataset.w, 128);

                elements.targetHeight.value =
                    safeDimension(button.dataset.h, 128);

                updateDimensionLabels();
                scheduleRender();
            }
        );
    });

    // Aspect ratio lock.
    if (elements.lockAspectBtn) {
        elements.lockAspectBtn.addEventListener(
            "click",
            () => {
                lockAspect = !lockAspect;

                if (lockAspect && sourceAspect > 0) {
                    elements.targetHeight.value =
                        safeDimension(
                            Math.round(
                                Number(elements.targetWidth.value) /
                                sourceAspect
                            ),
                            128
                        );
                }

                updateAspectButton();
                updateDimensionLabels();
                scheduleRender();
            }
        );
    }

    // -----------------------------------------
    // IMAGE PROCESSING CONTROLS
    // -----------------------------------------

    [
        elements.fitMode,
        elements.ditherAmount,
        elements.colorLevels,
        elements.paletteMode,
        elements.brightness,
        elements.contrast,
        elements.saturation
    ]
        .filter(Boolean)
        .forEach((control) => {
            control.addEventListener(
                "input",
                () => {
                    updateValueLabels();
                    scheduleRender();
                }
            );

            control.addEventListener(
                "change",
                () => {
                    updateValueLabels();
                    scheduleRender();
                }
            );
        });

    // Preview zoom.
    if (elements.previewScale) {
        elements.previewScale.addEventListener(
            "change",
            updateCanvasScale
        );
    }

    // -----------------------------------------
    // BUTTONS
    // -----------------------------------------

    elements.headerDownloadBtn.addEventListener(
        "click",
        downloadImage
    );

    elements.toolbarDownloadBtn.addEventListener(
        "click",
        downloadImage
    );

    if (elements.resetBtn) {
        elements.resetBtn.addEventListener(
            "click",
            resetSettings
        );
    }

    // -----------------------------------------
    // LANGUAGE
    // -----------------------------------------

    if (elements.languageSelect) {
        elements.languageSelect.addEventListener(
            "change",
            () => {
                currentLang =
                    elements.languageSelect.value === "ru"
                        ? "ru"
                        : "en";

                updateAspectButton();

                if (!sourceImage) {
                    setStatus(t("drop"));
                }

                if (
                    elements.imageDimensionsInfo &&
                    sourceImage
                ) {
                    elements.imageDimensionsInfo.textContent =
                        `${t("source")}: ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight}`;
                }

                if (
                    elements.outputDimensionsInfo &&
                    sourceImage
                ) {
                    elements.outputDimensionsInfo.textContent =
                        `${t("output")}: ${elements.outputCanvas.width} × ${elements.outputCanvas.height}`;
                }
            }
        );
    }

    // -----------------------------------------
    // INITIALIZATION
    // -----------------------------------------

    elements.fileInput.value = "";

    showEmptyState();
    updateDimensionLabels();
    updateValueLabels();
    updateAspectButton();

    setStatus(t("drop"));

})();
