import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { t } from "../i18n/index.js";
import { resolveStorePath } from "../config/sessions.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { RuntimeEnv } from "../runtime.js";

export type SessionStoreSelectionOptions = {
  store?: string;
  agent?: string;
  allAgents?: boolean;
};

export type SessionStoreTarget = {
  agentId: string;
  storePath: string;
};

function dedupeTargetsByStorePath(targets: SessionStoreTarget[]): SessionStoreTarget[] {
  const deduped = new Map<string, SessionStoreTarget>();
  for (const target of targets) {
    if (!deduped.has(target.storePath)) {
      deduped.set(target.storePath, target);
    }
  }
  return [...deduped.values()];
}

export function resolveSessionStoreTargets(
  cfg: OpenClawConfig,
  opts: SessionStoreSelectionOptions,
): SessionStoreTarget[] {
  const defaultAgentId = resolveDefaultAgentId(cfg);
  const hasAgent = Boolean(opts.agent?.trim());
  const allAgents = opts.allAgents === true;
  if (hasAgent && allAgents) {
    throw new Error(t("commands.sessionStoreTargets.agentAndAllConflict"));
  }
  if (opts.store && (hasAgent || allAgents)) {
    throw new Error(t("commands.sessionStoreTargets.storeConflict"));
  }

  if (opts.store) {
    return [
      {
        agentId: defaultAgentId,
        storePath: resolveStorePath(opts.store, { agentId: defaultAgentId }),
      },
    ];
  }

  if (allAgents) {
    const targets = listAgentIds(cfg).map((agentId) => ({
      agentId,
      storePath: resolveStorePath(cfg.session?.store, { agentId }),
    }));
    return dedupeTargetsByStorePath(targets);
  }

  if (hasAgent) {
    const knownAgents = listAgentIds(cfg);
    const requested = normalizeAgentId(opts.agent ?? "");
    if (!knownAgents.includes(requested)) {
      throw new Error(
        t("commands.sessionStoreTargets.unknownAgent", { id: opts.agent }),
      );
    }
    return [
      {
        agentId: requested,
        storePath: resolveStorePath(cfg.session?.store, { agentId: requested }),
      },
    ];
  }

  return [
    {
      agentId: defaultAgentId,
      storePath: resolveStorePath(cfg.session?.store, { agentId: defaultAgentId }),
    },
  ];
}

export function resolveSessionStoreTargetsOrExit(params: {
  cfg: OpenClawConfig;
  opts: SessionStoreSelectionOptions;
  runtime: RuntimeEnv;
}): SessionStoreTarget[] | null {
  try {
    return resolveSessionStoreTargets(params.cfg, params.opts);
  } catch (error) {
    params.runtime.error(error instanceof Error ? error.message : String(error));
    params.runtime.exit(1);
    return null;
  }
}
