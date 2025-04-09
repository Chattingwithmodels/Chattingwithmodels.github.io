const imageLoader = document.getElementById('imageLoader');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
const grayscaleBtn = document.getElementById('grayscaleBtn');
const downloadLnk = document.getElementById('downloadLnk');

// --- Snip & Swap Elements ---
const startSelectionBtn = document.getElementById('startSelectionBtn');
const confirmSnip1Btn = document.getElementById('confirmSnip1Btn');
const startSelection2Btn = document.getElementById('startSelection2Btn');
const confirmSnip2Btn = document.getElementById('confirmSnip2Btn');
const resetSnipBtn = document.getElementById('resetSnipBtn');
const snipStatus = document.getElementById('snipStatus');
// --- End Snip & Swap Elements ---

let originalImage = null; // Store the original Image object
let imageLoaded = false;

// --- Snip & Swap State ---
let isSelecting = false;
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
    if (!isSelecting && snipState !== 'selecting1' && snipState !== 'selecting2') return;

    // Redraw the original image (or current state) first
    // If we cleared snip1, we need to redraw the current canvas state, not the original image
    if (originalImage) {
         if (snipState === 'selected1' || snipState === 'selecting2') {
            // If area 1 is cleared, redraw the current state
            // This is complex if we want perfect redraw; for now, just draw rect on top
         } else {
            // Before first snip, redraw the original clean image
            ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
         }
    }

    const normRect = getNormalizedRect(selectionRect);
    if (normRect && (isSelecting || snipState === 'selecting1' || snipState === 'selecting2')) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line for selection
        ctx.strokeRect(normRect.x, normRect.y, normRect.width, normRect.height);
        ctx.setLineDash([]); // Reset line dash
    }
}

// Helper: Update UI Status and Button States
function updateSnipUI() {
    if (!imageLoaded) {
        snipStatus.textContent = "Load a PNG image to begin.";
        startSelectionBtn.disabled = true;
        confirmSnip1Btn.disabled = true;
        startSelection2Btn.disabled = true;
        confirmSnip2Btn.disabled = true;
        resetSnipBtn.disabled = true;
        imageCanvas.style.cursor = 'default';
        return;
    }

    resetSnipBtn.disabled = false; // Always allow reset once loaded
    imageCanvas.style.cursor = 'default'; // Default cursor

    switch (snipState) {
        case 'idle':
            snipStatus.textContent = "Click 'Select Area 1' to start.";
            startSelectionBtn.disabled = false;
            confirmSnip1Btn.disabled = true;
            startSelection2Btn.disabled = true;
            confirmSnip2Btn.disabled = true;
            break;
        case 'selecting1':
            snipStatus.textContent = "Drag on the canvas to select the first area. Release mouse to finalize.";
            startSelectionBtn.disabled = true;
            confirmSnip1Btn.disabled = false; // Enable confirm once selection starts
            startSelection2Btn.disabled = true;
            confirmSnip2Btn.disabled = true;
            imageCanvas.style.cursor = 'crosshair';
            break;
        case 'selected1':
            snipStatus.textContent = "Area 1 snipped and cleared. Click 'Select Area 2'.";
            startSelectionBtn.disabled = true;
            confirmSnip1Btn.disabled = true;
            startSelection2Btn.disabled = false;
            confirmSnip2Btn.disabled = true;
            imageCanvas.style.cursor = 'default';
            break;
        case 'selecting2':
            snipStatus.textContent = "Drag on the canvas to select the second area. Release mouse to finalize.";
            startSelectionBtn.disabled = true;
            confirmSnip1Btn.disabled = true;
            startSelection2Btn.disabled = true;
            confirmSnip2Btn.disabled = false; // Enable confirm once selection starts
            imageCanvas.style.cursor = 'crosshair';
            break;
         case 'swapped':
             snipStatus.textContent = "Areas swapped! You can reset or download.";
             startSelectionBtn.disabled = false; // Allow starting over
             confirmSnip1Btn.disabled = true;
             startSelection2Btn.disabled = true;
             confirmSnip2Btn.disabled = true;
             imageCanvas.style.cursor = 'default';
             break;
    }
}


// Phase 1: Image Loading/Display (Modified)
imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'image/png') {
        alert('Please select a PNG file.');
        imageLoader.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImage = img; // Store the original Image object
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            imageLoaded = true;
            downloadLnk.href = '#';
            snipState = 'idle'; // Reset snip state on new image load
            snip1Data = null;
            snip1Rect = null;
            snip2Rect = null;
            updateSnipUI(); // Update button states
        }
        img.onerror = function() {
            alert('Error loading image.');
            imageLoaded = false;
            originalImage = null;
            updateSnipUI();
        }
        img.src = e.target.result;
    }

    reader.onerror = function() {
        alert('Error reading file.');
        imageLoaded = false;
        originalImage = null;
        updateSnipUI();
    }

    reader.readAsDataURL(file);
});

// --- Canvas Mouse Events for Selection ---
imageCanvas.addEventListener('mousedown', (event) => {
    if (!imageLoaded || (snipState !== 'selecting1' && snipState !== 'selecting2')) return;

    isSelecting = true;
    const coords = getCanvasCoordinates(event);
    selectionRect.startX = coords.x;
    selectionRect.startY = coords.y;
    selectionRect.endX = coords.x; // Initialize end points
    selectionRect.endY = coords.y;

    // Draw initial rect immediately (a dot) if desired, or wait for mousemove
    // requestAnimationFrame(drawSelectionRect); // Use animation frame for smoother drawing
});

imageCanvas.addEventListener('mousemove', (event) => {
    if (!isSelecting) return;

    const coords = getCanvasCoordinates(event);
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;

    // Redraw canvas + selection rectangle efficiently
    // For simplicity, we might just redraw the original image and the rect
    // A more optimized approach would save the canvas state before drawing the rect
     if (originalImage) {
         // Clear previous rect by redrawing section or whole image
         ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
         // If snip1 is done, need to clear that rect again after drawing original
         if (snip1Rect && (snipState === 'selecting2' || snipState === 'selected1')) {
            ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
         }
         drawSelectionRect(); // Draw the new rectangle
     }
    // requestAnimationFrame(drawSelectionRect); // Use animation frame
});

imageCanvas.addEventListener('mouseup', (event) => {
    if (!isSelecting) return;
    isSelecting = false;

    const coords = getCanvasCoordinates(event);
    selectionRect.endX = coords.x;
    selectionRect.endY = coords.y;

    // Final redraw after mouse up
     if (originalImage) {
         ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
         if (snip1Rect && (snipState === 'selecting2' || snipState === 'selected1')) {
            ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
         }
         drawSelectionRect(); // Draw final rect position
     }
    // Consider calling updateSnipUI() here if needed, though button clicks handle state changes primarily
});
// --- End Canvas Mouse Events ---


// --- Snip & Swap Button Listeners ---
startSelectionBtn.addEventListener('click', () => {
    if (!imageLoaded) return;
    snipState = 'selecting1';
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    updateSnipUI();
});

confirmSnip1Btn.addEventListener('click', () => {
    if (!imageLoaded || snipState !== 'selecting1') return;

    const normRect = getNormalizedRect(selectionRect);
    if (!normRect) {
        alert("Invalid selection area. Please try again.");
        return;
    }

    snip1Rect = normRect;
    try {
        snip1Data = ctx.getImageData(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        snipState = 'selected1';
        selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset for next selection
    } catch (e) {
        console.error("Error getting/clearing image data for Snip 1:", e);
        alert("Could not process the selected area. It might be too large or cross-origin restrictions apply if the image source is remote (not applicable here).");
        snipState = 'idle'; // Revert state on error
        snip1Rect = null;
        snip1Data = null;
    }
    updateSnipUI();
});

startSelection2Btn.addEventListener('click', () => {
    if (!imageLoaded || snipState !== 'selected1') return;
    snipState = 'selecting2';
     selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 }; // Reset rect
    updateSnipUI();
});

confirmSnip2Btn.addEventListener('click', () => {
    if (!imageLoaded || snipState !== 'selecting2' || !snip1Data || !snip1Rect) return;

    const normRect = getNormalizedRect(selectionRect);
     if (!normRect) {
        alert("Invalid selection area 2. Please try again.");
        return;
    }
    snip2Rect = normRect;

    try {
        // Capture data from the second area
        const snip2Data = ctx.getImageData(snip2Rect.x, snip2Rect.y, snip2Rect.width, snip2Rect.height);

        // Draw second snip data into the first snip's location
        // Note: If snip1Rect and snip2Rect overlap, the order matters.
        // We draw snip2 data first, then snip1 data.
        ctx.putImageData(snip2Data, snip1Rect.x, snip1Rect.y);

        // Draw the stored first snip data into the second snip's location
        ctx.putImageData(snip1Data, snip2Rect.x, snip2Rect.y);

        snipState = 'swapped'; // Or back to 'idle' if we want immediate restart
        // Clear temporary data
        snip1Data = null;
        snip1Rect = null;
        snip2Rect = null;
         selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };

    } catch(e) {
        console.error("Error getting/putting image data for Snip 2/Swap:", e);
        alert("Could not process the selected area 2 or perform the swap.");
        // Attempt to restore state? Difficult. Maybe just reset.
        resetSnipBtn.click(); // Trigger reset
        return; // Prevent UI update below if reset was triggered
    }
    updateSnipUI();
});


resetSnipBtn.addEventListener('click', () => {
    if (!imageLoaded || !originalImage) return;

    // Redraw the original image
    ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);

    // Reset all snip states
    snipState = 'idle';
    isSelecting = false;
    selectionRect = { startX: 0, startY: 0, endX: 0, endY: 0 };
    snip1Data = null;
    snip1Rect = null;
    snip2Rect = null;

    updateSnipUI();
});


// --- End Snip & Swap Button Listeners ---


// Phase 2: Grayscale Filter (Original - Keep as is)
grayscaleBtn.addEventListener('click', () => {
    if (!imageLoaded) {
        alert('Please load an image first.');
        return;
    }
    // Consider if grayscale should reset snip state? For now, it operates independently.

    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    // After applying filter, update originalImage if we want reset to go back to grayscale
    // Or keep originalImage as the initially loaded one. Let's keep originalImage as initially loaded.
    // If user wants to snip/swap the grayscaled image, they can. Reset goes to original color.
});

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
updateSnipUI(); 