import React, { useState } from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  HStack,
  Button,
  Icon,
  Spinner,
  Text,
  AspectRatio,
  Box,
  useToast,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { FaRedo } from 'react-icons/fa';
import { Script } from '../../models/models';

interface SceneVideoTabProps {
  activeChapterIndex: number;
  activeSceneIndex: number;
  projectName: string;
  cardBg: string;
  bgColor: string;
  borderColor: string;
  script: Script;
  videoKey: number;
  setVideoKey: React.Dispatch<React.SetStateAction<number>>;
}

interface GenerateSceneVideoRequest {
  chapter_number: number;
  scene_number: number;
  black_and_white: boolean;
}

const SceneVideoTab: React.FC<SceneVideoTabProps> = ({
  activeChapterIndex,
  activeSceneIndex,
  projectName,
  cardBg,
  bgColor,
  borderColor,
  script,
  videoKey,
  setVideoKey,
}) => {
  const toast = useToast();
  const [generatingVideoFor, setGeneratingVideoFor] = useState<{ chapter: number; scene: number } | null>(null);
  const [isBlackAndWhite, setIsBlackAndWhite] = useState<boolean>(script?.project_details?.black_and_white || false);

  const handleGenerateSceneVideo = async () => {
    if (generatingVideoFor) return;

    setGeneratingVideoFor({ chapter: activeChapterIndex, scene: activeSceneIndex });

    try {
      const request: GenerateSceneVideoRequest = {
        chapter_number: activeChapterIndex + 1,
        scene_number: activeSceneIndex + 1,
        black_and_white: isBlackAndWhite
      };

      const response = await fetch(
        `http://localhost:8000/api/generate-scene-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate scene video');
      }

      setVideoKey(prev => prev + 1);
      toast({
        title: 'Success',
        description: 'Scene video generation completed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error generating scene video:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate scene video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  return (
    <VStack spacing={6} align="stretch">
      <Card variant="outline" bg={bgColor}>
        <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <Heading size="sm">Final Scene Video</Heading>
              <Button
                colorScheme="blue"
                size="sm"
                leftIcon={
                  generatingVideoFor?.chapter === activeChapterIndex && 
                  generatingVideoFor?.scene === activeSceneIndex ? 
                    <Spinner size="sm" /> : 
                    <Icon as={FaRedo} />
                }
                onClick={handleGenerateSceneVideo}
                isLoading={
                  generatingVideoFor?.chapter === activeChapterIndex && 
                  generatingVideoFor?.scene === activeSceneIndex
                }
                loadingText="Generating"
                isDisabled={generatingVideoFor !== null}
              >
                Generate Video
              </Button>
            </HStack>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="black-and-white" mb="0" fontSize="sm">
                Black & White
              </FormLabel>
              <Switch
                id="black-and-white"
                size="sm"
                isChecked={isBlackAndWhite}
                onChange={(e) => setIsBlackAndWhite(e.target.checked)}
              />
            </FormControl>
          </VStack>
        </CardHeader>
        <CardBody>
          <AspectRatio ratio={16/9}>
            <Box position="relative">
              <video
                key={videoKey}
                controls
                src={`/api/get-scene-video/${projectName}/${activeChapterIndex + 1}/${script.chapters[activeChapterIndex]?.scenes?.[activeSceneIndex]?.scene_number}?v=${videoKey}`}
                style={{ width: '100%', borderRadius: '8px' }}
              >
                Your browser does not support the video tag.
              </video>
            </Box>
          </AspectRatio>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default SceneVideoTab; 