"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

function firstNameFromUser(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "";
  const first = (user.firstName ?? "").trim();
  if (first) return first;
  const username = (user.username ?? "").trim();
  if (!username) return "";
  return username.split(/[.\s_-]+/).filter(Boolean)[0] ?? "";
}

function fullNameFromUser(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "";
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || (user.username ?? "").trim();
}

function initialsFromName(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "MB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function DashboardClerkGreeting() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;
    const firstName = firstNameFromUser(user);
    const fullName = fullNameFromUser(user);

    if (firstName) {
      const greeting = document.getElementById("top-title");
      if (greeting) {
        greeting.textContent = `Good morning, ${firstName}.`;
      }
    }

    if (fullName) {
      const nameEl = document.getElementById("user-name");
      if (nameEl) {
        nameEl.textContent = fullName;
      }
      const initialsEl = document.getElementById("user-av");
      if (initialsEl) {
        initialsEl.textContent = initialsFromName(fullName);
      }
    }
  }, [user]);

  return null;
}

