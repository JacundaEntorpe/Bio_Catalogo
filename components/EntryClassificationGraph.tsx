"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { GraphView } from "@/components/GraphView";
import { buildCategoryGraphData, type CategoryGraphEntryLeaf } from "@/lib/category-graph";
import { findCategoryPath, flattenCategoryTree, type CategoryTreeItem } from "@/lib/category-tree";

type EntryClassificationGraphProps = {
  currentCategoryId: string;
  entryLeaves: CategoryGraphEntryLeaf[];
  tree: CategoryTreeItem[];
};

export function EntryClassificationGraph({ currentCategoryId, entryLeaves, tree }: EntryClassificationGraphProps) {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState(currentCategoryId);

  const flatCategories = useMemo(() => flattenCategoryTree(tree), [tree]);
  const graphData = useMemo(
    () =>
      buildCategoryGraphData({
        entryLeaves,
        flatCategories,
        selectedCategoryId,
        tree
      }),
    [entryLeaves, flatCategories, selectedCategoryId, tree]
  );
  const selectedPath = useMemo(() => findCategoryPath(tree, selectedCategoryId), [selectedCategoryId, tree]);

  return (
    <div className="entry-classification-graph stack-sm">
      <div className="entry-classification-graph__header">
        <div className="stack-sm">
          <span className="eyebrow">Classification graph</span>
          <p className="form-hint">Selecione um nó para revelar as entries folha daquele ramo. Clicar numa folha abre a entry correspondente.</p>
        </div>
      </div>
      <GraphView
        edges={graphData.edges}
        nodes={graphData.nodes}
        onEntrySelect={(entryId) => router.push(`/entries/${entryId}`)}
        onNodeSelect={setSelectedCategoryId}
        selectedNodeId={selectedCategoryId}
      />
      <div className="graph-meta__path">
        {selectedPath.map((category, index) => (
          <Link className={category.id === selectedCategoryId ? "graph-meta__path-link graph-meta__path-link--active" : "graph-meta__path-link"} href={`/?categoryId=${category.id}`} key={category.id}>
            <span>{category.name}</span>
            {index < selectedPath.length - 1 ? <span className="graph-meta__path-separator">/</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}