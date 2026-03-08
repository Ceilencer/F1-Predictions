import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "#1a1a24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          fontWeight: 800,
          color: "#7c3aed",
          letterSpacing: "-0.5px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        F1
      </div>
    ),
    { ...size }
  );
}
