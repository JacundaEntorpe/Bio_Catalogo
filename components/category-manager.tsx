"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { collectDescendantIds, flattenCategoryTree, type CategoryTreeItem } from "@/lib/category-tree";

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
  const [createDraft, setCreateDraft] = useState<CategoryDraft>(emptyDraft);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>(emptyDraft);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const flatCategories = flattenCategoryTree(tree);

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
    setCreateDraft({
      ...emptyDraft,
      parentId: parentId ?? ""
    });
  }

  function openEdit(category: CategoryTreeItem) {
    setCreatingParentId(null);
    setErrorMessage(null);
    setEditingCategoryId(category.id);
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

          return (
            <article className="stack category-card" id={node.slug} key={node.id}>
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

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      {renderBranch(tree)}
    </div>
  );
}