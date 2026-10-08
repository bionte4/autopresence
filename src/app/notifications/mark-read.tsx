"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkReadButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="self-start rounded-md border px-3 py-2 text-sm"
      onClick={async () => {
        setPending(true);
        await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        setPending(false);
        router.refresh();
      }}
    >
      Tandai semua dibaca
    </button>
  );
}
