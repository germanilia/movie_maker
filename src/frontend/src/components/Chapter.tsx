import React from 'react';
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
} from '@chakra-ui/react';
import { Chapter as ChapterType, Script } from '../models/models';
import Scene from './Scene';

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
  handleGenerateBackgroundMusic: (chapterNumber: number, sceneNumber: number) => Promise<void>;
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

  return (
    <AccordionItem>
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
          {/* Modal for regeneration instructions */}
          <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Chapter Regeneration Instructions</ModalHeader>
              <ModalCloseButton />
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
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={handleRegenerateChapter}
                  isLoading={isRegeneratingChapter}
                  loadingText="Regenerating Chapter"
                >
                  Regenerate
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Box display="flex" alignItems="center" gap={4}>
            <Button
              colorScheme="blue"
              onClick={onOpen}
              isLoading={isRegeneratingChapter}
              loadingText="Regenerating Chapter"
            >
              Regenerate Chapter
            </Button>
          </Box>

          <Box bg="gray.50" p={3} borderRadius="md">
            <Text>{chapter.description}</Text>
          </Box>

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
              onScriptUpdate={onScriptUpdate}
            />
          ))}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export default Chapter;