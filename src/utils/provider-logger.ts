import type { ProviderLogger } from "../semantic/providers/base.js";
import type { RotatedLogger } from "./logger.js";

export function makeProviderLogger(l: RotatedLogger, category: string): ProviderLogger {
  return {
    debug: (msg, data, requestId) => l.debug(category, msg, data, requestId),
    info: (msg, data, requestId) => l.info(category, msg, data, requestId),
    warn: (msg, data, requestId) => l.warn(category, msg, data, requestId),
    error: (msg, data, requestId, err) => l.error(category, msg, data, requestId, err),
  };
}
