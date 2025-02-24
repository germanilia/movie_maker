import React from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  useToast,
} from '@chakra-ui/react';
import DirectorInstructions from '../DirectorInstructions';
import { Shot } from '../../models/models';

interface ShotInstructionsTabProps {
  shots: Shot[];
  activeChapterIndex: number;
  activeSceneIndex: number;
  projectName: string;
  cardBg: string;
  bgColor: string;
  borderColor: string;
}

const ShotInstructionsTab: React.FC<ShotInstructionsTabProps> = ({
  shots,
  activeChapterIndex,
  activeSceneIndex,
  projectName,
  cardBg,
  bgColor,
  borderColor,
}) => {
  const toast = useToast();

  const handleUpdateShotInstructions = async (
    shotIndex: number,
    newInstructions: string
  ) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/update-shot-instructions/${projectName}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: activeChapterIndex + 1,
            scene_index: activeSceneIndex + 1,
            shot_index: shotIndex + 1,
            instructions: newInstructions,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update shot instructions');
      }

      toast({
        title: 'Success',
        description: 'Shot instructions updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating shot instructions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update shot instructions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={6} align="stretch">
      {shots?.map((shot, index) => (
        <Card key={index} variant="outline" bg={bgColor}>
          <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
            <Heading size="sm">Shot {index + 1} Instructions</Heading>
          </CardHeader>
          <CardBody>
            <DirectorInstructions
              instructions={shot.director_instructions || ''}
              handleUpdate={(newInstructions) =>
                handleUpdateShotInstructions(index, newInstructions)
              }
              reasoning={shot.reasoning || ''}
            />
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
};

export default ShotInstructionsTab; 