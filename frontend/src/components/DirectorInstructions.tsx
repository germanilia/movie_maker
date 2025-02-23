import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Textarea,
  Button,
  useToast,
  HStack,
  Badge,
  IconButton,
  useColorModeValue,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';
import { EditIcon, CheckIcon, CloseIcon, InfoIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';

interface DirectorInstructionsProps {
  instructions: string;
  reasoning?: string;
  handleUpdate: (newInstructions: string) => Promise<void>;
}

const DirectorInstructions: React.FC<DirectorInstructionsProps> = ({
  instructions,
  reasoning,
  handleUpdate
}) => {
  const [editedInstructions, setEditedInstructions] = useState(instructions);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const toast = useToast();
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const reasoningBgColor = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    setEditedInstructions(instructions);
  }, [instructions]);

  useEffect(() => {
    setHasChanges(editedInstructions !== instructions);
  }, [editedInstructions, instructions]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedInstructions(instructions);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedInstructions(instructions);
    setHasChanges(false);
  };

  const onSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      await handleUpdate(editedInstructions);
      setIsEditing(false);
      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Director instructions updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update director instructions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box 
      p={4} 
      borderWidth={1} 
      borderRadius="md" 
      bg={bgColor} 
      borderColor={borderColor}
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" align="center">
          <HStack>
            <Heading size="sm">Director Instructions</Heading>
            <Tooltip 
              label="Provide detailed instructions for directing this shot" 
              placement="top"
            >
              <InfoIcon color="blue.500" />
            </Tooltip>
          </HStack>
          {!isEditing ? (
            <IconButton
              aria-label="Edit instructions"
              icon={<EditIcon />}
              size="sm"
              colorScheme="blue"
              variant="ghost"
              onClick={handleEdit}
            />
          ) : (
            <Badge 
              colorScheme={hasChanges ? "yellow" : "green"}
            >
              {hasChanges ? "Unsaved Changes" : "No Changes"}
            </Badge>
          )}
        </HStack>

        {reasoning && (
          <Box>
            <Button
              variant="ghost"
              size="sm"
              width="100%"
              onClick={onToggle}
              rightIcon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              justifyContent="space-between"
              fontWeight="medium"
              color="gray.500"
            >
              AI Reasoning
            </Button>
            {isOpen && (
              <Box mt={2} p={3} bg={reasoningBgColor} borderRadius="md">
                <Text
                  color={textColor}
                  whiteSpace="pre-wrap"
                  fontSize="sm"
                >
                  {reasoning}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {isEditing ? (
          <VStack align="stretch" spacing={3}>
            <Textarea
              value={editedInstructions}
              onChange={(e) => setEditedInstructions(e.target.value)}
              minHeight="200px"
              placeholder="Enter director instructions here..."
              size="sm"
              resize="vertical"
            />
            <HStack justify="flex-end" spacing={2}>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<CloseIcon />}
                onClick={handleCancel}
                isDisabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                leftIcon={<CheckIcon />}
                onClick={onSave}
                isLoading={isSaving}
                loadingText="Saving"
                isDisabled={!hasChanges}
              >
                Save Changes
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Box>
            <Text fontWeight="medium" fontSize="sm" color="gray.500" mb={2}>
              Instructions
            </Text>
            <Text 
              color={textColor}
              whiteSpace="pre-wrap"
              fontSize="sm"
            >
              {instructions || "No instructions provided yet."}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default DirectorInstructions;