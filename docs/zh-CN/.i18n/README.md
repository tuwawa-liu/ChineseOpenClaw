# OpenClaw 文档国际化资源

此文件夹存储文档翻译的**生成文件**和**配置文件**。

## 文件

- `glossary.<lang>.json` — 首选术语映射（用于提示指导）。
- `<lang>.tm.jsonl` — 翻译记忆（缓存），按工作流 + 模型 + 文本哈希索引。

## 术语表格式

`glossary.<lang>.json` 是一个条目数组：

```json
{
  "source": "troubleshooting",
  "target": "故障排除",
  "ignore_case": true,
  "whole_word": false
}
```

字段：

- `source`：要匹配的英文（或源语言）短语。
- `target`：首选翻译输出。

## 说明

- 术语表条目作为**提示指导**传递给模型（非确定性重写）。
- 翻译记忆由 `scripts/docs-i18n` 更新。
