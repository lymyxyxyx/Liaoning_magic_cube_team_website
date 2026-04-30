"use client";

import Link from "next/link";
import { Shield, Settings, ChevronDown } from "lucide-react";
import { useState } from "react";

type NavItem = {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/", label: "首页" },
  {
    label: "排名",
    children: [
      { href: "/rankings", label: "WCA排名" },
      { href: "/liaoning-rankings", label: "辽宁排名" }
    ]
  },
  { href: "/provincial-competition", label: "省赛专题" },
  { href: "/national-events", label: "国赛专题（棋牌中心）" },
  { href: "/commercial-teams", label: "商业战队" },
  {
    label: "人员",
    children: [
      { href: "/athletes", label: "运动员" },
      { href: "/coaches", label: "教练员" },
      { href: "/judges", label: "裁判员" }
    ]
  },
  {
    label: "赛事活动",
    children: [
      { href: "/competitions", label: "赛事活动" },
      { href: "/weekly", label: "周赛" }
    ]
  },
  { href: "/achievements", label: "荣誉档案" },
  { href: "/about", label: "关于我们" }
];

export function SiteHeader() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          <Shield size={20} />
        </span>
        <span>
          <strong>辽宁魔方战队</strong>
          <small>档案与赛事展示</small>
        </span>
      </Link>
      <nav className="main-nav" aria-label="主导航">
        {navItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openDropdown === item.label;

          return (
            <div
              key={item.label}
              style={{
                position: "relative",
                display: "inline-block"
              }}
              onMouseEnter={() => hasChildren && setOpenDropdown(item.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              {hasChildren ? (
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: "8px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "inherit",
                    fontFamily: "inherit"
                  }}
                  className="nav-dropdown-btn"
                >
                  {item.label}
                  <ChevronDown size={16} style={{ transition: "transform 0.2s" }} />
                </button>
              ) : (
                <Link href={item.href || "/"} style={{ textDecoration: "none", color: "inherit" }}>
                  {item.label}
                </Link>
              )}

              {hasChildren && isOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    background: "white",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    minWidth: "160px",
                    zIndex: 1000,
                    marginTop: "4px",
                    overflow: "hidden"
                  }}
                >
                  {item.children?.map((child, idx) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      style={{
                        display: "block",
                        padding: "12px 16px",
                        textDecoration: "none",
                        color: "inherit",
                        borderBottom: idx < (item.children?.length || 0) - 1 ? "1px solid #f0f0f0" : "none",
                        transition: "background-color 0.2s",
                        background: "white"
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = "white";
                      }}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <Link className="admin-link" href="/admin" title="后台管理">
        <Settings size={18} />
        <span>后台</span>
      </Link>
    </header>
  );
}
