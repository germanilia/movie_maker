import React, { useState } from 'react';
import {
  Box,
  VStack,
  Text,
  Button,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  HStack,
  Badge,
  Progress,
  Card,
  CardHeader,
  CardBody,
  useColorModeValue,
  Divider,
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
import { Scene as SceneType, Shot, Script } from '../models/models';
import { MdAudiotrack, MdVideocam, MdDirections } from 'react-icons/md';
import { FaRedo } from 'react-icons/fa';
import BackgroundMusic from './BackgroundMusic';
import NarrationBox from './NarrationBox';
import DirectorInstructions from './DirectorInstructions';
import ShotVideo from './ShotVideo';
import ImageDisplay from './ImageDisplay';
import { createPortal } from 'react-dom';
import { ChakraIcon } from './utils/ChakraIcon';

interface SceneProps {
  scene: SceneType;
  projectName: string;
  chapterNumber: number;
  chapterIndex: number;
  sceneIndex: number;
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
  handleGenerateBackgroundMusic: (chapterNumber: number, sceneNumber: number, style?: string) => Promise<void>;
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
  projectName,
  chapterNumber,
  chapterIndex,
  sceneIndex,
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
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [isRegeneratingScene, setIsRegeneratingScene] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const progressBg = useColorModeValue('gray.100', 'gray.700');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  const [isActive, setIsActive] = React.useState(false);
  const initialFocusRef = React.useRef(null);
  const finalFocusRef = React.useRef(null);

  React.useEffect(() => {
    // Check if this scene is currently active
    const checkInitialActiveState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentChapter = parseInt(urlParams.get('chapter') || '1') - 1;
      const currentScene = parseInt(urlParams.get('scene') || '1') - 1;
      setIsActive(currentChapter === chapterIndex && currentScene === sceneIndex);
    };

    checkInitialActiveState();

    const handleSceneSelection = (event: CustomEvent<{ chapterIndex: number; sceneIndex: number }>) => {
      setIsActive(event.detail.chapterIndex === chapterIndex && event.detail.sceneIndex === sceneIndex);
      
      // Update URL when scene is selected
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('chapter', String(event.detail.chapterIndex + 1));
      newUrl.searchParams.set('scene', String(event.detail.sceneIndex + 1));
      window.history.pushState({}, '', newUrl);
    };

    window.addEventListener('scene-selected', handleSceneSelection as EventListener);
    window.addEventListener('popstate', checkInitialActiveState);

    return () => {
      window.removeEventListener('scene-selected', handleSceneSelection as EventListener);
      window.removeEventListener('popstate', checkInitialActiveState);
    };
  }, [chapterIndex, sceneIndex]);

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
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate scene');
      }

      const updatedScript = await response.json();
      onScriptUpdate(updatedScript);
      onClose();
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
      setIsRegeneratingScene(false);
    }
  };

  const handleModalClose = () => {
    setRegenerateInstructions('');
    onClose();
  };

  const totalShots = scene.shots?.length || 0;
  const completedShots = scene.shots?.filter(shot => 
    imageData[getImageKey(chapterIndex, sceneIndex, shot.shot_number - 1, 'opening')] &&
    videoData[`${chapterNumber}-${scene.scene_number}-${shot.shot_number}`]
  ).length || 0;
  const progress = (completedShots / totalShots) * 100;

  return (
    <>
      <Box 
        as="button" 
        width="100%" 
        cursor="pointer"
        transition="all 0.2s"
        _hover={{ transform: 'translateX(2px)' }}
        onClick={() => {
          const event = new CustomEvent('scene-selected', {
            detail: { chapterIndex, sceneIndex }
          });
          window.dispatchEvent(event);
        }}
        data-chapter-index={chapterIndex}
        data-scene-index={sceneIndex}
      >
        <Card 
          bg={isActive ? 'blue.50' : bgColor}
          shadow="none" 
          mb={1} 
          borderWidth="1px" 
          borderColor={isActive ? 'blue.300' : 'gray.200'}
          _hover={{ 
            bg: isActive ? 'blue.100' : 'blue.50',
            borderColor: 'blue.300'
          }}
          transform={isActive ? 'translateX(2px)' : 'none'}
          transition="all 0.2s"
        >
          <CardHeader bg={isActive ? 'blue.50' : 'white'} p={2}>
            <VStack spacing={1} align="stretch">
              <HStack justify="space-between" width="100%">
                <HStack spacing={2}>
                  <Text fontSize="sm" color="gray.700">Scene {scene.scene_number}</Text>
                  <Badge variant="outline" colorScheme="blue" fontSize="xs">
                    {completedShots}/{totalShots}
                  </Badge>
                </HStack>
                <Button
                  leftIcon={<ChakraIcon icon={FaRedo} />}
                  colorScheme="blue"
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen();
                  }}
                  isLoading={isRegeneratingScene}
                >
                  Regenerate
                </Button>
              </HStack>
              <Text fontSize="xs" color="gray.600" noOfLines={2}>{scene.main_story}</Text>
            </VStack>
          </CardHeader>
        </Card>
      </Box>

      {createPortal(
        <Modal 
          isOpen={isOpen} 
          onClose={handleModalClose}
          initialFocusRef={initialFocusRef}
          finalFocusRef={finalFocusRef}
          size="xl"
          closeOnEsc={true}
          closeOnOverlayClick={true}
          isCentered
          blockScrollOnMount={true}
          trapFocus={true}
          returnFocusOnClose={true}
          useInert={true}
          autoFocus={true}
        >
          <ModalOverlay 
            bg="blackAlpha.800"
            backdropFilter="blur(3px)"
            backdropInvert="5%"
          />
          <ModalContent 
            position="relative"
            mx={4}
            my={3}
            maxHeight="calc(100vh - 80px)"
            overflow="auto"
            borderRadius="md"
            boxShadow="dark-lg"
          >
            <ModalHeader>Scene Regeneration Instructions</ModalHeader>
            <ModalCloseButton tabIndex={0} />
            <ModalBody>
              <Text mb={4}>
                Enter any specific instructions for regenerating this scene. These instructions will help guide the AI in creating a new version of the scene.
              </Text>
              <Textarea
                ref={initialFocusRef}
                value={regenerateInstructions}
                onChange={(e) => setRegenerateInstructions(e.target.value)}
                placeholder="Enter instructions for scene regeneration..."
                size="lg"
                rows={6}
                tabIndex={0}
                _focus={{
                  borderColor: "blue.400",
                  boxShadow: "0 0 0 1px blue.400",
                  zIndex: 1
                }}
              />
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="ghost" 
                mr={3} 
                onClick={handleModalClose}
                tabIndex={0}
                ref={finalFocusRef}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleRegenerateScene}
                isLoading={isRegeneratingScene}
                loadingText="Regenerating Scene"
                tabIndex={0}
              >
                Regenerate
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>,
        document.body
      )}
    </>
  );
};

export default Scene;
