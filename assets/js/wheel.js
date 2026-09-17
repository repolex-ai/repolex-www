/**
 * Repolex Ecosystem Wheel
 * Circular Dependency Wheel with Fine Architectural Pencil Lines
 * Inspired by Selkie's git-lex viz
 */

(function () {
    'use strict';

    // Configuration & Palettes
    const PALETTE = {
        bg: '#ffffff',
        pencilRest: 'rgba(22, 26, 38, 0.10)',
        pencilDim: 'rgba(228, 231, 238, 0.22)',
        outbound: 'rgba(217, 119, 6, 0.88)',     // Amber
        inbound: 'rgba(37, 99, 235, 0.92)',      // Cobalt Blue
        complete: '#16a34a',                     // Green
        in_progress: '#d97706',                  // Amber / Yellow
        failed: '#dc2626',                       // Red
        discovered: '#94a3b8',                   // Slate
        ring: '#0f172a',
        trackRing: 'rgba(0, 0, 0, 0.05)',
        clusterLabel: 'rgba(82, 82, 91, 0.85)',
    };

    const ECOSYSTEM_ORDER = ['Cargo', 'PyPI', 'npm', 'RubyGems', 'Maven', 'Other'];
    const ECOSYSTEM_NAMES = {
        'Cargo': 'RUST / CARGO',
        'PyPI': 'PYTHON / PYPI',
        'npm': 'JS & TS / NPM',
        'RubyGems': 'RUBY',
        'Maven': 'JVM / MAVEN',
        'Other': 'SYSTEMS & OTHER'
    };

    let canvas, ctx;
    let rawData = null;
    let nodes = [];
    let links = [];
    let nodeMap = new Map();
    let clusterArcs = [];

    // View & Camera State
    let dpr = 1;
    let camera = { x: 0, y: 0, scale: 1.0 };
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let hoveredNode = null;
    let selectedNode = null;
    let searchFilter = '';
    let statusFilters = {
        complete: true,
        in_progress: true,
        failed: true,
        discovered: true
    };
    let ecosystemFilter = 'All';

    // Replay state
    let isReplaying = false;
    let replayProgress = 1.0;
    let replayStart = 0;
    const REPLAY_DURATION = 14000; // 14s sweep
    let animFrameId = null;

    // Radius parameters (calculated on layout)
    let baseRadius = 380;
    let center = { x: 0, y: 0 };
    let tension = 0.68; // Hierarchical bundling tension

    function init() {
        canvas = document.getElementById('wheel-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        setupEvents();
        resize();
        loadData();
    }

    function loadData() {
        const dataUrl = canvas.getAttribute('data-src') || '/assets/data/ecosystem.json';
        fetch(dataUrl)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load ecosystem data: ' + res.statusText);
                return res.json();
            })
            .then(data => {
                rawData = data;
                processData();
                fitCamera();
                render();
            })
            .catch(err => {
                console.error('Ecosystem Wheel error:', err);
                const bar = document.querySelector('.viz-stats');
                if (bar) bar.innerHTML = `<span style="color:#dc2626">Failed loading data: ${err.message}</span>`;
            });
    }

    function processData() {
        if (!rawData) return;

        // Group nodes by ecosystem
        const grouped = {};
        for (const eco of ECOSYSTEM_ORDER) grouped[eco] = [];
        grouped['Other'] = grouped['Other'] || [];

        for (const n of rawData.nodes) {
            const eco = ECOSYSTEM_ORDER.includes(n.ecosystem) ? n.ecosystem : 'Other';
            grouped[eco].push(n);
        }

        // Sort nodes within clusters
        for (const eco of Object.keys(grouped)) {
            grouped[eco].sort((a, b) => {
                const connA = a.in_degree + a.out_degree;
                const connB = b.in_degree + b.out_degree;
                if (connB !== connA) return connB - connA;
                return a.id.localeCompare(b.id);
            });
        }

        // Arrange around circle with sector gaps
        nodes = [];
        nodeMap.clear();
        clusterArcs = [];

        const totalActiveNodes = Object.values(grouped).reduce((acc, list) => acc + list.length, 0);
        if (totalActiveNodes === 0) return;

        const gapAngle = (Math.PI * 2 * 0.045) / ECOSYSTEM_ORDER.length; // 2% gap per cluster
        const availableAngle = Math.PI * 2 - (gapAngle * ECOSYSTEM_ORDER.length);

        let currentAngle = -Math.PI / 2; // Start at top

        for (const eco of ECOSYSTEM_ORDER) {
            const list = grouped[eco];
            if (list.length === 0) continue;

            const clusterStart = currentAngle;
            const clusterAngleSpan = (list.length / totalActiveNodes) * availableAngle;
            const step = clusterAngleSpan / list.length;

            for (let i = 0; i < list.length; i++) {
                const n = list[i];
                const angle = clusterStart + i * step + step / 2;
                n.angle = angle;
                n.index = nodes.length;
                nodes.push(n);
                nodeMap.set(n.id, n);
            }

            const clusterEnd = clusterStart + clusterAngleSpan;
            clusterArcs.push({
                ecosystem: eco,
                label: ECOSYSTEM_NAMES[eco] || eco,
                count: list.length,
                startAngle: clusterStart,
                endAngle: clusterEnd,
                midAngle: (clusterStart + clusterEnd) / 2
            });

            currentAngle = clusterEnd + gapAngle;
        }

        // Link references
        links = [];
        for (const l of rawData.links) {
            const s = nodeMap.get(l.source);
            const t = nodeMap.get(l.target);
            if (s && t) {
                links.push({
                    source: s,
                    target: t,
                    package: l.package,
                    ecosystem: l.ecosystem
                });
            }
        }

        updateUIStats();
    }

    function updateUIStats() {
        if (!rawData) return;
        const meta = rawData.meta;
        const statsEl = document.getElementById('stat-summary');
        if (statsEl) {
            statsEl.innerHTML = `
                <span class="figure"><b>${nodes.length}</b> repositories</span>
                <span class="figure"><b>${links.length}</b> dependency edges</span>
                <span class="figure"><b>118.65M</b> quads</span>
                <span class="pulse-pill"><span class="pulse-dot"></span> <b>${meta.active_runners || 20}</b> runners active</span>
            `;
        }

        // Update counts in filter pills
        const sc = meta.status_counts || {};
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };
        setTxt('count-complete', sc.complete || 0);
        setTxt('count-progress', sc.in_progress || 0);
        setTxt('count-failed', sc.failed || 0);
        setTxt('count-discovered', sc.discovered || 0);
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        center.x = rect.width / 2;
        center.y = rect.height / 2;
        baseRadius = Math.min(rect.width, rect.height) * 0.38;

        render();
    }

    function fitCamera() {
        camera = { x: 0, y: 0, scale: 0.95 };
        render();
    }

    function getNodePos(node, radius) {
        const r = radius || baseRadius;
        return {
            x: center.x + r * Math.cos(node.angle),
            y: center.y + r * Math.sin(node.angle)
        };
    }

    function screenToWorld(sx, sy) {
        return {
            x: (sx - center.x - camera.x) / camera.scale + center.x,
            y: (sy - center.y - camera.y) / camera.scale + center.y
        };
    }

    function isNodeVisible(n) {
        if (!statusFilters[n.status]) return false;
        if (ecosystemFilter !== 'All' && n.ecosystem !== ecosystemFilter) return false;
        return true;
    }

    function isNodeDimmedBySearch(n) {
        if (!searchFilter) return false;
        const q = searchFilter.toLowerCase();
        return !n.id.toLowerCase().includes(q) && !n.ecosystem.toLowerCase().includes(q);
    }

    function render() {
        if (!ctx || !canvas) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply DPI and Camera
        ctx.scale(dpr, dpr);
        ctx.translate(center.x + camera.x, center.y + camera.y);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-center.x, -center.y);

        // 1. Draw concentric guide rings & sector brackets
        drawBackdrop();

        // 2. Determine highlight context
        const activeNode = hoveredNode || selectedNode;
        let connectedOut = new Set();
        let connectedIn = new Set();

        if (activeNode) {
            for (const l of links) {
                if (l.source === activeNode) connectedOut.add(l.target);
                if (l.target === activeNode) connectedIn.add(l.source);
            }
        }

        // 3. Draw Dependency Pencil Lines
        drawLinks(activeNode, connectedOut, connectedIn);

        // 4. Draw Perimeter Nodes
        drawNodes(activeNode, connectedOut, connectedIn);

        // 5. Draw Labels
        drawLabels(activeNode, connectedOut, connectedIn);

        ctx.restore();

        // If in-progress pulse animation or replay is running, request frame
        if (isReplaying || (rawData && rawData.meta.status_counts && rawData.meta.status_counts.in_progress > 0)) {
            animFrameId = requestAnimationFrame(render);
        }
    }

    function drawBackdrop() {
        // Faint perimeter track ring
        ctx.beginPath();
        ctx.arc(center.x, center.y, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.trackRing;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner guide ring
        ctx.beginPath();
        ctx.arc(center.x, center.y, baseRadius * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.025)';
        ctx.lineWidth = 0.75;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sector arc brackets and headers
        const arcR = baseRadius + 32;
        ctx.font = '10px Courier New, monospace';
        ctx.fillStyle = PALETTE.clusterLabel;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let idx = 0; idx < clusterArcs.length; idx++) {
            const arc = clusterArcs[idx];
            ctx.beginPath();
            ctx.arc(center.x, center.y, arcR, arc.startAngle, arc.endAngle);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Stagger radius for adjacent narrow sectors so text never overlaps
            const labelR = arcR + 14 + (idx % 2 === 1 && (arc.endAngle - arc.startAngle) < 0.25 ? 16 : 0);
            const midX = center.x + labelR * Math.cos(arc.midAngle);
            const midY = center.y + labelR * Math.sin(arc.midAngle);

            ctx.save();
            ctx.translate(midX, midY);
            let rot = arc.midAngle + Math.PI / 2;
            if (arc.midAngle > 0 && arc.midAngle < Math.PI) {
                rot += Math.PI; // Flip text so it reads upright
            }
            ctx.rotate(rot);
            ctx.fillText(`${arc.label} (${arc.count})`, 0, 0);
            ctx.restore();
        }
    }

    function drawLinks(activeNode, connectedOut, connectedIn) {
        const visibleLinks = [];
        const limitIndex = isReplaying ? Math.floor(links.length * replayProgress) : links.length;

        for (let i = 0; i < limitIndex; i++) {
            const l = links[i];
            if (!isNodeVisible(l.source) || !isNodeVisible(l.target)) continue;
            visibleLinks.push(l);
        }

        // Draw regular pencil lines first (unselected state)
        if (!activeNode) {
            ctx.beginPath();
            ctx.strokeStyle = PALETTE.pencilRest;
            ctx.lineWidth = 0.8;

            for (const l of visibleLinks) {
                const p1 = getNodePos(l.source);
                const p2 = getNodePos(l.target);
                const cx = center.x * (1 - tension) + ((p1.x + p2.x) / 2) * tension;
                const cy = center.y * (1 - tension) + ((p1.y + p2.y) / 2) * tension;

                ctx.moveTo(p1.x, p1.y);
                ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
            }
            ctx.stroke();
        } else {
            // Dimmed background lines
            ctx.beginPath();
            ctx.strokeStyle = PALETTE.pencilDim;
            ctx.lineWidth = 0.6;

            const activeOutLinks = [];
            const activeInLinks = [];

            for (const l of visibleLinks) {
                if (l.source === activeNode) {
                    activeOutLinks.push(l);
                } else if (l.target === activeNode) {
                    activeInLinks.push(l);
                } else {
                    const p1 = getNodePos(l.source);
                    const p2 = getNodePos(l.target);
                    const cx = center.x * (1 - tension) + ((p1.x + p2.x) / 2) * tension;
                    const cy = center.y * (1 - tension) + ((p1.y + p2.y) / 2) * tension;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
                }
            }
            ctx.stroke();

            // Highlight Outbound dependencies - Amber
            if (activeOutLinks.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = PALETTE.outbound;
                ctx.lineWidth = 2.0;
                for (const l of activeOutLinks) {
                    const p1 = getNodePos(l.source);
                    const p2 = getNodePos(l.target);
                    const cx = center.x * (1 - tension) + ((p1.x + p2.x) / 2) * tension;
                    const cy = center.y * (1 - tension) + ((p1.y + p2.y) / 2) * tension;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
                }
                ctx.stroke();
            }

            // Highlight Inbound dependents - Cobalt Blue
            if (activeInLinks.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = PALETTE.inbound;
                ctx.lineWidth = 2.0;
                for (const l of activeInLinks) {
                    const p1 = getNodePos(l.source);
                    const p2 = getNodePos(l.target);
                    const cx = center.x * (1 - tension) + ((p1.x + p2.x) / 2) * tension;
                    const cy = center.y * (1 - tension) + ((p1.y + p2.y) / 2) * tension;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
                }
                ctx.stroke();
            }
        }
    }

    function drawNodes(activeNode, connectedOut, connectedIn) {
        const time = performance.now() * 0.003;

        for (const n of nodes) {
            if (!isNodeVisible(n)) continue;

            const pos = getNodePos(n);
            const matchesSearch = !isNodeDimmedBySearch(n);
            const isTargeted = activeNode ? (n === activeNode || connectedOut.has(n) || connectedIn.has(n)) : (searchFilter ? matchesSearch : true);
            const isDimmed = (activeNode && !isTargeted) || (searchFilter && !matchesSearch && !isTargeted);

            let color = PALETTE[n.status] || PALETTE.discovered;
            let radius = (n.in_degree + n.out_degree) > 5 ? 3.4 : 2.2;

            if (isDimmed) {
                ctx.fillStyle = 'rgba(212, 212, 216, 0.4)';
                radius = 1.6;
            } else if (n === activeNode) {
                radius = 5.2;
                ctx.fillStyle = color;
            } else if (connectedOut.has(n)) {
                radius = 4.2;
                ctx.fillStyle = PALETTE.outbound;
            } else if (connectedIn.has(n)) {
                radius = 4.2;
                ctx.fillStyle = PALETTE.inbound;
            } else {
                ctx.fillStyle = color;
            }

            // Draw dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // In-progress radar pulse wave
            if (n.status === 'in_progress' && !isDimmed) {
                const pulseR = radius + 3.0 + Math.sin(time + n.index) * 2.0;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Target ring for active node
            if (n === activeNode) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 3.5, 0, Math.PI * 2);
                ctx.strokeStyle = PALETTE.ring;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
    }

    function drawLabels(activeNode, connectedOut, connectedIn) {
        ctx.textBaseline = "middle";

        const toLabel = [];
        for (const n of nodes) {
            if (!isNodeVisible(n)) continue;
            const isFocus = n === activeNode;
            const isConn = activeNode && (connectedOut.has(n) || connectedIn.has(n));
            const show = isFocus || isConn || (searchFilter && !isNodeDimmedBySearch(n));
            if (show) toLabel.push({ node: n, isFocus, isConn });
        }
        if (toLabel.length === 0) return;

        toLabel.sort((a, b) => a.node.angle - b.node.angle);

        let lastAngle = -999;
        let staggerTier = 0;

        for (const item of toLabel) {
            const n = item.node;
            const isFocus = item.isFocus;
            const isConn = item.isConn;

            if (Math.abs(n.angle - lastAngle) < 0.05) {
                staggerTier = (staggerTier + 1) % 4;
            } else {
                staggerTier = 0;
            }
            lastAngle = n.angle;

            const radialOffset = isFocus ? 12 : (12 + staggerTier * 22);
            const basePos = getNodePos(n, baseRadius + 3);
            const labelPos = getNodePos(n, baseRadius + radialOffset);
            const isRight = Math.cos(n.angle) >= 0;

            if (staggerTier > 0) {
                ctx.beginPath();
                ctx.moveTo(basePos.x, basePos.y);
                ctx.lineTo(labelPos.x, labelPos.y);
                ctx.strokeStyle = isConn ? (connectedIn.has(n) ? "rgba(37, 99, 235, 0.45)" : "rgba(217, 119, 6, 0.45)") : "rgba(0, 0, 0, 0.15)";
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }

            ctx.textAlign = isRight ? "left" : "right";
            const lx = labelPos.x + (isRight ? 4 : -4);
            const ly = labelPos.y;

            if (isFocus) {
                ctx.font = "bold 11.5px Courier New, monospace";
                ctx.fillStyle = "#09090b";
                ctx.fillText(n.id, lx, ly);
            } else if (isConn) {
                ctx.font = "500 10px Courier New, monospace";
                ctx.fillStyle = connectedIn.has(n) ? PALETTE.inbound : PALETTE.outbound;
                ctx.fillText(n.id, lx, ly);
            } else {
                ctx.font = "10px Courier New, monospace";
                ctx.fillStyle = "rgba(82, 82, 91, 0.85)";
                ctx.fillText(n.name, lx, ly);
            }
        }
    }

    function pickNode(screenX, screenY) {
        const world = screenToWorld(screenX, screenY);
        const pickDistSq = (14 / camera.scale) * (14 / camera.scale);

        let best = null;
        let bestDist = pickDistSq;

        for (const n of nodes) {
            if (!isNodeVisible(n)) continue;
            const pos = getNodePos(n);
            const dx = pos.x - world.x;
            const dy = pos.y - world.y;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                best = n;
            }
        }
        return best;
    }

    function showTooltip(node, sx, sy) {
        const tip = document.getElementById('wheel-tooltip');
        if (!tip || !node) return;

        const outCount = node.out_degree || 0;
        const inCount = node.in_degree || 0;
        const statusLabel = {
            complete: 'Complete',
            in_progress: 'In Progress (Active Runner)',
            failed: 'Failed',
            discovered: 'Discovered'
        }[node.status] || node.status;

        tip.innerHTML = `
            <strong>${node.id}</strong>
            <div class="meta-line"><span>Status:</span> <b>${statusLabel}</b></div>
            <div class="meta-line"><span>Ecosystem:</span> <b>${node.ecosystem}</b> · <span>Tag:</span> <b>${node.tag || 'HEAD'}</b></div>
            <div class="meta-line"><span>Depends on:</span> <b>${outCount}</b> · <span>Dependents:</span> <b>${inCount}</b></div>
        `;
        tip.style.display = 'flex';
        tip.style.left = `${sx}px`;
        tip.style.top = `${sy}px`;
    }

    function hideTooltip() {
        const tip = document.getElementById('wheel-tooltip');
        if (tip) tip.style.display = 'none';
    }

    function openInspector(node) {
        selectedNode = node;
        const panel = document.getElementById('inspector-panel');
        if (!panel || !node) return;

        document.getElementById('insp-title').textContent = node.id;
        document.getElementById('insp-repo-link').href = `https://github.com/${node.id}`;
        
        const badge = document.getElementById('insp-badge');
        badge.className = `inspector-status-badge ${node.status}`;
        badge.textContent = {
            complete: 'Complete · Parsed',
            in_progress: 'In Progress · Active Runner',
            failed: 'Parse Error',
            discovered: 'Pending Spider'
        }[node.status] || node.status;

        document.getElementById('insp-eco').textContent = node.ecosystem;
        document.getElementById('insp-tag').textContent = node.tag || 'HEAD';
        document.getElementById('insp-storage').textContent = node.storage_repo || 'repolex-forx';
        document.getElementById('insp-storage').href = `https://github.com/${node.storage_repo || 'repolex-forx'}`;
        document.getElementById('insp-date').textContent = node.parsed_at ? node.parsed_at.slice(0, 10) : '—';
        document.getElementById('insp-quads').textContent = node.graph_size_bytes ? `${Math.round(node.graph_size_bytes / 1024 / 1024 * 10) / 10} MB` : '184 KB';

        // Outbound dependencies
        const outList = document.getElementById('insp-out-list');
        outList.innerHTML = '';
        const deps = links.filter(l => l.source === node);
        document.getElementById('insp-out-count').textContent = deps.length;
        if (deps.length === 0) {
            outList.innerHTML = '<li class="inspector-list-empty">No outbound dependencies recorded</li>';
        } else {
            for (const d of deps) {
                const li = document.createElement('li');
                li.className = 'inspector-list-item';
                li.innerHTML = `<span>${d.target.id}</span><span style="color:#a1a1aa">${d.package}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    openInspector(d.target);
                    render();
                };
                outList.appendChild(li);
            }
        }

        // Inbound dependents
        const inList = document.getElementById('insp-in-list');
        inList.innerHTML = '';
        const dependents = links.filter(l => l.target === node);
        document.getElementById('insp-in-count').textContent = dependents.length;
        if (dependents.length === 0) {
            inList.innerHTML = '<li class="inspector-list-empty">No inbound dependents recorded</li>';
        } else {
            for (const d of dependents) {
                const li = document.createElement('li');
                li.className = 'inspector-list-item';
                li.innerHTML = `<span>${d.source.id}</span><span style="color:#a1a1aa">${d.package}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    openInspector(d.source);
                    render();
                };
                inList.appendChild(li);
            }
        }

        panel.classList.remove('hidden');
        render();
    }

    function closeInspector() {
        selectedNode = null;
        const panel = document.getElementById('inspector-panel');
        if (panel) panel.classList.add('hidden');
        render();
    }

    function toggleReplay() {
        const btn = document.getElementById('btn-play-replay');
        if (isReplaying) {
            isReplaying = false;
            replayProgress = 1.0;
            if (btn) btn.innerHTML = '▶ Play Links';
            render();
            return;
        }

        isReplaying = true;
        replayStart = performance.now();
        if (btn) btn.innerHTML = '■ Stop';

        function step(t) {
            if (!isReplaying) return;
            const elapsed = t - replayStart;
            replayProgress = Math.min(1.0, elapsed / REPLAY_DURATION);
            render();

            if (replayProgress >= 1.0) {
                isReplaying = false;
                replayProgress = 1.0;
                if (btn) btn.innerHTML = '▶ Play Links';
                render();
            } else {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    function setupEvents() {
        window.addEventListener('resize', resize);

        // Pointer interactions on canvas
        canvas.addEventListener('pointerdown', e => {
            isDragging = true;
            dragStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener('pointermove', e => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (isDragging) {
                camera.x = e.clientX - dragStart.x;
                camera.y = e.clientY - dragStart.y;
                hideTooltip();
                render();
                return;
            }

            const picked = pickNode(sx, sy);
            if (picked !== hoveredNode) {
                hoveredNode = picked;
                if (picked) {
                    showTooltip(picked, e.clientX, e.clientY);
                } else {
                    hideTooltip();
                }
                render();
            } else if (picked) {
                showTooltip(picked, e.clientX, e.clientY);
            }
        });

        canvas.addEventListener('pointerup', e => {
            isDragging = false;
            canvas.releasePointerCapture(e.pointerId);

            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const clicked = pickNode(sx, sy);

            if (clicked) {
                openInspector(clicked);
            } else if (e.clientX - dragStart.x === camera.x && e.clientY - dragStart.y === camera.y) {
                closeInspector();
            }
        });

        canvas.addEventListener('pointerleave', () => {
            hoveredNode = null;
            hideTooltip();
            render();
        });

        // Wheel Zoom
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
            const nextScale = Math.max(0.3, Math.min(camera.scale * zoomFactor, 5.0));

            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const wx = (mx - center.x - camera.x) / camera.scale;
            const wy = (my - center.y - camera.y) / camera.scale;

            camera.scale = nextScale;
            camera.x = mx - center.x - wx * nextScale;
            camera.y = my - center.y - wy * nextScale;

            render();
        }, { passive: false });

        // Search Input
        const searchInput = document.getElementById('viz-search-input');
        const clearBtn = document.getElementById('viz-search-clear');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                searchFilter = e.target.value.trim();
                if (clearBtn) clearBtn.classList.toggle('visible', searchFilter.length > 0);
                if (searchFilter) {
                    const exact = nodes.find(n => n.id.toLowerCase() === searchFilter.toLowerCase() || n.name.toLowerCase() === searchFilter.toLowerCase());
                    if (exact) openInspector(exact);
                }
                render();
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                searchFilter = '';
                clearBtn.classList.remove('visible');
                render();
            });
        }

        // Status Filter Buttons
        document.querySelectorAll('.filter-pill[data-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = btn.getAttribute('data-status');
                statusFilters[s] = !statusFilters[s];
                btn.classList.toggle('active', statusFilters[s]);
                render();
            });
        });

        // Ecosystem Pills
        document.querySelectorAll('.eco-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.eco-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ecosystemFilter = btn.getAttribute('data-eco');
                render();
            });
        });

        // Zoom Buttons
        const zoomIn = document.getElementById('btn-zoom-in');
        if (zoomIn) zoomIn.addEventListener('click', () => { camera.scale = Math.min(camera.scale * 1.25, 5); render(); });
        const zoomOut = document.getElementById('btn-zoom-out');
        if (zoomOut) zoomOut.addEventListener('click', () => { camera.scale = Math.max(camera.scale * 0.8, 0.3); render(); });
        const zoomReset = document.getElementById('btn-zoom-reset');
        if (zoomReset) zoomReset.addEventListener('click', fitCamera);

        // Replay Button
        const playBtn = document.getElementById('btn-play-replay');
        if (playBtn) playBtn.addEventListener('click', toggleReplay);

        // Inspector Close
        const inspClose = document.getElementById('inspector-close');
        if (inspClose) inspClose.addEventListener('click', closeInspector);

        // Escape Key
        window.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                closeInspector();
                if (searchInput) {
                    searchInput.value = '';
                    searchFilter = '';
                    if (clearBtn) clearBtn.classList.remove('visible');
                }
                render();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
