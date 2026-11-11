import { renderXpChart, renderAuditChart, renderSkillsChart, hideTooltip } from "./charts.js";

const SIGNIN_URL = "https://platform.zone01.gr/api/auth/signin";
const GRAPHQL_URL = "https://platform.zone01.gr/api/graphql-engine/v1/graphql";

const loginSection = document.getElementById("login-section");
const profileSection = document.getElementById("profile-section");
const loadingScreen = document.getElementById("loading-screen");
const loadingStatus = document.getElementById("loading-status");
const profileContent = document.getElementById("profile-content");

const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const usernameOrEmailInput = document.getElementById("username-or-email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const logoutBtn = document.getElementById("logout-btn");

const loginEl = document.getElementById("login");
const userIdMetaEl = document.getElementById("user-id-meta");
const totalXPEl = document.getElementById("totalXP");
const xpMetaEl = document.getElementById("xp-meta");
const auditRatioEl = document.getElementById("auditRatio");
const auditMetaEl = document.getElementById("audit-meta");

const xpContainer = document.getElementById("xp-chart-container");
const auditContainer = document.getElementById("secondary-chart-container");
const skillsContainer = document.getElementById("skills-chart-container");
const resultsContainer = document.getElementById("results-container");
const resultsSummary = document.getElementById("results-summary");
const resultsFilters = document.getElementById("results-filters");

let activeLoadId = 0;

pageLoadCheck();

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    const identifier = usernameOrEmailInput.value.trim();
    const password = passwordInput.value;

    await handleLogin(identifier, password);
});

logoutBtn.addEventListener("click", () => {
    activeLoadId += 1;
    localStorage.removeItem("jwt");
    hideTooltip();
    clearProfileData();
    usernameOrEmailInput.value = "";
    passwordInput.value = "";
    showLoginView("");
});

function encodeBasicCredentials(identifier, password) {
    const bytes = new TextEncoder().encode(`${identifier}:${password}`);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function showLoginView(message = "") {
    profileSection.classList.add("hidden");
    loadingScreen.classList.add("hidden");
    profileContent.classList.add("hidden");
    loginSection.classList.remove("hidden");
    errorMessage.textContent = message;
}

function showProfileLoading() {
    loginSection.classList.add("hidden");
    profileSection.classList.remove("hidden");
    profileContent.classList.add("hidden");
    loadingScreen.classList.remove("hidden");
    if (loadingStatus) {
        loadingStatus.textContent = "Fetching user stats, XP history, and evaluations";
    }
}

function showProfileLoaded() {
    loadingScreen.classList.add("hidden");
    profileContent.classList.remove("hidden");
}

function clearProfileData() {
    if (loginEl) loginEl.textContent = "";
    if (userIdMetaEl) userIdMetaEl.textContent = "";
    if (totalXPEl) totalXPEl.textContent = "";
    if (xpMetaEl) xpMetaEl.textContent = "";
    if (auditRatioEl) auditRatioEl.textContent = "";
    if (auditMetaEl) auditMetaEl.textContent = "";
    if (xpContainer) xpContainer.innerHTML = "";
    if (auditContainer) auditContainer.innerHTML = "";
    if (skillsContainer) skillsContainer.innerHTML = "";
    if (resultsContainer) resultsContainer.innerHTML = "";
    if (resultsSummary) resultsSummary.textContent = "";
    if (resultsFilters) resultsFilters.innerHTML = "";
}

function handleAuthFailure(message) {
    localStorage.removeItem("jwt");
    hideTooltip();
    clearProfileData();
    showLoginView(message);
}

async function handleLogin(identifier, password) {
    const credentials = encodeBasicCredentials(identifier, password);

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Signing in…";
    }

    try {
        const res = await fetch(SIGNIN_URL, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            if (res.status >= 500) {
                throw new Error("Authentication service error. Please try again.");
            }
            throw new Error("Invalid username/email or password.");
        }

        const data = await res.json();
        const token = typeof data === "string" ? data : data?.jwt || data?.token;

        if (!token || typeof token !== "string") {
            throw new Error("Authentication failed: invalid token response.");
        }

        localStorage.setItem("jwt", token);
        passwordInput.value = "";
        errorMessage.textContent = "";

        await loadUserData();
    } catch (err) {
        errorMessage.textContent = err.message || "Failed to log in.";
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "Sign in";
        }
    }
}

function pageLoadCheck() {
    const jwt = localStorage.getItem("jwt");

    if (jwt && jwt !== "undefined" && jwt !== "null") {
        loadUserData();
    } else {
        localStorage.removeItem("jwt");
        showLoginView("");
    }
}

async function fetchGraphQL(query) {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
        throw new Error("Missing authentication token.");
    }

    const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${jwt}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
    });

    if (!res.ok) {
        throw new Error(`GraphQL HTTP ${res.status}`);
    }

    const result = await res.json();

    if (result.errors && result.errors.length > 0) {
        console.error("GraphQL errors:", result.errors);
        throw new Error(result.errors[0].message);
    }

    return result.data;
}

function getResultStatus(grade) {
    if (grade === null || grade === undefined) return "pending";
    return grade >= 1 ? "pass" : "fail";
}

function renderRecentResults(results, activeFilter = "all") {
    if (!resultsContainer) return;

    const allResults = results || [];
    const passCount = allResults.filter((r) => getResultStatus(r.grade) === "pass").length;
    const failCount = allResults.filter((r) => getResultStatus(r.grade) === "fail").length;
    const pendingCount = allResults.filter((r) => getResultStatus(r.grade) === "pending").length;

    if (resultsSummary) {
        resultsSummary.textContent = `${allResults.length} recent · ${passCount} passed · ${failCount} failed · ${pendingCount} in progress`;
    }

    if (resultsFilters) {
        resultsFilters.innerHTML = "";
        const filterDefs = [
            ["all", "All"],
            ["pass", "Pass"],
            ["fail", "Fail"],
            ["pending", "In Progress"]
        ];
        for (const [key, label] of filterDefs) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `chart-pill${activeFilter === key ? " active" : ""}`;
            btn.textContent = label;
            btn.addEventListener("click", () => renderRecentResults(allResults, key));
            resultsFilters.appendChild(btn);
        }
    }

    const filtered = activeFilter === "all"
        ? allResults
        : allResults.filter((item) => getResultStatus(item.grade) === activeFilter);

    if (filtered.length === 0) {
        resultsContainer.innerHTML = `<div class="empty-state">No evaluation results match this filter.</div>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "results-table";

    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Object</th><th>Type</th><th>Status</th><th>Grade</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const item of filtered) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = item.object?.name || "Unknown";

        const typeCell = document.createElement("td");
        typeCell.textContent = item.object?.type || "-";

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        const gradeCell = document.createElement("td");
        const status = getResultStatus(item.grade);

        if (status === "pending") {
            badge.textContent = "In progress";
            badge.className = "status-badge status-pending";
            gradeCell.textContent = "-";
        } else if (status === "pass") {
            badge.textContent = "Pass";
            badge.className = "status-badge status-pass";
            gradeCell.textContent = Number(item.grade.toFixed(2)).toString();
        } else {
            badge.textContent = "Fail";
            badge.className = "status-badge status-fail";
            gradeCell.textContent = Number(item.grade.toFixed(2)).toString();
        }

        statusCell.appendChild(badge);
        row.append(nameCell, typeCell, statusCell, gradeCell);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(table);
}

async function loadUserData() {
    const requestId = ++activeLoadId;

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
          skills: transaction(where: { type: { _like: "skill_%" } }, order_by: { amount: desc }) {
            type
            amount
          }
          result(limit: 10, order_by: { createdAt: desc }) {
            grade
            object { name type }
          }
        }
    `;

    showProfileLoading();

    try {
        const data = await fetchGraphQL(query);

        // Ignore response if user logged out or another load started while waiting
        if (requestId !== activeLoadId || !localStorage.getItem("jwt")) {
            return;
        }

        if (!data || !data.user || data.user.length === 0) {
            throw new Error("No user profile found");
        }

        const currentUser = data.user[0];
        const userLogin = currentUser.login;
        const userAuditRatio = (Math.round((currentUser.auditRatio || 0) * 10) / 10).toFixed(1);

        const transactions = data.transaction || [];
        const totalBytes = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const userTotalXP = Math.round(totalBytes / 1000);

        const upMb = ((Number(currentUser.totalUp) || 0) / 1000000).toFixed(2);
        const downMb = ((Number(currentUser.totalDown) || 0) / 1000000).toFixed(2);

        if (loginEl) loginEl.textContent = userLogin;
        if (userIdMetaEl) userIdMetaEl.textContent = `ID #${currentUser.id}`;
        if (totalXPEl) totalXPEl.textContent = `${userTotalXP} kB`;
        if (xpMetaEl) xpMetaEl.textContent = `across ${transactions.length} transactions`;
        if (auditRatioEl) auditRatioEl.textContent = userAuditRatio;
        if (auditMetaEl) auditMetaEl.textContent = `${upMb} MB up · ${downMb} MB down`;

        renderXpChart(transactions);
        renderAuditChart(currentUser);
        renderSkillsChart(data.skills || []);
        renderRecentResults(data.result || []);

        showProfileLoaded();
    } catch (err) {
        if (requestId !== activeLoadId) return;
        console.error("Failed to load user data:", err);
        handleAuthFailure("Session expired or query failed. Please log in again.");
    }
}
