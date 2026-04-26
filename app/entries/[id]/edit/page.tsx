import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/entry-form";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getCategoryTreeData, getEntryById } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type EditEntryPageProps = {
  params: {
    id: string;
  };
};

export default async function EditEntryPage({ params }: EditEntryPageProps) {
  const [user, entry, categoryTree] = await Promise.all([getCurrentUser(), getEntryById(params.id), getCategoryTreeData()]);

  if (!entry) {
    notFound();
  }

  if (!user) {
    return (
      <div className="page-shell stack-lg">
        <h1>Editing requires authentication.</h1>
        <p>Sign in before modifying catalog records.</p>
        <Link className="button" href={`/login?callbackUrl=/entries/${params.id}/edit`}>
          Go to login
        </Link>
      </div>
    );
  }

  if (entry.ownerId !== user.id) {
    return (
      <div className="page-shell stack-lg">
        <h1>This entry belongs to another user.</h1>
        <p>The MVP restricts editing to the owner of the record.</p>
        <Link className="button button--ghost" href={`/entries/${entry.id}`}>
          Return to entry
        </Link>
      </div>
    );
  }

  const categoryOptions = flattenCategoryTree(categoryTree).map((category) => ({
    id: category.id,
    name: category.name,
    depth: category.depth
  }));

  return (
    <div className="page-shell stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Edit entry</span>
        <h1>Refine the current record.</h1>
        <p>Changes overwrite the main entry fields for the MVP, including the current observation list and its per-note details.</p>
      </div>
      <EntryForm
        categories={categoryOptions}
        entryId={entry.id}
        initialValues={{
          categoryId: entry.categoryId,
          name: entry.name,
          description: entry.description,
          identificationStatus: entry.identificationStatus,
          locationText: entry.locationText,
          habitatText: entry.habitatText,
          habitatTags: entry.habitatTags,
          behaviorText: entry.behaviorText,
          images: entry.images.map((image) => ({
            fileName: image.fileName,
            storagePath: image.storagePath,
            altText: image.altText ?? undefined,
            caption: image.caption ?? undefined,
            sortOrder: image.sortOrder
          })),
          observations: entry.observations.map((observation) => ({
            title: observation.title,
            notes: observation.notes,
            observedAt: observation.observedAt,
            locationText: observation.locationText,
            habitatTags: observation.habitatTags,
            behaviorText: observation.behaviorText
          }))
        }}
        mode="edit"
      />
    </div>
  );
}