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
