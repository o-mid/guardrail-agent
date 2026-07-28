"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Event = {
  _id: string;
  type: string;
  entityId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [entityId, setEntityId] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const q = entityId ? `?entityId=${encodeURIComponent(entityId)}` : "";
    api<{ events: Event[] }>(`/api/audit${q}`, { token })
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));
  }, [entityId, router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Audit</h1>
        <Link href="/app" className="text-sm underline">
          Back
        </Link>
      </div>
      <label className="mt-6 block text-sm">
        Filter by plan / entity id
        <input
          className="mt-1 w-full border border-line bg-paper/80 px-3 py-2"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value.trim())}
          placeholder="optional"
        />
      </label>
      <ol className="mt-6 space-y-3">
        {events.map((ev) => (
          <li key={ev._id} className="border border-line bg-paper/50 px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{ev.type}</p>
              <p className="text-xs text-ink/50">{new Date(ev.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-1 font-mono text-xs text-ink/60">{ev.entityId}</p>
            {ev.payload && Object.keys(ev.payload).length > 0 ? (
              <pre className="mt-2 overflow-x-auto text-xs text-ink/70">{JSON.stringify(ev.payload, null, 2)}</pre>
            ) : null}
          </li>
        ))}
        {events.length === 0 ? <li className="text-sm text-ink/60">No events yet.</li> : null}
      </ol>
    </main>
  );
}
