import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getNewsBySlug } from "@/lib/news-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const item = await getNewsBySlug(params.slug);
  if (!item || !item.published) return { title: "未找到该新闻" };

  const description = (item.summary || item.title).slice(0, 150);
  const canonical = `/news/${item.slug}`;
  return {
    title: item.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: item.title,
      description,
      ...(item.cover ? { images: [item.cover] } : {})
    }
  };
}

export default async function NewsDetailPage({ params }: { params: { slug: string } }) {
  const item = await getNewsBySlug(params.slug);
  if (!item || !item.published) notFound();

  const paragraphs = item.body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <article className="container section news-article">
      <Link href="/news" className="news-back">
        <ArrowLeft size={15} />
        返回新闻
      </Link>
      <div className="news-article-meta">
        {item.tag ? <span className="news-tag">{item.tag}</span> : null}
        <span className="news-date">{item.date}</span>
      </div>
      <h1 className="news-article-title">{item.title}</h1>
      {item.summary ? <p className="news-article-summary">{item.summary}</p> : null}
      {item.cover ? (
        <div className="news-article-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.cover} alt="" />
        </div>
      ) : null}
      <div className="news-article-body">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        ) : (
          <p className="news-article-empty">正文待补充。</p>
        )}
      </div>
      {item.externalUrl ? (
        <a className="button" href={item.externalUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          查看原文
        </a>
      ) : null}
    </article>
  );
}
