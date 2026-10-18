import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "Rimor.LUTMaster";

const COLORS = {
    accent: "#4a90d9",
    accentHover: "#5aa0e9",
    accentDark: "#2a5a99",
    bg: "#1a1a1a",
    bgLight: "#222222",
    bgWidget: "#252525",
    bgInput: "#111111",
    text: "#e0e0e0",
    textDim: "#999999",
    border: "#333333",
    red: "#f87171",
    green: "#4ade80",
};

const UI = {
    minWidth: 360,
    maxLuts: 4,
    buttonHeight: 32,
    buttonFontSize: 13,
    widgetFontSize: 14,
    labelFontSize: 12,
    sliderTrackHeight: 6,
    sliderThumbSize: 16,
    padding: 8,
    curveCanvasSize: 200,
};

const PHOTO_FILTERS = [
    "cooling_lbb", "cooling_80", "warming_85", "warming_lba",
    "sepia", "deep_red", "deep_blue", "deep_emerald", "deep_yellow"
];

// ============================================================
// HELPERS
// ============================================================
function makeButton(text, onClick, color = COLORS.accent) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
        flex: 1 1 0;
        min-width: 0;
        height: ${UI.buttonHeight}px;
        background: linear-gradient(180deg, ${color}, ${COLORS.accentDark});
        color: #ffffff;
        border: 1px solid ${color};
        border-radius: 6px;
        font-family: monospace;
        font-size: ${UI.buttonFontSize}px;
        font-weight: bold;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.15s;
        padding: 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = `linear-gradient(180deg, ${COLORS.accentHover}, ${color})`;
        btn.style.boxShadow = `0 0 8px ${color}80`;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = `linear-gradient(180deg, ${color}, ${COLORS.accentDark})`;
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    });
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function createSlider(node, container, label, widgetName, defaultValue, min, max, step, onSave) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        font-family: monospace;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = `
        color: ${COLORS.text};
        font-size: ${UI.labelFontSize}px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: bold;
    `;

    const valueEl = document.createElement('span');
    valueEl.textContent = defaultValue.toFixed(2);
    valueEl.style.cssText = `
        color: ${COLORS.accent};
        font-size: ${UI.widgetFontSize}px;
        font-weight: bold;
    `;

    header.appendChild(labelEl);
    header.appendChild(valueEl);

    const track = document.createElement('div');
    track.style.cssText = `
        position: relative;
        width: 100%;
        height: ${UI.sliderTrackHeight}px;
        background: ${COLORS.bgInput};
        border-radius: 3px;
        cursor: pointer;
    `;

    const fill = document.createElement('div');
    fill.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: ${COLORS.accent};
        border-radius: 3px;
        pointer-events: none;
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
        position: absolute;
        top: 50%;
        width: ${UI.sliderThumbSize}px;
        height: ${UI.sliderThumbSize}px;
        background: ${COLORS.accent};
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        box-shadow: 0 0 4px ${COLORS.accent}80;
    `;

    track.appendChild(fill);
    track.appendChild(thumb);
    row.appendChild(header);
    row.appendChild(track);
    container.appendChild(row);

    let currentValue = defaultValue;
    const range = max - min;

    function updateVisual(value) {
        const pct = (value - min) / range;
        fill.style.width = (pct * 100) + '%';
        thumb.style.left = (pct * 100) + '%';
        valueEl.textContent = value.toFixed(2);
    }

    function setValue(value, fromUser = false) {
        currentValue = Math.max(min, Math.min(max, value));
        updateVisual(currentValue);

        const w = node.widgets?.find(x => x.name === widgetName);
        if (w) {
            w.value = currentValue;
            if (w._state && typeof w._state === 'object') w._state.value = currentValue;
        }

        const idx = node.widgets?.findIndex(x => x.name === widgetName);
        if (idx !== undefined && idx >= 0) {
            if (!node.widgets_values) node.widgets_values = [];
            node.widgets_values[idx] = currentValue;
        }

        if (onSave) onSave(currentValue);
        if (fromUser && node.graph) node.graph.change?.();
    }

    let isDragging = false;

    function handlePointer(e) {
        const rect = track.getBoundingClientRect();
        const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const rawValue = min + pct * range;
        const stepped = Math.round(rawValue / step) * step;
        setValue(stepped, true);
    }

    track.addEventListener('pointerdown', (e) => {
        isDragging = true;
        track.setPointerCapture?.(e.pointerId);
        handlePointer(e);
    });
    track.addEventListener('pointermove', (e) => {
        if (isDragging) handlePointer(e);
    });
    track.addEventListener('pointerup', (e) => {
        isDragging = false;
        track.releasePointerCapture?.(e.pointerId);
    });
    track.addEventListener('dblclick', () => setValue(defaultValue, true));

    updateVisual(currentValue);

    return {
        getValue: () => currentValue,
        setValue: (v) => setValue(v, false),
    };
}

// ============================================================
// COMBO
// ============================================================
function createCombo(node, container, label, widgetName, options, defaultValue, onSave) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        font-family: monospace;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = `
        color: ${COLORS.text};
        font-size: ${UI.labelFontSize}px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: bold;
    `;

    const select = document.createElement('select');
    select.style.cssText = `
        background: ${COLORS.bgInput};
        color: ${COLORS.accent};
        border: 1px solid ${COLORS.border};
        border-radius: 4px;
        padding: 6px 8px;
        font-family: monospace;
        font-size: ${UI.labelFontSize}px;
        font-weight: bold;
        outline: none;
        width: 100%;
        box-sizing: border-box;
    `;

    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt.replace(/_/g, ' ').toUpperCase();
        if (opt === defaultValue) o.selected = true;
        select.appendChild(o);
    });

    select.addEventListener('change', () => {
        const w = node.widgets?.find(x => x.name === widgetName);
        if (w) {
            w.value = select.value;
            if (w._state && typeof w._state === 'object') w._state.value = select.value;
        }
        const idx = node.widgets?.findIndex(x => x.name === widgetName);
        if (idx !== undefined && idx >= 0) {
            if (!node.widgets_values) node.widgets_values = [];
            node.widgets_values[idx] = select.value;
        }
        if (onSave) onSave(select.value);
        node.graph?.change?.();
    });
    select.addEventListener('click', (e) => e.stopPropagation());

    row.appendChild(labelEl);
    row.appendChild(select);
    container.appendChild(row);

    return {
        getValue: () => select.value,
        setValue: (v) => {
            select.value = v;
            const w = node.widgets?.find(x => x.name === widgetName);
            if (w) {
                w.value = v;
                if (w._state && typeof w._state === 'object') w._state.value = v;
            }
            const idx = node.widgets?.findIndex(x => x.name === widgetName);
            if (idx !== undefined && idx >= 0) {
                if (!node.widgets_values) node.widgets_values = [];
                node.widgets_values[idx] = v;
            }
        },
    };
}

// ============================================================
// CHECKBOX
// ============================================================
function createCheckbox(node, container, label, widgetName, defaultValue, onSave) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        cursor: pointer;
        user-select: none;
        font-family: monospace;
        padding: 4px 0;
    `;

    const box = document.createElement('div');
    let checked = !!defaultValue;
    const updateBox = () => {
        box.style.background = checked ? COLORS.accent : COLORS.bgInput;
        box.style.borderColor = checked ? COLORS.accent : COLORS.border;
        box.textContent = checked ? '✓' : '';
    };
    box.style.cssText = `
        width: 24px;
        height: 24px;
        background: ${COLORS.bgInput};
        border: 2px solid ${COLORS.border};
        border-radius: 5px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 16px;
        font-weight: bold;
        transition: all 0.15s;
    `;
    updateBox();

    const text = document.createElement('span');
    text.textContent = label;
    text.style.cssText = `
        color: ${COLORS.text};
        font-size: ${UI.labelFontSize}px;
        font-weight: bold;
        letter-spacing: 0.5px;
    `;

    row.addEventListener('click', (e) => {
        e.stopPropagation();
        checked = !checked;
        updateBox();

        const w = node.widgets?.find(x => x.name === widgetName);
        if (w) {
            w.value = checked;
            if (w._state && typeof w._state === 'object') w._state.value = checked;
        }
        const idx = node.widgets?.findIndex(x => x.name === widgetName);
        if (idx !== undefined && idx >= 0) {
            if (!node.widgets_values) node.widgets_values = [];
            node.widgets_values[idx] = checked;
        }
        if (onSave) onSave(checked);
        node.graph?.change?.();
    });

    row.appendChild(box);
    row.appendChild(text);
    container.appendChild(row);

    return {
        getValue: () => checked,
        setValue: (v) => { checked = !!v; updateBox(); },
    };
}

// ============================================================
// RGB CURVE CANVAS
// ============================================================
function createCurveCanvas(node, container, onSave) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        font-family: monospace;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = "RGB CURVE";
    labelEl.style.cssText = `
        color: ${COLORS.text};
        font-size: ${UI.labelFontSize}px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: bold;
    `;
    wrapper.appendChild(labelEl);

    const canvas = document.createElement('canvas');
    const size = UI.curveCanvasSize;
    canvas.width = size;
    canvas.height = size;
    canvas.style.cssText = `
        background: ${COLORS.bgInput};
        border: 1px solid ${COLORS.border};
        border-radius: 4px;
        cursor: crosshair;
        width: 100%;
        height: auto;
        display: block;
    `;
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const ctx = canvas.getContext('2d');

    const getW = (name, dflt) => {
        const w = node.widgets?.find(x => x.name === name);
        return w ? parseFloat(w.value) : dflt;
    };

    let pointA = { x: getW("curve_a_x", 0.25), y: getW("curve_a_y", 0.25) };
    let pointB = { x: getW("curve_b_x", 0.75), y: getW("curve_b_y", 0.75) };

    let dragging = null;

    function setWidget(name, value) {
        const w = node.widgets?.find(x => x.name === name);
        if (w) {
            w.value = value;
            if (w._state && typeof w._state === 'object') w._state.value = value;
        }
        const idx = node.widgets?.findIndex(x => x.name === name);
        if (idx !== undefined && idx >= 0) {
            if (!node.widgets_values) node.widgets_values = [];
            node.widgets_values[idx] = value;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, size, size);

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const p = (i / 4) * size;
            ctx.beginPath();
            ctx.moveTo(p, 0);
            ctx.lineTo(p, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, p);
            ctx.lineTo(size, p);
            ctx.stroke();
        }

        ctx.strokeStyle = '#333';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, size);
        ctx.lineTo(size, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();

        if (pointA.x > 0) {
            ctx.moveTo(0, size);
            ctx.lineTo(pointA.x * size, size - pointA.y * size);
        } else {
            ctx.moveTo(0, size - pointA.y * size);
        }

        ctx.lineTo(pointB.x * size, size - pointB.y * size);

        if (pointB.x < 1) {
            ctx.lineTo(size, 0);
        } else {
            ctx.lineTo(size, size - pointB.y * size);
        }

        ctx.stroke();

        const drawPoint = (p, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x * size, size - p.y * size, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawPoint(pointA, COLORS.accent);
        drawPoint(pointB, COLORS.green);
    }

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = size / rect.width;
        const scaleY = size / rect.height;
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * scaleX;
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * scaleY;
        return {
            x: Math.max(0, Math.min(1, x / size)),
            y: Math.max(0, Math.min(1, 1 - y / size)),
        };
    }

    function findNearest(mouse) {
        const dA = Math.hypot(mouse.x - pointA.x, mouse.y - pointA.y);
        const dB = Math.hypot(mouse.x - pointB.x, mouse.y - pointB.y);
        if (dA < 0.08 && dA < dB) return 'A';
        if (dB < 0.08) return 'B';
        return null;
    }

    canvas.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const mouse = getMousePos(e);
        dragging = findNearest(mouse);
        if (dragging) {
            canvas.setPointerCapture?.(e.pointerId);
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!dragging) {
            const mouse = getMousePos(e);
            const near = findNearest(mouse);
            canvas.style.cursor = near ? 'grab' : 'crosshair';
            return;
        }
        e.stopPropagation();
        const mouse = getMousePos(e);

        if (dragging === 'A') {
            pointA.x = Math.min(pointB.x - 0.01, mouse.x);
            pointA.y = mouse.y;
            setWidget("curve_a_x", pointA.x);
            setWidget("curve_a_y", pointA.y);
        } else {
            pointB.x = Math.max(pointA.x + 0.01, mouse.x);
            pointB.y = mouse.y;
            setWidget("curve_b_x", pointB.x);
            setWidget("curve_b_y", pointB.y);
        }
        draw();
        if (onSave) onSave();
    });

    canvas.addEventListener('pointerup', (e) => {
        if (dragging) {
            e.stopPropagation();
            dragging = null;
            canvas.releasePointerCapture?.(e.pointerId);
        }
    });

    draw();

    return {
        draw,
        setPoints: (a, b) => {
            pointA = { ...a };
            pointB = { ...b };
            draw();
        },
    };
}

// ============================================================
// LUT SLOTS
// ============================================================
function getLutConfig(node) {
    const raw = node.properties?.lutMasterConfig;
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function setLutConfig(node, cfg) {
    const json = JSON.stringify(cfg);
    node.properties = node.properties || {};
    node.properties.lutMasterConfig = json;
    const w = node.widgets?.find(x => x.name === "lut_config");
    if (w) {
        w.value = json;
        if (w._state && typeof w._state === 'object') w._state.value = json;
    }
    const idx = node.widgets?.findIndex(x => x.name === "lut_config");
    if (idx !== undefined && idx >= 0) {
        if (!node.widgets_values) node.widgets_values = [];
        node.widgets_values[idx] = json;
    }
    node.graph?.change?.();
}

function addLutSlot(node, container) {
    const cfg = getLutConfig(node);
    if (cfg.length >= UI.maxLuts) return;
    cfg.push({ file: "", strength: 100 });
    setLutConfig(node, cfg);
    rebuildLutSlots(node, container);
}

function removeLutSlot(node, index) {
    const cfg = getLutConfig(node);
    cfg.splice(index, 1);
    setLutConfig(node, cfg);
    const c = node._lmContainer;
    if (c) rebuildLutSlots(node, c);
}

function updateLutFile(node, index, filename) {
    const cfg = getLutConfig(node);
    if (cfg[index]) { cfg[index].file = filename; setLutConfig(node, cfg); }
}

function updateLutStrength(node, index, strength) {
    const cfg = getLutConfig(node);
    if (cfg[index]) { cfg[index].strength = strength; setLutConfig(node, cfg); }
}

function createLutSlot(node, container, lutData, index, availableLuts) {
    const card = document.createElement('div');
    card.style.cssText = `
        background: ${COLORS.bgWidget};
        border: 1px solid ${COLORS.border};
        border-left: 3px solid ${COLORS.accent};
        border-radius: 6px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-sizing: border-box;
        width: 100%;
    `;

    const header = document.createElement('div');
    header.style.cssText = `display: flex; align-items: center; gap: 6px; width: 100%;`;

    const numBadge = document.createElement('span');
    numBadge.textContent = `#${index + 1}`;
    numBadge.style.cssText = `
        color: ${COLORS.accent};
        font-family: monospace;
        font-size: ${UI.labelFontSize}px;
        font-weight: bold;
        background: ${COLORS.bgInput};
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
    `;

    const select = document.createElement('select');
    select.style.cssText = `
        flex: 1;
        background: ${COLORS.bgInput};
        color: ${COLORS.accent};
        border: 1px solid ${COLORS.border};
        border-radius: 4px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: ${UI.labelFontSize}px;
        font-weight: bold;
        outline: none;
        box-sizing: border-box;
    `;

    const emptyOpt = document.createElement('option');
    emptyOpt.value = "";
    emptyOpt.textContent = "— none —";
    select.appendChild(emptyOpt);

    availableLuts.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (f === lutData.file) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => updateLutFile(node, index, select.value));
    select.addEventListener('click', (e) => e.stopPropagation());

    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.style.cssText = `
        background: transparent;
        color: ${COLORS.red};
        border: 1px solid ${COLORS.red};
        border-radius: 4px;
        width: 24px;
        height: 24px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        flex-shrink: 0;
        line-height: 1;
        padding: 0;
        transition: all 0.15s;
    `;
    delBtn.addEventListener('mouseenter', () => {
        delBtn.style.background = COLORS.red; delBtn.style.color = '#000';
    });
    delBtn.addEventListener('mouseleave', () => {
        delBtn.style.background = 'transparent'; delBtn.style.color = COLORS.red;
    });
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeLutSlot(node, index);
    });

    header.appendChild(numBadge);
    header.appendChild(select);
    header.appendChild(delBtn);
    card.appendChild(header);

    const strengthRow = document.createElement('div');
    strengthRow.style.cssText = `display: flex; flex-direction: column; gap: 2px; width: 100%;`;

    const strengthHeader = document.createElement('div');
    strengthHeader.style.cssText = `
        display: flex; justify-content: space-between;
        font-size: ${UI.labelFontSize}px; color: ${COLORS.textDim}; font-weight: bold;
    `;
    const sLabel = document.createElement('span');
    sLabel.textContent = "STRENGTH";
    const sValue = document.createElement('span');
    sValue.textContent = `${Math.round(lutData.strength)}%`;
    sValue.style.color = COLORS.accent;
    strengthHeader.appendChild(sLabel);
    strengthHeader.appendChild(sValue);

    const strengthTrack = document.createElement('div');
    strengthTrack.style.cssText = `
        position: relative; width: 100%; height: ${UI.sliderTrackHeight}px;
        background: ${COLORS.bgInput}; border-radius: 3px; cursor: pointer;
    `;
    const strengthFill = document.createElement('div');
    strengthFill.style.cssText = `
        position: absolute; left: 0; top: 0; height: 100%; width: ${lutData.strength}%;
        background: ${COLORS.accent}; border-radius: 3px; pointer-events: none;
    `;
    const strengthThumb = document.createElement('div');
    strengthThumb.style.cssText = `
        position: absolute; top: 50%; left: ${lutData.strength}%;
        width: ${UI.sliderThumbSize}px; height: ${UI.sliderThumbSize}px;
        background: ${COLORS.accent}; border-radius: 50%;
        transform: translate(-50%, -50%); pointer-events: none;
        box-shadow: 0 0 4px ${COLORS.accent}80;
    `;
    strengthTrack.appendChild(strengthFill);
    strengthTrack.appendChild(strengthThumb);
    strengthRow.appendChild(strengthHeader);
    strengthRow.appendChild(strengthTrack);

    let isDragging = false;
    function updateStrength(value) {
        const v = Math.max(0, Math.min(100, value));
        strengthFill.style.width = v + '%';
        strengthThumb.style.left = v + '%';
        sValue.textContent = `${Math.round(v)}%`;
        updateLutStrength(node, index, v);
    }
    function handleStrengthPointer(e) {
        const rect = strengthTrack.getBoundingClientRect();
        const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        updateStrength(Math.round(pct * 100));
    }
    strengthTrack.addEventListener('pointerdown', (e) => {
        isDragging = true;
        strengthTrack.setPointerCapture?.(e.pointerId);
        handleStrengthPointer(e);
        e.stopPropagation();
    });
    strengthTrack.addEventListener('pointermove', (e) => {
        if (isDragging) { handleStrengthPointer(e); e.stopPropagation(); }
    });
    strengthTrack.addEventListener('pointerup', (e) => {
        isDragging = false;
        strengthTrack.releasePointerCapture?.(e.pointerId);
    });

    card.appendChild(strengthRow);
    container.appendChild(card);
}

function rebuildLutSlots(node, container) {
    const slotsContainer = container.querySelector('[data-lut-slots]');
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    const cfg = getLutConfig(node);
    const availableLuts = node._availableLuts || [];
    if (cfg.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = availableLuts.length === 0
            ? "No .cube files in luts/."
            : "No LUTs. Click + LUT to add.";
        emptyMsg.style.cssText = `
            color: ${COLORS.textDim}; font-size: ${UI.labelFontSize}px;
            text-align: center; padding: 8px; font-style: italic;
        `;
        slotsContainer.appendChild(emptyMsg);
        return;
    }
    cfg.forEach((lutData, idx) => {
        createLutSlot(node, slotsContainer, lutData, idx, availableLuts);
    });
}

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
app.registerExtension({
    name: EXTENSION_NAME,

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.comfyClass === "Rimor_LUTMaster") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated?.apply(this, arguments);

                this._lmNodeId = String(this.id);

                if (this.widgets) {
                    for (const w of this.widgets) {
                        if ([
                            "lut_config", "exposure", "offset", "gamma",
                            "curve_a_x", "curve_a_y", "curve_b_x", "curve_b_y",
                            "photo_filter", "photo_filter_density",
                            "photo_filter_preserve_lum", "photo_filter_after_lut"
                        ].includes(w.name)) {
                            w.hidden = true;
                            w.computeSize = () => [0, -4];
                        }
                    }
                }

                const minWidth = UI.minWidth;
                const originalComputeSize = this.computeSize?.bind(this);
                this.computeSize = function (width) {
                    let size = originalComputeSize
                        ? originalComputeSize(width)
                        : [width || this.size[0], 200];
                    if (size[0] < minWidth) size[0] = minWidth;
                    return size;
                };
                if (this.size[0] < minWidth) this.size[0] = minWidth;

                const container = document.createElement('div');
                container.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    height: 100%;
                    padding: ${UI.padding}px;
                    box-sizing: border-box;
                    font-family: monospace;
                `;
                this.addDOMWidget("lm_main", "main_container", container, { serialize: false });
                this._lmContainer = container;

                this._availableLuts = [];
                fetch('/lut_master/list')
                    .then(r => r.json())
                    .then(data => {
                        this._availableLuts = data.luts || [];
                        console.log(`[LUT Master] Loaded ${this._availableLuts.length} LUTs`);
                        rebuildLutSlots(this, container);
                    })
                    .catch(err => {
                        console.warn('[LUT Master] Failed to load LUT list:', err);
                        rebuildLutSlots(this, container);
                    });

                const buttonRow = document.createElement('div');
                buttonRow.style.cssText = `display: flex; gap: 4px; width: 100%;`;
                buttonRow.appendChild(makeButton('+ LUT', () => addLutSlot(this, container)));
                container.appendChild(buttonRow);

                const slotsContainer = document.createElement('div');
                slotsContainer.setAttribute('data-lut-slots', '1');
                slotsContainer.style.cssText = `
                    display: flex; flex-direction: column; gap: 6px;
                    width: 100%; max-height: 400px; overflow-y: auto;
                `;
                container.appendChild(slotsContainer);

                const corrContainer = document.createElement('div');
                corrContainer.style.cssText = `
                    display: flex; flex-direction: column; gap: 6px;
                    width: 100%; margin-top: 8px; padding-top: 8px;
                    border-top: 1px solid ${COLORS.border};
                `;
                container.appendChild(corrContainer);

                const exposure = this.widgets?.find(w => w.name === "exposure")?.value ?? 0.0;
                const offset = this.widgets?.find(w => w.name === "offset")?.value ?? 0.0;
                const gamma = this.widgets?.find(w => w.name === "gamma")?.value ?? 1.0;

                const exposureSlider = createSlider(this, corrContainer, "Exposure", "exposure", exposure, -5.0, 5.0, 0.01);
                const offsetSlider = createSlider(this, corrContainer, "Offset", "offset", offset, -1.0, 1.0, 0.01);
                const gammaSlider = createSlider(this, corrContainer, "Gamma", "gamma", gamma, 0.1, 3.0, 0.01);

                const curveContainer = document.createElement('div');
                curveContainer.style.cssText = `
                    display: flex; flex-direction: column; gap: 6px;
                    width: 100%; margin-top: 8px; padding-top: 8px;
                    border-top: 1px solid ${COLORS.border};
                `;
                container.appendChild(curveContainer);
                const curveCanvas = createCurveCanvas(this, curveContainer, null);

                const filterContainer = document.createElement('div');
                filterContainer.style.cssText = `
                    display: flex; flex-direction: column; gap: 6px;
                    width: 100%; margin-top: 8px; padding-top: 8px;
                    border-top: 1px solid ${COLORS.border};
                `;
                container.appendChild(filterContainer);

                const filterValue = this.widgets?.find(w => w.name === "photo_filter")?.value ?? "cooling_lbb";
                const filterCombo = createCombo(this, filterContainer, "Photo Filter", "photo_filter", PHOTO_FILTERS, filterValue);

                const densityValue = this.widgets?.find(w => w.name === "photo_filter_density")?.value ?? 0.0;
                const densitySlider = createSlider(this, filterContainer, "Density", "photo_filter_density", densityValue, 0.0, 100.0, 0.1);

                const preserveValue = this.widgets?.find(w => w.name === "photo_filter_preserve_lum")?.value ?? false;
                const preserveCheckbox = createCheckbox(this, filterContainer, "Preserve Luminosity", "photo_filter_preserve_lum", preserveValue);

                const afterValue = this.widgets?.find(w => w.name === "photo_filter_after_lut")?.value ?? false;
                const afterCheckbox = createCheckbox(this, filterContainer, "After LUT", "photo_filter_after_lut", afterValue);

                const logo = document.createElement('div');
                logo.style.cssText = `
                    display: flex; align-items: center; justify-content: center;
                    padding: 4px 6px; height: 28px;
                    background: linear-gradient(180deg, ${COLORS.bg}, #0a0a0a);
                    border-radius: 8px; margin-top: auto; box-sizing: border-box; width: 100%;
                `;
                logo.innerHTML = `
                    <svg width="180" height="20" viewBox="0 0 180 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="10" r="6" stroke="${COLORS.accent}" stroke-width="1" opacity="0.5"/>
                        <path d="M5 10 Q7.5 5 10 10 T15 10" stroke="${COLORS.accent}" stroke-width="1.5" fill="none"/>
                        <text x="24" y="15" fill="${COLORS.accent}" font-size="12" font-family="monospace" font-weight="bold" letter-spacing="1">LUT MASTER</text>
                    </svg>
                `;
                container.appendChild(logo);

                const origOnConfigure = this.onConfigure;
                this.onConfigure = () => {
                    if (origOnConfigure) origOnConfigure.apply(this, arguments);

                    const getVal = (name, dflt) => {
                        const idx = this.widgets?.findIndex(w => w.name === name);
                        if (idx !== undefined && idx >= 0 && this.widgets_values?.[idx] !== undefined) {
                            return this.widgets_values[idx];
                        }
                        const w = this.widgets?.find(x => x.name === name);
                        return w ? w.value : dflt;
                    };

                    exposureSlider.setValue(parseFloat(getVal("exposure", 0.0)));
                    offsetSlider.setValue(parseFloat(getVal("offset", 0.0)));
                    gammaSlider.setValue(parseFloat(getVal("gamma", 1.0)));
                    densitySlider.setValue(parseFloat(getVal("photo_filter_density", 0.0)));

                    filterCombo.setValue(getVal("photo_filter", "cooling_lbb"));
                    preserveCheckbox.setValue(getVal("photo_filter_preserve_lum", false) === true || getVal("photo_filter_preserve_lum", false) === "true");
                    afterCheckbox.setValue(getVal("photo_filter_after_lut", false) === true || getVal("photo_filter_after_lut", false) === "true");

                    const a_x = parseFloat(getVal("curve_a_x", 0.25));
                    const a_y = parseFloat(getVal("curve_a_y", 0.25));
                    const b_x = parseFloat(getVal("curve_b_x", 0.75));
                    const b_y = parseFloat(getVal("curve_b_y", 0.75));
                    curveCanvas.setPoints({ x: a_x, y: a_y }, { x: b_x, y: b_y });

                    rebuildLutSlots(this, container);
                };

                requestAnimationFrame(() => {
                    rebuildLutSlots(this, container);
                });

                return result;
            };
        }
    }
});