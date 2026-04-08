import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const surfaces = getSurfacesByLane("research");

  return (
    <div>
      <LaneHeader
        icon="BookOpen"
        title="Research"
        description="Deep dives and synthesis"
        count={surfaces.length}
      />
      <LaneSurfaceView lane="research" initialSurfaces={surfaces} emptyMessage="No active research packets" />
    </div>
  );
}
