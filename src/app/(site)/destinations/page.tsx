import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, EmptyState, Badge } from "@/components/ui";
import { DESTINATION_TYPES } from "@/lib/constants";

export const metadata = { title: "Destinations" };

export default function DestinationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">Destinations desservies</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Corridors activés par notre équipe, avec les aéroports et ports que nous utilisons.
        Une destination absente de cette liste ? Contactez-nous : nous étudions chaque demande.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100" />}>
          <DestinationsContent />
        </Suspense>
      </div>
    </div>
  );
}

async function DestinationsContent() {
  await connection(); // rendu à la demande : données gérées en administration
  const destinations = await db.destination.findMany({
    where: { enabled: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  if (destinations.length === 0) {
    return <EmptyState title="Aucune destination configurée" hint="Les destinations actives apparaîtront ici dès leur configuration par l'entreprise." />;
  }

  const groups = Object.keys(DESTINATION_TYPES)
    .map((type) => ({ type, items: destinations.filter((d) => d.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.type} className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900 uppercase">
            {DESTINATION_TYPES[g.type as keyof typeof DESTINATION_TYPES]}
            <Badge tone="navy">{g.items.length}</Badge>
          </h2>
          <ul className="mt-4 space-y-2">
            {g.items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 text-sm last:border-0">
                <span className="text-slate-700">
                  {d.name}
                  {d.country && d.type !== "COUNTRY" && <span className="text-slate-400"> · {d.country}</span>}
                </span>
                {d.code && <span className="font-mono text-xs text-slate-400">{d.code}</span>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
