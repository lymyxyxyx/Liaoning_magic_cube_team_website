import Link from "next/link";
import { Shield, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/athletes", label: "运动员" },
  { href: "/coaches", label: "教练员" },
  { href: "/judges", label: "裁判员" },
  { href: "/competitions", label: "赛事活动" },
  { href: "/weekly", label: "周赛" },
  { href: "/achievements", label: "荣誉档案" },
  { href: "/about", label: "关于我们" }
];

export function SiteHeader() {
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
        {navItems.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className="admin-link" href="/admin" title="后台管理">
        <Settings size={18} />
        <span>后台</span>
      </Link>
    </header>
  );
}
