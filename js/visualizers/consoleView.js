/* ==========================================================================
   CONSOLEVIEW.JS - DevTools Terminal & Scope Inspector Renderer
   ========================================================================== */

export function renderConsoleAndScope(snapshot) {
    const consoleOutput = document.getElementById('console-output');
    const scopeContainer = document.getElementById('scope-inspector-container');

    if (!consoleOutput) return;

    // 1. RENDER CONSOLE OUTPUT LOGS
    if (!snapshot || !snapshot.logs || snapshot.logs.length === 0) {
        consoleOutput.innerHTML = `
            <div class="console-line system-msg">
                <span class="icon"><i class="fa-solid fa-circle-info"></i></span>
                <span class="content">JS-Scope Visualizer ready. Step or run code to view output.</span>
            </div>
        `;
    } else {
        consoleOutput.innerHTML = snapshot.logs.map(log => {
            let iconClass = 'fa-solid fa-angle-right';
            let msgClass = 'log-msg';
            if (log.type === 'warn') {
                iconClass = 'fa-solid fa-triangle-exclamation';
                msgClass = 'warn-msg';
            } else if (log.type === 'error') {
                iconClass = 'fa-solid fa-circle-xmark';
                msgClass = 'error-msg';
            }
            return `
                <div class="console-line ${msgClass}">
                    <span class="step-tag">[L${log.line || 0}]</span>
                    <span class="icon"><i class="${iconClass}"></i></span>
                    <span class="content">${escapeHtml(log.text)}</span>
                </div>
            `;
        }).join('');
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    // 2. RENDER SCOPE INSPECTOR TABLE
    if (scopeContainer) {
        if (!snapshot || !snapshot.scope || Object.keys(snapshot.scope).length === 0) {
            scopeContainer.innerHTML = `<div class="empty-state">No active variables in current scope</div>`;
        } else {
            const entries = Object.entries(snapshot.scope).filter(
                ([k, v]) => typeof v !== 'function' && !k.startsWith('__')
            );
            if (entries.length === 0) {
                scopeContainer.innerHTML = `<div class="empty-state">No active variables in current scope</div>`;
                return;
            }
            const rows = entries.map(([key, val]) => {
                const typeStr = val === null ? 'null' : Array.isArray(val) ? 'Array' : typeof val;
                let valClass = 'var-val';
                let formattedVal = String(val);

                if (val === null) {
                    formattedVal = 'null';
                } else if (val === undefined) {
                    formattedVal = 'undefined';
                } else if (typeStr === 'string') {
                    valClass += ' string-val';
                    formattedVal = `"${val}"`;
                } else if (typeStr === 'number') {
                    valClass += ' number-val';
                } else if (typeStr === 'Array') {
                    valClass += ' array-val';
                    formattedVal = `[${val.join(', ')}]`;
                } else if (typeof val === 'object') {
                    valClass += ' object-ref';
                    try {
                        formattedVal = JSON.stringify(val);
                        if (formattedVal.length > 60) formattedVal = formattedVal.substring(0, 58) + '...';
                    } catch(e) {
                        formattedVal = '{...}';
                    }
                }
                return `
                    <tr>
                        <td class="var-name">${escapeHtml(key)}</td>
                        <td class="var-type">${typeStr}</td>
                        <td class="${valClass}">${escapeHtml(formattedVal)}</td>
                    </tr>
                `;
            }).join('');
            scopeContainer.innerHTML = `
                <table class="scope-table">
                    <thead><tr><th>Variable</th><th>Type</th><th>Value</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        }
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') str = String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
