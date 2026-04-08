import { getSurfacesByLane } from "@/lib/db/surfaces";
import { LaneHeader } from "@/components/shell/LaneHeader";
import { LaneSurfaceView } from "@/components/shell/LaneSurfaceView";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const surfaces = getSurfacesByLane("inbox");

  return (
    <div>
      <LaneHeader
        icon="Inbox"
        title="Inbox"
        description="Triage and approvals"
        count={surfaces.length}
      />
      <LaneSurfaceView lane="inbox" initialSurfaces={surfaces} emptyMessage="Inbox zero — nothing to triage" />
    </div>
  );
}
