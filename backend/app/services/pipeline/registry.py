from app.services.fraud.integrity import IntegrityLayer
from app.services.fraud.rules import RulesLayer
from app.services.pipeline.base import Layer

LAYERS: list[Layer] = [
    IntegrityLayer(),
    RulesLayer(),
]


def get_layers() -> list[Layer]:
    """Retrieve all configured pipeline layers."""
    return list(LAYERS)
