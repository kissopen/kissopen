/* Runs inside the preview guest. Everything it reports is measured in the page
   itself rather than asserted here, so a red row is a real regression. */

const mark = (id, pass) => {
    const row = document.getElementById(id);
    if (row) row.dataset.state = pass ? "pass" : "fail";
};

const runtime = document.getElementById("runtime");

/** One runtime check, painted as it settles. */
function check(title, detail, run) {
    const row = document.createElement("li");
    row.innerHTML = `<b></b><span></span>`;
    row.querySelector("b").textContent = title;
    const note = row.querySelector("span");
    note.textContent = detail;
    runtime.append(row);
    Promise.resolve()
        .then(run)
        .then(({ pass, said }) => {
            row.dataset.state = pass ? "pass" : "fail";
            if (said) note.textContent = `${detail} — ${said}`;
        })
        .catch((error) => {
            row.dataset.state = "fail";
            note.textContent = `${detail} — threw ${String(error)}`;
        });
}

/* The markup's own loads. A stylesheet that 404s still produces a <link>, so
   these are judged by whether the rules actually applied. */
const styled = getComputedStyle(document.body);
mark("check-absolute-css", styled.paddingLeft === "40px");
mark(
    "check-relative-css",
    getComputedStyle(document.querySelector("main section")).borderLeftWidth === "3px",
);
mark("check-script", true);

const badge = document.getElementById("badge");
const badgeDone = () => mark("check-image", badge.naturalWidth > 0);
if (badge.complete) badgeDone();
else {
    badge.addEventListener("load", badgeDone);
    badge.addEventListener("error", () => mark("check-image", false));
}

/* A page served over a trustworthy origin gets the APIs it would have in
   production. `.localhost` is loopback by specification, which is why the
   preview publishes sites there rather than on a bare IP and port. */
check("Secure context", "window.isSecureContext", () => ({
    pass: window.isSecureContext === true,
    said: String(window.isSecureContext),
}));

check("Web Crypto", "crypto.randomUUID() — secure-context only", () => ({
    pass: typeof crypto.randomUUID === "function" && crypto.randomUUID().length === 36,
    said: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "unavailable",
}));

check("Absolute fetch from the site root", "GET /styles/site.css should be 200", async () => {
    const response = await fetch("/styles/site.css");
    return { pass: response.status === 200, said: `HTTP ${response.status}` };
});

check("A folder resolves to its page", "GET / should serve index.html", async () => {
    const response = await fetch("/");
    const body = await response.text();
    return {
        pass: response.status === 200 && body.includes("<h1>"),
        said: `HTTP ${response.status}`,
    };
});

/* The boundaries. Each of these must be refused, and a green row here means the
   page was told no. */
check("A dotfile beside the page", "GET /.env must not be served", async () => {
    const response = await fetch("/.env");
    return { pass: response.status === 404, said: `HTTP ${response.status}` };
});

check("A source file beside the page", "GET /secrets.ts must not be served", async () => {
    const response = await fetch("/secrets.ts");
    return { pass: response.status === 404, said: `HTTP ${response.status}` };
});

check("Escaping the folder", "GET /../package.json must not be served", async () => {
    const response = await fetch("/../package.json");
    return { pass: response.status === 404, said: `HTTP ${response.status}` };
});

/* Read as ordinary cross-origin fetches rather than `no-cors`: an opaque
   response reports status 0 whatever happened, so it cannot tell a refusal from
   a page that answered. A readable response here is the failure. */
check("Reaching the internet", "fetch('https://example.com') must fail", async () => {
    try {
        const response = await fetch("https://example.com");
        return { pass: false, said: `answered HTTP ${response.status}` };
    } catch {
        return { pass: true, said: "refused before any socket" };
    }
});

check("Reaching another preview site", "a sibling origin must not answer", async () => {
    try {
        const response = await fetch("http://not-a-real-site.localhost/index.html");
        return { pass: false, said: `answered HTTP ${response.status}` };
    } catch {
        return { pass: true, said: "refused" };
    }
});

/* What the page is, in its own words. */
const facts = document.getElementById("facts");
for (const [term, value] of [
    ["Origin", location.origin],
    ["Path", location.pathname],
    ["Secure context", String(window.isSecureContext)],
    ["Cookies enabled", String(navigator.cookieEnabled)],
    ["Rendered at", new Date().toISOString()],
]) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
}
