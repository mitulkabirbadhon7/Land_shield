class DomainError(Exception):
    """Exception raised for business validation and domain constraint violations."""
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
