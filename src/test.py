from pyht import Client
from dotenv import load_dotenv
from pyht.client import TTSOptions
import os
load_dotenv()

client = Client(
    user_id=os.getenv("PLAY_HT_USER_ID",""),
    api_key=os.getenv("PLAY_HT_API_KEY",""),
)
options = TTSOptions(voice="s3://voice-cloning-zero-shot/775ae416-49bb-4fb6-bd45-740f205d20a1/jennifersaad/manifest.json")
# Open a file to save the audio
with open("output_jenn.wav", "wb") as audio_file:
    for chunk in client.tts("Hi, I'm Jennifer from Play. How can I help you today?", options, voice_engine = 'PlayDialog'):
        # Write the audio chunk to the file
        audio_file.write(chunk)

print("Audio saved as output_jenn.wav")