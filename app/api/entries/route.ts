import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { entryPayloadSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;
  const entries = await getEntries(categoryId);

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = entryPayloadSchema.parse(await request.json());

    const entry = await prisma.entry.create({
      data: {
        ownerId: user.id,
        categoryId: payload.categoryId,
        name: payload.name,
        description: payload.description,
        identificationStatus: payload.identificationStatus,
        locationText: payload.locationText,
        habitatText: payload.habitatText,
        habitatTags: payload.habitatTags,
        behaviorText: payload.behaviorText,
        images: {
          create: payload.images.map((image, index) => ({
            fileName: image.fileName,
            storagePath: image.storagePath,
            altText: image.altText,
            caption: image.caption,
            sortOrder: image.sortOrder ?? index
          }))
        },
        observations: payload.observations.length > 0
          ? {
              create: payload.observations.map((observation) => ({
                  observerId: user.id,
                  title: observation.title,
                  notes: observation.notes,
                  observedAt: observation.observedAt,
                  locationText: observation.locationText,
                  habitatTags: observation.habitatTags,
                  behaviorText: observation.behaviorText
                }))
            }
          : undefined
      },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid entry payload." }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create entry." }, { status: 500 });
  }
}