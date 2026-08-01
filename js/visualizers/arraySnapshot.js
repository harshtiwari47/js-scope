/* ==========================================================================
   ARRAYSNAPSHOT.JS - Array Blocks, Bar Chart, Pointer & Target Array Selector
   ========================================================================== */
import { escapeHtml } from '../utils.js';


let userSelectedArray = 'auto';
let isSelectListenerBound = false;

export function renderArraySnapshot(snapshot) {
    const barsArena = document.getElementById('array-bars-container');
    const pointersBar = document.getElementById('array-pointers-container');
    const arrayNameTag = document.getElementById('active-array-name');
    const targetSelect = document.getElementById('target-array-select');

    if (!barsArena) return;

    // Bind change listener once
    if (targetSelect && !isSelectListenerBound) {
        isSelectListenerBound = true;
        targetSelect.addEventListener('change', (e) => {
            userSelectedArray = e.target.value;
            // Re-render with new selection
            if (window.__lastSnapshot) {
                renderArraySnapshot(window.__lastSnapshot);
            }
        });
    }

    window.__lastSnapshot = snapshot;

    // Extract all array variables present in active scope
    const availableArrays = {};
    if (snapshot && snapshot.scope) {
        Object.entries(snapshot.scope).forEach(([k, v]) => {
            if (Array.isArray(v)) {
                availableArrays[k] = v;
            }
        });
    }
    if (snapshot && snapshot.arrayState && snapshot.arrayState.allArrays) {
        Object.entries(snapshot.arrayState.allArrays).forEach(([k, v]) => {
            if (Array.isArray(v)) availableArrays[k] = v;
        });
    }

    // Populate target array select dropdown options
    if (targetSelect) {
        const currentOpts = Array.from(targetSelect.options).map(o => o.value);
        const newArrayKeys = Object.keys(availableArrays);

        let optionsHtml = `<option value="auto" ${userSelectedArray === 'auto' ? 'selected' : ''}>Auto (Default)</option>`;
        newArrayKeys.forEach(key => {
            const arrLen = availableArrays[key].length;
            const isSel = userSelectedArray === key ? 'selected' : '';
            optionsHtml += `<option value="${escapeHtml(key)}" ${isSel}>${escapeHtml(key)} [${arrLen}]</option>`;
        });
        targetSelect.innerHTML = optionsHtml;
    }

    if (!snapshot || (!snapshot.arrayState && Object.keys(availableArrays).length === 0)) {
        barsArena.innerHTML = `<div class="empty-state">No array detected in current step execution</div>`;
        if (pointersBar) pointersBar.innerHTML = '';
        if (arrayNameTag) arrayNameTag.textContent = 'No Array';
        return;
    }

    // Determine target array to render
    let name = snapshot.arrayState ? snapshot.arrayState.name : '';
    let values = snapshot.arrayState ? snapshot.arrayState.values : null;
    let pointers = snapshot.arrayState ? (snapshot.arrayState.pointers || {}) : {};
    let comparing = snapshot.arrayState ? (snapshot.arrayState.comparing || []) : [];
    let swapping = snapshot.arrayState ? (snapshot.arrayState.swapping || []) : [];
    let target = snapshot.arrayState ? snapshot.arrayState.target : null;
    let sorted = snapshot.arrayState ? (snapshot.arrayState.sorted || []) : [];

    // If user explicitly picked an array (e.g. 'left', 'right', 'results')
    if (userSelectedArray !== 'auto' && availableArrays[userSelectedArray]) {
        name = userSelectedArray;
        values = availableArrays[userSelectedArray];
        comparing = [];
        swapping = [];
        target = null;
        sorted = [];
    }

    if (!values || values.length === 0) {
        barsArena.innerHTML = `<div class="empty-state">Array "${escapeHtml(name)}" is empty or not in scope</div>`;
        if (pointersBar) pointersBar.innerHTML = '';
        if (arrayNameTag) arrayNameTag.textContent = name ? `${name} [0]` : 'No Array';
        return;
    }

    if (arrayNameTag) arrayNameTag.textContent = name ? `${name} [${values.length}]` : `arr [${values.length}]`;

    const maxVal = Math.max(...values.map(v => typeof v === 'number' ? Math.abs(v) : 1), 10);

    barsArena.innerHTML = values.map((val, idx) => {
        const heightPct = Math.max(12, Math.min(100, Math.round((Math.abs(val) / maxVal) * 100)));
        let stateClass = '';

        if (swapping.includes(idx)) {
            stateClass = 'swapping';
        } else if (comparing.includes(idx)) {
            stateClass = 'comparing';
        } else if (idx === target) {
            stateClass = 'target';
        } else if (sorted.includes(idx)) {
            stateClass = 'sorted';
        }

        return `
            <div class="array-bar-card ${stateClass}" data-index="${idx}">
                <div class="bar-column" style="height: ${heightPct}%;">
                    ${escapeHtml(val)}
                </div>
                <div class="bar-index">${idx}</div>
            </div>
        `;
    }).join('');

    if (pointersBar) {
        pointersBar.innerHTML = '';
        const barElements = barsArena.querySelectorAll('.array-bar-card');

        Object.entries(pointers).forEach(([ptrName, idxVal]) => {
            if (typeof idxVal === 'number' && idxVal >= 0 && idxVal < values.length) {
                const targetBar = barElements[idxVal];
                if (targetBar) {
                    const barRect = targetBar.getBoundingClientRect();
                    const arenaRect = barsArena.getBoundingClientRect();
                    const offsetLeft = (barRect.left - arenaRect.left) + (barRect.width / 2);

                    const flag = document.createElement('div');
                    flag.className = 'pointer-flag';
                    flag.style.left = `${offsetLeft}px`;
                    flag.textContent = `${ptrName}=${idxVal}`;
                    pointersBar.appendChild(flag);
                }
            }
        });
    }
}
