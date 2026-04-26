import { CategoryManager } from "@/components/category-manager";
import { getCategoryTreeData, getGraphEntries } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [tree, entryLeaves, currentUser] = await Promise.all([getCategoryTreeData(), getGraphEntries(), getCurrentUser()]);

  return (
    <div className="page stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Classification tree</span>
        <h1>Browse the current taxonomy structure.</h1>
        <p>Each category can hold direct entries and its own child branches. Switch between card browsing and a graph view while keeping the current selected category in focus.</p>
      </div>
      <CategoryManager currentUserId={currentUser?.id} entryLeaves={entryLeaves} initialTree={tree} />
    </div>
  );
}