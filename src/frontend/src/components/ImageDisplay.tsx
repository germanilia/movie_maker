import React, { useState } from 'react';
import {
  Box,
  Button,
  HStack,
  Text,
  Image,
  Textarea,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';

interface ImageDisplayProps {
  imageKey: string;
  imageData: string | undefined;
  description: string;
  type: 'opening' | 'closing';
  isGenerating: boolean;
  onGenerateImage: () => void;
  onUpdateDescription?: (newDescription: string) => Promise<void>;
  chapterIndex?: number;
  sceneIndex?: number;
  shotIndex?: number;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageKey,
  imageData,
  description,
  type,
  isGenerating,
  onGenerateImage,
  onUpdateDescription,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const bgColor = type === 'opening' ? 'teal.50' : 'pink.50';
  const textColor = type === 'opening' ? 'teal.800' : 'pink.800';
  const buttonColor = type === 'opening' ? 'teal' : 'pink';

  const handleSave = async () => {
    if (!onUpdateDescription) return;
    
    setIsSaving(true);
    try {
      await onUpdateDescription(editedDescription);
      setIsEditing(false);
      toast({
        title: "Description updated",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to update description",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedDescription(description);
    setIsEditing(false);
  };

  return (
    <Box bg={bgColor} p={3} borderRadius="md">
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold">{type === 'opening' ? 'Opening' : 'Closing'} Scene Description:</Text>
        <HStack spacing={2}>
          {onUpdateDescription && !isEditing && (
            <IconButton
              aria-label="Edit description"
              icon={<EditIcon />}
              size="sm"
              colorScheme={buttonColor}
              onClick={() => setIsEditing(true)}
            />
          )}
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
      
      {isEditing ? (
        <Box mb={2}>
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            color={textColor}
            mb={2}
          />
          <HStack justify="flex-end" spacing={2}>
            <Button
              size="sm"
              colorScheme="gray"
              onClick={handleCancel}
              leftIcon={<CloseIcon />}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              colorScheme={buttonColor}
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<CheckIcon />}
            >
              Save
            </Button>
          </HStack>
        </Box>
      ) : (
        <Text color={textColor} mb={2}>{description}</Text>
      )}
      
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