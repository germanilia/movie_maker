from models.models import VideoRequest
import yaml

def read_video_request(yaml_file: str) -> VideoRequest:
    """
    Read and parse a video request from a YAML file into a VideoRequest object.
    
    Args:
        yaml_file (str): Path to the YAML file containing the video request
        
    Returns:
        VideoRequest: Parsed video request object
    """
    with open(yaml_file, 'r') as f:
        yaml_data = yaml.safe_load(f)
    return VideoRequest(**yaml_data)