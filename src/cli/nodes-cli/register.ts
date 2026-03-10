import type { Command } from "commander";
import { t } from "../../i18n/index.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import { registerNodesCameraCommands } from "./register.camera.js";
import { registerNodesCanvasCommands } from "./register.canvas.js";
import { registerNodesInvokeCommands } from "./register.invoke.js";
import { registerNodesLocationCommands } from "./register.location.js";
import { registerNodesNotifyCommand } from "./register.notify.js";
import { registerNodesPairingCommands } from "./register.pairing.js";
import { registerNodesPushCommand } from "./register.push.js";
import { registerNodesScreenCommands } from "./register.screen.js";
import { registerNodesStatusCommands } from "./register.status.js";

export function registerNodesCli(program: Command) {
  const nodes = program
    .command("nodes")
    .description(t("nodesCli.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw nodes status", "列出已知节点及实时状态。"],
          ["openclaw nodes pairing pending", "Show pending node pairing requests."],
          ['openclaw nodes run --node <id> --raw "uname -a"', "在节点上运行 Shell 命令。"],
          ["openclaw nodes camera snap --node <id>", "从节点摄像头拍摄照片。"],
        ])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/cli/nodes", "docs.openclaw.ai/cli/nodes")}\n`,
    );

  registerNodesStatusCommands(nodes);
  registerNodesPairingCommands(nodes);
  registerNodesInvokeCommands(nodes);
  registerNodesNotifyCommand(nodes);
  registerNodesPushCommand(nodes);
  registerNodesCanvasCommands(nodes);
  registerNodesCameraCommands(nodes);
  registerNodesScreenCommands(nodes);
  registerNodesLocationCommands(nodes);
}
