import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEntryById } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { entryPayloadSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const entry = await getEntryById(params.id);

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const existingEntry = await prisma.entry.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true }
  });

  if (!existingEntry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  if (existingEntry.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the entry owner can edit this record." }, { status: 403 });
  }

  try {
    const payload = entryPayloadSchema.parse(await request.json());

    const entry = await prisma.entry.update({
      where: { id: params.id },
      data: {
        categoryId: payload.categoryId,
        name: payload.name,
        description: payload.description,
        identificationStatus: payload.identificationStatus,
        locationText: payload.locationText,
        habitatText: payload.habitatText,
        habitatTags: payload.habitatTags,
        behaviorText: payload.behaviorText,
        images: {
          deleteMany: {},
          create: payload.images.map((image, index) => ({
            fileName: image.fileName,
            storagePath: image.storagePath,
            altText: image.altText,
            caption: image.caption,
            sortOrder: image.sortOrder ?? index
          }))
        },
        observations: {
          deleteMany: {},
          ...(payload.observations.length > 0
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
            : {})
        }
      },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid entry payload." }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update entry." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const existingEntry = await prisma.entry.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true }
  });

  if (!existingEntry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  if (existingEntry.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the entry owner can delete this record." }, { status: 403 });
  }

  await prisma.entry.delete({
    where: { id: params.id }
  });

  return NextResponse.json({ ok: true });
}