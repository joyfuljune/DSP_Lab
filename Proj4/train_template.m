%% train_template.m - 从训练音频生成DTW模板库
% 功能: 从 train/ 目录读取音频，使用中心样本法生成模板
% 使用: >> train_template
% 兼容: MATLAB 2014b及以上

clear; clc; close all;

train_dir = 'train';
output_file = 'template.mat';
target_fs = 16000;

% MFCC参数
params = struct();
params.frame_len_ms = 25;
params.frame_shift_ms = 10;
params.pre_emphasis = 0.97;
params.nfft = 2048;
params.num_filters = 32;
params.num_ceps = 12;
params.lifter_coef = 22;
params.delta_N = 2;

fprintf('============================================\n');
fprintf('    DTW 模板训练程序\n');
fprintf('============================================\n');
fprintf('训练目录: %s\n', train_dir);

% 获取音频文件列表
wav_files = dir(fullfile(train_dir, '*.wav'));
fprintf('找到 %d 个音频文件\n\n', length(wav_files));

if isempty(wav_files)
    error('训练目录中没有找到wav文件！');
end

%% 按数字分组
digit_files = cell(10, 1);
for i = 1:length(wav_files)
    label = extract_label(wav_files(i).name);
    if label >= 0 && label <= 9
        digit_files{label + 1} = [digit_files{label + 1}; {wav_files(i).name}];
    end
end

%% 提取MFCC特征
fprintf('正在提取MFCC特征...\n');
all_features = cell(10, 1);

for digit = 0:9
    files = digit_files{digit + 1};
    num_samples = length(files);
    features = cell(num_samples, 1);
    valid_count = 0;
    
    for k = 1:num_samples
        filepath = fullfile(train_dir, files{k});
        try
            [audio, fs] = audioread(filepath);
            if size(audio, 2) > 1
                audio = audio(:, 1);
            end
            if fs ~= target_fs
                audio = resample(audio, target_fs, fs);
            end
            audio_vad = ex6_vad(audio, target_fs);
            if length(audio_vad) >= target_fs * 0.05
                valid_count = valid_count + 1;
                features{valid_count} = ex3_mfcc(audio_vad, target_fs, params);
            end
        catch
            % 忽略读取失败的文件
        end
    end
    all_features{digit + 1} = features(1:valid_count);
    fprintf('  数字 %d: %d 个有效样本\n', digit, valid_count);
end

%% 中心样本法选择模板
fprintf('\n正在选择中心模板...\n');
template = cell(1, 10);

for digit = 0:9
    samples = all_features{digit + 1};
    num_valid = length(samples);
    
    if num_valid == 0
        fprintf('  警告: 数字 %d 没有有效样本!\n', digit);
        template{digit + 1} = [];
    elseif num_valid == 1
        template{digit + 1} = samples{1};
    else
        % 计算每个样本到其他样本的距离之和
        dist_sum = zeros(num_valid, 1);
        for i = 1:num_valid
            for j = 1:num_valid
                if i ~= j
                    dist_sum(i) = dist_sum(i) + ex4_dtw(samples{i}, samples{j}, true);
                end
            end
        end
        % 选择距离之和最小的作为中心样本
        [~, center_idx] = min(dist_sum);
        template{digit + 1} = samples{center_idx};
    end
end

%% 保存模板
save(output_file, 'template');
fprintf('\n============================================\n');
fprintf('模板已保存到: %s\n', output_file);
fprintf('============================================\n');
