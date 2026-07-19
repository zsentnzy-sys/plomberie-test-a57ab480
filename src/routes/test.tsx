import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test-image")({
  component: TestImage,
});

function TestImage() {
  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "system-ui",
        background: "white",
        color: "black",
      }}
    >
      Test minimal
    </div>
  );
}