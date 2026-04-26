"use client";

import { GraphView, type GraphViewEdge, type GraphViewNode } from "@/components/GraphView";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { collectDescendantIds, findCategoryPath, flattenCategoryTree, type CategoryTreeItem } from "@/lib/category-tree";

type CategoryManagerProps = {
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

export function CategoryManager({ currentUserId, initialTree }: CategoryManagerProps) {
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [viewMode, setViewMode] = useState<CategoryViewMode>("tree");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<CategoryDraft>(emptyDraft);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>(emptyDraft);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const flatCategories = useMemo(() => flattenCategoryTree(tree), [tree]);
  const graphNodes = useMemo<GraphViewNode[]>(
    () =>
      flatCategories.map((category) => ({
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        description: category.description,
        ownerId: category.ownerId,
        entryCount: category.entryCount,
        childCount: category.childCount
      })),
    [flatCategories]
  );
  const graphEdges = useMemo<GraphViewEdge[]>(
    () =>
      flatCategories
        .filter((category) => Boolean(category.parentId))
        .map((category) => ({
          source: category.parentId!,
          target: category.id
        })),
    [flatCategories]
  );
  const selectedCategory = useMemo(
    () => flatCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [flatCategories, selectedCategoryId]
  );
  const selectedPath = useMemo(
    () => (selectedCategoryId ? findCategoryPath(tree, selectedCategoryId) : []),
    [selectedCategoryId, tree]
  );

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
                <button className="button button--ghost button--small" onClick={() => setSelectedCategoryId(node.id)} type="button">
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
        <section className="graph-meta stack">
          <span className="eyebrow">Selection</span>
          <h2>Select a category node.</h2>
          <p>Click any node in the graph or use Select in the card view to inspect its path and available actions.</p>
        </section>
      );
    }

    const canEdit = currentUserId === selectedCategory.ownerId;
    const deleteBlocked = selectedCategory.childCount > 0 || selectedCategory.entryCount > 0;

    return (
      <section className="graph-meta stack">
        <span className="eyebrow">Selected category</span>
        <h2>{selectedCategory.name}</h2>
        <p>{selectedCategory.description ?? "No description yet for this branch."}</p>
        <div className="chip-row">
          <span className="chip">{selectedCategory.entryCount} entries</span>
          <span className="chip">{selectedCategory.childCount} children</span>
          <span className="chip">{selectedCategory.ownerId ? (canEdit ? "Your branch" : "User branch") : "Shared branch"}</span>
        </div>
        <div className="graph-meta__path">
          {selectedPath.map((category, index) => (
            <span className="graph-meta__path-item" key={category.id}>
              <span>{category.name}</span>
              {index < selectedPath.length - 1 ? <span className="graph-meta__path-separator">/</span> : null}
            </span>
          ))}
        </div>
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

        {viewMode === "graph" ? (
          <div className="graph-shell">
            <section className="graph-panel stack-sm">
              <div className="graph-panel__header">
                <div className="stack-sm">
                  <span className="eyebrow">Graph map</span>
                  <p className="form-hint">Drag nodes, pan the canvas, zoom in or out, and click a node to highlight its full path back to the root.</p>
                </div>
                <div className="graph-legend">
                  <span className="graph-legend__item graph-legend__item--selected">Selected</span>
                  <span className="graph-legend__item graph-legend__item--path">Path</span>
                  <span className="graph-legend__item graph-legend__item--other">Other</span>
                </div>
              </div>
              <GraphView edges={graphEdges} nodes={graphNodes} onNodeSelect={setSelectedCategoryId} selectedNodeId={selectedCategoryId} />
            </section>
            {renderSelectedCategoryPanel()}
          </div>
        ) : (
          renderBranch(tree)
        )}
      </section>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}