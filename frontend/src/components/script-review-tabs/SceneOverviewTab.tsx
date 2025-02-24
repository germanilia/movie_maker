import React from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Box,
} from '@chakra-ui/react';
import { Chapter } from '../../models/models';

interface SceneOverviewTabProps {
  currentChapter: Chapter;
  activeSceneIndex: number;
  cardBg: string;
  bgColor: string;
  borderColor: string;
}

const SceneOverviewTab: React.FC<SceneOverviewTabProps> = ({
  currentChapter,
  activeSceneIndex,
  cardBg,
  bgColor,
  borderColor,
}) => {
  return (
    <VStack spacing={6} align="stretch">
      <Card variant="outline" bg={bgColor}>
        <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
          <Heading size="sm">Scene Details</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Box>
              <Heading size="xs" mb={2}>Chapter Description</Heading>
              <Text>{currentChapter.chapter_description}</Text>
            </Box>
            <Box>
              <Heading size="xs" mb={2}>Main Story</Heading>
              <Text>{currentChapter.scenes?.[activeSceneIndex]?.main_story}</Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default SceneOverviewTab; 