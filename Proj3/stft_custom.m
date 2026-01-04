function [S, F, T] = stft_custom(x, fs, varargin)
%STFT_CUSTOM 自定义短时傅里叶变换
%   [S,F,T] = STFT_CUSTOM(X, Fs, 'Window', WIN, 'FFTLength', NFFT, 
%                          'OverlapLength', NOVERLAP, 'FrequencyRange', FREQRANGE)
%
%   执行与MATLAB自带的stft类似的操作，包括窗函数、帧移、FFT长度和频率范围设置。
%   支持 'onesided' 和 'twosided' 频率范围选项。
%
%   此版本兼容 MATLAB 2014 及更高版本。
%
% 输入参数:
%   x           - 输入信号（列向量）
%   fs          - 采样频率
%   'Window'    - 窗函数（向量），默认为 hann(128, 'periodic')
%   'FFTLength' - FFT长度，默认为 128
%   'OverlapLength' - 帧重叠长度，默认为 75
%   'FrequencyRange' - 'onesided' 或 'twosided'，默认为 'onesided'
%
% 输出参数:
%   S - 频谱矩阵，大小为 [num_freqs, num_frames]
%   F - 频率向量
%   T - 时间向量

% 解析输入参数（使用兼容MATLAB 2014的方式）
p = inputParser;
defaultWin = hann(128, 'periodic');
defaultNFFT = 128;
defaultOverlap = 75;
defaultFreqRange = 'onesided';

% 添加必需参数
addRequired(p, 'x', @isnumeric);
addRequired(p, 'fs', @isnumeric);

% 添加可选参数（使用兼容旧版本的方式）
% MATLAB 2013b及更早版本使用 addParamValue，2014a及之后使用 addParameter
% 为了兼容性，我们检测可用的函数
if exist('addParameter', 'file') || ismethod(p, 'addParameter')
    addParameter(p, 'Window', defaultWin, @isnumeric);
    addParameter(p, 'FFTLength', defaultNFFT, @isnumeric);
    addParameter(p, 'OverlapLength', defaultOverlap, @isnumeric);
    addParameter(p, 'FrequencyRange', defaultFreqRange, @ischar);
else
    addParamValue(p, 'Window', defaultWin, @isnumeric);
    addParamValue(p, 'FFTLength', defaultNFFT, @isnumeric);
    addParamValue(p, 'OverlapLength', defaultOverlap, @isnumeric);
    addParamValue(p, 'FrequencyRange', defaultFreqRange, @ischar);
end

parse(p, x, fs, varargin{:});
x = p.Results.x;
fs = p.Results.fs;
window = p.Results.Window;
nfft = p.Results.FFTLength;
noverlap = p.Results.OverlapLength;
freqrange = p.Results.FrequencyRange;

% 确保输入为列向量
x = x(:);
window = window(:);

% 获取窗口长度
winLength = length(window);

% 计算帧移（hop size）
hop_size = winLength - noverlap;

% 确保帧移至少为1
hop_size = max(1, hop_size);

% 计算总帧数
num_frames = floor((length(x) - winLength) / hop_size) + 1;

% 确保至少有一帧
num_frames = max(1, num_frames);

% 初始化频谱矩阵
if strcmp(freqrange, 'onesided')
    num_freqs = floor(nfft / 2) + 1;
else
    num_freqs = nfft; % 使用完整的频率范围
end
S = zeros(num_freqs, num_frames);

% 窗口函数处理并执行STFT
for i = 1:num_frames
    frame_start = (i-1) * hop_size + 1;
    frame_end = frame_start + winLength - 1;
    
    if frame_end > length(x)
        % 如果超出信号长度，进行零填充
        frame = zeros(winLength, 1);
        available = length(x) - frame_start + 1;
        if available > 0
            frame(1:available) = x(frame_start:end);
        end
    else
        frame = x(frame_start:frame_end);
    end
    
    % 加窗
    windowed_frame = frame .* window;
    
    % 进行FFT
    fft_frame = fft(windowed_frame, nfft);
    
    % 根据频率范围选择输出
    if strcmp(freqrange, 'onesided')
        S(:, i) = fft_frame(1:num_freqs); % 仅保留正频率部分
    elseif strcmp(freqrange, 'twosided')
        S(:, i) = fft_frame; % 保留所有频率分量
    else
        % 默认为单边谱
        S(:, i) = fft_frame(1:num_freqs);
    end
end

% 计算频率轴和时间轴
if strcmp(freqrange, 'onesided')
    F = (0:num_freqs-1)' * (fs / nfft); % 单边频谱的频率轴
else
    F = (-nfft/2:nfft/2-1)' * (fs / nfft); % 双边频谱的频率轴
    S = fftshift(S, 1); % 将双边频谱移到中心对称
end
T = ((0:num_frames-1) * hop_size / fs)';

end
