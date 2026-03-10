import { type AcpRuntimeErrorCode, AcpRuntimeError, toAcpRuntimeError } from "./errors.js";

function resolveAcpRuntimeErrorNextStep(error: AcpRuntimeError): string | undefined {
  if (error.code === "ACP_BACKEND_MISSING" || error.code === "ACP_BACKEND_UNAVAILABLE") {
    return "运行 `/acp doctor`，安装/启用后端插件，然后重试。";
  }
  if (error.code === "ACP_DISPATCH_DISABLED") {
    return "启用 `acp.dispatch.enabled=true` 以允许线程消息 ACP 轮次。";
  }
  if (error.code === "ACP_SESSION_INIT_FAILED") {
    return "如果此会话已过期，使用 `/acp spawn` 重新创建并重新绑定线程。";
  }
  if (error.code === "ACP_INVALID_RUNTIME_OPTION") {
    return "使用 `/acp status` 检查选项并传入有效值。";
  }
  if (error.code === "ACP_BACKEND_UNSUPPORTED_CONTROL") {
    return "此后端不支持该控制；请使用支持的命令。";
  }
  if (error.code === "ACP_TURN_FAILED") {
    return "重试，或使用 `/acp cancel` 并重新发送消息。";
  }
  return undefined;
}

export function formatAcpRuntimeErrorText(error: AcpRuntimeError): string {
  const next = resolveAcpRuntimeErrorNextStep(error);
  if (!next) {
    return `ACP error (${error.code}): ${error.message}`;
  }
  return `ACP error (${error.code}): ${error.message}\nnext: ${next}`;
}

export function toAcpRuntimeErrorText(params: {
  error: unknown;
  fallbackCode: AcpRuntimeErrorCode;
  fallbackMessage: string;
}): string {
  return formatAcpRuntimeErrorText(
    toAcpRuntimeError({
      error: params.error,
      fallbackCode: params.fallbackCode,
      fallbackMessage: params.fallbackMessage,
    }),
  );
}
