import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function MeetingsPage() {
  const surfaces = getSurfacesByLane("meetings");

  return (
    <div>
      <LaneHeader
        lane="meetings"
        icon="Calendar"
        title="Meetings"
        description="Prep, debrief, follow-ups"
        initialCount={surfaces.length}
      />
      <LaneSurfaceView lane="meetings" initialSurfaces={surfaces} emptyMessage="No meeting surfaces — schedule is clear" />
    </div>
  );
}
