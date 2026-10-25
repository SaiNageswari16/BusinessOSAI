import { createFileRoute } from "@tanstack/react-router";
import { HrmsStudioSuite } from "@/components/hrms/HrmsStudioSuite";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff & HRMS Suite — RestaurantOS" },
      {
        name: "description",
        content: "Enterprise HRMS Suite: Employee Directory, Biometrics, GPS Route Radar, Payroll, Leaves, ATS, LMS, and HR Intelligence.",
      },
      { property: "og:title", content: "Staff & HRMS Suite — RestaurantOS" },
      {
        property: "og:description",
        content: "Enterprise HRMS Suite: Employee Directory, Biometrics, GPS Route Radar, Payroll, Leaves, ATS, LMS, and HR Intelligence.",
      },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  return <HrmsStudioSuite />;
}
