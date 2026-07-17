"use client";

import { useEffect, useState } from "react";
import type { BigStackRecord } from "@/lib/big-stack";

export function BigStackCarousel({ records }: { records: BigStackRecord[] }) {
  const [index, setIndex] = useState(0);
  const record = records[index];

  useEffect(() => {
    if (records.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % records.length), 5000);
    return () => window.clearInterval(timer);
  }, [records.length]);

  if (!record) return null;
  return (
    <section className="big-stack-carousel" aria-label="大堆纪录轮播">
      <div>
        <span className="card-kicker">学员大堆纪录 · {index + 1}/{records.length}</span>
        <strong>{record.name}</strong>
        <p>一小时内复原三阶魔方</p>
      </div>
      <em>{record.count}<small> 个</small></em>
    </section>
  );
}
