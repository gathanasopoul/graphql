const SIGNIN_URL = "https://platform.zone01.gr/api/auth/signin";
const GRAPHQL_URL = "https://platform.zone01.gr/api/graphql-engine/v1/graphql";

const loginSection = document.getElementById("login-section");
const profileSection = document.getElementById("profile-section");
const loginForm = document.getElementById("login-form");
const usernameOrEmailInput = document.getElementById("username-or-email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const logoutBtn = document.getElementById("logout-btn");

pageLoadCheck();

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    const identifier = usernameOrEmailInput.value.trim();
    const password = passwordInput.value;

    await handleLogin(identifier, password)
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem('jwt');

    profileSection.style.display = "none";
    loginSection.style.display = "block";

    usernameOrEmailInput.value = "";
    passwordInput.value = "";
    errorMessage.textContent = "";
});


async function handleLogin(identifier, password) {
    const credentials = btoa(`${identifier}:${password}`);

    try {
        const res = await fetch(SIGNIN_URL, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            throw new Error("Invalid username/email or password.");
        }

        const data = await res.json();
        const token = typeof data === "string" ? data : data.jwt || data.token;

        localStorage.setItem("jwt", token);

        loginSection.style.display = "none";
        profileSection.style.display = "block";

        passwordInput.value = "";

        console.log("Logged in successfully! Token stored.");
        loadUserData();
    } catch (err) {
        errorMessage.textContent = err.message;
    }
}

function pageLoadCheck() {
    const jwt = localStorage.getItem("jwt")

    if (jwt) {
        loginSection.style.display = "none";
        profileSection.style.display = "block"
        loadUserData();
    } else {
        loginSection.style.display = "block";
        profileSection.style.display = "none";
    }
}

async function fetchGraphQL(query) {
    const jwt = localStorage.getItem("jwt")

    try {
        const res = await fetch(GRAPHQL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${jwt}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query: query })
        });

        const result = await res.json();

        if (result.errors) {
            console.error("GraphQL errors:", result.errors);
            throw new Error(result.errors[0].message);
        }

        return result.data;
    } catch (err) {
        console.error("Fetch error:", err);
        throw err;
    }
}

async function loadUserData() {
const query = `
    query {
      user {
        id
        login
        auditRatio
        totalUp
        totalDown
      }
      transaction(where: { type: { _eq: "xp" } }, order_by: { createdAt: asc }) {
        amount
        createdAt
        path
      }
      result(limit: 10, order_by: { createdAt: desc }) {
        grade
        object { name type }
      }
    }
  `;

    try {
        const data = await fetchGraphQL(query);
        console.log("GraphQL response:", data);

        const currentUser = data.user[0];
        const userLogin = currentUser.login;
        const userAuditRatio = Math.round(currentUser.auditRatio * 10) / 10;
        
        const totalBytes = data.transaction.reduce((sum, tx) => sum + tx.amount, 0);
        const userTotalXP = Math.round(totalBytes / 1000);

        console.log("Parsed stats:", { userLogin, userAuditRatio, userTotalXP: `${totalXP} kB` });


        document.getElementById("login").textContent = `User: ${userLogin}`;
        document.getElementById("totalXP").textContent = `Total XP: ${userTotalXP} kB`;
        document.getElementById("auditRatio").textContent = `Audit Ratio: ${userAuditRatio}`;

        renderXpChart(data.transaction);
    } catch (err) {
        console.log("Failed to load user data:", err);
    }
}

function renderXpChart(transaction) {
    // debug
    console.log("Transactions inside chart:", transaction);

    const container = document.getElementById("xp-chart-container");
    if (!transaction || transaction.length === 0) {
        container.innerHTML = "<p> No XP transactions found.</p>";
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
            <!-- Background grid lines -->
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="2" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="2" />
            
            <!-- Midpoint horizontal reference -->
            <line x1="${padding}" y1="${padding + plotHeight / 2}" x2="${width - padding}" y2="${padding + plotHeight / 2}" stroke="#f1f5f9" stroke-dasharray="4" />

            <!-- The XP Progression Polyline -->
            <polyline
                fill="none"
                stroke="#2563eb"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                points="${pointsString}"
            />

            <!-- Value Labels -->
            <!-- Y-Axis Max -->
            <text x="${padding - 10}" y="${padding + 5}" font-size="12" text-anchor="end" fill="#64748b">${maxXp} kB</text>
            <!-- Y-Axis Zero -->
            <text x="${padding - 10}" y="${height - padding + 5}" font-size="12" text-anchor="end" fill="#64748b">0 kB</text>

            <!-- Chart Title -->
            <text x="${width / 2}" y="${padding - 20}" font-size="16" font-weight="bold" text-anchor="middle" fill="#1e293b">XP Progression Over Time</text>
        </svg>
    `;

    container.innerHTML = svgHTML;
}



