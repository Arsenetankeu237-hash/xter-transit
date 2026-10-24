import { Suspense } from "react";
import { SiteNav, SiteFooter } from "@/components/site-chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<div className="h-[60px] bg-navy-950" />}>
        <SiteNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={<div className="h-[200px] bg-navy-950" />}>
        <SiteFooter />
      </Suspense>
    </div>
  );
}
