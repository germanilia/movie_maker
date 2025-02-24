import React, { useState, useRef } from 'react';
import { Script } from '../models/models';
import { fetchSceneData } from '../services/sceneDataService';
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { createIcon } from '@chakra-ui/react';
import ScriptTimeline from './ScriptTimeline';
import SceneOverviewTab from './script-review-tabs/SceneOverviewTab';
import VisualPreviewTab from './script-review-tabs/VisualPreviewTab';
import ScriptAudioTab from './script-review-tabs/ScriptAudioTab';
import ShotInstructionsTab from './script-review-tabs/ShotInstructionsTab';
import SceneVideoTab from './script-review-tabs/SceneVideoTab';

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

interface SceneSelectionEvent {
  chapterIndex: number;
  sceneIndex: number;
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

  const fetchFreshSceneData = React.useCallback(async (chapterIdx: number, sceneIdx: number) => {
    try {
      const sceneData = await fetchSceneData(projectName, chapterIdx, sceneIdx);
      setImageData(prev => ({ ...prev, ...sceneData.images }));
      setNarrationData(prev => ({ ...prev, ...sceneData.narration }));
      setBackgroundMusicData(prev => ({ ...prev, ...sceneData.backgroundMusic }));
      setVideoData(prev => ({ ...prev, ...sceneData.videos }));
    } catch (error) {
      console.error('Error fetching fresh scene data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch fresh scene data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [projectName, toast]);

  React.useEffect(() => {
    const handleSceneSelection = async (event: CustomEvent<SceneSelectionEvent>) => {
      setActiveChapterIndex(event.detail.chapterIndex);
      setActiveSceneIndex(event.detail.sceneIndex);
      
      await fetchFreshSceneData(event.detail.chapterIndex, event.detail.sceneIndex);
      
      setTimeout(() => {
        const sceneElement = document.querySelector(
          `[data-chapter-index="${event.detail.chapterIndex}"][data-scene-index="${event.detail.sceneIndex}"]`
        );
        if (sceneElement && leftPanelRef.current) {
          sceneElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    };

    window.addEventListener('scene-selected', handleSceneSelection as unknown as EventListener);

    return () => {
      window.removeEventListener('scene-selected', handleSceneSelection as unknown as EventListener);
    };
  }, [fetchFreshSceneData]);

  React.useEffect(() => {
    if (script) {
      fetchFreshSceneData(activeChapterIndex, activeSceneIndex);
    }
  }, [activeChapterIndex, activeSceneIndex, script, fetchFreshSceneData]);

  React.useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const scriptResponse = await fetch(
          `http://localhost:8000/api/script/${projectName}`,
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store'
          }
        );
        
        if (!scriptResponse.ok) {
          throw new Error(`Failed to fetch script: ${scriptResponse.status} ${scriptResponse.statusText}`);
        }
        
        const scriptData = await scriptResponse.json();
        if (mounted) {
          setScript(scriptData);
          await fetchFreshSceneData(0, 0);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        if (mounted) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to fetch initial data',
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

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, [projectName, toast, setScript, fetchFreshSceneData]);

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
            style: style || 'Cinematic',
            overwrite: true
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate background music');
      }

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
            true
          );

          successCount++;
          console.log(`Successfully generated image ${successCount}/${pendingImages.length}`);

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

      if (script?.chapters?.[chapterIndex]?.scenes?.[sceneIndex]?.shots?.[shotIndex]) {
        const shot = script!.chapters![chapterIndex]!.scenes![sceneIndex]!.shots![shotIndex]!;
        shot['opening_frame'] = newDescription;
      }
    } catch (error) {
      console.error('Error updating description:', error);
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

  const totalChapters = script.chapters.length;
  const currentChapter = script.chapters[activeChapterIndex];
  const progress = ((activeChapterIndex + 1) / totalChapters) * 100;

  return (
    <Box height="100vh" overflow="hidden" bg={bgColor}>
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
                    {chapter.chapter_title || `Chapter ${index + 1}`}
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

      <Box 
        pt="180px" 
        height="100vh" 
        overflow="hidden"
        position="relative"
      >
        <Flex height="calc(100vh - 180px)">
          <ScriptTimeline
            script={script}
            projectName={projectName}
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
            timelineRef={leftPanelRef}
          />

          <Box flex={1} display="flex" flexDirection="column" height="100%">
            <Tabs variant="enclosed" colorScheme="blue" display="flex" flexDirection="column" height="100%">
              <TabList position="sticky" top={0} bg={bgColor} zIndex={1} borderBottomWidth={1} borderColor={borderColor}>
                <Tab>Scene Overview</Tab>
                <Tab>Visual Preview</Tab>
                <Tab>Script & Audio</Tab>
                <Tab>Shot Instructions</Tab>
                <Tab>Scene Video</Tab>
              </TabList>

              <TabPanels flex={1} overflow="auto">
                <TabPanel>
                  <SceneOverviewTab
                    currentChapter={currentChapter}
                    activeSceneIndex={activeSceneIndex}
                    cardBg={cardBg}
                    bgColor={bgColor}
                    borderColor={borderColor}
                  />
                </TabPanel>

                <TabPanel>
                  <VisualPreviewTab
                    shots={currentChapter.scenes?.[activeSceneIndex]?.shots || []}
                    activeChapterIndex={activeChapterIndex}
                    activeSceneIndex={activeSceneIndex}
                    projectName={projectName}
                    cardBg={cardBg}
                    bgColor={bgColor}
                    borderColor={borderColor}
                  />
                </TabPanel>

                <TabPanel>
                  <ScriptAudioTab
                    activeChapterIndex={activeChapterIndex}
                    activeSceneIndex={activeSceneIndex}
                    projectName={projectName}
                    cardBg={cardBg}
                    bgColor={bgColor}
                    borderColor={borderColor}
                    narrationText={currentChapter.scenes?.[activeSceneIndex]?.narration_text || ''}
                  />
                </TabPanel>

                <TabPanel>
                  <ShotInstructionsTab
                    shots={currentChapter.scenes?.[activeSceneIndex]?.shots || []}
                    activeChapterIndex={activeChapterIndex}
                    activeSceneIndex={activeSceneIndex}
                    projectName={projectName}
                    cardBg={cardBg}
                    bgColor={bgColor}
                    borderColor={borderColor}
                    onScriptUpdate={setScript}
                  />
                </TabPanel>

                <TabPanel>
                  <SceneVideoTab
                    activeChapterIndex={activeChapterIndex}
                    activeSceneIndex={activeSceneIndex}
                    projectName={projectName}
                    cardBg={cardBg}
                    bgColor={bgColor}
                    borderColor={borderColor}
                    script={script}
                    videoKey={videoKey}
                    setVideoKey={setVideoKey}
                  />
                </TabPanel>

              </TabPanels>
            </Tabs>
          </Box>
        </Flex>
      </Box>

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
