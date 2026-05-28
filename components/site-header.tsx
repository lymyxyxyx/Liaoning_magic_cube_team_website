import Link from "next/link";
import { Shield, Settings, ChevronDown, Menu } from "lucide-react";

type NavItem = {
  href?: string;
  label: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/", label: "首页" },
  {
    label: "WCA排名",
    children: [
      { href: "/rankings", label: "官方排名" },
      { href: "/liaoning-rankings", label: "辽宁排名" }
    ]
  },
  { href: "/commercial-teams", label: "商业战队合作" },
  { href: "/athletes", label: "运动员" },
  { href: "/coaches", label: "教练员" },
  { href: "/judges", label: "裁判员" },
  { href: "/national-events", label: "国赛（棋牌）" },
  { href: "/provincial-competition", label: "省赛" },
  { href: "/competitions", label: "市赛" },
  { href: "/weekly", label: "周赛" }
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
      <details className="mobile-nav">
        <summary>
          <Menu size={17} />
          菜单
        </summary>
        <div className="mobile-nav-panel">
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
              <details className="mobile-nav-group" key={item.label}>
                <summary>
                  {item.label}
                  <ChevronDown size={15} />
                </summary>
                <div>
                  {item.children?.map((child) => (
                    <Link key={child.href} href={child.href}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </details>
      <a className="admin-link" href={adminHref} title="后台管理">
        <Settings size={18} />
        <span>后台</span>
      </a>
    </header>
  );
}
