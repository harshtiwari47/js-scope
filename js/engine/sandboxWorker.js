import { InterpreterEngine } from './interpreter.js';
import * as acornModule from 'https://cdn.jsdelivr.net/npm/acorn@8.11.3/+esm';

// Shadow dangerous APIs to prevent Sandbox Escape
const window = undefined;
const document = undefined;
const fetch = undefined;
const XMLHttpRequest = undefined;
const localStorage = undefined;
const sessionStorage = undefined;
const indexedDB = undefined;

self.acorn = acornModule;

self.onmessage = function(e) {
    const { code } = e.data;
    
    try {
        const engine = new InterpreterEngine();
        const snapshots = engine.generateTrace(code);
        self.postMessage({ type: 'success', snapshots });
    } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
    }
};
