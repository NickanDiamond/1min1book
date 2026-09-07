import type { ReactNode } from "react";
import TopBar from "@/components/TopBar";

export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}
