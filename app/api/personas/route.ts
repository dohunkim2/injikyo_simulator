import { NextResponse } from "next/server";

import { getPersonas } from "@/lib/personas";

export async function GET() {
  const personas = await getPersonas();
  return NextResponse.json({ personas });
}
