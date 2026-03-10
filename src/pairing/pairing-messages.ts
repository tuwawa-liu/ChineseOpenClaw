import { formatCliCommand } from "../cli/command-format.js";
import type { PairingChannel } from "./pairing-store.js";

export function buildPairingReply(params: {
  channel: PairingChannel;
  idLine: string;
  code: string;
}): string {
  const { channel, idLine, code } = params;
  return [
    "OpenClaw：未配置访问。",
    "",
    idLine,
    "",
    `Pairing code: ${code}`,
    "",
    "请机器人所有者运行以下命令批准：",
    formatCliCommand(`openclaw pairing approve ${channel} ${code}`),
  ].join("\n");
}
