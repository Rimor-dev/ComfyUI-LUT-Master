import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "Rimor.LayerBlend";

const COLORS = {
    accent: "#4a90d9",
    accentHover: "#5aa0e9",
    accentDark: "#2a5a99",
    bg: "#1a1a1a",
    bgInput: "#111111",
    text: "#e0e0e0",
    textDim: "#999999",
    border: "#333333",
};

const UI = {
    minWidth: 280,
    labelFontSize: 12,
    widgetFontSize: 14,
    sliderTrackHeight: 6,
    sliderThumbSize: 16,
    padding: 8,
};

// ============================================================
// SLIDER
// ============================================================
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
    valueEl.textContent = `${defaultValue.toFixed(0)}%`;
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
        valueEl.textContent = `${value.toFixed(0)}%`;
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
    track.addEventListener('dblclick', () => {
        setValue(defaultValue, true);
    });

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
        font-size: ${UI.widgetFontSize}px;
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

    return select;
}

// ============================================================
// REGISTRATION
// ============================================================
app.registerExtension({
    name: EXTENSION_NAME,

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.comfyClass === "Rimor_LayerBlend") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated?.apply(this, arguments);

                if (this.widgets) {
                    for (const w of this.widgets) {
                        if (["blend_mode", "opacity"].includes(w.name)) {
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
                        : [width || this.size[0], 150];
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
                this.addDOMWidget("lb_main", "main_container", container, { serialize: false });
                this._lbContainer = container;

                // ===== СОХРАНЕНИЕ =====
                let saveTimeout;
                const saveSettings = () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        this.properties = this.properties || {};
                        this.properties.layerBlendSettings = {
                            blend_mode: blendModeSelect.value,
                            opacity: opacitySlider.getValue(),
                        };
                        this.graph?.change?.();
                    }, 200);
                };

                // Combo
                const blendModeValue = this.widgets?.find(w => w.name === "blend_mode")?.value ?? "normal";
                const blendModes = [
                    "normal", "multiply", "screen", "overlay",
                    "soft_light", "hard_light", "add", "subtract", "difference"
                ];
                const blendModeSelect = createCombo(this, container, "Blend Mode", "blend_mode", blendModes, blendModeValue, saveSettings);

                // Slider
                const opacityValue = this.widgets?.find(w => w.name === "opacity")?.value ?? 100.0;
                const opacitySlider = createSlider(this, container, "Opacity", "opacity", opacityValue, 0.0, 100.0, 0.1, saveSettings);

                // Лого
                const logo = document.createElement('div');
                logo.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px 6px;
                    height: 28px;
                    background: linear-gradient(180deg, ${COLORS.bg}, #0a0a0a);
                    border-radius: 8px;
                    margin-top: auto;
                    box-sizing: border-box;
                    width: 100%;
                `;
                logo.innerHTML = `
                    <svg width="180" height="20" viewBox="0 0 180 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="10" r="6" stroke="${COLORS.accent}" stroke-width="1" opacity="0.5"/>
                        <path d="M5 10 Q7.5 5 10 10 T15 10" stroke="${COLORS.accent}" stroke-width="1.5" fill="none"/>
                        <text x="24" y="15" fill="${COLORS.accent}" font-size="12" font-family="monospace" font-weight="bold" letter-spacing="1">LAYER BLEND</text>
                    </svg>
                `;
                container.appendChild(logo);

                // ===== ВОССТАНОВЛЕНИЕ =====
                const origOnConfigure = this.onConfigure;
                this.onConfigure = () => {
                    if (origOnConfigure) origOnConfigure.apply(this, arguments);

                    const s = this.properties?.layerBlendSettings;
                    if (s) {
                        if (s.blend_mode !== undefined) {
                            blendModeSelect.value = s.blend_mode;
                        }
                        if (s.opacity !== undefined) {
                            opacitySlider.setValue(parseFloat(s.opacity));
                        }
                    } else {
                        // Fallback: из widgets_values
                        const modeIdx = this.widgets?.findIndex(w => w.name === "blend_mode");
                        if (modeIdx !== undefined && modeIdx >= 0 && this.widgets_values) {
                            const val = this.widgets_values[modeIdx];
                            if (val) blendModeSelect.value = val;
                        }
                        const opIdx = this.widgets?.findIndex(w => w.name === "opacity");
                        if (opIdx !== undefined && opIdx >= 0 && this.widgets_values) {
                            const val = parseFloat(this.widgets_values[opIdx]);
                            if (!isNaN(val)) opacitySlider.setValue(val);
                        }
                    }
                };

                return result;
            };
        }
    }
});