/* 讲义精简版（对比用）：阅读进度条；没有保存过偏好时，默认收起左侧单元导航。 */
(function () {
    function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
    ready(function () {
        var bar = document.createElement("div");
        bar.className = "read-progress";
        document.body.appendChild(bar);
        function update() {
            var h = document.documentElement;
            var max = h.scrollHeight - h.clientHeight;
            bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
        }
        window.addEventListener("scroll", update, { passive: true });
        update();

        var pref = null;
        try { pref = window.localStorage.getItem("dsp-hide-nav"); } catch (e) {}
        if (pref === null && document.body.classList.contains("site-handout") &&
                !(window.matchMedia && window.matchMedia("(max-width: 900px)").matches)) {
            document.body.classList.add("hide-nav");
            setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 0);
        }
    });
})();
