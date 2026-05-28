import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

export default function Icon() {
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
            width: 472,
            height: 472,
            borderRadius: 96,
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 240,
              height: 290,
              background: white,
              clipPath: "polygon(16% 0%, 84% 0%, 84% 44%, 50% 100%, 16% 44%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                width: 150,
                height: 150,
                border: "10px solid " + bg,
                borderRadius: 26,
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

