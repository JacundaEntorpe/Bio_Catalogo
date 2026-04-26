import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCategoryById } from "@/lib/catalog";
import { buildCategoryTree, collectDescendantIds } from "@/lib/category-tree";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { categoryPayloadSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function createUniqueSlug(name: string, currentCategoryId?: string) {
  const baseSlug = slugify(name) || "category";
  const existing = await prisma.category.findMany({
    where: {
      slug: {
        startsWith: baseSlug
      },
      NOT: currentCategoryId
        ? {
            id: currentCategoryId
          }
        : undefined
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

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const category = await getCategoryById(params.id);

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json({ category });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = categoryPayloadSchema.parse(await request.json());
    const existingCategory = await prisma.category.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        ownerId: true,
        name: true
      }
    });

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    if (existingCategory.ownerId !== user.id) {
      return NextResponse.json({ error: "Only the category owner can edit this category." }, { status: 403 });
    }

    if (payload.parentId) {
      if (payload.parentId === params.id) {
        return NextResponse.json({ error: "A category cannot be its own parent." }, { status: 400 });
      }

      const categoryTree = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          ownerId: true,
          description: true,
          _count: {
            select: {
              entries: true,
              children: true
            }
          }
        }
      });
      const disallowedParentIds = new Set(collectDescendantIds(buildCategoryTree(categoryTree), params.id));

      if (disallowedParentIds.has(payload.parentId)) {
        return NextResponse.json({ error: "A category cannot move inside its own descendant branch." }, { status: 400 });
      }

      const parentCategory = await prisma.category.findUnique({
        where: { id: payload.parentId },
        select: { id: true }
      });

      if (!parentCategory) {
        return NextResponse.json({ error: "Parent category not found." }, { status: 404 });
      }
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        description: payload.description,
        parentId: payload.parentId,
        slug:
          payload.name !== existingCategory.name
            ? await createUniqueSlug(payload.name, existingCategory.id)
            : undefined
      }
    });

    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid category payload." }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    include: {
      owner: {
        select: {
          id: true
        }
      },
      _count: {
        select: {
          children: true,
          entries: true
        }
      }
    }
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (category.owner?.id !== user.id) {
    return NextResponse.json({ error: "Only the category owner can delete this category." }, { status: 403 });
  }

  if (category._count.children > 0 || category._count.entries > 0) {
    return NextResponse.json(
      { error: "Remove child categories and entries before deleting this category." },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}