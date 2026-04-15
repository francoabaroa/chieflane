import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function OpsPage() {
  const surfaces = getSurfacesByLane("ops");

  return (
    <div>
      <LaneHeader
        lane="ops"
        icon="Activity"
        title="Ops"
        description="System health and automations"
        initialCount={surfaces.length}
      />
      <LaneSurfaceView lane="ops" initialSurfaces={surfaces} emptyMessage="All systems nominal" />
    </div>
  );
}
