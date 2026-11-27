(function () {
    "use strict";

    function shuffle(values) {
        for (var i = values.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var swap = values[i]; values[i] = values[j]; values[j] = swap;
        }
        return values;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function plainText(value) {
        var node = document.createElement("span");
        node.innerHTML = String(value);
        return (node.textContent || "").replace(/\s+/g, " ").trim();
    }

    function normalizeQuestion(raw, generator) {
        var type = String(raw.type || generator.type || "single").toLowerCase();
        var options = raw.options;
        var correct = raw.correct;
        if (options && !Array.isArray(options) && Array.isArray(options.options)) {
            if (correct === undefined) correct = options.correctIndex;
            options = options.options;
        }

        if (["tf", "truefalse", "true-false"].indexOf(type) >= 0) {
            if (!Array.isArray(options) || options.length !== 2) options = ["正确", "错误"];
            if (typeof correct === "boolean") correct = correct ? 0 : 1;
        }

        options = Array.isArray(options) ? options : [];
        var marked = [];
        var texts = options.map(function (option, index) {
            if (option && typeof option === "object") {
                if (option.correct === true) marked.push(index);
                return String(option.text !== undefined ? option.text : (option.label || ""));
            }
            return String(option);
        });
        if (correct === undefined) correct = marked;
        var indexes = Array.isArray(correct) ? correct.map(Number) : [Number(correct)];
        if (Array.isArray(correct) && type === "single") indexes = correct.map(Number);

        return {
            kind: type === "multiple" ? "multiple" : "single",
            question: raw.question || "",
            options: texts,
            correctIndexes: indexes,
            explanation: raw.explanation || ""
        };
    }

    function generatorsFor(config, topic) {
        if (config.questionGenerators && Array.isArray(config.questionGenerators[topic.id])) return config.questionGenerators[topic.id];
        if (Array.isArray(topic.questionGenerators)) return topic.questionGenerators;
        var data = config.knowledgeBase && config.knowledgeBase[topic.id];
        return data && Array.isArray(data.questionGenerators) ? data.questionGenerators : [];
    }

    function prepareQuestion(config, topic, used, retryUsed) {
        var generators = generatorsFor(config, topic);
        var choices = generators.map(function (_, i) { return i; }).filter(function (i) { return used.indexOf(i) < 0; });
        if (!choices.length) { used.length = 0; choices = generators.map(function (_, i) { return i; }); }
        shuffle(choices);
        for (var i = 0; i < choices.length; i += 1) {
            var generatorIndex = choices[i];
            var generator = generators[generatorIndex];
            for (var attempt = 0; attempt < 12; attempt += 1) {
                var raw = typeof generator === "function" ? generator() : generator.generate();
                var question = normalizeQuestion(raw, generator);
                var normalized = question.options.map(plainText);
                if (normalized.length < 2 || new Set(normalized).size !== normalized.length) continue;
                if (!question.correctIndexes.length || question.correctIndexes.some(function (index) { return !Number.isInteger(index) || index < 0 || index >= normalized.length; })) continue;
                used.push(generatorIndex);
                question.correctTexts = question.correctIndexes.map(function (index) { return normalized[index]; });
                question.displayOptions = shuffle(question.options.map(function (markup) { return { markup: markup, text: plainText(markup) }; }));
                return question;
            }
            used.push(generatorIndex);
        }
        if (retryUsed !== false) {
            used.length = 0;
            return prepareQuestion(config, topic, used, false);
        }
        throw new Error("本知识点暂时无法生成选项不重复的题目，请刷新后重试。");
    }

    function typeset(node) {
        if (window.MathJax && window.MathJax.Hub && window.MathJax.Hub.Queue) window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, node]);
    }

    function mount(config) {
        var idInput = document.getElementById("studentId");
        var nameInput = document.getElementById("studentName");
        var login = document.querySelector(".login-section");
        var quiz = document.querySelector(".quiz-section");
        var result = document.querySelector(".result-section");
        if (!idInput || !nameInput || !login || !quiz || !result) throw new Error("测验页面缺少引擎所需区域");

        var topics = config.topics || [];
        var state = { id: "", name: "", topicIndex: 0, used: Object.create(null), stats: Object.create(null), current: null, selected: new Set(), lastCorrect: false, answered: false };
        try {
            var identity = JSON.parse(localStorage.getItem("dsp-student-identity") || "null");
            if (identity && identity.id && identity.name) {
                idInput.value = identity.id; nameInput.value = identity.name;
                var hint = document.createElement("p"); hint.className = "identity-hint";
                hint.textContent = "已载入本机保存的学号和姓名，按回车确认或修改后开始。"; login.appendChild(hint);
            }
        } catch (error) { }

        function renderQuestion() {
            var topic = topics[state.topicIndex];
            var stats = state.stats[topic.id];
            state.current = prepareQuestion(config, topic, state.used[topic.id]);
            state.answered = false;
            state.selected.clear(); state.lastCorrect = false;
            document.getElementById("studentInfo").textContent = "学号 " + state.id + "　·　姓名 " + state.name;
            document.getElementById("progressText").textContent = (state.topicIndex + 1) + " / " + topics.length;
            document.getElementById("progressBar").style.width = Math.floor(state.topicIndex * 100 / topics.length) + "%";
            document.getElementById("currentTopic").innerHTML = "<strong>知识点 " + (state.topicIndex + 1) + " / " + topics.length + "</strong>　" + escapeHtml(topic.name);
            document.getElementById("questionTitle").textContent = "题目 " + (stats.attempts + 1);
            document.getElementById("questionContent").innerHTML = "<p>" + state.current.question + "</p>";
            var options = document.getElementById("options"); options.innerHTML = "";
            state.current.displayOptions.forEach(function (option, index) {
                var button = document.createElement("button"); button.type = "button"; button.className = "option";
                button.dataset.index = String(index); button.setAttribute("aria-pressed", "false");
                button.dataset.optionContent = option.text;
                button.innerHTML = String.fromCharCode(65 + index) + ". " + option.markup;
                button.addEventListener("click", function () { selectOption(index); }); options.appendChild(button);
            });
            document.getElementById("feedback").innerHTML = "";
            document.getElementById("submitBtn").hidden = false;
            document.getElementById("nextBtn").hidden = true;
            typeset(document.getElementById("questionContent")); typeset(options);
            if (window.DSPSite) window.DSPSite.refreshTOC();
        }

        function selectOption(index) {
            var option = state.current.displayOptions[index]; if (!option) return;
            if (state.current.kind === "multiple") {
                if (state.selected.has(option.text)) state.selected.delete(option.text); else state.selected.add(option.text);
            } else { state.selected.clear(); state.selected.add(option.text); }
            document.querySelectorAll("#options .option").forEach(function (node) {
                var selected = state.selected.has(state.current.displayOptions[Number(node.dataset.index)].text);
                node.classList.toggle("selected", selected); node.setAttribute("aria-pressed", String(selected));
            });
        }

        function submitAnswer() {
            if (state.answered) return;
            if (!state.current || !state.selected.size) { window.alert(state.current && state.current.kind === "multiple" ? "请至少选择一个答案!" : "请选择一个答案!"); return; }
            var answers = state.current.correctTexts.slice().sort();
            var selected = Array.from(state.selected).sort();
            var passed = selected.length === answers.length && selected.every(function (value, index) { return value === answers[index]; });
            var topic = topics[state.topicIndex]; var stats = state.stats[topic.id]; stats.attempts += 1;
            if (stats.attempts === 1) stats.firstCorrect = passed;
            if (passed) stats.correct += 1;
            state.lastCorrect = passed;
            state.answered = true;
            document.querySelectorAll("#options .option").forEach(function (node) {
                var value = state.current.displayOptions[Number(node.dataset.index)].text;
                if (answers.indexOf(value) >= 0) node.classList.add("correct");
                else if (selected.indexOf(value) >= 0) node.classList.add("incorrect");
                node.disabled = true;
            });
            var feedback = document.getElementById("feedback");
            feedback.className = "feedback " + (passed ? "correct" : "incorrect");
            feedback.innerHTML = (passed ? "✅ 回答正确" : "❌ 回答错误，请再试一次") + "<div>" + state.current.explanation + "</div>";
            document.getElementById("submitBtn").hidden = true;
            var next = document.getElementById("nextBtn");
            next.textContent = passed ? (state.topicIndex + 1 < topics.length ? "下一知识点" : "查看结果") : "继续答题";
            next.hidden = false; typeset(feedback);
        }

        function nextQuestion() {
            if (!state.answered) return;
            if (state.lastCorrect) {
                state.topicIndex += 1;
                if (state.topicIndex >= topics.length) { showResults(); return; }
            }
            renderQuestion();
        }

        function showResults() {
            quiz.classList.remove("active"); result.classList.add("active");
            var rows = topics.map(function (topic) {
                var stats = state.stats[topic.id];
                var mastery = stats.attempts === 1 ? ["熟练", "mastery-good"] : (stats.attempts <= 3 ? ["基本掌握", "mastery-mid"] : ["需要复习", "mastery-low"]);
                return "<tr><td>" + escapeHtml(topic.name) + "</td><td>" + stats.attempts + "</td><td>" + (stats.firstCorrect ? "是" : "否") + "</td><td class=\"" + mastery[1] + "\">" + mastery[0] + "</td></tr>";
            }).join("");
            document.getElementById("progressBar").style.width = "100%";
            document.getElementById("progressText").textContent = topics.length + " / " + topics.length;
            document.getElementById("finalReport").innerHTML = "<div class=\"report-heading\"><h2>" + escapeHtml(state.name) + " · " + escapeHtml(config.title) + "</h2><p>学号 " + escapeHtml(state.id) + "</p></div>" +
                "<table><thead><tr><th>知识点</th><th>答题次数</th><th>首次答对</th><th>掌握情况</th></tr></thead><tbody>" + rows + "</tbody></table>";
            typeset(document.getElementById("finalReport")); if (window.DSPSite) window.DSPSite.refreshTOC();
        }

        async function saveScreenshot() {
            var button = document.getElementById("saveBtn");
            if (!window.html2canvas) { window.alert("截图组件尚未加载。"); return; }
            button.disabled = true;
            try {
                var canvas = await window.html2canvas(document.querySelector("main"), { backgroundColor: "#ffffff", scale: 2, logging: false });
                var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
                if (!blob) throw new Error("截图生成失败");
                var url = URL.createObjectURL(blob); var anchor = document.createElement("a");
                anchor.href = url; anchor.download = state.id + "_" + state.name + "_" + config.screenshotSuffix + ".png";
                document.body.appendChild(anchor); anchor.click(); anchor.remove();
                window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000); button.textContent = "已保存截图";
            } catch (error) { console.error(error); window.alert("截图保存失败。"); }
            finally { button.disabled = false; }
        }

        function startQuiz() {
            var id = idInput.value.trim(); var name = nameInput.value.trim();
            if (!id || !name) { window.alert("请填写学号和姓名!"); return; }
            state.id = id; state.name = name; state.topicIndex = 0; state.used = Object.create(null); state.stats = Object.create(null);
            topics.forEach(function (topic) { state.used[topic.id] = []; state.stats[topic.id] = { attempts: 0, correct: 0, firstCorrect: false }; });
            try { localStorage.setItem("dsp-student-identity", JSON.stringify({ id: id, name: name })); } catch (error) { }
            login.classList.remove("active"); result.classList.remove("active"); quiz.classList.add("active"); renderQuestion();
        }

        window.startQuiz = startQuiz; window.submitAnswer = submitAnswer; window.nextQuestion = nextQuestion; window.saveScreenshot = saveScreenshot;
        [idInput, nameInput].forEach(function (input) { input.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); startQuiz(); } }); });
    }

    window.DSPQuiz = { mount: mount, normalizeQuestion: normalizeQuestion };
}());
