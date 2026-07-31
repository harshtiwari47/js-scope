/* ==========================================================================
   GRAPHVISUALIZER.JS - Neumorphic SVG Dynamic Object & Node Graph Renderer
   ========================================================================== */

export function renderGraphVisualizer(snapshot) {
    const svg = document.getElementById('graph-svg-canvas');
    if (!svg) return;

    svg.innerHTML = '';

    if (!snapshot || !snapshot.graph || !snapshot.graph.nodes || snapshot.graph.nodes.length === 0) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', '50%');
        t.setAttribute('y', '50%');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', '#64748b');
        t.setAttribute('font-size', '14');
        t.setAttribute('font-style', 'italic');
        t.textContent = 'No Object or Tree Graph detected in current scope';
        svg.appendChild(t);
        return;
    }

    const { nodes = [], links = [] } = snapshot.graph;
    const width = svg.clientWidth || 600;
    const height = svg.clientHeight || 400;

    // Build adjacency for tree layout
    const targetIds = new Set(links.map(l => l.target));
    const roots = nodes.filter(n => !targetIds.has(n.id));
    const childrenMap = new Map();
    for (const link of links) {
        if (!childrenMap.has(link.source)) childrenMap.set(link.source, []);
        childrenMap.get(link.source).push({ id: link.target, label: link.label });
    }

    // Assign positions with tree layout
    const positions = new Map();
    const levelCounts = {};

    function assignPositions(nodeId, level, order) {
        if (positions.has(nodeId)) return;
        if (!levelCounts[level]) levelCounts[level] = 0;
        const idx = levelCounts[level]++;
        positions.set(nodeId, { level, idx });
        const kids = childrenMap.get(nodeId) || [];
        kids.forEach((kid, ki) => assignPositions(kid.id, level + 1, ki));
    }

    if (roots.length > 0) {
        roots.forEach((r, ri) => assignPositions(r.id, 0, ri));
    } else {
        nodes.forEach((n, i) => {
            if (!positions.has(n.id)) {
                positions.set(n.id, { level: 0, idx: i });
            }
        });
    }

    // Convert level/idx to x,y
    const maxLevel = Math.max(...[...positions.values()].map(p => p.level), 0);
    const coords = new Map();
    for (const [id, pos] of positions) {
        const totalAtLevel = levelCounts[pos.level] || 1;
        const x = (width / (totalAtLevel + 1)) * (pos.idx + 1);
        const y = (height / (maxLevel + 2)) * (pos.level + 1);
        coords.set(id, { x, y });
    }

    // Draw links
    links.forEach(link => {
        const s = coords.get(link.source);
        const t = coords.get(link.target);
        if (!s || !t) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', s.x);
        line.setAttribute('y1', s.y + 26);
        line.setAttribute('x2', t.x);
        line.setAttribute('y2', t.y - 26);
        line.setAttribute('stroke', '#2563eb');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', '6 3');
        svg.appendChild(line);

        // Arrow head
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const ax = t.x - 26 * Math.cos(angle);
        const ay = t.y - 26 * Math.sin(angle);
        const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const size = 7;
        const p1x = ax, p1y = ay;
        const p2x = ax - size * Math.cos(angle - 0.5), p2y = ay - size * Math.sin(angle - 0.5);
        const p3x = ax - size * Math.cos(angle + 0.5), p3y = ay - size * Math.sin(angle + 0.5);
        head.setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`);
        head.setAttribute('fill', '#2563eb');
        svg.appendChild(head);

        // Edge label
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', mx + 8);
        label.setAttribute('y', my);
        label.setAttribute('fill', '#db2777');
        label.setAttribute('font-weight', '700');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-family', 'Fira Code, monospace');
        label.textContent = link.label;
        svg.appendChild(label);
    });

    // Draw Neumorphic nodes
    nodes.forEach(node => {
        const pos = coords.get(node.id);
        if (!pos) return;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '26');
        circle.setAttribute('fill', '#dde3ec');
        circle.setAttribute('stroke', '#2563eb');
        circle.setAttribute('stroke-width', '3');
        circle.setAttribute('filter', 'drop-shadow(4px 4px 8px #b5becc)');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('y', '5');
        text.setAttribute('fill', '#3c4858');
        text.setAttribute('font-size', '13');
        text.setAttribute('font-weight', '800');
        text.setAttribute('font-family', 'Fira Code, monospace');
        text.setAttribute('text-anchor', 'middle');
        const lbl = String(node.label);
        text.textContent = lbl.length > 6 ? lbl.substring(0, 5) + '..' : lbl;
        g.appendChild(text);

        const typeTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        typeTxt.setAttribute('y', '42');
        typeTxt.setAttribute('fill', '#64748b');
        typeTxt.setAttribute('font-size', '10');
        typeTxt.setAttribute('font-weight', '700');
        typeTxt.setAttribute('font-family', 'Inter, sans-serif');
        typeTxt.setAttribute('text-anchor', 'middle');
        typeTxt.textContent = node.type;
        g.appendChild(typeTxt);

        svg.appendChild(g);
    });
}
