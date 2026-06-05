"use client";

import { useEffect, useState } from "react";
import SidebarClient from "./SidebarClient";

export default function ClientOnlySidebar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <SidebarClient />;
}
