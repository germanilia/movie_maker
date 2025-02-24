import React, { useState, useEffect } from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  HStack,
  Badge,
  useToast,
  Box,
  Spinner,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { Shot } from '../../models/models';
import ImageDisplay from '../ImageDisplay';
import { fetchSceneData, generateImage, generateVideo } from '../../services/sceneDataService';

interface VisualPreviewTabProps {
  shots: Shot[];
  activeChapterIndex: number;
  activeSceneIndex: number;
  projectName: string;
  cardBg: string;
  bgColor: string;
  borderColor: string;
}

const VisualPreviewTab: React.FC<VisualPreviewTabProps> = ({
  shots,
  activeChapterIndex,
  activeSceneIndex,
  projectName,
  cardBg,
  bgColor,
  borderColor,
}) => {
  const toast = useToast();
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [generatingVideoFor, setGeneratingVideoFor] = useState<number | null>(null);
  const [imageData, setImageData] = useState<Record<string, string>>({});
  const [videoData, setVideoData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('replicate');

  const getImageKey = (chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) =>
    `${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}-${type}`;

  const loadSceneData = async () => {
    setIsLoading(true);
    try {
      const [imageResponse, videoResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/get-scene-images/${projectName}/${activeChapterIndex + 1}/${activeSceneIndex + 1}`, { cache: 'no-store' }),
        fetch(`http://localhost:8000/api/get-scene-videos/${projectName}/${activeChapterIndex + 1}/${activeSceneIndex + 1}`, { cache: 'no-store' })
      ]);

      if (!imageResponse.ok || !videoResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [imageData, videoData] = await Promise.all([
        imageResponse.json(),
        videoResponse.json()
      ]);

      if (imageData.status === 'success' && imageData.images) {
        setImageData(imageData.images);
      }
      if (videoData.status === 'success' && videoData.videos) {
        setVideoData(videoData.videos);
      }
    } catch (error) {
      console.error('Error loading scene data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scene data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSceneData();
  }, [activeChapterIndex, activeSceneIndex, projectName]);

  const handleGenerateImage = async (
    shotIndex: number,
    type: string,
    description: string,
    referenceImage?: string,
    modelType: string = 'flux_ultra_model',
    seed: number = 333
  ) => {
    const imageKey = getImageKey(activeChapterIndex, activeSceneIndex, shotIndex, type);
    setGeneratingImages(prev => new Set(prev).add(imageKey));

    try {
      await generateImage(
        projectName,
        activeChapterIndex,
        activeSceneIndex,
        shotIndex,
        type,
        description,
        referenceImage,
        modelType,
        seed
      );
      await loadSceneData();

      toast({
        title: 'Success',
        description: 'Image generation completed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate image',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageKey);
        return newSet;
      });
    }
  };

  const handleGenerateVideo = async (shotIndex: number) => {
    if (generatingVideoFor !== null) return;
    setGeneratingVideoFor(shotIndex);

    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-shot-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: activeChapterIndex + 1,
            scene_number: activeSceneIndex + 1,
            shot_number: shotIndex + 1,
            provider: selectedModel,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      await loadSceneData();
      
      toast({
        title: 'Success',
        description: 'Shot video generated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  const handleUpdateDescription = async (
    shotIndex: number,
    type: 'opening' | 'closing',
    newDescription: string
  ) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/update-shot-description/${projectName}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: activeChapterIndex + 1,
            scene_index: activeSceneIndex + 1,
            shot_index: shotIndex + 1,
            action: type,
            description: newDescription,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update description');
      }

      toast({
        title: 'Success',
        description: 'Shot description updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating description:', error);
      toast({
        title: 'Error',
        description: 'Failed to update description',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleShotRegenerated = async (
    shotIndex: number,
    newDescription: string,
    newInstructions: string
  ) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/update-shot/${projectName}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: activeChapterIndex + 1,
            scene_index: activeSceneIndex + 1,
            shot_index: shotIndex + 1,
            opening_frame: newDescription,
            director_instructions: newInstructions,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update shot');
      }

      toast({
        title: 'Success',
        description: 'Shot updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating shot:', error);
      toast({
        title: 'Error',
        description: 'Failed to update shot',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {shots?.map((shot, shotIndex) => (
        <Card key={shotIndex} variant="outline" bg={bgColor}>
          <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
            <HStack justify="space-between">
              <Heading size="sm">Shot {shotIndex + 1}</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <ImageDisplay
                imageKey={getImageKey(activeChapterIndex, activeSceneIndex, shotIndex, 'opening')}
                imageData={imageData[getImageKey(activeChapterIndex, activeSceneIndex, shotIndex, 'opening')]}
                videoData={videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`]}
                description={shot.opening_frame || ''}
                type="opening"
                isGenerating={generatingImages.has(getImageKey(activeChapterIndex, activeSceneIndex, shotIndex, 'opening'))}
                isGeneratingVideo={generatingVideoFor === shotIndex}
                onGenerateImage={(referenceImage?: string, modelType?: string, seed?: number) => {
                  if (shot.opening_frame) {
                    handleGenerateImage(
                      shotIndex,
                      'opening',
                      shot.opening_frame,
                      referenceImage,
                      modelType,
                      seed
                    );
                  }
                }}
                onGenerateVideo={() => handleGenerateVideo(shotIndex)}
                onUpdateDescription={(newDescription) =>
                  handleUpdateDescription(shotIndex, 'opening', newDescription)
                }
                onShotRegenerated={(newDescription, newInstructions) =>
                  handleShotRegenerated(shotIndex, newDescription, newInstructions)
                }
                directorInstructions={shot.director_instructions ?? ''}
                chapterIndex={activeChapterIndex}
                sceneIndex={activeSceneIndex}
                shotIndex={shotIndex}
                projectName={projectName}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </VStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
};

export default VisualPreviewTab; 