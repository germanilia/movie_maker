import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Image,
  VStack,
  HStack,
  Text,
  IconButton,
  useToast,
  Center,
  Spinner,
  Textarea,
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon } from '@chakra-ui/icons';

interface ImageReviewProps {
  images: any[];
  setImages: (images: any[]) => void;
  projectName: string;
  onNext: () => void;
  onBack: () => void;
}

const ImageReview: React.FC<ImageReviewProps> = ({
  images,
  setImages,
  projectName,
  onNext,
  onBack,
}) => {
  const toast = useToast();
  const [isPolling, setIsPolling] = React.useState(true);
  const [editingPrompt, setEditingPrompt] = useState<string | undefined>(undefined);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(new Set());
  const [imageTimestamps, setImageTimestamps] = useState<Record<string, number>>({});
  const [regenerationPollingTimes, setRegenerationPollingTimes] = useState<Record<string, number[]>>({});
  const [disabledButtons, setDisabledButtons] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetchImages();

    // Set up polling every 5 seconds while isPolling is true
    const interval = setInterval(() => {
      if (isPolling) {
        fetchImages();
      }
    }, 5000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [isPolling]);

  useEffect(() => {
    // For each image that's being regenerated
    regeneratingImages.forEach(imageKey => {
      const image = images.find(img => getImageKey(img) === imageKey);
      if (image) {
        pollRegeneratedImage(
          imageKey,
          image.chapter_index,
          image.scene_index,
          image.shot_index
        );
      }
    });
  }, [regeneratingImages]); // Run when regeneratingImages set changes

  const fetchImages = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/images/${projectName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      setImages(data);
      
      // Update timestamps for all completed images
      const newTimestamps: Record<string, number> = {};
      data.forEach((img: any) => {
        if (img.status === 'completed') {
          const key = getImageKey(img);
          newTimestamps[key] = Date.now();
        }
      });
      setImageTimestamps(prev => ({...prev, ...newTimestamps}));
      
      // If we have all images, stop polling
      if (data.length > 0 && data.every((img: any) => img.status === 'completed')) {
        setIsPolling(false);
      }
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
  };

  const getImageKey = (image: any) => 
    `${image.chapter_index}-${image.scene_index}-${image.shot_index}-${image.type}`;

  const getImageUrl = (image: any) => {
    const key = getImageKey(image);
    const timestamp = imageTimestamps[key] || 0;
    return `${image.url}?t=${timestamp}`;
  };

  const handleRegenerateImage = async (
    chapterIndex: number, 
    sceneIndex: number, 
    shotIndex: number, 
    customPrompt?: string
  ) => {
    const imageKey = `${chapterIndex}-${sceneIndex}-${shotIndex}-image`;
    
    // Disable the button immediately
    setDisabledButtons(prev => new Set([...Array.from(prev), imageKey]));

    try {
      // Enable the button after 30 seconds and refresh the image
      setTimeout(async () => {
        setDisabledButtons(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(imageKey);
          return newSet;
        });
        
        // Fetch latest images from the server
        await fetchImages();
        
        // Update the timestamp to force image refresh
        setImageTimestamps(prev => ({
          ...prev,
          [imageKey]: Date.now()
        }));
      }, 30000);

      // Mark image as regenerating
      setRegeneratingImages(prev => new Set([...Array.from(prev), imageKey]));

      // Set up polling intervals for this image
      const pollingTimes = [10000, 20000, 30000, 40000];
      setRegenerationPollingTimes(prev => ({
        ...prev,
        [imageKey]: pollingTimes
      }));

      // Make the regeneration request
      const response = await fetch(
        `http://localhost:8000/api/regenerate-image/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: chapterIndex,
            scene_index: sceneIndex,
            shot_index: shotIndex,
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

    } catch (error) {
      // Remove from disabled buttons on error
      setDisabledButtons(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
      
      // Remove regenerating status on error
      setRegeneratingImages(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
      
      toast({
        title: 'Error',
        description: 'Failed to regenerate image',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const pollRegeneratedImage = async (
    imageKey: string,
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number
  ) => {
    const times = regenerationPollingTimes[imageKey];
    if (!times || times.length === 0) {
      // Stop polling if we've exhausted all intervals
      setRegeneratingImages(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
      return;
    }

    // Wait for the next interval
    const nextPollTime = times[0];
    await new Promise(resolve => setTimeout(resolve, nextPollTime));

    try {
      const response = await fetch(`http://localhost:8000/api/images/${projectName}`);
      if (!response.ok) {
        throw new Error('Failed to check image status');
      }

      const updatedImages = await response.json();
      const regeneratedImage = updatedImages.find((img: any) => 
        img.chapter_index === chapterIndex && 
        img.scene_index === sceneIndex && 
        img.shot_index === shotIndex
      );

      setImages(updatedImages);

      if (regeneratedImage?.status === 'completed') {
        // Image is ready, update timestamp and stop polling
        setImageTimestamps(prev => ({
          ...prev,
          [imageKey]: Date.now()
        }));
        setRegeneratingImages(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(imageKey);
          return newSet;
        });
        setRegenerationPollingTimes(prev => {
          const newTimes = { ...prev };
          delete newTimes[imageKey];
          return newTimes;
        });

        toast({
          title: 'Success',
          description: 'Image regenerated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Continue polling with remaining intervals
        setRegenerationPollingTimes(prev => ({
          ...prev,
          [imageKey]: times.slice(1)
        }));
        pollRegeneratedImage(imageKey, chapterIndex, sceneIndex, shotIndex);
      }
    } catch (error) {
      console.error('Error polling regenerated image:', error);
      // Stop polling on error
      setRegeneratingImages(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(imageKey);
        return newSet;
      });
    }
  };

  const handlePromptChange = async (image: any, newPrompt: string) => {
    try {
      const action = image.type
      
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
          action: action
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update shot description');
      }

      // Update the local images state with the new description
      setImages(images.map((img: any) => {
        if (
          img.chapter_index === image.chapter_index &&
          img.scene_index === image.scene_index &&
          img.shot_index === image.shot_index
        ) {
          return { ...img, description: newPrompt };
        }
        return img;
      }));

      // Reset editing state
      setSelectedImage(action === 'closing' ? null : image);
      setEditingPrompt(action === 'closing' ? undefined : newPrompt);
      setHasUnsavedChanges(action === 'opening');

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

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <Grid templateColumns="repeat(3, 1fr)" gap={6}>
          {images.map((image, index) => {
            const isRegenerating = regeneratingImages.has(getImageKey(image));
            return (
              <Box key={index} borderWidth="1px" borderRadius="lg" overflow="hidden">
                {image.status === 'completed' ? (
                  <Box position="relative">
                    <Image 
                      src={getImageUrl(image)}
                      alt={`Generated image ${index + 1}`} 
                    />
                    {isRegenerating && (
                      <Center
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        bottom="0"
                        bg="blackAlpha.600"
                      >
                        <VStack>
                          <Spinner color="white" />
                          <Text color="white">Regenerating...</Text>
                        </VStack>
                      </Center>
                    )}
                  </Box>
                ) : (
                  <Center h="200px">
                    <VStack>
                      <Spinner />
                      <Text>Generating image...</Text>
                    </VStack>
                  </Center>
                )}
                <Box p={4}>
                  <Text fontSize="sm" mb={2}>
                    Chapter {image.chapter_index + 1}, Scene {image.scene_index + 1}, Shot{' '}
                    {image.shot_index + 1} ({image.type})
                  </Text>
                  <Text fontSize="xs" mb={2}>
                    {image.description}
                  </Text>
                  {selectedImage === image ? (
                    <VStack spacing={2}>
                      <Textarea
                        value={editingPrompt ?? image.description}
                        onChange={(e) => setEditingPrompt(e.target.value)}
                        size="sm"
                      />
                      <HStack>
                        <Button
                          size="sm"
                          onClick={() => {
                            handlePromptChange(image, editingPrompt || image.description);
                          }}
                        >
                          Done
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <HStack>
                      <IconButton
                        aria-label="Regenerate image"
                        icon={<RepeatIcon />}
                        onClick={() =>
                          handleRegenerateImage(
                            image.chapter_index,
                            image.scene_index,
                            image.shot_index
                          )
                        }
                        size="sm"
                        isDisabled={
                          image.status === 'pending' || 
                          isRegenerating ||
                          disabledButtons.has(`${image.chapter_index}-${image.scene_index}-${image.shot_index}-image`)
                        }
                      />
                      <IconButton
                        aria-label="Edit prompt"
                        icon={<EditIcon />}
                        onClick={() => {
                          setSelectedImage(image);
                          setEditingPrompt(image.description);
                        }}
                        size="sm"
                        isDisabled={
                          image.status === 'pending' || 
                          isRegenerating || 
                          disabledButtons.has(getImageKey(image))
                        }
                      />
                    </HStack>
                  )}
                </Box>
              </Box>
            );
          })}
        </Grid>

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