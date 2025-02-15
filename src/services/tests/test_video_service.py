import unittest
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import asyncio

from src.services.video_service import VideoService
from src.services.aws_service import AWSService

class TestVideoService(unittest.TestCase):
    def setUp(self):
        self.aws_service = Mock(spec=AWSService)
        self.aws_service.temp_dir = "test_temp"
        self.video_service = VideoService(self.aws_service)
        
        # Create test directories
        Path("test_temp/chapter_1/scene_1/shot_1").mkdir(parents=True, exist_ok=True)
        
        # Create a test video file
        self.test_video_path = Path("test_temp/chapter_1/scene_1/shot_1/video.mp4")
        with open(self.test_video_path, "wb") as f:
            f.write(b"test video data")

    def tearDown(self):
        # Cleanup test files
        if self.test_video_path.exists():
            self.test_video_path.unlink()
        Path("test_temp/chapter_1/scene_1/shot_1").rmdir()
        Path("test_temp/chapter_1/scene_1").rmdir()
        Path("test_temp/chapter_1").rmdir()
        Path("test_temp").rmdir()

    def test_get_shot_path(self):
        path = self.video_service.get_shot_path("1", "2", "3")
        self.assertEqual(path, "chapter_1/scene_2/shot_3/video.mp4")

    def test_video_exists(self):
        self.assertTrue(self.video_service.video_exists("1", "1", "1"))
        self.assertFalse(self.video_service.video_exists("1", "1", "2"))

    @patch('runwayml.RunwayML')
    async def test_generate_video(self, mock_runway):
        # Mock RunwayML client responses
        mock_task = AsyncMock()
        mock_task.id = "test_task_id"
        mock_task.status = "SUCCEEDED"
        mock_task.output.video_url = "http://example.com/video.mp4"
        
        mock_runway.return_value.image_to_video.create = AsyncMock(return_value=mock_task)
        mock_runway.return_value.tasks.retrieve = AsyncMock(return_value=mock_task)
        mock_runway.return_value.http_client.stream = AsyncMock()

        success, path = await self.video_service.generate_video(
            prompt="Test video",
            chapter="2",
            scene="1",
            shot="1",
            opening_frame="test_image.jpg",
            poll_interval=1
        )

        self.assertTrue(success)
        self.assertTrue(str(path).endswith("video.mp4"))

    def test_get_all_videos(self):
        videos = self.video_service.get_all_videos()
        self.assertEqual(len(videos), 1)
        self.assertIn("1-1-1", videos)
        self.assertTrue(videos["1-1-1"].endswith("video.mp4"))

if __name__ == '__main__':
    asyncio.run(unittest.main())