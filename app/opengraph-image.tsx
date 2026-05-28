import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  const bg = "#f5f7fc";
  const ink = "#111827";
  const muted = "#526071";
  const brand = "#b62828";
  const white = "rgba(255,255,255,0.94)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: bg,
          padding: 80,
          gap: 56,
          alignItems: "center"
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: 56,
            background: brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto"
          }}
        >
          <div
            style={{
              width: 136,
              height: 164,
              background: white,
              clipPath: "polygon(16% 0%, 84% 0%, 84% 44%, 50% 100%, 16% 44%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                width: 90,
                height: 90,
                border: "9px solid " + brand,
                borderRadius: 20,
                transform: "rotate(45deg)"
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: ink }}>辽宁地区魔方信息查询网</div>
          <div style={{ fontSize: 28, fontWeight: 650, color: muted }}>排名、赛事与档案查询</div>
          <div style={{ fontSize: 22, fontWeight: 650, color: muted, marginTop: 12 }}>lncubing.com</div>
        </div>
      </div>
    ),
    size
  );
}

