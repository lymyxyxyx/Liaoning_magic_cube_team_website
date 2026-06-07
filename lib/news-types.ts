export const newsTags = ["公告", "赛事", "成绩", "活动", "其他"] as const;
export type NewsTag = (typeof newsTags)[number];

export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  /** Publish date, YYYY-MM-DD. Used for sorting and display. */
  date: string;
  summary: string;
  /** Plain text body; blank lines separate paragraphs. */
  body: string;
  cover?: string;
  tag?: string;
  /** Optional external link; when set the card/detail can point off-site. */
  externalUrl?: string;
  published: boolean;
  createdAt: string;
};
