"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const response = await fetch("/api/notifications?pageSize=1");
      if (!response.ok) return;
      const body = (await response.json()) as { unread?: number };
      if (!stop && typeof body.unread === "number") setUnread(body.unread);
    };
    void tick();
    const timer = setInterval(() => void tick(), 30_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink"
      aria-live="polite"
      aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
    >
      Notifikasi
      {unread > 0 ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{unread}</span> : null}
    </Link>
  );
}
