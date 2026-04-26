import { NextResponse } from "next/server";

import { getCategoryTreeData } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await getCategoryTreeData();
  return NextResponse.json({ categories });
}