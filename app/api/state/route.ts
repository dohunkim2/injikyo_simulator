import { NextResponse } from "next/server";

import { getLastClearedAt, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ lastClearedAt: null });
  }

  try {
    const lastClearedAt = await getLastClearedAt();
    return NextResponse.json({ lastClearedAt });
  } catch (error) {
    console.error("Failed to read admin_state.last_cleared_at", error);
    return NextResponse.json({ lastClearedAt: null });
  }
}
