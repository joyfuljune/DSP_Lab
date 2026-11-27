/* 粗野主题的小互动：左下角的“别按”大红按钮。每按一次弹出一条信号处理冷知识，看完一轮再从头。
   已看过哪些只存在本机浏览器。 */
(function () {
    var KEY = "dsp-facts";
    var FACTS = [
        "快速傅里叶变换（FFT）由 Cooley 和 Tukey 在 1965 年发表。其实高斯在 1805 年前后就用过类似的算法，只是手稿到他去世后才印出来。",
        "CD 的采样频率 44.1 kHz 来自早期用录像机存数字音频：每行存 3 个采样，NTSC 每场 245 行、每秒 60 场，3 × 245 × 60 = 44100。",
        "采样定理常记在奈奎斯特和香农名下：奈奎斯特 1928 年的论文给出了条件，香农 1949 年给出了完整的证明；苏联的科捷利尼科夫 1933 年也独立得到了它。",
        "MP3 能压缩，靠的是人耳的掩蔽效应：一个响的声音会盖住附近频率上的弱声音，被盖住的部分就少分比特，甚至不编码。",
        "傅里叶 1807 年提出“任何函数都能展开成三角级数”时，拉格朗日等人并不认可，这项工作过了十几年才正式发表。",
        "吉布斯现象：用傅里叶级数逼近方波，跳变处总会冲出去约 9%。项数再多，这个过冲也不会消失，只是越来越窄。",
        "汉宁窗的名字来自奥地利气象学家 Julius von Hann，汉明窗来自贝尔实验室的 Richard Hamming，两个名字只差一个字母。",
        "巴特沃斯滤波器由英国工程师 Stephen Butterworth 在 1930 年发表，特点是通带内“最大平坦”。",
        "椭圆滤波器又叫考尔（Cauer）滤波器，由德国数学家 Wilhelm Cauer 在 1930 年代提出。同样的指标下，它需要的阶数通常最低。",
        "Z 变换的名字和系统用法，来自哥伦比亚大学的 Ragazzini 和 Zadeh 1952 年研究采样数据系统的论文。",
        "固定电话的语音采样频率是 8 kHz，只保留约 300～3400 Hz 的频段，所以电话里的声音听起来有点“闷”。",
        "JPEG 图片压缩用的是二维离散余弦变换（DCT），把图像切成 8 × 8 的小块逐块变换，和项目一的音频压缩思路相同。",
        "分贝看的是比值：功率差 10 dB 是 10 倍，幅度差 20 dB 才是 10 倍，因为功率与幅度的平方成正比。",
        "相位声码器（phase vocoder）由贝尔实验室的 Flanagan 和 Golden 在 1966 年提出，项目二、项目三的变速变调都用到它。",
        "MFCC 里的 Mel 刻度由 Stevens、Volkmann 和 Newman 在 1937 年提出，名字取自 melody（旋律）。",
        "动态时间规整（DTW）在 1970 年代用于语音识别，Sakoe 和 Chiba 1978 年的论文至今仍是经典，项目四用的就是它。",
        "MATLAB 最初是 Cleve Moler 在 1970 年代末写的，目的是让学生不用写 Fortran，也能调用 LINPACK 和 EISPACK 做矩阵计算。",
        "“白噪声”的名字类比白光：白光含有所有颜色，白噪声在所有频率上的功率谱密度都相同。",
        "视频里的车轮有时看起来在倒转，这就是混叠：摄像机每秒拍的帧数不够，太快的转动被“采”成了反方向的慢转。",
        "人耳大约能听到 20 Hz～20 kHz 的声音，年龄越大，高频的上限越低。",
        "心电图机常带 50 Hz 陷波滤波器，专门滤掉电网的工频干扰；中国电网是 50 Hz，美国是 60 Hz。",
        "卷积定理说时域卷积等于频域相乘。长序列做卷积时，先 FFT、相乘、再 IFFT，比直接算快得多，这就是实验一的“快速卷积”。"
    ];
    var root = null, handlers = [], state = null;

    function load() {
        var s = null;
        try { s = JSON.parse(window.localStorage.getItem(KEY) || "null"); } catch (e) {}
        return (s && s.seen) ? s : { seen: [] };
    }
    function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
    function on(t, ty, fn) { t.addEventListener(ty, fn); handlers.push([t, ty, fn]); }

    function pick() {
        var left = [];
        for (var i = 0; i < FACTS.length; i++) if (state.seen.indexOf(i) < 0) left.push(i);
        if (!left.length) { state.seen = []; for (var j = 0; j < FACTS.length; j++) left.push(j); }
        var k = left[Math.floor(Math.random() * left.length)];
        state.seen.push(k); save();
        return k;
    }
    function show() {
        var k = pick();
        var card = root.querySelector(".kf-card");
        card.querySelector(".kf-no").textContent = "冷知识 #" + (k + 1);
        card.querySelector(".kf-text").textContent = FACTS[k];
        root.querySelector(".kf-count").textContent = "已看 " + state.seen.length + "/" + FACTS.length;
        root.classList.add("is-open");
        card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    }

    function start() {
        if (root) return;
        state = load();
        root = document.createElement("div");
        root.className = "kf-root";
        root.innerHTML =
            '<div class="kf-card" role="dialog" aria-live="polite"><div class="kf-head"><span class="kf-no"></span><button type="button" class="kf-x" aria-label="收起">×</button></div>' +
            '<p class="kf-text"></p><div class="kf-foot"><span class="kf-count"></span><button type="button" class="kf-more">再来一条</button></div></div>' +
            '<button type="button" class="kf-btn" title="别按"><span>别按</span></button>';
        document.body.appendChild(root);
        on(root.querySelector(".kf-btn"), "click", show);
        on(root.querySelector(".kf-more"), "click", show);
        on(root.querySelector(".kf-x"), "click", function () { root.classList.remove("is-open"); });
    }
    function stop() {
        for (var i = 0; i < handlers.length; i++) handlers[i][0].removeEventListener(handlers[i][1], handlers[i][2]);
        handlers = [];
        if (root && root.parentNode) root.parentNode.removeChild(root);
        root = null;
    }
    window.DSPFacts = { start: start, stop: stop };
})();
