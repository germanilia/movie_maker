import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Text, 
  IconButton, 
  Textarea,
  HStack,
  Button,
  useToast,
} from '@chakra-ui/react';
import { EditIcon } from '@chakra-ui/icons';

interface DirectorInstructionsProps {
  instructions?: string;
  projectName: string;
  chapterIndex: number;
  sceneIndex: number;
  shotIndex: number;
  onInstructionsUpdated: (newInstructions: string) => Promise<void>;
}

const DirectorInstructions: React.FC<DirectorInstructionsProps> = ({ 
  instructions, 
  projectName,
  chapterIndex,
  sceneIndex,
  shotIndex,
  onInstructionsUpdated
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInstructions, setEditedInstructions] = useState(instructions || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [localInstructions, setLocalInstructions] = useState(instructions || '');
  const toast = useToast();

  useEffect(() => {
    if (instructions !== undefined) {
      setLocalInstructions(instructions);
      setEditedInstructions(instructions);
    }
  }, [instructions]);

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      
      await onInstructionsUpdated(editedInstructions);
      setLocalInstructions(editedInstructions);
      setIsEditing(false);
      
      toast({
        title: 'Success',
        description: 'Director instructions updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to save director instructions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update director instructions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!localInstructions && !isEditing) {
    return null;
  }

  return (
    <Box bg="blue.50" p={3} borderRadius="md">
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold">Director Instructions:</Text>
        {!isEditing && (
          <IconButton
            aria-label="Edit instructions"
            icon={<EditIcon />}
            size="sm"
            onClick={() => setIsEditing(true)}
          />
        )}
      </HStack>
      
      {isEditing ? (
        <>
          <Textarea
            value={editedInstructions}
            onChange={(e) => setEditedInstructions(e.target.value)}
            mb={2}
          />
          <HStack justify="flex-end" spacing={2}>
            <Button
              size="sm"
              onClick={() => {
                setEditedInstructions(localInstructions);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleSave}
              isLoading={isUpdating}
            >
              Save
            </Button>
          </HStack>
        </>
      ) : (
        <Text color="blue.800">{localInstructions}</Text>
      )}
    </Box>
  );
};

export default DirectorInstructions;