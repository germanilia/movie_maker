import React, { useState, useRef } from 'react';
import { Script, NarrationResponse, Chapter, Scene, Shot } from '../models/models';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  UnorderedList,
  ListItem,
  useToast,
} from '@chakra-ui/react';
import ImageDisplay from './ImageDisplay';
import NarrationBox from './NarrationBox';
import BackgroundMusic from './BackgroundMusic';

interface ScriptReviewProps {
  script: Script | null;
  setScript: (script: Script | null) => void;
  onNext: () => void;
  onBack: () => void;
  projectName: string;
}

interface ImageApiResponse {
  status: string;
  images: Record<string, string>;
}

interface NarrationApiResponse {
  status: string;
  narrations: Record<string, string>; // key is chapter-scene, value is base64 audio
}

const ScriptReview: React.FC<ScriptReviewProps> = ({
  script,
  setScript,
  onNext,
  onBack,
  projectName
}) => {
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [imageData, setImageData] = useState<Record<string, string>>({});
  const [narrationData, setNarrationData] = useState<Record<string, string>>({});
  const [existingNarrations, setExistingNarrations] = useState<Record<string, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState<Set<string>>(new Set());
  const [isGeneratingAllMusic, setIsGeneratingAllMusic] = useState(false);
  const toast = useToast();
  const isMounted = useRef(true);

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getImageKey = React.useCallback((chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) =>
    `${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}-${type}`,
    []
  );

  // Effect to fetch all images when script changes
  React.useEffect(() => {
    isMounted.current = true;

    const fetchAllData = async () => {
      try {
        // Fetch images
        const imageResponse = await fetch(
          `http://localhost:8000/api/get-all-images/${projectName}`
        );

        if (!imageResponse.ok || !isMounted.current) return;

        const imageData = await imageResponse.json() as ImageApiResponse;

        if (imageData.status === 'success' && imageData.images && isMounted.current) {
          const processedImages: Record<string, string> = {};
          Object.entries(imageData.images).forEach(([key, base64]) => {
            // Backend now returns full data URL, so we don't need to add the prefix
            processedImages[key] = base64;
          });
          setImageData(processedImages);
        }

        // Fetch narrations
        const narrResponse = await fetch(
          `http://localhost:8000/api/get-all-narrations/${projectName}`
        );

        if (!narrResponse.ok || !isMounted.current) return;

        const narrData = await narrResponse.json() as NarrationApiResponse;
        
        if (narrData.status === 'success' && narrData.narrations && isMounted.current) {
          setNarrationData(narrData.narrations);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    if (script) {
      fetchAllData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [script, projectName, toast]);

  const handleGenerateImage = async (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: string,
    description: string,
    overwriteImage: boolean = true  // Add default parameter
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    setGeneratingImages(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(imageKey);
      return newSet;
    });

    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-image/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: chapterIndex + 1,
            scene_index: sceneIndex + 1,
            shot_index: shotIndex + 1,
            type: type,
            custom_prompt: description,
            overwrite_image: overwriteImage  // Add the new parameter
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();

      if (data.status === 'success' && data.base64_image) {
        // Update the image data with the new base64 image
        setImageData(prev => ({
          ...prev,
          [imageKey]: data.base64_image
        }));

        toast({
          title: 'Success',
          description: 'Image generation completed',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(data.message || 'Failed to generate image');
      }

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
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
    }
  };

  const handleGenerateBackgroundMusic = async (chapterNumber: number, sceneNumber: number) => {
    const musicKey = `${chapterNumber}-${sceneNumber}`;
    setGeneratingMusic(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(musicKey);
      return newSet;
    });

    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-background-music/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterNumber,
            scene_number: sceneNumber,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate background music');
      }

      toast({
        title: 'Success',
        description: `Generated background music for Chapter ${chapterNumber}, Scene ${sceneNumber}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating background music:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate background music',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingMusic(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(musicKey);
        return newSet;
      });
    }
  };

  const handleGenerateAllMusic = async () => {
    if (!script) return;
    setIsGeneratingAllMusic(true);

    try {
      for (const chapter of script.chapters || []) {
        if (!isMounted.current) break;
        
        for (const scene of chapter.scenes || []) {
          if (!isMounted.current) break;
          await handleGenerateBackgroundMusic(chapter.chapter_number, scene.scene_number);
        }
      }

      toast({
        title: 'Success',
        description: 'All background music has been generated',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating all background music:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate all background music',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGeneratingAllMusic(false);
    }
  };

  const getAllPendingImages = () => {
    if (!script) return [];
    
    const pendingImages: { 
      chapterIndex: number; 
      sceneIndex: number; 
      shotIndex: number; 
      type: string; 
      description: string; 
    }[] = [];

    script.chapters.forEach((chapter, chapterIndex) => {
      chapter.scenes?.forEach((scene, sceneIndex) => {
        scene.shots?.forEach((shot, shotIndex) => {
          if (shot.opening_frame) {
            pendingImages.push({
              chapterIndex,
              sceneIndex,
              shotIndex,
              type: 'opening',
              description: shot.opening_frame
            });
          }
          if (shot.closing_frame) {
            pendingImages.push({
              chapterIndex,
              sceneIndex,
              shotIndex,
              type: 'closing',
              description: shot.closing_frame
            });
          }
        });
      });
    });

    return pendingImages;
  };

  const handleGenerateAll = async () => {
    const pendingImages = getAllPendingImages();
    setIsGeneratingAll(true);

    try {
      for (const img of pendingImages) {
        if (!isMounted.current) break;
        
        await handleGenerateImage(
          img.chapterIndex,
          img.sceneIndex,
          img.shotIndex,
          img.type,
          img.description,
          false  // Set overwrite_image to false for batch generation
        );
      }

      toast({
        title: 'Success',
        description: 'All images have been generated',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating all images:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate all images',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  if (!script) {
    return (
      <Box p={4}>
        <Text>No script available. Please go back and generate a script first.</Text>
        <Button onClick={onBack}>Back</Button>
      </Box>
    );
  }

  const renderSceneDescription = (
    shot: Shot,
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing'
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    const description = type === 'opening' ? shot.opening_frame : shot.closing_frame;

    return (
      <ImageDisplay
        imageKey={imageKey}
        imageData={imageData[imageKey]}
        description={description || ''}
        type={type}
        isGenerating={generatingImages.has(imageKey)}
        onGenerateImage={() => {
          if (description) {
            handleGenerateImage(
              chapterIndex,
              sceneIndex,
              shotIndex,
              type,
              description,
              true  // Set overwrite_image to true for single image generation
            );
          }
        }}
      />
    );
  };

  return (
    <Box height="100vh" overflow="hidden" position="relative">
      {/* Top Navigation Bar */}
      <Box
        p={4}
        borderBottomWidth={1}
        bg="white"
        position="sticky"
        top={0}
        zIndex={3}
        height="72px"
      >
        <HStack justify="space-between" align="center">
          <Heading size="lg">Script Review</Heading>
          <HStack spacing={4}>
            <Button 
              colorScheme="teal"
              onClick={handleGenerateAll}
              isLoading={isGeneratingAll}
              loadingText="Generating All"
              isDisabled={generatingImages.size > 0}
            >
              Generate All Images
            </Button>
            <Button 
              colorScheme="orange"
              onClick={handleGenerateAllMusic}
              isLoading={isGeneratingAllMusic}
              loadingText="Generating All Music"
              isDisabled={generatingMusic.size > 0}
            >
              Generate All Music
            </Button>
            <Button onClick={onBack}>Back</Button>
            <Button colorScheme="blue" onClick={onNext}>
              Next
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box height="calc(100vh - 72px)" overflow="auto" p={4}>
        <Accordion defaultIndex={[0]} allowMultiple>
          {(script?.chapters || []).map((chapter, chapterIndex) => (
            <AccordionItem key={chapterIndex}>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Text fontWeight="bold">
                    Chapter {chapter.chapter_number}: {chapter.title}
                  </Text>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4}>
                <VStack spacing={4} align="stretch">
                  {/* Chapter Description */}
                  <Box bg="gray.50" p={3} borderRadius="md">
                    <Text>{chapter.description}</Text>
                  </Box>

                  <Accordion defaultIndex={[]} allowMultiple>
                    {(chapter.scenes || []).map((scene, sceneIndex) => (
                      <AccordionItem key={sceneIndex}>
                        <AccordionButton>
                          <Box flex="1" textAlign="left">
                            <Text fontWeight="bold">
                              Scene {scene.scene_number}
                            </Text>
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel pb={4}>
                          <VStack spacing={4} align="stretch">
                            {/* Scene Description */}
                            <Box bg="gray.50" p={3} borderRadius="md">
                              <Text>{scene.description}</Text>
                            </Box>

                            {/* Background Music */}
                            <BackgroundMusic 
                              backgroundMusic={scene.background_music || []} 
                              projectName={projectName}
                              chapterNumber={chapter.chapter_number}
                              sceneNumber={scene.scene_number}
                              isGenerating={generatingMusic.has(`${chapter.chapter_number}-${scene.scene_number}`)}
                              onGenerate={() => handleGenerateBackgroundMusic(chapter.chapter_number, scene.scene_number)}
                            />

                            {/* Narration */}
                            <NarrationBox 
                              narrationText={scene.narration}
                              projectName={projectName}
                              chapterNumber={chapter.chapter_number}
                              sceneNumber={scene.scene_number}
                              existingNarration={narrationData[`${chapter.chapter_number}-${scene.scene_number}`]}
                            />

                            {/* Shots */}
                            {scene.shots?.map((shot, shotIndex) => (
                              <Box
                                key={shotIndex}
                                borderWidth="1px"
                                borderRadius="md"
                                p={4}
                                bg="white"
                              >
                                <VStack spacing={4} align="stretch">
                                  <Heading size="xs">Shot {shot.shot_number}</Heading>

                                  {/* Shot Reasoning */}
                                  {shot.reasoning && (
                                    <Box bg="yellow.50" p={3} borderRadius="md">
                                      <Text fontWeight="bold" mb={1}>Shot Reasoning:</Text>
                                      <Text color="yellow.800">{shot.reasoning}</Text>
                                    </Box>
                                  )}

                                  {/* Director Instructions */}
                                  <Box bg="blue.50" p={3} borderRadius="md">
                                    <Text fontWeight="bold" mb={1}>Director Instructions:</Text>
                                    <Text color="blue.800">{shot.director_instructions || 'No director instructions available'}</Text>
                                  </Box>

                                  {/* Opening Frame Description */}
                                  {shot.opening_frame &&
                                    renderSceneDescription(shot, chapterIndex, sceneIndex, shotIndex, 'opening')}

                                  {/* Closing Frame Description */}
                                  {shot.closing_frame &&
                                    renderSceneDescription(shot, chapterIndex, sceneIndex, shotIndex, 'closing')}
                                </VStack>
                              </Box>
                            ))}
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </Box>
    </Box>
  );
};

export default ScriptReview;
