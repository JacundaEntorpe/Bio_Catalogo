import Link from "next/link";

type BreadcrumbsProps = {
  items: Array<{
    label: string;
    href?: string;
  }>;
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="breadcrumbs__item">
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          {index < items.length - 1 ? <span className="breadcrumbs__separator">/</span> : null}
        </span>
      ))}
    </nav>
  );
}