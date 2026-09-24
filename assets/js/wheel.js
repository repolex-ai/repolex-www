/**
 * Repolex Ecosystem Wheel
 * Circular Dependency Wheel with Fine Architectural Pencil Lines
 * Inspired by Selkie's git-lex viz
 *
 * Every repository repolex knows about, on one ring, grouped by language
 * ecosystem, with its dependency links drawn as pencil lines across the
 * middle. Built by kira (2026-09-17); reworked so the wheel is the whole
 * page (goodlux, 2026-09-24):
 *
 *  - It always fits. There is no zoom and no pan: the ring is sized to its
 *    area on load and on every resize, so there is nothing to get lost in
 *    and no "fit view" to press.
 *  - Clicking a language spreads it around the entire ring, so its links
 *    open up across the full circle instead of bunching in one sector, and
 *    every repository in it is named. Clicking it again, the "all languages"
 *    button, or Escape folds it back.
 *  - The side panel is fixed: controls, counts and the selected repository
 *    keep their place instead of floating over the wheel.
 */

(function () {
    'use strict';

    const PALETTE = {
        pencilRest: 'rgba(22, 26, 38, 0.10)',
        pencilDim: 'rgba(228, 231, 238, 0.22)',
        outbound: 'rgba(217, 119, 6, 0.88)',     // amber
        inbound: 'rgba(37, 99, 235, 0.92)',      // cobalt
        complete: '#16a34a',
        in_progress: '#d97706',
        failed: '#dc2626',
        discovered: '#94a3b8',
        ring: '#0f172a',
        trackRing: 'rgba(0, 0, 0, 0.05)',
        clusterLabel: 'rgba(82, 82, 91, 0.85)',
    };

    const ECOSYSTEM_ORDER = ['Cargo', 'PyPI', 'npm', 'Go', 'RubyGems', 'Maven', 'Other'];
    const ECOSYSTEM_NAMES = {
        Cargo: 'RUST / CARGO',
        PyPI: 'PYTHON / PYPI',
        npm: 'JS & TS / NPM',
        Go: 'GO',
        RubyGems: 'RUBY',
        Maven: 'JVM / MAVEN',
        Other: 'SYSTEMS & OTHER',
    };

    const FONT = 'Courier New, monospace';
    const TENSION = 0.68;           // how hard links bend toward the centre
    const GAP_SHARE = 0.045;        // share of the ring left as gaps between languages
    const TWEEN_MS = 750;           // expand / fold animation
    const REPLAY_MS = 14000;        // "play links" sweep
    // Room outside the ring. Folded, only the language names sit there. A
    // language spread round the whole ring names every repository, and those
    // names need real room, so the ring shrinks to make it.
    const MARGIN_FOLDED = 64;
    const MARGIN_SPREAD = 130;

    let canvas, ctx, stage;
    let rawData = null;
    let nodes = [];
    let links = [];
    const nodeMap = new Map();
    let groups = [];                // [{ eco, label, nodes }]
    let arcs = [];                  // sector arcs, animated with the nodes

    let dpr = 1;
    let width = 0, height = 0;
    const center = { x: 0, y: 0 };
    let radius = 300;
    let margin = MARGIN_FOLDED;

    let hoveredNode = null;
    let selectedNode = null;
    let hoveredEco = null;
    let focusEco = null;            // the language spread round the ring, or null
    let searchFilter = '';
    const statusFilters = { complete: true, in_progress: true, failed: true, discovered: true };

    let tween = null;               // one layout animation at a time
    let isReplaying = false;
    let replayProgress = 1.0;
    let replayStart = 0;

    // ---------------------------------------------------------------- setup

    function init() {
        canvas = document.getElementById('wheel-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        stage = canvas.parentElement;
        setupEvents();
        new ResizeObserver(resize).observe(stage);
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
                applyLayout(false);
            })
            .catch(err => {
                console.error('Ecosystem Wheel error:', err);
                const bar = document.getElementById('stat-summary');
                if (bar) bar.innerHTML = `<span style="color:#dc2626">Failed loading data: ${err.message}</span>`;
            });
    }

    function processData() {
        const grouped = {};
        for (const eco of ECOSYSTEM_ORDER) grouped[eco] = [];
        for (const n of rawData.nodes) {
            const eco = ECOSYSTEM_ORDER.includes(n.ecosystem) ? n.ecosystem : 'Other';
            n.group = eco;
            n.angle = 0;
            n.alpha = 1;
            grouped[eco].push(n);
        }
        // Most-connected first within a language, so the busy repositories
        // sit together and their links read as one bundle.
        for (const eco of ECOSYSTEM_ORDER) {
            grouped[eco].sort((a, b) => {
                const d = (b.in_degree + b.out_degree) - (a.in_degree + a.out_degree);
                return d !== 0 ? d : a.id.localeCompare(b.id);
            });
        }
        groups = ECOSYSTEM_ORDER
            .filter(eco => grouped[eco].length)
            .map(eco => ({ eco, label: ECOSYSTEM_NAMES[eco] || eco, nodes: grouped[eco] }));

        nodes = [];
        nodeMap.clear();
        for (const g of groups) {
            for (const n of g.nodes) {
                n.index = nodes.length;
                nodes.push(n);
                nodeMap.set(n.id, n);
            }
        }
        links = [];
        for (const l of rawData.links) {
            const s = nodeMap.get(l.source);
            const t = nodeMap.get(l.target);
            if (s && t) links.push({ source: s, target: t, package: l.package });
        }
        updateUIStats();
    }

    function formatCount(n) {
        if (!n) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return String(n);
    }

    function updateUIStats() {
        const meta = rawData.meta;
        const statsEl = document.getElementById('stat-summary');
        if (statsEl) {
            const when = meta.generated_at ? meta.generated_at.slice(0, 10) : 'unknown';
            statsEl.innerHTML = `
                <span class="figure"><b>${nodes.length}</b> repositories</span>
                <span class="figure"><b>${links.length}</b> dependency links</span>
                <span class="figure"><b>${formatCount(meta.total_quads)}</b> quads</span>
                <span class="figure asof" title="The wheel is a snapshot. This is when it was taken.">snapshot of ${when}</span>
            `;
        }
        const sc = meta.status_counts || {};
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };
        setTxt('count-complete', sc.complete || 0);
        setTxt('count-progress', sc.in_progress || 0);
        setTxt('count-failed', sc.failed || 0);
        setTxt('count-discovered', sc.discovered || 0);

        const langs = document.getElementById('lang-list');
        if (langs) {
            langs.innerHTML = '';
            for (const g of groups) {
                const b = document.createElement('button');
                b.className = 'lang-pill';
                b.dataset.eco = g.eco;
                b.innerHTML = `<span>${g.label}</span><b>${g.nodes.length}</b>`;
                b.addEventListener('click', () => setFocus(focusEco === g.eco ? null : g.eco));
                b.addEventListener('pointerenter', () => { hoveredEco = g.eco; requestRender(); });
                b.addEventListener('pointerleave', () => { hoveredEco = null; requestRender(); });
                langs.appendChild(b);
            }
        }
    }

    // ---------------------------------------------------------------- layout

    /** Where every node and arc belongs, for the current focus. */
    function targetLayout() {
        const to = new Map();
        const arcsTo = [];
        const TAU = Math.PI * 2;
        const top = -Math.PI / 2;

        // The folded layout is always computed: it is where a spread
        // language's neighbours stay while they fade, and what folding
        // returns to.
        const folded = new Map();
        const total = nodes.length;
        const gap = (TAU * GAP_SHARE) / groups.length;
        const avail = TAU - gap * groups.length;
        let cur = top;
        const foldedArcs = [];
        for (const g of groups) {
            const span = (g.nodes.length / total) * avail;
            const step = span / g.nodes.length;
            g.nodes.forEach((n, i) => folded.set(n, cur + i * step + step / 2));
            foldedArcs.push({ eco: g.eco, start: cur, end: cur + span });
            cur += span + gap;
        }

        if (focusEco) {
            // Spread in name order, not link order. Folded, the busiest
            // repositories sit together so their links read as one bundle;
            // spread, that same order piles every link into one corner of the
            // ring. By name, the hubs land all the way round and their links
            // cross the whole circle — and a name is easy to find.
            const g = groups.find(x => x.eco === focusEco);
            const byName = [...g.nodes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
            const step = TAU / byName.length;
            byName.forEach((n, i) => to.set(n, { angle: top + i * step + step / 2, alpha: 1 }));
            for (const n of nodes) if (n.group !== focusEco) to.set(n, { angle: folded.get(n), alpha: 0 });
            for (const a of foldedArcs) {
                arcsTo.push(a.eco === focusEco
                    ? { eco: a.eco, start: top, end: top + TAU, alpha: 1 }
                    : { ...a, alpha: 0 });
            }
        } else {
            for (const n of nodes) to.set(n, { angle: folded.get(n), alpha: 1 });
            for (const a of foldedArcs) arcsTo.push({ ...a, alpha: 1 });
        }
        return { to, arcsTo, margin: focusEco ? MARGIN_SPREAD : MARGIN_FOLDED };
    }

    /** Move to the layout for the current focus, animated or at once. */
    function applyLayout(animate) {
        const { to, arcsTo, margin: m } = targetLayout();
        if (!animate || !arcs.length) {
            for (const [n, t] of to) { n.angle = t.angle; n.alpha = t.alpha; }
            arcs = arcsTo.map(a => ({ ...a }));
            margin = m;
            fitRadius();
            tween = null;
            requestRender();
            return;
        }
        const from = new Map();
        for (const n of nodes) from.set(n, { angle: n.angle, alpha: n.alpha });
        tween = {
            start: performance.now(), from, to,
            arcsFrom: arcs.map(a => ({ ...a })), arcsTo,
            marginFrom: margin, marginTo: m,
        };
        requestRender();
    }

    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const lerp = (a, b, t) => a + (b - a) * t;

    function stepTween(now) {
        if (!tween) return;
        const raw = Math.min(1, (now - tween.start) / TWEEN_MS);
        const t = ease(raw);
        for (const [n, to] of tween.to) {
            const f = tween.from.get(n);
            n.angle = lerp(f.angle, to.angle, t);
            n.alpha = lerp(f.alpha, to.alpha, t);
        }
        arcs = tween.arcsTo.map((a, i) => {
            const f = tween.arcsFrom[i] || a;
            return {
                eco: a.eco,
                start: lerp(f.start, a.start, t),
                end: lerp(f.end, a.end, t),
                alpha: lerp(f.alpha, a.alpha, t),
            };
        });
        margin = lerp(tween.marginFrom, tween.marginTo, t);
        fitRadius();
        if (raw >= 1) tween = null;
    }

    function fitRadius() {
        radius = Math.max(60, Math.min(width, height) / 2 - margin);
    }

    function resize() {
        const rect = stage.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        center.x = width / 2;
        center.y = height / 2;
        fitRadius();
        requestRender();
    }

    function setFocus(eco) {
        focusEco = eco;
        const back = document.getElementById('btn-all-languages');
        if (back) back.classList.toggle('hidden', !eco);
        document.querySelectorAll('.lang-pill').forEach(b => b.classList.toggle('on', b.dataset.eco === eco));
        // A selection in a language that is about to fade would leave its
        // highlighted links pointing at nothing.
        if (eco && selectedNode && selectedNode.group !== eco) closeInspector();
        hoveredEco = null;
        applyLayout(true);
    }

    // ---------------------------------------------------------------- render

    let frameQueued = false;
    function requestRender() {
        if (frameQueued) return;
        frameQueued = true;
        requestAnimationFrame(frame);
    }

    /** One frame loop. It keeps running only while something moves: a
     *  layout tween, the replay, or an in-progress repository's pulse. The
     *  old loop was re-armed by every call to render, so each mouse move
     *  started another chain of frames. */
    function frame(now) {
        frameQueued = false;
        stepTween(now);
        if (isReplaying) {
            replayProgress = Math.min(1, (now - replayStart) / REPLAY_MS);
            if (replayProgress >= 1) stopReplay();
        }
        render(now);
        const pulsing = nodes.some(n => n.status === 'in_progress' && n.alpha > 0.05 && isNodeVisible(n));
        if (tween || isReplaying || pulsing) requestRender();
    }

    function nodePos(n, r) {
        const rr = r ?? radius;
        return { x: center.x + rr * Math.cos(n.angle), y: center.y + rr * Math.sin(n.angle) };
    }

    function isNodeVisible(n) {
        return statusFilters[n.status] !== false;
    }

    function matchesSearch(n) {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return n.id.toLowerCase().includes(q) || n.ecosystem.toLowerCase().includes(q);
    }

    function render(now) {
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        if (!nodes.length) return;

        const active = hoveredNode || selectedNode;
        const out = new Set(), inc = new Set();
        if (active) {
            for (const l of links) {
                if (l.source === active) out.add(l.target);
                if (l.target === active) inc.add(l.source);
            }
        }
        drawBackdrop();
        drawLinks(active);
        drawNodes(active, out, inc, now);
        if (focusEco && !tween) drawSpreadLabels(active, out, inc);
        drawFocusLabels(active, out, inc);
    }

    function drawBackdrop() {
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.trackRing;
        ctx.lineWidth = 1;
        ctx.stroke();

        const arcR = radius + 22;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        arcs.forEach((a, idx) => {
            if (a.alpha < 0.02) return;
            const hot = hoveredEco === a.eco;
            ctx.globalAlpha = a.alpha;
            ctx.beginPath();
            ctx.arc(center.x, center.y, arcR, a.start, a.end);
            ctx.strokeStyle = hot ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = hot ? 2 : 1;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Spread, the language is named in the side panel; its
            // repository names take the rim.
            if (focusEco) return;

            const g = groups.find(x => x.eco === a.eco);
            const mid = (a.start + a.end) / 2;
            const narrow = (a.end - a.start) < 0.25;
            const labelR = arcR + 14 + (idx % 2 === 1 && narrow ? 16 : 0);
            ctx.save();
            ctx.globalAlpha = a.alpha;
            ctx.translate(center.x + labelR * Math.cos(mid), center.y + labelR * Math.sin(mid));
            let rot = mid + Math.PI / 2;
            const norm = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (norm > 0 && norm < Math.PI) rot += Math.PI; // keep text upright
            ctx.rotate(rot);
            ctx.font = `${hot ? 'bold ' : ''}10px ${FONT}`;
            ctx.fillStyle = hot ? '#09090b' : PALETTE.clusterLabel;
            ctx.fillText(`${g.label} (${g.nodes.length})`, 0, 0);
            ctx.restore();
        });
    }

    function curve(l) {
        const p1 = nodePos(l.source), p2 = nodePos(l.target);
        const cx = center.x * (1 - TENSION) + ((p1.x + p2.x) / 2) * TENSION;
        const cy = center.y * (1 - TENSION) + ((p1.y + p2.y) / 2) * TENSION;
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
    }

    function drawLinks(active) {
        const limit = isReplaying ? Math.floor(links.length * replayProgress) : links.length;
        const shown = [];
        for (let i = 0; i < limit; i++) {
            const l = links[i];
            if (!isNodeVisible(l.source) || !isNodeVisible(l.target)) continue;
            const a = Math.min(l.source.alpha, l.target.alpha);
            if (a >= 0.02) shown.push([l, a]);
        }

        // One stroke per opacity band rather than one per link: links only
        // differ in opacity while a language is fading in or out.
        const strokeBatch = (items, style, w) => {
            if (!items.length) return;
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            const bands = new Map();
            for (const [l, a] of items) {
                const k = Math.round(a * 10);
                if (!bands.has(k)) bands.set(k, []);
                bands.get(k).push(l);
            }
            for (const [k, ls] of bands) {
                ctx.globalAlpha = k / 10;
                ctx.beginPath();
                for (const l of ls) curve(l);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        };

        if (!active) {
            strokeBatch(shown, PALETTE.pencilRest, focusEco ? 0.9 : 0.8);
            return;
        }
        strokeBatch(shown.filter(([l]) => l.source !== active && l.target !== active), PALETTE.pencilDim, 0.6);
        strokeBatch(shown.filter(([l]) => l.source === active), PALETTE.outbound, 2);
        strokeBatch(shown.filter(([l]) => l.target === active), PALETTE.inbound, 2);
    }

    function drawNodes(active, out, inc, now) {
        const time = (now || performance.now()) * 0.003;
        for (const n of nodes) {
            if (!isNodeVisible(n) || n.alpha < 0.02) continue;
            const pos = nodePos(n);
            const hit = matchesSearch(n);
            const targeted = active ? (n === active || out.has(n) || inc.has(n)) : hit;
            const dimmed = (active && !targeted) || (searchFilter && !hit && !targeted);

            let r = (n.in_degree + n.out_degree) > 5 ? 3.4 : 2.2;
            if (focusEco) r += 1;   // spread, there is room, and a bigger target
            let fill = PALETTE[n.status] || PALETTE.discovered;
            if (dimmed) { fill = 'rgba(212, 212, 216, 0.4)'; r = 1.6; }
            else if (n === active) r = 5.2;
            else if (out.has(n)) { r = 4.2; fill = PALETTE.outbound; }
            else if (inc.has(n)) { r = 4.2; fill = PALETTE.inbound; }

            ctx.globalAlpha = n.alpha;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fill();

            if (n.status === 'in_progress' && !dimmed) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + 3 + Math.sin(time + n.index) * 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            if (n === active) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + 3.5, 0, Math.PI * 2);
                ctx.strokeStyle = PALETTE.ring;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    /** Spread round the ring, every repository gets its name, radially. The
     *  font follows the spacing so neighbours never overlap, and names are
     *  cut to the room outside the ring. */
    function drawSpreadLabels(active, out, inc) {
        const g = groups.find(x => x.eco === focusEco);
        if (!g) return;
        const spacing = (2 * Math.PI * radius) / g.nodes.length;
        const size = Math.min(10, spacing * 0.9);
        if (size < 5) return;
        ctx.font = `${size}px ${FONT}`;
        ctx.textBaseline = 'middle';
        const room = MARGIN_SPREAD - 18;
        for (const n of g.nodes) {
            if (!isNodeVisible(n)) continue;
            const involved = active && (n === active || out.has(n) || inc.has(n));
            if (involved) continue; // named by drawFocusLabels, in colour
            const dim = (active && !involved) || (searchFilter && !matchesSearch(n));
            let text = n.name;
            while (text.length > 3 && ctx.measureText(text).width > room) text = text.slice(0, -2);
            if (text !== n.name) text += '…';
            const p = nodePos(n, radius + 8);
            const right = Math.cos(n.angle) >= 0;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(right ? n.angle : n.angle + Math.PI);
            ctx.textAlign = right ? 'left' : 'right';
            ctx.fillStyle = dim ? 'rgba(161, 161, 170, 0.45)' : 'rgba(63, 63, 70, 0.9)';
            if (n === hoveredNode) ctx.fillStyle = '#09090b';
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
    }

    /** Names for the repository under the pointer (or selected) and every
     *  repository it links to, staggered so close neighbours stay legible. */
    function drawFocusLabels(active, out, inc) {
        const list = [];
        for (const n of nodes) {
            if (!isNodeVisible(n) || n.alpha < 0.5) continue;
            const isFocus = n === active;
            const isConn = active && (out.has(n) || inc.has(n));
            const bySearch = !focusEco && searchFilter && matchesSearch(n);
            if (isFocus || isConn || bySearch) list.push({ n, isFocus, isConn });
        }
        if (!list.length) return;
        list.sort((a, b) => a.n.angle - b.n.angle);

        ctx.textBaseline = 'middle';
        let last = -999, tier = 0;
        for (const { n, isFocus, isConn } of list) {
            tier = Math.abs(n.angle - last) < 0.05 ? (tier + 1) % 4 : 0;
            last = n.angle;
            const off = isFocus ? 12 : 12 + tier * 22;
            const base = nodePos(n, radius + 3);
            const at = nodePos(n, radius + off);
            const right = Math.cos(n.angle) >= 0;
            if (tier > 0) {
                ctx.beginPath();
                ctx.moveTo(base.x, base.y);
                ctx.lineTo(at.x, at.y);
                ctx.strokeStyle = isConn ? (inc.has(n) ? 'rgba(37, 99, 235, 0.45)' : 'rgba(217, 119, 6, 0.45)') : 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
            ctx.textAlign = right ? 'left' : 'right';
            const lx = at.x + (right ? 4 : -4);
            // A white halo keeps a name readable over the pencil lines.
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            let text = n.name, font = `10px ${FONT}`, fill = 'rgba(82, 82, 91, 0.85)';
            if (isFocus) { text = n.id; font = `bold 11.5px ${FONT}`; fill = '#09090b'; }
            else if (isConn) { text = n.id; font = `500 10px ${FONT}`; fill = inc.has(n) ? PALETTE.inbound : PALETTE.outbound; }
            ctx.font = font;
            ctx.strokeText(text, lx, at.y);
            ctx.fillStyle = fill;
            ctx.fillText(text, lx, at.y);
        }
    }

    // ---------------------------------------------------------------- picking

    function pickNode(sx, sy) {
        // Spread, a repository owns its whole wedge — dot, name and the gap
        // between — so it can be hit anywhere from just inside the ring out
        // to the end of its name. Dots a few pixels apart were too hard to
        // land on (goodlux, 2026-09-24).
        if (focusEco && !tween) {
            const dx = sx - center.x, dy = sy - center.y;
            const r = Math.hypot(dx, dy);
            if (r > radius - 24 && r < radius + margin) {
                const a = Math.atan2(dy, dx);
                const wrap = d => Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
                let best = null, bestD = Infinity;
                for (const n of nodes) {
                    if (n.group !== focusEco || !isNodeVisible(n)) continue;
                    const d = wrap(a - n.angle);
                    if (d < bestD) { bestD = d; best = n; }
                }
                return best;
            }
        }
        let best = null, bestD = 14 * 14;
        for (const n of nodes) {
            if (!isNodeVisible(n) || n.alpha < 0.5) continue;
            const p = nodePos(n);
            const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
            if (d < bestD) { bestD = d; best = n; }
        }
        return best;
    }

    /** The language whose band outside the ring is under the pointer. */
    function pickEco(sx, sy) {
        const dx = sx - center.x, dy = sy - center.y;
        const r = Math.hypot(dx, dy);
        // Spread, the band outside the ring belongs to the repositories'
        // names, so it no longer folds the language: a near miss on a name
        // used to collapse the whole view.
        if (focusEco) return null;
        if (r < radius + 8 || r > radius + margin) return null;
        const a = Math.atan2(dy, dx);
        for (const arc of arcs) {
            if (arc.alpha < 0.5) continue;
            for (const k of [-1, 0, 1]) {
                const aa = a + k * 2 * Math.PI;
                if (aa >= arc.start && aa <= arc.end) return arc.eco;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- side panel

    function showTooltip(node, x, y) {
        const tip = document.getElementById('wheel-tooltip');
        if (!tip || !node) return;
        const statusLabel = {
            complete: 'Complete', in_progress: 'In Progress (Active Runner)',
            failed: 'Failed', discovered: 'Discovered',
        }[node.status] || node.status;
        tip.innerHTML = `
            <strong>${node.id}</strong>
            <div class="meta-line"><span>Status:</span> <b>${statusLabel}</b></div>
            <div class="meta-line"><span>Ecosystem:</span> <b>${node.ecosystem}</b> · <span>Tag:</span> <b>${node.tag || 'HEAD'}</b></div>
            <div class="meta-line"><span>Depends on:</span> <b>${node.out_degree || 0}</b> · <span>Dependents:</span> <b>${node.in_degree || 0}</b></div>
        `;
        tip.style.display = 'flex';
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
        // Near the right or bottom edge the tip opens the other way, so it
        // never runs under the side panel or off the screen.
        tip.classList.toggle('flip-x', x > width - 340);
        tip.classList.toggle('flip-y', y > height - 140);
    }

    function hideTooltip() {
        const tip = document.getElementById('wheel-tooltip');
        if (tip) tip.style.display = 'none';
    }

    function fillList(listId, countId, items, other) {
        const list = document.getElementById(listId);
        list.innerHTML = '';
        document.getElementById(countId).textContent = items.length;
        if (!items.length) {
            list.innerHTML = '<li class="inspector-list-empty">None recorded</li>';
            return;
        }
        for (const l of items) {
            const target = other(l);
            const li = document.createElement('li');
            li.className = 'inspector-list-item';
            const name = document.createElement('span');
            name.textContent = target.id;
            const pkg = document.createElement('span');
            pkg.className = 'pkg';
            pkg.textContent = l.package || '';
            li.append(name, pkg);
            li.onclick = e => {
                e.stopPropagation();
                // Following a link out of the spread language brings the
                // whole ring back, or the repository would be invisible.
                if (focusEco && target.group !== focusEco) setFocus(null);
                openInspector(target);
            };
            list.appendChild(li);
        }
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
            complete: 'Complete · Parsed', in_progress: 'In Progress · Active Runner',
            failed: 'Parse Error', discovered: 'Pending Spider',
        }[node.status] || node.status;
        document.getElementById('insp-eco').textContent = node.ecosystem;
        document.getElementById('insp-tag').textContent = node.tag || 'HEAD';
        const storage = document.getElementById('insp-storage');
        storage.textContent = node.storage_repo || '—';
        storage.href = node.storage_repo ? `https://github.com/${node.storage_repo}` : '#';
        document.getElementById('insp-date').textContent = node.parsed_at ? node.parsed_at.slice(0, 10) : '—';
        document.getElementById('insp-quads').textContent = node.graph_size_bytes
            ? `${Math.round(node.graph_size_bytes / 1024 / 1024 * 10) / 10} MB` : '—';
        fillList('insp-out-list', 'insp-out-count', links.filter(l => l.source === node), l => l.target);
        fillList('insp-in-list', 'insp-in-count', links.filter(l => l.target === node), l => l.source);
        panel.classList.remove('empty');
        requestRender();
    }

    /** The panel keeps its place; with nothing selected it says so there. */
    function closeInspector() {
        selectedNode = null;
        const panel = document.getElementById('inspector-panel');
        if (panel) panel.classList.add('empty');
        requestRender();
    }

    // ---------------------------------------------------------------- replay

    function toggleReplay() {
        if (isReplaying) { stopReplay(); return; }
        isReplaying = true;
        replayStart = performance.now();
        const btn = document.getElementById('btn-play-replay');
        if (btn) btn.textContent = '■ Stop';
        requestRender();
    }

    function stopReplay() {
        isReplaying = false;
        replayProgress = 1;
        const btn = document.getElementById('btn-play-replay');
        if (btn) btn.textContent = '▶ Play Links';
        requestRender();
    }

    // ---------------------------------------------------------------- events

    function setupEvents() {
        const local = e => {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };

        canvas.addEventListener('pointermove', e => {
            const { x, y } = local(e);
            const picked = pickNode(x, y);
            const eco = picked ? null : pickEco(x, y);
            if (picked !== hoveredNode || eco !== hoveredEco) {
                hoveredNode = picked;
                hoveredEco = eco;
                requestRender();
            }
            canvas.style.cursor = picked || eco ? 'pointer' : 'default';
            if (picked) showTooltip(picked, x, y); else hideTooltip();
        });

        canvas.addEventListener('click', e => {
            const { x, y } = local(e);
            const node = pickNode(x, y);
            if (node) { openInspector(node); return; }
            const eco = pickEco(x, y);
            if (eco) { setFocus(focusEco === eco ? null : eco); return; }
            closeInspector();
        });

        canvas.addEventListener('pointerleave', () => {
            hoveredNode = null;
            hoveredEco = null;
            hideTooltip();
            requestRender();
        });

        const searchInput = document.getElementById('viz-search-input');
        const clearBtn = document.getElementById('viz-search-clear');
        const clearSearch = () => {
            if (searchInput) searchInput.value = '';
            searchFilter = '';
            if (clearBtn) clearBtn.classList.remove('visible');
            requestRender();
        };
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                searchFilter = e.target.value.trim();
                if (clearBtn) clearBtn.classList.toggle('visible', searchFilter.length > 0);
                if (searchFilter) {
                    const q = searchFilter.toLowerCase();
                    const exact = nodes.find(n => n.id.toLowerCase() === q || n.name.toLowerCase() === q);
                    if (exact) {
                        if (focusEco && exact.group !== focusEco) setFocus(null);
                        openInspector(exact);
                    }
                }
                requestRender();
            });
        }
        if (clearBtn) clearBtn.addEventListener('click', clearSearch);

        document.querySelectorAll('.filter-pill[data-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = btn.getAttribute('data-status');
                statusFilters[s] = !statusFilters[s];
                btn.classList.toggle('active', statusFilters[s]);
                requestRender();
            });
        });

        const back = document.getElementById('btn-all-languages');
        if (back) back.addEventListener('click', () => setFocus(null));

        const playBtn = document.getElementById('btn-play-replay');
        if (playBtn) playBtn.addEventListener('click', toggleReplay);

        const inspClose = document.getElementById('inspector-close');
        if (inspClose) inspClose.addEventListener('click', closeInspector);

        // Escape backs out one step at a time: the selection, then the
        // search, then the spread language.
        window.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (selectedNode) closeInspector();
            else if (searchFilter) clearSearch();
            else if (focusEco) setFocus(null);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
