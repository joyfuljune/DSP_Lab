/* 主题切换：简洁（默认）、极客、卡通、粗野。极客自带解谜终端，卡通自带电子宠物，粗野自带冷知识按钮。
   在 <head> 里同步执行，先给 <html> 设 data-theme，避免闪一下默认样式；页面就绪后在顶栏放切换按钮。
   偏好只存在本机浏览器（localStorage），读写失败时用默认主题。 */
(function () {
    var THEMES = [
        { id: "clean", name: "简洁", sw: ["#ffffff", "#2f6fde"] },
        { id: "geek", name: "极客", sw: ["#000000", "#00ff41"] },
        { id: "macaron", name: "卡通", sw: ["#ff4d6d", "#fff3dc"] },
        { id: "brutal", name: "粗野", sw: ["#ffd23f", "#111111"] }
    ];
    var SHOWN = ["clean", "geek", "macaron", "brutal"];
    var KEY = "dsp-theme";
    var root = document.documentElement;
    var ASSETS = ((document.currentScript && document.currentScript.src) || "").replace(/js\/theme\.js.*$/, "");

    function valid(id) {
        for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return true;
        return false;
    }
    function load() {
        var m = /[?&]theme=([a-z]+)/.exec(window.location.search);
        var q = m ? (m[1] === "matrix" ? "geek" : m[1]) : null;
        if (q && valid(q)) { save(q); return q; }
        var v = null;
        try { v = window.localStorage.getItem(KEY); } catch (e) {}
        if (v === "matrix") v = "geek";
        return valid(v) ? v : "clean";
    }
    function save(id) {
        try { window.localStorage.setItem(KEY, id); } catch (e) {}
    }
    var current = load();
    root.setAttribute("data-theme", current);

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 极客：背景数字雨（只用数字、十六进制字母和几个信号处理符号） ---------- */
    var rain = null;
    function startRain() {
        if (rain || reduceMotion) return;
        var canvas = document.createElement("canvas");
        canvas.id = "theme-fx";
        canvas.setAttribute("aria-hidden", "true");
        document.body.insertBefore(canvas, document.body.firstChild);
        var ctx = canvas.getContext("2d");
        var chars = "0101010101010123456789ABCDEF0101ωπΣΔ∫";
        var size = 16, cols = 0, drops = [], timer = null;
        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            cols = Math.ceil(canvas.width / size);
            drops = [];
            for (var i = 0; i < cols; i++) drops.push(Math.floor(Math.random() * -60));
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        function frame() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = size + "px 'Share Tech Mono', Consolas, monospace";
            for (var i = 0; i < cols; i++) {
                var y = drops[i] * size;
                if (y > 0) {
                    var ch = chars.charAt(Math.floor(Math.random() * chars.length));
                    var gold = root.hasAttribute("data-geek-gold");
                    ctx.fillStyle = Math.random() < 0.08 ? (gold ? "#fff6cc" : "#e8ffec") : (gold ? "#ffd23f" : "#00ff41");
                    ctx.fillText(ch, i * size, y);
                }
                if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        }
        function loop() {
            if (!document.hidden) frame();
            timer = window.setTimeout(loop, 70);
        }
        resize();
        window.addEventListener("resize", resize);
        loop();
        rain = { stop: function () {
            window.clearTimeout(timer);
            window.removeEventListener("resize", resize);
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        } };
    }
    function stopRain() { if (rain) { rain.stop(); rain = null; } }

    /* ---------- 各主题的小互动，按需加载：极客→解谜终端，卡通→电子宠物，粗野→冷知识按钮 ---------- */
    var WIDGETS = { geek: ["js/geek-term.js", "DSPTerm"], macaron: ["js/pet.js", "DSPPet"], brutal: ["js/facts.js", "DSPFacts"] };
    var loading = {};
    function startWidget(id) {
        var w = WIDGETS[id];
        if (!w) return;
        if (window[w[1]]) { window[w[1]].start(); return; }
        if (loading[id] || !ASSETS) return;
        loading[id] = true;
        var sc = document.createElement("script");
        sc.src = ASSETS + w[0];
        sc.onload = function () { loading[id] = false; if (root.getAttribute("data-theme") === id && window[w[1]]) window[w[1]].start(); };
        document.head.appendChild(sc);
    }
    function stopWidgets(except) {
        for (var k in WIDGETS) if (k !== except && window[WIDGETS[k][1]]) window[WIDGETS[k][1]].stop();
    }

    function applyEffects(id) {
        if (id === "geek") startRain(); else stopRain();
        stopWidgets(id);
        startWidget(id);
    }

    function setTheme(id) {
        if (!valid(id)) return;
        current = id;
        root.setAttribute("data-theme", id);
        save(id);
        applyEffects(id);
        var items = document.querySelectorAll(".theme-menu [data-theme-id]");
        for (var i = 0; i < items.length; i++) {
            items[i].setAttribute("aria-checked", items[i].getAttribute("data-theme-id") === id ? "true" : "false");
        }
    }

    function buildSwitcher() {
        var bar = document.querySelector(".topbar");
        if (!bar || bar.querySelector(".theme-switch")) return;
        var wrap = document.createElement("div");
        wrap.className = "theme-switch";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-btn";
        btn.setAttribute("aria-haspopup", "true");
        btn.setAttribute("aria-expanded", "false");
        btn.title = "切换主题";
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg><span>主题</span>';
        var menu = document.createElement("div");
        menu.className = "theme-menu";
        menu.setAttribute("role", "menu");
        menu.hidden = true;
        for (var i = 0; i < THEMES.length; i++) {
            var t = THEMES[i];
            if (SHOWN.indexOf(t.id) < 0 && t.id !== current) continue;
            var item = document.createElement("button");
            item.type = "button";
            item.setAttribute("role", "menuitemradio");
            item.setAttribute("data-theme-id", t.id);
            item.setAttribute("aria-checked", t.id === current ? "true" : "false");
            item.innerHTML = '<span class="theme-sw" style="background:linear-gradient(135deg,' + t.sw[0] + ' 0 50%,' + t.sw[1] + ' 50% 100%)"></span><span class="theme-name">' + t.name + '</span><span class="theme-check" aria-hidden="true">✓</span>';
            menu.appendChild(item);
        }
        function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            menu.hidden = !menu.hidden;
            btn.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
        });
        menu.addEventListener("click", function (e) {
            var it = e.target.closest ? e.target.closest("[data-theme-id]") : null;
            if (!it) return;
            setTheme(it.getAttribute("data-theme-id"));
            close();
        });
        document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
        wrap.appendChild(btn);
        wrap.appendChild(menu);
        bar.appendChild(wrap);
    }

    function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
    ready(function () {
        buildSwitcher();
        applyEffects(current);
    });
})();
