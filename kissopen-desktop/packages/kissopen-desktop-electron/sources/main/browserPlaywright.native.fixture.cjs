const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const directory = process.env.WORPAR_BROWSER_TEST_DIRECTORY;
if (!directory) throw new Error("Disposable test directory required");
app.setPath("userData", directory);
app.commandLine.appendSwitch("site-per-process");
let engine, win, server, guest;
let allowed = true;
const secondary = [];
const report = { checks: [], failures: [] };
let unintended = 0;
app.whenReady().then(async () => {
    try {
        server = createServer((req, res) => {
            res.setHeader("content-type", "text/html");
            const port = server.address().port;
            if (req.url === "/login") {
                res.setHeader("set-cookie", "fixture_login=active; HttpOnly; SameSite=Lax; Path=/");
                res.end("<h1>Fixture login created</h1>");
            } else if (req.url === "/check")
                res.end(
                    `<h1>${(req.headers.cookie || "").includes("fixture_login=active") ? "Authenticated fixture" : "No fixture login"}</h1>`,
                );
            else if (req.url === "/unintended") {
                unintended++;
                res.end("Unexpected");
            } else if (req.url === "/batch")
                res.end(
                    `<label>First field <input id="a"></label><label>Second field <input id="b"></label><button onclick="window.done=(window.done||0)+1">Finish batch</button>`,
                );
            else if (req.url === "/change")
                res.end(
                    `<button onclick="document.getElementById('second').outerHTML='<button>Replacement</button>'">Change page</button><button id="second" onclick="fetch('/unintended')">Old target</button>`,
                );
            else if (req.url === "/goto")
                res.end(
                    `<button onclick="location.href='/target'">Navigate away</button><button onclick="fetch('/unintended')">Do not click</button>`,
                );
            else if (req.url === "/target") res.end("<h1>Navigation verified</h1>");
            else if (req.url === "/wait")
                res.end('<button id="late" disabled>Delayed control</button>');
            else if (req.url === "/same")
                res.end('<iframe src="/same-form" style="width:700px;height:300px"></iframe>');
            else if (req.url === "/same-form")
                res.end('<label>Same origin field <input id="same"></label>');
            else if (req.url === "/shadow")
                res.end(
                    `<div id="host"></div><script>const root=document.getElementById('host').attachShadow({mode:'open'});root.innerHTML='<button id="change">Change shadow</button><button id="old">Old shadow target</button>';root.getElementById('change').onclick=()=>root.getElementById('old').outerHTML='<button>New shadow target</button>';root.getElementById('old').onclick=()=>fetch('/unintended');</script>`,
                );
            else if (req.url === "/frame")
                res.end(
                    `<label>Frame email <input type="email" id="email"></label><button onclick="document.getElementById('status').textContent='Frame submitted'">Submit frame</button><p id="status"></p><label>Existing secret <input autocomplete="current-password" type="password" value="do-not-export"></label><iframe src="http://127.0.0.1:${port}/nested"></iframe>`,
                );
            else if (req.url === "/nested")
                res.end(
                    "<label>Nested field <input id=\"nested\"></label><button onclick=\"this.textContent='Nested clicked '+document.getElementById('nested').value\">Nested action</button>",
                );
            else
                res.end(
                    `<h1>Root frame</h1><button>Root action</button><iframe title="cross-site form" src="http://localhost:${port}/frame" style="width:700px;height:400px"></iframe><iframe src="http://localhost:${port}/frame" style="display:none"></iframe>`,
                );
        });
        await new Promise((r) => server.listen(0, "0.0.0.0", r));
        win = new BrowserWindow({
            width: 1000,
            height: 800,
            show: true,
            webPreferences: { contextIsolation: true, nodeIntegration: false, webviewTag: true },
        });
        const attached = new Promise((resolve) =>
            win.webContents.once("did-attach-webview", (_event, contents) => resolve(contents)),
        );
        await win.loadURL(
            "data:text/html," +
                encodeURIComponent(
                    `<body style="margin:0"><webview partition="persist:fixture-session" src="http://127.0.0.1:${server.address().port}/" style="width:100vw;height:100vh" webpreferences="sandbox=yes,contextIsolation=yes,nodeIntegration=no"></webview>`,
                ),
        );
        guest = await attached;
        if (guest.isLoading())
            await new Promise((resolve) => guest.once("did-finish-load", resolve));
        win.show();
        win.focus();
        win.moveTop();
        const { BrowserPlaywright } = await import(
            pathToFileURL(join(directory, "browserPlaywright.mjs")).href
        );
        engine = new BrowserPlaywright(guest, () => allowed && !guest.isDestroyed());
        await engine.connect();
        const read = await engine.execute({ action: "read" });
        report.snapshot = read.text;
        assert.match(read.text, /Frame email/);
        assert.match(read.text, /Nested action/);
        assert(!read.text.includes("do-not-export"));
        assert.equal(
            read.text.split("\n").filter((l) => l.startsWith("[") && l.includes("Frame email"))
                .length,
            1,
        );
        report.checks.push(
            "cross-site and nested frames observed; hidden frames and values omitted",
        );
        const ref = (text, name) =>
            text
                .split("\n")
                .find((l) => l.startsWith("[") && l.includes(name))
                ?.match(/^\[([^\]]+)\]/)[1];
        const fill = await engine.execute({
            action: "fill",
            ref: ref(read.text, "Frame email"),
            text: "fixture@example.test",
        });
        assert(fill.ok);
        report.fill = fill.text;
        const click = await engine.execute({
            action: "click",
            ref: ref(fill.text, "Submit frame"),
        });
        assert(click.ok);
        assert.match(click.text, /Frame submitted/);
        report.checks.push("cross-site iframe native fill and click");
        const nestedFill = await engine.execute({
            action: "fill",
            ref: ref(click.text, "Nested field"),
            text: "nested-native",
        });
        assert(nestedFill.ok);
        const nested = await engine.execute({
            action: "click",
            ref: ref(nestedFill.text, "Nested action"),
        });
        assert.match(nested.text, /Nested clicked nested-native/);
        report.checks.push("nested iframe native fill and click verified by page output");
        const protectedField = await engine.execute({
            action: "fill",
            ref: ref(nested.text, "Existing secret"),
            text: "refused",
        });
        assert(!protectedField.ok);
        report.checks.push("iframe current-password guard");
        const go = async (path) => {
            await guest.loadURL(`http://127.0.0.1:${server.address().port}${path}`);
            return engine.execute({ action: "read" });
        };
        let snapshot = await go("/same");
        const same = await engine.execute({
            action: "fill",
            ref: ref(snapshot.text, "Same origin field"),
            text: "same-native",
        });
        assert(same.ok);
        assert.equal(
            await guest.executeJavaScript(
                'document.querySelector("iframe").contentDocument.getElementById("same").value',
            ),
            "same-native",
        );
        report.checks.push("same-origin in-process iframe fill writes the actual field");
        snapshot = await go("/batch");
        const pointers = [];
        const batch = await engine.execute(
            {
                action: "batch",
                steps: [
                    { action: "fill", ref: ref(snapshot.text, "First field"), text: "alpha" },
                    { action: "fill", ref: ref(snapshot.text, "Second field"), text: "beta" },
                    { action: "click", ref: ref(snapshot.text, "Finish batch") },
                ],
            },
            (p) => pointers.push(p),
        );
        report.batch = batch;
        assert.deepEqual(batch.batch, { completedSteps: 3, totalSteps: 3, reason: "completed" });
        assert(batch.ok);
        assert.deepEqual(
            await guest.executeJavaScript(
                '[document.getElementById("a").value,document.getElementById("b").value,window.done]',
            ),
            ["alpha", "beta", 1],
        );
        assert(
            pointers.some((p) => p.action === "fill") && pointers.some((p) => p.action === "click"),
        );
        report.checks.push(
            "bounded batch exact refs, one execution per step, automatic snapshot and pointer feedback",
        );
        snapshot = await go("/batch");
        await guest.executeJavaScript(
            'document.getElementById("b").outerHTML="<input id=\\\"replacement\\\">"',
        );
        const staleBatch = await engine.execute({
            action: "batch",
            steps: [
                { action: "fill", ref: ref(snapshot.text, "First field"), text: "must-not-write" },
                { action: "fill", ref: ref(snapshot.text, "Second field"), text: "must-not-write" },
            ],
        });
        assert(!staleBatch.ok);
        assert.equal(staleBatch.batch.completedSteps, 0);
        assert.equal(await guest.executeJavaScript('document.getElementById("a").value'), "");
        report.checks.push("batch preflight rejects a detached target before any writes");
        snapshot = await go("/change");
        const stopped = await engine.execute({
            action: "batch",
            steps: [
                { action: "click", ref: ref(snapshot.text, "Change page") },
                { action: "click", ref: ref(snapshot.text, "Old target") },
            ],
        });
        report.changed = stopped;
        assert.deepEqual(stopped.batch, {
            completedSteps: 1,
            totalSteps: 2,
            reason: "page_changed",
        });
        assert(stopped.ok);
        assert.match(stopped.text, /Replacement/);
        assert.equal(unintended, 0);
        report.checks.push("DOM replacement stops remaining writes and observes replacement");
        snapshot = await go("/shadow");
        const shadow = await engine.execute({
            action: "batch",
            steps: [
                { action: "click", ref: ref(snapshot.text, "Change shadow") },
                { action: "click", ref: ref(snapshot.text, "Old shadow target") },
            ],
        });
        assert.deepEqual(shadow.batch, {
            completedSteps: 1,
            totalSteps: 2,
            reason: "page_changed",
        });
        assert(shadow.ok);
        assert.match(shadow.text, /New shadow target/);
        assert.equal(unintended, 0);
        report.checks.push("open shadow-root changes stop remaining batch writes");
        snapshot = await go("/goto");
        const navigated = await engine.execute({
            action: "batch",
            steps: [
                { action: "click", ref: ref(snapshot.text, "Navigate away") },
                { action: "click", ref: ref(snapshot.text, "Do not click") },
            ],
        });
        report.navigated = navigated;
        assert.deepEqual(navigated.batch, {
            completedSteps: 1,
            totalSteps: 2,
            reason: "page_changed",
        });
        assert.match(navigated.text, /Navigation verified/);
        assert.equal(unintended, 0);
        report.checks.push("navigation stops batch without replay");
        snapshot = await go("/wait");
        await guest.executeJavaScript(
            'setTimeout(()=>document.getElementById("late").disabled=false,450)',
        );
        const waited = await engine.execute({
            action: "wait",
            condition: "enabled",
            ref: ref(snapshot.text, "Delayed control"),
            timeoutMs: 2500,
        });
        assert(waited.ok);
        assert(!waited.text.includes("[disabled]"));
        report.checks.push("enabled wait follows delayed state and observes result");
        snapshot = await go("/wait");
        const timed = await engine.execute({
            action: "wait",
            condition: "enabled",
            ref: ref(snapshot.text, "Delayed control"),
            timeoutMs: 150,
        });
        assert(!timed.ok);
        assert.match(timed.text, /\[disabled\]/);
        report.checks.push("wait timeout returns actual current state without clicking");
        const ready = await engine.execute({ action: "wait", condition: "load", timeoutMs: 1000 });
        assert(ready.ok);
        report.checks.push("load event wait");
        snapshot = await go("/wait");
        const lateRef = ref(snapshot.text, "Delayed control");
        await guest.executeJavaScript(
            'setTimeout(()=>document.getElementById("late").style.display="none",200)',
        );
        const hidden = await engine.execute({
            action: "wait",
            condition: "hidden",
            ref: lateRef,
            timeoutMs: 2000,
        });
        assert(hidden.ok);
        assert(!hidden.text.includes("Delayed control"));
        // A hidden control keeps its exact handle for this operation, without an intervening read.
        snapshot = await go("/wait");
        const visibleRef = ref(snapshot.text, "Delayed control");
        await guest.executeJavaScript(
            'document.getElementById("late").style.display="none";setTimeout(()=>document.getElementById("late").style.display="",200)',
        );
        const visible = await engine.execute({
            action: "wait",
            condition: "visible",
            ref: visibleRef,
            timeoutMs: 2000,
        });
        assert(visible.ok);
        assert.match(visible.text, /Delayed control/);
        report.checks.push("hidden and visible waits follow real frame element state");
        snapshot = await go("/wait");
        const cancel = engine.execute({
            action: "wait",
            condition: "enabled",
            ref: ref(snapshot.text, "Delayed control"),
            timeoutMs: 10000,
        });
        setTimeout(() => {
            allowed = false;
            engine.close();
        }, 200);
        await assert.rejects(cancel, /Browser control stopped/);
        report.checks.push("takeover cancels an in-flight wait without a stale observation");
        allowed = true;
        engine = new BrowserPlaywright(guest, () => allowed && !guest.isDestroyed());
        await engine.connect();
        await go("/login");
        const originalUrl = guest.getURL();
        engine.close();
        engine = new BrowserPlaywright(guest, () => allowed && !guest.isDestroyed());
        await engine.connect();
        const retained = await engine.execute({ action: "read" });
        assert.equal(guest.getURL(), originalUrl);
        assert.match(retained.text, /Fixture login created/);
        report.checks.push("fresh engine reconnect retains the same live page without navigation");
        const loggedIn = await go("/check");
        assert.match(loggedIn.text, /Authenticated fixture/);
        const sameSession = new BrowserWindow({
            show: false,
            webPreferences: {
                partition: "persist:fixture-session",
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        secondary.push(sameSession);
        await sameSession.loadURL(`http://127.0.0.1:${server.address().port}/check`);
        assert.equal(
            await sameSession.webContents.executeJavaScript(
                'document.querySelector("h1").textContent',
            ),
            "Authenticated fixture",
        );
        report.checks.push(
            "a distinct task page preserves the existing HttpOnly login session without exporting it",
        );
        const isolated = new BrowserWindow({
            show: false,
            webPreferences: {
                partition: "persist:other-fixture-account",
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        secondary.push(isolated);
        await isolated.loadURL(`http://127.0.0.1:${server.address().port}/check`);
        assert.equal(
            await isolated.webContents.executeJavaScript(
                'document.querySelector("h1").textContent',
            ),
            "No fixture login",
        );
        report.checks.push("separate profile partition isolates the other account");
    } catch (e) {
        report.failures.push(e.stack);
    } finally {
        writeFileSync(join(directory, "iframe-report.json"), JSON.stringify(report, null, 2));
        engine?.close();
        for (const window of secondary) window.destroy();
        win?.destroy();
        server?.closeAllConnections();
        server?.close();
        app.exit(report.failures.length ? 1 : 0);
    }
});
