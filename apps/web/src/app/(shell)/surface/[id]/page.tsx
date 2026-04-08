import { notFound } from "next/navigation";
import { getSurfaceById } from "@/lib/db/surfaces";
import { SurfaceDetailView } from "./SurfaceDetailView";

export const dynamic = "force-dynamic";

export default async function SurfaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const surface = getSurfaceById(id);

  if (!surface) {
    notFound();
  }

  return <SurfaceDetailView surface={surface} />;
}
