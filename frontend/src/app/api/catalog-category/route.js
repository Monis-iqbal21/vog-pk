import { unstable_rethrow } from "next/navigation";
import { catalogList } from "@/lib/catalog/server";
export async function GET(request) {
  const params = new URL(request.url).searchParams,
    category = params.get("category");
  if (
    [...params.keys()].some((k) => k !== "category") ||
    params.getAll("category").length !== 1 ||
    !category ||
    category.length > 120 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)
  )
    return Response.json({ message: "Invalid category." }, { status: 400 });
  try {
    return Response.json(
      await catalogList({ category, pageSize: 7, facets: "omit" }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    unstable_rethrow(error);
    return Response.json(
      { message: "Category products are unavailable." },
      {
        status: error.status === 404 ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
