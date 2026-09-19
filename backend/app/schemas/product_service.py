from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class ProductServiceBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: str = "PRODUCT"
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "INR"
    is_active: bool = True

class ProductServiceCreate(ProductServiceBase):
    pass

class ProductServiceUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None

class ProductServiceOut(ProductServiceBase):
    id: str
    organization_id: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
