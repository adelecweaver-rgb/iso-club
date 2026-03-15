import { DashboardPageView } from "@/app/dashboard/page";

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <DashboardPageView route="dashboard" initialSection={section} />;
}
