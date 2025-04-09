const imageLoader = document.getElementById('imageLoader');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
const grayscaleBtn = document.getElementById('grayscaleBtn');
const sepiaBtn = document.getElementById('sepiaBtn');
const invertBtn = document.getElementById('invertBtn');
const downloadLnk = document.getElementById('downloadLnk');

// --- Transformation Elements ---
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const startCropBtn = document.getElementById('startCropBtn');
const confirmCropBtn = document.getElementById('confirmCropBtn');
// --- End Transformation Elements ---

// --- Snip & Swap Elements ---
const startSelectionBtn = document.getElementById('startSelectionBtn');
const confirmSnip1Btn = document.getElementById('confirmSnip1Btn');
const startSelection2Btn = document.getElementById('startSelection2Btn');
const confirmSnip2Btn = document.getElementById('confirmSnip2Btn');
const revertBtn = document.getElementById('revertBtn');
const snipStatus = document.getElementById('snipStatus');
// --- End Snip & Swap Elements ---

let originalImage = null; // Store the original Image object
let imageLoaded = false;

// --- Snip & Swap State ---
let isSelecting = false;
let selectionMode = 'none'; // 'none', 'snip1', 'snip2', 'crop'
let selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
let snipState = 'idle'; // 'idle', 'selecting1', 'selected1', 'selecting2', 'swapped'
let snip1Data = null;
let snip1Rect = null;
let snip2Rect = null;
// --- End Snip & Swap State ---

// Helper: Get rectangle relative to canvas
function getCanvasCoordinates(event) {
    const rect = imageCanvas.getBoundingClientRect();
    // Adjust for potential scaling/padding if canvas size !== display size
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Helper: Normalize selection rectangle coordinates
function getNormalizedRect(rect) {
    const x = Math.min(rect.startX, rect.endX);
    const y = Math.min(rect.startY, rect.endY);
    const width = Math.abs(rect.endX - rect.startX);
    const height = Math.abs(rect.endY - rect.startY);
    // Ensure selection is within canvas bounds
    const canvasWidth = imageCanvas.width;
    const canvasHeight = imageCanvas.height;
    const normX = Math.max(0, x);
    const normY = Math.max(0, y);
    const normWidth = Math.min(width, canvasWidth - normX);
    const normHeight = Math.min(height, canvasHeight - normY);

    // Prevent zero-sized rectangles
    if (normWidth <= 0 || normHeight <= 0) {
        return null;
    }
    return { x: normX, y: normY, width: normWidth, height: normHeight };
}

// Helper: Draw the selection rectangle
function drawSelectionRect() {
    // Only draw if a selection is active (snip or crop)
    if (!isSelecting && selectionMode === 'none') return;

    // Redraw the current canvas state first to clear old rectangles
    // Create a temporary canvas to hold the current state
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageCanvas.width;
    tempCanvas.height = imageCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imageCanvas, 0, 0);

    // Draw the current state back onto the main canvas
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.drawImage(tempCanvas, 0, 0);


    const normRect = getNormalizedRect(selectionRect);
    if (normRect && isSelecting) { // Only draw dashed rect while actively selecting
        ctx.strokeStyle = 'blue'; // Use blue for crop selection? or keep red? Let's use blue.
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(normRect.x, normRect.y, normRect.width, normRect.height);
        ctx.setLineDash([]);
    }
}

// Helper: Update UI Status and Button States (Modified for Crop)
function updateToolStates() {
    if (!imageLoaded) {
        snipStatus.textContent = "Load an image to begin.";
        // Disable all tool buttons
        startSelectionBtn.disabled = true;
        confirmSnip1Btn.disabled = true;
        startSelection2Btn.disabled = true;
        confirmSnip2Btn.disabled = true;
        revertBtn.disabled = true;
        startCropBtn.disabled = true;
        confirmCropBtn.disabled = true;
        imageCanvas.style.cursor = 'default';
        return;
    }

    revertBtn.disabled = false;
    imageCanvas.style.cursor = 'default';

    // Crop Controls
    const isCropping = selectionMode === 'crop';
    startCropBtn.disabled = isCropping; // Disable start if already cropping
    confirmCropBtn.disabled = !isCropping; // Enable confirm only when cropping
    if (isCropping) {
        imageCanvas.style.cursor = 'crosshair';
        snipStatus.textContent = "Drag to select crop area. Click 'Confirm Crop'.";
    }

    // Snip Controls (only enabled if not cropping)
    startSelectionBtn.disabled = isCropping || snipState === 'selecting1' || snipState === 'selecting2';
    confirmSnip1Btn.disabled = isCropping || snipState !== 'selecting1';
    startSelection2Btn.disabled = isCropping || snipState !== 'selected1';
    confirmSnip2Btn.disabled = isCropping || snipState !== 'selecting2';

    // Update Snip Status Text only if not cropping
    if (!isCropping) {
        switch (snipState) {
            case 'idle':
                snipStatus.textContent = "Ready. Use filters, transforms, snip, or crop.";
                imageCanvas.style.cursor = 'default';
                break;
            case 'selecting1':
                snipStatus.textContent = "Snip Mode: Drag to select area 1.";
                imageCanvas.style.cursor = 'crosshair';
                break;
            case 'selected1':
                snipStatus.textContent = "Snip Mode: Area 1 cleared. Select area 2.";
                imageCanvas.style.cursor = 'default';
                break;
            case 'selecting2':
                snipStatus.textContent = "Snip Mode: Drag to select area 2.";
                imageCanvas.style.cursor = 'crosshair';
                break;
             case 'swapped':
                 snipStatus.textContent = "Snip Mode: Areas swapped! Reset or continue.";
                 imageCanvas.style.cursor = 'default';
                 break;
        }
    }

    // Disable other interactions during selection
    const isInSelection = isCropping || snipState === 'selecting1' || snipState === 'selecting2';
    grayscaleBtn.disabled = isInSelection;
    sepiaBtn.disabled = isInSelection;
    invertBtn.disabled = isInSelection;
    rotateLeftBtn.disabled = isInSelection;
    rotateRightBtn.disabled = isInSelection;
    // Make snip/crop buttons mutually exclusive visually
    startSelectionBtn.disabled = startSelectionBtn.disabled || isCropping;
    startCropBtn.disabled = startCropBtn.disabled || (snipState !== 'idle' && snipState !== 'swapped');

}


// Phase 1: Image Loading/Display (Modified - call updateToolStates)
imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        alert('Please select a valid image file (PNG or JPEG).');
        imageLoader.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImage = img;
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            imageLoaded = true;
            downloadLnk.href = '#';
            snipState = 'idle';
            selectionMode = 'none';
            snip1Data = null;
            snip1Rect = null;
            snip2Rect = null;
            updateToolStates(); // Use the unified UI update function
        }
        img.onerror = function() {
            alert('Error loading image.');
            imageLoaded = false;
            originalImage = null;
            selectionMode = 'none';
            updateToolStates(); // Use the unified UI update function
        }
        img.src = e.target.result;
    }

    reader.onerror = function() {
        alert('Error reading file.');
        imageLoaded = false;
        originalImage = null;
        selectionMode = 'none';
        updateToolStates(); // Use the unified UI update function
    }

    reader.readAsDataURL(file);
});

// --- Canvas Mouse Events for Selection (Modified for Modes) ---
imageCanvas.addEventListener('mousedown', (event) => {
    // Activate selection only if a specific mode is active
    if (!imageLoaded || selectionMode === 'none') return;

    isSelecting = true;
    const coords = getCanvasCoordinates(event);
    selectionRect.startX = coords.x;
    selectionRect.startY = coords.y;
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;
    drawSelectionRect(); // Draw the initial point/rect
});

imageCanvas.addEventListener('mousemove', (event) => {
    if (!isSelecting) return;

    const coords = getCanvasCoordinates(event);
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;
    drawSelectionRect(); // Redraw rectangle while moving
});

imageCanvas.addEventListener('mouseup', (event) => {
    if (!isSelecting) return;
    isSelecting = false; // Stop active dragging

    const coords = getCanvasCoordinates(event);
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;

    // Final redraw of the current state to ensure the last rect is cleared
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageCanvas.width;
    tempCanvas.height = imageCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imageCanvas, 0, 0);
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    // Update UI - now selection is made, but mouse is up
    updateToolStates();
});
// --- End Canvas Mouse Events ---


// --- Snip & Swap Button Listeners (Modified for Mode) ---
startSelectionBtn.addEventListener('click', () => {
    if (!imageLoaded) return;
    snipState = 'selecting1';
    selectionMode = 'snip1'; // Enter snip selection mode
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    updateToolStates();
});

confirmSnip1Btn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'snip1') return;

    const normRect = getNormalizedRect(selectionRect);
    if (!normRect) {
        alert("Invalid selection area. Please drag on the image first.");
        return;
    }

    snip1Rect = normRect;
    try {
        snip1Data = ctx.getImageData(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        snipState = 'selected1';
        selectionMode = 'none'; // Exit selection mode
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    } catch (e) {
        console.error("Error getting/clearing image data for Snip 1:", e);
        alert("Could not process the selected area. It might be too large or cross-origin restrictions apply if the image source is remote (not applicable here).");
        snipState = 'idle';
        selectionMode = 'none';
        snip1Rect = null;
        snip1Data = null;
    }
    updateToolStates();
});

startSelection2Btn.addEventListener('click', () => {
    if (!imageLoaded || snipState !== 'selected1') return;
    snipState = 'selecting2';
    selectionMode = 'snip2'; // Enter snip selection mode 2
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    updateToolStates();
});

confirmSnip2Btn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'snip2' || !snip1Data || !snip1Rect) return;

    const normRect = getNormalizedRect(selectionRect);
     if (!normRect) {
        alert("Invalid selection area 2. Please drag on the image first.");
        return;
    }
    snip2Rect = normRect;

    try {
        const snip2Data = ctx.getImageData(snip2Rect.x, snip2Rect.y, snip2Rect.width, snip2Rect.height);
        ctx.putImageData(snip2Data, snip1Rect.x, snip1Rect.y);
        ctx.putImageData(snip1Data, snip2Rect.x, snip2Rect.y);

        snipState = 'swapped';
        selectionMode = 'none'; // Exit selection mode
        // Clear temporary data
        snip1Data = null;
        snip1Rect = null;
        snip2Rect = null;
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };

    } catch(e) {
        console.error("Error getting/putting image data for Snip 2/Swap:", e);
        alert("Could not process the selected area 2 or perform the swap.");
        // Attempt to restore state? Difficult. Maybe just reset.
        revertBtn.click();
        return; // Prevent UI update below if reset was triggered
    }
    updateToolStates();
});


revertBtn.addEventListener('click', () => {
    if (!imageLoaded || !originalImage) return;
    ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
    snipState = 'idle';
    selectionMode = 'none'; // Ensure selection mode is reset
    isSelecting = false;
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    snip1Data = null;
    snip1Rect = null;
    snip2Rect = null;
    updateToolStates();
});
// --- End Snip & Swap Button Listeners ---


// --- Filter Functions ---

// Generic function to apply a filter to the entire canvas
function applyFilter(filterFunction) {
    if (!imageLoaded) {
        alert('Please load an image first.');
        return;
    }
    try {
        const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        filterFunction(imageData.data); // Apply the filter logic to pixel data
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.error("Error applying filter:", e);
        alert("Could not apply the filter. The image might be too large or another issue occurred.");
    }
}

// Grayscale filter logic
grayscaleBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray; // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
        }
    });
});

// Sepia filter logic
sepiaBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b); // R
            data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b); // G
            data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b); // B
        }
    });
});

// Invert filter logic
invertBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];     // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
        }
    });
});

// --- End Filter Functions ---


// --- Transformation Functions --- (Modified for Crop)
rotateLeftBtn.addEventListener('click', () => {
    selectionMode = 'none'; // Cancel any selection before rotating
    rotateCanvas(-90);
    updateToolStates(); // Update UI after rotation
});

rotateRightBtn.addEventListener('click', () => {
    selectionMode = 'none'; // Cancel any selection before rotating
    rotateCanvas(90);
    updateToolStates(); // Update UI after rotation
});

startCropBtn.addEventListener('click', () => {
    if (!imageLoaded) return;
    selectionMode = 'crop';
    snipState = 'idle'; // Ensure snip is reset if cropping starts
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    updateToolStates();
});

confirmCropBtn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'crop') return;

    const normRect = getNormalizedRect(selectionRect);
    if (!normRect) {
        alert("Invalid crop area. Please drag on the image first.");
        return;
    }

    try {
        // Get the pixel data from the selected area of the current canvas
        const croppedImageData = ctx.getImageData(normRect.x, normRect.y, normRect.width, normRect.height);

        // Create a temporary canvas for the cropped image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = normRect.width;
        tempCanvas.height = normRect.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Put the cropped data onto the temporary canvas
        tempCtx.putImageData(croppedImageData, 0, 0);

        // Resize the main canvas to the cropped dimensions
        imageCanvas.width = normRect.width;
        imageCanvas.height = normRect.height;

        // Clear the main canvas and draw the cropped image from the temp canvas
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        ctx.drawImage(tempCanvas, 0, 0);

        // Exit crop mode
        selectionMode = 'none';
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };

    } catch (e) {
        console.error("Error during crop:", e);
        alert("Could not perform crop operation.");
        selectionMode = 'none'; // Exit crop mode on error
    }
    updateToolStates(); // Update UI
});


// --- End Transformation Functions ---


// Phase 3: Save Modified Image (Original - Keep as is)
downloadLnk.addEventListener('click', (event) => {
    if (!imageLoaded) {
        alert('Please load an image first.');
        event.preventDefault();
        return;
    }
    if (imageCanvas.width === 0 || imageCanvas.height === 0) {
         alert('Canvas is empty. Cannot download.');
         event.preventDefault();
         return;
    }

    try {
        const dataURL = imageCanvas.toDataURL('image/png');
        downloadLnk.href = dataURL;
    } catch (error) {
        console.error('Error generating data URL:', error);
        alert('Failed to prepare image for download.');
        event.preventDefault();
    }
});

// Initial UI setup on script load
updateToolStates(); // Use the unified UI update function 