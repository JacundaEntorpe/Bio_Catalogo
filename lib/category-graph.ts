import { collectDescendantIds, type CategoryTreeItem } from "@/lib/category-tree";

export type CategoryGraphEntryLeaf = {
  id: string;
  name: string;
  categoryId: string;
};

export type CategoryGraphNode = {
  id: string;
  kind: "category" | "entry";
  name: string;
  parentId: string | null;
  categoryId?: string;
  entryId?: string;
  entryRelation?: "direct" | "descendant";
  description?: string | null;
  ownerId?: string | null;
  entryCount?: number;
  childCount?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

export type CategoryGraphEdge = {
  source: string;
  target: string;
};

export function buildCategoryGraphData({
  entryLeaves,
  flatCategories,
  includeDescendantEntries = true,
  selectedCategoryId,
  tree
}: {
  entryLeaves: CategoryGraphEntryLeaf[];
  flatCategories: Array<CategoryTreeItem & { depth: number }>;
  includeDescendantEntries?: boolean;
  selectedCategoryId?: string | null;
  tree: CategoryTreeItem[];
}) {
  const categoryNodes: CategoryGraphNode[] = flatCategories.map((category) => ({
    id: category.id,
    kind: "category",
    name: category.name,
    parentId: category.parentId,
    description: category.description,
    ownerId: category.ownerId,
    entryCount: category.entryCount,
    childCount: category.childCount
  }));

  const categoryEdges: CategoryGraphEdge[] = flatCategories
    .filter((category) => Boolean(category.parentId))
    .map((category) => ({
      source: category.parentId!,
      target: category.id
    }));

  if (!selectedCategoryId) {
    return {
      edges: categoryEdges,
      nodes: categoryNodes
    };
  }

  const selectedSubtreeIds = new Set(
    includeDescendantEntries ? collectDescendantIds(tree, selectedCategoryId) : [selectedCategoryId]
  );
  const entryNodes: CategoryGraphNode[] = entryLeaves
    .filter((entry) => selectedSubtreeIds.has(entry.categoryId))
    .map((entry) => ({
      id: `entry:${entry.id}`,
      kind: "entry",
      name: entry.name,
      parentId: entry.categoryId,
      categoryId: entry.categoryId,
      entryId: entry.id,
      entryRelation: entry.categoryId === selectedCategoryId ? "direct" : "descendant",
      childCount: 0,
      entryCount: 0
    }));

  const entryEdges: CategoryGraphEdge[] = entryNodes.map((entry) => ({
    source: entry.parentId!,
    target: entry.id
  }));

  return {
    edges: [...categoryEdges, ...entryEdges],
    nodes: [...categoryNodes, ...entryNodes]
  };
}