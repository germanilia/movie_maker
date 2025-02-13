import React, { useState } from 'react';
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
} from '@chakra-ui/react';
import { Script } from '../models/models';

interface VideoPreviewProps {
  script: Script | null;
  projectName: string;
  onBack: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  script,
  projectName,
  onBack,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const handleGenerateVideo = async () => {
    if (!script) return;

    setIsGenerating(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(script),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start video generation');
      }

      toast({
        title: 'Success',
        description: 'Video generation has started',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: 'Error',
        description: 'Failed to start video generation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
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
          <Heading size="lg">Generate Video</Heading>
          <HStack spacing={4}>
            <Button onClick={onBack}>Back</Button>
            <Button
              colorScheme="blue"
              onClick={handleGenerateVideo}
              isLoading={isGenerating}
              loadingText="Generating Video"
            >
              Generate Video
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box 
        position="relative"
        height="calc(100vh - 72px)" 
        overflowY="auto"
      >
        <VStack spacing={6} p={4}>
          {isGenerating ? (
            <Center h="200px">
              <VStack spacing={4}>
                <Spinner size="xl" />
                <Text>Generating your video...</Text>
                <Text fontSize="sm" color="gray.500">This may take several minutes</Text>
              </VStack>
            </Center>
          ) : (
            <Text>Click "Generate Video" to begin the video generation process.</Text>
          )}
        </VStack>
      </Box>
    </Box>
  );
};

export default VideoPreview;