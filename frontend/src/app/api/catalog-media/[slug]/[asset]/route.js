import { catalogOrigin } from "@/lib/catalog/server";
import { unstable_rethrow } from "next/navigation";
export async function GET(request, { params }) {
  const { slug, asset } = await params,
    q = new URL(request.url).searchParams;
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 120 ||
    !/^[a-f0-9-]{36}$/.test(asset) ||
    [...q.keys()].some((k) => k !== "width") ||
    q.getAll("width").length > 1 ||
    !["320", "640", "1280", "1920"].includes(q.get("width") ?? "640")
  )
    return new Response(null, { status: 404 });
  try {
    const response = await fetch(
      `${catalogOrigin()}/api/catalog/media/${slug}/${asset}?width=${q.get("width") ?? 640}`,
      {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0] !== "image/webp"
    )
      return new Response(null, { status: 404 });
    return new Response(response.body, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
