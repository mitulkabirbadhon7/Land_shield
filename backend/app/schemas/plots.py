from pydantic import BaseModel, Field


class PlotOut(BaseModel):
    id: int
    mouza: str
    upazila: str
    district: str
    dag_no: str
    area_decimal: float
    land_type: str
    flags: list[str] = Field(default_factory=list)
    initial_owner_id: int | None = None
    current_owner_id: int | None = None
    initial_owner_name: str | None = None
    current_owner_name: str | None = None
    initial_owner_masked: str | None = None
    current_owner_masked: str | None = None
    is_khas: bool = False
    is_acquisition: bool = False
    is_disputed: bool = False


class ChainItem(BaseModel):
    seq: int | None = None
    deed_no: str
    date: str
    buyer: str
    deed_status: str
    verify_status: str
    area_sold: float | None = None
