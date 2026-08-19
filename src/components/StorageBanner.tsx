import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { storageAvailable } from "@/lib/store";

/**
 * The store degrades silently to memory when localStorage is blocked — a
 * private window, or a locked-down managed browser. Someone could build a case
 * for forty minutes, close the tab and lose all of it, with nothing on screen
 * but a console warning. (Fix 3.1)
 */
export function StorageBanner() {
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    setBlocked(!storageAvailable());
  }, []);

  if (!blocked) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p>
        <span className="font-semibold">This browser is not saving your work.</span> Storage is
        blocked, so scenarios exist only until you close the tab. Use{" "}
        <span className="font-medium">Export scenario</span> on the dashboard to keep a copy.
      </p>
    </div>
  );
}
