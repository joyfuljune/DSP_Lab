/* 草莓奶油主题的电子宠物“莓莓”：一只戴草莓帽的小兔子，待在页面左下角。
   - 眼睛跟着鼠标转，会眨眼、轻轻呼吸，偶尔原地蹦一下；
   - 戳它：弹一下，说一句话；
   - 喂草莓：点旁边的草莓按钮，草莓飞进嘴里，冒爱心；
   - 饿了（隔一段时间不喂）耳朵会耷拉，偶尔提醒你喂它；
   - 看到页面底部、测验答对时会夸你；
   - 可以点右上角的“×”收起，左下角留一个小耳朵，点一下再叫出来。
   状态只存在本机浏览器（localStorage），读写失败也能正常显示。 */
(function () {
    var KEY = "dsp-pet";
    var root = null, timers = [], listeners = [], observer = null, state = null;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var SAY = {
        poke: ["哎呀，别戳我啦～", "我在陪你看讲义呢", "卡住了就回去看看例题吧", "写代码前先想想变量名哦", "加油，你可以的！", "再戳我就要生气啦"],
        hungry: ["肚子饿了，想吃草莓……", "可以喂我一颗草莓吗？"],
        fed: ["好甜！谢谢你～", "吃饱啦，继续学习！", "草莓最好吃了！"],
        full: ["我已经吃饱啦，留着下次吧"],
        bottom: ["看到底啦，真棒！"],
        correct: ["答对了！奖励你一颗草莓的夸夸", "对啦对啦！"],
        hello: ["我是莓莓，陪你学数字信号处理～"]
    };

    function load() {
        var s = null;
        try { s = JSON.parse(window.localStorage.getItem(KEY) || "null"); } catch (e) {}
        if (!s || typeof s.hunger !== "number") s = { hunger: 30, t: Date.now(), hidden: false, met: false };
        var mins = Math.max(0, (Date.now() - (s.t || Date.now())) / 60000);
        s.hunger = Math.min(100, s.hunger + Math.min(mins / 2, 60));
        s.t = Date.now();
        return s;
    }
    function save() {
        if (!state) return;
        state.t = Date.now();
        try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function later(fn, ms) { var id = window.setTimeout(fn, ms); timers.push(id); return id; }
    function every(fn, ms) { var id = window.setInterval(fn, ms); timers.push(id); return id; }
    function on(target, type, fn, opt) { target.addEventListener(type, fn, opt); listeners.push([target, type, fn, opt]); }

    var BUNNY = '' +
        '<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">' +
        '<g class="pet-ears">' +
        '<g class="pet-ear pet-ear-l"><ellipse cx="36" cy="26" rx="9" ry="22" fill="#fff" stroke="#e7a9bf" stroke-width="2"/><ellipse cx="36" cy="28" rx="4.5" ry="15" fill="#ffc9d9"/></g>' +
        '<g class="pet-ear pet-ear-r"><ellipse cx="64" cy="26" rx="9" ry="22" fill="#fff" stroke="#e7a9bf" stroke-width="2"/><ellipse cx="64" cy="28" rx="4.5" ry="15" fill="#ffc9d9"/></g>' +
        '</g>' +
        '<g class="pet-body">' +
        '<ellipse cx="50" cy="66" rx="34" ry="27" fill="#fff" stroke="#e7a9bf" stroke-width="2.2"/>' +
        '<ellipse cx="34" cy="90" rx="9" ry="5" fill="#fff" stroke="#e7a9bf" stroke-width="2"/>' +
        '<ellipse cx="66" cy="90" rx="9" ry="5" fill="#fff" stroke="#e7a9bf" stroke-width="2"/>' +
        '<ellipse cx="30" cy="72" rx="6" ry="3.6" fill="#ffb3c7" opacity=".75"/>' +
        '<ellipse cx="70" cy="72" rx="6" ry="3.6" fill="#ffb3c7" opacity=".75"/>' +
        '<g class="pet-eyes">' +
        '<g class="pet-eye"><ellipse cx="39" cy="62" rx="4.6" ry="5.6" fill="#3b2a35"/><circle class="pet-glint" cx="40.6" cy="59.8" r="1.6" fill="#fff"/></g>' +
        '<g class="pet-eye"><ellipse cx="61" cy="62" rx="4.6" ry="5.6" fill="#3b2a35"/><circle class="pet-glint" cx="62.6" cy="59.8" r="1.6" fill="#fff"/></g>' +
        '</g>' +
        '<path class="pet-mouth" d="M45 71 q2.5 3 5 0 q2.5 3 5 0" fill="none" stroke="#b05a78" stroke-width="2" stroke-linecap="round"/>' +
        '<ellipse class="pet-mouth-open" cx="50" cy="73" rx="4" ry="3.4" fill="#b05a78"/>' +
        '</g>' +
        '<g class="pet-hat" transform="translate(41 33) scale(.75)">' +
        '<path d="M12 23 C11 20.8 5 16.5 5 10.5 C5 7.6 7.4 5.6 12 5.6 C16.6 5.6 19 7.6 19 10.5 C19 16.5 13 20.8 12 23 Z" fill="#ff4d6d" stroke="#a3123a" stroke-width="1"/>' +
        '<circle cx="9" cy="10" r=".8" fill="#ffe7a3"/><circle cx="12" cy="9" r=".8" fill="#ffe7a3"/><circle cx="15" cy="10" r=".8" fill="#ffe7a3"/><circle cx="10.5" cy="13.5" r=".8" fill="#ffe7a3"/><circle cx="13.5" cy="13.5" r=".8" fill="#ffe7a3"/><circle cx="12" cy="17" r=".8" fill="#ffe7a3"/>' +
        '<path d="M12 7.2 L8.2 4.6 L10.6 6.8 L6.9 7.1 L10.4 7.8 L12 9.2 L13.6 7.8 L17.1 7.1 L13.4 6.8 L15.8 4.6 Z" fill="#3fb37f" stroke="#1f7a52" stroke-width=".5"/>' +
        '</g>' +
        '</svg>';
    var BERRY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 23 C11 20.8 5 16.5 5 10.5 C5 7.6 7.4 5.6 12 5.6 C16.6 5.6 19 7.6 19 10.5 C19 16.5 13 20.8 12 23 Z" fill="#ff4d6d" stroke="#a3123a" stroke-width="1"/><circle cx="9" cy="10" r=".8" fill="#ffe7a3"/><circle cx="12" cy="9" r=".8" fill="#ffe7a3"/><circle cx="15" cy="10" r=".8" fill="#ffe7a3"/><circle cx="10.5" cy="13.5" r=".8" fill="#ffe7a3"/><circle cx="13.5" cy="13.5" r=".8" fill="#ffe7a3"/><circle cx="12" cy="17" r=".8" fill="#ffe7a3"/><path d="M12 7.2 L8.2 4.6 L10.6 6.8 L6.9 7.1 L10.4 7.8 L12 9.2 L13.6 7.8 L17.1 7.1 L13.4 6.8 L15.8 4.6 Z" fill="#3fb37f" stroke="#1f7a52" stroke-width=".5"/></svg>';

    var bubbleTimer = null;
    function say(text, ms) {
        if (!root) return;
        var b = root.querySelector(".pet-bubble");
        b.textContent = text;
        b.classList.add("show");
        if (bubbleTimer) window.clearTimeout(bubbleTimer);
        bubbleTimer = later(function () { b.classList.remove("show"); }, ms || 2800);
    }
    function play(cls, ms) {
        if (!root || reduce) return;
        var p = root.querySelector(".pet");
        p.classList.remove(cls);
        void p.offsetWidth;
        p.classList.add(cls);
        later(function () { p.classList.remove(cls); }, ms);
    }
    function hearts(n) {
        if (!root || reduce) return;
        for (var i = 0; i < n; i++) {
            (function (k) {
                later(function () {
                    var h = document.createElement("span");
                    h.className = "pet-heart";
                    h.textContent = "♥";
                    h.style.left = (30 + Math.random() * 40) + "px";
                    root.appendChild(h);
                    later(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 1400);
                }, k * 160);
            })(i);
        }
    }
    function mood() {
        if (!root) return;
        root.classList.toggle("is-hungry", state.hunger >= 60);
    }

    function feed() {
        if (state.hunger < 15) { say(pick(SAY.full)); play("pet-shake", 500); return; }
        var berry = document.createElement("span");
        berry.className = "pet-flying-berry";
        berry.innerHTML = BERRY;
        root.appendChild(berry);
        var p = root.querySelector(".pet");
        later(function () { berry.classList.add("go"); }, 20);
        later(function () {
            if (berry.parentNode) berry.parentNode.removeChild(berry);
            p.classList.add("pet-chomp");
            hearts(4);
            say(pick(SAY.fed));
            state.hunger = Math.max(0, state.hunger - 45);
            save(); mood();
            later(function () { p.classList.remove("pet-chomp"); }, 900);
        }, reduce ? 50 : 620);
    }

    function lookAt(x, y) {
        if (!root) return;
        var eyes = root.querySelectorAll(".pet-eye");
        var box = root.querySelector(".pet-svg").getBoundingClientRect();
        var cx = box.left + box.width / 2, cy = box.top + box.height * 0.62;
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var mx = (dx / d) * Math.min(2.2, d / 60), my = (dy / d) * Math.min(1.8, d / 60);
        for (var i = 0; i < eyes.length; i++) eyes[i].setAttribute("transform", "translate(" + mx.toFixed(2) + " " + my.toFixed(2) + ")");
    }

    function start() {
        // 解锁页用 document.write 换掉整个页面时 window 会保留，旧的 root 已不在新页面里
        if (root && root.isConnected) return;
        if (root) stop();
        state = load();
        root = document.createElement("div");
        root.className = "pet-root" + (state.hidden ? " is-hidden" : "");
        root.innerHTML =
            '<div class="pet-bubble" role="status" aria-live="polite"></div>' +
            '<button type="button" class="pet" title="戳一戳莓莓">' + BUNNY + '</button>' +
            '<button type="button" class="pet-feed" title="喂一颗草莓">' + BERRY + '</button>' +
            '<button type="button" class="pet-close" title="收起莓莓" aria-label="收起莓莓">×</button>' +
            '<button type="button" class="pet-tab" title="叫出莓莓" aria-label="叫出莓莓"><svg viewBox="0 0 40 24" aria-hidden="true"><ellipse cx="13" cy="16" rx="6" ry="14" fill="#fff" stroke="#e7a9bf" stroke-width="2"/><ellipse cx="27" cy="16" rx="6" ry="14" fill="#fff" stroke="#e7a9bf" stroke-width="2"/><ellipse cx="13" cy="17" rx="3" ry="9" fill="#ffc9d9"/><ellipse cx="27" cy="17" rx="3" ry="9" fill="#ffc9d9"/></svg></button>';
        document.body.appendChild(root);
        mood();

        var pokes = 0;
        on(root.querySelector(".pet"), "click", function () {
            pokes++;
            play("pet-bounce", 600);
            if (state.hunger >= 60 && Math.random() < 0.5) say(pick(SAY.hungry));
            else say(pokes > 6 && Math.random() < 0.4 ? SAY.poke[5] : pick(SAY.poke.slice(0, 5)));
        });
        on(root.querySelector(".pet-feed"), "click", feed);
        on(root.querySelector(".pet-close"), "click", function () { root.classList.add("is-hidden"); state.hidden = true; save(); });
        on(root.querySelector(".pet-tab"), "click", function () { root.classList.remove("is-hidden"); state.hidden = false; save(); play("pet-bounce", 600); say(pick(SAY.hello)); });
        on(document, "mousemove", function (e) { lookAt(e.clientX, e.clientY); }, { passive: true });

        // 眨眼、偶尔蹦一下、慢慢变饿
        if (!reduce) {
            every(function () {
                var p = root && root.querySelector(".pet");
                if (!p) return;
                p.classList.add("pet-blink");
                later(function () { p.classList.remove("pet-blink"); }, 160);
            }, 3800);
            every(function () { if (Math.random() < 0.35) play("pet-hop", 700); }, 9000);
        }
        every(function () {
            state.hunger = Math.min(100, state.hunger + 1);
            save(); mood();
            if (state.hunger >= 60 && Math.random() < 0.25 && !root.classList.contains("is-hidden")) say(pick(SAY.hungry));
        }, 120000);

        // 看到页面底部
        var cheered = false;
        on(window, "scroll", function () {
            var h = document.documentElement;
            if (!cheered && h.scrollTop + h.clientHeight >= h.scrollHeight - 40 && h.scrollHeight > h.clientHeight * 1.5) {
                cheered = true; play("pet-hop", 700); hearts(3); say(SAY.bottom[0]);
            }
        }, { passive: true });

        // 测验答对
        if (window.MutationObserver) {
            observer = new MutationObserver(function (list) {
                for (var i = 0; i < list.length; i++) {
                    var n = list[i].target;
                    if (n.nodeType === 1 && n.classList && n.classList.contains("feedback") && n.classList.contains("correct")) {
                        play("pet-hop", 700); hearts(3); say(pick(SAY.correct)); return;
                    }
                }
            });
            observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], childList: false });
        }

        if (!state.met && !state.hidden) { state.met = true; save(); later(function () { say(SAY.hello[0], 3500); }, 900); }
    }

    function stop() {
        for (var i = 0; i < timers.length; i++) { window.clearTimeout(timers[i]); window.clearInterval(timers[i]); }
        timers = [];
        for (var j = 0; j < listeners.length; j++) listeners[j][0].removeEventListener(listeners[j][1], listeners[j][2], listeners[j][3]);
        listeners = [];
        if (observer) { observer.disconnect(); observer = null; }
        if (root && root.parentNode) root.parentNode.removeChild(root);
        root = null;
        save();
    }

    window.DSPPet = { start: start, stop: stop };
})();
