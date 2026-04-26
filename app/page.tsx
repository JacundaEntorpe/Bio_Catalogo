import Link from "next/link";

import { EntryCard } from "@/components/entry-card";
import { findCategoryPath } from "@/lib/category-tree";
import { getCategoryTreeData, getEntries } from "@/lib/catalog";

type HomePageProps = {
  searchParams?: {
    categoryId?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: HomePageProps) {
  const categoryId = searchParams?.categoryId;
  const [entries, categoryTree] = await Promise.all([getEntries(categoryId), getCategoryTreeData()]);
  const selectedPath = categoryId ? findCategoryPath(categoryTree, categoryId) : [];
  const selectedCategoryLabel = selectedPath.at(-1)?.name;

  return (
    <div className="page stack-lg">
      <section className="hero">
        <div className="hero__card stack-lg">
          <span className="eyebrow">Private field guide</span>
          <h1>Catalog organisms as if each one belonged to its own page in a living atlas.</h1>
          <p>
            BioCatalog keeps specimen records, habitat tags, local images, and the classification tree together so you can refine identifications over time.
          </p>
          <div className="hero__actions">
            <Link className="button" href="/entries/new">
              Create new entry
            </Link>
            <Link className="button button--ghost" href="/categories">
              Open category tree
            </Link>
          </div>
        </div>
        <aside className="hero__aside stack">
          <div>
            <span className="eyebrow">Current filter</span>
            <h2>{selectedCategoryLabel ?? "All categories"}</h2>
          </div>
          <p>{selectedCategoryLabel ? `Showing entries under ${selectedCategoryLabel} and its descendants.` : "Showing every catalog entry across the current tree."}</p>
          {selectedCategoryLabel ? (
            <Link className="button button--ghost" href="/">
              Clear filter
            </Link>
          ) : null}
        </aside>
      </section>

      <section className="stack-lg">
        <div className="sidebar__section-header">
          <div>
            <span className="eyebrow">Entries</span>
            <h2>{entries.length} records</h2>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state">
            No entries match the current filter. Create a new entry or switch to a broader category branch.
          </div>
        ) : (
          <div className="entry-grid">
            {entries.map((entry) => (
              <EntryCard entry={entry} key={entry.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}