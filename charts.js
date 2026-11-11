// charts.js

export function renderXpChart(transaction) {
    const container = document.getElementById("xp-chart-container");
    if (!transaction || transaction.length === 0) {
        container.innerHTML = "<p>No XP transactions found.</p>";
        return;
    }

    // Sort transactions chronologically
    const sorted = [...transaction].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Build XP dataset
    let runningTotal = 0;
    const pointsData = sorted.map((tx) => {
        runningTotal += tx.amount;
        return {
            date: new Date(tx.createdAt),
            xpKb: Math.round(runningTotal / 1000)
        };
    });

    const maxXp = pointsData[pointsData.length - 1].xpKb;

    // SVG dimensions & layout bounds
    const width = 800;
    const height = 400;
    const padding = 50;
    
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Calculate (x, y) coordinates for each milestone
    const coords = pointsData.map((pt, index) => {
        const x = padding + (index / (pointsData.length - 1)) * plotWidth;
        const y = (height - padding) - (pt.xpKb / maxXp) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pointsString = coords.join(" ");

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow: visible; font-family: 'Courier New', monospace;">
            <!-- Grid Lines -->
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#000000" stroke-width="1" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#000000" stroke-width="1" />
            <line x1="${padding}" y1="${padding + plotHeight / 2}" x2="${width - padding}" y2="${padding + plotHeight / 2}" stroke="#808080" stroke-dasharray="2 2" stroke-width="1" />

            <!-- Solid Graph Line -->
            <polyline
                fill="none"
                stroke="#000080"
                stroke-width="2"
                points="${pointsString}"
            />

            <!-- Labels -->
            <text x="${padding - 10}" y="${padding + 4}" font-size="11" text-anchor="end" fill="#000000">${maxXp} kB</text>
            <text x="${padding - 10}" y="${height - padding + 4}" font-size="11" text-anchor="end" fill="#000000">0 kB</text>
            <text x="${width / 2}" y="${padding - 15}" font-size="12" font-weight="bold" text-anchor="middle" fill="#000000">XP PROGRESSION GRAPH</text>
        </svg>
    `;

    container.innerHTML = svgHTML;
}

export function renderAuditChart(user) {
    const container = document.getElementById("secondary-chart-container");
    if (!user) {
        container.innerHTML = "<p>No audit data found.</p>";
        return;
    }

    const totalUp = user.totalUp || 0;
    const totalDown = user.totalDown || 0;
    const ratio = (Math.round((user.auditRatio || 0) * 10) / 10).toFixed(1);

    const upMb = (totalUp / 1000000).toFixed(2);
    const downMb = (totalDown / 1000000).toFixed(2);

    const width = 800;
    const height = 220;
    const paddingLeft = 140;
    const paddingRight = 100;
    const maxBarWidth = width - paddingLeft - paddingRight;

    const maxVal = Math.max(totalUp, totalDown, 1);
    const upWidth = Math.max((totalUp / maxVal) * maxBarWidth, 2);
    const downWidth = Math.max((totalDown / maxVal) * maxBarWidth, 2);

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow: visible; font-family: 'Courier New', monospace;">
            <text x="${width / 2}" y="25" font-size="12" font-weight="bold" text-anchor="middle" fill="#000000">AUDIT RATIO BREAKDOWN</text>

            <!-- Done (Up) -->
            <text x="${paddingLeft - 10}" y="78" font-size="11" text-anchor="end" fill="#000000">Done (Up):</text>
            <rect x="${paddingLeft}" y="65" width="${upWidth.toFixed(1)}" height="18" fill="#008080" stroke="#000000" stroke-width="1" />
            <text x="${(paddingLeft + upWidth + 8).toFixed(1)}" y="78" font-size="11" font-weight="bold" fill="#000000">${upMb} MB</text>

            <!-- Received (Down) -->
            <text x="${paddingLeft - 10}" y="128" font-size="11" text-anchor="end" fill="#000000">Received (Down):</text>
            <rect x="${paddingLeft}" y="115" width="${downWidth.toFixed(1)}" height="18" fill="#800000" stroke="#000000" stroke-width="1" />
            <text x="${(paddingLeft + downWidth + 8).toFixed(1)}" y="128" font-size="11" font-weight="bold" fill="#000000">${downMb} MB</text>

            <line x1="${paddingLeft}" y1="155" x2="${width - paddingRight}" y2="155" stroke="#808080" stroke-width="1" />
            <text x="${width / 2}" y="180" font-size="11" text-anchor="middle" fill="#000000">
                Current Ratio: [ <tspan font-weight="bold">${ratio}</tspan> ]
            </text>
        </svg>
    `;

    container.innerHTML = svgHTML;
}