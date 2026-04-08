import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  const surfaces = getSurfacesByLane("people");

  return (
    <div>
      <LaneHeader
        icon="Users"
        title="People"
        description="Contacts and relationships"
        count={surfaces.length}
      />
      <LaneSurfaceView lane="people" initialSurfaces={surfaces} emptyMessage="No active dossiers" />
    </div>
  );
}
