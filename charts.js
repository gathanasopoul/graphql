// charts.js

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDateLabel(date) {
    return date.toISOString().slice(0, 10);
}

function getTxName(path) {
    if (!path) return "xp";
    const parts = path.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "xp";
}

function getTrackName(path) {
    if (!path) return "other";
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[2].startsWith("piscine-")) {
        return parts[2];
    }
    return parts[1] || parts[0] || "other";
}

function getTooltipEl() {
    if (typeof document === "undefined" || !document.body) return null;
    let tooltip = document.getElementById("chart-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "chart-tooltip";
        tooltip.className = "chart-tooltip hidden";
        tooltip.setAttribute("role", "tooltip");
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function showTooltip(title, rows, clientX, clientY) {
    const tooltip = getTooltipEl();
    if (!tooltip) return;

    tooltip.innerHTML = "";

    const titleEl = document.createElement("div");
    titleEl.className = "tooltip-title";
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);

    for (const [label, value] of rows) {
        const rowEl = document.createElement("div");
        rowEl.className = "tooltip-row";
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        const valStrong = document.createElement("strong");
        valStrong.textContent = value;
        rowEl.append(labelSpan, valStrong);
        tooltip.appendChild(rowEl);
    }

    tooltip.classList.remove("hidden");

    const margin = 14;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const rect = typeof tooltip.getBoundingClientRect === "function"
        ? tooltip.getBoundingClientRect()
        : { width: 200, height: 90 };

    let left = clientX + margin;
    let top = clientY + margin;

    if (left + rect.width + 8 > vw) {
        left = Math.max(8, clientX - rect.width - margin);
    }
    if (top + rect.height + 8 > vh) {
        top = Math.max(8, clientY - rect.height - margin);
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

export function hideTooltip() {
    if (typeof document === "undefined") return;
    const tooltip = document.getElementById("chart-tooltip");
    if (tooltip) {
        tooltip.classList.add("hidden");
    }
}

export function renderXpChart(transaction, options = {}) {
    const container = document.getElementById("xp-chart-container");
    if (!container) return;

    if (!transaction || transaction.length === 0) {
        container.innerHTML = `<div class="empty-state">No XP transactions found.</div>`;
        return;
    }

    const selectedTrack = options.selectedTrack || "all";
    const onTrackChange = options.onTrackChange || null;

    const allSorted = [...transaction].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const availableTracks = [...new Set(allSorted.map((tx) => getTrackName(tx.path)))];

    const filtered = selectedTrack === "all"
        ? allSorted
        : allSorted.filter((tx) => getTrackName(tx.path) === selectedTrack);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">No XP transactions found for ${escapeXml(selectedTrack)}.</div>`;
        return;
    }

    let runningTotal = 0;
    const pointsData = filtered.map((tx) => {
        const amount = Number(tx.amount) || 0;
        runningTotal += amount;
        return {
            date: new Date(tx.createdAt),
            amountKb: (amount / 1000).toFixed(1),
            xpKb: Math.round(runningTotal / 1000),
            label: getTxName(tx.path),
            track: getTrackName(tx.path)
        };
    });

    const maxXp = pointsData[pointsData.length - 1].xpKb;
    const safeMaxXp = maxXp > 0 ? maxXp : 1;
    const midXp = Math.round(maxXp / 2);

    const width = 820;
    const height = 320;
    const paddingTop = 24;
    const paddingBottom = 38;
    const paddingLeft = 72;
    const paddingRight = 24;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const baselineY = height - paddingBottom;

    const minTime = pointsData[0].date.getTime();
    const maxTime = pointsData[pointsData.length - 1].date.getTime();
    const timeSpan = maxTime - minTime;

    const positionedPoints = pointsData.map((pt, index) => {
        let x;
        if (pointsData.length === 1) {
            x = paddingLeft + plotWidth / 2;
        } else if (timeSpan === 0) {
            x = paddingLeft + (index / (pointsData.length - 1)) * plotWidth;
        } else {
            x = paddingLeft + ((pt.date.getTime() - minTime) / timeSpan) * plotWidth;
        }
        const y = baselineY - (pt.xpKb / safeMaxXp) * plotHeight;
        return { ...pt, index, x, y };
    });

    const pointsString = positionedPoints
        .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
        .join(" ");

    const areaPointsString = positionedPoints.length >= 2
        ? `${positionedPoints[0].x.toFixed(1)},${baselineY} ${pointsString} ${positionedPoints[positionedPoints.length - 1].x.toFixed(1)},${baselineY}`
        : "";

    const dotsHTML = positionedPoints
        .map((pt) => {
            const tooltip = `${escapeXml(pt.label)} (${escapeXml(pt.track)}): +${pt.amountKb} kB · Total ${pt.xpKb} kB · ${formatDateLabel(pt.date)}`;
            const radius = positionedPoints.length === 1 ? 5 : 3.2;
            return `<circle class="xp-point" data-index="${pt.index}" tabindex="0" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${radius}" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.2"><title>${tooltip}</title></circle>`;
        })
        .join("");

    const startDateLabel = formatDateLabel(pointsData[0].date);
    const midDateLabel = formatDateLabel(new Date((minTime + maxTime) / 2));
    const endDateLabel = formatDateLabel(pointsData[pointsData.length - 1].date);

    const pillsHTML = ["all", ...availableTracks]
        .map((track) => {
            const label = track === "all" ? "All XP" : escapeXml(track);
            const isActive = track === selectedTrack ? "active" : "";
            return `<button type="button" class="chart-pill ${isActive}" data-track="${escapeXml(track)}">${label}</button>`;
        })
        .join("");

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="XP Progression Over Time Graph">
            <defs>
                <linearGradient id="xpAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.16" />
                    <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.01" />
                </linearGradient>
            </defs>

            <!-- Grid Lines -->
            <line x1="${paddingLeft}" y1="${baselineY}" x2="${width - paddingRight}" y2="${baselineY}" stroke="#c8c8c0" stroke-width="1" />
            <line x1="${paddingLeft}" y1="${paddingTop + plotHeight / 2}" x2="${width - paddingRight}" y2="${paddingTop + plotHeight / 2}" stroke="#e3e3de" stroke-dasharray="3 3" stroke-width="1" />
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="#e3e3de" stroke-dasharray="3 3" stroke-width="1" />

            <!-- Vertical Crosshair -->
            <line class="xp-crosshair" x1="0" y1="${paddingTop}" x2="0" y2="${baselineY}" stroke="#94a3b8" stroke-dasharray="3 3" stroke-width="1" style="display: none;" />

            ${areaPointsString ? `<polygon fill="url(#xpAreaGradient)" points="${areaPointsString}" />` : ""}

            ${positionedPoints.length >= 2 ? `
                <polyline
                    fill="none"
                    stroke="#1d4ed8"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    points="${pointsString}"
                />
            ` : ""}

            <!-- Interactive Hit Overlay -->
            <rect class="xp-hit-area" x="${paddingLeft}" y="${paddingTop}" width="${plotWidth}" height="${plotHeight}" fill="transparent" />

            <!-- Active Point Halo -->
            <circle class="xp-active-ring" cx="0" cy="0" r="6.5" fill="rgba(29, 78, 216, 0.16)" stroke="#1d4ed8" stroke-width="2" style="display: none; pointer-events: none;" />

            <!-- Data Points -->
            ${dotsHTML}

            <!-- Y-Axis Labels -->
            <text x="${paddingLeft - 10}" y="${paddingTop + 4}" font-size="11" text-anchor="end" fill="#565651">${maxXp} kB</text>
            <text x="${paddingLeft - 10}" y="${paddingTop + plotHeight / 2 + 4}" font-size="11" text-anchor="end" fill="#84847c">${midXp} kB</text>
            <text x="${paddingLeft - 10}" y="${baselineY + 4}" font-size="11" text-anchor="end" fill="#565651">0 kB</text>

            <!-- X-Axis Date Labels -->
            <text x="${paddingLeft}" y="${baselineY + 22}" font-size="11" text-anchor="start" fill="#565651">${startDateLabel}</text>
            ${pointsData.length >= 2 && startDateLabel !== endDateLabel ? `
                <text x="${paddingLeft + plotWidth / 2}" y="${baselineY + 22}" font-size="11" text-anchor="middle" fill="#84847c">${midDateLabel}</text>
                <text x="${width - paddingRight}" y="${baselineY + 22}" font-size="11" text-anchor="end" fill="#565651">${endDateLabel}</text>
            ` : ""}
        </svg>
    `;

    container.innerHTML = `
        <div class="chart-header">
            <div>
                <h3 class="chart-title">XP Progression Over Time</h3>
                <p class="chart-subtitle">${maxXp} kB cumulative · ${pointsData.length} transactions${selectedTrack !== "all" ? ` · filter: ${escapeXml(selectedTrack)}` : ""}</p>
            </div>
            ${availableTracks.length > 1 ? `<div class="chart-controls" role="group" aria-label="Filter XP progression by track">${pillsHTML}</div>` : ""}
        </div>
        <div class="chart-svg-wrap">${svgHTML}</div>
        <div class="chart-footer">
            <span class="xp-readout chart-footer-muted">Move cursor over chart to inspect milestones, click to pin.</span>
        </div>
    `;

    if (typeof container.querySelector !== "function") return;

    const svg = container.querySelector(".chart-svg");
    const hitArea = container.querySelector(".xp-hit-area");
    const crosshair = container.querySelector(".xp-crosshair");
    const activeRing = container.querySelector(".xp-active-ring");
    const readout = container.querySelector(".xp-readout");
    let pinnedIndex = null;

    const formatReadout = (pt, prefix) =>
        `${prefix}: ${pt.label} (${pt.track}) · +${pt.amountKb} kB · Total ${pt.xpKb} kB · ${formatDateLabel(pt.date)}`;

    const highlightPoint = (pt, clientX, clientY, showFloating = true) => {
        if (crosshair) {
            crosshair.setAttribute("x1", pt.x.toFixed(1));
            crosshair.setAttribute("x2", pt.x.toFixed(1));
            crosshair.style.display = "";
        }
        if (activeRing) {
            activeRing.setAttribute("cx", pt.x.toFixed(1));
            activeRing.setAttribute("cy", pt.y.toFixed(1));
            activeRing.style.display = "";
        }
        if (readout && pinnedIndex === null) {
            readout.textContent = formatReadout(pt, "Inspecting");
            readout.classList.remove("chart-footer-muted");
        }
        if (showFloating && clientX !== undefined && clientY !== undefined) {
            showTooltip(
                pt.label,
                [
                    ["Track", pt.track],
                    ["Earned", `+${pt.amountKb} kB`],
                    ["Cumulative", `${pt.xpKb} kB`],
                    ["Date", formatDateLabel(pt.date)]
                ],
                clientX,
                clientY
            );
        }
    };

    const clearHover = () => {
        hideTooltip();
        if (pinnedIndex !== null) {
            const pinnedPt = positionedPoints[pinnedIndex];
            if (pinnedPt) {
                highlightPoint(pinnedPt, undefined, undefined, false);
                return;
            }
        }
        if (crosshair) crosshair.style.display = "none";
        if (activeRing) activeRing.style.display = "none";
        if (readout) {
            readout.textContent = "Move cursor over chart to inspect milestones, click to pin.";
            readout.classList.add("chart-footer-muted");
        }
    };

    const findNearestByClientX = (clientX) => {
        if (!svg || typeof svg.getBoundingClientRect !== "function") return positionedPoints[0];
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0) return positionedPoints[0];
        const svgX = ((clientX - rect.left) / rect.width) * width;
        let closest = positionedPoints[0];
        let minDist = Math.abs(svgX - closest.x);
        for (const pt of positionedPoints) {
            const dist = Math.abs(svgX - pt.x);
            if (dist < minDist) {
                minDist = dist;
                closest = pt;
            }
        }
        return closest;
    };

    const togglePin = (pt) => {
        if (pinnedIndex === pt.index) {
            pinnedIndex = null;
            if (readout) {
                readout.textContent = formatReadout(pt, "Inspecting");
            }
        } else {
            pinnedIndex = pt.index;
            if (readout) {
                readout.textContent = formatReadout(pt, "Pinned (click again to clear)");
                readout.classList.remove("chart-footer-muted");
            }
        }
    };

    if (hitArea) {
        hitArea.addEventListener("mousemove", (e) => {
            const nearest = findNearestByClientX(e.clientX);
            highlightPoint(nearest, e.clientX, e.clientY, true);
        });
        hitArea.addEventListener("click", (e) => {
            const nearest = findNearestByClientX(e.clientX);
            togglePin(nearest);
            highlightPoint(nearest, e.clientX, e.clientY, true);
        });
        hitArea.addEventListener("mouseleave", clearHover);
    }

    if (typeof container.querySelectorAll === "function") {
        for (const dot of container.querySelectorAll(".xp-point")) {
            const idx = Number(dot.dataset.index);
            const pt = positionedPoints[idx];
            if (!pt) continue;

            dot.addEventListener("mouseenter", (e) => highlightPoint(pt, e.clientX, e.clientY, true));
            dot.addEventListener("mousemove", (e) => highlightPoint(pt, e.clientX, e.clientY, true));
            dot.addEventListener("mouseleave", clearHover);
            dot.addEventListener("click", () => {
                togglePin(pt);
                highlightPoint(pt, undefined, undefined, false);
            });
            dot.addEventListener("focus", () => highlightPoint(pt, undefined, undefined, false));
            dot.addEventListener("blur", clearHover);
            dot.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePin(pt);
                }
            });
        }

        for (const pill of container.querySelectorAll(".chart-pill")) {
            pill.addEventListener("click", () => {
                const nextTrack = pill.dataset.track || "all";
                hideTooltip();
                renderXpChart(transaction, { selectedTrack: nextTrack, onTrackChange });
                if (onTrackChange) onTrackChange(nextTrack);
            });
        }
    }
}

function formatAuditValue(bytes, unit) {
    if (unit === "Bytes") return `${bytes.toLocaleString()} B`;
    if (unit === "kB") return `${Math.round(bytes / 1000).toLocaleString()} kB`;
    return `${(bytes / 1000000).toFixed(2)} MB`;
}

export function renderAuditChart(user, options = {}) {
    const container = document.getElementById("secondary-chart-container");
    if (!container) return;

    if (!user) {
        container.innerHTML = `<div class="empty-state">No audit data found.</div>`;
        return;
    }

    const unit = options.unit || "MB";
    const totalUp = Number(user.totalUp) || 0;
    const totalDown = Number(user.totalDown) || 0;
    const totalVolume = totalUp + totalDown;
    const rawRatio = user.auditRatio || 0;
    const ratio = (Math.round(rawRatio * 10) / 10).toFixed(1);

    const upLabel = formatAuditValue(totalUp, unit);
    const downLabel = formatAuditValue(totalDown, unit);
    const upShare = totalVolume > 0 ? ((totalUp / totalVolume) * 100).toFixed(1) : "0.0";
    const downShare = totalVolume > 0 ? ((totalDown / totalVolume) * 100).toFixed(1) : "0.0";

    const width = 500;
    const height = 215;
    const paddingLeft = 120;
    const paddingRight = 105;
    const maxBarWidth = width - paddingLeft - paddingRight;
    const maxVal = Math.max(totalUp, totalDown, 1);

    const upWidth = totalUp > 0 ? Math.max((totalUp / maxVal) * maxBarWidth, 3) : 0;
    const downWidth = totalDown > 0 ? Math.max((totalDown / maxVal) * maxBarWidth, 3) : 0;

    const stripWidth = width - 40;
    const upStripWidth = totalVolume > 0 ? (totalUp / totalVolume) * stripWidth : stripWidth / 2;
    const downStripWidth = stripWidth - upStripWidth;

    const unitPillsHTML = ["MB", "kB", "Bytes"]
        .map((u) => `<button type="button" class="chart-pill ${u === unit ? "active" : ""}" data-unit="${u}">${u}</button>`)
        .join("");

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Audit Ratio Breakdown Graph">
            <!-- Done (Up) -->
            <g class="interactive-bar" data-bar="up" tabindex="0">
                <text x="${paddingLeft - 12}" y="46" font-size="12" text-anchor="end" fill="#565651">Done (Up)</text>
                <rect x="${paddingLeft}" y="30" width="${maxBarWidth}" height="22" rx="4" fill="#f4f4f1" />
                <rect x="${paddingLeft}" y="30" width="${upWidth.toFixed(1)}" height="22" rx="4" fill="#0f766e">
                    <title>Audits Done (Up): ${upLabel} (${upShare}%)</title>
                </rect>
                <text x="${(paddingLeft + upWidth + 10).toFixed(1)}" y="45" font-size="12" font-weight="bold" fill="#141413">${escapeXml(upLabel)}</text>
            </g>

            <!-- Received (Down) -->
            <g class="interactive-bar" data-bar="down" tabindex="0">
                <text x="${paddingLeft - 12}" y="94" font-size="12" text-anchor="end" fill="#565651">Received (Down)</text>
                <rect x="${paddingLeft}" y="78" width="${maxBarWidth}" height="22" rx="4" fill="#f4f4f1" />
                <rect x="${paddingLeft}" y="78" width="${downWidth.toFixed(1)}" height="22" rx="4" fill="#b45309">
                    <title>Audits Received (Down): ${downLabel} (${downShare}%)</title>
                </rect>
                <text x="${(paddingLeft + downWidth + 10).toFixed(1)}" y="93" font-size="12" font-weight="bold" fill="#141413">${escapeXml(downLabel)}</text>
            </g>

            <!-- Volume Split Strip -->
            <text x="20" y="140" font-size="11" fill="#565651">Volume split</text>
            <text x="${width - 20}" y="140" font-size="11" text-anchor="end" fill="#565651">${upShare}% up · ${downShare}% down</text>
            <rect x="20" y="150" width="${upStripWidth.toFixed(1)}" height="12" rx="3" fill="#0f766e" />
            <rect x="${(20 + upStripWidth).toFixed(1)}" y="150" width="${downStripWidth.toFixed(1)}" height="12" rx="3" fill="#b45309" />
            <line x1="${20 + stripWidth / 2}" y1="146" x2="${20 + stripWidth / 2}" y2="166" stroke="#141413" stroke-width="1.5" stroke-dasharray="2 2" />
            <text x="${20 + stripWidth / 2}" y="182" font-size="10" text-anchor="middle" fill="#84847c">1.0 balance</text>
        </svg>
    `;

    container.innerHTML = `
        <div class="chart-header">
            <div>
                <h3 class="chart-title">Audit Ratio Breakdown</h3>
                <p class="chart-subtitle">Ratio ${ratio} (${rawRatio.toFixed(2)} exact)</p>
            </div>
            <div class="chart-controls" role="group" aria-label="Select audit unit">${unitPillsHTML}</div>
        </div>
        <div class="chart-svg-wrap">${svgHTML}</div>
        <div class="chart-footer">
            <span class="audit-readout chart-footer-muted">Hover a bar to inspect exact audit bytes.</span>
        </div>
    `;

    if (typeof container.querySelector !== "function") return;

    const svg = container.querySelector(".chart-svg");
    const readout = container.querySelector(".audit-readout");
    const barsData = {
        up: {
            title: "Audits Done (Up)",
            bytes: totalUp,
            formatted: upLabel,
            share: upShare
        },
        down: {
            title: "Audits Received (Down)",
            bytes: totalDown,
            formatted: downLabel,
            share: downShare
        }
    };

    if (typeof container.querySelectorAll === "function") {
        for (const bar of container.querySelectorAll(".interactive-bar")) {
            const info = barsData[bar.dataset.bar];
            if (!info) continue;

            const onEnter = (e) => {
                if (svg) svg.classList.add("has-hover");
                if (readout) {
                    readout.textContent = `${info.title}: ${info.formatted} (${info.bytes.toLocaleString()} B · ${info.share}%)`;
                    readout.classList.remove("chart-footer-muted");
                }
                if (e && e.clientX !== undefined) {
                    showTooltip(
                        info.title,
                        [
                            ["Displayed", info.formatted],
                            ["Exact", `${info.bytes.toLocaleString()} B`],
                            ["Share", `${info.share}%`]
                        ],
                        e.clientX,
                        e.clientY
                    );
                }
            };

            const onLeave = () => {
                if (svg) svg.classList.remove("has-hover");
                hideTooltip();
                if (readout) {
                    readout.textContent = "Hover a bar to inspect exact audit bytes.";
                    readout.classList.add("chart-footer-muted");
                }
            };

            bar.addEventListener("mouseenter", onEnter);
            bar.addEventListener("mousemove", onEnter);
            bar.addEventListener("focus", () => onEnter(null));
            bar.addEventListener("mouseleave", onLeave);
            bar.addEventListener("blur", onLeave);
        }

        for (const pill of container.querySelectorAll(".chart-pill")) {
            pill.addEventListener("click", () => {
                hideTooltip();
                renderAuditChart(user, { unit: pill.dataset.unit || "MB" });
            });
        }
    }
}

function formatSkillName(rawType) {
    const clean = String(rawType || "").replace(/^skill_/, "");
    if (!clean) return "Unknown";
    const upper = new Set(["js", "html", "css", "sql", "tcp", "ai", "c", "ui", "ux", "php"]);
    return clean
        .split("-")
        .map((part) => (upper.has(part.toLowerCase()) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
        .join("-");
}

export function renderSkillsChart(skillTransactions, options = {}) {
    const container = document.getElementById("skills-chart-container");
    if (!container) return;

    if (!skillTransactions || skillTransactions.length === 0) {
        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title">Skills Profile</h3>
                    <p class="chart-subtitle">No skill transactions recorded yet</p>
                </div>
            </div>
            <div class="empty-state">No skill records found.</div>
        `;
        return;
    }

    const skillMap = new Map();
    for (const tx of skillTransactions) {
        if (!tx || !tx.type) continue;
        const amount = Number(tx.amount) || 0;
        const existing = skillMap.get(tx.type);
        if (existing) {
            existing.level = Math.max(existing.level, amount);
            existing.updates += 1;
        } else {
            skillMap.set(tx.type, {
                rawType: tx.type,
                name: formatSkillName(tx.type),
                level: amount,
                updates: 1
            });
        }
    }

    const skills = [...skillMap.values()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
    if (skills.length === 0) {
        container.innerHTML = `<div class="empty-state">No skill records found.</div>`;
        return;
    }

    const canRadar = skills.length >= 3;
    const requestedView = options.view || (canRadar ? "radar" : "bars");
    const activeView = requestedView === "radar" && canRadar ? "radar" : "bars";

    const viewPillsHTML = [
        canRadar ? ["radar", "Radar"] : null,
        ["bars", "Bars"]
    ]
        .filter(Boolean)
        .map(([key, label]) => `<button type="button" class="chart-pill ${activeView === key ? "active" : ""}" data-view="${key}">${label}</button>`)
        .join("");

    let svgHTML = "";
    let subtitleText = "";
    const topSkill = skills[0];

    if (activeView === "radar") {
        const radarSkills = skills.slice(0, 8);
        const count = radarSkills.length;
        const width = 500;
        const height = 310;
        const cx = 250;
        const cy = 158;
        const radius = 100;

        subtitleText = skills.length > 8
            ? `Top 8 of ${skills.length} skills · highest: ${escapeXml(topSkill.name)} (${topSkill.level}%)`
            : `${skills.length} skills · highest: ${escapeXml(topSkill.name)} (${topSkill.level}%)`;

        const ringLevels = [25, 50, 75, 100];
        const ringsHTML = ringLevels
            .map((lvl) => {
                const r = (lvl / 100) * radius;
                const pts = radarSkills
                    .map((_, i) => {
                        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
                        return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
                    })
                    .join(" ");
                return `
                    <polygon points="${pts}" fill="none" stroke="#e3e3de" stroke-width="1" />
                    <text x="${cx + 4}" y="${(cy - r + 10).toFixed(1)}" font-size="9" fill="#84847c">${lvl}%</text>
                `;
            })
            .join("");

        const spokesAndLabelsHTML = radarSkills
            .map((skill, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const x2 = cx + radius * cos;
                const y2 = cy + radius * sin;
                const lx = cx + (radius + 16) * cos;
                const ly = cy + (radius + 16) * sin + (sin < -0.7 ? -2 : sin > 0.7 ? 10 : 4);
                const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";

                return `
                    <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e3e3de" stroke-width="1" />
                    <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="11" font-weight="600" text-anchor="${anchor}" fill="#565651">${escapeXml(skill.name)} (${skill.level}%)</text>
                `;
            })
            .join("");

        const dataPoints = radarSkills.map((skill, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
            const norm = Math.max(0, Math.min(skill.level, 100)) / 100;
            const px = cx + radius * norm * Math.cos(angle);
            const py = cy + radius * norm * Math.sin(angle);
            return { ...skill, index: i, x: px, y: py };
        });

        const dataPolygonPts = dataPoints.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

        const verticesHTML = dataPoints
            .map((pt) => `
                <circle class="radar-vertex" data-index="${pt.index}" tabindex="0" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.2" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5">
                    <title>${escapeXml(pt.name)}: ${pt.level}% (${pt.updates} updates)</title>
                </circle>
            `)
            .join("");

        svgHTML = `
            <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Skills Radar Chart">
                ${ringsHTML}
                ${spokesAndLabelsHTML}
                <polygon points="${dataPolygonPts}" fill="rgba(29, 78, 216, 0.15)" stroke="#1d4ed8" stroke-width="2" stroke-linejoin="round" />
                <circle class="skill-active-ring" cx="0" cy="0" r="8" fill="rgba(29, 78, 216, 0.16)" stroke="#1d4ed8" stroke-width="1.8" style="display: none; pointer-events: none;" />
                ${verticesHTML}
            </svg>
        `;
    } else {
        const width = 500;
        const rowHeight = 32;
        const topOffset = 12;
        const height = topOffset + skills.length * rowHeight + 10;
        const paddingLeft = 108;
        const paddingRight = 56;
        const maxBarWidth = width - paddingLeft - paddingRight;

        subtitleText = `${skills.length} skills · highest: ${escapeXml(topSkill.name)} (${topSkill.level}%)`;

        const rowsHTML = skills
            .map((skill, idx) => {
                const y = topOffset + idx * rowHeight;
                const norm = Math.max(0, Math.min(skill.level, 100)) / 100;
                const barWidth = norm > 0 ? Math.max(norm * maxBarWidth, 3) : 0;
                const color = idx < 3 ? "#1d4ed8" : "#0f766e";

                return `
                    <g class="interactive-bar skill-bar" data-index="${idx}" tabindex="0">
                        <text x="${paddingLeft - 10}" y="${y + 15}" font-size="11" text-anchor="end" fill="#565651">${escapeXml(skill.name)}</text>
                        <rect x="${paddingLeft}" y="${y}" width="${maxBarWidth}" height="20" rx="4" fill="#f4f4f1" />
                        <rect x="${paddingLeft}" y="${y}" width="${barWidth.toFixed(1)}" height="20" rx="4" fill="${color}">
                            <title>${escapeXml(skill.name)}: ${skill.level}% (${skill.updates} updates)</title>
                        </rect>
                        <text x="${(paddingLeft + maxBarWidth + 8).toFixed(1)}" y="${y + 14}" font-size="11" font-weight="bold" fill="#141413">${skill.level}%</text>
                    </g>
                `;
            })
            .join("");

        svgHTML = `
            <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Skills Progress Bar Chart">
                ${rowsHTML}
            </svg>
        `;
    }

    container.innerHTML = `
        <div class="chart-header">
            <div>
                <h3 class="chart-title">Skills</h3>
                <p class="chart-subtitle">${subtitleText}</p>
            </div>
            ${viewPillsHTML ? `<div class="chart-controls" role="group" aria-label="Select skills chart view">${viewPillsHTML}</div>` : ""}
        </div>
        <div class="chart-svg-wrap">${svgHTML}</div>
        <div class="chart-footer">
            <span class="skills-readout chart-footer-muted">Hover or click a skill to inspect level.</span>
        </div>
    `;

    if (typeof container.querySelector !== "function") return;

    const svg = container.querySelector(".chart-svg");
    const activeRing = container.querySelector(".skill-active-ring");
    const readout = container.querySelector(".skills-readout");
    let pinnedIndex = null;

    const displayedSkills = activeView === "radar" ? skills.slice(0, 8) : skills;
    const count = displayedSkills.length;

    const formatSkillReadout = (skill, prefix) =>
        `${prefix}: ${skill.name} (${skill.rawType}) · ${skill.level}% · ${skill.updates} ${skill.updates === 1 ? "update" : "updates"}`;

    const highlightSkill = (skill, index, clientX, clientY, showFloating = true) => {
        if (activeView === "radar" && activeRing) {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
            const norm = Math.max(0, Math.min(skill.level, 100)) / 100;
            const px = 250 + 100 * norm * Math.cos(angle);
            const py = 158 + 100 * norm * Math.sin(angle);
            activeRing.setAttribute("cx", px.toFixed(1));
            activeRing.setAttribute("cy", py.toFixed(1));
            activeRing.style.display = "";
        }
        if (svg && activeView === "bars") {
            svg.classList.add("has-hover");
        }
        if (readout && pinnedIndex === null) {
            readout.textContent = formatSkillReadout(skill, "Inspecting");
            readout.classList.remove("chart-footer-muted");
        }
        if (showFloating && clientX !== undefined && clientY !== undefined) {
            showTooltip(
                skill.name,
                [
                    ["Level", `${skill.level}%`],
                    ["Type", skill.rawType],
                    ["Updates", `${skill.updates}`]
                ],
                clientX,
                clientY
            );
        }
    };

    const clearSkillHover = () => {
        hideTooltip();
        if (svg) svg.classList.remove("has-hover");
        if (pinnedIndex !== null && displayedSkills[pinnedIndex]) {
            highlightSkill(displayedSkills[pinnedIndex], pinnedIndex, undefined, undefined, false);
            return;
        }
        if (activeRing) activeRing.style.display = "none";
        if (readout) {
            readout.textContent = "Hover or click a skill to inspect level.";
            readout.classList.add("chart-footer-muted");
        }
    };

    const toggleSkillPin = (skill, index) => {
        if (pinnedIndex === index) {
            pinnedIndex = null;
            if (readout) readout.textContent = formatSkillReadout(skill, "Inspecting");
        } else {
            pinnedIndex = index;
            if (readout) {
                readout.textContent = formatSkillReadout(skill, "Pinned (click again to clear)");
                readout.classList.remove("chart-footer-muted");
            }
        }
    };

    if (typeof container.querySelectorAll === "function") {
        const selector = activeView === "radar" ? ".radar-vertex" : ".skill-bar";
        for (const el of container.querySelectorAll(selector)) {
            const idx = Number(el.dataset.index);
            const skill = displayedSkills[idx];
            if (!skill) continue;

            el.addEventListener("mouseenter", (e) => highlightSkill(skill, idx, e.clientX, e.clientY, true));
            el.addEventListener("mousemove", (e) => highlightSkill(skill, idx, e.clientX, e.clientY, true));
            el.addEventListener("focus", () => highlightSkill(skill, idx, undefined, undefined, false));
            el.addEventListener("mouseleave", clearSkillHover);
            el.addEventListener("blur", clearSkillHover);
            el.addEventListener("click", () => {
                toggleSkillPin(skill, idx);
                highlightSkill(skill, idx, undefined, undefined, false);
            });
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSkillPin(skill, idx);
                }
            });
        }

        for (const pill of container.querySelectorAll(".chart-pill")) {
            pill.addEventListener("click", () => {
                hideTooltip();
                renderSkillsChart(skillTransactions, { view: pill.dataset.view || "bars" });
            });
        }
    }
}
