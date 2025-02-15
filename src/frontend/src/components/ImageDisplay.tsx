import React from 'react';
import {
  Box,
  Button,
  HStack,
  Text,
  Image,
} from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';

interface ImageDisplayProps {
  imageKey: string;
  imageData: string | undefined;
  description: string;
  type: 'opening' | 'closing';
  isGenerating: boolean;
  onGenerateImage: () => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageKey,
  imageData,
  description,
  type,
  isGenerating,
  onGenerateImage,
}) => {
  const bgColor = type === 'opening' ? 'teal.50' : 'pink.50';
  const textColor = type === 'opening' ? 'teal.800' : 'pink.800';
  const buttonColor = type === 'opening' ? 'teal' : 'pink';

  return (
    <Box bg={bgColor} p={3} borderRadius="md">
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold">{type === 'opening' ? 'Opening' : 'Closing'} Scene Description:</Text>
        <HStack spacing={2}>
          {/* Add future action buttons here */}
          <Button
            size="sm"
            colorScheme={buttonColor}
            onClick={onGenerateImage}
            isLoading={isGenerating}
            loadingText="Generating"
            leftIcon={<RepeatIcon />}
          >
            Generate Image
          </Button>
        </HStack>
      </HStack>
      
      <Text color={textColor} mb={2}>{description}</Text>
      
      {imageData && (
        <Box mt={4}>
          <Image
            src={imageData}
            alt={`${type} scene`}
            maxH="300px"
            objectFit="contain"
            w="100%"
            borderRadius="md"
          />
        </Box>
      )}
    </Box>
  );
};

export default ImageDisplay;