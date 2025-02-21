import React, { useState, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  IconButton,
  Button,
  Text,
  Badge,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useColorModeValue,
  Progress,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute,
  FaMusic,
  FaChevronDown,
  FaRedo
} from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';

interface BackgroundMusicProps {
  audioData: Record<string, string>;
  isGenerating: boolean;
  onGenerateMusic: (style?: string) => Promise<void>;  // Updated to accept style parameter
  chapterIndex: number;
  sceneIndex: number;
  projectName: string;
}

const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
  audioData,
  isGenerating,
  onGenerateMusic,
  chapterIndex,
  sceneIndex,
  projectName
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('Cinematic');
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const audioKey = `${chapterIndex + 1}-${sceneIndex + 1}`;
  const audioPath = `/temp/${projectName}/chapter_${chapterIndex + 1}/scene_${sceneIndex + 1}/background_music.mp3`;
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hasExistingMusic = !audioError;

  const musicStyles = [
    'Cinematic',
    'Ambient',
    'Dramatic',
    'Uplifting',
    'Mysterious',
    'Emotional'
  ];

  const handlePlay = async () => {
    if (!audioRef.current || !audioPath) {
      alert('Audio source not available');
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
            setIsPlaying(false);
            alert(`Failed to play audio: ${error.message}`);
          });
        }
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error checking audio file:', error);
      alert('Audio file not found or inaccessible');
      setAudioError(true);
      setIsPlaying(false);
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

  return (
    <Box 
      p={4} 
      borderWidth={1} 
      borderRadius="md" 
      bg={bgColor}
      borderColor={borderColor}
      position="relative"
    >
      {isGenerating && (
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
            {!audioError ? 'Music Ready' : 'No Music'}
          </Badge>
          
          <HStack spacing={2}>
            <Menu>
              <MenuButton 
                as={Button} 
                size="sm" 
                rightIcon={<ChakraIcon icon={FaChevronDown} />}
                leftIcon={<ChakraIcon icon={FaMusic} />}
                variant="outline"
              >
                {selectedStyle}
              </MenuButton>
              <MenuList>
                {musicStyles.map((style) => (
                  <MenuItem 
                    key={style}
                    onClick={() => setSelectedStyle(style)}
                  >
                    {style}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            
            <Button
              size="sm"
              onClick={() => onGenerateMusic(selectedStyle)}
              isLoading={isGenerating}
              loadingText={hasExistingMusic ? "Regenerating" : "Generating"}
              colorScheme="blue"
              variant={hasExistingMusic ? "ghost" : "solid"}
              leftIcon={hasExistingMusic ? <ChakraIcon icon={FaRedo} /> : undefined}
            >
              {hasExistingMusic ? "Regenerate" : "Generate Music"}
            </Button>
          </HStack>
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
              setIsPlaying(false);
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

export default BackgroundMusic;