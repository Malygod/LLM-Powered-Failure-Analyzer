import { ImageResponse } from "next/og";
export const alt = "OMNI — Understand agent failures. Test better behavior.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#171412",
        color: "#f5f5f4",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 36,
          letterSpacing: "0.16em",
          color: "#f5f5f4",
        }}
      >
        <svg width="76" height="76" viewBox="0 0 64 64">
          <path
            d="M8 34c6-9 14-14 24-14s18 5 24 14c-6 9-14 14-24 14S14 43 8 34Z"
            fill="none"
            stroke="#f5f5f4"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M17 34h30" fill="none" stroke="#8c817b" strokeWidth="1.5" />
          <circle
            cx="32"
            cy="34"
            r="9"
            fill="#171412"
            stroke="#f5f5f4"
            strokeWidth="2"
          />
          <circle cx="32" cy="34" r="3.5" fill="#e66b60" />
          <circle cx="17" cy="34" r="2.4" fill="#f5f5f4" />
          <circle cx="47" cy="34" r="2.4" fill="#f5f5f4" />
          <path
            d="M22 12c6-3 14-3 20 0"
            fill="none"
            stroke="#e66b60"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        OMNI
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 66,
          lineHeight: 1.1,
          marginTop: 75,
        }}
      >
        Understand agent failures.
      </div>
      <div style={{ display: "flex", fontSize: 66, color: "#e66b60" }}>
        Test better behavior.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 23,
          marginTop: 60,
          color: "#a8a29e",
        }}
      >
        compare → explain → fix
      </div>
      <div style={{ display: "flex", fontSize: 19, marginTop: 30 }}>
        An independent engineering project by Matías Sepúlveda
      </div>
    </div>,
    size,
  );
}
