import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Image,
  Text,
  Spinner,
  Center,
  IconButton,
  Textarea,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useToast,
  SimpleGrid,
  UnorderedList,
  ListItem,
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon } from '@chakra-ui/icons';
import { Script } from '../models/models';

interface ImageReviewProps {
  images: any[];
  setImages: (images: any[]) => void;
  projectName: string;
  onNext: () => void;
  onBack: () => void;
}

const SCRIPT_STORAGE_KEY = 'current_script';

const ImageReview: React.FC<ImageReviewProps> = ({
  images,
  setImages,
  projectName,
  onNext,
  onBack,
}) => {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(new Set());
  const [disabledButtons, setDisabledButtons] = useState<Set<string>>(new Set());
  const [script, setScript] = useState<Script | null>(null);
  const [imageVersions, setImageVersions] = useState<Record<string, number>>({});
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const toast = useToast();

  const getImageUrl = (image: any) => {
    if (!image || !image.url) return '';
    const version = imageVersions[getImageKey(image)] || 0;
    return `${image.url}?v=${version}`;
  };

  const fetchImages = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/images/${projectName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      console.log('Fetched images:', data); // Debug log
      setImages(data);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch images',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [projectName, setImages, toast]);

  useEffect(() => {
    // Initial fetch of images when component mounts
    fetchImages();
  }, [projectName, fetchImages]); // Add fetchImages to dependencies

  useEffect(() => {
    const storedScript = localStorage.getItem(SCRIPT_STORAGE_KEY);
    if (storedScript) {
      setScript(JSON.parse(storedScript));
    }
  }, []);

  const getImageKey = (image: any) => 
    `${image.chapter_index}-${image.scene_index}-${image.shot_index}-${image.type}`;

  const findImages = (chapterIndex: number, sceneIndex: number, shotIndex: number) => {
    return images.filter(
      img => 
        img.chapter_index === chapterIndex + 1 &&
        img.scene_index === sceneIndex + 1 &&
        img.shot_index === shotIndex + 1
    );
  };

  const handleRegenerateImage = async (
    chapterIndex: number, 
    sceneIndex: number, 
    shotIndex: number,
    type: string,
    description: string
  ) => {
    const imageKey = `${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}-${type}`;
    
    setDisabledButtons(prev => new Set([...Array.from(prev), imageKey]));
    setRegeneratingImages(prev => new Set([...Array.from(prev), imageKey]));

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
        throw new Error('Failed to regenerate image');
      }

      toast({
        title: 'Regeneration started',
        description: 'Image regeneration in progress',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });

      // Wait for 30 seconds
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Fetch new images and increment version
      await fetchImages();
      setImageVersions(prev => ({
        ...prev,
        [imageKey]: (prev[imageKey] || 0) + 1
      }));

    } catch (error) {
      console.error('Error regenerating image:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate image',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDisabledButtons(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
      setRegeneratingImages(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
    }
  };

  const handlePromptChange = async (image: any, newPrompt: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/update-shot-description/${projectName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapter_index: image.chapter_index,
          scene_index: image.scene_index,
          shot_index: image.shot_index,
          description: newPrompt,
          action: image.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update shot description');
      }

      // Get the updated script from the response
      const updatedScript = await response.json();
      
      // Update both the script in state and localStorage
      setScript(updatedScript);
      localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(updatedScript));

      // Update the images state
      setImages(images.map((img: any) => {
        if (
          img.chapter_index === image.chapter_index &&
          img.scene_index === image.scene_index &&
          img.shot_index === image.shot_index &&
          img.type === image.type
        ) {
          return { ...img, description: newPrompt };
        }
        return img;
      }));

      setSelectedImage(null);
      setEditingPrompt(null);

    } catch (error) {
      console.error('Error updating shot description:', error);
      toast({
        title: 'Error',
        description: 'Failed to update shot description',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleRegenerateAll = async () => {
    setIsRegeneratingAll(true);
    const imageKeys = images.map(img => getImageKey(img));
    
    try {
      // Create an array of promises for all image regenerations
      const regenerationPromises = images.map(async (img) => {
        const response = await fetch(
          `http://localhost:8000/api/regenerate-image/${projectName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chapter_index: img.chapter_index,
              scene_index: img.scene_index,
              shot_index: img.shot_index,
              type: img.type,
              custom_prompt: img.description
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to regenerate image ${getImageKey(img)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
      });

      // Wait for all regenerations to complete
      await Promise.all(regenerationPromises);
      
      // Fetch all updated images
      await fetchImages();

      // Update versions for all images
      const newVersions = { ...imageVersions };
      imageKeys.forEach(key => {
        newVersions[key] = (newVersions[key] || 0) + 1;
      });
      setImageVersions(newVersions);

      toast({
        title: 'Success',
        description: 'All images have been regenerated',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error regenerating all images:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate all images',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  const renderImage = (image: any, shot: any, type: string) => {
    const isGenerating = regeneratingImages.has(getImageKey(image));
    const isMissing = image.status === 'pending';
    
    return (
      <Box position="relative">
        {isMissing ? (
          <Center h="200px" borderWidth="1px" borderRadius="md" bg="gray.50">
            <VStack>
              <Text color="gray.500">Image not yet generated</Text>
              <Text fontSize="sm" color="gray.400">Use regenerate to create image</Text>
            </VStack>
          </Center>
        ) : (
          <Image 
            src={getImageUrl(image)}
            alt={`${type} Shot ${shot.shot_number}`}
            maxH="300px"
            objectFit="contain"
            w="100%"
            fallback={
              <Center h="200px" borderWidth="1px" borderRadius="md">
                <VStack>
                  <Text color="red.500">Failed to load image</Text>
                  <Text fontSize="sm">Please try regenerating</Text>
                </VStack>
              </Center>
            }
          />
        )}
        {isGenerating && (
          <Center position="absolute" inset={0} bg="blackAlpha.600">
            <VStack>
              <Spinner color="white" />
              <Text color="white">Regenerating...</Text>
            </VStack>
          </Center>
        )}
      </Box>
    );
  };

  if (!script) {
    return (
      <Center h="100vh">
        <VStack spacing={4}>
          <Spinner />
          <Text>Loading script data...</Text>
        </VStack>
      </Center>
    );
  }

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
          <Heading size="lg">Final Review</Heading>
          <HStack spacing={4}>
            <Button
              leftIcon={<RepeatIcon />}
              onClick={handleRegenerateAll}
              isLoading={isRegeneratingAll}
              loadingText="Regenerating All"
              colorScheme="purple"
            >
              Regenerate All Images
            </Button>
            <Button onClick={onBack}>Back</Button>
            <Button colorScheme="blue" onClick={onNext}>
              Generate Video
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
        <Box p={4} pb={32}> {/* Increased bottom padding */}
          <Accordion allowMultiple defaultIndex={[]}>
            {script.chapters.map((chapter: any, chapterIndex: number) => (
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
                      {chapter.scenes.map((scene: any, sceneIndex: number) => (
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
                                    {scene.main_story.map((story: string, idx: number) => (
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
                              <Box bg="purple.50" p={4} borderRadius="md">
                                <Text fontWeight="bold" mb={2}>Narration:</Text>
                                <Text color="purple.800">{scene.narration_text}</Text>
                              </Box>

                              {/* Shots List */}
                              {scene.shots && scene.shots.map((shot: any, shotIndex: number) => {
                                const shotImages = findImages(chapterIndex, sceneIndex, shotIndex);
                                const openingImage = shotImages.find(img => img.type === 'opening');
                                const closingImage = shotImages.find(img => img.type === 'closing');

                                if (!openingImage && !closingImage) return null;

                                return (
                                  <Box 
                                    key={shotIndex} 
                                    borderWidth="1px" 
                                    borderRadius="md" 
                                    p={4}
                                    width="100%"
                                    bg="white"
                                  >
                                    <VStack spacing={6}>
                                      {/* Shot Reasoning */}
                                      {shot.reasoning && (
                                        <Box width="100%" bg="yellow.50" p={3} borderRadius="md">
                                          <Text fontWeight="bold" mb={1}>Shot Reasoning:</Text>
                                          <Text color="yellow.800">{shot.reasoning}</Text>
                                        </Box>
                                      )}

                                      {/* Director Instructions - Once per shot */}
                                      <Box width="100%" bg="blue.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Director Instructions:</Text>
                                        <Text color="blue.800">{shot.director_instructions || 'No director instructions available'}</Text>
                                      </Box>

                                      {/* Sound Effects */}
                                      {shot.sound_effects && (
                                        <Box width="100%" bg="orange.50" p={3} borderRadius="md">
                                          <Text fontWeight="bold" mb={1}>Sound Effects:</Text>
                                          {Array.isArray(shot.sound_effects) ? (
                                            <UnorderedList>
                                              {shot.sound_effects.map((effect: string, idx: number) => (
                                                <ListItem key={idx} color="orange.800">{effect}</ListItem>
                                              ))}
                                            </UnorderedList>
                                          ) : (
                                            <Text color="orange.800">{shot.sound_effects}</Text>
                                          )}
                                        </Box>
                                      )}

                                      {/* Opening Image */}
                                      {openingImage && (
                                        <Box width="100%">
                                          <Heading size="xs" mb={4}>Opening Shot {shot.shot_number}</Heading>
                                          <SimpleGrid columns={2} spacing={6}>
                                            <Box>
                                              {renderImage(openingImage, shot, 'Opening')}
                                            </Box>

                                            <VStack align="stretch" spacing={4}>
                                              <Box>
                                                <Text fontSize="sm" fontWeight="bold" color="gray.700" mb={2}>
                                                  Opening Shot Description:
                                                </Text>
                                                <Text fontSize="sm" color="gray.600">
                                                  {selectedImage === openingImage 
                                                    ? editingPrompt 
                                                    : shot.detailed_opening_scene_description}
                                                </Text>
                                              </Box>

                                              <HStack>
                                                <IconButton
                                                  aria-label="Regenerate image"
                                                  icon={<RepeatIcon />}
                                                  onClick={() => handleRegenerateImage(
                                                    chapterIndex,
                                                    sceneIndex,
                                                    shotIndex,
                                                    'opening',
                                                    shot.detailed_opening_scene_description
                                                  )}
                                                  isDisabled={
                                                    regeneratingImages.has(getImageKey(openingImage)) ||
                                                    disabledButtons.has(getImageKey(openingImage))
                                                  }
                                                />
                                                <IconButton
                                                  aria-label="Edit prompt"
                                                  icon={<EditIcon />}
                                                  onClick={() => {
                                                    setSelectedImage(openingImage);
                                                    setEditingPrompt(openingImage.description);
                                                  }}
                                                  isDisabled={
                                                    regeneratingImages.has(getImageKey(openingImage)) ||
                                                    disabledButtons.has(getImageKey(openingImage))
                                                  }
                                                />
                                              </HStack>

                                              {selectedImage === openingImage && (
                                                <VStack spacing={2}>
                                                  <Textarea
                                                    value={editingPrompt ?? openingImage.description}
                                                    onChange={(e) => setEditingPrompt(e.target.value)}
                                                  />
                                                  <Button
                                                    size="sm"
                                                    onClick={() => handlePromptChange(openingImage, editingPrompt || openingImage.description)}
                                                  >
                                                    Update Prompt
                                                  </Button>
                                                </VStack>
                                              )}
                                            </VStack>
                                          </SimpleGrid>
                                        </Box>
                                      )}

                                      {/* Closing Image */}
                                      {closingImage && (
                                        <Box width="100%">
                                          <Heading size="xs" mb={4}>Closing Shot {shot.shot_number}</Heading>
                                          <SimpleGrid columns={2} spacing={6}>
                                            <Box>
                                              {renderImage(closingImage, shot, 'Closing')}
                                            </Box>

                                            <VStack align="stretch" spacing={4}>
                                              <Box>
                                                <Text fontSize="sm" fontWeight="bold" color="gray.700" mb={2}>
                                                  Closing Shot Description:
                                                </Text>
                                                <Text fontSize="sm" color="gray.600">
                                                  {selectedImage === closingImage 
                                                    ? editingPrompt 
                                                    : shot.detailed_closing_scene_description}
                                                </Text>
                                              </Box>

                                              <HStack>
                                                <IconButton
                                                  aria-label="Regenerate image"
                                                  icon={<RepeatIcon />}
                                                  onClick={() => handleRegenerateImage(
                                                    chapterIndex,
                                                    sceneIndex,
                                                    shotIndex,
                                                    'closing',
                                                    shot.detailed_closing_scene_description
                                                  )}
                                                  isDisabled={
                                                    regeneratingImages.has(getImageKey(closingImage)) ||
                                                    disabledButtons.has(getImageKey(closingImage))
                                                  }
                                                />
                                                <IconButton
                                                  aria-label="Edit prompt"
                                                  icon={<EditIcon />}
                                                  onClick={() => {
                                                    setSelectedImage(closingImage);
                                                    setEditingPrompt(closingImage.description);
                                                  }}
                                                  isDisabled={
                                                    regeneratingImages.has(getImageKey(closingImage)) ||
                                                    disabledButtons.has(getImageKey(closingImage))
                                                  }
                                                />
                                              </HStack>

                                              {selectedImage === closingImage && (
                                                <VStack spacing={2}>
                                                  <Textarea
                                                    value={editingPrompt ?? closingImage.description}
                                                    onChange={(e) => setEditingPrompt(e.target.value)}
                                                  />
                                                  <Button
                                                    size="sm"
                                                    onClick={() => handlePromptChange(closingImage, editingPrompt || closingImage.description)}
                                                  >
                                                    Update Prompt
                                                  </Button>
                                                </VStack>
                                              )}
                                            </VStack>
                                          </SimpleGrid>
                                        </Box>
                                      )}
                                    </VStack>
                                  </Box>
                                );
                              })}
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

export default ImageReview;