/* ==========================================================================
   RESIZER.JS - Draggable & Touch Section Resizer System
   Supports Mouse & Touch dragging for:
   - Workspace Left/Right Splitter
   - Code Editor vs Scope Inspector Splitter
   - Call Stack vs Heap Memory Splitter
   - Console Terminal Height Resizer
   ========================================================================== */

export function initResizers(editorController) {
    // 1. WORKSPACE PANEL RESIZER (Left vs Right)
    const resizerWorkspace = document.getElementById('resizer-workspace');
    const mainWorkspace = document.querySelector('.main-workspace');

    if (resizerWorkspace && mainWorkspace) {
        let isDragging = false;

        const startDrag = () => {
            isDragging = true;
            resizerWorkspace.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };

        const onMove = (clientX) => {
            if (!isDragging) return;
            const containerRect = mainWorkspace.getBoundingClientRect();
            let leftWidth = clientX - containerRect.left;
            
            const minWidth = 240;
            const maxWidth = containerRect.width * 0.75;
            leftWidth = Math.max(minWidth, Math.min(maxWidth, leftWidth));

            mainWorkspace.style.gridTemplateColumns = `${leftWidth}px 10px 1fr`;

            if (editorController && editorController.editor) {
                editorController.editor.refresh();
            }
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                resizerWorkspace.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (editorController && editorController.editor) {
                    editorController.editor.refresh();
                }
            }
        };

        resizerWorkspace.addEventListener('mousedown', startDrag);
        resizerWorkspace.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) startDrag();
        });

        document.addEventListener('mousemove', (e) => onMove(e.clientX));
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) onMove(e.touches[0].clientX);
        });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    // 2. LEFT PANEL RESIZER (Editor vs Scope Inspector)
    const resizerLeftPanel = document.getElementById('resizer-left-panel');
    const editorBody = document.querySelector('.editor-body');
    const scopeBody = document.querySelector('.scope-body');

    if (resizerLeftPanel && editorBody) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const startDrag = (clientY) => {
            isDragging = true;
            startY = clientY;
            startHeight = editorBody.getBoundingClientRect().height;
            resizerLeftPanel.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        };

        const onMove = (clientY) => {
            if (!isDragging) return;
            const deltaY = clientY - startY;
            let newHeight = startHeight + deltaY;

            const parentHeight = editorBody.parentElement.getBoundingClientRect().height;
            newHeight = Math.max(120, Math.min(parentHeight - 120, newHeight));

            editorBody.style.flex = 'none';
            editorBody.style.height = `${newHeight}px`;

            if (scopeBody) {
                scopeBody.style.flex = '1';
            }

            if (editorController && editorController.editor) {
                editorController.editor.refresh();
            }
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                resizerLeftPanel.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (editorController && editorController.editor) {
                    editorController.editor.refresh();
                }
            }
        };

        resizerLeftPanel.addEventListener('mousedown', (e) => startDrag(e.clientY));
        resizerLeftPanel.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) startDrag(e.touches[0].clientY);
        });

        document.addEventListener('mousemove', (e) => onMove(e.clientY));
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) onMove(e.touches[0].clientY);
        });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    // 3. MEMORY VIEW RESIZER (Call Stack vs Heap Memory)
    const resizerMemory = document.getElementById('resizer-memory-split');
    const splitMemoryView = document.querySelector('.split-memory-view');

    if (resizerMemory && splitMemoryView) {
        let isDragging = false;

        const startDrag = () => {
            isDragging = true;
            resizerMemory.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };

        const onMove = (clientX) => {
            if (!isDragging) return;
            const containerRect = splitMemoryView.getBoundingClientRect();
            let stackWidth = clientX - containerRect.left;

            const minW = 140;
            const maxW = containerRect.width * 0.75;
            stackWidth = Math.max(minW, Math.min(maxW, stackWidth));

            splitMemoryView.style.gridTemplateColumns = `${stackWidth}px 10px 1fr`;
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                resizerMemory.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        resizerMemory.addEventListener('mousedown', startDrag);
        resizerMemory.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) startDrag();
        });

        document.addEventListener('mousemove', (e) => onMove(e.clientX));
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) onMove(e.touches[0].clientX);
        });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    // 4. TERMINAL HEIGHT RESIZER (Console Footer)
    const resizerTerminal = document.getElementById('resizer-terminal');
    const appFooter = document.querySelector('.app-footer');

    if (resizerTerminal && appFooter) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const startDrag = (clientY) => {
            isDragging = true;
            startY = clientY;
            startHeight = appFooter.getBoundingClientRect().height;
            resizerTerminal.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        };

        const onMove = (clientY) => {
            if (!isDragging) return;
            const deltaY = startY - clientY; // Dragging UP increases height
            let newHeight = startHeight + deltaY;

            newHeight = Math.max(40, Math.min(500, newHeight));

            appFooter.style.maxHeight = `${newHeight}px`;
            appFooter.style.height = `${newHeight}px`;

            if (newHeight > 40 && appFooter.classList.contains('collapsed')) {
                appFooter.classList.remove('collapsed');
            }
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                resizerTerminal.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        resizerTerminal.addEventListener('mousedown', (e) => startDrag(e.clientY));
        resizerTerminal.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) startDrag(e.touches[0].clientY);
        });

        document.addEventListener('mousemove', (e) => onMove(e.clientY));
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) onMove(e.touches[0].clientY);
        });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }
}
