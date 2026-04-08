import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  const surfaces = getSurfacesByLane("today");

  return (
    <div>
      <LaneHeader
        icon="Zap"
        title="Today"
        description="Your daily command center"
        count={surfaces.length}
      />
      <LaneSurfaceView lane="today" initialSurfaces={surfaces} emptyMessage="Your day is clear" />
    </div>
  );
}
