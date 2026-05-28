import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  const bg = "#b62828";
  const white = "rgba(255,255,255,0.94)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent"
        }}
      >
        <div
          style={{
            width: 166,
            height: 166,
            borderRadius: 34,
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 84,
              height: 100,
              background: white,
              clipPath: "polygon(16% 0%, 84% 0%, 84% 44%, 50% 100%, 16% 44%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                border: "6px solid " + bg,
                borderRadius: 12,
                transform: "rotate(45deg)"
              }}
            />
          </div>
        </div>
      </div>
    ),
    size
  );
}

