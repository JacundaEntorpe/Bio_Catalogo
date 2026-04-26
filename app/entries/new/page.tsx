import Link from "next/link";

import { EntryForm } from "@/components/entry-form";
import { flattenCategoryTree } from "@/lib/category-tree";
import { getCategoryTreeData } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewEntryPage() {
  const [user, categoryTree] = await Promise.all([getCurrentUser(), getCategoryTreeData()]);
  const categoryOptions = flattenCategoryTree(categoryTree).map((category) => ({
    id: category.id,
    name: category.name,
    depth: category.depth
  }));

  if (!user) {
    return (
      <div className="page-shell stack-lg">
        <h1>Creating entries requires authentication.</h1>
        <p>Sign in with the demo account before adding organisms to the catalog.</p>
        <Link className="button" href="/login?callbackUrl=/entries/new">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">New entry</span>
        <h1>Create a specimen page.</h1>
        <p>Start with the summary fields, attach local images, and add as many dated observation blocks as you need for the first field record.</p>
      </div>
      <EntryForm categories={categoryOptions} mode="create" />
    </div>
  );
}