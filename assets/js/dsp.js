(function () {
    "use strict";

    function getUnits() { return window.DSP_UNITS || []; }

    function element(tagName, className, text) {
        var node = document.createElement(tagName);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function relativePath(pagePath) {
        return (document.body.getAttribute("data-base") || "./") + pagePath;
    }

    function addUnitNavigation() {
        var slot = document.querySelector("[data-unit-nav]");
        if (!slot) return;
        var units = getUnits();
        var current = slot.getAttribute("data-current") || "";
        var tabs = document.querySelector(".topbar .tabs");
        if (tabs) {
            var mobileTabs = tabs.cloneNode(true);
            mobileTabs.className = "mobile-tabs";
            slot.appendChild(mobileTabs);
        }
        slot.appendChild(element("h4", "", "实验"));
        units.filter(function (unit) { return unit.kind === "实验"; }).forEach(function (unit) {
            var link = element("a", unit.id === current ? "on" : "", unit.name.replace(" · ", " "));
            link.href = relativePath(unit.handout);
            slot.appendChild(link);
        });
        slot.appendChild(element("h4", "", "项目"));
        units.filter(function (unit) { return unit.kind === "项目"; }).forEach(function (unit) {
            var link = element("a", unit.id === current ? "on" : "", unit.name.replace(" · ", " "));
            link.href = relativePath(unit.handout);
            slot.appendChild(link);
        });
    }

    function addUnitCards() {
        var grid = document.querySelector("[data-unit-cards]");
        if (!grid) return;
        var units = getUnits();
        units.forEach(function (unit) {
            var card = element("section", "unit-card");
            card.setAttribute("data-kind", unit.kind);
            card.appendChild(element("h2", "", unit.name));
            card.appendChild(element("p", "", unit.description));
            var status = element("span", "unit-status", "未解锁");
            if (!unit.encrypted) {
                status.textContent = "公开";
                status.classList.add("open");
            } else if (window.DSPCrypto && window.DSPCrypto.hasSavedKey(unit.id)) {
                status.textContent = "本机已解锁";
                status.classList.add("open");
            }
            card.appendChild(status);
            card.appendChild(document.createElement("br"));
            var link = element("a", "open-link", "打开讲义");
            link.href = relativePath(unit.handout);
            card.appendChild(link);
            grid.appendChild(card);
        });
    }

    function refreshTOC() {
        var slot = document.querySelector("[data-page-toc]");
        var article = document.querySelector("main article.content");
        if (!slot || !article) return;
        slot.replaceChildren();
        var used = Object.create(null);
        var headings = Array.prototype.slice.call(article.querySelectorAll("h2, h3"));
        headings.forEach(function (heading, index) {
            // 目录文字不带“理论”“实践”这类标签
            var copy = heading.cloneNode(true);
            Array.prototype.forEach.call(copy.querySelectorAll(".tag"), function (tag) { tag.remove(); });
            var text = copy.textContent.trim();
            if (!heading.getClientRects().length) return;
            if (heading.closest(".interactive-demo, .canvas-container, .demo-pair")) return;   // 演示图里的小标题不进目录
            var id = heading.id || ("heading-" + index + "-" + text.toLowerCase().replace(/[^\w\u3400-\u9fff-]+/g, "-").replace(/^-+|-+$/g, ""));
            if (used[id]) id += "-" + index;
            used[id] = true;
            heading.id = id;
            var link = element("a", heading.tagName === "H3" ? "sub" : "", text);
            link.href = "#" + id;
            link.title = text;
            slot.appendChild(link);
        });
        var sidebar = document.querySelector(".sidebar");
        var mobileToc = document.querySelector(".mobile-toc");
        if (sidebar && !mobileToc) {
            mobileToc = element("div", "mobile-toc");
            sidebar.appendChild(mobileToc);
        }
        if (mobileToc) {
            mobileToc.replaceChildren(element("h4", "", "本页目录"));
            Array.prototype.forEach.call(slot.children, function (link) {
                mobileToc.appendChild(link.cloneNode(true));
            });
        }
        spyTOC();
    }

    function spyTOC() {
        var links = Array.prototype.slice.call(document.querySelectorAll("[data-page-toc] a"));
        var active = 0;
        links.forEach(function (link, index) {
            var heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
            if (heading && heading.getBoundingClientRect().top < 140) active = index;
        });
        links.forEach(function (link, index) { link.classList.toggle("on", index === active); });
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        return new Promise(function (resolve, reject) {
            var area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.left = "-10000px";
            document.body.appendChild(area);
            area.select();
            try {
                if (document.execCommand("copy")) resolve();
                else reject(new Error("Copy is unavailable"));
            } catch (error) {
                reject(error);
            } finally {
                area.remove();
            }
        });
    }

    function bindCopyButtons() {
        document.querySelectorAll(".code .bar button, .code-copy-button, .copy-btn").forEach(function (button) {
            if (button.dataset.dspCopyBound === "true") return;
            button.dataset.dspCopyBound = "true";
            button.addEventListener("click", function (event) {
                if (button.hasAttribute("onclick") && button.getAttribute("onclick").indexOf("copyCode") >= 0) return;
                event.preventDefault();
                var group = button.closest(".code, .code-block, .file-block") || button.parentElement;
                var targetId = button.getAttribute("data-copy-target");
                var code = targetId ? document.getElementById(targetId) : group.querySelector("pre, code");
                if (!code) return;
                copyText(code.innerText || code.textContent).then(function () {
                    var previous = button.textContent;
                    button.textContent = "已复制";
                    window.setTimeout(function () { button.textContent = previous; }, 1200);
                }).catch(function () { button.textContent = "复制失败"; });
            });
        });
    }

    // 左侧单元导航、右侧本页目录都可收起；宽屏下状态记在本机，窄屏下左按钮仍是弹出式目录
    function readPref(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
    function writePref(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* 存不了也照常使用 */ } }
    function isNarrow() { return window.matchMedia && window.matchMedia("(max-width: 900px)").matches; }

    function initMenu() {
        var body = document.body;
        var button = document.querySelector(".menu-btn");
        var layout = document.querySelector(".layout");
        var sidebar = document.querySelector(".layout > .sidebar");
        var toc = document.querySelector(".layout > .toc");
        if (readPref("dsp-hide-nav") === "1") body.classList.add("hide-nav");
        if (readPref("dsp-hide-toc") === "1") body.classList.add("hide-toc");

        // 窄屏：顶栏“目录”按钮打开导航浮层（宽屏由 CSS 隐藏）
        if (button && sidebar) {
            button.textContent = "目录";
            button.addEventListener("click", function () {
                var opened = body.classList.toggle("nav-open");
                button.setAttribute("aria-expanded", String(opened));
            });
        } else if (button) {
            button.style.display = "none";
        }

        // 宽屏：在导航栏、目录栏与正文的夹缝处各放一个三角按钮
        function seam(side, target, cls, key) {
            if (!target) return null;
            var b = element("button", "seam-btn seam-" + side);
            b.type = "button";
            b.addEventListener("click", function () {
                var hidden = body.classList.toggle(cls);
                writePref(key, hidden ? "1" : "0");
                place();
            });
            body.appendChild(b);
            return b;
        }
        var left = seam("left", sidebar, "hide-nav", "dsp-hide-nav");
        var right = seam("right", toc, "hide-toc", "dsp-hide-toc");

        function place() {
            var narrow = isNarrow();
            var box = layout ? layout.getBoundingClientRect() : { left: 0, right: window.innerWidth };
            if (left) {
                var hiddenL = body.classList.contains("hide-nav");
                left.style.display = narrow ? "none" : "";
                var xl = hiddenL ? box.left : sidebar.getBoundingClientRect().right;
                left.style.left = Math.max(2, xl - 12) + "px";
                left.textContent = hiddenL ? "▶" : "◀";
                left.title = hiddenL ? "展开导航" : "收起导航";
                left.setAttribute("aria-label", left.title);
                left.setAttribute("aria-expanded", String(!hiddenL));
            }
            if (right) {
                var hiddenR = body.classList.contains("hide-toc");
                var noToc = window.matchMedia && window.matchMedia("(max-width: 1280px)").matches;
                right.style.display = (narrow || noToc) ? "none" : "";
                var xr = hiddenR ? box.right : toc.getBoundingClientRect().left;
                right.style.left = Math.min(window.innerWidth - 26, xr - 12) + "px";
                right.textContent = hiddenR ? "◀" : "▶";
                right.title = hiddenR ? "展开目录" : "收起目录";
                right.setAttribute("aria-label", right.title);
                right.setAttribute("aria-expanded", String(!hiddenR));
            }
        }
        place();
        window.addEventListener("resize", place);
        window.addEventListener("load", place);
    }

    function configureMathJax() {
        window.MathJax = Object.assign({
            tex2jax: {
                inlineMath: [["$", "$"], ["\\(", "\\)"]],
                displayMath: [["$$", "$$"], ["\\[", "\\]"]],
                processEscapes: true,
                skipTags: ["script", "noscript", "style", "textarea", "pre", "code", "annotation", "annotation-xml"]
            },
            "HTML-CSS": { scale: 100, linebreaks: { automatic: true } },
            CommonHTML: { scale: 100, linebreaks: { automatic: true } },
            showProcessingMessages: false,
            messageStyle: "none"
        }, window.MathJax || {});
    }

    // MATLAB 语法着色：关键字、注释、字符串，配色仿 MATLAB 编辑器（深色底）
    var MATLAB_KEYWORDS = ["function", "end", "if", "elseif", "else", "for", "while", "switch", "case",
        "otherwise", "return", "break", "continue", "try", "catch", "global", "persistent", "parfor"];
    function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function highlightMatlabLine(line) {
        var out = "", i = 0, n = line.length, prev = "";
        while (i < n) {
            var ch = line[i];
            if (ch === "%") {                                   // 注释到行尾
                out += '<span class="m-cm">' + escapeHtml(line.slice(i)) + "</span>";
                break;
            }
            if (ch === "'" && !/[\w\)\]\}\.'"]/.test(prev)) {   // 字符向量（排除转置）
                var j = i + 1;
                while (j < n) { if (line[j] === "'" && line[j + 1] === "'") { j += 2; continue; } if (line[j] === "'") break; j++; }
                out += '<span class="m-st">' + escapeHtml(line.slice(i, Math.min(j + 1, n))) + "</span>";
                prev = "'"; i = j + 1; continue;
            }
            if (ch === '"') {                                   // 字符串
                var k = line.indexOf('"', i + 1); if (k < 0) k = n - 1;
                out += '<span class="m-st">' + escapeHtml(line.slice(i, k + 1)) + "</span>";
                prev = '"'; i = k + 1; continue;
            }
            if (/[A-Za-z_]/.test(ch)) {
                var m = /^[A-Za-z_]\w*/.exec(line.slice(i))[0];
                var isKw = MATLAB_KEYWORDS.indexOf(m) >= 0 && !(m === "end" && /[\(\{,:]\s*$/.test(out.replace(/<[^>]+>/g, "")));
                out += isKw ? '<span class="m-kw">' + m + "</span>" : escapeHtml(m);
                prev = m[m.length - 1]; i += m.length; continue;
            }
            out += escapeHtml(ch);
            if (!/\s/.test(ch)) prev = ch;
            i++;
        }
        return out;
    }
    function highlightMatlab(root) {
        (root || document).querySelectorAll(".code-block code, .code pre, .site-page pre").forEach(function (el) {
            if (el.tagName === "PRE" && el.querySelector("code")) return;   // pre 里有 code 的，交给 code 处理
            if (el.classList.contains("cmd-output")) return;                // 命令窗口输出不着色
            if (el.dataset.mhl || el.querySelector("span")) return;          // 已着色或手工着色的跳过
            var text = el.textContent.replace(/^\n+/, "").replace(/\s+$/, "");
            el.innerHTML = text.split("\n").map(highlightMatlabLine).join("\n");
            el.dataset.mhl = "1";
        });
    }

    function initialize() {
        highlightMatlab(document);
        document.querySelectorAll(".code-block").forEach(function (block) {
            var code = block.querySelector("code");
            if (!code) return;
            if (code.querySelector(".code-line")) block.classList.add("code-lines");
            var bar = element("div", "bar");
            bar.appendChild(element("span", "", "MATLAB"));
            var button = element("button", "", "复制代码");
            button.type = "button";
            bar.appendChild(button);
            block.insertBefore(bar, block.firstChild);
            block.classList.add("code");
        });
        addUnitNavigation();
        addUnitCards();
        initMenu();
        bindCopyButtons();
        refreshTOC();
        document.querySelectorAll(".file-toggle").forEach(function (button) {
            button.addEventListener("click", function () {
                var block = button.closest(".file-block");
                var open = block.classList.contains("collapsed");
                block.classList.toggle("collapsed", !open);
                button.setAttribute("aria-expanded", String(open));
            });
        });
        document.querySelectorAll("[data-fold-all]").forEach(function (button) {
            button.addEventListener("click", function () {
                var open = button.dataset.foldAll === "open";
                document.querySelectorAll(".file-block").forEach(function (block) {
                    block.classList.toggle("collapsed", !open);
                    var toggle = block.querySelector(".file-toggle");
                    if (toggle) toggle.setAttribute("aria-expanded", String(open));
                });
            });
        });
        document.addEventListener("scroll", spyTOC, { passive: true });
    }

    configureMathJax();
    window.DSPSite = { refreshTOC: refreshTOC, copyText: copyText };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
}());
