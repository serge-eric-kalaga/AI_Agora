from pydantic import BaseModel, Field
from typing import Optional, List
from .response import Response


class LoginModel(BaseModel):
    username: str
    password: str


class LoginResponseModel(BaseModel):
    username: str
    token: str


class LoginResponse(Response):
    data: LoginResponseModel


class UserModel(BaseModel):
    username: str = Field(..., json_schema_extra={"include": "true"})
    telephone: Optional[str] = None


class CreateUserModel(UserModel):
    password: Optional[str]
    pass


class UpdateUserModel(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    telephone: Optional[str] = None


class UserResponseModel(Response):
    data: UserModel


class UserResponseListModel(Response):
    data: List[UserModel]
