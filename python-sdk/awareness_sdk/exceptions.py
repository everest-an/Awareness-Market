"""
Custom exceptions for Awareness SDK
"""


class AwarenessSDKError(Exception):
    """Base exception for all Awareness SDK errors"""
    pass


class AuthenticationError(AwarenessSDKError):
    """Raised when API key authentication fails"""
    pass


class APIError(AwarenessSDKError):
    """Raised when API returns an error response"""
    
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class ValidationError(AwarenessSDKError):
    """Raised when input validation fails"""
    pass


class NotFoundError(AwarenessSDKError):
    """Raised when requested resource is not found"""
    pass


class NetworkError(AwarenessSDKError):
    """Raised when network request fails"""
    pass
