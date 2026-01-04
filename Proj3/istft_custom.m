function [y, T] = istft_custom(S, fs, varargin)
%ISTFT_CUSTOM 自定义逆短时傅里叶变换
%   [Y,T] = ISTFT_CUSTOM(S, Fs, 'Window', WIN, 'FFTLength', NFFT, 
%                         'OverlapLength', NOVERLAP, 'FrequencyRange', FREQRANGE,
%                         'ConjugateSymmetric', TRUE)
%
%   该函数用于重建时域信号，支持窗口、帧移、FFT长度和单边频谱的选项。
%
%   此版本兼容 MATLAB 2014 及更高版本。
%
% 输入参数:
%   S               - 输入频谱矩阵，大小为 [num_freqs, num_frames]
%   fs              - 采样频率
%   'Window'        - 窗函数（向量），默认为 hann(128, 'periodic')
%   'FFTLength'     - FFT长度，默认为 128
%   'OverlapLength' - 帧重叠长度，默认为 75
%   'FrequencyRange'- 'onesided' 或 'twosided'，默认为 'onesided'
%   'ConjugateSymmetric' - 是否为共轭对称（用于单边谱重建），默认为 false
%
% 输出参数:
%   y - 重建的时域信号（列向量）
%   T - 时间向量

% 解析输入参数
p = inputParser;
defaultWin = hann(128, 'periodic');
defaultNFFT = 128;
defaultOverlap = 75;
defaultFreqRange = 'onesided';
defaultConjugateSymmetric = false;

% 添加必需参数
addRequired(p, 'S', @isnumeric);
addRequired(p, 'fs', @isnumeric);

% 添加可选参数（使用兼容旧版本的方式）
if exist('addParameter', 'file') || ismethod(p, 'addParameter')
    addParameter(p, 'Window', defaultWin, @isnumeric);
    addParameter(p, 'FFTLength', defaultNFFT, @isnumeric);
    addParameter(p, 'OverlapLength', defaultOverlap, @isnumeric);
    addParameter(p, 'FrequencyRange', defaultFreqRange, @ischar);
    addParameter(p, 'ConjugateSymmetric', defaultConjugateSymmetric, @islogical);
else
    addParamValue(p, 'Window', defaultWin, @isnumeric);
    addParamValue(p, 'FFTLength', defaultNFFT, @isnumeric);
    addParamValue(p, 'OverlapLength', defaultOverlap, @isnumeric);
    addParamValue(p, 'FrequencyRange', defaultFreqRange, @ischar);
    addParamValue(p, 'ConjugateSymmetric', defaultConjugateSymmetric, @islogical);
end

parse(p, S, fs, varargin{:});
S = p.Results.S;
fs = p.Results.fs;
window = p.Results.Window;
nfft = p.Results.FFTLength;
noverlap = p.Results.OverlapLength;
freqrange = p.Results.FrequencyRange;
conjugateSymmetric = p.Results.ConjugateSymmetric;

% 确保窗函数为列向量
window = window(:);

% 获取窗口长度
winLength = length(window);
hop_size = winLength - noverlap; % 帧移

% 确保帧移至少为1
hop_size = max(1, hop_size);

% 根据输入频谱处理
if strcmp(freqrange, 'onesided') && conjugateSymmetric
    % 重建完整的频谱，利用对称性
    % 对于单边谱，需要添加共轭对称部分
    [num_freqs, num_frames] = size(S);
    
    if num_freqs == floor(nfft/2) + 1
        % 标准的单边谱格式
        S_full = zeros(nfft, num_frames);
        S_full(1:num_freqs, :) = S;
        % 添加共轭对称部分（不包括DC和Nyquist）
        S_full(num_freqs+1:nfft, :) = conj(S(end-1:-1:2, :));
        S = S_full;
    end
elseif strcmp(freqrange, 'twosided')
    % 对于twosided频谱，进行fftshift还原
    S = ifftshift(S, 1);
end

% 获取处理后的频谱大小
[~, num_frames] = size(S);

% 初始化输出信号
xlen = winLength + (num_frames-1) * hop_size;  % 输出信号总长度
y = zeros(xlen, 1);
win_sum = zeros(xlen, 1);  % 用于归一化的窗函数累积

% 逆傅里叶变换
for i = 1:num_frames
    % 对每一帧执行逆FFT
    frame_start = (i-1) * hop_size + 1;
    frame_end = frame_start + winLength - 1;
    
    % 重建时域信号
    if strcmp(freqrange, 'onesided') && conjugateSymmetric
        % 使用 'symmetric' 选项确保输出为实数
        ifft_frame = ifft(S(:, i), nfft, 'symmetric');
    else
        ifft_frame = ifft(S(:, i), nfft);
    end
    
    % 保留窗函数长度的部分
    ifft_frame = ifft_frame(1:winLength);
    
    % 确保为实数（消除微小虚部）
    ifft_frame = real(ifft_frame);
    
    % 加窗并进行重叠相加
    y(frame_start:frame_end) = y(frame_start:frame_end) + (ifft_frame .* window);
    win_sum(frame_start:frame_end) = win_sum(frame_start:frame_end) + (window .^ 2);
end

% 归一化（防止叠加增益）
% 只在窗函数累积大于阈值的地方进行归一化
threshold = max(win_sum) * 1e-6;
valid_idx = win_sum > threshold;
y(valid_idx) = y(valid_idx) ./ win_sum(valid_idx);

% 生成时间轴
T = (0:length(y)-1)' / fs;

end
