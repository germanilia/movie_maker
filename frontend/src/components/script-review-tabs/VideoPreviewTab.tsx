import React, { useState, useEffect } from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  HStack,
  Badge,
  useToast,
  Box,
  AspectRatio,
  Button,
  Icon,
  Spinner,
  Text,
  Select,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { FaRedo } from 'react-icons/fa';
import { Shot } from '../../models/models';
import { fetchSceneData, generateVideo } from '../../services/sceneDataService';

interface VideoPreviewTabProps {
  shots: Shot[];
  activeChapterIndex: number;
  activeSceneIndex: number;
  projectName: string;
  cardBg: string;
  bgColor: string;
  borderColor: string;
}

const VideoPreviewTab: React.FC<VideoPreviewTabProps> = ({
  shots,
  activeChapterIndex,
  activeSceneIndex,
  projectName,
  cardBg,
  bgColor,
  borderColor,
}) => {
  const toast = useToast();
  const [generatingVideoFor, setGeneratingVideoFor] = useState<number | null>(null);
  const [videoData, setVideoData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('replicate');

  const loadSceneData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/get-scene-videos/${projectName}/${activeChapterIndex + 1}/${activeSceneIndex + 1}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      if (data.status === 'success' && data.videos) {
        setVideoData(data.videos);
      }
    } catch (error) {
      console.error('Error loading scene data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scene data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSceneData();
  }, [activeChapterIndex, activeSceneIndex, projectName]);

  const handleGenerateVideo = async (shotIndex: number) => {
    if (generatingVideoFor !== null) return;
    setGeneratingVideoFor(shotIndex);

    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-shot-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: activeChapterIndex + 1,
            scene_number: activeSceneIndex + 1,
            shot_number: shotIndex + 1,
            provider: selectedModel,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      await loadSceneData();
      
      toast({
        title: 'Success',
        description: 'Shot video generated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <FormControl>
        <FormLabel>Video Generation Model</FormLabel>
        <Select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          bg={bgColor}
        >
          <option value="replicate">Replicate</option>
          <option value="runwayml">Runway ML</option>
        </Select>
      </FormControl>

      {shots?.map((shot, shotIndex) => (
        <Card key={shotIndex} variant="outline" bg={bgColor}>
          <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
            <HStack justify="space-between">
              <Heading size="sm">Shot {shotIndex + 1}</Heading>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  colorScheme="blue"
                  leftIcon={
                    generatingVideoFor === shotIndex ? 
                      <Spinner size="sm" /> : 
                      <Icon as={FaRedo} />
                  }
                  onClick={() => handleGenerateVideo(shotIndex)}
                  isLoading={generatingVideoFor === shotIndex}
                  loadingText="Generating"
                  isDisabled={generatingVideoFor !== null}
                >
                  Generate Video
                </Button>
                <Badge
                  colorScheme={videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`] ? 'green' : 'gray'}
                >
                  {videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`] ? 'Rendered' : 'Pending'}
                </Badge>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <Box borderWidth="1px" borderRadius="md" borderColor={borderColor} overflow="hidden">
              <AspectRatio ratio={16/9}>
                <Box position="relative" bg="gray.100" _dark={{ bg: 'gray.700' }}>
                  {videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`] ? (
                    <video
                      controls
                      style={{ width: '100%', borderRadius: '8px' }}
                    >
                      <source 
                        src={`data:video/mp4;base64,${videoData[`${activeChapterIndex + 1}-${activeSceneIndex + 1}-${shotIndex + 1}`]}`} 
                        type="video/mp4" 
                      />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <VStack justify="center" spacing={2}>
                      <Text color="gray.500">No video generated yet</Text>
                      <Text fontSize="sm" color="gray.400">Click "Generate Video" to create one</Text>
                    </VStack>
                  )}
                </Box>
              </AspectRatio>
            </Box>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
};

export default VideoPreviewTab; 