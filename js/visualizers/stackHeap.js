/* ==========================================================================
   STACKHEAP.JS - Call Stack & Heap Memory Renderer
   ========================================================================== */

export function renderStackAndHeap(snapshot) {
    const stackContainer = document.getElementById('call-stack-container');
    const heapContainer = document.getElementById('heap-memory-container');
    const stackBadge = document.getElementById('stack-count-badge');
    const heapBadge = document.getElementById('heap-count-badge');

    if (!stackContainer || !heapContainer) return;

    if (!snapshot) {
        stackContainer.innerHTML = `<div class="empty-state-card">Call stack is empty</div>`;
        heapContainer.innerHTML = `<div class="empty-state-card">No objects in heap</div>`;
        if (stackBadge) stackBadge.textContent = '0';
        if (heapBadge) heapBadge.textContent = '0 objects';
        return;
    }

    // 1. RENDER CALL STACK
    const stack = snapshot.callStack || [];
    if (stackBadge) stackBadge.textContent = `${stack.length}`;

    if (stack.length === 0) {
        stackContainer.innerHTML = `<div class="empty-state-card">Call stack is empty</div>`;
    } else {
        const reversedStack = [...stack].reverse();
        stackContainer.innerHTML = reversedStack.map((frame, idx) => {
            const isTop = idx === 0;
            const scopeEntries = Object.entries(frame.scope || {}).filter(
                ([k, v]) => v !== undefined && typeof v !== 'function' && !k.startsWith('__')
            );
            const varChips = scopeEntries.slice(0, 8).map(([k, v]) => {
                let displayVal;
                if (v === null) displayVal = 'null';
                else if (Array.isArray(v)) displayVal = `[${v.length}]`;
                else if (typeof v === 'object') {
                    try { displayVal = JSON.stringify(v); } catch(e) { displayVal = '{..}'; }
                    if (displayVal.length > 18) displayVal = displayVal.substring(0, 16) + '..';
                } else displayVal = String(v);
                if (String(displayVal).length > 18) displayVal = String(displayVal).substring(0, 16) + '..';
                return `<span class="frame-var-chip"><span class="k">${k}:</span> <span class="v">${displayVal}</span></span>`;
            }).join('');

            return `
                <div class="stack-frame-card ${isTop ? 'top-frame' : ''}" style="${isTop ? 'border-left-color: #0284c7; box-shadow: 0 0 10px rgba(2, 132, 199, 0.4);' : ''}">
                    <div class="stack-frame-header">
                        <span class="func-name">${frame.name} ${isTop ? '<span style="font-size:0.68rem;padding:2px 6px;border-radius:6px;background:#0284c7;color:#fff;margin-left:6px;">TOP</span>' : ''}</span>
                        <span class="func-line">Line ${frame.line}</span>
                    </div>
                    <div class="frame-vars">
                        ${varChips || '<span style="font-size:0.75rem;color:#64748b;">no local vars</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. RENDER HEAP MEMORY
    const heap = snapshot.heap || {};
    const heapKeys = Object.keys(heap);
    if (heapBadge) heapBadge.textContent = `${heapKeys.length} object${heapKeys.length !== 1 ? 's' : ''}`;

    if (heapKeys.length === 0) {
        heapContainer.innerHTML = `<div class="empty-state-card">No objects in heap</div>`;
    } else {
        heapContainer.innerHTML = heapKeys.map(addr => {
            const item = heap[addr];
            const isArr = item.type === 'Array';
            const val = item.value;

            let propsHtml = '';
            if (isArr && Array.isArray(val)) {
                propsHtml = val.map((v, i) => `
                    <div class="heap-prop">
                        <span class="heap-prop-key">[${i}]</span>
                        <span class="heap-prop-val">${v === null ? 'null' : typeof v === 'object' ? 'ref' : v}</span>
                    </div>
                `).join('');
            } else if (val && typeof val === 'object') {
                propsHtml = Object.entries(val).slice(0, 10).map(([k, v]) => {
                    let display;
                    if (v === null) display = 'null';
                    else if (Array.isArray(v)) display = `Array[${v.length}]`;
                    else if (typeof v === 'object') display = '{..}';
                    else display = String(v);
                    return `
                        <div class="heap-prop">
                            <span class="heap-prop-key">${k}</span>
                            <span class="heap-prop-val">${display}</span>
                        </div>
                    `;
                }).join('');
            }

            return `
                <div class="heap-object-card">
                    <div class="heap-header">
                        <span class="heap-addr">${addr}</span>
                        <span class="heap-type">${item.type}</span>
                    </div>
                    <div class="heap-props">
                        ${propsHtml || '<span style="color:#5c6b73">empty</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }
}
