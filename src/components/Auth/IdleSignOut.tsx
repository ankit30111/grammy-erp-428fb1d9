import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Signs the person out after 10 minutes with no activity (mouse, keyboard,
 * touch, scroll) in any ERP tab of this browser. A warning shows for the last
 * minute with a button to stay signed in. A shared PC on the floor is not left
 * open under someone's name.
 */
export const IDLE_LIMIT_MS = 10 * 60_000;
const WARN_BEFORE_MS = 60_000;
const KEY = "erp-last-activity";

const readLast = () => {
  try { return Number(localStorage.getItem(KEY)) || Date.now(); } catch { return Date.now(); }
};
const writeLast = (t: number) => {
  try { localStorage.setItem(KEY, String(t)); } catch { /* private mode: this tab still counts */ }
};

export function IdleSignOut() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const lastRef = useRef(Date.now());
  const [leftMs, setLeftMs] = useState<number | null>(null);
  const signingOut = useRef(false);

  const touch = useCallback(() => {
    const now = Date.now();
    // Written at most every 5 s so moving the mouse does not hammer storage.
    if (now - lastRef.current > 5_000) { lastRef.current = now; writeLast(now); }
  }, []);

  useEffect(() => {
    if (!user) { setLeftMs(null); return; }
    signingOut.current = false;
    lastRef.current = Date.now();
    writeLast(lastRef.current);

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));

    const check = async () => {
      // Another tab's activity counts too.
      const last = Math.max(lastRef.current, readLast());
      lastRef.current = last;
      const left = IDLE_LIMIT_MS - (Date.now() - last);
      if (left <= 0) {
        if (signingOut.current) return;
        signingOut.current = true;
        setLeftMs(null);
        await signOut();
        navigate("/", { replace: true });
        toast.info("Signed out after 10 minutes without activity. Sign in again to continue.");
        return;
      }
      setLeftMs(left <= WARN_BEFORE_MS ? left : null);
    };
    const timer = window.setInterval(check, 1_000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, signOut, navigate, touch]);

  const stay = () => { lastRef.current = Date.now(); writeLast(lastRef.current); setLeftMs(null); };

  return (
    <AlertDialog open={leftMs !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            No activity for 9 minutes. You will be signed out in {Math.ceil((leftMs ?? 0) / 1000)} seconds;
            anything not saved will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={stay} autoFocus>Stay signed in</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
