import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at top, #2b2438 0%, #141420 58%, #0c0c14 100%)",
          color: "#E8E4DF",
          display: "flex",
          fontFamily: "Plus Jakarta Sans, sans-serif",
          fontSize: 64,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid rgba(212,165,116,0.35)",
            borderRadius: 48,
            boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
            display: "flex",
            height: 132,
            justifyContent: "center",
            alignItems: "center",
            width: 132,
          }}
        >
          CL
        </div>
      </div>
    ),
    size
  );
}
