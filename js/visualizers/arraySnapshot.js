/* ==========================================================================
   ARRAYSNAPSHOT.JS - Array Blocks, Bar Chart & Pointer Visualizer Renderer
   ========================================================================== */

export function renderArraySnapshot(snapshot) {
    const barsArena = document.getElementById('array-bars-container');
    const pointersBar = document.getElementById('array-pointers-container');
    const arrayNameTag = document.getElementById('active-array-name');

    if (!barsArena) return;

    if (!snapshot || !snapshot.arrayState || !snapshot.arrayState.values) {
        barsArena.innerHTML = `<div class="empty-state">No array detected in current step execution</div>`;
        if (pointersBar) pointersBar.innerHTML = '';
        if (arrayNameTag) arrayNameTag.textContent = 'No Array';
        return;
    }

    const { name, values, comparing = [], swapping = [], target = null, sorted = [], pointers = {} } = snapshot.arrayState;
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
                    ${val}
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
