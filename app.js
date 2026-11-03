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
    }
  }
`;

    try {
        const data = await fetchGraphQL(query);
        console.log("GraphQL response:", data);
    } catch (err) {
        console.log("Failed to load user data:", err);
    }
}




