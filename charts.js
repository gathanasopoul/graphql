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
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow: visible;">
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="2" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="2" />
            <line x1="${padding}" y1="${padding + plotHeight / 2}" x2="${width - padding}" y2="${padding + plotHeight / 2}" stroke="#334155" stroke-dasharray="4" />

            <polyline
                fill="none"
                stroke="#2563eb"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                points="${pointsString}"
            />

            <text x="${padding - 10}" y="${padding + 5}" font-size="12" text-anchor="end" fill="#94a3b8">${maxXp} kB</text>
            <text x="${padding - 10}" y="${height - padding + 5}" font-size="12" text-anchor="end" fill="#94a3b8">0 kB</text>
            <text x="${width / 2}" y="${padding - 20}" font-size="16" font-weight="bold" text-anchor="middle" fill="#f8fafc">XP Progression Over Time</text>
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
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow: visible;">
            <text x="${width / 2}" y="30" font-size="16" font-weight="bold" text-anchor="middle" fill="#f8fafc">Audits Ratio & XP</text>

            <text x="${paddingLeft - 15}" y="85" font-size="14" font-weight="600" text-anchor="end" fill="#cbd5e1">Done (Up)</text>
            <rect x="${paddingLeft}" y="65" width="${upWidth.toFixed(1)}" height="30" rx="4" fill="#10b981" />
            <text x="${(paddingLeft + upWidth + 10).toFixed(1)}" y="86" font-size="13" font-weight="600" fill="#34d399">${upMb} MB</text>

            <text x="${paddingLeft - 15}" y="145" font-size="14" font-weight="600" text-anchor="end" fill="#cbd5e1">Received (Down)</text>
            <rect x="${paddingLeft}" y="125" width="${downWidth.toFixed(1)}" height="30" rx="4" fill="#f59e0b" />
            <text x="${(paddingLeft + downWidth + 10).toFixed(1)}" y="146" font-size="13" font-weight="600" fill="#fbbf24">${downMb} MB</text>

            <line x1="${paddingLeft}" y1="180" x2="${width - paddingRight}" y2="180" stroke="#334155" stroke-width="1" />
            <text x="${width / 2}" y="205" font-size="14" text-anchor="middle" fill="#94a3b8">
                Ratio: <tspan font-weight="bold" fill="#f8fafc">${ratio}</tspan>
            </text>
        </svg>
    `;

    container.innerHTML = svgHTML;
}