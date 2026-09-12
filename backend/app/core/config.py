from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
from pathlib import Path
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "JARVIS CRM"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # Database (PostgreSQL preferred, SQLite default fallback for quick testing)
    DATABASE_URL: str = Field(
        default=f"sqlite:///{(Path(__file__).resolve().parent.parent.parent / 'jarvis_crm.db').as_posix()}",
        env="DATABASE_URL"
    )
    
    # Redis for caching and background queues
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    
    # Security / JWT
    SECRET_KEY: str = Field(
        default="jarvis-crm-super-secret-key-production-change-me-32-chars-minimum-xyz",
        env="SECRET_KEY"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*",
        "http://192.168.0.158:5173",
    ]
    
    # File Storage
    STORAGE_PROVIDER: str = Field(default="LOCAL", env="STORAGE_PROVIDER")  # LOCAL, S3, MINIO
    STORAGE_LOCAL_DIR: str = Field(default="./storage_uploads", env="STORAGE_LOCAL_DIR")
    MAX_UPLOAD_SIZE_MB: int = 50

    # SMTP / Email Service Configuration
    SMTP_HOST: Optional[str] = Field(default=None, env="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, env="SMTP_PORT")
    SMTP_USER: Optional[str] = Field(default=None, env="SMTP_USER")
    SMTP_PASSWORD: Optional[str] = Field(default=None, env="SMTP_PASSWORD")
    SMTP_TLS: bool = Field(default=True, env="SMTP_TLS")
    SMTP_SSL: bool = Field(default=False, env="SMTP_SSL")
    SMTP_TIMEOUT: int = Field(default=10, env="SMTP_TIMEOUT")
    SMTP_FROM_EMAIL: str = Field(default="notifications@jarviscrm.com", env="SMTP_FROM_EMAIL")
    SMTP_FROM_NAME: str = Field(default="JARVIS CRM", env="SMTP_FROM_NAME")
    EMAIL_PROVIDER: str = Field(default="SMTP", env="EMAIL_PROVIDER")

    # Google OAuth2 / Gmail API Configuration
    GOOGLE_CLIENT_ID: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = Field(default="http://localhost:8000/api/v1/gmail/oauth/callback", env="GOOGLE_REDIRECT_URI")
    
    class Config:
        case_sensitive = True
        env_file = str(Path(__file__).resolve().parent.parent.parent / ".env")
        extra = "ignore"


settings = Settings()
