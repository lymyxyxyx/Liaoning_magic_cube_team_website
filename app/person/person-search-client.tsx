"use client";

import Link from "next/link";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PersonSearchResult = {
  wcaId: string;
  name: string;
  countryId: string;
  gender: string;
  province: string | null;
  city: string | null;
};

export function PersonSearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/person/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.persons ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  return (
    <div className="person-search-card">
      <div className="person-search-input-wrap">
        <Search size={18} />
        <input
          type="text"
          placeholder="输入 WCA ID 或选手姓名（仅限辽宁选手）…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && (
        <div className="person-search-status">
          <Loader2 size={16} className="spin" />
          搜索中…
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="person-search-status">未找到匹配的选手</div>
      )}

      {results.length > 0 && (
        <div className="person-search-results">
          {results.map((person) => (
            <Link
              key={person.wcaId}
              href={`/person/${person.wcaId}`}
              className="person-search-item"
            >
              <div>
                <strong>{person.name}</strong>
                <span className="person-search-meta">
                  {person.wcaId} · {person.countryId}
                  {person.gender === "m" ? " · 男" : person.gender === "f" ? " · 女" : ""}
                  {person.province ? ` · ${[person.city, person.province].filter(Boolean).join(" ")}` : ""}
                </span>
              </div>
              <ExternalLink size={16} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
