import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from src.api.main import app

client = TestClient(app)

@pytest.fixture
def mock_aws_service():
    with patch('src.api.main.AWSService') as mock:
        yield mock

@pytest.fixture
def mock_video_service():
    with patch('src.api.main.VideoService') as mock:
        yield mock

def test_generate_shot_video(mock_aws_service, mock_video_service):
    mock_video_service.return_value.generate_video = AsyncMock(return_value=(True, "test/path/video.mp4"))
    
    response = client.post(
        "/api/generate-shot-video/test_project",
        json={
            "prompt": "Test video",
            "chapter_number": 1,
            "scene_number": 2,
            "shot_number": 3,
            "opening_frame": "test_image.jpg",
        }
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["video_path"] == "test/path/video.mp4"

def test_get_video(mock_aws_service, mock_video_service):
    mock_video_service.return_value.video_exists.return_value = True
    mock_video_service.return_value.get_shot_path.return_value = "chapter_1/scene_2/shot_3/video.mp4"
    
    response = client.get(
        "/api/get-video/test_project?chapter_number=1&scene_number=2&shot_number=3"
    )
    
    assert response.status_code == 200

def test_get_video_not_found(mock_aws_service, mock_video_service):
    mock_video_service.return_value.video_exists.return_value = False
    
    response = client.get(
        "/api/get-video/test_project?chapter_number=1&scene_number=2&shot_number=3"
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "not_found"

def test_get_all_videos(mock_aws_service, mock_video_service):
    mock_videos = {
        "1-2-3": "path/to/video1.mp4",
        "2-1-1": "path/to/video2.mp4"
    }
    mock_video_service.return_value.get_all_videos.return_value = mock_videos
    
    response = client.get("/api/get-all-videos/test_project")
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["videos"] == mock_videos