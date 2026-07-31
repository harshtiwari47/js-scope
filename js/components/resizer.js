/* ==========================================================================
   RESIZER.JS - Draggable Section Resizer System
   Allows dragging workspace left/right, editor/scope top/bottom,
   callstack/heap memory split, and console terminal height.
   ========================================================================== */

export function initResizers(editorController) {
    // 1. WORKSPACE PANEL RESIZER (Left vs Right)
    const resizerWorkspace = document.getElementById('resizer-workspace');
    const mainWorkspace = document.querySelector('.main-workspace');

    if (resizerWorkspace && mainWorkspace) {
        let isDragging = false;

        resizerWorkspace.addEventListener('mousedown', (e) => {
            isDragging = true;
            resizerWorkspace.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = mainWorkspace.getBoundingClientRect();
            let leftWidth = e.clientX - containerRect.left;
            
            // Constrain left panel width (min 280px, max 70% of workspace)
            const minWidth = 280;
            const maxWidth = containerRect.width * 0.7;
            leftWidth = Math.max(minWidth, Math.min(maxWidth, leftWidth));

            mainWorkspace.style.gridTemplateColumns = `${leftWidth}px 10px 1fr`;

            if (editorController && editorController.editor) {
                editorController.editor.refresh();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizerWorkspace.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (editorController && editorController.editor) {
                    editorController.editor.refresh();
                }
            }
        });
    }

    // 2. LEFT PANEL RESIZER (Editor vs Scope Inspector)
    const resizerLeftPanel = document.getElementById('resizer-left-panel');
    const editorBody = document.querySelector('.editor-body');

    if (resizerLeftPanel && editorBody) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        resizerLeftPanel.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = editorBody.getBoundingClientRect().height;
            resizerLeftPanel.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = e.clientY - startY;
            let newHeight = startHeight + deltaY;

            // Constrain editor height (min 160px, max 75% of panel height)
            const parentHeight = editorBody.parentElement.getBoundingClientRect().height;
            newHeight = Math.max(160, Math.min(parentHeight * 0.75, newHeight));

            editorBody.style.flex = 'none';
            editorBody.style.height = `${newHeight}px`;

            if (editorController && editorController.editor) {
                editorController.editor.refresh();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizerLeftPanel.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (editorController && editorController.editor) {
                    editorController.editor.refresh();
                }
            }
        });
    }

    // 3. MEMORY VIEW RESIZER (Call Stack vs Heap Memory)
    const resizerMemory = document.getElementById('resizer-memory-split');
    const splitMemoryView = document.querySelector('.split-memory-view');

    if (resizerMemory && splitMemoryView) {
        let isDragging = false;

        resizerMemory.addEventListener('mousedown', (e) => {
            isDragging = true;
            resizerMemory.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = splitMemoryView.getBoundingClientRect();
            let stackWidth = e.clientX - containerRect.left;

            // Constrain stack column width (min 180px, max 70% of view)
            const minW = 180;
            const maxW = containerRect.width * 0.7;
            stackWidth = Math.max(minW, Math.min(maxW, stackWidth));

            splitMemoryView.style.gridTemplateColumns = `${stackWidth}px 10px 1fr`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizerMemory.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    // 4. TERMINAL HEIGHT RESIZER (Console Footer)
    const resizerTerminal = document.getElementById('resizer-terminal');
    const appFooter = document.querySelector('.app-footer');

    if (resizerTerminal && appFooter) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        resizerTerminal.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = appFooter.getBoundingClientRect().height;
            resizerTerminal.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY; // Dragging UP increases height
            let newHeight = startHeight + deltaY;

            // Constrain terminal height (min 40px, max 400px)
            newHeight = Math.max(40, Math.min(400, newHeight));

            appFooter.style.maxHeight = `${newHeight}px`;
            appFooter.style.height = `${newHeight}px`;

            if (newHeight > 40 && appFooter.classList.contains('collapsed')) {
                appFooter.classList.remove('collapsed');
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizerTerminal.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}
