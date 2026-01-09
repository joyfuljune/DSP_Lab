function label = extract_label(filename)
%EXTRACT_LABEL 从文件名提取数字标签
%   label = extract_label(filename)
%   支持格式: '0.wav', 'zero-1.wav', 'one_2.wav' 等
%   返回: 0-9 或 -1(无法识别)
%
%   兼容: MATLAB 2014b及以上

[~, name, ~] = fileparts(filename);
name_lower = lower(name);

% 英文数字名映射
digit_names = {'zero','one','two','three','four','five','six','seven','eight','nine'};

% 先尝试英文名匹配
for i = 1:10
    if ~isempty(strfind(name_lower, digit_names{i}))
        label = i - 1;
        return;
    end
end

% 再尝试阿拉伯数字
if ~isempty(name) && name(1) >= '0' && name(1) <= '9'
    label = str2double(name(1));
    return;
end

label = -1;
end
