(function () {
    "use strict";

    var ITERATIONS = 310000;
    var PREFIX = "dsp-site-key:";
    var encoder = new TextEncoder();
    var decoder = new TextDecoder("utf-8", { fatal: true });
    var memoryKeys = window.__DSP_SITE_KEYS || Object.create(null);
    window.__DSP_SITE_KEYS = memoryKeys;

    function fromBase64(value) {
        var raw = atob(value);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
        return bytes;
    }

    function toBase64(bytes) {
        var raw = "";
        bytes.forEach(function (byte) { raw += String.fromCharCode(byte); });
        return btoa(raw);
    }

    function storageKey(unitId) { return PREFIX + unitId; }

    function hasSavedKey(unitId) {
        try { return !!localStorage.getItem(storageKey(unitId)); }
        catch (error) { return false; }
    }

    async function deriveKey(password, salt, iterations) {
        var material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
        var raw = new Uint8Array(await crypto.subtle.deriveBits({
            name: "PBKDF2", salt: fromBase64(salt), iterations: iterations || ITERATIONS, hash: "SHA-256"
        }, material, 256));
        var key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
        return { raw: raw, key: key };
    }

    async function savedKey(unitId) {
        if (memoryKeys[unitId]) return memoryKeys[unitId];
        try {
            var data = localStorage.getItem(storageKey(unitId));
            if (!data) return null;
            var raw = fromBase64(data);
            if (raw.length !== 32) {
                localStorage.removeItem(storageKey(unitId));
                return null;
            }
            return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
        } catch (error) { return null; }
    }

    function saveKey(unitId, raw) {
        try { localStorage.setItem(storageKey(unitId), toBase64(raw)); }
        catch (error) { /* Unlock works for this page even when storage is disabled. */ }
    }

    async function decryptBytes(key, iv, ciphertext, unitId) {
        return new Uint8Array(await crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: iv,
            additionalData: encoder.encode("DSP-SITE:" + unitId),
            tagLength: 128
        }, key, ciphertext));
    }

    function removeThirdPartyScriptTags(html) {
        var urls = [];
        html = html.replace(/<script\b([^>]*\bsrc=["']([^"']+)["'][^>]*)>\s*<\/script\s*>/gi, function (tag, attrs, src) {
            if (/MathJax\.js|html2canvas(?:\.min)?\.js/i.test(src)) {
                urls.push(src);
                return "";
            }
            return tag;
        });
        return { html: html, urls: urls };
    }

    function loadPageLibraries(urls) {
        urls.forEach(function (url) {
            var script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = function () {
                if (/MathJax\.js/i.test(url) && window.MathJax && window.MathJax.Hub && window.MathJax.Hub.Queue) {
                    window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
                }
            };
            script.onerror = function () {
                console.error("无法加载页面组件", url);
            };
            document.head.appendChild(script);
        });
    }

    function replaceWithPage(bytes) {
        var cleaned = removeThirdPartyScriptTags(decoder.decode(bytes));
        document.open();
        document.write(cleaned.html);
        document.close();
        loadPageLibraries(cleaned.urls);
    }

    async function attemptSavedUnlock(wrapper) {
        var key = await savedKey(wrapper.dataset.unit);
        if (!key) return;
        try {
            var cipher = fromBase64(document.getElementById("encryptedPage").textContent.trim());
            var plain = await decryptBytes(key, fromBase64(wrapper.dataset.iv), cipher, wrapper.dataset.unit);
            memoryKeys[wrapper.dataset.unit] = key;
            replaceWithPage(plain);
        } catch (error) {
            delete memoryKeys[wrapper.dataset.unit];
            try { localStorage.removeItem(storageKey(wrapper.dataset.unit)); } catch (storageError) { }
        }
    }

    function initializeUnlock() {
        var wrapper = document.querySelector("[data-locked-page]");
        if (!wrapper) return;
        var form = document.getElementById("unlockForm");
        var input = document.getElementById("unitPassword");
        var message = document.getElementById("unlockError");
        var button = form.querySelector("button[type=submit]");
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            message.textContent = "";
            button.disabled = true;
            deriveKey(input.value, wrapper.dataset.salt, Number(wrapper.dataset.iterations)).then(function (material) {
                var cipher = fromBase64(document.getElementById("encryptedPage").textContent.trim());
                return decryptBytes(material.key, fromBase64(wrapper.dataset.iv), cipher, wrapper.dataset.unit)
                    .then(function (plain) {
                        memoryKeys[wrapper.dataset.unit] = material.key;
                        saveKey(wrapper.dataset.unit, material.raw);
                        replaceWithPage(plain);
                    });
            }).catch(function () {
                message.textContent = "密码不对";
                input.value = "";
                input.focus();
            }).finally(function () { button.disabled = false; });
        });
        attemptSavedUnlock(wrapper).then(function () { input.focus(); });
    }

    async function decryptDownload(link) {
        var unitId = link.dataset.unit;
        var key = await savedKey(unitId);
        if (!key) {
            window.alert("请先打开本单元页面并输入课堂密码，再下载文件。");
            return;
        }
        link.setAttribute("aria-busy", "true");
        try {
            var response = await fetch(link.dataset.encryptedHref);
            if (!response.ok) throw new Error("HTTP " + response.status);
            var packed = new Uint8Array(await response.arrayBuffer());
            var plain = await decryptBytes(key, packed.slice(0, 12), packed.slice(12), unitId);
            var blob = new Blob([plain], { type: "application/octet-stream" });
            var url = URL.createObjectURL(blob);
            var anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = link.dataset.filename || "download";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        } catch (error) {
            console.error("解密下载失败", error);
            window.alert("文件解密失败，请重新输入课堂密码并打开页面。");
        } finally {
            link.removeAttribute("aria-busy");
        }
    }

    function initializeDownloads() {
        document.querySelectorAll("a[data-encrypted-href]").forEach(function (link) {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                decryptDownload(link);
            });
        });
    }

    window.DSPCrypto = {
        hasSavedKey: hasSavedKey,
        deriveKey: deriveKey,
        savedKey: savedKey,
        decryptBytes: decryptBytes,
        fromBase64: fromBase64,
        toBase64: toBase64
    };

    function initialize() { initializeUnlock(); initializeDownloads(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
}());
