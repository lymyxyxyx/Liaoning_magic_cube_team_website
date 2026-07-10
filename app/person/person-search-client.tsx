"use client";

import Link from "next/link";
import { Search, Loader2, ExternalLink, User, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [allPersons, setAllPersons] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/person/search")
      .then((res) => res.json())
      .then((data) => setAllPersons(data.persons ?? []))
      .catch(() => setAllPersons([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return allPersons;
    const q = query.toLowerCase();
    return allPersons.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.wcaId.toLowerCase().includes(q) ||
        (p.city && p.city.includes(q)) ||
        (p.province && p.province.includes(q))
    );
  }, [query, allPersons]);

  return (
    <div className="person-search-card">
      <div className="person-search-input-wrap">
        <Search size={18} />
        <input
          type="text"
          placeholder="输入 WCA ID、姓名或地区筛选…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="person-search-count">
        共 {allPersons.length} 名辽宁选手
        {query.length >= 2 && <>（筛选后 {filtered.length} 名）</>}
      </div>

      {loading ? (
        <div className="person-search-status">
          <Loader2 size={16} className="spin" />
          加载中…
        </div>
      ) : filtered.length > 0 ? (
        <div className="person-list-table-wrap">
          <table className="result-table person-list-table">
            <thead>
              <tr>
                <th>WCA ID</th>
                <th>姓名</th>
                <th>性别</th>
                <th>城市</th>
                <th>省份</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.wcaId}>
                  <td>
                    <Link href={`/person/${person.wcaId}`} className="table-person-link">
                      {person.wcaId}
                    </Link>
                  </td>
                  <td className="name-cell">{person.name}</td>
                  <td>{person.gender === "m" ? "男" : person.gender === "f" ? "女" : "-"}</td>
                  <td>{person.city || "-"}</td>
                  <td>{person.province || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="person-search-status">未找到匹配的选手</div>
      )}
    </div>
  );
}
