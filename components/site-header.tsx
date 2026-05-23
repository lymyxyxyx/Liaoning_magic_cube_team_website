import Link from "next/link";
import { Shield, Settings, ChevronDown } from "lucide-react";

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
    label: "人员（待补充）",
    children: [
      { href: "/athletes", label: "运动员（待补充）" },
      { href: "/coaches", label: "教练员（待补充）" },
      { href: "/judges", label: "裁判员（待补充）" }
    ]
  },
  {
    label: "赛事活动",
    children: [
      { href: "/competitions", label: "赛事活动" },
      { href: "/weekly", label: "周赛" }
    ]
  }
];

export function SiteHeader() {
  const adminHref = process.env.NODE_ENV === "production" ? "https://lncubing.com/admin" : "/admin";

  return (
    <header className="site-header">
      <Link className="brand" href="/">
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
              <Link href={item.href || "/"} key={item.label}>
                {item.label}
              </Link>
            );
          }

          return (
            <details className="nav-dropdown" key={item.label}>
              <summary>
                {item.label}
                <ChevronDown size={16} />
              </summary>
              <div className="nav-dropdown-menu">
                {item.children?.map((child) => (
                  <Link key={child.href} href={child.href}>
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </nav>
      <a className="admin-link" href={adminHref} title="后台管理">
        <Settings size={18} />
        <span>后台</span>
      </a>
    </header>
  );
}
