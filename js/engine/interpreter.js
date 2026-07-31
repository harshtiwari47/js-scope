/* ==========================================================================
   INTERPRETER.JS - Code Instrumentation & Step Trace Snapshot Engine
   Complete rewrite with working line-by-line instrumentation approach.
   ========================================================================== */

export class InterpreterEngine {
    constructor() {
        this.reset();
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
                self.logs.push({
                    type: 'log',
                    text: text,
                    line: self.callStack.length > 0 ? self.callStack[self.callStack.length - 1].line : 0
                });
            },
            warn: (...args) => {
                self.logs.push({ type: 'warn', text: args.join(' '), line: 0 });
            },
            error: (...args) => {
                self.logs.push({ type: 'error', text: args.join(' '), line: 0 });
            }
        };

        // Custom setTimeout for event loop visualization
        const __setTimeout = (fn, delay) => {
            if (typeof delay === 'undefined') delay = 0;
            const fnName = fn.name || 'callback';
            self.eventLoopState.webApis.push({
                name: 'setTimeout(' + fnName + ', ' + delay + 'ms)',
                delay: delay
            });
            self.pendingMacrotasks.push({ name: fnName + '()', fn: fn });
        };

        // Custom Promise for event loop visualization
        const __PromiseResolve = (val) => {
            return {
                then: (fn) => {
                    const fnName = fn.name || 'thenCallback';
                    self.eventLoopState.microtasks.push({
                        name: 'Promise.then(' + fnName + ')'
                    });
                    self.pendingMicrotasks.push({ name: fnName + '()', fn: fn, val: val });
                    return { then: () => ({}), catch: () => ({}) };
                },
                catch: () => ({ then: () => ({}) })
            };
        };

        const __Promise = {
            resolve: __PromiseResolve,
            reject: () => ({ catch: () => ({}), then: () => ({}) }),
            all: () => __PromiseResolve([]),
            race: () => __PromiseResolve(undefined)
        };

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

        // 7. Ensure at least one snapshot exists
        if (this.snapshots.length === 0) {
            __snap(1, {});
        }

        return this.snapshots;
    }

    // =========================================================================
    //  VARIABLE NAME COLLECTION
    // =========================================================================
    collectVarNames(code) {
        const names = new Set();
        const patterns = [
            /(?:var|let|const)\s+(\w+)/g,                     // var/let/const name
            /(?:var|let|const)\s+\[([^\]]+)\]/g,               // destructuring [a,b]
            /function\s+(\w+)\s*\(/g,                          // function declarations
        ];

        for (const pat of patterns) {
            let m;
            while ((m = pat.exec(code)) !== null) {
                if (m[1]) {
                    // Handle destructuring: split by comma
                    const parts = m[1].split(',').map(s => s.trim());
                    for (const p of parts) {
                        if (/^\w+$/.test(p)) names.add(p);
                    }
                }
            }
        }

        // Also extract function parameter names
        const paramPat = /function\s*\w*\s*\(([^)]*)\)/g;
        let pm;
        while ((pm = paramPat.exec(code)) !== null) {
            const params = pm[1].split(',').map(s => s.trim().split('=')[0].trim());
            for (const p of params) {
                if (/^\w+$/.test(p)) names.add(p);
            }
        }

        // Remove builtins / reserved
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
            if (typeof acorn === 'undefined' && typeof window !== 'undefined' && window.acorn) {
                // acorn loaded globally
            }
            const parser = (typeof acorn !== 'undefined') ? acorn : (window && window.acorn);
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
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
            if (node.body && node.body.loc) {
                results.push({
                    name: node.id ? node.id.name : 'anonymous',
                    openBraceLine: node.body.loc.start.line,
                    closeBraceLine: node.body.loc.end.line,
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

    // =========================================================================
    //  CODE INSTRUMENTATION
    // =========================================================================
    instrumentCode(code, varNames, funcBounds) {
        const lines = code.split('\n');
        const varArr = [...varNames];

        // Build safe IIFE snap expression that captures all variables via try/catch
        const snapExpr = varArr.length > 0
            ? '(function(){var __v={};' + varArr.map(n => 'try{__v.' + n + '=' + n + '}catch(__e){}').join(';') + ';return __v})()'
            : '{}';

        // Build lookup sets for function boundaries
        const funcOpenLines = new Map(); // line -> funcName
        const funcCloseLines = new Set();
        for (const fb of funcBounds) {
            funcOpenLines.set(fb.openBraceLine, fb.name);
            if (fb.closeBraceLine) funcCloseLines.add(fb.closeBraceLine);
        }

        // Track class bodies to skip instrumentation inside them
        let inClassBody = false;
        let classBraceDepth = 0;

        let output = '';
        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            let line = lines[i];
            const trimmed = line.trim();

            // --- CLASS BODY TRACKING (skip instrumentation inside class bodies) ---
            if (trimmed.startsWith('class ') && trimmed.includes('{')) {
                inClassBody = true;
                classBraceDepth = 0;
                // Count braces on this line
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

            // --- REPLACE let/const WITH var (for hoisting access in snap) ---
            if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
                line = line.replace(/\blet\b(?=\s)/g, 'var');
                line = line.replace(/\bconst\b(?=\s)/g, 'var');
            }

            // --- FUNCTION DECLARATION LINE (function name(...) {) ---
            const isFuncOpen = funcOpenLines.has(lineNum);
            const funcName = funcOpenLines.get(lineNum);

            if (isFuncOpen && trimmed.includes('function') && trimmed.endsWith('{')) {
                output += line + '\n';
                output += '__pushFrame("' + funcName + '", ' + lineNum + ');\n';
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                continue;
            }

            // --- FUNCTION CLOSE LINE (}) ---
            if (funcCloseLines.has(lineNum) && (trimmed === '}' || trimmed === '};')) {
                output += '__popFrame();\n';
                output += line + '\n';
                continue;
            }

            // --- RETURN STATEMENT ---
            if (trimmed.startsWith('return ') || trimmed === 'return;') {
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                output += '__popFrame();\n';
                output += line + '\n';
                continue;
            }

            // --- FOR / WHILE LOOP (snap INSIDE loop body, runs each iteration) ---
            if ((trimmed.match(/^for\s*\(/) || trimmed.match(/^while\s*\(/)) && trimmed.endsWith('{')) {
                output += line + '\n';
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                continue;
            }

            // --- IF / ELSE IF (snap BEFORE condition, always runs) ---
            if ((trimmed.match(/^if\s*\(/) || trimmed.match(/^}\s*else\s+if\s*\(/)) && trimmed.endsWith('{')) {
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                output += line + '\n';
                continue;
            }

            // --- REGULAR EXECUTABLE LINE (snap BEFORE) ---
            if (this.isExecutable(trimmed)) {
                output += '__snap(' + lineNum + ', ' + snapExpr + ');\n';
                output += line + '\n';
                continue;
            }

            // --- NON-EXECUTABLE (empty, comment, brace, else) ---
            output += line + '\n';
        }

        return output;
    }

    isExecutable(trimmed) {
        if (!trimmed) return false;
        if (trimmed.startsWith('//')) return false;
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) return false;
        if (trimmed === '{' || trimmed === '}' || trimmed === '};') return false;
        if (trimmed === '});') return false;
        if (trimmed === '} else {') return false;
        if (trimmed.match(/^}\s*else\s*{/)) return false;
        if (trimmed.startsWith('function ') && trimmed.endsWith('{')) return false;
        if (trimmed.startsWith('return ')) return false;
        if (trimmed === 'return;') return false;
        if (trimmed.match(/^for\s*\(/) && trimmed.endsWith('{')) return false;
        if (trimmed.match(/^while\s*\(/) && trimmed.endsWith('{')) return false;
        if (trimmed.match(/^if\s*\(/) && trimmed.endsWith('{')) return false;
        if (trimmed.match(/^}\s*else\s+if\s*\(/) && trimmed.endsWith('{')) return false;
        if (trimmed.startsWith('class ')) return false;
        return true;
    }

    // =========================================================================
    //  EVENT LOOP QUEUE PROCESSING (post main execution)
    // =========================================================================
    processEventLoopQueues(__snap, __pushFrame, __popFrame, __console, varNames) {
        const varArr = [...varNames];
        const snapExpr = varArr.length > 0
            ? (function() { var __v = {}; return __v; })
            : (function() { return {}; });

        // Process microtasks first (Promises)
        if (this.pendingMicrotasks.length > 0) {
            this.eventLoopState.status = 'Processing Microtask Queue';
            for (const task of this.pendingMicrotasks) {
                // Remove from microtask queue
                this.eventLoopState.microtasks = this.eventLoopState.microtasks.filter(
                    m => !m.name.includes(task.name.replace('()', ''))
                );
                this.callStack.push({ name: task.name, line: 0, scope: {} });

                // Record snapshot showing task entering call stack
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

                try { task.fn(task.val); } catch(e) {
                    __console.error(e.message);
                }

                if (this.callStack.length > 1) this.callStack.pop();

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
            this.pendingMicrotasks = [];
        }

        // Process macrotasks (setTimeout callbacks)
        if (this.pendingMacrotasks.length > 0) {
            this.eventLoopState.status = 'Processing Task Queue';
            // Move from webApis to macrotask queue display
            this.eventLoopState.webApis = [];
            this.eventLoopState.macrotasks = this.pendingMacrotasks.map(t => ({ name: t.name }));

            for (const task of this.pendingMacrotasks) {
                this.eventLoopState.macrotasks = this.eventLoopState.macrotasks.filter(
                    m => m.name !== task.name
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

                try { task.fn(); } catch(e) {
                    __console.error(e.message);
                }

                if (this.callStack.length > 1) this.callStack.pop();

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
            this.pendingMacrotasks = [];
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

        for (const [key, val] of Object.entries(vars)) {
            if (key.startsWith('__')) continue;
            if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v === 'number')) {
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
            sorted: sorted
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
