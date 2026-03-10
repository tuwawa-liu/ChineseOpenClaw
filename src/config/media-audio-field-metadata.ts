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
    "Enable audio understanding so voice notes or audio clips can be transcribed/summarized for agent context. Disable when audio ingestion is outside policy or unnecessary for your workflows.",
  "tools.media.audio.maxBytes":
    "Maximum accepted audio payload size in bytes before processing is rejected or clipped by policy. Set this based on expected recording length and upstream provider limits.",
  "tools.media.audio.maxChars":
    "Maximum characters retained from audio understanding output to prevent oversized transcript injection. Increase for long-form dictation, or lower to keep conversational turns compact.",
  "tools.media.audio.prompt":
    "Instruction template guiding audio understanding output style, such as concise summary versus near-verbatim transcript. Keep wording consistent so downstream automations can rely on output format.",
  "tools.media.audio.timeoutSeconds":
    "Timeout in seconds for audio understanding execution before the operation is cancelled. Use longer timeouts for long recordings and tighter ones for interactive chat responsiveness.",
  "tools.media.audio.language":
    "Preferred language hint for audio understanding/transcription when provider support is available. Set this to improve recognition accuracy for known primary languages.",
  "tools.media.audio.attachments":
    "Attachment policy for audio inputs indicating which uploaded files are eligible for audio processing. Keep restrictive defaults in mixed-content channels to avoid unintended audio workloads.",
  "tools.media.audio.models":
    "Ordered model preferences specifically for audio understanding, used before shared media model fallback. Choose models optimized for transcription quality in your primary language/domain.",
  "tools.media.audio.scope":
    "Scope selector for when audio understanding runs across inbound messages and attachments. Keep focused scopes in high-volume channels to reduce cost and avoid accidental transcription.",
  "tools.media.audio.echoTranscript":
    "Echo the audio transcript back to the originating chat before agent processing. When enabled, users immediately see what was heard from their voice note, helping them verify transcription accuracy before the agent acts on it. Default: false.",
  "tools.media.audio.echoFormat":
    "Format string for the echoed transcript message. Use `{transcript}` as a placeholder for the transcribed text. Default: '📝 \"{transcript}\"'.",
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
