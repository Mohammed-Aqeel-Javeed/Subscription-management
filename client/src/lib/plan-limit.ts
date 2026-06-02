export type PlanLimitErrorInfo = {
  message: string;
  status?: number;
};

export function getPlanLimitErrorInfo(error: unknown): PlanLimitErrorInfo | null {
  const anyErr = error as any;
  const message = String(anyErr?.message || "").trim();
  const status = Number(anyErr?.status);

  if (!message) return null;

  // Primary: backend sends 403 with this exact prefix.
  if (Number.isFinite(status) && status === 403 && /plan limit reached/i.test(message)) {
    return { message, status };
  }

  // Fallback: sometimes status may be lost when errors are re-thrown.
  if (/plan limit reached/i.test(message)) {
    return { message, status: Number.isFinite(status) ? status : undefined };
  }

  return null;
}

export function formatPlanLimitMessage(message: string): { title: string; detail: string } {
  const trimmed = String(message || "").trim();
  const detail = trimmed.replace(/^plan limit reached\s*:\s*/i, "").trim() || trimmed;
  return {
    title: "Plan Limit Reached",
    detail,
  };
}
