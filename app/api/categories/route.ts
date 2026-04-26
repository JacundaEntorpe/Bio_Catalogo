import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCategoryTreeData } from "@/lib/catalog";
import { collectDescendantIds } from "@/lib/category-tree";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { categoryPayloadSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function createUniqueSlug(name: string) {
  const baseSlug = slugify(name) || "category";
  const existing = await prisma.category.findMany({
    where: {
      slug: {
        startsWith: baseSlug
      }
    },
    select: {
      slug: true
    }
  });

  if (!existing.some((category) => category.slug === baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.some((category) => category.slug === `${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function GET(_request: NextRequest) {
  const tree = await getCategoryTreeData();
  return NextResponse.json({ categories: tree });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = categoryPayloadSchema.parse(await request.json());

    if (payload.parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: payload.parentId },
        select: { id: true }
      });

      if (!parentCategory) {
        return NextResponse.json({ error: "Parent category not found." }, { status: 404 });
      }
    }

    const category = await prisma.category.create({
      data: {
        name: payload.name,
        description: payload.description,
        parentId: payload.parentId,
        ownerId: user.id,
        slug: await createUniqueSlug(payload.name)
      }
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid category payload." }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}