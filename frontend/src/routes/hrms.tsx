import { createFileRoute } from "@tanstack/react-router";
import { HrmsStudioSuite } from "@/components/hrms/HrmsStudioSuite";

export const Route = createFileRoute("/hrms")({
  head: () => ({
    meta: [
      { title: "Enterprise HRMS Suite — RestaurantOS" },
      {
        name: "description",
        content: "Complete Enterprise HRMS: Employee Directory, Biometrics, Attendance, GPS Radar, Leaves, Payroll, ATS, Performance & Intelligence.",
      },
      { property: "og:title", content: "Enterprise HRMS Suite — RestaurantOS" },
      {
        property: "og:description",
        content: "Complete Enterprise HRMS: Employee Directory, Biometrics, Attendance, GPS Radar, Leaves, Payroll, ATS, Performance & Intelligence.",
      },
    ],
  }),
  component: HrmsPage,
});

function HrmsPage() {
  return <HrmsStudioSuite />;
}
