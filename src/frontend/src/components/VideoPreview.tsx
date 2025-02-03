import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  AspectRatio,
  useToast,
} from '@chakra-ui/react';

interface VideoPreviewProps {
  projectName: string;
  onBack: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ projectName, onBack }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    checkVideoStatus();
  }, []);

  const checkVideoStatus = async () => {
    try {
      // This endpoint would need to be implemented to check video generation status
      const response = await fetch(`http://localhost:8000/api/video-status/${projectName}`);
      if (!response.ok) {
        throw new Error('Failed to check video status');
      }

      const data = await response.json();
      if (data.status === 'completed') {
        setVideoUrl(data.url);
      } else if (data.status === 'processing') {
        // Check again in 5 seconds
        setTimeout(checkVideoStatus, 5000);
      } else {
        throw new Error('Video generation failed');
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check video status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {videoUrl ? (
          <AspectRatio ratio={16 / 9}>
            <video controls>
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </AspectRatio>
        ) : (
          <Box
            height="400px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderWidth="1px"
            borderRadius="lg"
          >
            <Text>Generating video... Please wait.</Text>
          </Box>
        )}

        <HStack spacing={4} justify="flex-end">
          <Button onClick={onBack}>Back</Button>
          {videoUrl && (
            <Button
              as="a"
              href={videoUrl}
              download={`${projectName}_video.mp4`}
              colorScheme="blue"
            >
              Download Video
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

export default VideoPreview; 