import React, { useState, useRef } from 'react';
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
} from '@chakra-ui/react';
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute,
  FaRedo
} from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';

interface NarrationBoxProps {
  audioData: Record<string, string>;
  chapterIndex: number;
  sceneIndex: number;
  projectName: string;
}

const NarrationBox: React.FC<NarrationBoxProps> = ({
  audioData,
  chapterIndex,
  sceneIndex,
  projectName
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<NodeJS.Timeout>();
  const toast = useToast();

  const audioKey = `${chapterIndex + 1}-${sceneIndex + 1}`;
  const audioPath = `/temp/${projectName}/chapter_${chapterIndex + 1}/scene_${sceneIndex + 1}/narration.wav`;
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
        `http://localhost:8000/api/generate-narration/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterIndex + 1,
            scene_number: sceneIndex + 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate narration');
      }

      toast({
        title: 'Success',
        description: 'Narration regenerated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error regenerating narration:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate narration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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
          <Button
            size="sm"
            leftIcon={<ChakraIcon icon={FaRedo} />}
            onClick={regenerateNarration}
            isLoading={isLoading}
            loadingText="Regenerating"
            colorScheme="blue"
            variant="ghost"
          >
            Regenerate
          </Button>
        </HStack>

        <>
          <audio
            ref={audioRef}
            src={audioPath}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={(e) => {
              console.error('Audio loading error:', e);
              setAudioError(true);
              toast({
                title: 'Error',
                description: 'Failed to load narration audio',
                status: 'error',
                duration: 3000,
                isClosable: true,
              });
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
    </Box>
  );
};

export default NarrationBox;