import { Plane, ArrowRight, ShoppingBag, Utensils, Hotel, Car } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontUserContext } from "@/lib/storefront-api";

export function ResumeJourneyWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['storefrontUserContext'],
    queryFn: fetchStorefrontUserContext,
    staleTime: 60_000,
  });

  const journey = data?.active_journey;

  if (isLoading || !journey) {
    return null; // hide if loading or no journey
  }

  // Get the right icon based on the icon_type from the backend
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'plane': return <Plane className="w-5 h-5 text-indigo-600" />;
      case 'shopping': return <ShoppingBag className="w-5 h-5 text-indigo-600" />;
      case 'food': return <Utensils className="w-5 h-5 text-indigo-600" />;
      case 'hotel': return <Hotel className="w-5 h-5 text-indigo-600" />;
      case 'car': return <Car className="w-5 h-5 text-indigo-600" />;
      default: return <Plane className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-indigo-50 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
          {getIcon(journey.icon_type)}
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium mb-0.5">Pick up where you left off</p>
          <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{journey.title}</h4>
          {journey.description && (
            <p className="text-xs text-slate-400 mt-1">{journey.description}</p>
          )}
        </div>
      </div>
      
      <Link to={journey.action_url} className="bg-slate-900 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors w-full md:w-auto text-center flex justify-center items-center gap-2 group/btn">
        Resume Booking <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
