from pydantic import BaseModel

class ImageRequest(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_path: str
