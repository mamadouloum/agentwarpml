import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path: redirect /school/{code} to the white-label tenant portal /e/{code}.
export const Route = createFileRoute("/school/$code")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/e/$code", params: { code: params.code } });
  },
  component: () => null,
});
