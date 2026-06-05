"use client";

import { useEffect } from "react";
import { startAutoSystem } from "@/lib/autoRunner";

export default function AutoSystemRunner() {
  useEffect(() => {
    startAutoSystem();
  }, []);

  return null;
}