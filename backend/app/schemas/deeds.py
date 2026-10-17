from typing import Any
from pydantic import BaseModel, Field, model_validator


class DeedCreate(BaseModel):
    plot_id: int
    seller_id: int
    buyer_id: int
    area_sold: float = Field(..., gt=0, description="Area of land being sold in decimals")
    deed_type: str = "SALE"
    sub_registry: str = "MIR"

    @model_validator(mode="before")
    @classmethod
    def handle_area_decimal_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "area_sold" not in data and "area_decimal" in data:
                data["area_sold"] = data["area_decimal"]
        return data

    @model_validator(mode="after")
    def check_seller_not_buyer(self) -> "DeedCreate":
        if self.seller_id == self.buyer_id:
            raise ValueError("Seller and buyer cannot be the same person")
        return self


class VerifyOut(BaseModel):
    status: str
    reasons: list[str] = Field(default_factory=list)
    deed_no: str
    plot_id: int | None = None
    chain_position: int | None = None
    registered_at: str | None = None


class DeedOut(BaseModel):
    id: int
    deed_no: str
    plot_id: int
    seller_id: int
    buyer_id: int
    seller_name: str | None = None
    buyer_name: str | None = None
    area_sold: float
    deed_type: str
    sub_registry: str
    registered_at: str
    deed_hash: str
    signer_key_id: str | None = None
    status: str = "ACTIVE"


class DeedRegistrationResponse(BaseModel):
    deed: DeedOut
    verify: VerifyOut
