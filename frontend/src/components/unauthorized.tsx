import { ShieldAlert } from "lucide-react";

export function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="size-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mb-6">
        <ShieldAlert className="size-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h2>
      <p className="text-muted-foreground max-w-md">
        Your current role does not have permission to view this page. If you believe this is an error, please contact your system administrator or try switching your active role in the top navigation bar.
      </p>
    </div>
  );
}
