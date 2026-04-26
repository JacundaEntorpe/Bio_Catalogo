import { CategoryManager } from "@/components/category-manager";
import { getCategoryTreeData } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [tree, currentUser] = await Promise.all([getCategoryTreeData(), getCurrentUser()]);

  return (
    <div className="page stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Classification tree</span>
        <h1>Browse the current taxonomy structure.</h1>
        <p>Each category can hold direct entries and its own child branches. Switch between card browsing and a graph view while keeping the current selected category in focus.</p>
      </div>
      <CategoryManager currentUserId={currentUser?.id} initialTree={tree} />
    </div>
  );
}