// Client-safe event-list types and labels (no server/database imports), so they
// can be imported from both the server data layer (lib/event-list.ts) and the
// client component without pulling `pg` into the browser bundle.

export type EventCategory = "wca" | "province" | "city" | "national";

export type EventListRow = {
  id: string;
  date: string; // display, YYYY-MM-DD when known
  sortDate: string; // YYYY-MM-DD for sorting
  category: EventCategory;
  name: string;
  location: string;
  href: string;
  external: boolean;
};

export const eventCategoryLabels: Record<EventCategory, string> = {
  wca: "WCA",
  province: "省赛",
  city: "市赛",
  national: "国赛"
};

export const eventCategoryOrder: EventCategory[] = ["wca", "province", "city", "national"];
