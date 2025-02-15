import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Image,
  Textarea,
  IconButton,
  useToast,
  Select,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon, CheckIcon, CloseIcon, AttachmentIcon } from '@chakra-ui/icons';

const dragDropStyles = {
  border: '2px dashed',
  borderRadius: 'md',
  p: 4,
  textAlign: 'center' as const,
  cursor: 'pointer',
  transition: 'all 0.2s',
  _hover: {
    bg: 'gray.50',
  },
};

interface ImageDisplayProps {
  imageKey: string;
  imageData: string | undefined;
  description: string;
  type: 'opening' | 'closing';
  isGenerating: boolean;
  onGenerateImage: (referenceImage?: string, modelType?: string, seed?: number) => void;
  onUpdateDescription?: (newDescription: string) => Promise<void>;
  modelType?: string;
  chapterIndex: number;
  sceneIndex: number;
  shotIndex: number;
}

// Update the component to manage its own modelType state
const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageKey,
  imageData,
  description,
  type,
  isGenerating,
  onGenerateImage,
  onUpdateDescription,
  modelType: initialModelType = 'flux_dev_realism',  // Rename to initialModelType
  chapterIndex,
  sceneIndex,
  shotIndex,
}) => {
  // Add local modelType state
  const [localModelType, setLocalModelType] = useState(initialModelType);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [seed, setSeed] = useState(333);

  const bgColor = type === 'opening' ? 'teal.50' : 'pink.50';
  const textColor = type === 'opening' ? 'teal.800' : 'pink.800';
  const buttonColor = type === 'opening' ? 'teal' : 'pink';

  const modelOptions = [
    { value: 'flux_dev_realism', label: 'Flux Dev Realism' },
    { value: 'flux_ultra_model', label: 'Flux Ultra Model' },
  ];

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

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelType = event.target.value;
    setLocalModelType(newModelType);
    // Clear reference image when switching away from flux_ultra_model
    if (newModelType !== 'flux_ultra_model') {
      setReferenceImage(null);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateWithReference = () => {
    onGenerateImage(referenceImage || undefined, localModelType, seed);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setReferenceImage(base64);
        toast({
          title: "Reference image added",
          status: "success",
          duration: 2000,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (!isNaN(value)) {
      setSeed(value);
    }
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
          {localModelType === 'flux_ultra_model' && (
            <Box
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              {...dragDropStyles}
              borderColor={isDragging ? 'teal.500' : 'gray.300'}
              bg={isDragging ? 'teal.50' : 'transparent'}
              w="200px"
            >
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <VStack spacing={2}>
                <IconButton
                  aria-label="Add reference image"
                  icon={<AttachmentIcon />}
                  size="sm"
                  colorScheme={referenceImage ? 'green' : buttonColor}
                  onClick={() => fileInputRef.current?.click()}
                />
                <Text fontSize="sm">
                  {referenceImage ? 'Image loaded' : 'Drop image here or click to upload'}
                </Text>
                {referenceImage && (
                  <Image
                    src={referenceImage}
                    alt="Reference"
                    maxH="100px"
                    objectFit="contain"
                  />
                )}
              </VStack>
            </Box>
          )}
          <Select
            size="sm"
            width="200px"
            value={localModelType}
            onChange={handleModelChange}
          >
            {modelOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <NumberInput
            size="sm"
            width="80px"
            value={seed}
            min={0}
            max={999999}
            defaultValue={333}
            onChange={(valueString) => setSeed(parseInt(valueString))}
          >
            <NumberInputField />
          </NumberInput>
          <Button
            size="sm"
            colorScheme={buttonColor}
            onClick={handleGenerateWithReference}
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