"use client";

import { GraphView, type GraphViewHandle } from "@/components/GraphView";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { buildCategoryGraphData, type CategoryGraphEntryLeaf } from "@/lib/category-graph";
import { collectDescendantIds, findCategoryPath, flattenCategoryTree, type CategoryTreeItem } from "@/lib/category-tree";

type CategoryManagerProps = {
  entryLeaves: CategoryGraphEntryLeaf[];
  initialTree: CategoryTreeItem[];
  currentUserId?: string;
};

type CategoryDraft = {
  name: string;
  description: string;
  parentId: string;
};

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  parentId: ""
};

type CategoryViewMode = "tree" | "graph";

function normalizeDraft(draft: CategoryDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    parentId: draft.parentId || undefined
  };
}

export function CategoryManager({ currentUserId, entryLeaves, initialTree }: CategoryManagerProps) {
  const router = useRouter();
  const graphViewRef = useRef<GraphViewHandle | null>(null);
  const graphHotkeysRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [tree, setTree] = useState(initialTree);
  const [viewMode, setViewMode] = useState<CategoryViewMode>("tree");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [includeDescendantEntries, setIncludeDescendantEntries] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDraft, setCreateDraft] = useState<CategoryDraft>(emptyDraft);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>(emptyDraft);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

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
  const selectedCategory = useMemo(
    () => flatCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [flatCategories, selectedCategoryId]
  );
  const selectedPath = useMemo(
    () => (selectedCategoryId ? findCategoryPath(tree, selectedCategoryId) : []),
    [selectedCategoryId, tree]
  );
  const selectedCategoryChildren = useMemo(() => selectedCategory?.children ?? [], [selectedCategory]);
  const selectedCategoryDescendantCount = useMemo(
    () => (selectedCategoryId ? Math.max(collectDescendantIds(tree, selectedCategoryId).length - 1, 0) : 0),
    [selectedCategoryId, tree]
  );
  const selectedCategoryDepth = Math.max(selectedPath.length - 1, 0);
  const selectedCategorySiblingCount = useMemo(() => {
    if (!selectedCategory) {
      return 0;
    }

    return flatCategories.filter(
      (category) => category.parentId === selectedCategory.parentId && category.id !== selectedCategory.id
    ).length;
  }, [flatCategories, selectedCategory]);
  const selectedParentCategory = selectedPath.length > 1 ? selectedPath[selectedPath.length - 2] : null;
  const graphSearchResults = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return [...flatCategories]
      .map((category) => {
        const name = category.name.toLowerCase();
        const description = category.description?.toLowerCase() ?? "";
        const score = name.startsWith(query) ? 0 : name.includes(query) ? 1 : description.includes(query) ? 2 : 3;

        return {
          category,
          score
        };
      })
      .filter((result) => result.score < 3)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }

        return left.category.name.localeCompare(right.category.name);
      })
      .slice(0, 8)
      .map((result) => result.category);
  }, [deferredSearchQuery, flatCategories]);

  useEffect(() => {
    if (selectedCategoryId && !flatCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [flatCategories, selectedCategoryId]);

  async function refreshCategories() {
    const response = await fetch("/api/categories", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { error?: string; categories?: CategoryTreeItem[] } | null;

    if (!response.ok || !payload?.categories) {
      throw new Error(payload?.error ?? "Unable to refresh categories.");
    }

    setTree(payload.categories);
    router.refresh();
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("create");
    setErrorMessage(null);

    try {
      const payload = normalizeDraft(createDraft);
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to create category.");
      }

      setCreateDraft(emptyDraft);
      setCreatingParentId(null);
      await refreshCategories();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create category.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>, categoryId: string) {
    event.preventDefault();
    setBusyKey(`edit:${categoryId}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(normalizeDraft(editDraft))
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to update category.");
      }

      setEditingCategoryId(null);
      setEditDraft(emptyDraft);
      await refreshCategories();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update category.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteCategory(category: CategoryTreeItem) {
    if (!confirm(`Delete category "${category.name}"?`)) {
      return;
    }

    setBusyKey(`delete:${category.id}`);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE"
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to delete category.");
      }

      await refreshCategories();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete category.");
    } finally {
      setBusyKey(null);
    }
  }

  function openCreate(parentId?: string) {
    setEditingCategoryId(null);
    setErrorMessage(null);
    setCreatingParentId(parentId ?? "root");
    setSelectedCategoryId(parentId ?? null);
    setCreateDraft({
      ...emptyDraft,
      parentId: parentId ?? ""
    });
  }

  function openEdit(category: CategoryTreeItem) {
    setCreatingParentId(null);
    setErrorMessage(null);
    setEditingCategoryId(category.id);
    setSelectedCategoryId(category.id);
    setEditDraft({
      name: category.name,
      description: category.description ?? "",
      parentId: category.parentId ?? ""
    });
  }

  function focusCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);

    if (viewMode === "graph") {
      window.setTimeout(() => {
        graphViewRef.current?.focusNode(categoryId);
      }, 0);
    }
  }

  function handleSearchSelection(categoryId: string) {
    setViewMode("graph");
    setSearchQuery("");
    focusCategory(categoryId);
    graphHotkeysRef.current?.focus();
  }

  function handleGraphKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const isFormControl =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement;

    if (isFormControl) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      graphViewRef.current?.zoomIn();
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      graphViewRef.current?.zoomOut();
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      graphViewRef.current?.resetView();
      return;
    }

    if (!selectedCategory) {
      if (flatCategories[0] && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        focusCategory(flatCategories[0].id);
      }

      return;
    }

    let nextCategoryId: string | null = null;

    if (event.key === "ArrowUp") {
      nextCategoryId = selectedCategory.parentId;
    }

    if (event.key === "ArrowDown") {
      nextCategoryId = selectedCategory.children[0]?.id ?? null;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const siblings = flatCategories.filter((category) => category.parentId === selectedCategory.parentId);
      const currentIndex = siblings.findIndex((category) => category.id === selectedCategory.id);
      const offset = event.key === "ArrowLeft" ? -1 : 1;
      nextCategoryId = siblings[currentIndex + offset]?.id ?? null;
    }

    if (nextCategoryId) {
      event.preventDefault();
      focusCategory(nextCategoryId);
    }
  }

  function categoryOptions(forCategoryId?: string) {
    const excludedIds = forCategoryId ? new Set(collectDescendantIds(tree, forCategoryId)) : new Set<string>();

    return flatCategories.filter((category) => !excludedIds.has(category.id));
  }

  function renderForm(mode: "create" | "edit", categoryId?: string) {
    const draft = mode === "create" ? createDraft : editDraft;
    const options = categoryOptions(mode === "edit" ? categoryId : undefined);
    const submitLabel = mode === "create" ? "Create category" : "Save category";
    const submitBusy = mode === "create" ? busyKey === "create" : busyKey === `edit:${categoryId}`;

    return (
      <form className="category-editor stack" onSubmit={(event) => (mode === "create" ? submitCreate(event) : submitEdit(event, categoryId!))}>
        <div className="category-editor__grid">
          <label className="field">
            <span>Name</span>
            <input
              onChange={(event) =>
                mode === "create"
                  ? setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  : setEditDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Mosses, beetles, epiphytes..."
              value={draft.name}
            />
          </label>
          <label className="field">
            <span>Parent branch</span>
            <select
              onChange={(event) =>
                mode === "create"
                  ? setCreateDraft((current) => ({ ...current, parentId: event.target.value }))
                  : setEditDraft((current) => ({ ...current, parentId: event.target.value }))
              }
              value={draft.parentId}
            >
              <option value="">No parent</option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {`${"· ".repeat(category.depth)}${category.name}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea
              onChange={(event) =>
                mode === "create"
                  ? setCreateDraft((current) => ({ ...current, description: event.target.value }))
                  : setEditDraft((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              value={draft.description}
            />
          </label>
        </div>
        <div className="hero__actions">
          <button className="button" disabled={submitBusy} type="submit">
            {submitBusy ? "Saving..." : submitLabel}
          </button>
          <button
            className="button button--ghost"
            onClick={() => {
              setEditingCategoryId(null);
              setCreatingParentId(null);
              setEditDraft(emptyDraft);
              setCreateDraft(emptyDraft);
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderBranch(nodes: CategoryTreeItem[]) {
    return (
      <div className="category-grid">
        {nodes.map((node) => {
          const canEdit = currentUserId === node.ownerId;
          const deleteBlocked = node.childCount > 0 || node.entryCount > 0;
          const isSelected = selectedCategoryId === node.id;

          return (
            <article className={isSelected ? "stack category-card category-card--selected" : "stack category-card"} id={node.slug} key={node.id}>
              <div className="stack-sm">
                <span className="eyebrow">Category</span>
                <h2>{node.name}</h2>
              </div>
              <p>{node.description ?? "No description yet for this branch."}</p>
              <div className="chip-row">
                <span className="chip">{node.entryCount} entries</span>
                <span className="chip">{node.childCount} children</span>
                <span className="chip">{node.ownerId ? (canEdit ? "Your branch" : "User branch") : "Shared branch"}</span>
              </div>
              <div className="hero__actions">
                <button className="button button--ghost button--small" onClick={() => focusCategory(node.id)} type="button">
                  {isSelected ? "Selected" : "Select"}
                </button>
                <Link className="button button--ghost button--small" href={`/?categoryId=${node.id}`}>
                  Filter entries
                </Link>
                {currentUserId ? (
                  <button className="button button--ghost button--small" onClick={() => openCreate(node.id)} type="button">
                    Add child
                  </button>
                ) : null}
                {canEdit ? (
                  <button className="button button--ghost button--small" onClick={() => openEdit(node)} type="button">
                    Edit
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    className="button button--ghost button--small"
                    disabled={busyKey === `delete:${node.id}` || deleteBlocked}
                    onClick={() => deleteCategory(node)}
                    type="button"
                  >
                    {busyKey === `delete:${node.id}` ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
              {deleteBlocked && canEdit ? (
                <p className="form-hint">Delete is available only when the category has no direct entries and no child categories.</p>
              ) : null}
              {editingCategoryId === node.id ? renderForm("edit", node.id) : null}
              {creatingParentId === node.id ? renderForm("create") : null}
              {node.children.length > 0 ? renderBranch(node.children) : null}
            </article>
          );
        })}
      </div>
    );
  }

  function renderSelectedCategoryPanel() {
    if (!selectedCategory) {
      return (
        <section className="graph-meta graph-meta--empty stack">
          <span className="eyebrow">Selection</span>
          <h2>Select a category node.</h2>
          <p>Click any node in the graph or use Select in the card view to inspect its path and available actions.</p>
          <div className="graph-meta__empty-points">
            <span className="chip">Path highlighting follows the selected node</span>
            <span className="chip">Node dragging stays enabled while you explore</span>
            <span className="chip">Graph view preserves your selection when switching modes</span>
          </div>
        </section>
      );
    }

    const canEdit = currentUserId === selectedCategory.ownerId;
    const deleteBlocked = selectedCategory.childCount > 0 || selectedCategory.entryCount > 0;

    return (
      <section className="graph-meta stack">
        <span className="eyebrow">Selected category</span>
        <div className="graph-meta__hero">
          <div className="stack-sm">
            <h2>{selectedCategory.name}</h2>
            <p>{selectedCategory.description ?? "No description yet for this branch."}</p>
          </div>
          <div className="graph-meta__hero-badge">Depth {selectedCategoryDepth}</div>
        </div>
        <div className="graph-stat-grid">
          <article className="graph-stat">
            <span className="eyebrow">Entries</span>
            <strong>{selectedCategory.entryCount}</strong>
          </article>
          <article className="graph-stat">
            <span className="eyebrow">Children</span>
            <strong>{selectedCategory.childCount}</strong>
          </article>
          <article className="graph-stat">
            <span className="eyebrow">Descendants</span>
            <strong>{selectedCategoryDescendantCount}</strong>
          </article>
          <article className="graph-stat">
            <span className="eyebrow">Siblings</span>
            <strong>{selectedCategorySiblingCount}</strong>
          </article>
        </div>
        <div className="chip-row">
          <span className="chip">{selectedCategory.ownerId ? (canEdit ? "Your branch" : "User branch") : "Shared branch"}</span>
          {selectedParentCategory ? <span className="chip">Parent: {selectedParentCategory.name}</span> : <span className="chip">Root node</span>}
        </div>
        <section className="graph-meta__section stack-sm">
          <span className="eyebrow">Path from root</span>
          <div className="graph-meta__path">
            {selectedPath.map((category, index) => (
              <button
                className={category.id === selectedCategory.id ? "graph-meta__path-button graph-meta__path-button--active" : "graph-meta__path-button"}
                key={category.id}
                onClick={() => focusCategory(category.id)}
                type="button"
              >
                <span>{category.name}</span>
                {index < selectedPath.length - 1 ? <span className="graph-meta__path-separator">/</span> : null}
              </button>
            ))}
          </div>
        </section>
        <section className="graph-meta__section stack-sm">
          <span className="eyebrow">Immediate children</span>
          {selectedCategoryChildren.length > 0 ? (
            <div className="graph-meta__child-list">
              {selectedCategoryChildren.slice(0, 8).map((childCategory) => (
                <button
                  className="graph-meta__child-button"
                  key={childCategory.id}
                  onClick={() => focusCategory(childCategory.id)}
                  type="button"
                >
                  <strong>{childCategory.name}</strong>
                  <span>
                    {childCategory.entryCount} entries · {childCategory.childCount} children
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="form-hint">This branch has no immediate children yet.</p>
          )}
        </section>
        <div className="hero__actions">
          <Link className="button button--ghost button--small" href={`/?categoryId=${selectedCategory.id}`}>
            Filter entries
          </Link>
          {currentUserId ? (
            <button className="button button--ghost button--small" onClick={() => openCreate(selectedCategory.id)} type="button">
              Add child
            </button>
          ) : null}
          {canEdit ? (
            <button className="button button--ghost button--small" onClick={() => openEdit(selectedCategory)} type="button">
              Edit
            </button>
          ) : null}
          {canEdit ? (
            <button
              className="button button--ghost button--small"
              disabled={busyKey === `delete:${selectedCategory.id}` || deleteBlocked}
              onClick={() => deleteCategory(selectedCategory)}
              type="button"
            >
              {busyKey === `delete:${selectedCategory.id}` ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>
        {deleteBlocked && canEdit ? (
          <p className="form-hint">Delete is available only when the category has no direct entries and no child categories.</p>
        ) : null}
        {editingCategoryId === selectedCategory.id ? renderForm("edit", selectedCategory.id) : null}
        {creatingParentId === selectedCategory.id ? renderForm("create") : null}
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {currentUserId ? (
        <section className="category-toolbar stack">
          <div className="entry-form__section-header">
            <div className="stack-sm">
              <span className="eyebrow">Manage categories</span>
              <p className="form-hint">Create new root branches or add child branches inside the existing taxonomy tree.</p>
            </div>
            <button className="button" onClick={() => openCreate()} type="button">
              New root category
            </button>
          </div>
          {creatingParentId === "root" ? renderForm("create") : null}
        </section>
      ) : (
        <div className="empty-state">Sign in to create personal category branches or edit categories you own.</div>
      )}

      <section className="category-view-panel stack">
        <div className="category-view-header">
          <div className="stack-sm">
            <span className="eyebrow">View mode</span>
            <p className="form-hint">Switch between the current card layout and a force-directed graph map of the taxonomy tree.</p>
          </div>
          <div className="view-toggle" role="tablist" aria-label="Category view mode">
            <button
              aria-selected={viewMode === "tree"}
              className={viewMode === "tree" ? "view-toggle__button view-toggle__button--active" : "view-toggle__button"}
              onClick={() => setViewMode("tree")}
              role="tab"
              type="button"
            >
              Tree view
            </button>
            <button
              aria-selected={viewMode === "graph"}
              className={viewMode === "graph" ? "view-toggle__button view-toggle__button--active" : "view-toggle__button"}
              onClick={() => setViewMode("graph")}
              role="tab"
              type="button"
            >
              Graph View
            </button>
          </div>
        </div>

        <div className={viewMode === "graph" ? "category-view-pane category-view-pane--active" : "category-view-pane category-view-pane--hidden"}>
          <div className="graph-shell">
            <section className="graph-panel stack-sm">
              <div className="graph-panel__header">
                <div className="stack-sm">
                  <span className="eyebrow">Graph map</span>
                  <p className="form-hint">Drag nodes, pan the canvas, zoom in or out, and click a node to highlight its full path back to the root. Label density and spacing adapt automatically as the taxonomy grows.</p>
                </div>
                <div className="graph-legend">
                  <span className="graph-legend__item graph-legend__item--selected">Selected</span>
                  <span className="graph-legend__item graph-legend__item--path">Path</span>
                  <span className="graph-legend__item graph-legend__item--descendant-branch">Descendants</span>
                  <span className="graph-legend__item graph-legend__item--other">Other</span>
                </div>
              </div>
              <div className="graph-toolbar">
                <div className="graph-toolbar__search stack-sm">
                  <label className="field">
                    <span>Search nodes</span>
                    <input
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Jump to a category by name"
                      ref={searchInputRef}
                      value={searchQuery}
                    />
                  </label>
                  {graphSearchResults.length > 0 ? (
                    <div className="graph-search-results">
                      {graphSearchResults.map((category) => (
                        <button className="graph-search-results__item" key={category.id} onClick={() => handleSearchSelection(category.id)} type="button">
                          <strong>{category.name}</strong>
                          <span>{category.entryCount} entries · {category.childCount} children</span>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.trim() ? (
                    <p className="form-hint">No matching categories.</p>
                  ) : null}
                </div>
                <div className="graph-toolbar__controls stack-sm">
                  <div className="graph-control-row">
                    <button
                      className="button button--ghost button--small"
                      onClick={() => setIncludeDescendantEntries((current) => !current)}
                      type="button"
                    >
                      {includeDescendantEntries ? "Only direct entries" : "Include descendant entries"}
                    </button>
                    <button className="button button--ghost button--small" onClick={() => graphViewRef.current?.zoomIn()} type="button">
                      Zoom in
                    </button>
                    <button className="button button--ghost button--small" onClick={() => graphViewRef.current?.zoomOut()} type="button">
                      Zoom out
                    </button>
                    <button className="button button--ghost button--small" onClick={() => graphViewRef.current?.resetView()} type="button">
                      Reset
                    </button>
                  </div>
                  <div className="graph-hotkeys">
                    <span className="chip">Arrows: navigate relatives</span>
                    <span className="chip">+/-: zoom</span>
                    <span className="chip">0: reset</span>
                    <span className="chip">/: search</span>
                  </div>
                </div>
              </div>
              <div className="graph-hotkey-surface" onKeyDown={handleGraphKeyDown} onPointerDown={() => graphHotkeysRef.current?.focus()} ref={graphHotkeysRef} tabIndex={0}>
              <GraphView
                edges={graphData.edges}
                isVisible={viewMode === "graph"}
                nodes={graphData.nodes}
                onEntrySelect={(entryId) => router.push(`/entries/${entryId}`)}
                onNodeSelect={setSelectedCategoryId}
                ref={graphViewRef}
                selectedNodeId={selectedCategoryId}
              />
              </div>
            </section>
            {renderSelectedCategoryPanel()}
          </div>
        </div>
        <div className={viewMode === "tree" ? "category-view-pane category-view-pane--active" : "category-view-pane category-view-pane--hidden"}>
          {renderBranch(tree)}
        </div>
      </section>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}