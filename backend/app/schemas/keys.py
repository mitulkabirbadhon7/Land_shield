from pydantic import BaseModel, ConfigDict


class SigningKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key_id: str
    public_key_hex: str
    status: str
    created_at: str | None = None
