from fastapi import APIRouter, HTTPException
from pathlib import Path
import os
import json
from typing import List
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ProjectList(BaseModel):
    projects: List[str]

def get_workspace_root() -> Path:
    """Get the workspace root directory."""
    current_file = Path(__file__)
    # Navigate up from src/backend/app/api to the workspace root
    return current_file.parents[4]

@router.get("/list-projects", response_model=ProjectList)
async def list_projects():
    """List all projects in the temp directory"""
    try:
        # Get the workspace root and temp directory
        workspace_root = get_workspace_root()
        temp_dir = workspace_root / "temp"
        
        logger.info(f"Looking for projects in directory: {temp_dir}")
        
        if not temp_dir.exists():
            logger.warning(f"Temp directory does not exist, creating it: {temp_dir}")
            temp_dir.mkdir(parents=True)
        
        # Get all directories in temp folder
        projects = [
            d.name for d in temp_dir.iterdir() 
            if d.is_dir() and not d.name.startswith('.')
        ]
        
        logger.info(f"Found projects: {projects}")
        return {"projects": sorted(projects)}
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-script/{project_name}")
async def get_script(project_name: str):
    """Get the script for a specific project"""
    try:
        # Get the workspace root and script path
        workspace_root = get_workspace_root()
        script_path = workspace_root / "temp" / project_name / "script.json"
        
        logger.info(f"Looking for script at: {script_path}")
        
        if not script_path.exists():
            logger.warning(f"Script not found at: {script_path}")
            raise HTTPException(status_code=404, detail="Script not found")
        
        with open(script_path, "r") as f:
            script = json.load(f)
        
        return script
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error getting script: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 