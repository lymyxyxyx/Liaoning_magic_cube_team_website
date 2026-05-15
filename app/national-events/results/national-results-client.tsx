"use client";

import { useEffect } from "react";

function openTargetDetails(hash: string) {
  if (!hash) return;
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.scrollIntoView({ block: "start" });
  }
}

export function NationalResultsClient() {
  useEffect(() => {
    openTargetDetails(window.location.hash);

    function handleHashChange() {
      openTargetDetails(window.location.hash);
    }

    function handleClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
      if (!link) return;
      openTargetDetails(link.hash);
    }

    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
