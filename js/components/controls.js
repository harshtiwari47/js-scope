/* ==========================================================================
   CONTROLS.JS - Header Toolbar & Keyboard Shortcut Controller
   ========================================================================== */

import { appState } from '../engine/state.js';
import { PRESET_EXAMPLES } from '../engine/examples.js';

export function setupControls(editorController) {
    const btnPlay = document.getElementById('btn-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnReset = document.getElementById('btn-reset');
    const speedRange = document.getElementById('speed-range');
    const speedVal = document.getElementById('speed-val');
    const stepCount = document.getElementById('step-count');
    const exampleSelect = document.getElementById('example-select');
    const btnFormat = document.getElementById('btn-format');
    const btnHelp = document.getElementById('btn-help');
    const btnClearConsole = document.getElementById('btn-clear-console');
    const btnToggleConsole = document.getElementById('btn-toggle-console');
    const appFooter = document.querySelector('.app-footer');

    // 1. PLAY / PAUSE BUTTON
    if (btnPlay) {
        btnPlay.addEventListener('click', (e) => {
            e.preventDefault();
            appState.togglePlay();
        });
    }

    appState.on('playStateChanged', ({ isPlaying }) => {
        if (btnPlay) {
            if (isPlaying) {
                btnPlay.innerHTML = `<i class="fa-solid fa-pause"></i> <span id="play-text">Pause</span>`;
                btnPlay.className = 'btn btn-secondary';
            } else {
                btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> <span id="play-text">Run</span>`;
                btnPlay.className = 'btn btn-primary';
            }
        }
    });

    // 2. STEP FORWARD & BACKWARD
    if (btnNext) {
        btnNext.addEventListener('click', (e) => {
            e.preventDefault();
            appState.pause();
            appState.nextStep();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', (e) => {
            e.preventDefault();
            appState.pause();
            appState.prevStep();
        });
    }

    // 3. RESET BUTTON
    if (btnReset) {
        btnReset.addEventListener('click', (e) => {
            e.preventDefault();
            appState.reset();
        });
    }

    // 4. SPEED SLIDER
    if (speedRange) {
        speedRange.addEventListener('input', (e) => {
            const val = e.target.value;
            appState.setSpeed(val);
            if (speedVal) speedVal.textContent = `${parseFloat(val).toFixed(2)}x`;
        });
    }

    // 5. STEP COUNT UPDATE BADGE
    appState.on('stepsChanged', ({ totalSteps, currentStep }) => {
        if (stepCount) {
            stepCount.textContent = `${currentStep + 1} / ${totalSteps}`;
        }
    });

    appState.on('stepUpdate', ({ step, totalSteps }) => {
        if (stepCount) {
            stepCount.textContent = `${step + 1} / ${totalSteps}`;
        }
    });

    // 6. PRESET EXAMPLES DROPDOWN
    if (exampleSelect) {
        const initialKey = exampleSelect.value;
        if (PRESET_EXAMPLES[initialKey]) {
            editorController.setValue(PRESET_EXAMPLES[initialKey]);
        }

        exampleSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (PRESET_EXAMPLES[key]) {
                appState.pause();
                editorController.setValue(PRESET_EXAMPLES[key]);

                // Auto-switch tabs to relevant visualizer
                if (key.includes('Sort') || key.includes('binary')) {
                    switchTab('tab-array');
                } else if (key.includes('eventLoop') || key.includes('async')) {
                    switchTab('tab-eventloop');
                } else if (key.includes('bst') || key.includes('heap')) {
                    switchTab('tab-graph');
                } else {
                    switchTab('tab-memory');
                }
            }
        });
    }

    // 7. FORMAT CODE BUTTON
    if (btnFormat) {
        btnFormat.addEventListener('click', (e) => {
            e.preventDefault();
            editorController.formatCode();
        });
    }

    // 8. HELP BUTTON / MODAL
    if (btnHelp) {
        btnHelp.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`JS-Scope Interactive Visualizer Guide:

• Write single-page JavaScript in the editor or select a Preset Example.
• Controls:
  - Spacebar: Play / Pause (when not typing in editor)
  - Right Arrow: Step Forward (when not typing in editor)
  - Left Arrow: Step Backward (when not typing in editor)
  - R: Reset Stepper
• Visualization Tabs:
  - Stack & Heap: Call stack frames & hex memory references (0x10A1)
  - Array & Sorting: Bar blocks, pointer flags (i, j, pivot), comparing & swapping highlights
  - Event Loop: Call Stack, Web APIs, Microtasks (Promises), Task Queue (setTimeout)
  - Object / Tree Graph: Dynamic SVG node-link diagram for BST, linked lists, & heap pointers.`);
        });
    }

    // 9. CONSOLE ACTIONS
    if (btnClearConsole) {
        btnClearConsole.addEventListener('click', (e) => {
            e.preventDefault();
            const consoleOutput = document.getElementById('console-output');
            if (consoleOutput) {
                consoleOutput.innerHTML = `<div class="console-line system-msg"><span class="content">Log cleared.</span></div>`;
            }
        });
    }

    if (btnToggleConsole && appFooter) {
        btnToggleConsole.addEventListener('click', (e) => {
            e.preventDefault();
            appFooter.classList.toggle('collapsed');
            const icon = btnToggleConsole.querySelector('i');
            if (icon) {
                icon.className = appFooter.classList.contains('collapsed') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
            }
        });
    }

    // 10. TAB NAVIGATION BUTTONS
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    function switchTab(tabId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(tabId);

        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        appState.activeTab = tabId;

        // Force re-render of active step for tab
        appState.emitStepUpdate();
    }

    // 11. KEYBOARD SHORTCUTS (Only fire when NOT editing text)
    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        if (activeEl && (
            activeEl.closest('.CodeMirror') ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable
        )) {
            return; // Allow standard typing inside editor and inputs!
        }

        if (e.code === 'Space') {
            e.preventDefault();
            appState.togglePlay();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            appState.pause();
            appState.nextStep();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            appState.pause();
            appState.prevStep();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            appState.reset();
        }
    });
}
