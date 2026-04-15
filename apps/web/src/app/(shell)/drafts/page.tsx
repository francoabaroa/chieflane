import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function DraftsPage() {
  const surfaces = getSurfacesByLane("drafts");

  return (
    <div>
      <LaneHeader
        lane="drafts"
        icon="PenLine"
        title="Drafts"
        description="Messages and communications"
        initialCount={surfaces.length}
      />
      <LaneSurfaceView lane="drafts" initialSurfaces={surfaces} emptyMessage="No drafts pending review" />
    </div>
  );
}
