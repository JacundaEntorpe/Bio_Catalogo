import Link from "next/link";
import { notFound } from "next/navigation";

import { BookGallery } from "@/components/book-gallery";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EntryClassificationGraph } from "@/components/EntryClassificationGraph";
import { StatusBadge } from "@/components/status-badge";
import { findCategoryPath } from "@/lib/category-tree";
import { getCategoryTreeData, getEntryById, getGraphEntries } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type EntryDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function EntryDetailPage({ params }: EntryDetailPageProps) {
  const [entry, categoryTree, entryLeaves, currentUser] = await Promise.all([
    getEntryById(params.id),
    getCategoryTreeData(),
    getGraphEntries(),
    getCurrentUser()
  ]);

  if (!entry) {
    notFound();
  }

  const path = findCategoryPath(categoryTree, entry.categoryId);

  return (
    <article className="entry-detail stack-lg">
      <div className="stack-sm">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...path.map((category) => ({ label: category.name, href: `/?categoryId=${category.id}` })),
            { label: entry.name ?? "Unnamed specimen" }
          ]}
        />
        <span className="eyebrow">Book view</span>
        <div className="entry-detail__actions">
          <div className="stack-sm">
            <h1>{entry.name ?? "Unnamed specimen"}</h1>
            <p>{entry.locationText ?? "Location not recorded yet."}</p>
          </div>
          <div className="entry-detail__actions">
            <StatusBadge status={entry.identificationStatus} />
            {currentUser?.id === entry.ownerId ? (
              <Link className="button button--ghost" href={`/entries/${entry.id}/edit`}>
                Edit entry
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="entry-detail__grid">
        <section className="entry-detail__content">
          <BookGallery images={entry.images} />

          <section className="section-card stack-sm">
            <span className="eyebrow">Description</span>
            <p>{entry.description}</p>
          </section>

          <section className="section-card stack-sm">
            <span className="eyebrow">Habitat</span>
            <p>{entry.habitatText ?? "No habitat description yet."}</p>
            <div className="chip-row">
              {entry.habitatTags.length > 0 ? entry.habitatTags.map((tag) => <span className="chip" key={tag}>{tag}</span>) : <span className="chip">No habitat tags</span>}
            </div>
          </section>

          <section className="section-card stack-sm">
            <span className="eyebrow">Behavior</span>
            <p>{entry.behaviorText ?? "No behavior recorded yet."}</p>
          </section>
        </section>

        <aside className="entry-detail__sidebar">
          <section className="stack-panel stack-sm">
            <span className="eyebrow">Classification path</span>
            <div className="stack-sm">
              {path.map((category) => (
                <Link href={`/?categoryId=${category.id}`} key={category.id}>
                  {category.name}
                </Link>
              ))}
            </div>
            <EntryClassificationGraph currentCategoryId={entry.categoryId} currentEntryId={entry.id} entryLeaves={entryLeaves} tree={categoryTree} />
          </section>

          <section className="stack-panel stack-sm">
            <span className="eyebrow">Field notes</span>
            {entry.observations.length > 0 ? (
              entry.observations.map((observation) => (
                <article className="note" key={observation.id}>
                  <strong>{observation.title ?? "Observation"}</strong>
                  <p>{observation.notes}</p>
                  {observation.locationText ? <small>Location: {observation.locationText}</small> : null}
                  {observation.behaviorText ? <small>Behavior: {observation.behaviorText}</small> : null}
                  {observation.habitatTags.length > 0 ? (
                    <div className="chip-row">
                      {observation.habitatTags.map((tag) => (
                        <span className="chip" key={`${observation.id}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <small>
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(observation.observedAt)}
                  </small>
                  {observation.observer ? <small>Recorded by {observation.observer.name ?? observation.observer.email}</small> : null}
                </article>
              ))
            ) : (
              <p>No observation notes have been added yet.</p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}