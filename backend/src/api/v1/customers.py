from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.database.session import get_db
from src.schemas.customer import CustomerResponse, CustomerCreate
from src.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("")
def get_customers(db: Session = Depends(get_db)):
    return CustomerService.get_all_customers(db)

@router.get("/slot-bookings")
def get_customer_slot_bookings(
    branch: Optional[str] = None,
    date: Optional[str] = None,
    customer_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from src.services.slot_booking_service import SlotBookingService
    return SlotBookingService.get_all_bookings(db, branch=branch, date=date, customer_id=customer_id)

@router.get("/{customer_id}")
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    cust = CustomerService.get_customer_by_id(db, customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.post("/onboard")
def onboard_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    return CustomerService.onboard_customer(db, payload.model_dump())

@router.put("/{customer_id}")
def update_customer(customer_id: str, payload: dict, db: Session = Depends(get_db)):
    try:
        return CustomerService.update_customer(db, customer_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{customer_id}/sync-biometric")
def sync_customer_biometric(customer_id: str, payload: dict = None, db: Session = Depends(get_db)):
    try:
        return CustomerService.sync_customer_biometric(db, customer_id, data=payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{customer_id}")
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    success = CustomerService.delete_customer(db, customer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


# Alias router for /members
members_router = APIRouter(prefix="/members", tags=["Members"])

@members_router.get("")
def get_all_members(db: Session = Depends(get_db)):
    return CustomerService.get_all_customers(db)

@members_router.get("/{member_id}")
def get_member_by_id(member_id: str, db: Session = Depends(get_db)):
    cust = CustomerService.get_customer_by_id(db, member_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Member not found")
    return cust

