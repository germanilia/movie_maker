from models.models import ProjectDetails
import yaml

def read_video_request(yaml_file: str) -> ProjectDetails:
    """
    Read and parse a video request from a YAML file into a ProjectDetails object.
    
    Args:
        yaml_file (str): Path to the YAML file containing the video request
        
    Returns:
        ProjectDetails: Parsed video request object
    """
    with open(yaml_file, 'r') as f:
        yaml_data = yaml.safe_load(f)
    return ProjectDetails(**yaml_data)