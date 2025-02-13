import React, { useState } from 'react';
import { Script, NarrationResponse } from '../models/models';
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
  const toast = useToast();
  const isMounted = React.useRef(false);

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
          (Object.entries(imageData.images) as [string, string][]).forEach(([key, base64]) => {
            processedImages[key] = `data:image/png;base64,${base64}`;
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
    description: string
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
            custom_prompt: description
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();

      // Store the base64 image data
      setImageData(prev => ({
        ...prev,
        [imageKey]: `data:image/png;base64,${data.base64_image}`
      }));

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
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
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
    shot: any,
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing'
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    const description = type === 'opening' ? shot.detailed_opening_scene_description : shot.detailed_closing_scene_description;

    return (
      <ImageDisplay
        imageKey={imageKey}
        imageData={imageData[imageKey]}
        description={description}
        type={type}
        isGenerating={generatingImages.has(imageKey)}
        onGenerateImage={() => {
          if (description) {
            handleGenerateImage(
              chapterIndex,
              sceneIndex,
              shotIndex,
              type,
              description
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
            <Button onClick={onBack}>Back</Button>
            <Button colorScheme="blue" onClick={onNext}>
              Next
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box
        position="relative"
        height="calc(100vh - 72px)"
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
        }}
      >
        <Box p={4} pb={32}>
          <Accordion allowMultiple defaultIndex={[]}>
            {script.chapters.map((chapter, chapterIndex) => (
              <AccordionItem key={chapterIndex}>
                <AccordionButton py={4}>
                  <HStack flex="1" justify="space-between">
                    <Heading size="md">
                      Chapter {chapter.chapter_number}: {chapter.chapter_title}
                    </Heading>
                    <AccordionIcon />
                  </HStack>
                </AccordionButton>

                <AccordionPanel pb={6}>
                  <VStack spacing={6} align="stretch">
                    <Box bg="gray.50" p={4} borderRadius="md">
                      <Text color="gray.700">{chapter.chapter_description}</Text>
                    </Box>

                    <Accordion allowMultiple defaultIndex={[]}>
                      {chapter.scenes?.map((scene, sceneIndex) => (
                        <AccordionItem
                          key={sceneIndex}
                          border="1px solid"
                          borderColor="gray.200"
                          borderRadius="lg"
                          mb={4}
                        >
                          <AccordionButton py={3}>
                            <HStack flex="1" justify="space-between">
                              <Heading size="sm">Scene {scene.scene_number}</Heading>
                              <AccordionIcon />
                            </HStack>
                          </AccordionButton>

                          <AccordionPanel pb={4}>
                            <VStack align="stretch" spacing={6}>
                              {/* Scene Info */}
                              <Box bg="blue.50" p={4} borderRadius="md">
                                <Text fontWeight="bold" mb={2}>Main Story:</Text>
                                {Array.isArray(scene.main_story) ? (
                                  <UnorderedList>
                                    {scene.main_story.map((story, idx) => (
                                      <ListItem key={idx} color="blue.800">{story}</ListItem>
                                    ))}
                                  </UnorderedList>
                                ) : (
                                  <Text color="blue.800">{scene.main_story}</Text>
                                )}
                              </Box>

                              {/* Scene Reasoning */}
                              {scene.reasoning && (
                                <Box bg="green.50" p={4} borderRadius="md">
                                  <Text fontWeight="bold" mb={2}>Scene Reasoning:</Text>
                                  <Text color="green.800">{scene.reasoning}</Text>
                                </Box>
                              )}

                              {/* Narration */}
                              <NarrationBox 
                                narrationText={scene.narration_text} 
                                projectName={projectName} 
                                chapter={chapter.chapter_number} 
                                scene={scene.scene_number}
                                audioData={narrationData[`${chapter.chapter_number}-${scene.scene_number}`]}
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

                                    {/* Opening Scene Description */}
                                    {shot.detailed_opening_scene_description &&
                                      renderSceneDescription(shot, chapterIndex, sceneIndex, shotIndex, 'opening')}

                                    {/* Closing Scene Description */}
                                    {shot.detailed_closing_scene_description &&
                                      renderSceneDescription(shot, chapterIndex, sceneIndex, shotIndex, 'closing')}

                                    {/* Sound Effects */}
                                    {shot.sound_effects && (
                                      <Box bg="orange.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Sound Effects:</Text>
                                        {Array.isArray(shot.sound_effects) ? (
                                          <UnorderedList>
                                            {shot.sound_effects.map((effect, idx) => (
                                              <ListItem key={idx} color="orange.800">{effect}</ListItem>
                                            ))}
                                          </UnorderedList>
                                        ) : (
                                          <Text color="orange.800">{shot.sound_effects}</Text>
                                        )}
                                      </Box>
                                    )}
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
    </Box>
  );
};

export default ScriptReview;
