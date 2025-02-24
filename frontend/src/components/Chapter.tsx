import React from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Text,
  VStack,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Textarea,
  useDisclosure,
  HStack,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { Chapter as ChapterType, Script, Scene as SceneType } from '../models/models';
import Scene from './Scene';
import { FaRedo } from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';

interface ChapterProps {
  chapter: ChapterType;
  chapterIndex: number;
  projectName: string;
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

const Chapter: React.FC<ChapterProps> = ({
  chapter,
  chapterIndex,
  projectName,
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
  const [regenerateInstructions, setRegenerateInstructions] = React.useState('');
  const [isRegeneratingChapter, setIsRegeneratingChapter] = React.useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const initialFocusRef = React.useRef(null);
  const finalFocusRef = React.useRef(null);

  const handleRegenerateChapter = async () => {
    setIsRegeneratingChapter(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-chapter/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: chapterIndex + 1,
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate chapter');
      }

      const updatedScript = await response.json();
      onScriptUpdate(updatedScript);
      onClose();
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
      setIsRegeneratingChapter(false);
    }
  };

  const handleModalClose = () => {
    setRegenerateInstructions('');
    onClose();
  };

  return (
    <>
      <Box mb={8} pb={4} borderBottomWidth="1px" borderColor="gray.200" _last={{ borderBottom: 'none' }}>
        <VStack align="stretch" spacing={3}>
          <Box p={3} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.100">
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between">
                <Text fontSize="md" fontWeight="bold" color="blue.700">
                  Chapter {chapter.chapter_number}
                </Text>
                <Button
                  leftIcon={<ChakraIcon icon={FaRedo} />}
                  colorScheme="blue"
                  size="xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen();
                  }}
                  isLoading={isRegeneratingChapter}
                  zIndex={1}
                >
                  Regenerate
                </Button>
              </HStack>
              <Text fontSize="sm" color="blue.600" noOfLines={1}>{chapter.chapter_title}</Text>
            </VStack>
          </Box>

          <VStack spacing={2} align="stretch" pl={2}>
            {(chapter.scenes || []).map((scene: SceneType, sceneIndex: number) => (
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
                onScriptUpdate={onScriptUpdate}
              />
            ))}
          </VStack>
        </VStack>
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
            <ModalHeader>Chapter Regeneration Instructions</ModalHeader>
            <ModalCloseButton tabIndex={0} />
            <ModalBody>
              <Text mb={4}>
                Enter any specific instructions for regenerating this chapter. These instructions will help guide the AI in creating a new version of the chapter.
              </Text>
              <Textarea
                ref={initialFocusRef}
                value={regenerateInstructions}
                onChange={(e) => setRegenerateInstructions(e.target.value)}
                placeholder="Enter instructions for chapter regeneration..."
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
                onClick={handleRegenerateChapter}
                isLoading={isRegeneratingChapter}
                loadingText="Regenerating Chapter"
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

export default Chapter;