import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";
import { PushToggle } from "@/components/pwa/PushToggle";

export const dynamic = "force-dynamic";

export default function OpsPage() {
  const surfaces = getSurfacesByLane("ops");

  return (
    <div>
      <LaneHeader
        icon="Activity"
        title="Ops"
        description="System health and automations"
        count={surfaces.length}
      />
      <div className="px-4 pt-4 md:px-6">
        <PushToggle />
      </div>
      <LaneSurfaceView lane="ops" initialSurfaces={surfaces} emptyMessage="All systems nominal" />
    </div>
  );
}
