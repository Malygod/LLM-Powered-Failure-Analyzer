import { ImageResponse } from "next/og";
export const alt =
  "Causelab — Understand agent failures. Test better behavior.";
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
          fontSize: 34,
          color: "#f5f5f4",
        }}
      >
        <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
          <path
            d="M34 13H21a11 11 0 0 0 0 22h13"
            stroke="#f5f5f4"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M14 24h9l5-7h6M23 24l5 7h6"
            stroke="#8c817b"
            strokeWidth="1.6"
          />
          <circle cx="34" cy="17" r="3.3" fill="#ef665b" />
          <circle cx="34" cy="31" r="3.3" fill="#69ba90" />
          <circle cx="14" cy="24" r="2.3" fill="#f5f5f4" />
        </svg>
        causelab.
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
