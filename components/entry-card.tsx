import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";

type EntryCardProps = {
  entry: {
    id: string;
    name: string | null;
    description: string;
    identificationStatus: "CONFIRMED" | "POSSIBLE" | "UNKNOWN";
    habitatTags: string[];
    updatedAt: Date;
    category: {
      id: string;
      name: string;
    };
    images: Array<{
      id: string;
      storagePath: string;
      caption: string | null;
      altText: string | null;
      fileName: string;
    }>;
  };
};

const fallbackPath = "/uploads/demo/specimen-placeholder.svg";

export function EntryCard({ entry }: EntryCardProps) {
  const coverImage = entry.images[0];

  return (
    <article className="entry-card">
      <div className="entry-card__image-wrap">
        <Image
          alt={coverImage?.altText ?? coverImage?.caption ?? entry.name ?? "Catalog entry cover"}
          className="entry-card__image"
          fill
          sizes="(min-width: 1200px) 18vw, (min-width: 768px) 28vw, 100vw"
          src={coverImage?.storagePath ?? fallbackPath}
        />
      </div>
      <div className="entry-card__body">
        <div className="entry-card__meta-row">
          <span className="eyebrow">{entry.category.name}</span>
          <StatusBadge status={entry.identificationStatus} />
        </div>
        <h3>{entry.name ?? "Unnamed specimen"}</h3>
        <p>{entry.description}</p>
        <div className="chip-row">
          {entry.habitatTags.slice(0, 4).map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="entry-card__footer">
          <small>Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(entry.updatedAt)}</small>
          <Link className="button button--ghost button--small" href={`/entries/${entry.id}`}>
            Open book view
          </Link>
        </div>
      </div>
    </article>
  );
}