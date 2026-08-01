/* ==========================================================================
   INTERPRETER.JS - Code Instrumentation & Step Trace Snapshot Engine
   Complete rewrite with working line-by-line instrumentation approach.
   ========================================================================== */

export class InterpreterEngine {
    constructor() {
        this.reset();
    }

    /**
     * Asynchronously generates a trace using a Web Worker to prevent UI blocking 
     * and allow strict timeouts (preventing infinite loop browser freezes).
     */
    generateTraceAsync(code, timeoutMs = 3000) {
        return new Promise((resolve, reject) => {
            // Note: Use absolute or correct relative path to worker depending on context.
            // Since this runs from index.html, 'js/engine/sandboxWorker.js' should work.
            const worker = new Worker('js/engine/sandboxWorker.js', { type: 'module' });
            
            const timer = setTimeout(() => {
                worker.terminate();
                reject(new Error(`Execution Timeout: Code took longer than ${timeoutMs}ms to execute. Infinite loop detected.`));
            }, timeoutMs);

            worker.onmessage = (e) => {
                clearTimeout(timer);
                if (e.data.type === 'success') {
                    resolve(e.data.snapshots);
                } else {
                    reject(new Error(e.data.error));
                }
                worker.terminate();
            };

            worker.onerror = (e) => {
                clearTimeout(timer);
                reject(new Error(e.message || 'Worker Error'));
                worker.terminate();
            };

            worker.postMessage({ code });
        });
    }

    reset() {
        this.snapshots = [];
        this.callStack = [];
        this.logs = [];
        this.heapCounter = 0x1000;
        this.heapIdentityMap = new Map();
        this.heapRegistry = {};
        this.eventLoopState = {
            webApis: [],
            microtasks: [],
            macrotasks: [],
            status: 'Idle'
        };
        this.pendingMicrotasks = [];
        this.pendingMacrotasks = [];
        this.codeLines = [];
    }

    /**
     * Main entry point: instruments user code, executes it, and returns step snapshots.
     */
    generateTrace(userCode) {
        this.reset();
        this.callStack = [{ name: 'main()', line: 1, scope: {} }];
        this.codeLines = userCode.split('\n');

        // 1. Collect variable names from user code
        const varNames = this.collectVarNames(userCode);

        // 2. Find function boundaries via Acorn AST
        const funcBounds = this.findFunctionBoundaries(userCode);

        // 3. Instrument the code with __snap / __pushFrame / __popFrame calls
        const instrumented = this.instrumentCode(userCode, varNames, funcBounds);

        // 4. Create trace helper functions
        const self = this;
        const MAX_SNAPS = 8000;

        const __snap = function(line, vars) {
            if (self.snapshots.length >= MAX_SNAPS) return;

            // Update top-of-stack frame
            if (self.callStack.length > 0) {
                self.callStack[self.callStack.length - 1].line = line;
                self.callStack[self.callStack.length - 1].scope = self.cleanVars(vars);
            }

            // Register heap objects from raw references
            self.registerHeapFromRaw(vars);

            // Detect array state for sorting visualizer
            const arrayState = self.detectArrayState(vars, line);

            // Build graph for tree/object visualizer
            const graph = self.buildGraph(vars);

            // Push snapshot
            self.snapshots.push({
                step: self.snapshots.length + 1,
                line: line,
                callStack: self.cloneCallStack(),
                scope: self.cleanVars(vars),
                heap: self.cloneHeap(),
                arrayState: arrayState,
                eventLoop: JSON.parse(JSON.stringify(self.eventLoopState)),
                graph: graph,
                logs: self.logs.map(l => ({ ...l }))
            });
        };

        const __pushFrame = function(name, line) {
            if (self.callStack.length > 50) {
                throw new Error('Maximum call stack depth exceeded');
            }
            self.callStack.push({ name: name + '()', line: line, scope: {} });
            self.eventLoopState.status = 'Executing: ' + name + '()';
        };

        const __popFrame = function() {
            if (self.callStack.length > 1) {
                self.callStack.pop();
            }
        };

        const __console = {
            log: (...args) => {
                const text = args.map(a => {
                    if (a === null) return 'null';
                    if (a === undefined) return 'undefined';
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a); } catch(e) { return String(a); }
                    }
                    return String(a);
                }).join(' ');
                const curLine = self.callStack.length > 0 ? self.callStack[self.callStack.length - 1].line : 1;
                self.logs.push({
                    type: 'log',
                    text: text,
                    line: curLine
                });
                __snap(curLine, {});
            },
            warn: (...args) => {
                const curLine = self.callStack.length > 0 ? self.callStack[self.callStack.length - 1].line : 1;
                self.logs.push({ type: 'warn', text: args.join(' '), line: curLine });
                __snap(curLine, {});
            },
            error: (...args) => {
                const curLine = self.callStack.length > 0 ? self.callStack[self.callStack.length - 1].line : 1;
                self.logs.push({ type: 'error', text: args.join(' '), line: curLine });
                __snap(curLine, {});
            }
        };

        // Custom setTimeout for event loop visualization
        const __setTimeout = (fn, delay) => {
            const fnName = fn.name || 'anonymous';
            self.eventLoopState.webApis.push({ name: 'Timer(' + fnName + ', ' + (delay||0) + 'ms)' });
            self.pendingMacrotasks.push({ name: fnName + '()', fn: fn, delay: delay || 0 });
            return 1;
        };

        class MockPromise {
            constructor(executor) {
                this.state = 'pending';
                this.value = undefined;
                this.handlers = [];
                const resolve = (val) => {
                    if (this.state !== 'pending') return;
                    this.state = 'fulfilled';
                    this.value = val;
                    this.handlers.forEach(h => this.schedule(h.onFulfilled, this.value, h.resolve, h.reject));
                };
                const reject = (err) => {
                    if (this.state !== 'pending') return;
                    this.state = 'rejected';
                    this.value = err;
                    this.handlers.forEach(h => this.schedule(h.onRejected, this.value, h.resolve, h.reject));
                };
                if (executor) {
                    try { executor(resolve, reject); } catch (e) { reject(e); }
                }
            }
            schedule(handler, val, resolve, reject) {
                if (!handler) {
                    this.state === 'fulfilled' ? resolve(val) : reject(val);
                    return;
                }
                const fnName = handler.name || 'anonymous';
                self.eventLoopState.microtasks.push({ name: 'Promise.then(' + fnName + ')' });
                self.pendingMicrotasks.push({
                    name: fnName + '()',
                    fn: () => {
                        try { resolve(handler(val)); } catch (e) { reject(e); }
                    },
                    val: undefined
                });
            }
            then(onFulfilled, onRejected) {
                return new MockPromise((resolve, reject) => {
                    if (this.state === 'pending') {
                        this.handlers.push({ onFulfilled, onRejected, resolve, reject });
                    } else if (this.state === 'fulfilled') {
                        this.schedule(onFulfilled, this.value, resolve, reject);
                    } else {
                        this.schedule(onRejected, this.value, resolve, reject);
                    }
                });
            }
            catch(onRejected) { return this.then(null, onRejected); }
            finally(onFinally) {
                return this.then(
                    v => { onFinally(); return v; },
                    e => { onFinally(); throw e; }
                );
            }
            static resolve(val) {
                if (val instanceof MockPromise) return val;
                return new MockPromise(resolve => resolve(val));
            }
            static reject(err) { return new MockPromise((resolve, reject) => reject(err)); }
            static all(iterable) {
                return new MockPromise((resolve, reject) => {
                    let arr = Array.from(iterable);
                    if (arr.length === 0) return resolve([]);
                    let count = 0, results = new Array(arr.length);
                    arr.forEach((p, i) => {
                        MockPromise.resolve(p).then(v => {
                            results[i] = v;
                            if (++count === arr.length) resolve(results);
                        }, reject);
                    });
                });
            }
            static race(iterable) {
                return new MockPromise((resolve, reject) => {
                    Array.from(iterable).forEach(p => MockPromise.resolve(p).then(resolve, reject));
                });
            }
        }
        const __Promise = MockPromise;

        // 5. Execute instrumented code
        try {
            const fn = new Function(
                '__snap', '__pushFrame', '__popFrame',
                'console', 'setTimeout', 'Promise',
                instrumented
            );
            fn(__snap, __pushFrame, __popFrame, __console, __setTimeout, __Promise);
        } catch (e) {
            self.logs.push({ type: 'error', text: 'Runtime Error: ' + e.message, line: 0 });
        }

        // 6. Post-execution: process event loop queues
        this.processEventLoopQueues(__snap, __pushFrame, __popFrame, __console, varNames);

        // 7. Take a final snapshot of completed execution state
        __snap(this.codeLines.length, {});

        return this.snapshots;
    }

    // =========================================================================
    //  VARIABLE NAME COLLECTION
    // =========================================================================
    collectVarNames(code) {
        const names = new Set();
        try {
            let parser = null;
            if (typeof acorn !== 'undefined') {
                parser = acorn;
            } else if (typeof window !== 'undefined' && window.acorn) {
                parser = window.acorn;
            } else if (typeof self !== 'undefined' && self.acorn) {
                parser = self.acorn;
            }
            if (!parser) return names;
            
            const ast = parser.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
            
            const extractPatternNames = (node) => {
                if (!node) return;
                if (node.type === 'Identifier') names.add(node.name);
                else if (node.type === 'ArrayPattern') {
                    for (const elem of node.elements) extractPatternNames(elem);
                } else if (node.type === 'ObjectPattern') {
                    for (const prop of node.properties) {
                        if (prop.type === 'Property') extractPatternNames(prop.value);
                        else if (prop.type === 'RestElement') extractPatternNames(prop.argument);
                    }
                } else if (node.type === 'RestElement') {
                    extractPatternNames(node.argument);
                } else if (node.type === 'AssignmentPattern') {
                    extractPatternNames(node.left);
                }
            };

            const extractNames = (node) => {
                if (!node || typeof node !== 'object') return;
                if (node.type === 'VariableDeclarator') {
                    extractPatternNames(node.id);
                } else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
                    if (node.id) names.add(node.id.name);
                    for (const param of (node.params || [])) extractPatternNames(param);
                } else if (node.type === 'CatchClause' && node.param) {
                    extractPatternNames(node.param);
                }
                
                for (const key of Object.keys(node)) {
                    if (key === 'loc' || key === 'start' || key === 'end') continue;
                    const child = node[key];
                    if (Array.isArray(child)) {
                        for (const item of child) {
                            if (item && typeof item === 'object') extractNames(item);
                        }
                    } else if (child && typeof child === 'object') {
                        extractNames(child);
                    }
                }
            };
            extractNames(ast);
        } catch(e) {}
        
        const reserved = new Set([
            'console','Math','Array','Object','Promise','setTimeout','setInterval',
            'undefined','NaN','Infinity','arguments','this','true','false','null',
            'typeof','return','if','else','for','while','do','switch','case',
            'break','continue','new','delete','throw','try','catch','finally',
            'class','extends','super','import','export','default','from','as',
            'of','in','instanceof','function','async','await','yield','void',
            'with','debugger','var','let','const','window','document','JSON',
            'Number','String','Boolean','Symbol','Map','Set','WeakMap','Error',
            'parseInt','parseFloat','isNaN','isFinite','encodeURI','decodeURI'
        ]);
        for (const r of reserved) names.delete(r);
        return names;
    }

    // =========================================================================
    //  ACORN AST FUNCTION BOUNDARY DETECTION
    // =========================================================================
    findFunctionBoundaries(code) {
        const results = [];
        try {
            let parser = null;
            if (typeof acorn !== 'undefined') {
                parser = acorn;
            } else if (typeof window !== 'undefined' && window.acorn) {
                parser = window.acorn;
            } else if (typeof self !== 'undefined' && self.acorn) {
                parser = self.acorn;
            }
            
            if (!parser) return results;

            const ast = parser.parse(code, {
                ecmaVersion: 'latest',
                locations: true,
                sourceType: 'script'
            });
            this.walkASTForFunctions(ast, results);
        } catch (e) {
            // Acorn parse failed; fall back to regex-only
            const lines = code.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(/function\s+(\w+)\s*\(/);
                if (match && lines[i].trim().endsWith('{')) {
                    results.push({
                        name: match[1],
                        openBraceLine: i + 1,
                        closeBraceLine: null
                    });
                }
            }
        }
        return results;
    }

    walkASTForFunctions(node, results) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            if (node.body && node.body.loc) {
                results.push({
                    name: node.id ? node.id.name : 'anonymous',
                    openBraceLine: node.body.loc.start.line,
                    closeBraceLine: node.body.type === 'BlockStatement' ? node.body.loc.end.line : node.body.loc.start.line,
                    isExpr: node.body.type !== 'BlockStatement',
                    params: (node.params || []).map(p => p.name || '').filter(Boolean)
                });
            }
        }
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object' && item.type) {
                        this.walkASTForFunctions(item, results);
                    }
                }
            } else if (child && typeof child === 'object' && child.type) {
                this.walkASTForFunctions(child, results);
            }
        }
    }

    instrumentCode(code, varNames, funcBounds) {
        const lines = code.split('\n');
        const varArr = [...varNames];

        const snapExpr = varArr.length > 0
            ? '(function(){var __v={};' + varArr.map(n => 'try{__v.' + n + '=' + n + '}catch(__e){}').join(';') + ';return __v})()'
            : '{}';

        let funcOpens = new Map();
        let funcCloses = new Set();
        let returns = new Set();
        let loopsIfs = new Set();
        let stmts = new Set();

        let parser = null;
        if (typeof acorn !== 'undefined') parser = acorn;
        else if (typeof window !== 'undefined' && window.acorn) parser = window.acorn;
        else if (typeof self !== 'undefined' && self.acorn) parser = self.acorn;
        
        if (parser) {
            try {
                const ast = parser.parse(code, { ecmaVersion: 'latest', locations: true, sourceType: 'script' });
                const walk = (node) => {
                    if (!node || typeof node !== 'object') return;
                    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
                        if (node.body.type === 'BlockStatement') {
                            funcOpens.set(node.body.loc.start.line, node.id ? node.id.name : 'anonymous');
                            funcCloses.add(node.body.loc.end.line);
                        }
                    } else if (node.type === 'ReturnStatement') {
                        returns.add(node.loc.start.line);
                    } else if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement' || node.type === 'WhileStatement' || node.type === 'DoWhileStatement' || node.type === 'IfStatement') {
                        loopsIfs.add(node.loc.start.line);
                    } else if (node.type.endsWith('Statement') && node.type !== 'BlockStatement') {
                        stmts.add(node.loc.start.line);
                    } else if (node.type === 'VariableDeclaration') {
                        stmts.add(node.loc.start.line);
                    }
                    for (const key of Object.keys(node)) {
                        if (key === 'loc') continue;
                        const child = node[key];
                        if (Array.isArray(child)) child.forEach(walk);
                        else if (child && typeof child === 'object') walk(child);
                    }
                };
                walk(ast);
            } catch(e) {}
        }

        let inClassBody = false;
        let classBraceDepth = 0;

        let output = '';
        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            let line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('class ') && trimmed.includes('{')) {
                inClassBody = true;
                classBraceDepth = 0;
                for (const ch of trimmed) {
                    if (ch === '{') classBraceDepth++;
                    if (ch === '}') classBraceDepth--;
                }
                output += line + '\n';
                continue;
            }
            if (inClassBody) {
                for (const ch of trimmed) {
                    if (ch === '{') classBraceDepth++;
                    if (ch === '}') classBraceDepth--;
                }
                if (classBraceDepth <= 0) inClassBody = false;
                output += line + '\n';
                continue;
            }

            if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
                line = line.replace(/\blet\b(?=\s)/g, 'var');
                line = line.replace(/\bconst\b(?=\s)/g, 'var');
            }

            if (funcOpens.has(lineNum)) {
                const fnName = funcOpens.get(lineNum);
                const braceIdx = line.indexOf('{');
                if (braceIdx !== -1) {
                    const before = line.substring(0, braceIdx + 1);
                    const after = line.substring(braceIdx + 1);
                    output += before + '\nvar __ret_ml = undefined; __pushFrame("' + fnName + '", ' + lineNum + '); __snap(' + lineNum + ', ' + snapExpr + ');\n' + after + '\n';
                    continue;
                }
            }

            if (funcCloses.has(lineNum)) {
                const braceIdx = line.lastIndexOf('}');
                if (braceIdx !== -1) {
                    const before = line.substring(0, braceIdx);
                    const after = line.substring(braceIdx);
                    output += before + '\n__popFrame(); if (typeof __ret_ml !== "undefined" && __ret_ml !== undefined) return __ret_ml;\n' + after + '\n';
                    continue;
                }
            }

            if (returns.has(lineNum)) {
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                if (trimmed === 'return;' || trimmed === 'return') {
                    output += '__popFrame(); return;\n';
                } else if (trimmed.match(/return\s+\{/) || trimmed.match(/return\s+\[/)) {
                    output += line.replace(/\breturn\b/, '__ret_ml =') + '\n';
                } else {
                    let retExpr = trimmed.substring(trimmed.indexOf('return') + 6).trim();
                    if (retExpr.endsWith(';')) retExpr = retExpr.slice(0, -1);
                    output += 'var __ret = (' + retExpr + '); __popFrame(); return __ret;\n';
                }
                continue;
            }

            if (loopsIfs.has(lineNum) || stmts.has(lineNum)) {
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                output += line + '\n';
                continue;
            }

            output += line + '\n';
        }

        return output;
    }

    // =========================================================================
    //  EVENT LOOP QUEUE PROCESSING (post main execution)
    // =========================================================================
    processEventLoopQueues(__snap, __pushFrame, __popFrame, __console, varNames) {
        const varArr = [...varNames];
        const snapExpr = varArr.length > 0
            ? (function() { var __v = {}; return __v; })
            : (function() { return {}; });

        this.pendingMacrotasks.sort((a, b) => (a.delay || 0) - (b.delay || 0));

        const drainMicrotasks = () => {
            while (this.pendingMicrotasks.length > 0) {
                this.eventLoopState.status = 'Processing Microtask Queue';
                const task = this.pendingMicrotasks.shift();
                
                this.eventLoopState.microtasks = this.eventLoopState.microtasks.filter(
                    m => !m.name.includes(task.name.replace('()', ''))
                );
                
                this.callStack.push({ name: task.name, line: 0, scope: {} });
                
                this.snapshots.push({
                    step: this.snapshots.length + 1,
                    line: 0,
                    callStack: this.cloneCallStack(),
                    scope: {},
                    heap: this.cloneHeap(),
                    arrayState: null,
                    eventLoop: JSON.parse(JSON.stringify(this.eventLoopState)),
                    graph: { nodes: [], links: [] },
                    logs: this.logs.map(l => ({ ...l }))
                });

                try { task.fn(task.val); } catch(e) { __console.error(e.message); }

                if (this.callStack.length > 0) this.callStack.pop();

                this.snapshots.push({
                    step: this.snapshots.length + 1,
                    line: 0,
                    callStack: this.cloneCallStack(),
                    scope: {},
                    heap: this.cloneHeap(),
                    arrayState: null,
                    eventLoop: JSON.parse(JSON.stringify(this.eventLoopState)),
                    graph: { nodes: [], links: [] },
                    logs: this.logs.map(l => ({ ...l }))
                });
            }
        };

        drainMicrotasks();

        while (this.pendingMacrotasks.length > 0) {
            this.eventLoopState.status = 'Processing Task Queue';
            const task = this.pendingMacrotasks.shift();
            
            this.eventLoopState.webApis = [];
            this.eventLoopState.macrotasks = this.pendingMacrotasks.map(t => ({ name: t.name }));

            this.callStack.push({ name: task.name, line: 0, scope: {} });

            this.snapshots.push({
                step: this.snapshots.length + 1,
                line: 0,
                callStack: this.cloneCallStack(),
                scope: {},
                heap: this.cloneHeap(),
                arrayState: null,
                eventLoop: JSON.parse(JSON.stringify(this.eventLoopState)),
                graph: { nodes: [], links: [] },
                logs: this.logs.map(l => ({ ...l }))
            });

            try { task.fn(); } catch(e) { __console.error(e.message); }

            if (this.callStack.length > 0) this.callStack.pop();

            this.snapshots.push({
                step: this.snapshots.length + 1,
                line: 0,
                callStack: this.cloneCallStack(),
                scope: {},
                heap: this.cloneHeap(),
                arrayState: null,
                eventLoop: JSON.parse(JSON.stringify(this.eventLoopState)),
                graph: { nodes: [], links: [] },
                logs: this.logs.map(l => ({ ...l }))
            });

            drainMicrotasks();
        }

        this.eventLoopState.status = 'Event Loop Idle';
    }

    // =========================================================================
    //  SNAPSHOT HELPERS
    // =========================================================================

    /** Deep-clone variables, converting objects/arrays by value, functions to labels. */
    cleanVars(vars) {
        const result = {};
        if (!vars || typeof vars !== 'object') return result;
        for (const [key, val] of Object.entries(vars)) {
            if (key.startsWith('__')) continue;
            if (typeof val === 'function') {
                result[key] = '[Function: ' + (val.name || 'anonymous') + ']';
            } else if (val === undefined) {
                // skip undefined to reduce noise
            } else if (val === null) {
                result[key] = null;
            } else if (typeof val === 'object') {
                try {
                    result[key] = JSON.parse(JSON.stringify(val));
                } catch(e) {
                    result[key] = String(val);
                }
            } else {
                result[key] = val;
            }
        }
        return result;
    }

    /** Get or assign a hex heap address for an object. */
    getHeapAddr(obj) {
        if (!obj || typeof obj !== 'object') return null;
        let addr = this.heapIdentityMap.get(obj);
        if (!addr) {
            addr = '0x' + (this.heapCounter++).toString(16).toUpperCase().padStart(4, '0');
            this.heapIdentityMap.set(obj, addr);
        }
        return addr;
    }

    /** Register all objects/arrays in vars into the heap registry. */
    registerHeapFromRaw(vars) {
        if (!vars || typeof vars !== 'object') return;
        for (const [key, val] of Object.entries(vars)) {
            if (val && typeof val === 'object' && !key.startsWith('__')) {
                this.registerOneHeapObject(val);
            }
        }
    }

    registerOneHeapObject(obj) {
        if (!obj || typeof obj !== 'object') return;
        const addr = this.getHeapAddr(obj);
        try {
            this.heapRegistry[addr] = {
                id: addr,
                type: Array.isArray(obj) ? 'Array' : (obj.constructor && obj.constructor.name !== 'Object' ? obj.constructor.name : 'Object'),
                value: JSON.parse(JSON.stringify(obj))
            };
        } catch(e) {
            this.heapRegistry[addr] = {
                id: addr,
                type: 'Object',
                value: {}
            };
        }
    }

    /** Clone the call stack for snapshot immutability. */
    cloneCallStack() {
        return this.callStack.map(frame => ({
            name: frame.name,
            line: frame.line,
            scope: frame.scope ? { ...frame.scope } : {}
        }));
    }

    /** Clone the heap registry. */
    cloneHeap() {
        try {
            return JSON.parse(JSON.stringify(this.heapRegistry));
        } catch(e) {
            return {};
        }
    }

    // =========================================================================
    //  ARRAY STATE DETECTION (for sorting visualizer)
    // =========================================================================
    detectArrayState(vars, line) {
        if (!vars || typeof vars !== 'object') return null;

        let arrayName = '';
        let arrayValues = null;
        let arrayRef = null;
        const pointers = {};
        const knownPtrNames = new Set([
            'i','j','k','n','left','right','mid','low','high','start','end',
            'pi','pivot','minIdx','maxIdx','index','idx','pos','temp',
            'searchKey','target'
        ]);

        const allArrays = {};
        for (const [key, val] of Object.entries(vars)) {
            if (key.startsWith('__')) continue;
            if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v === 'number')) {
                allArrays[key] = [...val];
                if (!arrayValues) {
                    arrayName = key;
                    arrayValues = [...val];
                    arrayRef = val;
                    this.registerOneHeapObject(val);
                }
            } else if (typeof val === 'number' && Number.isInteger(val) && knownPtrNames.has(key)) {
                pointers[key] = val;
            }
        }

        if (!arrayValues) return null;

        // Detect comparing/swapping/target from current code line
        const codeLine = (this.codeLines[line - 1] || '').trim();
        let comparing = [];
        let swapping = [];
        let target = null;

        // Comparison detection
        if (codeLine.includes('>') || codeLine.includes('<') || codeLine.includes('===') || codeLine.includes('!==')) {
            if (pointers.j !== undefined) {
                comparing.push(pointers.j);
                if (codeLine.includes('j + 1') || codeLine.includes('j+1')) {
                    comparing.push(pointers.j + 1);
                } else if (pointers.i !== undefined) {
                    // Quick sort style: compare i and j positions
                }
            }
            if (pointers.mid !== undefined) {
                comparing = [pointers.mid];
            }
            if (pointers.left !== undefined && pointers.right !== undefined &&
                codeLine.includes('left') && codeLine.includes('right')) {
                comparing = [pointers.left, pointers.right];
            }
        }

        // Swap detection
        if (codeLine.includes('temp') || (codeLine.includes('arr[') && codeLine.includes('='))) {
            if (codeLine.includes('temp')) {
                if (pointers.j !== undefined) {
                    swapping.push(pointers.j);
                    if (codeLine.includes('j + 1') || codeLine.includes('j+1')) {
                        swapping.push(pointers.j + 1);
                    }
                }
                if (pointers.i !== undefined && pointers.j !== undefined &&
                    codeLine.includes('[i]') || codeLine.includes('[j]')) {
                    swapping = [pointers.i, pointers.j];
                }
            }
        }

        // Target/pivot detection
        if (pointers.pivot !== undefined && typeof pointers.pivot === 'number') {
            target = pointers.pivot;
        } else if (pointers.mid !== undefined) {
            target = pointers.mid;
        }

        // Detect sorted suffix (elements at end matching sorted order)
        const sorted = [];
        const fullySorted = [...arrayValues].sort((a, b) => a - b);
        for (let k = arrayValues.length - 1; k >= 0; k--) {
            if (arrayValues[k] === fullySorted[k]) {
                sorted.push(k);
            } else {
                break;
            }
        }

        // Filter comparing/swapping to valid indices
        comparing = comparing.filter(idx => typeof idx === 'number' && idx >= 0 && idx < arrayValues.length);
        swapping = swapping.filter(idx => typeof idx === 'number' && idx >= 0 && idx < arrayValues.length);

        return {
            name: arrayName,
            values: arrayValues,
            pointers: pointers,
            comparing: comparing,
            swapping: swapping,
            target: target,
            sorted: sorted,
            allArrays: allArrays
        };
    }

    // =========================================================================
    //  GRAPH BUILDING (for tree / object node-link visualizer)
    // =========================================================================
    buildGraph(vars) {
        const nodes = [];
        const links = [];
        if (!vars || typeof vars !== 'object') return { nodes, links };

        const visited = new Set();

        const traverse = (obj, name, parentAddr, linkLabel) => {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj)) return;
            visited.add(obj);

            const addr = this.getHeapAddr(obj);
            const label = obj.val !== undefined ? String(obj.val)
                        : obj.value !== undefined ? String(obj.value)
                        : obj.name !== undefined ? String(obj.name)
                        : name;

            nodes.push({
                id: addr,
                label: label,
                type: (obj.constructor && obj.constructor.name !== 'Object') ? obj.constructor.name : 'Object'
            });

            if (parentAddr && linkLabel) {
                links.push({ source: parentAddr, target: addr, label: linkLabel });
            }

            // Recurse into object properties
            for (const [k, v] of Object.entries(obj)) {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    traverse(v, k, addr, k);
                }
            }
        };

        for (const [key, val] of Object.entries(vars)) {
            if (key.startsWith('__')) continue;
            if (val && typeof val === 'object' && !Array.isArray(val) && typeof val !== 'function') {
                traverse(val, key, null, null);
            }
        }

        return { nodes, links };
    }
}

export const interpreter = new InterpreterEngine();
