export type ToolOk<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  warnings?: string[];
};

export type ToolFail = {
  success: false;
  errorType: string;
  error: string;
  details?: unknown;
  meta?: Record<string, unknown>;
};

export type ToolEnvelope<T> = ToolOk<T> | ToolFail;

export function toolOk<T>(data: T, meta?: Record<string, unknown>, warnings?: string[]): ToolOk<T> {
  return warnings?.length ? { success: true, data, meta, warnings } : { success: true, data, meta };
}

export function toolFail(
  errorType: string,
  error: string,
  details?: unknown,
  meta?: Record<string, unknown>,
): ToolFail {
  return details !== undefined
    ? { success: false, errorType, error, details, meta }
    : { success: false, errorType, error, meta };
}
