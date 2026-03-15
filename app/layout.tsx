import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { isClerkConfigured } from "@/lib/server/clerk";

export const metadata: Metadata = {
  title: "Iso Club Portal",
  description: "Member dashboard with Clerk auth and Supabase integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkConfigured = isClerkConfigured();

  const html = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  if (!clerkConfigured) {
    return html;
  }

  return (
    <ClerkProvider>
      {html}
    </ClerkProvider>
  );
}
