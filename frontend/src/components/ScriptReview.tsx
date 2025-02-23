import React, { useState, useRef } from 'react';
import { Script, Shot } from '../models/models';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  useToast,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  Badge,
  Progress,
  IconButton,
  useColorModeValue,
  Card,
  CardHeader,
  CardBody,
  Icon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
  AspectRatio,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { FaRedo } from 'react-icons/fa';
import ImageDisplay from './ImageDisplay';
import NarrationBox from './NarrationBox';
import BackgroundMusic from './BackgroundMusic';
import DirectorInstructions from './DirectorInstructions';
import Chapter from './Chapter';
import { createIcon } from '@chakra-ui/react';

interface ScriptReviewProps {
  script: Script | null;
  setScript: React.Dispatch<React.SetStateAction<Script | null>>;
  onNext: () => void;
  onBack: () => void;
  projectName: string;
  onHome: () => void;
}


interface VideoApiResponse {
  status: string;
  videos: Record<string, string>;
}



interface GenerateSceneVideoRequest {
  chapter_number: number;
  scene_number: number;
  black_and_white: boolean;
}

const HomeIcon = createIcon({
  displayName: 'HomeIcon',
  viewBox: '0 0 24 24',
  path: (
    <path
      fill="currentColor"
      d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
    />
  ),
});

const ScriptReview: React.FC<ScriptReviewProps> = ({
  script,
  setScript,
  onNext,
  onBack,
  projectName,
  onHome
}) => {
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [imageData, setImageData] = useState<Record<string, string>>({});
  const [narrationData, setNarrationData] = useState<Record<string, string>>({});
  const [backgroundMusicData, setBackgroundMusicData] = useState<Record<string, string>>({});
  const [videoData, setVideoData] = useState<Record<string, string>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState<Set<string>>(new Set());
  const [isGeneratingAllMusic, setIsGeneratingAllMusic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeChapterForRegeneration, setActiveChapterForRegeneration] = useState<number | null>(null);
  const [activeSceneForRegeneration, setActiveSceneForRegeneration] = useState<{chapter: number, scene: number} | null>(null);
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { isOpen: isChapterModalOpen, onClose: onChapterModalClose } = useDisclosure();
  const { isOpen: isSceneModalOpen, onClose: onSceneModalClose } = useDisclosure();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const timelineBg = useColorModeValue('gray.50', 'gray.700');
  const cardBg = useColorModeValue('gray.100', 'gray.900');
  const toast = useToast();
  const isMounted = useRef(true);
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLElement | null>(null);
  const [generatingVideoFor, setGeneratingVideoFor] = useState<{chapter: number, scene: number} | null>(null);
  const [videoKey, setVideoKey] = useState<number>(0);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    containerRef.current = document.body;
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

  // First, remove the script update event listener from the useEffect
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

  // Add a handler for shot updates
  const handleShotRegenerated = (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    newDescription: string,
    newInstructions: string
  ) => {
    if (!script) return;

    // Update local state for the specific shot
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, 'opening');
    setImageData(prevImageData => {
      const newImageData = { ...prevImageData };
      delete newImageData[imageKey];
      return newImageData;
    });

    // Update script without triggering a full re-render
    const updatedScript = JSON.parse(JSON.stringify(script));
    const shot = updatedScript.chapters[chapterIndex]?.scenes?.[sceneIndex]?.shots?.[shotIndex];
    if (shot) {
      shot.opening_frame = newDescription;
      shot.director_instructions = newInstructions;
      setScript(updatedScript);
    }
  };

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

  const handleGenerateBackgroundMusic = async (chapterNumber: number, sceneNumber: number, style?: string) => {
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
            style: style || 'Cinematic',  // Include the selected style
            overwrite: true  // Always overwrite when regenerating
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
          await handleGenerateBackgroundMusic(chapter.chapter_number, scene.scene_number, 'Cinematic');
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

  const handleUpdateShotInstructions = async (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    newInstructions: string
  ) => {
    try {
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
        throw new Error('Failed to update shot instructions');
      }

      setScript(updatedScript);
    } catch (error) {
      console.error('Error updating shot instructions:', error);
      throw error;
    }
  };

  const handleRegenerateChapter = async () => {
    if (activeChapterForRegeneration === null) return;
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-chapter/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: activeChapterForRegeneration + 1,
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate chapter');
      }

      const updatedScript = await response.json();
      setScript(updatedScript);
      onChapterModalClose();
      setRegenerateInstructions('');
      toast({
        title: 'Success',
        description: 'Chapter regenerated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error regenerating chapter:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to regenerate chapter',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRegenerating(false);
      setActiveChapterForRegeneration(null);
    }
  };

  const handleRegenerateScene = async () => {
    if (!activeSceneForRegeneration) return;
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-scene/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: activeSceneForRegeneration.chapter + 1,
            scene_index: activeSceneForRegeneration.scene + 1,
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate scene');
      }

      const updatedScript = await response.json();
      setScript(updatedScript);
      onSceneModalClose();
      setRegenerateInstructions('');
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
      setIsRegenerating(false);
      setActiveSceneForRegeneration(null);
    }
  };

  const onScriptUpdate = React.useCallback((updatedScript: Script) => {
    setScript(updatedScript);
    toast({
      title: 'Success',
      description: 'Script updated successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  }, [setScript, toast]);

  // Add event listener for scene selection
  React.useEffect(() => {
    const handleSceneSelection = (event: CustomEvent<{ chapterIndex: number; sceneIndex: number }>) => {
      setActiveChapterIndex(event.detail.chapterIndex);
      setActiveSceneIndex(event.detail.sceneIndex);
      
      // Find the selected scene element and scroll it into view
      setTimeout(() => {
        const sceneElement = document.querySelector(
          `[data-chapter-index="${event.detail.chapterIndex}"][data-scene-index="${event.detail.sceneIndex}"]`
        );
        if (sceneElement && leftPanelRef.current) {
          sceneElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    };

    window.addEventListener('scene-selected', handleSceneSelection as EventListener);

    return () => {
      window.removeEventListener('scene-selected', handleSceneSelection as EventListener);
    };
  }, []);

  const handleGenerateSceneVideo = async (chapterIndex: number, sceneIndex: number) => {
    if (generatingVideoFor) return;

    setGeneratingVideoFor({ chapter: chapterIndex, scene: sceneIndex });

    try {
      const request: GenerateSceneVideoRequest = {
        chapter_number: chapterIndex + 1,
        scene_number: sceneIndex + 1,
        black_and_white: script?.project_details?.black_and_white || false
      };

      const response = await fetch(
        `http://localhost:8000/api/generate-scene-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate scene video');
      }

      // Update video data and force video reload
      await loadAllVideos();
      setVideoKey(prev => prev + 1);

      toast({
        title: 'Success',
        description: 'Scene video generation completed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error generating scene video:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate scene video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingVideoFor(null);
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
    const description = shot.opening_frame;
    const videoKey = `${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}`;

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
        onShotRegenerated={(newDescription, newInstructions) => 
          handleShotRegenerated(chapterIndex, sceneIndex, shotIndex, newDescription, newInstructions)
        }
        directorInstructions={shot.director_instructions}
        chapterIndex={chapterIndex}
        sceneIndex={sceneIndex}
        shotIndex={shotIndex}
        projectName={projectName}
        videoData={videoData[videoKey]}
      />
    );
  };

  const totalChapters = script.chapters.length;
  const currentChapter = script.chapters[activeChapterIndex];
  const progress = ((activeChapterIndex + 1) / totalChapters) * 100;

  return (
    <Box height="100vh" overflow="hidden" bg={bgColor}>
      {/* Header */}
      <Box position="fixed" top={0} left={0} right={0} zIndex={100}>
        <Flex
          p={4}
          borderBottomWidth={1}
          borderColor={borderColor}
          height="72px"
          align="center"
          justify="space-between"
          bg={bgColor}
        >
          <HStack spacing={4}>
            <Heading size="lg">Story Overview</Heading>
            <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
              Chapter {activeChapterIndex + 1} of {totalChapters}
            </Badge>
          </HStack>
          <HStack spacing={4}>
            <Button
              colorScheme="teal"
              onClick={handleGenerateAll}
              isLoading={isGeneratingAll}
              loadingText="Generating All"
              isDisabled={generatingImages.size > 0}
              size="sm"
            >
              Generate All Images
            </Button>
            <Button
              colorScheme="orange"
              onClick={handleGenerateAllMusic}
              isLoading={isGeneratingAllMusic}
              loadingText="Generating All Music"
              isDisabled={generatingMusic.size > 0}
              size="sm"
            >
              Generate All Music
            </Button>
            <Button onClick={onBack} size="sm">Back</Button>
            <Button colorScheme="blue" onClick={onNext} size="sm">Next</Button>
            <IconButton
              aria-label="Home"
              icon={<HomeIcon />}
              onClick={onHome}
              size="sm"
              variant="ghost"
            />
          </HStack>
        </Flex>

        {/* Story Timeline */}
        <Box
          p={4}
          bg={timelineBg}
          borderBottomWidth={1}
          borderColor={borderColor}
        >
          <VStack spacing={4} align="stretch">
            <Progress
              value={progress}
              size="sm"
              colorScheme="blue"
              borderRadius="full"
            />
            <Flex justify="space-between" align="center">
              <IconButton
                aria-label="Previous chapter"
                icon={<ChevronLeftIcon />}
                onClick={() => setActiveChapterIndex(Math.max(0, activeChapterIndex - 1))}
                isDisabled={activeChapterIndex === 0}
                size="sm"
              />
              <HStack spacing={2} overflow="auto" p={2} flex={1} justify="center">
                {script.chapters.map((chapter, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={index === activeChapterIndex ? "solid" : "outline"}
                    colorScheme={index === activeChapterIndex ? "blue" : "gray"}
                    onClick={() => setActiveChapterIndex(index)}
                  >
                    Chapter {index + 1}
                  </Button>
                ))}
              </HStack>
              <IconButton
                aria-label="Next chapter"
                icon={<ChevronRightIcon />}
                onClick={() => setActiveChapterIndex(Math.min(totalChapters - 1, activeChapterIndex + 1))}
                isDisabled={activeChapterIndex === totalChapters - 1}
                size="sm"
              />
            </Flex>
          </VStack>
        </Box>
      </Box>

      {/* Main Content */}
      <Box 
        pt="180px" 
        height="100vh" 
        overflow="hidden"
        position="relative"
      >
        <Flex height="calc(100vh - 180px)">
          {/* Left Panel */}
          <Box
            ref={leftPanelRef}
            width="350px"
            borderRightWidth={1}
            borderColor={borderColor}
            p={4}
            overflowY="auto"
            bg={bgColor}
            css={{
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0, 0, 0, 0.1)',
                borderRadius: '2px',
              },
            }}
          >
            {script.chapters.map((chapter, chapterIndex) => (
              <Box key={chapterIndex} mb={6}>
                <Chapter
                  chapter={chapter}
                  chapterIndex={chapterIndex}
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
                  onScriptUpdate={onScriptUpdate}
                />
              </Box>
            ))}
          </Box>

          {/* Main Content Area */}
          <Box flex={1} p={4} overflowY="auto" bg={bgColor}>
            <Tabs variant="enclosed" colorScheme="blue">
              <TabList>
                <Tab>Scene Overview</Tab>
                <Tab>Visual Preview</Tab>
                <Tab>Script & Audio</Tab>
                <Tab>Shot Instructions</Tab>
                <Tab>Scene Video</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Card variant="outline" bg={bgColor}>
                      <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
                        <Heading size="sm">Scene Details</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          <Box>
                            <Heading size="xs" mb={2}>Main Story</Heading>
                            <Text>{currentChapter.scenes?.[activeSceneIndex]?.main_story}</Text>
                          </Box>
                          
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    {currentChapter.scenes?.[activeSceneIndex]?.shots?.map((shot, shotIndex) => (
                      <Card key={shotIndex} variant="outline" bg={bgColor}>
                        <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
                          <HStack justify="space-between">
                            <Heading size="sm">Shot {shotIndex + 1}</Heading>
                            <Badge
                              colorScheme={videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`] ? 'green' : 'gray'}
                            >
                              {videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`] ? 'Rendered' : 'Pending'}
                            </Badge>
                          </HStack>
                        </CardHeader>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            {renderSceneDescription(
                              shot,
                              activeChapterIndex,
                              activeSceneIndex,
                              shotIndex,
                              'opening'
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Card variant="outline" bg={bgColor}>
                      <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
                        <Heading size="sm">Scene Audio</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={6}>
                          <Box width="100%">
                            <Heading size="xs" mb={4}>Background Music</Heading>
                            <BackgroundMusic
                              audioData={backgroundMusicData}
                              isGenerating={generatingMusic.has(`${activeChapterIndex + 1}-${activeSceneIndex + 1}`)}
                              onGenerateMusic={(style) => handleGenerateBackgroundMusic(activeChapterIndex + 1, activeSceneIndex + 1, style)}
                              chapterIndex={activeChapterIndex}
                              sceneIndex={activeSceneIndex}
                              projectName={projectName}
                            />
                          </Box>
                          <Box width="100%">
                            <Heading size="xs" mb={4}>Narration</Heading>
                            <NarrationBox
                              audioData={narrationData}
                              chapterIndex={activeChapterIndex}
                              sceneIndex={activeSceneIndex}
                              projectName={projectName}
                              narrationText={currentChapter.scenes?.[activeSceneIndex]?.narration_text || ''}
                            />
                          </Box>
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    {currentChapter.scenes?.[activeSceneIndex]?.shots?.map((shot, index) => (
                      <Card key={index} variant="outline" bg={bgColor}>
                        <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
                          <Heading size="sm">Shot {index + 1} Instructions</Heading>
                        </CardHeader>
                        <CardBody>
                          <DirectorInstructions
                            instructions={shot.director_instructions || ''}
                            handleUpdate={(newInstructions) =>
                              handleUpdateShotInstructions(activeChapterIndex, activeSceneIndex, index, newInstructions)
                            }
                            reasoning={shot.reasoning || ''}
                          />
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Card variant="outline" bg={bgColor}>
                      <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
                        <HStack justify="space-between">
                          <Heading size="sm">Final Scene Video</Heading>
                          <Button
                            colorScheme="blue"
                            size="sm"
                            leftIcon={
                              generatingVideoFor?.chapter === activeChapterIndex && 
                              generatingVideoFor?.scene === activeSceneIndex ? 
                                <Spinner size="sm" /> : 
                                <Icon as={FaRedo} />
                            }
                            onClick={() => handleGenerateSceneVideo(activeChapterIndex, activeSceneIndex)}
                            isLoading={
                              generatingVideoFor?.chapter === activeChapterIndex && 
                              generatingVideoFor?.scene === activeSceneIndex
                            }
                            loadingText="Generating"
                            isDisabled={generatingVideoFor !== null}
                          >
                            Generate Video
                          </Button>
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <AspectRatio ratio={16/9}>
                          <Box position="relative">
                            <video
                              key={videoKey}
                              controls
                              src={`http://localhost:8000/api/get-scene-video/${projectName}/${activeChapterIndex + 1}/${currentChapter.scenes?.[activeSceneIndex]?.scene_number}?v=${videoKey}`}
                              style={{ width: '100%', borderRadius: '8px' }}
                            >
                              Your browser does not support the video tag.
                            </video>
                            <Text
                              position="absolute"
                              top="50%"
                              left="50%"
                              transform="translate(-50%, -50%)"
                              color="gray.500"
                              display={videoData[`final_scene_${activeChapterIndex + 1}_${activeSceneIndex + 1}`] ? 'none' : 'block'}
                            >
                              No video generated yet
                            </Text>
                          </Box>
                        </AspectRatio>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

              </TabPanels>
            </Tabs>
          </Box>
        </Flex>
      </Box>

      {/* Modals */}
      <Modal 
        isOpen={isChapterModalOpen} 
        onClose={() => {
          setRegenerateInstructions('');
          onChapterModalClose();
        }}
        size="xl"
        preserveScrollBarGap
        blockScrollOnMount={false}
        closeOnEsc={true}
        closeOnOverlayClick={true}
        isCentered
      >
        <ModalOverlay />
        <ModalContent 
          mx={4}
          my={3}
          maxHeight="calc(100vh - 80px)"
          overflowY="auto"
        >
          <ModalHeader>Chapter Regeneration Instructions</ModalHeader>
          <ModalCloseButton _focus={{ boxShadow: 'outline' }} />
          <ModalBody>
            <Text mb={4}>
              Enter any specific instructions for regenerating this chapter. These instructions will help guide the AI in creating a new version of the chapter.
            </Text>
            <Textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="Enter instructions for chapter regeneration..."
              size="lg"
              rows={6}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onChapterModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleRegenerateChapter}
              isLoading={isRegenerating}
              loadingText="Regenerating Chapter"
            >
              Regenerate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal 
        isOpen={isSceneModalOpen} 
        onClose={() => {
          setRegenerateInstructions('');
          onSceneModalClose();
        }}
        size="xl"
        preserveScrollBarGap
        blockScrollOnMount={false}
        closeOnEsc={true}
        closeOnOverlayClick={true}
        isCentered
      >
        <ModalOverlay />
        <ModalContent 
          mx={4}
          my={3}
          maxHeight="calc(100vh - 80px)"
          overflowY="auto"
        >
          <ModalHeader>Scene Regeneration Instructions</ModalHeader>
          <ModalCloseButton _focus={{ boxShadow: 'outline' }} />
          <ModalBody>
            <Text mb={4}>
              Enter any specific instructions for regenerating this scene. These instructions will help guide the AI in creating a new version of the scene.
            </Text>
            <Textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="Enter instructions for scene regeneration..."
              size="lg"
              rows={6}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSceneModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleRegenerateScene}
              isLoading={isRegenerating}
              loadingText="Regenerating Scene"
            >
              Regenerate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ScriptReview;
