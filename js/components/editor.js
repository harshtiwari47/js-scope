/* ==========================================================================
   EDITOR.JS - CodeMirror Editor Controller & Active Execution Line Sync
   ========================================================================== */

import { interpreter } from '../engine/interpreter.js';
import { appState } from '../engine/state.js';

export class CodeEditorController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.editor = null;
        this.activeLineHandle = null;
        this.debounceTimer = null;
        this.isSettingValue = false; // Prevent recursive tracing during setValue
    }

    init(initialCode = '') {
        if (!this.container) {
            console.error('Editor container not found');
            return;
        }

        // Wait for CodeMirror to be available
        if (typeof window.CodeMirror === 'undefined') {
            console.error('CodeMirror not loaded');
            return;
        }

        // Initialize CodeMirror instance
        this.editor = window.CodeMirror(this.container, {
            value: initialCode,
            mode: 'javascript',
            theme: 'dracula',
            lineNumbers: true,
            styleActiveLine: true,
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            readOnly: false,
            viewportMargin: Infinity,
            autofocus: false
        });

        // Refresh editor after DOM rendering settles
        setTimeout(() => {
            if (this.editor) {
                this.editor.refresh();
            }
        }, 200);

        // Click to focus editor
        this.container.addEventListener('click', () => {
            if (this.editor && !this.editor.hasFocus()) {
                this.editor.focus();
            }
        });

        // Debounced re-trace on code changes (only if user is typing, not setValue)
        this.editor.on('change', () => {
            if (this.isSettingValue) return;
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.runTrace();
            }, 400);
        });
    }

    getValue() {
        return this.editor ? this.editor.getValue() : '';
    }

    setValue(code) {
        if (!this.editor) return;
        this.isSettingValue = true;
        this.editor.setValue(code);
        this.isSettingValue = false;

        // Refresh and run trace after a short delay
        setTimeout(() => {
            if (this.editor) this.editor.refresh();
            this.runTrace();
        }, 100);
    }

    runTrace() {
        const code = this.getValue();
        if (!code.trim()) return;

        const statusPill = document.getElementById('execution-status');
        if (statusPill) {
            statusPill.textContent = 'Tracing...';
            statusPill.className = 'status-pill status-running';
        }

        try {
            const snapshots = interpreter.generateTrace(code);
            appState.setSnapshots(snapshots);

            if (statusPill) {
                statusPill.textContent = 'Ready (' + snapshots.length + ' steps)';
                statusPill.className = 'status-pill status-ready';
            }
        } catch (err) {
            console.warn('Trace error:', err);
            if (statusPill) {
                statusPill.textContent = 'Error';
                statusPill.className = 'status-pill status-error';
            }
        }
    }

    highlightLine(lineNum) {
        if (!this.editor) return;

        // Remove previous highlight
        if (this.activeLineHandle !== null) {
            this.editor.removeLineClass(this.activeLineHandle, 'background', 'active-execution-line');
            this.activeLineHandle = null;
        }

        if (lineNum > 0 && lineNum <= this.editor.lineCount()) {
            const lineIndex = lineNum - 1;
            this.activeLineHandle = this.editor.addLineClass(lineIndex, 'background', 'active-execution-line');
            
            // Only scroll into view when stepping through code, not while user is actively typing
            if (!this.editor.hasFocus()) {
                this.editor.scrollIntoView({ line: lineIndex, ch: 0 }, 80);
            }
        }
    }

    formatCode() {
        if (!this.editor) return;
        const code = this.getValue();
        const lines = code.split('\n');
        let indent = 0;
        const formatted = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
                indent = Math.max(0, indent - 1);
            }
            const pad = '    '.repeat(indent);
            if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
                indent++;
            }
            return pad + trimmed;
        }).join('\n');
        this.setValue(formatted);
    }
}
