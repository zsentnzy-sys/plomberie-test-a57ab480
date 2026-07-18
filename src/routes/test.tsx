import heroImg from "@/assets/hero-plumber.webp";

export const Route = createFileRoute("/test-image")({
  component: TestImage,
});

function TestImage() {
  return (
    <img
      src={heroImg}
      alt=""
      width={1280}
      height={853}
      className="block h-auto w-full"
    />
  );
}