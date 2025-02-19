import React, { useState, useRef } from 'react';
import { Script, Shot } from '../models/models';
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
  useToast,
  Spinner,
  Center,
} from '@chakra-ui/react';
import ImageDisplay from './ImageDisplay';
import NarrationBox from './NarrationBox';
import BackgroundMusic from './BackgroundMusic';
import ShotVideo from './ShotVideo';
import DirectorInstructions from './DirectorInstructions';
import Scene from './Scene';

interface ScriptReviewProps {
  script: Script | null;
  setScript: React.Dispatch<React.SetStateAction<Script | null>>;
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

interface VideoApiResponse {
  status: string;
  videos: Record<string, string>;
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
  const [backgroundMusicData, setBackgroundMusicData] = useState<Record<string, string>>({});
  const [videoData, setVideoData] = useState<Record<string, string>>({});
  const [existingNarrations, setExistingNarrations] = useState<Record<string, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState<Set<string>>(new Set());
  const [isGeneratingAllMusic, setIsGeneratingAllMusic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const isMounted = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getImageKey = React.useCallback((chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) =>
    `${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}-${type}`,
    []
  );

  // Function to load all videos including final scene videos
  const loadAllVideos = React.useCallback(async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/get-all-videos/${projectName}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json() as VideoApiResponse;
      if (data.status === 'success' && data.videos) {
        setVideoData(data.videos);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
      toast({
        title: 'Error',
        description: 'Failed to load videos',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [projectName, toast]);

  // Effect to load all data when script changes
  React.useEffect(() => {
    let mounted = true;

    const fetchAllData = async () => {
      if (!script) return;
      
      setIsLoading(true);
      try {
        const endpoints = [
          'get-all-images',
          'get-all-narrations',
          'get-all-background-music'
        ];

        const responses = await Promise.all(
          endpoints.map(endpoint => 
            fetch(`http://localhost:8000/api/${endpoint}/${projectName}`, { cache: 'no-store' })
          )
        );

        if (!mounted) return;

        const [imageData, narrData, musicData] = await Promise.all(
          responses.map(r => r.json())
        );

        if (!mounted) return;

        if (imageData.status === 'success' && imageData.images) {
          setImageData(imageData.images);
        }

        if (narrData.status === 'success' && narrData.narrations) {
          setNarrationData(narrData.narrations);
        }

        if (musicData.status === 'success' && musicData.background_music) {
          setBackgroundMusicData(musicData.background_music);
        }

        // Load videos separately since they might be larger
        await loadAllVideos();

      } catch (error) {
        console.error('Error fetching data:', error);
        if (mounted) {
          toast({
            title: 'Error',
            description: 'Failed to fetch data',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      mounted = false;
    };
  }, [script, projectName, toast, loadAllVideos]);

  // Update onVideoGenerated to use loadAllVideos
  const onVideoGenerated = async () => {
    await loadAllVideos();
  };

  const handleGenerateImage = async (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: string,
    description: string,
    overwriteImage: boolean = true,
    referenceImage?: string,
    modelType: string = 'flux_ultra_model',
    seed: number = 333
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
            overwrite_image: overwriteImage,
            model_type: modelType,
            reference_image: referenceImage,
            seed: seed
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();

      if (data.status === 'success' && data.base64_image) {
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
      throw error;
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

      // After successful generation, fetch all background music data
      const allMusicResponse = await fetch(
        `http://localhost:8000/api/get-all-background-music/${projectName}`,
        { cache: 'no-store' }
      );

      if (allMusicResponse.ok) {
        const musicData = await allMusicResponse.json();
        if (musicData.status === 'success' && musicData.background_music) {
          setBackgroundMusicData(musicData.background_music);
        }
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
        for (const scene of chapter.scenes || []) {
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
          
        });
      });
    });

    return pendingImages;
  };

  const handleGenerateAll = async () => {
    const pendingImages = getAllPendingImages();
    console.log(`Found ${pendingImages.length} pending images to generate`);
    
    if (pendingImages.length === 0) {
      toast({
        title: 'Info',
        description: 'No missing images found to generate',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsGeneratingAll(true);
    let errorCount = 0;
    let successCount = 0;

    try {
      for (const img of pendingImages) {
        const imageKey = getImageKey(
          img.chapterIndex,
          img.sceneIndex,
          img.shotIndex,
          img.type
        );
        
        console.log(`Generating image for key: ${imageKey}`, {
          chapter: img.chapterIndex + 1,
          scene: img.sceneIndex + 1,
          shot: img.shotIndex + 1,
          type: img.type,
          description: img.description
        });

        try {
          await handleGenerateImage(
            img.chapterIndex,
            img.sceneIndex,
            img.shotIndex,
            img.type,
            img.description,
            true // Set to true to ensure generation
          );
          
          successCount++;
          console.log(`Successfully generated image ${successCount}/${pendingImages.length}`);
          
          // Add a small delay between generations
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          errorCount++;
          console.error(`Failed to generate image ${imageKey}:`, error);
        }
      }

      if (errorCount > 0) {
        toast({
          title: 'Partial Success',
          description: `Generated ${successCount} images with ${errorCount} failures`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully generated ${successCount} images`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Info',
          description: 'No images were generated',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error in generate all:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete image generation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) {
        setIsGeneratingAll(false);
      }
    }
  };

  const handleUpdateDescription = async (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing',
    newDescription: string
  ) => {
    try {
      // Call the API to update the script
      const response = await fetch(`http://localhost:8000/api/update-shot-description/${projectName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapter_index: chapterIndex + 1,
          scene_index: sceneIndex + 1,
          shot_index: shotIndex + 1,
          action: type,
          description: newDescription,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update description');
      }

      // Update only the specific shot's description in the script
      if (script?.chapters?.[chapterIndex]?.scenes?.[sceneIndex]?.shots?.[shotIndex]) {
        const shot = script!.chapters![chapterIndex]!.scenes![sceneIndex]!.shots![shotIndex]!;
        shot['opening_frame'] = newDescription;
      }
    } catch (error) {
      console.error('Error updating description:', error);
      throw error;
    }
  };

  const handleUpdateDirectorInstructions = async (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    newInstructions: string
  ) => {
    try {
      // Create a deep copy of the script
      const updatedScript = JSON.parse(JSON.stringify(script));

      // Update the instructions in the script
      updatedScript.chapters[chapterIndex].scenes[sceneIndex].shots[shotIndex].director_instructions = newInstructions;

      // Call the API to update the script
      const response = await fetch(`http://localhost:8000/api/update-script/${projectName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedScript),
      });

      if (!response.ok) {
        throw new Error('Failed to update director instructions');
      }

      // Update the local script state
      setScript(updatedScript);
    } catch (error) {
      console.error('Error updating director instructions:', error);
      throw error;
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

  if (isLoading) {
    return (
      <Center height="100vh">
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading script data...</Text>
        </VStack>
      </Center>
    );
  }

  // First, update the renderSceneDescription function to accept the seed parameter
  const renderSceneDescription = (
    shot: Shot,
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing'
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    const description = shot.opening_frame
  
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
              modelType || 'flux_ultra_model',
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
        projectName={projectName}  // Add projectName prop
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
                      <Scene
                        key={sceneIndex}
                        scene={scene}
                        chapterIndex={chapterIndex}
                        sceneIndex={sceneIndex}
                        chapterNumber={chapter.chapter_number}
                        projectName={projectName}
                        script={script}
                        setScript={setScript}
                        imageData={imageData}
                        narrationData={narrationData}
                        backgroundMusicData={backgroundMusicData}
                        videoData={videoData}
                        generatingImages={generatingImages}
                        generatingMusic={generatingMusic}
                        handleGenerateImage={handleGenerateImage}
                        handleGenerateBackgroundMusic={handleGenerateBackgroundMusic}
                        handleUpdateDescription={handleUpdateDescription}
                        getImageKey={getImageKey}
                        onVideoGenerated={onVideoGenerated}
                        onScriptUpdate={setScript}
                      />
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
