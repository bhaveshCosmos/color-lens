// ===== ColorLens — Main Application Logic =====
// All color conversion, picking, and UI logic

(function() {
    'use strict';

    // ===== STATE =====
    let currentColor = { r: 108, g: 92, b: 231 }; // Default: #6C5CE7
    let palette = JSON.parse(localStorage.getItem('colorlens_palette') || '[]');
    let currentHarmony = 'complementary';
    let currentExportFormat = 'css';

    // ===== DOM REFERENCES =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Tab elements
    const tabBtns = $$('.tab-btn');
    const tabContents = $$('.tab-content');

    // Screen picker
    const pickFromScreenBtn = $('#pickFromScreenBtn');
    const colorPreviewInner = $('#colorPreviewInner');
    const previewHex = $('#previewHex');
    const bigColorPreview = $('#bigColorPreview');
    const pickHint = $('#pickHint');

    // Image picker
    const imageUploadZone = $('#imageUploadZone');
    const imageFileInput = $('#imageFileInput');
    const imageCanvas = $('#imageCanvas');
    const uploadPlaceholder = $('#uploadPlaceholder');
    const uploadedImage = $('#uploadedImage');
    const imageCursorInfo = $('#imageCursorInfo');
    const cursorColorSwatch = $('#cursorColorSwatch');
    const cursorColorHex = $('#cursorColorHex');
    const imageControls = $('#imageControls');
    const clearImageBtn = $('#clearImageBtn');

    // Manual entry
    const hexInput = $('#hexInput');
    const applyHexBtn = $('#applyHexBtn');
    const rInput = $('#rInput');
    const gInput = $('#gInput');
    const bInput = $('#bInput');
    const applyRgbBtn = $('#applyRgbBtn');
    const hInput = $('#hInput');
    const sInput = $('#sInput');
    const lInput = $('#lInput');
    const applyHslBtn = $('#applyHslBtn');
    const nativeColorInput = $('#nativeColorInput');

    // Info display
    const colorNamePreview = $('#colorNamePreview');
    const colorNameEl = $('#colorName');
    const colorNameNote = $('#colorNameNote');
    const hexValue = $('#hexValue');
    const rgbValue = $('#rgbValue');
    const hslValue = $('#hslValue');
    const cmykValue = $('#cmykValue');
    const harmonySwatches = $('#harmonySwatches');
    const contrastOnWhite = $('#contrastOnWhite');
    const contrastOnBlack = $('#contrastOnBlack');

    // Palette
    const paletteColors = $('#paletteColors');
    const paletteEmpty = $('#paletteEmpty');
    const addToPaletteBtn = $('#addToPaletteBtn');
    const exportPaletteBtn = $('#exportPaletteBtn');
    const clearPaletteBtn = $('#clearPaletteBtn');

    // Export modal
    const exportModal = $('#exportModal');
    const closeExportModal = $('#closeExportModal');
    const exportCode = $('#exportCode');
    const copyExportBtn = $('#copyExportBtn');

    // Toast
    const toast = $('#toast');
    const toastMessage = $('#toastMessage');

    // Logo
    const logoIcon = $('#logoIcon');

    // ===== COLOR CONVERSION UTILITIES =====

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function rgbToCmyk(r, g, b) {
        if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 };
        const c1 = 1 - r / 255, m1 = 1 - g / 255, y1 = 1 - b / 255;
        const k = Math.min(c1, m1, y1);
        return {
            c: Math.round(((c1 - k) / (1 - k)) * 100),
            m: Math.round(((m1 - k) / (1 - k)) * 100),
            y: Math.round(((y1 - k) / (1 - k)) * 100),
            k: Math.round(k * 100)
        };
    }

    // ===== CONTRAST RATIO =====

    function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // ===== COLOR HARMONIES =====

    function getHarmonies(r, g, b, type) {
        const hsl = rgbToHsl(r, g, b);
        let angles = [];

        switch (type) {
            case 'complementary':
                angles = [0, 180];
                break;
            case 'analogous':
                angles = [-30, 0, 30];
                break;
            case 'triadic':
                angles = [0, 120, 240];
                break;
            case 'split':
                angles = [0, 150, 210];
                break;
            case 'tetradic':
                angles = [0, 90, 180, 270];
                break;
        }

        return angles.map(angle => {
            const newH = ((hsl.h + angle) % 360 + 360) % 360;
            const rgb = hslToRgb(newH, hsl.s, hsl.l);
            return {
                hex: rgbToHex(rgb.r, rgb.g, rgb.b),
                ...rgb
            };
        });
    }

    // ===== UI UPDATE =====

    function updateUI() {
        const { r, g, b } = currentColor;
        const hex = rgbToHex(r, g, b);
        const hsl = rgbToHsl(r, g, b);
        const cmyk = rgbToCmyk(r, g, b);

        // Update preview
        colorPreviewInner.style.backgroundColor = hex;
        previewHex.textContent = hex;
        bigColorPreview.style.boxShadow = `0 8px 40px ${hex}40`;

        // Update logo color
        logoIcon.querySelector('circle:nth-child(1)').setAttribute('fill', hex);

        // Update color name
        const nameResult = getColorName(hex);
        colorNameEl.textContent = nameResult.name;
        colorNameNote.textContent = nameResult.exact ? '✓ Exact match' : '≈ Closest match';
        colorNameNote.className = 'color-name-note' + (nameResult.exact ? ' exact' : '');

        // Update preview swatch
        colorNamePreview.style.backgroundColor = hex;
        colorNamePreview.style.boxShadow = `0 4px 20px ${hex}50`;

        // Update values
        hexValue.textContent = hex;
        rgbValue.textContent = `rgb(${r}, ${g}, ${b})`;
        hslValue.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
        cmykValue.textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

        // Update manual inputs
        hexInput.value = hex.replace('#', '');
        rInput.value = r;
        gInput.value = g;
        bInput.value = b;
        hInput.value = hsl.h;
        sInput.value = hsl.s;
        lInput.value = hsl.l;
        nativeColorInput.value = hex.length === 7 ? hex : '#000000';

        // Update harmonies
        updateHarmonies();

        // Update contrast
        updateContrast();

        // Update background blob color
        document.querySelector('.blob-1').style.background = hex;
    }

    function updateHarmonies() {
        const { r, g, b } = currentColor;
        const harmonies = getHarmonies(r, g, b, currentHarmony);

        harmonySwatches.innerHTML = harmonies.map(h => `
            <div class="harmony-swatch" style="background-color: ${h.hex}" data-hex="${h.hex}" title="${h.hex}">
                <span class="swatch-label">${h.hex}</span>
            </div>
        `).join('');

        // Add click handlers to harmony swatches
        harmonySwatches.querySelectorAll('.harmony-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const rgb = hexToRgb(swatch.dataset.hex);
                setColor(rgb.r, rgb.g, rgb.b);
            });
        });
    }

    function updateContrast() {
        const white = { r: 255, g: 255, b: 255 };
        const black = { r: 0, g: 0, b: 0 };

        const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);

        // Contrast on white
        const ratioWhite = contrastRatio(currentColor, white);
        contrastOnWhite.style.color = hex;
        $('#whiteRatio').textContent = ratioWhite.toFixed(2) + ':1';
        updateBadge($('#whiteAA'), ratioWhite >= 4.5);
        updateBadge($('#whiteAAA'), ratioWhite >= 7);

        // Contrast on black
        const ratioBlack = contrastRatio(currentColor, black);
        contrastOnBlack.style.color = hex;
        $('#blackRatio').textContent = ratioBlack.toFixed(2) + ':1';
        updateBadge($('#blackAA'), ratioBlack >= 4.5);
        updateBadge($('#blackAAA'), ratioBlack >= 7);
    }

    function updateBadge(el, pass) {
        el.className = 'badge ' + (pass ? 'pass' : 'fail');
        el.textContent = el.textContent.replace(' ✓', '').replace(' ✗', '') + (pass ? ' ✓' : ' ✗');
    }

    function setColor(r, g, b) {
        currentColor = { r, g, b };
        updateUI();
    }

    // ===== TAB NAVIGATION =====

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabContents.forEach(tc => tc.classList.remove('active'));
            $(`#tabContent${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
        });
    });

    // ===== SCREEN COLOR PICKER (EyeDropper API) =====

    pickFromScreenBtn.addEventListener('click', async () => {
        if (!window.EyeDropper) {
            pickHint.textContent = '⚠ EyeDropper API is not supported in this browser. Try Chrome 95+.';
            pickHint.style.color = '#e74c3c';
            return;
        }

        try {
            pickHint.textContent = 'Click anywhere on your screen to pick a color...';
            pickHint.style.color = '';
            const dropper = new EyeDropper();
            const result = await dropper.open();
            const rgb = hexToRgb(result.sRGBHex);
            setColor(rgb.r, rgb.g, rgb.b);
            pickHint.textContent = 'Color picked! Click again to pick another.';
        } catch (e) {
            pickHint.textContent = 'Color picking was cancelled.';
            pickHint.style.color = '';
        }
    });

    // ===== IMAGE COLOR PICKER =====

    // Click to upload
    imageUploadZone.addEventListener('click', (e) => {
        if (!uploadedImage.hidden) return; // Don't trigger upload if image is already loaded
        imageFileInput.click();
    });

    // Drag and drop
    imageUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = 'var(--accent)';
    });

    imageUploadZone.addEventListener('dragleave', () => {
        imageUploadZone.style.borderColor = '';
    });

    imageUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    });

    imageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadImage(file);
    });

    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Show image
                uploadedImage.src = e.target.result;
                uploadedImage.hidden = false;
                uploadPlaceholder.hidden = true;
                imageUploadZone.classList.add('has-image');
                imageControls.hidden = false;

                // Prepare canvas
                imageCanvas.width = img.naturalWidth;
                imageCanvas.height = img.naturalHeight;
                const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Pick color from image
    imageUploadZone.addEventListener('mousemove', (e) => {
        if (uploadedImage.hidden) return;
        const rect = uploadedImage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = imageCanvas.width / rect.width;
        const scaleY = imageCanvas.height / rect.height;

        const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
        const pixel = ctx.getImageData(
            Math.floor(x * scaleX),
            Math.floor(y * scaleY),
            1, 1
        ).data;

        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        cursorColorSwatch.style.backgroundColor = hex;
        cursorColorHex.textContent = hex;
        imageCursorInfo.hidden = false;
    });

    imageUploadZone.addEventListener('mouseleave', () => {
        imageCursorInfo.hidden = true;
    });

    imageUploadZone.addEventListener('click', (e) => {
        if (uploadedImage.hidden) return;
        const rect = uploadedImage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = imageCanvas.width / rect.width;
        const scaleY = imageCanvas.height / rect.height;

        const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
        const pixel = ctx.getImageData(
            Math.floor(x * scaleX),
            Math.floor(y * scaleY),
            1, 1
        ).data;

        setColor(pixel[0], pixel[1], pixel[2]);
    });

    clearImageBtn.addEventListener('click', () => {
        uploadedImage.hidden = true;
        uploadedImage.src = '';
        uploadPlaceholder.hidden = false;
        imageUploadZone.classList.remove('has-image');
        imageControls.hidden = true;
        imageCursorInfo.hidden = true;
        imageFileInput.value = '';
    });

    // ===== MANUAL ENTRY =====

    applyHexBtn.addEventListener('click', () => {
        let val = hexInput.value.replace('#', '').trim();
        if (/^[0-9A-Fa-f]{6}$/.test(val)) {
            const rgb = hexToRgb(val);
            setColor(rgb.r, rgb.g, rgb.b);
        } else if (/^[0-9A-Fa-f]{3}$/.test(val)) {
            val = val.split('').map(c => c + c).join('');
            const rgb = hexToRgb(val);
            setColor(rgb.r, rgb.g, rgb.b);
        }
    });

    hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyHexBtn.click();
    });

    applyRgbBtn.addEventListener('click', () => {
        const r = parseInt(rInput.value) || 0;
        const g = parseInt(gInput.value) || 0;
        const b = parseInt(bInput.value) || 0;
        setColor(
            Math.min(255, Math.max(0, r)),
            Math.min(255, Math.max(0, g)),
            Math.min(255, Math.max(0, b))
        );
    });

    applyHslBtn.addEventListener('click', () => {
        const h = parseInt(hInput.value) || 0;
        const s = parseInt(sInput.value) || 0;
        const l = parseInt(lInput.value) || 0;
        const rgb = hslToRgb(h, s, l);
        setColor(rgb.r, rgb.g, rgb.b);
    });

    nativeColorInput.addEventListener('input', (e) => {
        const rgb = hexToRgb(e.target.value);
        setColor(rgb.r, rgb.g, rgb.b);
    });

    // ===== HARMONY TABS =====

    $$('.harmony-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.harmony-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentHarmony = tab.dataset.harmony;
            updateHarmonies();
        });
    });

    // ===== COPY BUTTONS =====

    $$('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.copy;
            let text = '';
            switch (type) {
                case 'hex': text = hexValue.textContent; break;
                case 'rgb': text = rgbValue.textContent; break;
                case 'hsl': text = hslValue.textContent; break;
                case 'cmyk': text = cmykValue.textContent; break;
            }
            copyToClipboard(text);
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
        });
    });

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied to clipboard!');
        });
    }

    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ===== PALETTE =====

    function renderPalette() {
        if (palette.length === 0) {
            paletteColors.innerHTML = '<div class="palette-empty" id="paletteEmpty"><p>No colors saved yet. Pick a color and click <strong>+</strong> to add it.</p></div>';
            return;
        }

        paletteColors.innerHTML = palette.map((hex, i) => `
            <div class="palette-color" style="background-color: ${hex}" data-index="${i}" title="${hex}">
                <span class="palette-remove" data-index="${i}">&times;</span>
                <span class="palette-hex">${hex}</span>
            </div>
        `).join('');

        // Click to select
        paletteColors.querySelectorAll('.palette-color').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('palette-remove')) return;
                const rgb = hexToRgb(palette[el.dataset.index]);
                setColor(rgb.r, rgb.g, rgb.b);
            });
        });

        // Remove button
        paletteColors.querySelectorAll('.palette-remove').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                palette.splice(parseInt(el.dataset.index), 1);
                savePalette();
                renderPalette();
            });
        });
    }

    function savePalette() {
        localStorage.setItem('colorlens_palette', JSON.stringify(palette));
    }

    addToPaletteBtn.addEventListener('click', () => {
        const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        if (!palette.includes(hex)) {
            palette.push(hex);
            savePalette();
            renderPalette();
            showToast(`${hex} added to palette`);
        } else {
            showToast('Color already in palette');
        }
    });

    clearPaletteBtn.addEventListener('click', () => {
        if (palette.length === 0) return;
        palette = [];
        savePalette();
        renderPalette();
        showToast('Palette cleared');
    });

    // ===== EXPORT =====

    exportPaletteBtn.addEventListener('click', () => {
        if (palette.length === 0) {
            showToast('Add colors to palette first');
            return;
        }
        exportModal.classList.add('show');
        updateExportCode();
    });

    closeExportModal.addEventListener('click', () => {
        exportModal.classList.remove('show');
    });

    exportModal.addEventListener('click', (e) => {
        if (e.target === exportModal) exportModal.classList.remove('show');
    });

    $$('.export-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.export-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentExportFormat = tab.dataset.format;
            updateExportCode();
        });
    });

    function updateExportCode() {
        let code = '';
        switch (currentExportFormat) {
            case 'css':
                code = ':root {\n' + palette.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n') + '\n}';
                break;
            case 'json':
                code = JSON.stringify({
                    palette: palette.map((hex, i) => ({
                        name: `color-${i + 1}`,
                        hex: hex,
                        rgb: (() => { const rgb = hexToRgb(hex); return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; })()
                    }))
                }, null, 2);
                break;
            case 'scss':
                code = palette.map((hex, i) => `$color-${i + 1}: ${hex};`).join('\n');
                break;
            case 'tailwind':
                code = 'module.exports = {\n  theme: {\n    extend: {\n      colors: {\n' +
                    palette.map((hex, i) => `        'custom-${i + 1}': '${hex}',`).join('\n') +
                    '\n      }\n    }\n  }\n}';
                break;
        }
        exportCode.textContent = code;
    }

    copyExportBtn.addEventListener('click', () => {
        copyToClipboard(exportCode.textContent);
    });

    // ===== KEYBOARD SHORTCUTS =====

    document.addEventListener('keydown', (e) => {
        // Escape to close modal
        if (e.key === 'Escape' && exportModal.classList.contains('show')) {
            exportModal.classList.remove('show');
        }
        // Ctrl+Shift+P to pick from screen
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            pickFromScreenBtn.click();
        }
    });

    // ===== INITIALIZATION =====

    function init() {
        updateUI();
        renderPalette();

        // Animate in
        document.body.style.opacity = '0';
        requestAnimationFrame(() => {
            document.body.style.transition = 'opacity 0.6s ease';
            document.body.style.opacity = '1';
        });
    }

    init();

})();
