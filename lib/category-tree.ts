type CategoryLike = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  ownerId?: string | null;
  description?: string | null;
  _count?: {
    entries?: number;
    children?: number;
  };
};

export type CategoryTreeItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  ownerId?: string | null;
  description?: string | null;
  entryCount: number;
  childCount: number;
  children: CategoryTreeItem[];
};

export function buildCategoryTree(categories: CategoryLike[]) {
  const map = new Map<string, CategoryTreeItem>();
  const roots: CategoryTreeItem[] = [];

  for (const category of categories) {
    map.set(category.id, {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      ownerId: category.ownerId,
      description: category.description,
      entryCount: category._count?.entries ?? 0,
      childCount: category._count?.children ?? 0,
      children: []
    });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
      continue;
    }

    roots.push(node);
  }

  const sortNodes = (items: CategoryTreeItem[]) => {
    items.sort((left, right) => left.name.localeCompare(right.name));
    for (const item of items) {
      sortNodes(item.children);
    }
  };

  sortNodes(roots);

  return roots;
}

export function flattenCategoryTree(tree: CategoryTreeItem[], depth = 0): Array<CategoryTreeItem & { depth: number }> {
  return tree.flatMap((node) => [
    { ...node, depth },
    ...flattenCategoryTree(node.children, depth + 1)
  ]);
}

export function findCategoryPath(tree: CategoryTreeItem[], categoryId: string): CategoryTreeItem[] {
  for (const node of tree) {
    if (node.id === categoryId) {
      return [node];
    }

    const childPath = findCategoryPath(node.children, categoryId);
    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
}

export function collectDescendantIds(tree: CategoryTreeItem[], categoryId: string): string[] {
  const target = findCategoryPath(tree, categoryId).at(-1);
  if (!target) {
    return [];
  }

  const ids: string[] = [];

  const visit = (node: CategoryTreeItem) => {
    ids.push(node.id);
    node.children.forEach(visit);
  };

  visit(target);

  return ids;
}