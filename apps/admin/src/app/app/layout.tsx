import { ConfirmHost } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/toast";

// Everything under /app: the dialogs and toasts its pages call on.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConfirmHost />
      <Toaster />
    </>
  );
}
