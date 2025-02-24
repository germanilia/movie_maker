interface SceneData {
  images: Record<string, string>;
  videos: Record<string, string>;
  narration: Record<string, string>;
  backgroundMusic: Record<string, string>;
}

export const fetchSceneData = async (
  projectName: string,
  chapterIndex: number,
  sceneIndex: number
): Promise<SceneData> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Add timestamp to URLs to prevent caching
    const timestamp = Date.now();
    const baseUrl = `http://localhost:8000/api`;

    // Fetch all data in parallel using the existing endpoints
    const [imagesResponse, videosResponse, narrationsResponse, musicResponse] = await Promise.all([
      fetch(`${baseUrl}/get-scene-images/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, { 
        signal: controller.signal 
      }),
      fetch(`${baseUrl}/get-scene-videos/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, { 
        signal: controller.signal 
      }),
      fetch(`${baseUrl}/get-scene-narrations/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, { 
        signal: controller.signal 
      }),
      fetch(`${baseUrl}/get-scene-background-music/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, { 
        signal: controller.signal 
      })
    ]).finally(() => clearTimeout(timeoutId));

    // Check if any request failed
    if (!imagesResponse.ok || !videosResponse.ok || !narrationsResponse.ok || !musicResponse.ok) {
      const failedEndpoints = [];
      if (!imagesResponse.ok) failedEndpoints.push('images');
      if (!videosResponse.ok) failedEndpoints.push('videos');
      if (!narrationsResponse.ok) failedEndpoints.push('narrations');
      if (!musicResponse.ok) failedEndpoints.push('background music');
      
      throw new Error(`Failed to fetch: ${failedEndpoints.join(', ')}`);
    }

    // Parse all responses
    const [imagesData, videosData, narrationsData, musicData] = await Promise.all([
      imagesResponse.json(),
      videosResponse.json(),
      narrationsResponse.json(),
      musicResponse.json()
    ]);

    return {
      images: imagesData.images || {},
      videos: videosData.videos || {},
      narration: narrationsData.narrations || {},
      backgroundMusic: musicData.background_music || {},
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timeout fetching scene data');
      throw new Error('Request timeout fetching scene data');
    }
    console.error('Error fetching scene data:', error);
    throw error;
  }
};

export const generateVideo = async (
  projectName: string,
  chapterIndex: number,
  sceneIndex: number,
  shotIndex: number,
  modelType: string = 'default_model'
): Promise<void> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for generation request

    const response = await fetch(
      `http://localhost:8000/api/generate-shot-video/${projectName}?t=${Date.now()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chapter_number: chapterIndex + 1,
          scene_number: sceneIndex + 1,
          shot_number: shotIndex + 1,
          model_type: modelType,
        }),
        signal: controller.signal
      }
    ).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.detail || 
        `Failed to generate video: ${response.status} ${response.statusText}`
      );
    }

    // Wait a short delay before returning to allow backend processing
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Video generation request timed out');
      }
      throw error;
    }
    throw new Error('An unknown error occurred while generating video');
  }
};

export const generateImage = async (
  projectName: string,
  chapterIndex: number,
  sceneIndex: number,
  shotIndex: number,
  type: string,
  description: string,
  referenceImage?: string,
  modelType: string = 'flux_ultra_model',
  seed: number = 333
): Promise<void> => {
  try {
    const response = await fetch(
      `http://localhost:8000/api/regenerate-image/${projectName}?t=${Date.now()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chapter_index: chapterIndex + 1,
          scene_index: sceneIndex + 1,
          shot_index: shotIndex + 1,
          type,
          custom_prompt: description,
          overwrite_image: true,
          model_type: modelType,
          reference_image: referenceImage,
          seed,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate image');
    }
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}; 