interface SceneData {
  images: Record<string, string>;
  videos: Record<string, string>;
  narration: Record<string, string>;
  backgroundMusic: Record<string, string>;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: RequestInit, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying fetch (${retries} attempts left) after ${delay}ms...`);
      await sleep(delay);
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const fetchSceneData = async (
  projectName: string,
  chapterIndex: number,
  sceneIndex: number
): Promise<SceneData> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased to 60 second timeout

    // Add timestamp to URLs to prevent caching
    const timestamp = Date.now();
    const baseUrl = `/api`;

    const requestInit: RequestInit = {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    };

    try {
      // Fetch all data in parallel using retry logic
      const [imagesResponse, videosResponse, narrationsResponse, musicResponse] = await Promise.all([
        fetchWithRetry(`${baseUrl}/get-scene-images/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, requestInit),
        fetchWithRetry(`${baseUrl}/get-scene-videos/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, requestInit),
        fetchWithRetry(`${baseUrl}/get-scene-narrations/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, requestInit),
        fetchWithRetry(`${baseUrl}/get-scene-background-music/${projectName}/${chapterIndex + 1}/${sceneIndex + 1}?t=${timestamp}`, requestInit)
      ]).finally(() => clearTimeout(timeoutId));

      // Parse all responses
      const [imagesData, videosData, narrationsData, musicData] = await Promise.all([
        imagesResponse.json(),
        videosResponse.json(),
        narrationsResponse.json(),
        musicResponse.json()
      ]);

      // Check for error status in responses
      const responses = [
        { name: 'images', data: imagesData },
        { name: 'videos', data: videosData },
        { name: 'narrations', data: narrationsData },
        { name: 'background music', data: musicData }
      ];

      const failedResponses = responses.filter(r => r.data.status === 'error');
      if (failedResponses.length > 0) {
        const errors = failedResponses.map(r => `${r.name}: ${r.data.message}`).join(', ');
        throw new Error(`Failed to fetch data: ${errors}`);
      }

      return {
        images: imagesData.images || {},
        videos: videosData.videos || {},
        narration: narrationsData.narrations || {},
        backgroundMusic: musicData.background_music || {},
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Request timeout fetching scene data');
          throw new Error('Request timeout fetching scene data');
        }
        throw error;
      }
      throw new Error('An unknown error occurred while fetching scene data');
    }
  } catch (error) {
    console.error('Error fetching scene data:', error);
    throw error;
  }
};

export const generateVideo = async (
  projectName: string,
  chapterIndex: number,
  sceneIndex: number,
  shotIndex: number,
  modelType: string = 'default_model',
  blackAndWhite: boolean = false
): Promise<void> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 minute timeout for generation request

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
          black_and_white: blackAndWhite,
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