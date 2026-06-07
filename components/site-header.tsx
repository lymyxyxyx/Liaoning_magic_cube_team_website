"use client";

import Link from "next/link";
import { type SyntheticEvent, useEffect, useRef } from "react";
import { Shield, Settings, ChevronDown, Menu, X } from "lucide-react";
import { SiteSearch } from "./site-search";

type NavItem = {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/", label: "首页" },
  { href: "/news", label: "新闻" },
  { href: "/liaoning-rankings", label: "辽宁排名" },
  { href: "/liaoning-records", label: "辽宁纪录" },
  { href: "/rankings", label: "WCA排名" },
  { href: "/competitions", label: "全部比赛" },
  { href: "/liaoning-competitions", label: "辽宁WCA赛事" },
  { href: "/national-events", label: "国赛" },
  { href: "/weekly", label: "周赛" },
  { href: "/judges", label: "裁判员名单" },
  { href: "/commercial-teams", label: "商业战队成员" }
];

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);

  function closeMenus() {
    headerRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((item) => {
      item.open = false;
    });
  }

  function closePeerMenus(current: HTMLDetailsElement) {
    headerRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((item) => {
      if (item !== current && item.parentElement === current.parentElement) {
        item.open = false;
      }
    });
  }

  function handleDetailsToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) closePeerMenus(event.currentTarget);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !headerRef.current?.contains(target)) closeMenus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <Link className="brand" href="/" onClick={closeMenus}>
        <span className="brand-mark" aria-hidden="true">
          <Shield size={20} />
        </span>
        <span>
          <strong>辽宁地区魔方信息查询网</strong>
          <small>排名、赛事与档案查询</small>
        </span>
      </Link>
      <nav className="main-nav" aria-label="主导航">
        {navItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;

          if (!hasChildren) {
            return (
              <Link href={item.href || "/"} key={item.label} onClick={closeMenus}>
                {item.label}
              </Link>
            );
          }

          return (
            <details className="nav-dropdown" key={item.label} onToggle={handleDetailsToggle}>
              <summary>
                {item.label}
                <ChevronDown size={16} />
              </summary>
              <div className="nav-dropdown-menu">
                {item.children?.map((child) => (
                  <Link key={child.href} href={child.href} onClick={closeMenus}>
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </nav>
      <details className="mobile-nav" onToggle={handleDetailsToggle}>
        <summary>
          <Menu size={17} />
          菜单
        </summary>
        <div className="mobile-nav-panel">
          <button className="mobile-nav-close" type="button" onClick={closeMenus}>
            <X size={16} />
            关闭菜单
          </button>
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;

            if (!hasChildren) {
              return (
                <Link href={item.href || "/"} key={item.label} onClick={closeMenus}>
                  {item.label}
                </Link>
              );
            }

            return (
              <details className="mobile-nav-group" key={item.label} onToggle={handleDetailsToggle}>
                <summary>
                  {item.label}
                  <ChevronDown size={15} />
                </summary>
                <div>
                  {item.children?.map((child) => (
                    <Link key={child.href} href={child.href} onClick={closeMenus}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </details>
      <div className="header-actions">
      <SiteSearch />
      <details className="admin-pass-popover" onToggle={handleDetailsToggle}>
        <summary className="admin-link" title="后台管理">
          <Settings size={18} />
          <span>后台</span>
        </summary>
        <form className="admin-pass-dialog" action="/api/admin-auth?next=/admin" method="post" aria-label="后台口令">
          <div className="admin-pass-dialog-heading">
            <div>
              <strong>后台口令</strong>
              <span>输入后直接进入管理后台</span>
            </div>
          </div>
          <input autoFocus inputMode="numeric" type="password" name="password" placeholder="请输入口令" />
          <button className="button primary" type="submit">
            进入后台
          </button>
        </form>
      </details>
      </div>
    </header>
  );
}
