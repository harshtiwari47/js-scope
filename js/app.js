/* ==========================================================================
   APP.JS - Main Application Entry Point
   ========================================================================== */

import { CodeEditorController } from './components/editor.js';
import { setupControls } from './components/controls.js';
import { initResizers } from './components/resizer.js';
import { appState } from './engine/state.js';
import { renderStackAndHeap } from './visualizers/stackHeap.js';
import { renderArraySnapshot } from './visualizers/arraySnapshot.js';
import { renderEventLoop } from './visualizers/eventLoop.js';
import { renderGraphVisualizer } from './visualizers/graphVisualizer.js';
import { renderConsoleAndScope } from './visualizers/consoleView.js';
import { initEducationalTooltips } from './components/educational.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize CodeMirror Editor
    const editorController = new CodeEditorController('code-editor-container');
    editorController.init();

    // 2. Setup Header Controls & Shortcuts
    setupControls(editorController);

    // 3. Initialize Section Resizers
    initResizers(editorController);

    // 4. Initialize Educational Tooltips
    initEducationalTooltips();

    // 4. Listen to Step Updates from State Store and render all visualizers
    appState.on('stepUpdate', ({ step, snapshot }) => {
        if (!snapshot) return;

        // Highlight active line in CodeMirror
        if (snapshot.line && snapshot.line > 0) {
            editorController.highlightLine(snapshot.line);
        }

        // Render all visualizer panels
        try { renderStackAndHeap(snapshot); } catch(e) { console.warn('Stack/Heap render error:', e); }
        try { renderArraySnapshot(snapshot); } catch(e) { console.warn('Array render error:', e); }
        try { renderEventLoop(snapshot); } catch(e) { console.warn('EventLoop render error:', e); }
        try { renderGraphVisualizer(snapshot); } catch(e) { console.warn('Graph render error:', e); }
        try { renderConsoleAndScope(snapshot); } catch(e) { console.warn('Console render error:', e); }
    });

    // 5. Log successful initialization
    console.log('%c JS-Scope Visualizer v1.0 ', 'background:#00f2fe;color:#050b14;font-weight:bold;padding:4px 8px;border-radius:4px;', 'Initialized successfully.');
});
