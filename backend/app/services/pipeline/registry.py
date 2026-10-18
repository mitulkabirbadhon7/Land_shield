from app.services.fraud.integrity import IntegrityLayer
from app.services.fraud.ml_layer import MLLayer
from app.services.fraud.rules import RulesLayer
from app.services.lineage import LineageLayer
from app.services.pipeline.base import Layer
from app.services.reconcile import ReconcileLayer

LAYERS: list[Layer] = [
    IntegrityLayer(),
    RulesLayer(),
    ReconcileLayer(),
    LineageLayer(),
    MLLayer(),
]


def get_layers() -> list[Layer]:
    """Retrieve all configured pipeline layers."""
    return list(LAYERS)
