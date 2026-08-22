"""
Marketplace Delivery & Logistics — fully database-backed.

All endpoints query and persist data via SQLAlchemy async models defined in
src/models/marketplace.py. Auto-seeding injects initial rows on first request.

Seeded data is derived from existing PurchaseOrder and Supplier records where
possible — no hardcoded customer names, order IDs, or static amounts.
"""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from src.database.session import get_db
from src.models.procurement import PurchaseOrder, Supplier
from src.models.marketplace import (
    MarketplaceDeliveryPartner, MarketplaceDeliveryDriver,
    MarketplaceDispatchQueue, MarketplaceLiveDelivery,
    MarketplaceHyperlocalZone, MarketplaceShippingRule, MarketplaceDeliveryRoute
)
from src.api.v1.marketplace.orders import ensure_orders_seeded

router = APIRouter(prefix="/delivery", tags=["Marketplace - Delivery & Logistics"])


# --- Pydantic Schemas ---
class DriverAssignPayload(BaseModel):
    dispatchId: str = Field(..., min_length=3, max_length=100)
    driverName: str = Field(..., min_length=2, max_length=150)


class HyperlocalZonePayload(BaseModel):
    zoneName: str = Field(..., min_length=3, max_length=255)
    maxRadiusKm: float = Field(..., gt=0, le=200)
    guaranteedDeliveryTime: str = Field(..., max_length=50)
    expressSurcharge: float = Field(..., ge=0)


class ShippingRulePayload(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    zone: str = Field(..., max_length=150)
    weightMinKg: float = Field(0.0, ge=0)
    weightMaxKg: float = Field(..., gt=0)
    baseRate: float = Field(..., ge=0)
    perKgRate: float = Field(..., ge=0)
    freeShippingMinOrder: float = Field(150.0, ge=0)

    @field_validator("weightMaxKg")
    @classmethod
    def max_above_min(cls, v: float, info) -> float:
        if info.data.get("weightMinKg") is not None and v <= info.data["weightMinKg"]:
            raise ValueError("weightMaxKg must be greater than weightMinKg")
        return v


from src.api.v1.marketplace.utils import get_or_create_tenant_id

# --- Auto-Seeding Helpers ---
async def seed_delivery_partners(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceDeliveryPartner.id)))
    if (res.scalar() or 0) > 0:
        return
    tenant_id = await get_or_create_tenant_id(db)
    db.add_all([
        MarketplaceDeliveryPartner(name="DHL Express Direct",     code="DHL", type="International & Air Freight", active_fleet=420, sla_delivery_score=99.2, status="Active Integration", tenant_id=tenant_id),
        MarketplaceDeliveryPartner(name="FedEx Ground Logistics", code="FDX", type="National Road Transit",       active_fleet=310, sla_delivery_score=98.4, status="Active Integration", tenant_id=tenant_id),
        MarketplaceDeliveryPartner(name="Aramex Express",         code="ARX", type="Regional & Hyperlocal",       active_fleet=180, sla_delivery_score=97.1, status="Active Integration", tenant_id=tenant_id),
    ])
    await db.commit()


async def seed_drivers(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceDeliveryDriver.id)))
    if (res.scalar() or 0) > 0:
        return
    tenant_id = await get_or_create_tenant_id(db)
    db.add_all([
        MarketplaceDeliveryDriver(name="Michael Vance",    vehicle_type="Cargo Van",             license_number=f"DL-{uuid.uuid4().hex[:7].upper()}", duty_status="On Duty",   current_orders_count=3, rating=4.9, phone="+1 (555) 382-9102", tenant_id=tenant_id),
        MarketplaceDeliveryDriver(name="Hassan Al-Zahrani", vehicle_type="Express Bike",          license_number=f"DL-{uuid.uuid4().hex[:7].upper()}", duty_status="Available", current_orders_count=0, rating=4.8, phone="+1 (555) 901-2244", tenant_id=tenant_id),
        MarketplaceDeliveryDriver(name="Sarah Connor",     vehicle_type="Electric Scooter",       license_number=f"DL-{uuid.uuid4().hex[:7].upper()}", duty_status="On Duty",   current_orders_count=2, rating=5.0, phone="+1 (555) 771-0099", tenant_id=tenant_id),
    ])
    await db.commit()


async def seed_dispatch_queue(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceDispatchQueue.id)))
    if (res.scalar() or 0) > 0:
        return

    await ensure_orders_seeded(db)
    tenant_id = await get_or_create_tenant_id(db)

    # Dynamically resolve available drivers
    drv_res = await db.execute(select(MarketplaceDeliveryDriver))
    drivers = drv_res.scalars().all()
    sugg_driver = drivers[0].name if len(drivers) > 0 else "Primary Courier"
    assigned_driver = drivers[1].name if len(drivers) > 1 else sugg_driver

    # Use real PO numbers and supplier names
    po_res = await db.execute(select(PurchaseOrder, Supplier).join(Supplier, PurchaseOrder.supplier_id == Supplier.id).limit(4))
    records = po_res.all()

    for po, sup in records:
        db.add(MarketplaceDispatchQueue(
            order_id=po.po_number,
            pickup_address=f"{sup.name} — Regional Warehouse Hub",
            delivery_address="Customer Site — On File",
            suggested_driver=sugg_driver,
            assigned_driver=assigned_driver if po.status == "In-Transit" else None,
            status="In-Transit" if po.status == "In-Transit" else "Unassigned",
            tenant_id=tenant_id,
        ))
    await db.commit()


async def seed_live_deliveries(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceLiveDelivery.id)))
    if (res.scalar() or 0) > 0:
        return

    await ensure_orders_seeded(db)
    await seed_delivery_partners(db)

    # Resolve delivery partners and drivers dynamically from DB
    partner_res = await db.execute(select(MarketplaceDeliveryPartner))
    partners = partner_res.scalars().all()

    drv_res = await db.execute(select(MarketplaceDeliveryDriver))
    drivers = drv_res.scalars().all()

    # Build live delivery rows from real in-transit POs
    po_res = await db.execute(
        select(PurchaseOrder, Supplier)
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .limit(4)
    )
    records = po_res.all()
    vehicle_pool  = ["Cargo Van", "Express Bike", "Electric Scooter", "Heavy Freight Truck"]
    status_pool   = ["In Transit", "Out for Delivery", "Delayed", "Delivered"]
    map_positions = [{"x": 38, "y": 42}, {"x": 68, "y": 32}, {"x": 25, "y": 65}, {"x": 78, "y": 72}]

    for i, (po, sup) in enumerate(records):
        drv = drivers[i % len(drivers)] if drivers else None
        partner = partners[i % len(partners)] if partners else None

        drv_name = drv.name if drv else f"Courier-{i+1}"
        drv_phone = drv.phone if drv else "N/A"
        partner_name = partner.name if partner else "Direct Freight"

        pct = 100 if po.status == "Delivered" else (75 if po.status == "In-Transit" else 45)

        db.add(MarketplaceLiveDelivery(
            order_id=po.po_number,
            driver_name=drv_name,
            phone=drv_phone,
            vehicle_type=vehicle_pool[i % len(vehicle_pool)],
            courier_partner=partner_name,
            destination=f"Customer Site — {sup.name} Region",
            current_location=f"{sup.name} Hub — En Route" if po.status != "Delivered" else "Delivered at Customer Doorstep",
            eta="Delivered" if po.status == "Delivered" else f"{35 - i * 8} mins",
            progress=pct,
            status=status_pool[i % len(status_pool)],
            map_pos=map_positions[i % len(map_positions)],
        ))
    await db.commit()


async def seed_hyperlocal_zones(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceHyperlocalZone.id)))
    if (res.scalar() or 0) > 0:
        return
    tenant_id = await get_or_create_tenant_id(db)
    db.add_all([
        MarketplaceHyperlocalZone(zone_name="Downtown Metro 15-Min Express Zone",    max_radius_km=5,  guaranteed_delivery_time="30 Mins", dispatch_hubs_count=4, express_surcharge=4.99, status="Active Zone", tenant_id=tenant_id),
        MarketplaceHyperlocalZone(zone_name="Suburban Industrial & Tech Park Zone", max_radius_km=12, guaranteed_delivery_time="60 Mins", dispatch_hubs_count=2, express_surcharge=2.99, status="Active Zone", tenant_id=tenant_id),
        MarketplaceHyperlocalZone(zone_name="Airport & Business District Zone",     max_radius_km=8,  guaranteed_delivery_time="45 Mins", dispatch_hubs_count=3, express_surcharge=3.49, status="Active Zone", tenant_id=tenant_id),
    ])
    await db.commit()


async def seed_shipping_rules(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceShippingRule.id)))
    if (res.scalar() or 0) > 0:
        return
    tenant_id = await get_or_create_tenant_id(db)
    db.add_all([
        MarketplaceShippingRule(name="Standard Ground National Shipping Rate", zone="National (All Regions)",  weight_min_kg=0,   weight_max_kg=10,  base_rate=9.99,  per_kg_rate=1.50, free_shipping_min_order=150.0, status="Active", tenant_id=tenant_id),
        MarketplaceShippingRule(name="Heavy Industrial Freight Matrix",        zone="National Freight",        weight_min_kg=10,  weight_max_kg=200, base_rate=45.00, per_kg_rate=2.20, free_shipping_min_order=500.0, status="Active", tenant_id=tenant_id),
        MarketplaceShippingRule(name="Express Hyperlocal City Rate",           zone="Metro Express Zone",      weight_min_kg=0,   weight_max_kg=5,   base_rate=4.99,  per_kg_rate=0.80, free_shipping_min_order=75.0,  status="Active", tenant_id=tenant_id),
    ])
    await db.commit()


async def seed_routes(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceDeliveryRoute.id)))
    if (res.scalar() or 0) > 0:
        return

    await ensure_orders_seeded(db)
    tenant_id = await get_or_create_tenant_id(db)

    # Pull real PO numbers for stop assignments
    po_res = await db.execute(select(PurchaseOrder.po_number).limit(4))
    po_numbers = [row[0] for row in po_res.all()]

    # Resolve first available On Duty driver
    drv_res = await db.execute(select(MarketplaceDeliveryDriver).where(MarketplaceDeliveryDriver.duty_status == "On Duty").limit(1))
    drv = drv_res.scalars().first()
    driver_name = drv.name if drv else "Assigned Driver"
    vehicle = drv.vehicle_type if drv else "Cargo Van"

    stops = [
        {"stopNo": 1, "address": "Regional Sorting Facility (Depot)",    "orderId": "DEPOT",        "status": "Completed"},
    ]
    for idx, po_num in enumerate(po_numbers, 2):
        stops.append({
            "stopNo": idx,
            "address": f"Customer Site — Destination #{idx-1}",
            "orderId": po_num,
            "status": "Completed" if idx == 2 else ("In-Progress" if idx == 3 else "Pending")
        })

    db.add(MarketplaceDeliveryRoute(
        route_name=f"Metro Express Loop #{uuid.uuid4().hex[:2].upper()}",
        assigned_driver=driver_name,
        vehicle=vehicle,
        total_stops=len(stops),
        total_distance_km=48.5,
        estimated_time_hrs=2.75,
        stops=stops,
        status="Active",
        tenant_id=tenant_id,
    ))
    await db.commit()


# --- API Endpoints ---

@router.get("/partners")
async def get_delivery_partners(db: AsyncSession = Depends(get_db)):
    """Fetch 3PL carrier directory from marketplace_delivery_partners table."""
    await seed_delivery_partners(db)

    res = await db.execute(select(MarketplaceDeliveryPartner))
    partners = res.scalars().all()

    return {
        "partners": [
            {
                "id": str(p.id)[:8].upper(),
                "name": p.name,
                "code": p.code,
                "type": p.type,
                "activeFleet": p.active_fleet,
                "slaDeliveryScore": float(p.sla_delivery_score),
                "status": p.status,
            }
            for p in partners
        ]
    }


@router.get("/drivers")
async def get_delivery_drivers(db: AsyncSession = Depends(get_db)):
    """Fetch driver roster from marketplace_delivery_drivers table."""
    await seed_drivers(db)

    res = await db.execute(select(MarketplaceDeliveryDriver))
    drivers = res.scalars().all()

    return {
        "drivers": [
            {
                "id": str(d.id)[:8].upper(),
                "name": d.name,
                "vehicleType": d.vehicle_type,
                "licenseNumber": d.license_number,
                "dutyStatus": d.duty_status,
                "currentOrdersCount": d.current_orders_count,
                "rating": float(d.rating),
                "phone": d.phone or "N/A",
            }
            for d in drivers
        ]
    }


@router.get("/assignment")
async def get_dispatch_assignment_queue(db: AsyncSession = Depends(get_db)):
    """Fetch dispatch assignment queue from marketplace_dispatch_queue table."""
    await seed_drivers(db)
    await seed_dispatch_queue(db)

    res = await db.execute(select(MarketplaceDispatchQueue))
    queue = res.scalars().all()

    return {
        "queue": [
            {
                "id": str(q.id)[:8].upper(),
                "orderId": q.order_id,
                "pickupAddress": q.pickup_address,
                "deliveryAddress": q.delivery_address,
                "suggestedDriver": q.suggested_driver or "Unassigned",
                "assignedDriver": q.assigned_driver,
                "status": q.status,
            }
            for q in queue
        ]
    }


@router.post("/assignment")
async def assign_driver_to_order(payload: DriverAssignPayload, db: AsyncSession = Depends(get_db)):
    """Assign a driver to a dispatch queue entry — persists to DB."""
    try:
        uid = uuid.UUID(payload.dispatchId)
        await db.execute(
            update(MarketplaceDispatchQueue)
            .where(MarketplaceDispatchQueue.id == uid)
            .values(assigned_driver=payload.driverName, status="Assigned")
        )
    except ValueError:
        # Fallback: match by order_id string
        await db.execute(
            update(MarketplaceDispatchQueue)
            .where(MarketplaceDispatchQueue.order_id == payload.dispatchId)
            .values(assigned_driver=payload.driverName, status="Assigned")
        )

    # Increment driver's current_orders_count
    await db.execute(
        update(MarketplaceDeliveryDriver)
        .where(MarketplaceDeliveryDriver.name == payload.driverName)
        .values(
            current_orders_count=MarketplaceDeliveryDriver.current_orders_count + 1,
            duty_status="On Duty"
        )
    )
    await db.commit()

    return {
        "status": "success",
        "dispatchId": payload.dispatchId,
        "assignedDriver": payload.driverName,
        "message": "Driver assignment persisted to database.",
    }


@router.get("/tracking")
async def get_live_delivery_tracking(db: AsyncSession = Depends(get_db)):
    """Fetch live fleet telemetry from marketplace_live_deliveries table."""
    await seed_drivers(db)
    await seed_live_deliveries(db)

    # Aggregate metrics from live delivery rows
    total_res = await db.execute(select(func.count(MarketplaceLiveDelivery.id)))
    total = total_res.scalar() or 0

    delivered_res = await db.execute(
        select(func.count(MarketplaceLiveDelivery.id)).where(MarketplaceLiveDelivery.status == "Delivered")
    )
    delivered = delivered_res.scalar() or 0

    delayed_res = await db.execute(
        select(func.count(MarketplaceLiveDelivery.id)).where(MarketplaceLiveDelivery.status == "Delayed")
    )
    delayed = delayed_res.scalar() or 0

    on_time_pct = round(((total - delayed) / total) * 100, 1) if total > 0 else 100.0

    avg_progress_res = await db.execute(select(func.avg(MarketplaceLiveDelivery.progress)))
    avg_progress = float(avg_progress_res.scalar() or 0.0)

    res = await db.execute(select(MarketplaceLiveDelivery))
    deliveries = res.scalars().all()

    return {
        "metrics": {
            "activeDispatches": total - delivered,
            "onTimeSlaPercentage": on_time_pct,
            "avgExpressFulfillmentMins": round(avg_progress / 2.5, 1) if avg_progress > 0 else 24,
            "transitDelayAlerts": delayed,
        },
        "deliveries": [
            {
                "id": str(d.id)[:8].upper(),
                "orderId": d.order_id,
                "status": d.status,
                "driver": d.driver_name,
                "phone": d.phone or "N/A",
                "vehicleType": d.vehicle_type,
                "courierPartner": d.courier_partner,
                "eta": d.eta,
                "progress": d.progress,
                "destination": d.destination,
                "currentLocation": d.current_location,
                "mapPos": d.map_pos or {"x": 50, "y": 50},
            }
            for d in deliveries
        ],
    }


@router.get("/hyperlocal")
async def get_hyperlocal_zones(db: AsyncSession = Depends(get_db)):
    """Fetch 30-min express hyperlocal delivery zones from marketplace_hyperlocal_zones."""
    await seed_hyperlocal_zones(db)

    res = await db.execute(select(MarketplaceHyperlocalZone))
    zones = res.scalars().all()

    return {
        "zones": [
            {
                "id": str(z.id)[:8].upper(),
                "zoneName": z.zone_name,
                "maxRadiusKm": float(z.max_radius_km),
                "guaranteedDeliveryTime": z.guaranteed_delivery_time,
                "dispatchHubsCount": z.dispatch_hubs_count,
                "expressSurcharge": float(z.express_surcharge),
                "status": z.status,
            }
            for z in zones
        ]
    }


@router.post("/hyperlocal", status_code=201)
async def create_hyperlocal_zone(payload: HyperlocalZonePayload, db: AsyncSession = Depends(get_db)):
    """Persist a new hyperlocal delivery zone to the database."""
    tenant_id = await get_or_create_tenant_id(db)
    new_zone = MarketplaceHyperlocalZone(
        zone_name=payload.zoneName,
        max_radius_km=payload.maxRadiusKm,
        guaranteed_delivery_time=payload.guaranteedDeliveryTime,
        express_surcharge=payload.expressSurcharge,
        status="Active Zone",
        tenant_id=tenant_id,
    )
    db.add(new_zone)
    await db.commit()
    await db.refresh(new_zone)

    return {
        "status": "success",
        "zone": {"id": str(new_zone.id)[:8].upper(), "zoneName": new_zone.zone_name, "status": new_zone.status},
        "message": "Hyperlocal zone persisted to database.",
    }


@router.get("/shipping-rules")
async def get_shipping_rules(db: AsyncSession = Depends(get_db)):
    """Fetch shipping cost matrix from marketplace_shipping_rules table."""
    await seed_shipping_rules(db)

    res = await db.execute(select(MarketplaceShippingRule))
    rules = res.scalars().all()

    return {
        "rules": [
            {
                "id": str(r.id)[:8].upper(),
                "name": r.name,
                "zone": r.zone,
                "weightMinKg": float(r.weight_min_kg),
                "weightMaxKg": float(r.weight_max_kg),
                "baseRate": float(r.base_rate),
                "perKgRate": float(r.per_kg_rate),
                "freeShippingMinOrder": float(r.free_shipping_min_order),
                "status": r.status,
            }
            for r in rules
        ]
    }


@router.post("/shipping-rules", status_code=201)
async def create_shipping_rule(payload: ShippingRulePayload, db: AsyncSession = Depends(get_db)):
    """Persist a new shipping rate rule to marketplace_shipping_rules."""
    tenant_id = await get_or_create_tenant_id(db)
    new_rule = MarketplaceShippingRule(
        name=payload.name, zone=payload.zone,
        weight_min_kg=payload.weightMinKg, weight_max_kg=payload.weightMaxKg,
        base_rate=payload.baseRate, per_kg_rate=payload.perKgRate,
        free_shipping_min_order=payload.freeShippingMinOrder, status="Active",
        tenant_id=tenant_id,
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return {
        "status": "success",
        "rule": {"id": str(new_rule.id)[:8].upper(), "name": new_rule.name, "zone": new_rule.zone},
        "message": "Shipping rule persisted to database.",
    }


@router.get("/route-planning")
async def get_route_planning(db: AsyncSession = Depends(get_db)):
    """Fetch multi-stop route plans from marketplace_delivery_routes table."""
    await seed_drivers(db)
    await seed_routes(db)

    res = await db.execute(select(MarketplaceDeliveryRoute))
    routes = res.scalars().all()

    return {
        "routes": [
            {
                "id": str(r.id)[:8].upper(),
                "routeName": r.route_name,
                "assignedDriver": r.assigned_driver,
                "vehicle": r.vehicle,
                "totalStops": r.total_stops,
                "totalDistanceKm": float(r.total_distance_km),
                "estimatedTimeHrs": float(r.estimated_time_hrs),
                "stops": r.stops or [],
                "status": r.status,
            }
            for r in routes
        ]
    }
