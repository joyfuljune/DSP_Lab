/* 极客主题的小互动：左下角的“解谜终端”。
   点“>_”打开一个小终端，输入命令或直接输入答案。五道信号处理小谜题，全部破解后数字雨变成金色。
   命令：help 帮助，puzzle 看当前题，hint 提示，clear 清屏，reset 重新开始，exit 收起。进度只存在本机浏览器。 */
(function () {
    var KEY = "dsp-geek-term";
    var PUZZLES = [
        { q: "把下面的二进制按 ASCII 解码：01000100 01010011 01010000", a: ["dsp"], hint: "每 8 位一个字符，01000100 = 0x44 = 'D'。" },
        { q: "x[n] = [1 1 1 1 1 1 1 1]，它的 8 点 DFT 里 X[0] 等于多少？", n: 8, tol: 0, hint: "X[0] 是所有样本之和。" },
        { q: "系统 y[n] = 0.5 y[n-1] + x[n] 的极点 z 等于多少？", n: 0.5, tol: 0, hint: "H(z) = 1 / (1 - 0.5 z^-1)，令分母为零。" },
        { q: "采样频率 8000 Hz，做 1024 点 FFT，相邻两个频点相隔多少 Hz？（保留一位小数）", n: 7.8125, tol: 0.06, hint: "间隔 = 采样频率 / FFT 点数。" },
        { q: "单位脉冲 δ[n] 的 DTFT 等于多少？", n: 1, tol: 0, hint: "求和式里只剩 n = 0 这一项。" }
    ];
    var root = null, out = null, input = null, state = null, history = [], hpos = 0, handlers = [];

    function load() {
        var s = null;
        try { s = JSON.parse(window.localStorage.getItem(KEY) || "null"); } catch (e) {}
        if (!s || typeof s.level !== "number") s = { level: 0, open: false, done: false };
        return s;
    }
    function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
    function on(t, ty, fn) { t.addEventListener(ty, fn); handlers.push([t, ty, fn]); }
    function esc(t) { return String(t).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

    function print(text, cls) {
        var line = document.createElement("div");
        line.className = "gt-line" + (cls ? " " + cls : "");
        line.innerHTML = esc(text);
        out.appendChild(line);
        out.scrollTop = out.scrollHeight;
    }
    function gold(on) { if (on) document.documentElement.setAttribute("data-geek-gold", ""); else document.documentElement.removeAttribute("data-geek-gold"); }

    function showPuzzle() {
        if (state.done) { print("五道题都已破解。输入 reset 可以重新挑战。", "gt-ok"); return; }
        var p = PUZZLES[state.level];
        print("[第 " + (state.level + 1) + "/" + PUZZLES.length + " 关] " + p.q, "gt-q");
        print("直接输入答案，按回车提交。卡住了输入 hint。", "gt-dim");
    }
    function check(ans) {
        var p = PUZZLES[state.level];
        var a = ans.trim().toLowerCase().replace(/\s+/g, "");
        if (p.a) return p.a.indexOf(a) >= 0;
        var v = parseFloat(a.replace(/hz$/, ""));
        return !isNaN(v) && Math.abs(v - p.n) <= p.tol + 1e-9;
    }
    function run(cmd) {
        var c = cmd.trim();
        if (!c) return;
        print("dsp@lab:~$ " + c, "gt-echo");
        var low = c.toLowerCase();
        if (low === "help") {
            print("puzzle  查看当前谜题        hint   看提示");
            print("clear   清屏                reset  从第一关重来");
            print("exit    收起终端            其他输入都当作答案");
        } else if (low === "puzzle") { showPuzzle(); }
        else if (low === "hint") { if (!state.done) print("提示：" + PUZZLES[state.level].hint, "gt-dim"); }
        else if (low === "clear") { out.innerHTML = ""; }
        else if (low === "reset") { state.level = 0; state.done = false; save(); gold(false); print("进度已清空。", "gt-dim"); showPuzzle(); }
        else if (low === "exit") { toggle(false); }
        else if (low === "whoami") { print("guest@dsp-lab"); }
        else if (low === "sudo") { print("权限不足。先把题做完吧。", "gt-err"); }
        else if (state.done) { print("已经全部破解啦。输入 reset 重新挑战。", "gt-dim"); }
        else if (check(c)) {
            print("ACCESS GRANTED  第 " + (state.level + 1) + " 关通过", "gt-ok");
            state.level++;
            if (state.level >= PUZZLES.length) {
                state.level = PUZZLES.length - 1; state.done = true;
                print("全部破解！获得称号：信号破译者。数字雨已经变成金色。", "gt-ok");
                gold(true);
            } else { showPuzzle(); }
            save();
        } else { print("ACCESS DENIED  再想想，或者输入 hint。", "gt-err"); }
    }
    function toggle(open) {
        state.open = open; save();
        root.classList.toggle("is-open", open);
        if (open) { input.focus(); }
    }

    function start() {
        // 解锁页用 document.write 换掉整个页面时 window 会保留，旧的 root 已不在新页面里
        if (root && root.isConnected) return;
        if (root) stop();
        state = load();
        root = document.createElement("div");
        root.className = "gt-root" + (state.open ? " is-open" : "");
        root.innerHTML =
            '<button type="button" class="gt-launch" title="解谜终端" aria-label="打开解谜终端">&gt;_</button>' +
            '<div class="gt-win" role="dialog" aria-label="解谜终端">' +
            '<div class="gt-head"><span>dsp@lab — 解谜终端</span><button type="button" class="gt-x" aria-label="收起">×</button></div>' +
            '<div class="gt-out" aria-live="polite"></div>' +
            '<label class="gt-in"><span>dsp@lab:~$</span><input type="text" spellcheck="false" autocomplete="off" aria-label="输入命令或答案"></label>' +
            '</div>';
        document.body.appendChild(root);
        out = root.querySelector(".gt-out");
        input = root.querySelector("input");
        if (state.done) gold(true);
        print("DSP 解谜终端 v1.0　输入 help 查看命令。", "gt-dim");
        showPuzzle();
        on(root.querySelector(".gt-launch"), "click", function () { toggle(!root.classList.contains("is-open")); });
        on(root.querySelector(".gt-x"), "click", function () { toggle(false); });
        on(input, "keydown", function (e) {
            if (e.key === "Enter") { history.push(input.value); hpos = history.length; run(input.value); input.value = ""; }
            else if (e.key === "ArrowUp" && hpos > 0) { hpos--; input.value = history[hpos]; e.preventDefault(); }
            else if (e.key === "ArrowDown" && hpos < history.length) { hpos++; input.value = history[hpos] || ""; e.preventDefault(); }
            else if (e.key === "Escape") { toggle(false); }
        });
    }
    function stop() {
        for (var i = 0; i < handlers.length; i++) handlers[i][0].removeEventListener(handlers[i][1], handlers[i][2]);
        handlers = [];
        if (root && root.parentNode) root.parentNode.removeChild(root);
        root = null;
        gold(false);
    }
    window.DSPTerm = { start: start, stop: stop };
})();
