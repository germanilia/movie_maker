import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  Button,
  useToast,
  Badge,
  HStack,
  IconButton,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useColorModeValue,
  Progress,
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
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute,
  FaRedo,
  FaEdit,
} from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';

interface NarrationBoxProps {
  audioData: Record<string, string>;
  chapterIndex: number;
  sceneIndex: number;
  projectName: string;
  narrationText: string;
  onNarrationUpdate?: (newText: string) => void;
}

const NarrationBox: React.FC<NarrationBoxProps> = ({
  audioData,
  chapterIndex,
  sceneIndex,
  projectName,
  narrationText: initialNarrationText,
  onNarrationUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [localNarrationText, setLocalNarrationText] = useState(initialNarrationText);
  const [editedNarration, setEditedNarration] = useState(initialNarrationText);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<NodeJS.Timeout>();
  const toast = useToast();
  const { isOpen: isRegenerateModalOpen, onOpen: onRegenerateModalOpen, onClose: onRegenerateModalClose } = useDisclosure();
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();

  const audioKey = `${chapterIndex + 1}-${sceneIndex + 1}`;
  const audioPath = `/temp/${projectName}/chapter_${chapterIndex + 1}/scene_${sceneIndex + 1}/narration.wav`;
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Update local state when prop changes
  useEffect(() => {
    setLocalNarrationText(initialNarrationText);
    setEditedNarration(initialNarrationText);
  }, [initialNarrationText]);

  const resetAudioState = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.load(); // Reload the audio element
    }
  };

  const handlePlay = async () => {
    if (!audioRef.current || !audioPath) {
      toast({
        title: 'Error',
        description: 'Audio source not available',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Check if the file exists first
    try {
      const response = await fetch(audioPath);
      if (!response.ok) {
        throw new Error(`Audio file not found at ${audioPath}`);
      }

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error('Error playing audio:', error);
            toast({
              title: 'Error',
              description: `Failed to play audio: ${error.message}`,
              status: 'error',
              duration: 3000,
              isClosable: true,
            });
          });
        }
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error checking audio file:', error);
      toast({
        title: 'Error',
        description: 'Audio file not found or inaccessible',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setAudioError(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleVolumeChange = (value: number) => {
    if (audioRef.current) {
      audioRef.current.volume = value;
      setVolume(value);
      setIsMuted(value === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const regenerateNarration = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-narration/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterIndex + 1,
            scene_number: sceneIndex + 1,
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate narration');
      }

      const result = await response.json();
      
      // Update local state
      setLocalNarrationText(result.narration);
      setEditedNarration(result.narration);
      resetAudioState();
      setAudioError(false);

      // Notify parent component
      if (onNarrationUpdate) {
        onNarrationUpdate(result.narration);
      }

      toast({
        title: 'Success',
        description: 'Narration regenerated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onRegenerateModalClose();
      setRegenerateInstructions('');
    } catch (error) {
      console.error('Error regenerating narration:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate narration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateNarration = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/update-narration/${projectName}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterIndex + 1,
            scene_number: sceneIndex + 1,
            narration_text: editedNarration,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update narration');
      }

      // Update local state
      setLocalNarrationText(editedNarration);
      resetAudioState();
      setAudioError(false);

      // Notify parent component
      if (onNarrationUpdate) {
        onNarrationUpdate(editedNarration);
      }

      toast({
        title: 'Success',
        description: 'Narration updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEditModalClose();
    } catch (error) {
      console.error('Error updating narration:', error);
      toast({
        title: 'Error',
        description: 'Failed to update narration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      p={4} 
      borderWidth={1} 
      borderRadius="md" 
      bg={bgColor}
      borderColor={borderColor}
      position="relative"
    >
      {isLoading && (
        <Progress 
          size="xs" 
          isIndeterminate 
          position="absolute"
          top={0}
          left={0}
          right={0}
        />
      )}
      
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Badge 
            colorScheme={!audioError ? 'green' : 'gray'}
            variant="subtle"
            px={2}
            py={1}
          >
            {!audioError ? 'Narration Ready' : 'No Narration'}
          </Badge>
          <HStack spacing={2}>
            <Button
              size="sm"
              leftIcon={<ChakraIcon icon={FaEdit} />}
              onClick={onEditModalOpen}
              colorScheme="blue"
              variant="ghost"
            >
              Edit
            </Button>
            <Button
              size="sm"
              leftIcon={<ChakraIcon icon={FaRedo} />}
              onClick={onRegenerateModalOpen}
              colorScheme="blue"
              variant="ghost"
            >
              Regenerate
            </Button>
          </HStack>
        </HStack>

        <Box 
          p={3} 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          borderRadius="md"
          fontSize="sm"
        >
          <Text>{localNarrationText}</Text>
        </Box>

        <>
          <audio
            ref={audioRef}
            src={audioPath}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => {
              console.warn('Audio loading error (file may not yet be generated):', e);
            }}
            style={{ display: 'none' }}
          />

          <VStack spacing={2} align="stretch">
            <HStack spacing={4}>
              <IconButton
                aria-label={isPlaying ? 'Pause' : 'Play'}
                icon={isPlaying ? <ChakraIcon icon={FaPause} /> : <ChakraIcon icon={FaPlay} />}
                onClick={handlePlay}
                isRound
                colorScheme="blue"
                size="sm"
              />
              
              <Text fontSize="sm" flex={1}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>

              <HStack width="120px" spacing={2}>
                <IconButton
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  icon={isMuted ? <ChakraIcon icon={FaVolumeMute} /> : <ChakraIcon icon={FaVolumeUp} />}
                  onClick={toggleMute}
                  size="sm"
                  variant="ghost"
                />
                <Slider
                  aria-label="Volume slider"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  min={0}
                  max={1}
                  step={0.1}
                  width="80px"
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </HStack>
            </HStack>

            <Slider
              aria-label="Audio progress"
              value={currentTime}
              onChange={handleSeek}
              min={0}
              max={duration}
              step={0.1}
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          </VStack>
        </>
      </VStack>

      {/* Regenerate Modal */}
      <Modal isOpen={isRegenerateModalOpen} onClose={onRegenerateModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Regenerate Narration</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Enter instructions for regenerating the narration. These instructions will help guide the AI in creating a new version.
            </Text>
            <Textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="Enter instructions for narration regeneration..."
              size="lg"
              rows={6}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRegenerateModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={regenerateNarration}
              isLoading={isLoading}
              loadingText="Regenerating"
            >
              Regenerate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={onEditModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Narration</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Edit the narration text directly. The audio will be regenerated with your changes.
            </Text>
            <Textarea
              value={editedNarration}
              onChange={(e) => setEditedNarration(e.target.value)}
              placeholder="Enter narration text..."
              size="lg"
              rows={6}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={updateNarration}
              isLoading={isLoading}
              loadingText="Updating"
            >
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default NarrationBox;