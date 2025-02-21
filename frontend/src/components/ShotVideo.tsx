import React, { useState, useRef } from 'react';
import {
  Box,
  IconButton,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  VStack,
  useColorModeValue,
  Progress,
  Badge,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import {
  FaPlay,
  FaPause,
  FaExpand,
  FaCompress,
  FaVolumeUp,
  FaVolumeMute,
  FaDownload,
  FaCog,
  FaChevronDown,
} from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';

interface ShotVideoProps {
  videoData: string;
  chapterIndex: number;
  sceneIndex: number;
  shotIndex: number;
}

const ShotVideo: React.FC<ShotVideoProps> = ({
  videoData,
  chapterIndex,
  sceneIndex,
  shotIndex
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (value: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleVolumeChange = (value: number) => {
    if (videoRef.current) {
      videoRef.current.volume = value;
      setVolume(value);
      setIsMuted(value === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleDownload = () => {
    if (videoData) {
      const link = document.createElement('a');
      link.href = videoData;
      link.download = `shot-${chapterIndex + 1}-${sceneIndex + 1}-${shotIndex + 1}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Box 
      ref={containerRef}
      borderWidth={1} 
      borderRadius="md" 
      overflow="hidden"
      bg={bgColor}
      borderColor={borderColor}
      position="relative"
    >
      {isLoading && videoData && (
        <Progress 
          size="xs" 
          isIndeterminate 
          position="absolute"
          top={0}
          left={0}
          right={0}
          zIndex={1}
        />
      )}

      <video
        ref={videoRef}
        src={videoData}
        style={{ 
          width: '100%',
          backgroundColor: 'black',
          display: videoData ? 'block' : 'none'
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {!videoData ? (
        <Box p={4} textAlign="center">
          <Badge colorScheme="yellow">Video not yet generated</Badge>
        </Box>
      ) : (
        <VStack spacing={2} p={2}>
          <Slider
            aria-label="Video progress"
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

          <HStack width="100%" justify="space-between">
            <HStack spacing={2}>
              <IconButton
                aria-label={isPlaying ? 'Pause' : 'Play'}
                icon={isPlaying ? <ChakraIcon icon={FaPause} /> : <ChakraIcon icon={FaPlay} />}
                onClick={handlePlay}
                size="sm"
                colorScheme="blue"
              />
              
              <Text fontSize="sm" minWidth="100px">
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

            <HStack spacing={2}>
              <Menu>
                <MenuButton
                  as={Button}
                  size="sm"
                  rightIcon={<ChakraIcon icon={FaChevronDown} />}
                  leftIcon={<ChakraIcon icon={FaCog} />}
                  variant="ghost"
                >
                  {playbackSpeed}x
                </MenuButton>
                <MenuList>
                  {playbackSpeeds.map((speed) => (
                    <MenuItem
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                    >
                      {speed}x
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>

              <IconButton
                aria-label="Download video"
                icon={<ChakraIcon icon={FaDownload} />}
                onClick={handleDownload}
                size="sm"
                variant="ghost"
              />

              <IconButton
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                icon={isFullscreen ? <ChakraIcon icon={FaCompress} /> : <ChakraIcon icon={FaExpand} />}
                onClick={toggleFullscreen}
                size="sm"
                variant="ghost"
              />
            </HStack>
          </HStack>
        </VStack>
      )}
    </Box>
  );
};

export default ShotVideo;