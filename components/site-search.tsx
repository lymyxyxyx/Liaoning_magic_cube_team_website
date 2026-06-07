"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

type PersonHit = {
  slug: string;
  name: string;
  city?: string;
  mainEvent?: string;
  wcaId?: string;
};

type CompetitionHit = {
  slug: string;
  name: string;
  city?: string;
  date?: string;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [peopleHits, setPeopleHits] = useState<PersonHit[]>([]);
  const [competitionHits, setCompetitionHits] = useState<CompetitionHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const links = [
    ...peopleHits.map((person) => `/people/${person.slug}`),
    ...competitionHits.map((competition) => `/competitions/${competition.slug}`)
  ];

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    function handleOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-site-search", handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-site-search", handleOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    setQuery("");
    setPeopleHits([]);
    setCompetitionHits([]);
    setActive(0);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (!term) {
      setPeopleHits([]);
      setCompetitionHits([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = await response.json();
        setPeopleHits(data.people || []);
        setCompetitionHits(data.competitions || []);
        setActive(0);
      } catch {
        // ignore aborted / failed requests
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open]);

  function close() {
    setOpen(false);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(links.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const href = links[active];
      if (href) go(href);
    }
  }

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && !loading && peopleHits.length === 0 && competitionHits.length === 0;

  return (
    <>
      <button className="search-trigger" type="button" onClick={() => setOpen(true)} aria-label="搜索选手或比赛">
        <Search size={16} />
        <span>搜索</span>
        <kbd>⌘K</kbd>
      </button>
      {open && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="全站搜索"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="search-panel">
            <div className="search-input-row">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="搜选手姓名 / WCA ID / 比赛名称…"
                aria-label="搜索关键字"
              />
              <button className="search-close" type="button" onClick={close} aria-label="关闭搜索">
                <X size={16} />
              </button>
            </div>
            <div className="search-results">
              {!hasQuery && <p className="search-hint">输入关键字搜索辽宁选手与比赛</p>}
              {loading && <p className="search-hint">搜索中…</p>}
              {noResults && <p className="search-hint">没有匹配的选手或比赛</p>}
              {peopleHits.length > 0 && (
                <div className="search-group">
                  <p className="search-group-title">选手</p>
                  {peopleHits.map((person, index) => (
                    <Link
                      key={person.slug}
                      href={`/people/${person.slug}`}
                      className={`search-item${active === index ? " is-active" : ""}`}
                      onClick={close}
                      onMouseEnter={() => setActive(index)}
                    >
                      <span className="search-item-name">{person.name}</span>
                      <span className="search-item-meta">
                        {[person.city, person.mainEvent, person.wcaId].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {competitionHits.length > 0 && (
                <div className="search-group">
                  <p className="search-group-title">比赛</p>
                  {competitionHits.map((competition, index) => {
                    const flatIndex = peopleHits.length + index;
                    return (
                      <Link
                        key={competition.slug}
                        href={`/competitions/${competition.slug}`}
                        className={`search-item${active === flatIndex ? " is-active" : ""}`}
                        onClick={close}
                        onMouseEnter={() => setActive(flatIndex)}
                      >
                        <span className="search-item-name">{competition.name}</span>
                        <span className="search-item-meta">
                          {[competition.date, competition.city].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function HomeSearchTrigger() {
  return (
    <button
      className="home-search"
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-site-search"))}
    >
      <Search size={18} aria-hidden="true" />
      <span>搜索选手姓名、WCA ID 或比赛…</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
