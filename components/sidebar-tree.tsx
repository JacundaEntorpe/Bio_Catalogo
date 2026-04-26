"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { CategoryTreeItem } from "@/lib/category-tree";

type SidebarTreeProps = {
  tree: CategoryTreeItem[];
};

export function SidebarTree({ tree }: SidebarTreeProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCategoryId = searchParams.get("categoryId");

  const renderBranch = (nodes: CategoryTreeItem[]) => (
    <ul className="tree-list">
      {nodes.map((node) => {
        const active = pathname === "/" && selectedCategoryId === node.id;

        return (
          <li key={node.id}>
            <Link className={active ? "tree-link tree-link--active" : "tree-link"} href={`/?categoryId=${node.id}`}>
              <span>{node.name}</span>
              <small>{node.entryCount}</small>
            </Link>
            {node.children.length > 0 ? renderBranch(node.children) : null}
          </li>
        );
      })}
    </ul>
  );

  return <nav aria-label="Classification tree">{renderBranch(tree)}</nav>;
}