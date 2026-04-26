import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { saveImageFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const formData = await request.formData();
  const fileEntries = formData.getAll("files");

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
  }

  const images = [] as Array<{ fileName: string; storagePath: string }>;

  for (const fileEntry of fileEntries) {
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
    }

    if (!fileEntry.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
    }

    images.push(await saveImageFile(fileEntry));
  }

  return NextResponse.json({ images }, { status: 201 });
}