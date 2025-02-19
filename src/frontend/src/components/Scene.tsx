import React from 'react';
import {
  Box,
  Text,
  VStack,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  useToast,
  Switch,
  AspectRatio,
} from '@chakra-ui/react';
import { Scene as SceneType, Shot, Script } from '../models/models';
import BackgroundMusic from './BackgroundMusic';
import NarrationBox from './NarrationBox';
import ImageDisplay from './ImageDisplay';
import DirectorInstructions from './DirectorInstructions';
import ShotVideo from './ShotVideo';

interface SceneProps {
  scene: SceneType;
  chapterIndex: number;
  sceneIndex: number;
  chapterNumber: number;
  projectName: string;
  script: Script;
  setScript: (script: Script) => void;
  imageData: Record<string, string>;
  narrationData: Record<string, string>;
  backgroundMusicData: Record<string, string>;
  videoData: Record<string, string>;
  generatingImages: Set<string>;
  generatingMusic: Set<string>;
  handleGenerateImage: (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: string,
    description: string,
    overwriteImage?: boolean,
    referenceImage?: string,
    modelType?: string,
    seed?: number
  ) => Promise<void>;
  handleGenerateBackgroundMusic: (chapterNumber: number, sceneNumber: number) => Promise<void>;
  handleUpdateDescription: (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing',
    newDescription: string
  ) => Promise<void>;
  getImageKey: (chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) => string;
  onVideoGenerated: () => Promise<void>;
  onScriptUpdate: (script: Script) => void;
}

const Scene: React.FC<SceneProps> = ({
  scene,
  chapterIndex,
  sceneIndex,
  chapterNumber,
  projectName,
  script,
  setScript,
  imageData,
  narrationData,
  backgroundMusicData,
  videoData,
  generatingImages,
  generatingMusic,
  handleGenerateImage,
  handleGenerateBackgroundMusic,
  handleUpdateDescription,
  getImageKey,
  onVideoGenerated,
  onScriptUpdate,
}) => {
  const renderSceneDescription = (
    shot: Shot,
    shotIndex: number,
    type: 'opening' | 'closing'
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    console.log(`Rendering scene description for key: ${imageKey}`, {
      hasImage: !!imageData[imageKey],
      imageUrl: imageData[imageKey]
    });
    const description = type === 'opening' ? shot.opening_frame : shot.closing_frame;

    return (
      <ImageDisplay
        imageKey={imageKey}
        imageData={imageData[imageKey]}
        description={description || ''}
        type={type}
        isGenerating={generatingImages.has(imageKey)}
        onGenerateImage={(referenceImage?: string, modelType?: string, seed?: number) => {
          if (description) {
            handleGenerateImage(
              chapterIndex,
              sceneIndex,
              shotIndex,
              type,
              description,
              true,
              referenceImage,
              modelType || 'flux_dev_realism',
              seed
            );
          }
        }}
        onUpdateDescription={(newDescription) =>
          handleUpdateDescription(chapterIndex, sceneIndex, shotIndex, type, newDescription)
        }
        chapterIndex={chapterIndex}
        sceneIndex={sceneIndex}
        shotIndex={shotIndex}
        projectName={projectName}
      />
    );
  };

  const areAllElementsPresent = () => {
    const hasNarration = !!narrationData[`${chapterNumber}-${scene.scene_number}`];
    const hasBackgroundMusic = !!backgroundMusicData[`${chapterNumber}-${scene.scene_number}`];
    const allShotsComplete = scene.shots?.every((shot) => {
      const shotVideoKey = `${chapterNumber}-${scene.scene_number}-${shot.shot_number}`;
      const openingImageKey = getImageKey(chapterIndex, sceneIndex, shot.shot_number - 1, 'opening');
      const closingImageKey = getImageKey(chapterIndex, sceneIndex, shot.shot_number - 1, 'closing');
      return (
        !!videoData[shotVideoKey] &&
        !!imageData[openingImageKey] &&
        !!imageData[closingImageKey]
      );
    }) ?? false;

    return hasNarration && hasBackgroundMusic && allShotsComplete;
  };

  const [isGeneratingSceneVideo, setIsGeneratingSceneVideo] = React.useState(false);
  const [isBlackAndWhite, setIsBlackAndWhite] = React.useState(false);
  const toast = useToast();
  const [isRegeneratingScene, setIsRegeneratingScene] = React.useState(false);

  const [isLoadingVideo, setIsLoadingVideo] = React.useState(false);
  const [finalSceneVideoUrl, setFinalSceneVideoUrl] = React.useState<string | null>(null);

  // Effect to fetch video URL when video data is available
  React.useEffect(() => {
    const loadVideo = async () => {
      const videoKey = `final_scene_${chapterNumber}_${scene.scene_number}`;
      if (videoData[videoKey]) {
        setIsLoadingVideo(true);
        try {
          const response = await fetch(
            `http://localhost:8000/api/get-scene-video/${projectName}/${chapterNumber}/${scene.scene_number}`,
            { cache: 'no-store' }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch video');
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setFinalSceneVideoUrl(url);
        } catch (error) {
          console.error('Error loading video:', error);
        } finally {
          setIsLoadingVideo(false);
        }
      }
    };

    loadVideo();

    return () => {
      if (finalSceneVideoUrl) {
        URL.revokeObjectURL(finalSceneVideoUrl);
      }
    };
  }, [videoData, chapterNumber, scene.scene_number, projectName]);

  // Add URL cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Cleanup any existing blob URLs when component unmounts
      Object.values(imageData).forEach(url => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      Object.values(videoData).forEach(url => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      Object.values(narrationData).forEach(url => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      Object.values(backgroundMusicData).forEach(url => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageData, videoData, narrationData, backgroundMusicData]);

  // Add debugging useEffect
  React.useEffect(() => {
    console.group('Media Data Debug');
    console.log('Image Data:', Object.keys(imageData).map(key => ({
      key,
      url: imageData[key]
    })));
    console.log('Video Data:', Object.keys(videoData).map(key => ({
      key,
      url: videoData[key]
    })));
    console.log('Narration Data:', Object.keys(narrationData).map(key => ({
      key,
      url: narrationData[key]
    })));
    console.log('Background Music Data:', Object.keys(backgroundMusicData).map(key => ({
      key,
      url: backgroundMusicData[key]
    })));
    console.groupEnd();
  }, [imageData, videoData, narrationData, backgroundMusicData]);

  const handleGenerateSceneVideo = async () => {
    setIsGeneratingSceneVideo(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-scene-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterNumber,
            scene_number: scene.scene_number,
            black_and_white: isBlackAndWhite,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate scene video');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene_${chapterNumber}_${scene.scene_number}_final.mp4`;
        document.body.appendChild(a);
        a.click();
      } finally {
        // Always cleanup the blob URL after use
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Success',
        description: 'Scene video generated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating scene video:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to generate scene video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGeneratingSceneVideo(false);
    }
  };

  const handleRegenerateScene = async () => {
    setIsRegeneratingScene(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-scene/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: chapterIndex + 1,
            scene_index: sceneIndex + 1,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate scene');
      }

      const updatedScript = await response.json();
      onScriptUpdate(updatedScript);

      toast({
        title: 'Success',
        description: 'Scene regenerated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error regenerating scene:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to regenerate scene',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRegeneratingScene(false);
    }
  };

  return (
    <AccordionItem>
      <AccordionButton>
        <Box flex="1" textAlign="left">
          <Text fontWeight="bold">Scene {scene.scene_number}</Text>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={4} align="stretch">
          {/* Final scene video display */}
          {(finalSceneVideoUrl || isLoadingVideo) && (
            <Box borderWidth="1px" borderRadius="md" p={4} bg="white">
              <Text fontWeight="bold" mb={2}>Final Scene Video</Text>
              <AspectRatio ratio={16 / 9}>
                {isLoadingVideo ? (
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Text>Loading video...</Text>
                  </Box>
                ) : (
                  <video
                    controls
                    src={finalSceneVideoUrl || undefined}
                    style={{ width: '100%', borderRadius: 'md' }}
                    preload="auto"
                    playsInline
                  >
                    <source src={finalSceneVideoUrl || undefined} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}
              </AspectRatio>
            </Box>
          )}

          <Box display="flex" alignItems="center" gap={4}>
            <Button
              colorScheme="blue"
              isLoading={isRegeneratingScene}
              loadingText="Regenerating Scene"
              onClick={handleRegenerateScene}
            >
              Regenerate Scene
            </Button>
            <Button
              colorScheme="green"
              isDisabled={!areAllElementsPresent()}
              isLoading={isGeneratingSceneVideo}
              loadingText="Generating Scene Video"
              onClick={handleGenerateSceneVideo}
            >
              Generate Scene Video
            </Button>
            <Box display="flex" alignItems="center" gap={2}>
              <Text>Black & White:</Text>
              <Switch
                isChecked={isBlackAndWhite}
                onChange={(e) => setIsBlackAndWhite(e.target.checked)}
              />
            </Box>
          </Box>

          <Box bg="gray.50" p={3} borderRadius="md">
            <Text>{scene.description}</Text>
          </Box>

          <BackgroundMusic
            backgroundMusic={scene.background_music || []}
            projectName={projectName}
            chapterNumber={chapterNumber}
            sceneNumber={scene.scene_number}
            isGenerating={generatingMusic.has(`${chapterNumber}-${scene.scene_number}`)}
            onGenerate={() => handleGenerateBackgroundMusic(chapterNumber, scene.scene_number)}
            existingMusic={backgroundMusicData[`${chapterNumber}-${scene.scene_number}`]}
          />

          <NarrationBox
            narrationText={scene.narration_text}
            projectName={projectName}
            chapterNumber={chapterNumber}
            sceneNumber={scene.scene_number}
            existingNarration={narrationData[`${chapterNumber}-${scene.scene_number}`]}
          />

          {scene.shots?.map((shot, shotIndex) => (
            <Box key={shotIndex} borderWidth="1px" borderRadius="md" p={4} bg="white">
              <VStack spacing={4} align="stretch">
                <Text fontWeight="bold">Shot {shot.shot_number}</Text>

                {shot.reasoning && (
                  <Box bg="yellow.50" p={3} borderRadius="md">
                    <Text fontWeight="bold" mb={1}>Shot Reasoning:</Text>
                    <Text color="yellow.800">{shot.reasoning}</Text>
                  </Box>
                )}

                <DirectorInstructions
                  instructions={shot.director_instructions}
                  projectName={projectName}
                  chapterIndex={chapterIndex}
                  sceneIndex={sceneIndex}
                  shotIndex={shotIndex}
                  onInstructionsUpdated={async (newInstructions) => {
                    try {
                      const response = await fetch(`http://localhost:8000/api/update-shot-description/${projectName}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          chapter_index: chapterIndex + 1,
                          scene_index: sceneIndex + 1,
                          shot_index: shotIndex + 1,
                          action: 'director_instructions',
                          description: newInstructions,
                        }),
                      });

                      if (!response.ok) {
                        throw new Error('Failed to update director instructions');
                      }

                      // Don't update the script state here, let the local state handle the update
                      return Promise.resolve();
                    } catch (error) {
                      console.error('Error updating director instructions:', error);
                      throw error;
                    }
                  }}
                />

                {shot.opening_frame && renderSceneDescription(shot, shotIndex, 'opening')}
                {shot.closing_frame && renderSceneDescription(shot, shotIndex, 'closing')}

                <ShotVideo
                  projectName={projectName}
                  chapterNumber={chapterNumber}
                  sceneNumber={scene.scene_number}
                  shotNumber={shot.shot_number}
                  shotDescription={shot.director_instructions || ''}
                  existingVideo={videoData[`${chapterNumber}-${scene.scene_number}-${shot.shot_number}`]}
                  onVideoGenerated={onVideoGenerated}
                />
              </VStack>
            </Box>
          ))}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export default Scene;