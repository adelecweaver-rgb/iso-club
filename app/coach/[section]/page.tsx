import { DashboardPageView } from "@/app/dashboard/page";

export default async function CoachSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <DashboardPageView route="coach" initialSection={section} />;
}
