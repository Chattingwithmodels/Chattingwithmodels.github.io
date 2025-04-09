// ==================================
//          Element References
// ==================================
const imageLoader = document.getElementById('imageLoader');
const imageCanvas = document.getElementById('imageCanvas');
// Toolbar Buttons
const selectToolBtn = document.getElementById('selectToolBtn');
const cropToolBtn = document.getElementById('cropToolBtn');
const snipToolBtn = document.getElementById('snipToolBtn');
const drawToolBtn = document.getElementById('drawToolBtn');
const textToolBtn = document.getElementById('textToolBtn');
const bubbleToolBtn = document.getElementById('bubbleToolBtn');
const grayscaleBtn = document.getElementById('grayscaleBtn');
const sepiaBtn = document.getElementById('sepiaBtn');
const invertBtn = document.getElementById('invertBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const revertBtn = document.getElementById('revertBtn');
const downloadLnk = document.getElementById('downloadLnk');
// Tool Options Panels & Elements
const toolOptionsPanel = document.getElementById('toolOptionsPanel');
const selectOptions = document.getElementById('selectOptions');
const cropOptions = document.getElementById('cropOptions');
const snipOptions = document.getElementById('snipOptions');
const drawOptions = document.getElementById('drawOptions');
const textOptions = document.getElementById('textOptions');
const bubbleOptions = document.getElementById('bubbleOptions');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const snipStatus = document.getElementById('snipStatus');
const confirmSnip1Btn = document.getElementById('confirmSnip1Btn');
const startSelection2Btn = document.getElementById('startSelection2Btn');
const confirmSnip2Btn = document.getElementById('confirmSnip2Btn');
const cancelSnipBtn = document.getElementById('cancelSnipBtn');
const drawColorInput = document.getElementById('drawColor');
const drawSizeInput = document.getElementById('drawSize');
const drawSizeValue = document.getElementById('drawSizeValue');
const textColorInput = document.getElementById('textColor');
const textSizeInput = document.getElementById('textSize');
const textFontInput = document.getElementById('textFont');
const textInput = document.getElementById('textInput');
const addTextBtn = document.getElementById('addTextBtn');
const bubbleTypeInput = document.getElementById('bubbleType');
const bubbleTextInput = document.getElementById('bubbleText');
const bubbleColorInput = document.getElementById('bubbleColor');
const bubbleFillInput = document.getElementById('bubbleFill');
const addBubbleBtn = document.getElementById('addBubbleBtn');

// ==================================
//          Global State
// ==================================
let ctx = null; // Initialize as null, get in initializeApp
let originalImage = null;
let imageLoaded = false;
let currentImageDataForRedraw = null;
let activeTool = 'select';
let isDragging = false;
let startCoords = { x: 0, y: 0 };
let currentCoords = { x: 0, y: 0 };
// Snip State
let snipState = 'idle';
let snip1Data = null;
let snip1Rect = null;
let snip2Rect = null;
// Draw State
let drawPath = [];
// Text State
let textToPlace = '';
let textPlacementCoords = null;
// Bubble State
let bubbleToPlace = { type: 'speech', text: '', color: '#000000', fill: '#ffffff' };
let bubblePlacementCoords = null;
// Undo History
const MAX_HISTORY = 20;
let historyStack = [];
// Objects on Canvas
let canvasObjects = [];
// Selection State
let selectedObject = null;
let clickOffset = { x: 0, y: 0 }; // Offset between click point and object top-left
let anchorOffset = { x: 0, y: 0 }; // Offset between click point and bubble anchor point
let resizingHandle = null; // Which resize handle is being dragged (e.g., 'bottomRight')
let resizeStart = { x: 0, y: 0, width: 0, height: 0, size: 0 }; // Initial state at resize start

// Constants
const HANDLE_SIZE = 8;

// ==================================
//          Utility Functions
// ==================================

// Function to check if a point is inside a rectangle
function isPointInRect(point, rect) {
    if (!point || !rect) return false;
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
}

function getCanvasCoordinates(event) {
    if (!imageCanvas) return { x: 0, y: 0 };
    const rect = imageCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || imageCanvas.width === 0 || imageCanvas.height === 0) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

function getNormalizedRect(start, end) {
    if (!start || !end) return null;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const canvasWidth = imageCanvas?.width ?? 0;
    const canvasHeight = imageCanvas?.height ?? 0;
    const normX = Math.max(0, x);
    const normY = Math.max(0, y);
    const normWidth = Math.min(width, canvasWidth - normX);
    const normHeight = Math.min(height, canvasHeight - normY);
    if (normWidth < 1 || normHeight < 1) return null;
    if (normWidth <= 0 || normHeight <= 0) return null;
    return { x: normX, y: normY, width: normWidth, height: normHeight };
}

function updateCurrentImageStateBuffer() {
    if (!imageLoaded || !imageCanvas || !ctx || imageCanvas.width === 0 || imageCanvas.height === 0) {
        currentImageDataForRedraw = null;
        return;
    }
    try {
        currentImageDataForRedraw = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    } catch (e) {
        console.error("Error updating image state buffer:", e);
        currentImageDataForRedraw = null;
    }
}

function redrawBaseImage() {
    if (!ctx || !imageCanvas) {
        console.warn("RedrawBaseImage: Missing context or canvas");
        return; // Don't proceed without context/canvas
    }
    try {
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        if (currentImageDataForRedraw) {
            // Ensure canvas dimensions match buffer before putting data
            if (imageCanvas.width !== currentImageDataForRedraw.width || imageCanvas.height !== currentImageDataForRedraw.height) {
                 console.warn("RedrawBaseImage: Adjusting canvas size to match buffer.");
                 imageCanvas.width = currentImageDataForRedraw.width;
                 imageCanvas.height = currentImageDataForRedraw.height;
             }
            ctx.putImageData(currentImageDataForRedraw, 0, 0);
        } else if (originalImage && imageLoaded) {
            // Ensure canvas dimensions match original image
             if (imageCanvas.width !== originalImage.naturalWidth || imageCanvas.height !== originalImage.naturalHeight) {
                 console.warn("RedrawBaseImage: Adjusting canvas size to match original image.");
                 imageCanvas.width = originalImage.naturalWidth;
                 imageCanvas.height = originalImage.naturalHeight;
             }
            ctx.drawImage(originalImage, 0, 0, imageCanvas.width, imageCanvas.height);
            if (!currentImageDataForRedraw) updateCurrentImageStateBuffer(); // Create buffer if missing
        } else {
             // If no buffer and no image, clear (though should ideally show placeholder)
             ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        }
    } catch (e) {
        console.error("Error during redrawBaseImage:", e);
        // Avoid alert loops, just log the error
    }
}

function drawCanvasObjects() {
    if (!ctx) return;
    canvasObjects.forEach(obj => {
        console.log(`Drawing obj:`, obj, ` | Currently selected:`, selectedObject);
        try {
            if (obj.type === 'text') {
                ctx.fillStyle = obj.color;
                ctx.font = `${obj.size}px ${obj.font}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(obj.text, obj.x, obj.y);
            } else if (obj.type === 'bubble') {
                // Pass the original anchor point for drawing, but use stored x,y,w,h for selection rect
                 drawComicBubble(ctx, obj.anchorX, obj.anchorY, obj.text, {
                     type: obj.bubbleType,
                     stroke: obj.color,
                     fill: obj.fill,
                     font: obj.font
                });
            }

            // Draw selection box and handles if this object is selected
            if (obj === selectedObject) {
                console.log("   >>> Drawing selection highlight for:", obj);
                const x = obj.x;
                const y = obj.y;
                const w = obj.width;
                const h = obj.height;

                // Draw main bounding box
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.7)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x, y, w, h);
                ctx.setLineDash([]);

                // Draw resize handle (bottom-right for now)
                ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
                ctx.fillRect(x + w - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + w - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            }
        } catch (e) {
            console.error("Error drawing object:", obj, e);
        }
    });
}

function redrawFullCanvas() {
    console.log("Redrawing full canvas...");
    redrawBaseImage();
    drawCanvasObjects();
}

// Function to save the current state to the history stack
function saveStateToHistory() {
    if (!currentImageDataForRedraw) {
        console.warn("Attempted to save null state to history.");
        return;
    }
    // IMPORTANT: Create a deep copy of the ImageData object
    const stateCopy = new ImageData(
        new Uint8ClampedArray(currentImageDataForRedraw.data),
        currentImageDataForRedraw.width,
        currentImageDataForRedraw.height
    );

    if (historyStack.length >= MAX_HISTORY) {
        historyStack.shift(); // Remove the oldest state if limit reached
    }
    historyStack.push(stateCopy);
    console.log(`History saved. Stack size: ${historyStack.length}`);
    updateToolStates(); // Update UI (e.g., enable Undo button)
}

// ==================================
//    Tool Activation & UI Management
// ==================================
const toolButtonsMap = {
    select: selectToolBtn,
    crop: cropToolBtn,
    snip: snipToolBtn,
    draw: drawToolBtn,
    text: textToolBtn,
    bubble: bubbleToolBtn
};
const toolOptionsDivsMap = {
    select: selectOptions,
    crop: cropOptions,
    snip: snipOptions,
    draw: drawOptions,
    text: textOptions,
    bubble: bubbleOptions
};

function setActiveTool(newTool) {
    if (!imageLoaded && newTool !== 'select') return;
    if (activeTool === newTool) return;
    if (isDragging) { isDragging = false; redrawBaseImage(); }
    resetToolState(activeTool);
    activeTool = newTool;
    console.log("Active tool:", activeTool);
    Object.values(toolButtonsMap).forEach(btn => btn?.classList.remove('active-tool'));
    if (toolButtonsMap[activeTool]) toolButtonsMap[activeTool].classList.add('active-tool');
    Object.values(toolOptionsDivsMap).forEach(div => { if (div) div.style.display = 'none'; });
    if (toolOptionsDivsMap[activeTool]) toolOptionsDivsMap[activeTool].style.display = 'flex';
    updateToolStates();
}

function resetToolState(toolName) {
    isDragging = false;
    startCoords = { x: 0, y: 0 };
    currentCoords = { x: 0, y: 0 };
    console.log(`Resetting state for tool: ${toolName}`);
    switch (toolName) {
        case 'crop': break;
        case 'snip':
            if (snipState !== 'swapped' && snipState !== 'idle') {
                 if (snip1Data && snip1Rect && snipState === 'selected1') {
                    redrawBaseImage();
                    if(ctx) ctx.putImageData(snip1Data, snip1Rect.x, snip1Rect.y);
                    updateCurrentImageStateBuffer();
                 }
                snipState = 'idle';
                snip1Data = null; snip1Rect = null; snip2Rect = null;
            }
            break;
        case 'draw': drawPath = []; break;
        case 'text':
            textToPlace = ''; textPlacementCoords = null;
            if(textInput) textInput.value = ''; break;
        case 'bubble':
            bubbleToPlace.text = ''; bubblePlacementCoords = null;
            if(bubbleTextInput) bubbleTextInput.value = ''; break;
    }
    redrawFullCanvas();
}

function updateToolStates() {
    const selectOptionsSpan = selectOptions?.querySelector('span');
    const allActionButtons = [
        grayscaleBtn, sepiaBtn, invertBtn, rotateLeftBtn, rotateRightBtn, confirmCropBtn,
        cancelCropBtn, confirmSnip1Btn, startSelection2Btn, confirmSnip2Btn, cancelSnipBtn,
        addTextBtn, addBubbleBtn
    ];

    if (!imageLoaded) {
        Object.entries(toolButtonsMap).forEach(([name, btn]) => { if(btn) btn.disabled = (name !== 'select'); });
        allActionButtons.forEach(el => { if (el) el.disabled = true; });
        if (revertBtn) revertBtn.disabled = true;
        if (imageCanvas) imageCanvas.style.cursor = 'default';
        if (selectOptionsSpan) selectOptionsSpan.textContent = "Load an image to begin.";
        return;
    }

    // Enable most buttons by default when image loaded
    [grayscaleBtn, sepiaBtn, invertBtn, rotateLeftBtn, rotateRightBtn].forEach(el => { if (el) el.disabled = false; });
    Object.values(toolButtonsMap).forEach(btn => { if (btn) btn.disabled = false; });
    if (downloadLnk) { downloadLnk.style.pointerEvents = 'auto'; downloadLnk.style.opacity = 1; }

    // Enable/Disable Undo button based on history stack
    if (revertBtn) revertBtn.disabled = historyStack.length === 0;

    let cursor = 'default';
    let statusMessage = 'Ready.';
    // Check if a valid selection exists for crop/snip confirmation
    const selectionMade = getNormalizedRect(startCoords, currentCoords) !== null;

    // Disable buttons based on current state
    confirmCropBtn.disabled = activeTool !== 'crop' || isDragging || !selectionMade;
    cancelCropBtn.disabled = activeTool !== 'crop';
    confirmSnip1Btn.disabled = activeTool !== 'snip' || snipState !== 'selecting1' || isDragging || !selectionMade;
    startSelection2Btn.disabled = activeTool !== 'snip' || snipState !== 'selected1';
    confirmSnip2Btn.disabled = activeTool !== 'snip' || snipState !== 'selecting2' || isDragging || !selectionMade;
    cancelSnipBtn.disabled = activeTool !== 'snip' || snipState === 'idle' || snipState === 'swapped';
    addTextBtn.disabled = activeTool !== 'text' || !(textInput?.value.trim());
    addBubbleBtn.disabled = activeTool !== 'bubble' || !(bubbleTextInput?.value.trim());

    // Disable other actions while dragging
    if (isDragging) {
        [grayscaleBtn, sepiaBtn, invertBtn, rotateLeftBtn, rotateRightBtn].forEach(el => { if (el) el.disabled = true; });
        if (revertBtn) revertBtn.disabled = true;
        if (downloadLnk) { downloadLnk.style.pointerEvents = 'none'; downloadLnk.style.opacity = 0.5; }
    }

    // Set Cursor and Status
    switch (activeTool) {
        case 'select': statusMessage = 'Select a tool or apply filters/transforms.'; break;
        case 'crop': cursor = 'crosshair'; statusMessage = isDragging ? 'Release mouse to finalize selection.' : 'Crop: Drag to select area, then Confirm.'; break;
        case 'snip':
            cursor = (snipState === 'selecting1' || snipState === 'selecting2') ? 'crosshair' : 'default';
            switch (snipState) {
                case 'idle': statusMessage = 'Snip: Drag to select Area 1.'; break;
                case 'selecting1': statusMessage = isDragging ? 'Release for Area 1.' : 'Area 1 selected. Confirm or Cancel.'; break;
                case 'selected1': statusMessage = 'Snip: Click Select Area 2.'; break;
                case 'selecting2': statusMessage = isDragging ? 'Release for Area 2.' : 'Area 2 selected. Confirm or Cancel.'; break;
                case 'swapped': statusMessage = 'Snip: Areas swapped! Cancel to reset.'; break;
            }
            if (snipStatus) snipStatus.textContent = statusMessage;
            break;
        case 'draw': cursor = 'crosshair'; statusMessage = 'Draw: Click and drag to draw.'; break;
        case 'text': cursor = textToPlace ? 'crosshair' : 'text'; statusMessage = textToPlace ? 'Text: Click image to place.' : 'Text: Configure, type, click Add.'; break;
        case 'bubble': cursor = bubbleToPlace.text ? 'crosshair' : 'default'; statusMessage = bubbleToPlace.text ? 'Bubble: Click image to place.' : 'Bubble: Configure, type, click Add.'; break;
    }

    if (imageCanvas) imageCanvas.style.cursor = cursor;
    if (selectOptionsSpan) selectOptionsSpan.textContent = statusMessage;
}

// ==================================
//     Filter & Transform Functions
// ==================================
const filterGrayscale = (data) => { for (let i = 0; i < data.length; i += 4) { const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; data[i] = gray; data[i + 1] = gray; data[i + 2] = gray; } };
const filterSepia = (data) => { for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b); data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b); data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b); } };
const filterInvert = (data) => { for (let i = 0; i < data.length; i += 4) { data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2]; } };

function applyFilter(filterFunction) {
    if (!imageLoaded || !ctx) return alert('Load an image first.');
    if (isDragging) return alert('Finish action first.');
    saveStateToHistory(); // Save state BEFORE applying filter
    try {
        let buffer = currentImageDataForRedraw ? new ImageData(new Uint8ClampedArray(currentImageDataForRedraw.data), currentImageDataForRedraw.width, currentImageDataForRedraw.height) : ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        if (!buffer) throw new Error("Could not get image data.");
        filterFunction(buffer.data);
        ctx.putImageData(buffer, 0, 0);
        updateCurrentImageStateBuffer(); // Update buffer with filtered image
        redrawFullCanvas(); // Redraw base + objects
    } catch (e) { console.error("Filter error:", e); alert("Filter failed."); redrawFullCanvas(); } // Also redraw on error
    updateToolStates();
}

function rotateCanvas(degrees) {
    if (!imageLoaded || !ctx) return alert('Load an image first.');
    if (isDragging) return alert('Finish action first.');
    saveStateToHistory(); // Save state BEFORE rotating
    const sourceCanvas = document.createElement('canvas');
    if (!imageCanvas) return;
    sourceCanvas.width = imageCanvas.width; sourceCanvas.height = imageCanvas.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return;
    if (currentImageDataForRedraw) { sourceCtx.putImageData(currentImageDataForRedraw, 0, 0); }
    else if (originalImage) { sourceCtx.drawImage(originalImage, 0, 0); }
    else { return; }
    const rad = degrees * Math.PI / 180;
    const CW = sourceCanvas.width, CH = sourceCanvas.height;
    const NW = CH, NH = CW;
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = NW; tempCanvas.height = NH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.translate(NW / 2, NH / 2); tempCtx.rotate(rad); tempCtx.drawImage(sourceCanvas, -CW / 2, -CH / 2);
    imageCanvas.width = NW; imageCanvas.height = NH;
    ctx.clearRect(0, 0, NW, NH); ctx.drawImage(tempCanvas, 0, 0);
    updateCurrentImageStateBuffer(); // Update buffer with rotated image

    // Rotation invalidates object coordinates relative to the new canvas dimensions/orientation
    // Simplest approach for now: clear objects. More complex: transform object coords.
    canvasObjects = [];
    console.log("Cleared objects due to rotation.");

    if (snipState !== 'idle') { snipState = 'idle'; snip1Data = null; snip1Rect = null; snip2Rect = null; }
    resetToolState(activeTool);
    redrawFullCanvas(); // Redraw rotated base (objects cleared)
    updateToolStates();
}

// ==================================
//    Tool-Specific Mouse Handlers
// ==================================

// Selection (Crop/Snip)
function handleSelectionMouseDown() { redrawBaseImage(); }
function handleSelectionMouseMove() {
    redrawBaseImage();
    const normRect = getNormalizedRect(startCoords, currentCoords);
    if (normRect && ctx) {
        ctx.strokeStyle = (activeTool === 'crop') ? 'blue' : 'red';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(normRect.x, normRect.y, normRect.width, normRect.height);
        ctx.setLineDash([]);
    }
}
function handleSelectionMouseUp() {
    redrawBaseImage();
    const normRect = getNormalizedRect(startCoords, currentCoords);
    if (!normRect) {
        console.log("Selection ended zero size.");
        if (activeTool === 'snip') {
            if (snipState === 'selecting1') snipState = 'idle';
            else if (snipState === 'selecting2') snipState = 'selected1';
        }
    }
    updateToolStates(); // Reflect potential change in selection validity for confirm buttons
}

// Drawing
function handleDrawMouseDown() {
    if (!ctx) return;
    drawPath = [{ x: startCoords.x, y: startCoords.y }];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColorInput?.value ?? '#ff0000';
    ctx.lineWidth = parseInt(drawSizeInput?.value ?? '5', 10);
}
function handleDrawMouseMove() {
    if (!ctx) return;
    drawPath.push({ x: currentCoords.x, y: currentCoords.y });
    redrawBaseImage();
    if (drawPath.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(drawPath[0].x, drawPath[0].y);
    for (let i = 1; i < drawPath.length; i++) { ctx.lineTo(drawPath[i].x, drawPath[i].y); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColorInput?.value ?? '#ff0000';
    ctx.lineWidth = parseInt(drawSizeInput?.value ?? '5', 10);
    ctx.stroke();
}
function handleDrawMouseUp() {
    if (!ctx || drawPath.length < 2) {
        drawPath = []; redrawFullCanvas(); return; // Redraw even if no line added, to clear preview if any
    }
    saveStateToHistory(); // Save state BEFORE drawing the final line permanently
    redrawBaseImage(); // Redraw without the preview line (draws objects too via drawCanvasObjects call)
    // Draw the final line onto the base canvas
    ctx.beginPath();
    ctx.moveTo(drawPath[0].x, drawPath[0].y);
    for (let i = 1; i < drawPath.length; i++) { ctx.lineTo(drawPath[i].x, drawPath[i].y); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColorInput?.value ?? '#ff0000';
    ctx.lineWidth = parseInt(drawSizeInput?.value ?? '5', 10);
    ctx.stroke();
    updateCurrentImageStateBuffer(); // Update the buffer to include the drawn line
    drawPath = [];
    redrawFullCanvas(); // Ensure objects are redrawn over the final line
}

// Text Placement - Calculate and store bounding box
function handleTextMouseDown() {
    if (!ctx) return;
    if (activeTool === 'text' && textToPlace) {
        console.log("Creating text object...");

        // Estimate bounding box before creating object
        const fontSize = textSizeInput?.value ?? '30';
        const fontFace = textFontInput?.value ?? 'Arial';
        ctx.font = `${fontSize}px ${fontFace}`; // Set font for measurement
        const textMetrics = ctx.measureText(textToPlace);
        // Note: textMetrics provides width, but height estimation is complex.
        // Using fontSize as an approximation for height is common but not perfect.
        // Actual bounding boxes (actualBoundingBoxAscent/Descent) are more accurate but experimental.
        const estimatedHeight = parseFloat(fontSize); // Use font size as height proxy
        const estimatedWidth = textMetrics.width;

        const textObject = {
            type: 'text',
            text: textToPlace,
            x: startCoords.x,
            y: startCoords.y,
            width: estimatedWidth,
            height: estimatedHeight,
            color: textColorInput?.value ?? '#000000',
            size: fontSize,
            font: fontFace
        };
        canvasObjects.push(textObject);
        console.log("Text object added:", textObject);

        textToPlace = '';
        textPlacementCoords = null;
        isDragging = false;
        redrawFullCanvas();
        updateToolStates();
    } else {
        // No selection logic here anymore, moved to global handler
        isDragging = false;
    }
}
function handleTextMouseMove() { /* No preview for now */ }
function handleTextMouseUp() { /* Action on down */ }

// Bubble Placement - Store initial size
function handleBubbleMouseDown() {
    if (!ctx) return;
    if (activeTool === 'bubble' && bubbleToPlace.text) {
        console.log("Creating bubble object...");

        // --- Calculate Bounding Box & Initial Size ---
        const initialFont = '14px Comic Sans MS'; // TODO: Make configurable
        const initialFontSize = 14;
        const bubbleOptions = {
            type: bubbleToPlace.type,
            stroke: bubbleToPlace.color,
            fill: bubbleToPlace.fill,
            font: initialFont
        };
        ctx.font = bubbleOptions.font;
        const textMetrics = ctx.measureText(bubbleToPlace.text);
        // Define constants used in calculation (matching drawComicBubble)
        const padding = 10;
        const tailHeight = 15;
        const textWidth = textMetrics.width;
        const textHeight = initialFontSize;
        const rectWidth = textWidth + 2 * padding;
        const rectHeight = textHeight + 2 * padding;
        const bubbleX = startCoords.x - rectWidth / 2;
        const bubbleY = startCoords.y - rectHeight / 2 - tailHeight;
        // --- End Calculation ---

        const bubbleObject = {
            type: 'bubble',
            bubbleType: bubbleToPlace.type,
            text: bubbleToPlace.text,
            anchorX: startCoords.x,
            anchorY: startCoords.y,
            x: bubbleX,
            y: bubbleY,
            width: rectWidth,
            height: rectHeight,
            color: bubbleToPlace.color,
            fill: bubbleToPlace.fill,
            font: initialFont,
            size: initialFontSize // Store initial numeric size
        };
        canvasObjects.push(bubbleObject);
        console.log("Bubble object added:", bubbleObject);

        bubbleToPlace.text = '';
        bubblePlacementCoords = null;
        isDragging = false;
        redrawFullCanvas();
        updateToolStates();
     } else {
        isDragging = false;
    }
}
function handleBubbleMouseMove() { /* No preview for now */ }
function handleBubbleMouseUp() { /* Action on down */ }

// ==================================
//    Tool Confirmation Handlers
// ==================================
function handleConfirmCrop() {
     if (activeTool !== 'crop' || isDragging || !ctx) return;
    const normRect = getNormalizedRect(startCoords, currentCoords);
    if (!normRect) return alert("Invalid crop area. Drag first.");
    saveStateToHistory(); // Save state BEFORE cropping
    try {
        const croppedImageData = ctx.getImageData(normRect.x, normRect.y, normRect.width, normRect.height);
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = normRect.width; tempCanvas.height = normRect.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error("Failed context for temp crop canvas.");
        tempCtx.putImageData(croppedImageData, 0, 0);
        if (imageCanvas) { imageCanvas.width = normRect.width; imageCanvas.height = normRect.height; }
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); ctx.drawImage(tempCanvas, 0, 0);
        updateCurrentImageStateBuffer(); // Update buffer with CROPPED base image
        canvasObjects = []; // Clear objects after crop (coordinates are now invalid)
        setActiveTool('select');
        redrawFullCanvas(); // Redraw cropped base (objects are cleared)
    } catch (e) { console.error("Crop error:", e); alert("Crop failed."); redrawFullCanvas(); setActiveTool('select'); }
    updateToolStates();
}

function handleConfirmSnip1() {
    if (activeTool !== 'snip' || snipState !== 'selecting1' || isDragging || !ctx) return;
    const normRect = getNormalizedRect(startCoords, currentCoords);
    if (!normRect) return alert("Invalid selection for Snip 1.");
    snip1Rect = normRect;
    try {
        redrawBaseImage();
        snip1Data = ctx.getImageData(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        ctx.clearRect(snip1Rect.x, snip1Rect.y, snip1Rect.width, snip1Rect.height);
        updateCurrentImageStateBuffer();
        snipState = 'selected1';
        startCoords = { x: 0, y: 0 }; currentCoords = { x: 0, y: 0 };
    } catch (e) { console.error("Snip 1 error:", e); alert("Snip 1 failed."); snipState = 'idle'; snip1Rect = null; snip1Data = null; redrawBaseImage(); }
    updateToolStates();
}

function handleStartSelection2() {
    if (activeTool !== 'snip' || snipState !== 'selected1') return;
    snipState = 'selecting2';
    startCoords = { x: 0, y: 0 }; currentCoords = { x: 0, y: 0 };
    updateToolStates();
}

function handleConfirmSnip2() {
     if (activeTool !== 'snip' || snipState !== 'selecting2' || !snip1Data || !snip1Rect || isDragging || !ctx) return;
    const normRect = getNormalizedRect(startCoords, currentCoords);
    if (!normRect) return alert("Invalid selection for Snip 2.");
    saveStateToHistory(); // Save state BEFORE swapping
    snip2Rect = normRect;
    try {
        redrawBaseImage(); // Redraw to get clean state before getting snip2 data
        const snip2Data = ctx.getImageData(snip2Rect.x, snip2Rect.y, snip2Rect.width, snip2Rect.height);
        ctx.putImageData(snip2Data, snip1Rect.x, snip1Rect.y);
        ctx.putImageData(snip1Data, snip2Rect.x, snip2Rect.y);
        updateCurrentImageStateBuffer();
        canvasObjects = [];
        snipState = 'swapped';
        snip1Data = null; snip1Rect = null; snip2Rect = null;
        startCoords = { x: 0, y: 0 }; currentCoords = { x: 0, y: 0 };
        redrawFullCanvas(); // Redraw swapped base (objects cleared)
    } catch (e) { console.error("Snip 2 Swap error:", e); alert("Swap failed."); redrawFullCanvas(); snipState = 'selected1'; }
    updateToolStates();
}

function handleTextAddClick() {
    console.log("Add Text button listener executing.");
    if (!textInput) { console.error("textInput null in handleTextAddClick"); return; }
    if (activeTool === 'text' && textInput.value.trim()) {
        textToPlace = textInput.value.trim();
        console.log("Text ready to place:", textToPlace);
        updateToolStates();
    } else {
        console.log(`Add Text condition failed: activeTool=${activeTool}, text='${textInput.value}'`);
    }
}

function handleBubbleAddClick() {
    console.log("Add Bubble button listener executing.");
    if (!bubbleTextInput) { console.error("bubbleTextInput null in handleBubbleAddClick"); return; }
    if (activeTool === 'bubble' && bubbleTextInput.value.trim()) {
        bubbleToPlace.text = bubbleTextInput.value.trim();
        bubbleToPlace.type = bubbleTypeInput?.value ?? 'speech';
        bubbleToPlace.color = bubbleColorInput?.value ?? '#000000';
        bubbleToPlace.fill = bubbleFillInput?.value ?? '#ffffff';
        console.log("Bubble ready to place:", bubbleToPlace);
        updateToolStates();
    } else {
         console.log(`Add Bubble condition failed: activeTool=${activeTool}, text='${bubbleTextInput.value}'`);
    }
}

// ==================================
//         Global Handlers
// ==================================

function handleCanvasMouseDown(event) {
    if (!imageLoaded || !ctx) return;
    if (isDragging) return; // Prevent starting new action if already dragging/resizing

    startCoords = getCanvasCoordinates(event);
    currentCoords = startCoords;
    isDragging = false;
    resizingHandle = null; // Reset resizing state on every new click

    // --- Check for RESIZE HANDLE click first if an object is selected ---
    if (activeTool === 'select' && selectedObject) {
        const obj = selectedObject;
        const x = obj.x;
        const y = obj.y;
        const w = obj.width;
        const h = obj.height;

        // Define bottom-right handle rect
        const handleRect = {
            x: x + w - HANDLE_SIZE / 2,
            y: y + h - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE
        };

        console.log(`Checking resize handle click at:`, startCoords, ` | Handle Rect:`, handleRect);
        if (isPointInRect(startCoords, handleRect)) {
            isDragging = true;
            resizingHandle = 'bottomRight';
            // Store initial state for calculations during resize
            resizeStart = { x: obj.x, y: obj.y, width: obj.width, height: obj.height, size: obj.size, anchorX: obj.anchorX, anchorY: obj.anchorY };
            console.log(`   >>> HIT Resize Handle! Starting resize. Initial state:`, resizeStart);
            // Don't proceed to check for object selection/deselection
            updateToolStates();
            return; // Stop processing this click further
        }
    }

    // --- If not clicking a resize handle, proceed with TOOL ACTION or OBJECT SELECTION ---
    selectedObject = null; // Deselect previous object if not clicking its handle
    redrawFullCanvas(); // Redraw to remove old selection highlight immediately

    switch (activeTool) {
        case 'select':
            // Iterate backwards to select topmost object first
            for (let i = canvasObjects.length - 1; i >= 0; i--) {
                const obj = canvasObjects[i];
                const objRect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
                console.log(`   Checking object ${i}:`, obj, ` | Rect:`, objRect);
                if (isPointInRect(startCoords, objRect)) {
                    selectedObject = obj;
                    console.log(`   >>> HIT! Assigning selectedObject:`, selectedObject);
                    canvasObjects.splice(i, 1);
                    canvasObjects.push(selectedObject);
                    clickOffset = { x: startCoords.x - selectedObject.x, y: startCoords.y - selectedObject.y };
                    if (selectedObject.type === 'bubble') {
                        anchorOffset = { x: startCoords.x - selectedObject.anchorX, y: startCoords.y - selectedObject.anchorY };
                    } else {
                        anchorOffset = { x: 0, y: 0 };
                    }
                    isDragging = true; // Start dragging the selected object
                    console.log("Selected object:", selectedObject, "ClickOffset:", clickOffset, "AnchorOffset:", anchorOffset);
                    break;
                }
            }
            if (!selectedObject) {
                console.log("Clicked empty area (global handler).");
            }
            redrawFullCanvas(); // Redraw again to show new selection highlight (or lack thereof)
            break;
        case 'crop': case 'snip':
            isDragging = true;
            handleSelectionMouseDown();
            break;
        case 'draw':
            isDragging = true;
            handleDrawMouseDown();
            break;
        case 'text':
             handleTextMouseDown();
             break;
        case 'bubble':
             handleBubbleMouseDown();
             break;
        default:
            isDragging = false;
            break;
    }
    updateToolStates();
}

function handleCanvasMouseMove(event) {
    if (!imageLoaded || !ctx) return;
    if (!isDragging) return;

    currentCoords = getCanvasCoordinates(event);

    // --- Handle RESIZING --- (if a handle is being dragged)
    if (activeTool === 'select' && resizingHandle) {
        if (selectedObject) {
            const dx = currentCoords.x - startCoords.x;
            const dy = currentCoords.y - startCoords.y;
            let newWidth = resizeStart.width + dx;
            let newHeight = resizeStart.height + dy;
            if (newWidth < HANDLE_SIZE * 2) newWidth = HANDLE_SIZE * 2;
            if (newHeight < HANDLE_SIZE * 2) newHeight = HANDLE_SIZE * 2;

            // Update dimensions visually for the box (might not perfectly match content)
            selectedObject.width = newWidth;
            selectedObject.height = newHeight;

            // --- Update Text Size --- (Proportional to width change)
            if (selectedObject.type === 'text' && resizeStart.width > 0) {
                const originalSize = parseFloat(resizeStart.size);
                const newSize = Math.max(5, originalSize * (newWidth / resizeStart.width));
                selectedObject.size = newSize.toFixed(1);
                selectedObject.height = newSize; // Height approx = font size
            }

            // --- Update Bubble Size (Font) --- (Proportional to width change)
            if (selectedObject.type === 'bubble' && resizeStart.width > 0) {
                const originalSize = parseFloat(resizeStart.size);
                const newSize = Math.max(5, originalSize * (newWidth / resizeStart.width));
                selectedObject.size = newSize.toFixed(1); // Store numeric size
                // Update font string (assuming Comic Sans MS for now)
                selectedObject.font = `${selectedObject.size}px Comic Sans MS`;
                // Height of the box is updated above, drawing uses font
            }

            redrawFullCanvas();
        }
    }
    // --- Handle MOVING --- (if dragging but not resizing)
    else if (activeTool === 'select' && selectedObject) {
        const newX = currentCoords.x - clickOffset.x;
        const newY = currentCoords.y - clickOffset.y;
        selectedObject.x = newX;
        selectedObject.y = newY;
        if (selectedObject.type === 'bubble') {
            selectedObject.anchorX = currentCoords.x - anchorOffset.x;
            selectedObject.anchorY = currentCoords.y - anchorOffset.y;
        }
        redrawFullCanvas();
    }
    // --- Handle other tool drags --- (crop, snip, draw)
    else {
        switch (activeTool) {
            case 'crop': case 'snip': handleSelectionMouseMove(); break;
            case 'draw': handleDrawMouseMove(); break;
        }
    }
}

function handleCanvasMouseUp(event) {
    if (!imageLoaded || !ctx) return;
    if (!isDragging) return;

    currentCoords = getCanvasCoordinates(event);
    const wasDragging = isDragging;
    const wasResizing = resizingHandle !== null;

    isDragging = false; // Stop dragging/resizing
    resizingHandle = null; // Reset handle state

    switch (activeTool) {
        case 'select':
            if (wasResizing && selectedObject) {
                console.log("Finished resizing object:", selectedObject);
                // Recalculate final text width/height based on final size
                if (selectedObject.type === 'text') {
                    ctx.font = `${selectedObject.size}px ${selectedObject.font}`;
                    const finalMetrics = ctx.measureText(selectedObject.text);
                    selectedObject.width = finalMetrics.width;
                    selectedObject.height = parseFloat(selectedObject.size);
                }
                // Recalculate final bubble width/height based on final size
                if (selectedObject.type === 'bubble') {
                    ctx.font = selectedObject.font; // Use the potentially updated font string
                    const finalMetrics = ctx.measureText(selectedObject.text);
                    const padding = 10;
                    const finalFontSize = selectedObject.size;
                    selectedObject.width = finalMetrics.width + 2 * padding;
                    selectedObject.height = parseFloat(finalFontSize) + 2 * padding;
                    // Anchor point does not need recalculation unless we change positioning logic
                }
            } else {
                console.log("Finished moving object:", selectedObject);
            }
            // Keep object selected
            break;
        case 'crop': case 'snip': handleSelectionMouseUp(); break;
        case 'draw': handleDrawMouseUp(); break;
    }

    if (wasDragging) {
        redrawFullCanvas();
        updateToolStates();
    }
}

function handleCanvasMouseLeave(event) {
     if (isDragging) {
        console.log('Mouse left canvas during drag, canceling action.');
        // If dragging an object, revert its position? Or just stop drag?
        // Let's just stop the drag for now.
        if (activeTool === 'select' && selectedObject) {
            // Maybe snap back? For now, just stop.
             console.log("Cancelled object drag.");
        }

        isDragging = false; // Stop dragging regardless of tool
        selectedObject = null; // Deselect object if dragging out

        const toolBeingReset = activeTool;
        resetToolState(toolBeingReset); // This calls redrawFullCanvas now
        updateToolStates(); // Update UI
    }
}

function handleImageLoad(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG or JPEG).');
        if(imageLoader) imageLoader.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            originalImage = img;
            if (!imageCanvas || !ctx) { console.error("Canvas/context issue during image load."); return; }
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            imageLoaded = true;
            updateCurrentImageStateBuffer();
            historyStack = []; // Clear history for new image
            canvasObjects = []; // Clear objects for new image
            if(downloadLnk) { downloadLnk.href = '#'; downloadLnk.download = `edited-${file.name || 'image'}.png`; }
            setActiveTool('select');
            redrawFullCanvas(); // Initial draw (should be blank or show placeholder if needed)
            updateToolStates();
        }
        img.onerror = function() {
            alert('Error loading image data. File might be corrupt.');
            imageLoaded = false; originalImage = null; currentImageDataForRedraw = null;
            setActiveTool('select');
            if(ctx && imageCanvas) ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            updateToolStates();
        }
        img.src = e.target.result;
    }
    reader.onerror = function() {
        alert('Error reading file.');
        imageLoaded = false; originalImage = null; currentImageDataForRedraw = null;
        setActiveTool('select'); updateToolStates();
    }
    reader.readAsDataURL(file);
}

// Rename handleRevert to handleUndo and implement Undo logic
function handleUndo() {
    if (historyStack.length === 0) {
        console.log("History stack empty, cannot undo.");
        // Optionally alert user? Button should be disabled anyway.
        return;
    }
    if (isDragging) {
        console.log("Cannot undo while dragging.");
        return;
    }

    const lastState = historyStack.pop();
    console.log(`Undo: Restoring state. Stack size: ${historyStack.length}`);

    if (lastState && imageCanvas && ctx) {
        currentImageDataForRedraw = lastState;
        if (imageCanvas.width !== lastState.width || imageCanvas.height !== lastState.height) {
             imageCanvas.width = lastState.width;
             imageCanvas.height = lastState.height;
        }
        // Simple Undo: Assume objects are gone when base image changes
        // More complex undo would need to save/restore object state too
        canvasObjects = [];
        redrawFullCanvas(); // Redraw restored base image (objects cleared)
    } else {
        console.error("Error restoring history state...");
        if (originalImage && imageCanvas && ctx) {
             console.log("Fallback: Reverting to original image due to undo error.");
             imageCanvas.width = originalImage.naturalWidth;
             imageCanvas.height = originalImage.naturalHeight;
             ctx.drawImage(originalImage, 0, 0);
             updateCurrentImageStateBuffer();
             historyStack = [];
             canvasObjects = []; // Clear objects on fallback too
             redrawFullCanvas();
        }
    }
    setActiveTool('select');
    updateToolStates();
}

function handleDownload(event) {
     if (!imageLoaded || !imageCanvas) { alert('Load an image first.'); event.preventDefault(); return; }
    if (isDragging) { alert('Finish action first.'); event.preventDefault(); return; }
    try {
        setActiveTool('select');
        // Ensure objects are drawn onto the canvas before generating URL
        redrawFullCanvas();
        const dataURL = imageCanvas.toDataURL('image/png');
        if(downloadLnk) downloadLnk.href = dataURL;
    } catch (error) { console.error('Download error:', error); alert('Download failed.'); event.preventDefault(); }
}

// ==================================
//      Comic Bubble Drawing
// ==================================
function drawComicBubble(ctx, x, y, text, options) {
    // Note: x, y passed here are currently the CENTER/click point used for tail calculation.
    // Selection logic uses the calculated top-left x,y stored on the object.
    // This needs careful alignment if we want bounding box to be exact.
    if (!ctx) return;
    // console.log("Drawing bubble with options:", options); // Reduce noise
    const defaultOptions = { type: 'speech', stroke: '#000', fill: '#fff', font: '14px Comic Sans MS', padding: 10, tailHeight: 15, tailWidth: 10 };
    const opts = { ...defaultOptions, ...options }; // Use passed options

    ctx.save(); // Save context state
    ctx.font = opts.font;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = parseInt(ctx.font.match(/\d+/)?.[0] || '14', 10);
    const rectWidth = textWidth + 2 * opts.padding;
    const rectHeight = textHeight + 2 * opts.padding;
    let rectX = x - rectWidth / 2;
    let rectY = y - rectHeight / 2 - opts.tailHeight;

    ctx.fillStyle = opts.fill;
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = 2;

    // Draw Bubble Body
    ctx.beginPath();
    if (opts.type === 'speech') {
        // Simple rounded rectangle for speech bubble
        const radius = 10;
        ctx.moveTo(rectX + radius, rectY);
        ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight);
        ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
        ctx.closePath();
    } else if (opts.type === 'thought') {
        // Simple ellipse for thought bubble
        const rx = rectWidth / 2;
        const ry = rectHeight / 2;
        rectY = y - ry - opts.tailHeight; // Adjust Y for ellipse center
        rectX = x;
        ctx.ellipse(rectX, rectY, rx, ry, 0, 0, 2 * Math.PI);
    }
    ctx.fill();
    ctx.stroke();

    // Draw Tail / Thought Bubbles
    ctx.beginPath();
    if (opts.type === 'speech') {
        // Position tail base centered below bubble
        const tailBaseX = x;
        const tailBaseY = rectY + rectHeight;
        ctx.moveTo(tailBaseX - opts.tailWidth, tailBaseY);
        ctx.lineTo(x, y); // Point to click location
        ctx.lineTo(tailBaseX + opts.tailWidth, tailBaseY);
        ctx.closePath();
        ctx.fillStyle = opts.fill; // Fill tail same as bubble
        ctx.fill();
        ctx.stroke();
    } else if (opts.type === 'thought') {
        // Draw small thought ellipses leading to main bubble
        const bubbleRadius1 = 5;
        const bubbleRadius2 = 3;
        const bubbleY1 = rectY + rectHeight / 2 + 15;
        const bubbleY2 = bubbleY1 + 10;
        ctx.ellipse(x - 5, bubbleY1, bubbleRadius1, bubbleRadius1 * 0.7, 0, 0, 2 * Math.PI);
        ctx.ellipse(x + 2, bubbleY2, bubbleRadius2, bubbleRadius2 * 0.7, 0, 0, 2 * Math.PI);
        ctx.fillStyle = opts.fill;
        ctx.fill();
        ctx.stroke();
    }

    // Draw Text Inside
    ctx.fillStyle = opts.stroke;
    ctx.font = opts.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Adjust text Y position slightly for ellipse/rounded rect
    const textDrawY = (opts.type === 'thought') ? rectY : rectY + rectHeight / 2;
    ctx.fillText(text, x, textDrawY);

    ctx.restore(); // Restore context state
}

// ==================================
//      Initialization Function
// ==================================
function initializeApp() {
    console.log("Initializing app...");
    if (!imageCanvas) {
        console.error("Image canvas not found! Cannot initialize.");
        return;
    }
    // Get context here, after ensuring canvas exists
    ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        console.error("Failed to get 2D context");
        return;
    }

    console.log("Canvas context obtained.");

    // --- Event Listeners (Check elements exist before attaching) ---
    if (selectToolBtn) selectToolBtn.addEventListener('click', () => setActiveTool('select')); else console.warn("selectToolBtn not found");
    if (cropToolBtn) cropToolBtn.addEventListener('click', () => setActiveTool('crop')); else console.warn("cropToolBtn not found");
    if (snipToolBtn) snipToolBtn.addEventListener('click', () => { snipState = 'idle'; snip1Data = null; snip1Rect = null; snip2Rect = null; setActiveTool('snip'); }); else console.warn("snipToolBtn not found");
    if (drawToolBtn) drawToolBtn.addEventListener('click', () => setActiveTool('draw')); else console.warn("drawToolBtn not found");
    if (textToolBtn) textToolBtn.addEventListener('click', () => setActiveTool('text')); else console.warn("textToolBtn not found");
    if (bubbleToolBtn) bubbleToolBtn.addEventListener('click', () => setActiveTool('bubble')); else console.warn("bubbleToolBtn not found");

    if (grayscaleBtn) grayscaleBtn.addEventListener('click', () => applyFilter(filterGrayscale)); else console.warn("grayscaleBtn not found");
    if (sepiaBtn) sepiaBtn.addEventListener('click', () => applyFilter(filterSepia)); else console.warn("sepiaBtn not found");
    if (invertBtn) invertBtn.addEventListener('click', () => applyFilter(filterInvert)); else console.warn("invertBtn not found");
    if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => rotateCanvas(-90)); else console.warn("rotateLeftBtn not found");
    if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => rotateCanvas(90)); else console.warn("rotateRightBtn not found");
    if (revertBtn) revertBtn.addEventListener('click', handleUndo); else console.warn("revertBtn not found");
    if (downloadLnk) downloadLnk.addEventListener('click', handleDownload); else console.warn("downloadLnk not found");

    // Tool Option Listeners
    if (drawSizeInput) drawSizeInput.addEventListener('input', (e) => { if(drawSizeValue) drawSizeValue.textContent = `${e.target.value}px`; }); else console.warn("drawSizeInput not found");
    if (addTextBtn) addTextBtn.addEventListener('click', handleTextAddClick); else console.warn("addTextBtn not found");
    if (addBubbleBtn) addBubbleBtn.addEventListener('click', handleBubbleAddClick); else console.warn("addBubbleBtn not found");
    if (cancelCropBtn) cancelCropBtn.addEventListener('click', () => { if (activeTool === 'crop') setActiveTool('select'); }); else console.warn("cancelCropBtn not found");
    if (cancelSnipBtn) cancelSnipBtn.addEventListener('click', () => { if (activeTool === 'snip') setActiveTool('select'); }); else console.warn("cancelSnipBtn not found");
    if (confirmSnip1Btn) confirmSnip1Btn.addEventListener('click', handleConfirmSnip1); else console.warn("confirmSnip1Btn not found");
    if (startSelection2Btn) startSelection2Btn.addEventListener('click', handleStartSelection2); else console.warn("startSelection2Btn not found");
    if (confirmSnip2Btn) confirmSnip2Btn.addEventListener('click', handleConfirmSnip2); else console.warn("confirmSnip2Btn not found");
    if (confirmCropBtn) confirmCropBtn.addEventListener('click', handleConfirmCrop); else console.warn("confirmCropBtn not found");

    // Canvas Listeners
    imageCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    imageCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    imageCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    imageCanvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Image Loader Listener
    if (imageLoader) imageLoader.addEventListener('change', handleImageLoad); else console.warn("imageLoader not found");

    setActiveTool('select');
    redrawFullCanvas(); // Initial draw (should be blank or show placeholder if needed)
    updateToolStates();
    console.log("App initialized.");
}

// ==================================
//   Run Initialization on DOM Ready
// ==================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp(); // DOM already loaded
}