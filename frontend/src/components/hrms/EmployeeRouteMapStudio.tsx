import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Play, Pause, RotateCcw, FastForward, Navigation, Calendar, User,
  Clock, Gauge, Battery, Activity, Compass, Layers, Radio, Sparkles,
  ChevronRight, ArrowRight, ShieldCheck, Search, Filter, Info, Download,
  Car, Footprints, AlertCircle, RefreshCw, CheckCircle2, Eye, Map as MapIcon
} from "lucide-react";
import L from "leaflet";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import {
  travelRoutesApi,
  employeesApi,
  Employee,
  EmployeeRouteHistoryResponse,
  LiveFieldStaffItem,
  LocationTrailPoint,
  RouteStopItem
} from "../../lib/api-client";

// Custom Leaflet Icons builder
const createCustomIcon = (iconHtml: string, size = 36, className = "") => {
  return L.divIcon({
    html: iconHtml,
    className: `custom-leaflet-marker ${className}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const formatDuration = (mins?: number | null) => {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatTimestamp = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export function EmployeeRouteMapStudio() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Mode: "journey" (individual employee playback) | "live_radar" (all on-duty staff live)
  const [viewMode, setViewMode] = useState<"journey" | "live_radar">("journey");

  // Selection states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [empSearch, setEmpSearch] = useState<string>("");

  // Route History Data
  const [routeData, setRouteData] = useState<EmployeeRouteHistoryResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Live Radar Data
  const [liveStaff, setLiveStaff] = useState<LiveFieldStaffItem[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // Playback Animation States
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x, 10x
  const animationTimerRef = useRef<any>(null);

  // Map tile style: "standard" | "dark"
  const [mapStyle, setMapStyle] = useState<"standard" | "dark">("standard");

  // Load employee directory
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await employeesApi.list(1, 100);
        const list = res?.items || [];
        setEmployees(list);
        if (list.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load employees list:", err);
      }
    }
    loadEmployees();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialMap = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([17.3850, 78.4867], 13); // Default Hyderabad center

    // Add clean OpenStreetMap / CartoDB tiles
    const tileUrl =
      mapStyle === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(initialMap);

    L.control.zoom({ position: "bottomright" }).addTo(initialMap);

    markersLayerGroupRef.current = L.layerGroup().addTo(initialMap);
    mapInstanceRef.current = initialMap;

    return () => {
      initialMap.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map tile theme if toggled
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });
    const tileUrl =
      mapStyle === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(mapInstanceRef.current);
  }, [mapStyle]);

  // Safe normalized points and stops
  const currentPoints = useMemo(() => {
    return routeData?.points || (routeData as any)?.trail_points || [];
  }, [routeData]);

  const currentStops = useMemo(() => {
    return routeData?.stops || [];
  }, [routeData]);

  // Fetch Route Data when employee or date changes
  const fetchRouteHistory = async () => {
    if (!selectedEmployeeId) return;
    setLoadingRoute(true);
    setIsPlaying(false);
    setPlaybackIndex(0);
    try {
      const rawData: any = await travelRoutesApi.getRouteHistory(selectedEmployeeId, selectedDate);
      const points: LocationTrailPoint[] = rawData?.points || rawData?.trail_points || [];
      const stops: RouteStopItem[] = (rawData?.stops || []).map((st: any, idx: number) => ({
        latitude: st.latitude,
        longitude: st.longitude,
        location_name: st.location_name || `Halt #${idx + 1}`,
        arrival_time: st.arrived_at || st.arrival_time || "",
        departure_time: st.departed_at || st.departure_time || "",
        duration_minutes: st.duration_minutes || 0,
        stop_index: st.stop_index ?? (idx + 1),
      }));

      const normalized: EmployeeRouteHistoryResponse = {
        ...rawData,
        employee_id: rawData?.employee_id || selectedEmployeeId,
        employee_name: rawData?.employee_name || "Employee",
        date: rawData?.date || selectedDate,
        points,
        stops,
        clock_in: rawData?.check_in_time || rawData?.clock_in,
        clock_out: rawData?.check_out_time || rawData?.clock_out,
        start_point: points.length > 0 ? points[0] : null,
        end_point: points.length > 0 ? points[points.length - 1] : null,
        total_distance_km: rawData?.total_distance_km ?? 0,
        moving_duration_minutes: rawData?.moving_duration_minutes ?? Math.round((rawData?.moving_time_hours || 0) * 60),
        idle_duration_minutes: rawData?.idle_duration_minutes ?? Math.round((rawData?.idle_time_hours || 0) * 60),
        avg_speed_kmh: rawData?.avg_speed_kmh ?? 0,
        max_speed_kmh: rawData?.top_speed_kmh ?? rawData?.max_speed_kmh ?? 0,
        total_points: points.length,
      };
      setRouteData(normalized);
    } catch (err: any) {
      console.error("Failed to load route history:", err);
      toast.error("Failed to fetch route history: " + (err.message || "Unknown error"));
    } finally {
      setLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (viewMode === "journey" && selectedEmployeeId) {
      fetchRouteHistory();
    }
  }, [selectedEmployeeId, selectedDate, viewMode]);

  // Fetch Live Field Staff Radar
  const fetchLiveRadar = async () => {
    setLoadingLive(true);
    try {
      const res: any = await travelRoutesApi.getLiveFieldStaff();
      const rawList: any[] = Array.isArray(res) ? res : (res?.staff || []);
      const normalizedList: LiveFieldStaffItem[] = rawList.map((st) => ({
        employee_id: st.employee_id,
        employee_name: st.employee_name || "Employee",
        employee_code: st.employee_code,
        department: st.department,
        designation: st.designation,
        avatar_url: st.avatar_url,
        phone: st.phone,
        attendance_id: st.attendance_id,
        clock_in: st.check_in_time || st.clock_in,
        last_ping_at: st.last_ping_time || st.last_ping_at,
        last_latitude: st.last_latitude ?? st.current_latitude,
        last_longitude: st.last_longitude ?? st.current_longitude,
        last_location_name: st.last_location_name || st.current_location_name || "Field Location",
        battery_level: st.battery_level,
        speed: st.speed ?? st.current_speed_kmh ?? 0,
        total_distance_km: st.total_distance_km ?? st.shift_distance_km ?? 0,
        is_online: st.is_online ?? true,
        minutes_since_ping: st.minutes_since_ping ?? 0,
        device_health_status: st.device_health_status || "Active",
        disconnect_reason: st.disconnect_reason,
      }));
      setLiveStaff(normalizedList);
    } catch (err) {
      console.error("Failed to load live staff radar:", err);
    } finally {
      setLoadingLive(false);
    }
  };

  useEffect(() => {
    if (viewMode === "live_radar") {
      fetchLiveRadar();
      const interval = setInterval(fetchLiveRadar, 20000); // 20s auto-refresh
      return () => clearInterval(interval);
    }
  }, [viewMode]);

  // Render Route on Map when Route Data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear previous vector layers and markers
    markersGroup.clearLayers();
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (playbackMarkerRef.current) {
      map.removeLayer(playbackMarkerRef.current);
      playbackMarkerRef.current = null;
    }

    if (viewMode === "journey" && currentPoints.length > 0) {
      const latLngs: [number, number][] = currentPoints.map((p) => [p.latitude, p.longitude]);

      // 1. Draw polyline
      const polyline = L.polyline(latLngs, {
        color: "#6366f1",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      routePolylineRef.current = polyline;

      // 2. Add Start Marker (Green Flag / Clock-In)
      const startPoint = currentPoints[0];
      const startIcon = createCustomIcon(
        `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white shadow-lg border-2 border-white ring-2 ring-emerald-400/50 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
        </div>`,
        32
      );
      const startMarker = L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon }).addTo(markersGroup);
      startMarker.bindPopup(`
        <div class="p-2 space-y-1 font-sans text-xs">
          <p class="font-bold text-emerald-600 uppercase tracking-wide">📍 Shift Start Point</p>
          <p class="font-medium text-slate-800">${startPoint.location_name || "Clock-in Location"}</p>
          <p class="text-slate-500">⏰ ${formatTimestamp(startPoint.recorded_at)}</p>
          <p class="text-[10px] text-slate-400">Coords: ${startPoint.latitude.toFixed(5)}, ${startPoint.longitude.toFixed(5)}</p>
        </div>
      `);

      // 3. Add End / Latest Marker with Sudden Disconnect / Blackout Detection
      const endPoint = currentPoints[currentPoints.length - 1];
      const isShiftEnded = !!routeData?.clock_out;
      const isDeviceBlackout = !!routeData?.is_device_offline && !isShiftEnded;
      const isBatteryExhausted = (routeData?.last_battery_level ?? 100) <= 5;

      const endIcon = createCustomIcon(
        isDeviceBlackout
          ? `<div class="relative flex items-center justify-center w-9 h-9 rounded-full ${isBatteryExhausted ? "bg-amber-600 ring-amber-400" : "bg-red-600 ring-red-400"} text-white shadow-2xl border-2 border-white ring-4 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </div>`
          : isShiftEnded
          ? `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 ring-rose-400/50 text-white shadow-lg border-2 border-white ring-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>`
          : `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 ring-blue-400/50 text-white shadow-lg border-2 border-white ring-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>`,
        36
      );
      const endMarker = L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon }).addTo(markersGroup);
      endMarker.bindPopup(`
        <div class="p-2 space-y-1.5 font-sans text-xs min-w-[220px]">
          <div class="flex items-center justify-between gap-1 border-b pb-1">
            <p class="font-bold ${isDeviceBlackout ? "text-red-600" : isShiftEnded ? "text-rose-600" : "text-blue-600"} uppercase tracking-wide">
              ${isDeviceBlackout ? "⚠️ Signal Lost / Switched Off" : isShiftEnded ? "🏁 Shift End Point" : "📍 Current Location (Active)"}
            </p>
            ${routeData?.last_battery_level !== undefined && routeData?.last_battery_level !== null ? `<span class="px-1.5 py-0.5 rounded font-bold text-[10px] ${routeData.last_battery_level <= 15 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}">🔋 ${routeData.last_battery_level}%</span>` : ""}
          </div>
          <p class="font-medium text-slate-800">${endPoint.location_name || "Location"}</p>
          <p class="text-slate-500">⏰ Disconnect/Last Ping: <strong class="text-slate-800">${formatTimestamp(endPoint.recorded_at)}</strong></p>
          <p class="text-[11px] text-slate-400">Coords: ${endPoint.latitude.toFixed(5)}, ${endPoint.longitude.toFixed(5)}</p>
          ${isDeviceBlackout ? `<div class="p-1.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 font-medium leading-tight mt-1">${routeData?.disconnect_reason || "Sudden loss of GPS pings."}</div>` : ""}
        </div>
      `);

      // 4. Add Detected Stopover / Halt Markers
      if (currentStops.length > 0) {
        currentStops.forEach((stop, idx) => {
          const stopIcon = createCustomIcon(
            `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white shadow-md border-2 border-white font-bold text-xs ring-2 ring-amber-400/50">
              ${idx + 1}
            </div>`,
            28
          );
          const stopMarker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(markersGroup);
          stopMarker.bindPopup(`
            <div class="p-2 space-y-1 font-sans text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">Stop #${stop.stop_index || idx + 1}</span>
                <span class="font-bold text-amber-600">⏱️ ${formatDuration(stop.duration_minutes)}</span>
              </div>
              <p class="font-medium text-slate-800 mt-1">${stop.location_name || "Halt Location"}</p>
              <p class="text-slate-500 text-[11px]">Arrival: ${formatTimestamp(stop.arrival_time)}</p>
              <p class="text-slate-500 text-[11px]">Departure: ${formatTimestamp(stop.departure_time)}</p>
            </div>
          `);
        });
      }

      // 5. Create Live Playback Avatar Marker
      const playbackAvatar = createCustomIcon(
        `<div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white shadow-2xl border-2 border-white ring-4 ring-indigo-400/40">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.1 2 11.4V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
        </div>`,
        40
      );
      playbackMarkerRef.current = L.marker([startPoint.latitude, startPoint.longitude], { icon: playbackAvatar, zIndexOffset: 1000 }).addTo(map);

      // Fit map bounds to polyline
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    }

    // Live Radar Mode: Render all staff pins
    if (viewMode === "live_radar" && liveStaff.length > 0) {
      const livePoints: [number, number][] = [];

      liveStaff.forEach((st) => {
        if (st.last_latitude && st.last_longitude) {
          livePoints.push([st.last_latitude, st.last_longitude]);

          const isMoving = (st.speed || 0) > 2;
          const statusBg = isMoving ? "bg-emerald-500" : "bg-blue-600";

          const staffIcon = createCustomIcon(
            `<div class="relative group cursor-pointer">
              <div class="flex items-center justify-center w-9 h-9 rounded-full ${statusBg} text-white shadow-xl border-2 border-white ring-2 ${isMoving ? "ring-emerald-400 ring-offset-1 animate-pulse" : "ring-blue-400"}">
                ${st.avatar_url ? `<img src="${st.avatar_url}" class="w-full h-full rounded-full object-cover" />` : `<span class="text-xs font-black uppercase">${(st.employee_name || "EM").slice(0, 2)}</span>`}
              </div>
              ${isMoving ? `<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>` : ""}
            </div>`,
            36
          );

          const marker = L.marker([st.last_latitude, st.last_longitude], { icon: staffIcon }).addTo(markersGroup);
          marker.bindPopup(`
            <div class="p-2.5 space-y-1.5 font-sans text-xs min-w-[200px]">
              <div class="flex items-center justify-between gap-2 border-b pb-1.5">
                <div>
                  <p class="font-bold text-slate-900">${st.employee_name}</p>
                  <p class="text-[11px] text-slate-500">${st.designation || st.department || "Field Staff"}</p>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isMoving ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}">
                  ${isMoving ? "🚗 In Transit" : "📍 Stationary"}
                </span>
              </div>
              <p class="text-slate-600 font-medium">📌 ${st.last_location_name || "Current Location"}</p>
              <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pt-1">
                <div>🏁 Distance: <strong class="text-slate-800">${st.total_distance_km} km</strong></div>
                <div>⚡ Speed: <strong class="text-slate-800">${st.speed || 0} km/h</strong></div>
                <div>🔋 Battery: <strong class="text-slate-800">${st.battery_level ? `${st.battery_level}%` : "—"}</strong></div>
                <div>🕒 Last Ping: <strong class="text-slate-800">${formatTimestamp(st.last_ping_at)}</strong></div>
              </div>
              <button class="w-full mt-2 py-1 px-2 bg-indigo-600 text-white rounded font-bold text-[11px] hover:bg-indigo-700 transition"
                onclick="window.dispatchEvent(new CustomEvent('select-route-employee', { detail: '${st.employee_id}' }))">
                View Full Route Map 🗺️
              </button>
            </div>
          `);
        }
      });

      if (livePoints.length > 0) {
        const bounds = L.latLngBounds(livePoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [routeData, currentPoints, currentStops, liveStaff, viewMode]);

  // Handle Event from Popup button to switch to individual route
  useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail) {
        setSelectedEmployeeId(e.detail);
        setViewMode("journey");
      }
    };
    window.addEventListener("select-route-employee", handleSwitch);
    return () => window.removeEventListener("select-route-employee", handleSwitch);
  }, []);

  // Journey Playback Animation Step
  useEffect(() => {
    if (!isPlaying || currentPoints.length === 0) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      return;
    }

    const intervalMs = Math.max(100, 1000 / playbackSpeed);

    animationTimerRef.current = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= (currentPoints.length - 1)) {
          setIsPlaying(false);
          return prev;
        }
        const nextIndex = prev + 1;
        const pt = currentPoints[nextIndex];
        if (playbackMarkerRef.current && pt) {
          playbackMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.3 });
          }
        }
        return nextIndex;
      });
    }, intervalMs);

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, currentPoints]);

  // Handle Scrub / Manual Slider Change
  const handleSliderChange = (idx: number) => {
    setPlaybackIndex(idx);
    if (!currentPoints[idx]) return;
    const pt = currentPoints[idx];
    if (playbackMarkerRef.current) {
      playbackMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.2 });
      }
    }
  };

  // Center on specific stopover
  const handleFocusStop = (stop: RouteStopItem) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([stop.latitude, stop.longitude], 16, { animate: true });
  };

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) =>
      (e.full_name || "").toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.employee_code && e.employee_code.toLowerCase().includes(empSearch.toLowerCase())) ||
      (e.department && e.department.toLowerCase().includes(empSearch.toLowerCase()))
    );
  }, [employees, empSearch]);

  const currentPoint = currentPoints[playbackIndex];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-20">
      {/* ─── HEADER & STUDIO CONTROLS ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card/60 backdrop-blur-md p-4 rounded-2xl border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <MapIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Field Travel Route Studio
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-500/20">
                  GPS Radar v2.0
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Track full shift travel trajectories, compute geodesic distances, identify customer halt stops, and replay GPS journeys.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Tile Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-muted/60 rounded-xl border">
            <button
              onClick={() => setViewMode("journey")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "journey" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Navigation className="size-3.5" /> Single Journey Replay
            </button>
            <button
              onClick={() => setViewMode("live_radar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "live_radar" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Radio className="size-3.5 text-emerald-500 animate-pulse" /> Live Fleet Radar
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapStyle(mapStyle === "standard" ? "dark" : "standard")}
            className="h-9 px-3 text-xs gap-1.5"
            title="Toggle Map Style"
          >
            <Layers className="size-3.5" /> {mapStyle === "standard" ? "Dark Map" : "Daylight Map"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => (viewMode === "journey" ? fetchRouteHistory() : fetchLiveRadar())}
            className="h-9 px-3 text-xs gap-1.5"
            disabled={loadingRoute || loadingLive}
          >
            <RefreshCw className={`size-3.5 ${loadingRoute || loadingLive ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* ─── JOURNEY SELECTOR BAR (In Journey Mode) ─── */}
      {viewMode === "journey" && (
        <Card className="p-3 border bg-card/40 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            {/* Employee Picker */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="size-3" /> Select Staff / Field Executive
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border bg-background font-medium focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || "EMP"}) — {emp.department || "Field"}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Date Picker */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" /> Shift Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 text-sm rounded-xl bg-background"
              />
            </div>

            {/* Quick Action Load */}
            <div className="flex items-end h-full">
              <Button
                onClick={fetchRouteHistory}
                disabled={loadingRoute}
                className="w-full h-10 gradient-brand text-white font-bold text-xs rounded-xl shadow-xs"
              >
                {loadingRoute ? <RefreshCw className="size-3.5 animate-spin mr-1.5" /> : <Navigation className="size-3.5 mr-1.5" />}
                Load Route Trail
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── DEVICE BLACKOUT & POWER DIAGNOSTICS ALERT (If device offline/switched off) ─── */}
      {viewMode === "journey" && routeData && (
        <AnimatePresence>
          {routeData.is_device_offline ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/5 to-amber-500/10 border-2 border-red-500/30 shadow-md space-y-2"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-red-600 text-white animate-pulse shadow-sm">
                    <AlertCircle className="size-5" />
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                      Device Blackout / Sudden Power-Off Detected
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-black bg-red-600/10 text-red-600 border border-red-600/30">
                        {routeData.device_health_status || "Signal Lost"}
                      </span>
                    </h4>
                    <p className="text-xs text-foreground/80 font-medium mt-0.5">
                      {routeData.disconnect_reason || "Phone went offline abruptly during active shift."}
                    </p>
                  </div>
                </div>

                {/* Power & Blackout Timing Metrics */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="px-3 py-1.5 rounded-xl bg-card border shadow-xs text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Time Switched Off</p>
                    <p className="text-xs font-black font-mono text-red-600 dark:text-red-400">
                      {formatTimestamp(routeData.last_ping_time)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{routeData.minutes_since_last_ping ?? 0}m ago</p>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-card border shadow-xs text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Battery At Disconnect</p>
                    <p className={`text-xs font-black font-mono flex items-center justify-end gap-1 ${
                      (routeData.last_battery_level ?? 100) <= 15 ? "text-red-600" : "text-amber-600"
                    }`}>
                      <Battery className="size-3.5" />
                      {routeData.last_battery_level !== undefined && routeData.last_battery_level !== null
                        ? `${routeData.last_battery_level}%`
                        : "Unknown"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {(routeData.last_battery_level ?? 100) <= 5 ? "Exhausted" : "Sudden Shutdown"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Exact Coordinate Location of Disconnect */}
              <div className="pt-2 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5 text-red-500 shrink-0" />
                  <span>Last Logged Location:</span>
                  <strong className="text-foreground font-semibold">{routeData.last_known_location || "Unknown"}</strong>
                </div>
                {routeData.last_latitude && routeData.last_longitude && (
                  <span className="font-mono text-[11px] text-muted-foreground bg-card/60 px-2 py-0.5 rounded-md border">
                    GPS: {routeData.last_latitude.toFixed(5)}° N, {routeData.last_longitude.toFixed(5)}° E
                  </span>
                )}
              </div>
            </motion.div>
          ) : (
            routeData.shift_status !== "No Shift Data" && !routeData.clock_out && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Device Active & Streaming Online</span>
                  <span className="text-muted-foreground">• Last ping at {formatTimestamp(routeData.last_ping_time)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-600 font-bold font-mono">
                    <Battery className="size-3.5" /> {routeData.last_battery_level ?? 100}% Battery
                  </span>
                </div>
              </div>
            )
          )}
        </AnimatePresence>
      )}

      {/* ─── METRIC CARDS OVERVIEW (Journey Mode) ─── */}
      {viewMode === "journey" && routeData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Travel Distance</p>
            <p className="text-xl font-black font-mono text-primary mt-1">{routeData.total_distance_km ?? 0} km</p>
            <p className="text-[10px] text-muted-foreground">Geodesic Haversine</p>
          </Card>

          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Moving Duration</p>
            <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatDuration(routeData.moving_duration_minutes)}
            </p>
            <p className="text-[10px] text-muted-foreground">Active commute</p>
          </Card>

          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Idle / Halts Duration</p>
            <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {formatDuration(routeData.idle_duration_minutes)}
            </p>
            <p className="text-[10px] text-muted-foreground">{currentStops.length} customer stops</p>
          </Card>

          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Avg / Top Speed</p>
            <p className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              {routeData.avg_speed_kmh ?? 0} <span className="text-xs text-muted-foreground font-normal">/ {routeData.max_speed_kmh ?? 0} km/h</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Ground velocity</p>
          </Card>

          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Clock-In & Out</p>
            <p className="text-sm font-bold text-foreground mt-1">
              {formatTimestamp(routeData.clock_in)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {routeData.clock_out ? `Out: ${formatTimestamp(routeData.clock_out)}` : "🟢 Active On Shift"}
            </p>
          </Card>

          <Card className="p-3 border rounded-xl bg-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Last Known Battery</p>
            <p className={`text-xl font-black font-mono mt-1 flex items-center gap-1.5 ${
              (routeData.last_battery_level ?? 100) <= 15 ? "text-red-500" : "text-emerald-500"
            }`}>
              <Battery className="size-4" />
              {routeData.last_battery_level !== undefined && routeData.last_battery_level !== null
                ? `${routeData.last_battery_level}%`
                : "100%"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {routeData.is_device_offline ? "At Disconnect" : "Live Device Level"}
            </p>
          </Card>
        </div>
      )}

      {/* ─── MAIN MAP & PLAYBACK WORKSPACE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left / Center Map Studio Canvas (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="relative p-0 overflow-hidden rounded-2xl border shadow-sm">
            {/* Leaflet Map Canvas */}
            <div ref={mapContainerRef} className="w-full h-[540px] z-0" />

            {/* Empty State Overlay */}
            {viewMode === "journey" && currentPoints.length === 0 && !loadingRoute && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
                <MapPin className="size-12 text-muted-foreground/50 mb-2" />
                <h3 className="font-bold text-base text-foreground">No GPS Trail Logged For This Date</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  The selected employee has no recorded background GPS coordinates on {selectedDate}. Geolocation logs stream automatically while employees are clocked in on their mobile / web shift.
                </p>
              </div>
            )}

            {/* Loading Overlay */}
            {(loadingRoute || loadingLive) && (
              <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-background/90 backdrop-blur-md border shadow-md flex items-center gap-2 text-xs font-semibold">
                <RefreshCw className="size-3.5 animate-spin text-primary" />
                <span>Synchronizing satellite GIS coordinates...</span>
              </div>
            )}

            {/* Live Legend Floating Tag */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-background/90 backdrop-blur-md border shadow-xs text-[11px] font-semibold">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                <span className="size-2 rounded-full bg-emerald-500"></span> Start / Origin
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">
                <span className="size-2 rounded-full bg-amber-500"></span> Customer Halts
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600">
                <span className="size-2 rounded-full bg-indigo-500"></span> Active Trail
              </span>
            </div>

            {/* Active Playback Point Floating Badge */}
            {viewMode === "journey" && currentPoint && (
              <div className="absolute bottom-4 left-4 z-20 p-3 rounded-xl bg-background/95 backdrop-blur-md border shadow-lg max-w-xs space-y-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-primary flex items-center gap-1">
                    <Navigation className="size-3.5" /> Replay Point #{playbackIndex + 1}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatTimestamp(currentPoint.recorded_at)}
                  </span>
                </div>
                <p className="font-medium text-foreground truncate">{currentPoint.location_name || "En Route"}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                  <span>⚡ {currentPoint.speed || 0} km/h</span>
                  <span>🎯 ±{Math.round(currentPoint.accuracy || 10)}m</span>
                  {currentPoint.battery_level && <span>🔋 {currentPoint.battery_level}%</span>}
                </div>
              </div>
            )}
          </Card>

          {/* ─── JOURNEY PLAYBACK CONTROLLER SCRUB BAR ─── */}
          {viewMode === "journey" && currentPoints.length > 0 && (
            <Card className="p-4 border bg-card/60 backdrop-blur-md rounded-2xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Play / Pause / Reset buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsPlaying(false);
                      handleSliderChange(0);
                    }}
                    className="h-9 w-9 p-0 rounded-xl"
                    title="Reset to Start"
                  >
                    <RotateCcw className="size-4" />
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="h-9 px-4 rounded-xl gradient-brand text-white font-bold text-xs gap-1.5 shadow-xs"
                  >
                    {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {isPlaying ? "Pause" : "Play Journey"}
                  </Button>

                  {/* Speed Multiplier */}
                  <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border text-xs">
                    {[1, 2, 5, 10].map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                          playbackSpeed === s ? "bg-card shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress Time Indicator */}
                <div className="text-right">
                  <p className="text-xs font-bold font-mono text-foreground">
                    {formatTimestamp(currentPoint?.recorded_at)} / {formatTimestamp(currentPoints[currentPoints.length - 1]?.recorded_at)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Waypoint {playbackIndex + 1} of {currentPoints.length}
                  </p>
                </div>
              </div>

              {/* Range Scrub Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, currentPoints.length - 1)}
                  value={playbackIndex}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Route Stops & Leg Breakdown (1 col) */}
        <div className="space-y-3">
          {viewMode === "journey" ? (
            <Card className="p-4 border rounded-2xl bg-card h-full flex flex-col justify-between max-h-[630px]">
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Compass className="size-4 text-primary" /> Stops & Halt Timeline
                  </h3>
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-bold">
                    {currentStops.length} Halts
                  </span>
                </div>

                {/* Stops Scroll List */}
                <div className="space-y-2 overflow-y-auto max-h-[440px] pr-1">
                  {/* Origin Step */}
                  {routeData?.start_point && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Origin (Clock-In)
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatTimestamp(routeData.start_point.recorded_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground font-medium truncate">
                        {routeData.start_point.location_name || "Shift Start Location"}
                      </p>
                    </div>
                  )}

                  {/* Customer Stops */}
                  {currentStops.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No prolonged stops (&gt;6 min) detected on this route. Continuous transit.
                    </p>
                  ) : (
                    currentStops.map((st, idx) => (
                      <div
                        key={st.stop_index || idx}
                        onClick={() => handleFocusStop(st)}
                        className="p-2.5 rounded-xl bg-muted/40 hover:bg-muted/80 border transition cursor-pointer text-xs space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            Stop #{st.stop_index || idx + 1}
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 font-bold rounded text-[10px]">
                            ⏱️ {formatDuration(st.duration_minutes)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-foreground group-hover:text-primary transition truncate">
                          {st.location_name || "Client Visit / Halt Location"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatTimestamp(st.arrival_time)} → {formatTimestamp(st.departure_time)}
                        </p>
                      </div>
                    ))
                  )}

                  {/* Destination Step */}
                  {routeData?.end_point && routeData.clock_out && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          🏁 Destination (Clock-Out)
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatTimestamp(routeData.end_point.recorded_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground font-medium truncate">
                        {routeData.end_point.location_name || "Shift End Location"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Employee Summary Card */}
              {routeData && (
                <div className="mt-3 pt-3 border-t flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {(routeData.employee_name || "EM").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-foreground truncate">{routeData.employee_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{routeData.designation || "Field Executive"}</p>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            /* Live Fleet List (Live Radar Mode) */
            <Card className="p-4 border rounded-2xl bg-card h-full flex flex-col justify-between max-h-[630px]">
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Radio className="size-4 text-emerald-500" /> Active Field Staff
                  </h3>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold">
                    {liveStaff.length} On Duty
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[480px] pr-1">
                  {liveStaff.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-8 text-center">
                      No active field staff currently clocked-in.
                    </p>
                  ) : (
                    liveStaff.map((st) => {
                      const isMoving = (st.speed || 0) > 2;
                      return (
                        <div
                          key={st.employee_id}
                          onClick={() => {
                            setSelectedEmployeeId(st.employee_id);
                            setViewMode("journey");
                          }}
                          className="p-3 rounded-xl bg-muted/40 hover:bg-muted/80 border transition cursor-pointer text-xs space-y-1.5 group"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-foreground group-hover:text-primary transition truncate">
                              {st.employee_name}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !st.is_online ? "bg-red-500/10 text-red-600" :
                              isMoving ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                            }`}>
                              {!st.is_online ? "⚠️ Offline / Switched Off" : isMoving ? "🚗 Moving" : "📍 Idle"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {st.last_location_name || "Field Location"}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                            <span>🏁 {st.total_distance_km ?? 0} km</span>
                            <span className="flex items-center gap-0.5">🔋 {st.battery_level !== undefined && st.battery_level !== null ? `${st.battery_level}%` : "—"}</span>
                            <span>🕒 {st.is_online ? formatTimestamp(st.last_ping_time || st.last_ping_at) : `${st.minutes_since_ping ?? 0}m ago`}</span>
                          </div>
                          {!st.is_online && st.disconnect_reason && (
                            <p className="text-[10px] text-red-600/90 font-medium bg-red-500/5 p-1 rounded border border-red-500/10 truncate">
                              {st.disconnect_reason}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
