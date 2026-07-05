import { NextResponse } from "next/server";
import { ApiError } from "./api";

export function err(status: number, message: string, code = "API_ERROR") {
  return NextResponse.json(
    { ok: false, error: message, code },
    { status }
  );
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) {
    return err(e.status, e.message, e.code);
  }

  const message = e instanceof Error ? e.message : "服务器内部错误";
  return err(500, message, "INTERNAL_ERROR");
}
