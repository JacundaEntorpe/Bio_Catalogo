import { Prisma } from "@prisma/client";

import { buildCategoryTree, collectDescendantIds, type CategoryTreeItem } from "@/lib/category-tree";
import { prisma } from "@/lib/prisma";

const categoryTreeSelect = {
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
} satisfies Prisma.CategorySelect;

export type CategoryTreeRecord = Prisma.CategoryGetPayload<{
  select: typeof categoryTreeSelect;
}>;

export async function getCategoryTreeData(): Promise<CategoryTreeItem[]> {
  const categories = await prisma.category.findMany({
    select: categoryTreeSelect,
    orderBy: [{ name: "asc" }]
  });

  return buildCategoryTree(categories);
}

export async function getFlatCategories() {
  return prisma.category.findMany({
    select: categoryTreeSelect,
    orderBy: [{ name: "asc" }]
  });
}

export async function getEntries(categoryId?: string) {
  const where: Prisma.EntryWhereInput = {};

  if (categoryId) {
    const tree = await getCategoryTreeData();
    const allowedCategoryIds = collectDescendantIds(tree, categoryId);

    if (allowedCategoryIds.length > 0) {
      where.categoryId = { in: allowedCategoryIds };
    }
  }

  return prisma.entry.findMany({
    where,
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ updatedAt: "desc" }]
  });
}

export async function getEntryById(id: string) {
  return prisma.entry.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      category: true,
      images: {
        orderBy: { sortOrder: "asc" }
      },
      observations: {
        include: {
          observer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { observedAt: "desc" }
      }
    }
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          children: true,
          entries: true
        }
      }
    }
  });
}