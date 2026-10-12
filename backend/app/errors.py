from typing import Any


class DomainError(Exception):
    """Exception raised for business validation and domain constraint violations."""
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class FraudBlocked(Exception):
    """Exception raised when a proposed transaction is blocked by fraud detection rules."""
    def __init__(self, report: dict[str, Any]) -> None:
        super().__init__("Transaction blocked by fraud detection rules")
        self.report = report


class IllegalTransition(Exception):
    """Exception raised when an invalid mutation workflow state transition is attempted."""
    def __init__(self, from_state: str, to_state: str, allowed: list[str]) -> None:
        super().__init__(f"Cannot transition from {from_state} to {to_state}. Allowed: {allowed}")
        self.from_state = from_state
        self.to_state = to_state
        self.allowed = allowed

