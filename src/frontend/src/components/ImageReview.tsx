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
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon } from '@chakra-ui/icons';

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
  const [script, setScript] = useState<any>(null);
  const [imageVersions, setImageVersions] = useState<Record<string, number>>({});
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
    customPrompt?: string
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
            custom_prompt: customPrompt
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
    <Box p={4}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Image Review</Heading>

        {!script ? (
          <Center h="200px">
            <VStack>
              <Spinner />
              <Text>Loading script data...</Text>
            </VStack>
          </Center>
        ) : (
          <Accordion allowMultiple defaultIndex={[0]}>
            {script.chapters.map((chapter: any, chapterIndex: number) => (
              <AccordionItem key={chapterIndex}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Heading size="md">
                      Chapter {chapter.chapter_number}: {chapter.chapter_title}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                
                <AccordionPanel>
                  <VStack spacing={6} align="stretch">
                    <Text color="gray.600">{chapter.chapter_description}</Text>
                    
                    {chapter.scenes.map((scene: any, sceneIndex: number) => (
                      <Box key={sceneIndex} borderWidth="1px" borderRadius="lg" p={4}>
                        <Heading size="sm" mb={3}>
                          Scene {scene.scene_number}
                        </Heading>
                        <Text color="gray.600" mb={4}>
                          {scene.general_scene_description_and_motivations}
                        </Text>

                        <VStack spacing={4} align="stretch">
                          {scene.shots.map((shot: any, shotIndex: number) => {
                            const shotImages = findImages(chapterIndex, sceneIndex, shotIndex);
                            const openingImage = shotImages.find(img => img.type === 'opening');
                            const closingImage = shotImages.find(img => img.type === 'closing');

                            if (!openingImage && !closingImage) return null;

                            return (
                              <Box key={shotIndex} borderWidth="1px" borderRadius="md" p={4}>
                                <VStack spacing={4}>
                                  {/* Opening Image */}
                                  {openingImage && (
                                    <Box width="100%">
                                      <Heading size="xs" mb={2}>Opening Shot</Heading>
                                      <HStack align="start" spacing={6}>
                                        <Box flex="1">
                                          <Box position="relative">
                                            {openingImage.status === 'pending' ? (
                                              <Center h="200px" borderWidth="1px" borderRadius="md">
                                                <VStack>
                                                  <Spinner />
                                                  <Text>Generating image...</Text>
                                                </VStack>
                                              </Center>
                                            ) : (
                                              <Image 
                                                src={getImageUrl(openingImage)}
                                                alt={`Opening Shot ${shot.shot_number}`}
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
                                            {regeneratingImages.has(getImageKey(openingImage)) && (
                                              <Center position="absolute" inset={0} bg="blackAlpha.600">
                                                <VStack>
                                                  <Spinner color="white" />
                                                  <Text color="white">Regenerating...</Text>
                                                </VStack>
                                              </Center>
                                            )}
                                          </Box>
                                        </Box>

                                        <VStack align="stretch" flex="1" spacing={4}>
                                          <Box>
                                            <Text fontSize="sm" color="gray.600" mt={2}>
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
                                                'opening'
                                              )}
                                              isDisabled={
                                                openingImage.status === 'pending' || 
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
                                                openingImage.status === 'pending' || 
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
                                      </HStack>
                                    </Box>
                                  )}

                                  {/* Closing Image */}
                                  {closingImage && (
                                    <Box width="100%">
                                      <Heading size="xs" mb={2}>Closing Shot</Heading>
                                      <HStack align="start" spacing={6}>
                                        <Box flex="1">
                                          <Box position="relative">
                                            {closingImage.status === 'pending' ? (
                                              <Center h="200px" borderWidth="1px" borderRadius="md">
                                                <VStack>
                                                  <Spinner />
                                                  <Text>Generating image...</Text>
                                                </VStack>
                                              </Center>
                                            ) : (
                                              <Image 
                                                src={getImageUrl(closingImage)}
                                                alt={`Closing Shot ${shot.shot_number}`}
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
                                            {regeneratingImages.has(getImageKey(closingImage)) && (
                                              <Center position="absolute" inset={0} bg="blackAlpha.600">
                                                <VStack>
                                                  <Spinner color="white" />
                                                  <Text color="white">Regenerating...</Text>
                                                </VStack>
                                              </Center>
                                            )}
                                          </Box>
                                        </Box>

                                        <VStack align="stretch" flex="1" spacing={4}>
                                          <Box>
                                            <Text fontSize="sm" color="gray.600" mt={2}>
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
                                                'closing'
                                              )}
                                              isDisabled={
                                                closingImage.status === 'pending' || 
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
                                                closingImage.status === 'pending' || 
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
                                      </HStack>
                                    </Box>
                                  )}
                                </VStack>
                              </Box>
                            );
                          })}
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <HStack spacing={4} justify="flex-end">
          <Button onClick={onBack}>Back</Button>
          <Button colorScheme="blue" onClick={onNext}>
            Generate Video
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default ImageReview; 