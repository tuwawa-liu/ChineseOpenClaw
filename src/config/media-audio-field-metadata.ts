export const MEDIA_AUDIO_FIELD_KEYS = [
  "tools.media.audio.enabled",
  "tools.media.audio.maxBytes",
  "tools.media.audio.maxChars",
  "tools.media.audio.prompt",
  "tools.media.audio.timeoutSeconds",
  "tools.media.audio.language",
  "tools.media.audio.attachments",
  "tools.media.audio.models",
  "tools.media.audio.scope",
  "tools.media.audio.echoTranscript",
  "tools.media.audio.echoFormat",
] as const;

type MediaAudioFieldKey = (typeof MEDIA_AUDIO_FIELD_KEYS)[number];

export const MEDIA_AUDIO_FIELD_HELP: Record<MediaAudioFieldKey, string> = {
  "tools.media.audio.enabled":
    "启用音频理解，使语音消息或音频片段可以被转录/摘要以作为代理上下文。当音频摄取不在策略范围内或工作流不需要时禁用。",
  "tools.media.audio.maxBytes":
    "处理被拒绝或被策略截断前接受的最大音频负载大小（字节）。根据预期录音时长和上游提供商限制设置。",
  "tools.media.audio.maxChars":
    "从音频理解输出中保留的最大字符数，防止过大的转录注入。长文本听写时增大，或减小以保持对话轮次紧凑。",
  "tools.media.audio.prompt":
    "指导音频理解输出样式的指令模板，如简洁摘要或近乎逐字转录。保持用词一致，以便下游自动化可以依赖输出格式。",
  "tools.media.audio.timeoutSeconds":
    "音频理解执行的超时时间（秒），超时后操作将被取消。长录音使用较长超时，交互式聊天使用较短超时以提高响应性。",
  "tools.media.audio.language":
    "当提供商支持时，音频理解/转录的首选语言提示。设置此项可提高已知主要语言的识别准确性。",
  "tools.media.audio.attachments":
    "音频输入的附件策略，指示哪些上传文件有资格进行音频处理。在混合内容频道中保持默认限制，以避免意外的音频工作负载。",
  "tools.media.audio.models":
    "专用于音频理解的有序模型偏好，在共享媒体模型回退之前使用。选择针对你主要语言/领域优化转录质量的模型。",
  "tools.media.audio.scope":
    "音频理解在入站消息和附件中运行的范围选择器。在高流量频道中保持聚焦范围以降低成本并避免意外转录。",
  "tools.media.audio.echoTranscript":
    "在代理处理前将音频转录回显到原始聊天。启用后，用户可立即看到其语音消息的转录内容，帮助在代理操作前验证转录准确性。默认：false。",
  "tools.media.audio.echoFormat":
    "回显转录消息的格式字符串。使用 `{transcript}` 作为转录文本的占位符。默认：'📝 \"{transcript}\"'。",
};

export const MEDIA_AUDIO_FIELD_LABELS: Record<MediaAudioFieldKey, string> = {
  "tools.media.audio.enabled": "启用音频理解",
  "tools.media.audio.maxBytes": "音频理解最大字节数",
  "tools.media.audio.maxChars": "音频理解最大字符数",
  "tools.media.audio.prompt": "音频理解提示词",
  "tools.media.audio.timeoutSeconds": "音频理解超时（秒）",
  "tools.media.audio.language": "音频理解语言",
  "tools.media.audio.attachments": "音频理解附件策略",
  "tools.media.audio.models": "音频理解模型",
  "tools.media.audio.scope": "音频理解范围",
  "tools.media.audio.echoTranscript": "转录回显到聊天",
  "tools.media.audio.echoFormat": "转录回显格式",
};
