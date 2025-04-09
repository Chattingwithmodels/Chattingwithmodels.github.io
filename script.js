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
let currentImageDataForRedraw = null; // <<< NEW: Store the current clean ImageData

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
    const canvasWidth = imageCanvas.width;
    const canvasHeight = imageCanvas.height;
    const normX = Math.max(0, x);
    const normY = Math.max(0, y);
    const normWidth = Math.min(width, canvasWidth - normX);
    const normHeight = Math.min(height, canvasHeight - normY);

    if (normWidth <= 0 || normHeight <= 0) {
        return null;
    }
    return { x: normX, y: normY, width: normWidth, height: normHeight };
}

// --- REMOVED drawSelectionRect() function ---

// Helper: Update current image state buffer (call after permanent changes)
function updateCurrentImageStateBuffer() {
    if (!imageLoaded || imageCanvas.width === 0 || imageCanvas.height === 0) {
        currentImageDataForRedraw = null;
        return;
    }
    try {
        currentImageDataForRedraw = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    } catch (e) {
        console.error("Error updating image state buffer:", e);
        currentImageDataForRedraw = null; // Fallback or handle error
        // Consider alerting the user or attempting to redraw originalImage as fallback
        // alert("Warning: Could not buffer current image state.");
        // if (originalImage) {
        //     ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
        // }
    }
}

// Helper: Redraw the base image state from buffer or original
function redrawBaseImage() {
    if (!imageLoaded) return; // Don't redraw if no image loaded
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    if (currentImageDataForRedraw) {
         // If we have buffered state (filters/rotations/crops applied), draw that
         ctx.putImageData(currentImageDataForRedraw, 0, 0);
     } else if (originalImage) {
         // Otherwise, draw the original loaded image (fallback or initial state)
         ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
     }
     // If neither buffer nor originalImage exists, canvas remains clear.
}


// Helper: Update UI Status and Button States (Modified for Crop)
function updateToolStates() {
    // ... (Keep your existing updateToolStates logic as is)
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
        grayscaleBtn.disabled = true; // Also disable filters etc.
        sepiaBtn.disabled = true;
        invertBtn.disabled = true;
        rotateLeftBtn.disabled = true;
        rotateRightBtn.disabled = true;
        imageCanvas.style.cursor = 'default';
        return;
    }

    revertBtn.disabled = false;
    imageCanvas.style.cursor = 'default';

    // Crop Controls
    const isCropping = selectionMode === 'crop';
    startCropBtn.disabled = isCropping; // Disable start if already cropping
    confirmCropBtn.disabled = !isCropping || isSelecting; // Enable confirm only when cropping AND not actively dragging
    if (isCropping) {
        imageCanvas.style.cursor = 'crosshair';
        snipStatus.textContent = isSelecting ? "Drag to select crop area." : "Selection made. Click 'Confirm Crop' or 'Start Crop' again.";
    }

    // Snip Controls (only enabled if not cropping)
    const isSnipping = selectionMode === 'snip1' || selectionMode === 'snip2';
    startSelectionBtn.disabled = isCropping || snipState === 'selecting1' || snipState === 'selecting2';
    confirmSnip1Btn.disabled = isCropping || snipState !== 'selecting1' || isSelecting;
    startSelection2Btn.disabled = isCropping || snipState !== 'selected1';
    confirmSnip2Btn.disabled = isCropping || snipState !== 'selecting2' || isSelecting;


    // Update Snip Status Text only if not cropping
    if (!isCropping) {
        switch (snipState) {
            case 'idle':
                snipStatus.textContent = "Ready. Use filters, transforms, snip, or crop.";
                imageCanvas.style.cursor = 'default';
                break;
            case 'selecting1':
                snipStatus.textContent = isSelecting ? "Snip Mode: Drag to select area 1." : "Selection made. Click 'Confirm Snip 1'.";
                imageCanvas.style.cursor = 'crosshair';
                break;
            case 'selected1':
                snipStatus.textContent = "Snip Mode: Area 1 selected. Click 'Select Area 2'.";
                imageCanvas.style.cursor = 'default';
                break;
            case 'selecting2':
                snipStatus.textContent = isSelecting ? "Snip Mode: Drag to select area 2." : "Selection made. Click 'Confirm Snip 2'.";
                imageCanvas.style.cursor = 'crosshair';
                break;
             case 'swapped':
                 snipStatus.textContent = "Snip Mode: Areas swapped! Reset or continue.";
                 imageCanvas.style.cursor = 'default';
                 break;
        }
    }

    // Disable other interactions during *any* selection process (dragging mouse)
    const isActivelySelecting = isSelecting; // Simplified check
    grayscaleBtn.disabled = isActivelySelecting;
    sepiaBtn.disabled = isActivelySelecting;
    invertBtn.disabled = isActivelySelecting;
    rotateLeftBtn.disabled = isActivelySelecting;
    rotateRightBtn.disabled = isActivelySelecting;
    downloadLnk.style.pointerEvents = isActivelySelecting ? 'none' : 'auto'; // Prevent download during drag
    downloadLnk.style.opacity = isActivelySelecting ? 0.5 : 1;

    // Prevent starting a new selection type while another is in progress (even if not dragging)
    startCropBtn.disabled = startCropBtn.disabled || isSnipping || (snipState !== 'idle' && snipState !== 'swapped');
    startSelectionBtn.disabled = startSelectionBtn.disabled || isCropping;

}


// Phase 1: Image Loading/Display (Modified - call update buffer)
imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) { // Added better type check
        alert('Please select a valid image file (PNG or JPEG).');
        imageLoader.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImage = img; // Store original for revert
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            imageLoaded = true;
            updateCurrentImageStateBuffer(); // <<< Capture initial clean state
            downloadLnk.href = '#'; // Reset download link initially
            downloadLnk.download = `edited-${file.name}`; // Set download filename

            // Reset all states
            snipState = 'idle';
            selectionMode = 'none';
            isSelecting = false;
            snip1Data = null;
            snip1Rect = null;
            snip2Rect = null;
            selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };

            updateToolStates();
        }
        img.onerror = function() {
            alert('Error loading image data. The file might be corrupt or invalid.');
            imageLoaded = false;
            originalImage = null;
            currentImageDataForRedraw = null; // Clear buffer
            selectionMode = 'none';
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear canvas
            updateToolStates();
        }
        img.src = e.target.result;
    }

    reader.onerror = function() {
        alert('Error reading file.');
        imageLoaded = false;
        originalImage = null;
        currentImageDataForRedraw = null; // Clear buffer
        selectionMode = 'none';
        updateToolStates();
    }

    reader.readAsDataURL(file);
});

// --- Canvas Mouse Events for Selection (REVISED) ---
imageCanvas.addEventListener('mousedown', (event) => {
    // Activate selection only if a specific mode is active AND image is loaded
    if (!imageLoaded || selectionMode === 'none' || isSelecting) return;

    isSelecting = true;
    const coords = getCanvasCoordinates(event);
    selectionRect.startX = coords.x;
    selectionRect.startY = coords.y;
    selectionRect.endX = coords.x; // Initialize end to start
    selectionRect.endY = coords.y;
    updateToolStates(); // Update UI (e.g., disable buttons during drag)
    // No drawing needed here, mousemove handles it.
});

imageCanvas.addEventListener('mousemove', (event) => {
    if (!isSelecting || selectionMode === 'none') return; // Only react if actively selecting in a mode

    const coords = getCanvasCoordinates(event);
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;

    // 1. Redraw the clean base image first
    redrawBaseImage();

    // 2. Now draw the current selection rectangle on top
    const normRect = getNormalizedRect(selectionRect);
    if (normRect) {
        ctx.strokeStyle = 'blue'; // Or red for snip? Configurable later maybe.
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(normRect.x, normRect.y, normRect.width, normRect.height);
        ctx.setLineDash([]); // Reset line dash
    }
    // No need to call updateToolStates() here, too frequent
});

imageCanvas.addEventListener('mouseup', (event) => {
    if (!isSelecting || selectionMode === 'none') return;
    isSelecting = false; // Stop active dragging

    // Don't need final coords update here, mousemove got the last one

    // 1. Final redraw of the clean base image state to remove the rectangle visually
    redrawBaseImage();

    // 2. Check if the selection is valid (non-zero size) after mouseup
     const normRect = getNormalizedRect(selectionRect);
     if (!normRect) {
         console.log("Selection canceled (zero size).");
         // Reset selection mode if needed or just update UI
         // Depending on desired behavior, you might reset selectionMode = 'none' here
     }


    // 3. Update UI - selection drag finished
    updateToolStates();
});

imageCanvas.addEventListener('mouseleave', (event) => {
     // Optional: If the mouse leaves the canvas while dragging, cancel the selection?
     if (isSelecting) {
         isSelecting = false;
         redrawBaseImage(); // Clear the rectangle
         // Reset selectionRect? Or keep it for potential confirmation? Depends on UX choice.
         // selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
         // selectionMode = 'none'; // Maybe reset mode too?
         console.log("Selection potentially canceled due to mouse leaving canvas.");
         updateToolStates();
     }
 });

// --- Snip & Swap Button Listeners (Modified for Mode) ---
startSelectionBtn.addEventListener('click', () => {
    if (!imageLoaded) return;
    snipState = 'selecting1';
    selectionMode = 'snip1'; // Enter snip selection mode
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    isSelecting = false; // Ensure not in dragging state initially
    redrawBaseImage(); // Ensure canvas is clean initially
    updateToolStates();
});

confirmSnip1Btn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'snip1' || isSelecting) return; // Don't confirm while dragging

    const normRect = getNormalizedRect(selectionRect);
    if (!normRect) {
        alert("Invalid selection area for Snip 1. Please drag on the image first.");
        return;
    }

    snip1Rect = normRect;
    try {
        redrawBaseImage(); // <<< Ensure clean image before getting data
        snip1Data = ctx.getImageData(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height); // Clear the area on canvas
        updateCurrentImageStateBuffer(); // <<< Update buffer AFTER clearing
        snipState = 'selected1';
        selectionMode = 'none'; // Exit selection mode
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    } catch (e) {
        console.error("Error getting/clearing image data for Snip 1:", e);
        alert("Could not process the selected area for Snip 1.");
        snipState = 'idle'; // Revert state on error
        selectionMode = 'none';
        snip1Rect = null;
        snip1Data = null;
        redrawBaseImage(); // Redraw clean state on error
    }
    updateToolStates();
});

startSelection2Btn.addEventListener('click', () => {
    if (!imageLoaded || snipState !== 'selected1') return;
    snipState = 'selecting2';
    selectionMode = 'snip2'; // Enter snip selection mode 2
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    isSelecting = false; // Ensure not in dragging state initially
    // No need to redraw here, canvas already shows cleared snip1 area
    updateToolStates();
});

confirmSnip2Btn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'snip2' || !snip1Data || !snip1Rect || isSelecting) return;

    const normRect = getNormalizedRect(selectionRect);
     if (!normRect) {
        alert("Invalid selection area for Snip 2. Please drag on the image first.");
        return;
    }
    snip2Rect = normRect;

    try {
        redrawBaseImage(); // <<< Ensure clean image (with snip1 cleared) before getting data
        const snip2Data = ctx.getImageData(snip2Rect.x, snip2Rect.y, snip2Rect.width, snip2Rect.height);

        // Perform swap
        ctx.putImageData(snip2Data, snip1Rect.x, snip1Rect.y); // Put snip2 data into snip1's spot
        ctx.clearRect(snip2Rect.x, snip2Rect.y, snip2Rect.width, snip2Rect.height); // Clear snip2's original spot *Optional step?* Maybe fill with snip1 directly?
        ctx.putImageData(snip1Data, snip2Rect.x, snip2Rect.y); // Put snip1 data into snip2's spot

        updateCurrentImageStateBuffer(); // <<< Update buffer AFTER swap

        snipState = 'swapped';
        selectionMode = 'none'; // Exit selection mode
        // Clear temporary data
        snip1Data = null;
        snip1Rect = null;
        snip2Rect = null;
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect

    } catch(e) {
        console.error("Error getting/putting image data for Snip 2/Swap:", e);
        alert("Could not perform the swap operation.");
        // Attempt to restore pre-swap state? Difficult. Maybe just reset fully.
        revertBtn.click(); // Easiest way to reset state on failure
        return; // Prevent UI update below if reset was triggered
    }
    updateToolStates();
});


revertBtn.addEventListener('click', () => {
    if (!imageLoaded || !originalImage) return;

    // Ensure canvas dimensions match original image before drawing
    if (imageCanvas.width !== originalImage.naturalWidth || imageCanvas.height !== originalImage.naturalHeight) {
       imageCanvas.width = originalImage.naturalWidth;
       imageCanvas.height = originalImage.naturalHeight;
    }

    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear first
    ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
    updateCurrentImageStateBuffer(); // <<< Update buffer to original state

    // Reset all states
    snipState = 'idle';
    selectionMode = 'none';
    isSelecting = false;
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    snip1Data = null;
    snip1Rect = null;
    snip2Rect = null;

    updateToolStates();
});
// --- End Snip & Swap Button Listeners ---


// --- Filter Functions --- (Modified to update buffer)

function applyFilter(filterFunction) {
    if (!imageLoaded) {
        alert('Please load an image first.');
        return;
    }
     if (isSelecting || selectionMode !== 'none') {
         alert('Please finish or cancel the current selection before applying filters.');
         return;
     }
    try {
        // Use the buffered data if available, otherwise get from canvas
        let imageDataToFilter = currentImageDataForRedraw ? new ImageData(new Uint8ClampedArray(currentImageDataForRedraw.data), currentImageDataForRedraw.width, currentImageDataForRedraw.height) : ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

        filterFunction(imageDataToFilter.data); // Apply the filter logic
        ctx.putImageData(imageDataToFilter, 0, 0); // Put filtered data back on canvas
        updateCurrentImageStateBuffer(); // <<< Update the buffer with filtered result
    } catch (e) {
        console.error("Error applying filter:", e);
        alert("Could not apply the filter.");
        redrawBaseImage(); // Attempt to restore view on error
    }
}

// Grayscale filter logic
grayscaleBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
    });
});

// Sepia filter logic
sepiaBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
            data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
            data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
        }
    });
});

// Invert filter logic
invertBtn.addEventListener('click', () => {
    applyFilter((data) => {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
    });
});

// --- End Filter Functions ---


// --- Transformation Functions --- (Modified for Crop and buffer update)

function rotateCanvas(degrees) {
    if (!imageLoaded) {
        alert('Please load an image first.');
        return;
    }
    if (isSelecting || selectionMode !== 'none') {
        alert('Please finish or cancel the current selection before rotating.');
        return;
    }

    selectionMode = 'none'; // Should already be none, but ensure it
    isSelecting = false;
    // No need to updateToolStates here, will be done at the end

    // Use buffered data for rotation if available
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = imageCanvas.width;
    sourceCanvas.height = imageCanvas.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (currentImageDataForRedraw) {
        sourceCtx.putImageData(currentImageDataForRedraw, 0, 0);
    } else {
        // This case should ideally not happen if buffer logic is correct, but fallback
        console.warn("Rotating from live canvas, buffer was empty.");
        sourceCtx.drawImage(imageCanvas, 0, 0);
    }


    const rad = degrees * Math.PI / 180;
    const currentWidth = sourceCanvas.width;
    const currentHeight = sourceCanvas.height;

    const newWidth = currentHeight; // Swapped for 90 deg rotation
    const newHeight = currentWidth;

    // Use a temp canvas for the actual rotation drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Translate and rotate context of the temp canvas
    tempCtx.translate(newWidth / 2, newHeight / 2);
    tempCtx.rotate(rad);
    // Draw the source image (from buffer) onto the rotated temp canvas
    tempCtx.drawImage(sourceCanvas, -currentWidth / 2, -currentHeight / 2);

    // Update main canvas dimensions and draw the rotated result from temp canvas
    imageCanvas.width = newWidth;
    imageCanvas.height = newHeight;
    ctx.clearRect(0, 0, newWidth, newHeight);
    ctx.drawImage(tempCanvas, 0, 0);

    updateCurrentImageStateBuffer(); // <<< Update buffer AFTER rotation is on main canvas

    // Reset Snip states if any were active (shouldn't be due to initial check, but safety)
    if (snipState !== 'idle') {
        console.log('Resetting snip state due to rotation.');
        snipState = 'idle';
        snip1Data = null; snip1Rect = null; snip2Rect = null;
    }
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset selection rect

    updateToolStates(); // Update UI after rotation is complete
}

rotateLeftBtn.addEventListener('click', () => rotateCanvas(-90));
rotateRightBtn.addEventListener('click', () => rotateCanvas(90));

startCropBtn.addEventListener('click', () => {
    if (!imageLoaded) return;
    if (isSelecting || selectionMode !== 'none') { // Prevent starting crop if already selecting something else
         alert('Please finish or cancel the current selection first.');
         return;
    }
    selectionMode = 'crop';
    snipState = 'idle'; // Ensure snip is reset
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    isSelecting = false; // Not dragging yet
    redrawBaseImage(); // Ensure canvas is clean initially
    updateToolStates();
});

confirmCropBtn.addEventListener('click', () => {
    if (!imageLoaded || selectionMode !== 'crop' || isSelecting) return; // Don't crop while dragging

    const normRect = getNormalizedRect(selectionRect);
    if (!normRect) {
        alert("Invalid crop area. Please drag on the image first.");
        return;
    }

    try {
        // --- Ensure the clean base image is drawn before getting data ---
        redrawBaseImage(); // <<< IMPORTANT: Draw clean state first!

        // Get the pixel data from the selected area of the clean canvas
        const croppedImageData = ctx.getImageData(normRect.x, normRect.y, normRect.width, normRect.height);

        // Create a temporary canvas JUST for the cropped image dimensions
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = normRect.width;
        tempCanvas.height = normRect.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Put the cropped data onto the temporary canvas
        tempCtx.putImageData(croppedImageData, 0, 0);

        // Resize the main canvas to the new cropped dimensions
        imageCanvas.width = normRect.width;
        imageCanvas.height = normRect.height;

        // Clear the (now resized) main canvas and draw the cropped image onto it
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        ctx.drawImage(tempCanvas, 0, 0);

        updateCurrentImageStateBuffer(); // <<< Update buffer AFTER crop is on main canvas

        // Exit crop mode successfully
        selectionMode = 'none';
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect

    } catch (e) {
        console.error("Error during crop:", e);
        alert("Could not perform crop operation. Error: " + e.message);
        selectionMode = 'none'; // Exit crop mode on error
        // Attempt to restore previous state visually might be complex,
        // maybe just redraw base image at original size if possible?
        // Or rely on revert button. For now, just exit mode.
        redrawBaseImage(); // Attempt to show the pre-crop state again
    }
    updateToolStates(); // Update UI
});


// --- End Transformation Functions ---


// Phase 3: Save Modified Image
downloadLnk.addEventListener('click', (event) => {
    if (!imageLoaded) {
        alert('Please load an image first.');
        event.preventDefault();
        return;
    }
    if (isSelecting || selectionMode !== 'none') {
        alert('Please finish or cancel the current selection before downloading.');
        event.preventDefault();
        return;
    }
     if (imageCanvas.width === 0 || imageCanvas.height === 0) {
         alert('Canvas is empty or invalid. Cannot download.');
         event.preventDefault();
         return;
     }

    try {
        // Ensure the final clean state is on the canvas before generating URL
        redrawBaseImage();
        const dataURL = imageCanvas.toDataURL('image/png'); // Specify PNG for transparency support
        downloadLnk.href = dataURL;
        // downloadLnk.download attribute is set when image loads
    } catch (error) {
        console.error('Error generating data URL for download:', error);
        alert('Failed to prepare image for download. The canvas might be too large or in a tainted state (if loading cross-origin images, though not expected here).');
        event.preventDefault();
    }
});

// Initial UI setup on script load
updateToolStates();