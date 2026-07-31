/* ==========================================================================
   EVENTLOOP.JS - Event Loop, Web APIs & Async Queues Visualizer
   ========================================================================== */

export function renderEventLoop(snapshot) {
    const elStack = document.getElementById('el-callstack');
    const elWebAPI = document.getElementById('el-webapi');
    const elMicrotasks = document.getElementById('el-microtasks');
    const elMacrotasks = document.getElementById('el-macrotasks');
    const elStatusMsg = document.getElementById('el-status-msg');
    const spinner = document.getElementById('event-loop-spinner');

    if (!elStack) return;

    if (!snapshot) {
        if (elStack) elStack.innerHTML = `<div class="queue-item empty">[Stack Empty]</div>`;
        if (elWebAPI) elWebAPI.innerHTML = `<div class="queue-item empty">No pending async tasks</div>`;
        if (elMicrotasks) elMicrotasks.innerHTML = `<div class="queue-item empty">Microtask Queue empty</div>`;
        if (elMacrotasks) elMacrotasks.innerHTML = `<div class="queue-item empty">Task Queue empty</div>`;
        if (elStatusMsg) elStatusMsg.textContent = 'Idle';
        return;
    }

    const callStack = snapshot.callStack || [];
    const eventLoop = snapshot.eventLoop || {};

    // 1. CALL STACK
    if (callStack.length === 0) {
        elStack.innerHTML = `<div class="queue-item empty">[Stack Empty]</div>`;
    } else {
        elStack.innerHTML = callStack.map(f => `
            <div class="queue-item">
                <span><i class="fa-solid fa-code" style="font-size:0.7rem;margin-right:4px"></i> ${f.name}</span>
                <span style="color:#5c6b73;font-size:0.75rem">L${f.line}</span>
            </div>
        `).join('');
    }

    // 2. WEB APIS
    const webApis = eventLoop.webApis || [];
    if (elWebAPI) {
        if (webApis.length === 0) {
            elWebAPI.innerHTML = `<div class="queue-item empty">No pending async tasks</div>`;
        } else {
            elWebAPI.innerHTML = webApis.map(w => `
                <div class="queue-item">
                    <span><i class="fa-solid fa-clock-rotate-left" style="margin-right:4px"></i> ${w.name}</span>
                    <span style="color:#5c6b73;font-size:0.75rem">${w.delay}ms</span>
                </div>
            `).join('');
        }
    }

    // 3. MICROTASKS
    const microtasks = eventLoop.microtasks || [];
    if (elMicrotasks) {
        if (microtasks.length === 0) {
            elMicrotasks.innerHTML = `<div class="queue-item empty">Microtask Queue empty</div>`;
        } else {
            elMicrotasks.innerHTML = microtasks.map(m => `
                <div class="queue-item">
                    <span><i class="fa-solid fa-bolt" style="margin-right:4px"></i> ${m.name}</span>
                </div>
            `).join('');
        }
    }

    // 4. MACROTASKS
    const macrotasks = eventLoop.macrotasks || [];
    if (elMacrotasks) {
        if (macrotasks.length === 0) {
            elMacrotasks.innerHTML = `<div class="queue-item empty">Task Queue empty</div>`;
        } else {
            elMacrotasks.innerHTML = macrotasks.map(t => `
                <div class="queue-item">
                    <span><i class="fa-solid fa-clock" style="margin-right:4px"></i> ${t.name}</span>
                </div>
            `).join('');
        }
    }

    // 5. STATUS & SPINNER
    if (elStatusMsg) {
        if (callStack.length > 1) {
            elStatusMsg.textContent = 'Call Stack active';
            if (spinner) spinner.style.animationDuration = '4s';
        } else if (microtasks.length > 0) {
            elStatusMsg.textContent = 'Processing Microtask Queue';
            if (spinner) spinner.style.animationDuration = '1.5s';
        } else if (macrotasks.length > 0) {
            elStatusMsg.textContent = 'Transferring Task to Stack';
            if (spinner) spinner.style.animationDuration = '1s';
        } else {
            elStatusMsg.textContent = eventLoop.status || 'Event Loop Idle';
            if (spinner) spinner.style.animationDuration = '6s';
        }
    }
}
