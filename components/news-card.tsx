import Link from "next/link";
import type { NewsItem } from "@/lib/news-types";

export function NewsCard({ item, row = false }: { item: NewsItem; row?: boolean }) {
  return (
    <Link href={`/news/${item.slug}`} className={`news-card${row ? " news-card--row" : ""}`}>
      {item.cover ? (
        <div className="news-card-cover">
          {/* External cover URLs: plain img avoids next/image domain config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.cover} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="news-card-body">
        <div className="news-card-meta">
          {item.tag ? <span className="news-tag">{item.tag}</span> : null}
          <span className="news-date">{item.date}</span>
        </div>
        <strong className="news-card-title">{item.title}</strong>
        {item.summary ? <p className="news-card-summary">{item.summary}</p> : null}
      </div>
    </Link>
  );
}
