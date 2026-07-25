class ZohoRecruitException(Exception):
    """Base exception for Zoho Recruit Integration"""
    pass

class ZohoOAuthException(ZohoRecruitException):
    """Exception raised during OAuth token exchanges or refreshes"""
    pass

class ZohoAPIException(ZohoRecruitException):
    """Exception raised for Zoho API failures (4xx/5xx)"""
    def __init__(self, message: str, status_code: int = 400, response_body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body
