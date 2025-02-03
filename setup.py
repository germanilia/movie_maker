from setuptools import setup, find_packages

setup(
    name="video_creator",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "boto3",
        "python-dotenv",
        "runwayml",
        "pyht",
        "aiohttp",
    ],
) 