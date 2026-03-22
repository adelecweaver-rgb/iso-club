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

  const fontLink = (
    <link
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
  );

  const html = (
    <html lang="en">
      <head>{fontLink}</head>
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
