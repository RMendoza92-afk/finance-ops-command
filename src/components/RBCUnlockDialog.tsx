import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXEC_ACCESS_PASSWORD = "rbc2026"; // case-insensitive, lightweight gate
const SESSION_KEY = "rbc_exec_access";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
};

export function RBCUnlockDialog({ open, onOpenChange, onUnlocked }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = password.trim().toLowerCase();
    if (normalized === EXEC_ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setError(null);
      setPassword("");
      onOpenChange(false);
      onUnlocked?.();
      return;
    }
    setError("Incorrect passcode");
    setPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) {
        setPassword("");
        setError(null);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock RBC</DialogTitle>
          <DialogDescription>
            Enter the executive passcode to reveal the RBC tab for this session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Passcode"
            autoFocus
            aria-label="RBC passcode"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Unlock</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
