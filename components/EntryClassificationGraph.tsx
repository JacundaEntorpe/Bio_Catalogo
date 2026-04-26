"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { GraphView } from "@/components/GraphView";
import { buildCategoryGraphData, type CategoryGraphEntryLeaf } from "@/lib/category-graph";
import { collectDescendantIds, findCategoryPath, flattenCategoryTree, type CategoryTreeItem } from "@/lib/category-tree";

type EntryClassificationGraphProps = {
  currentCategoryId: string;
  currentEntryId: string;
  entryLeaves: CategoryGraphEntryLeaf[];
  tree: CategoryTreeItem[];
};

export function EntryClassificationGraph({ currentCategoryId, currentEntryId, entryLeaves, tree }: EntryClassificationGraphProps) {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState(currentCategoryId);
  const [includeDescendantEntries, setIncludeDescendantEntries] = useState(true);

  const flatCategories = useMemo(() => flattenCategoryTree(tree), [tree]);
  const graphData = useMemo(
    () =>
      buildCategoryGraphData({
        entryLeaves,
        flatCategories,
        includeDescendantEntries,
        selectedCategoryId,
        tree
      }),
    [entryLeaves, flatCategories, includeDescendantEntries, selectedCategoryId, tree]
  );
  const selectedPath = useMemo(() => findCategoryPath(tree, selectedCategoryId), [selectedCategoryId, tree]);
  const selectedEntries = useMemo(
    () => graphData.nodes.filter((node) => node.kind === "entry"),
    [graphData.nodes]
  );
  const directLeaves = useMemo(
    () => selectedEntries.filter((node) => node.entryRelation === "direct"),
    [selectedEntries]
  );
  const descendantLeaves = useMemo(
    () => selectedEntries.filter((node) => node.entryRelation === "descendant"),
    [selectedEntries]
  );
  const descendantLeafTotal = useMemo(() => {
    if (!selectedCategoryId) {
      return 0;
    }

    const descendantIds = new Set(collectDescendantIds(tree, selectedCategoryId));
    descendantIds.delete(selectedCategoryId);

    return entryLeaves.filter((entry) => descendantIds.has(entry.categoryId)).length;
  }, [entryLeaves, selectedCategoryId, tree]);

  return (
    <div className="entry-classification-graph stack-sm">
      <div className="entry-classification-graph__header">
        <div className="stack-sm">
          <span className="eyebrow">Classification graph</span>
          <p className="form-hint">Selecione um nó para revelar as entries folha daquele ramo. Use o filtro para alternar entre folhas diretas apenas ou todo o ramo descendente. Clicar numa folha abre a entry correspondente.</p>
        </div>
        <div className="entry-classification-graph__actions stack-sm">
          <button
            className="button button--ghost button--small"
            onClick={() => setIncludeDescendantEntries((current) => !current)}
            type="button"
          >
            {includeDescendantEntries ? "Mostrar apenas entries diretas" : "Mostrar entries de descendentes"}
          </button>
          <div className="graph-legend">
            <span className="graph-legend__item graph-legend__item--current-entry">Entry atual</span>
            <span className="graph-legend__item graph-legend__item--direct-leaf">Folha direta</span>
            <span className="graph-legend__item graph-legend__item--descendant-leaf">Folha descendente</span>
          </div>
        </div>
      </div>
      <GraphView
        currentEntryId={currentEntryId}
        edges={graphData.edges}
        nodes={graphData.nodes}
        onEntrySelect={(entryId) => router.push(`/entries/${entryId}`)}
        onNodeSelect={setSelectedCategoryId}
        selectedNodeId={selectedCategoryId}
      />
      <div className="entry-classification-graph__filters">
        <div className="entry-classification-graph__filter-card entry-classification-graph__filter-card--direct">
          <span className="eyebrow">Folhas diretas</span>
          <strong>{directLeaves.length}</strong>
          <p className="form-hint">Entries ligadas diretamente ao nó selecionado.</p>
        </div>
        <div className="entry-classification-graph__filter-card entry-classification-graph__filter-card--descendant">
          <span className="eyebrow">Folhas descendentes</span>
          <strong>{includeDescendantEntries ? descendantLeaves.length : descendantLeafTotal}</strong>
          <p className="form-hint">
            {includeDescendantEntries
              ? "Entries que aparecem em subcategorias abaixo do nó selecionado."
              : descendantLeafTotal > 0
                ? "Ocultas pelo filtro atual. Ative o botão para exibi-las."
                : "Não há entries em subcategorias descendentes deste nó."}
          </p>
        </div>
      </div>
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