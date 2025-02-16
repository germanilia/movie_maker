import React, { useState, useRef, useEffect } from 'react';
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

interface FaceDetectionResult {
  number_of_faces: number;
  faces: {
    [key: string]: {
      top_left: [number, number];
      bottom_right: [number, number];
    };
  };
}

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
  projectName: string;  // Add projectName prop
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
  projectName,  // Add projectName to destructuring
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
  const [faceDetectionResult, setFaceDetectionResult] = useState<FaceDetectionResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [swapSourceImage, setSwapSourceImage] = useState<string | null>(null);
  const swapFileInputRef = useRef<HTMLInputElement>(null);
  const [showFaceTools, setShowFaceTools] = useState(false);

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

  const detectFaces = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/detect-faces/${projectName}?` +
        `chapter_index=${chapterIndex+1}&scene_index=${sceneIndex+1}&shot_index=${shotIndex+1}&type=${type}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) throw new Error('Face detection failed');
      
      const data = await response.json();
      if (data.status === 'success' && data.face_detection_result) {
        setFaceDetectionResult(data.face_detection_result[Object.keys(data.face_detection_result)[0]]);
      }
    } catch (error) {
      console.error('Error detecting faces:', error);
      toast({
        title: 'Error',
        description: 'Failed to detect faces in image',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSwapFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSwapSourceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaceSwap = async () => {
    if (!swapSourceImage) {
      toast({
        title: 'Error',
        description: 'Please upload a source image first',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/api/swap-faces/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_image: swapSourceImage,
            target_chapter_index: chapterIndex,
            target_scene_index: sceneIndex,
            target_shot_index: shotIndex,
            target_type: type,
          }),
        }
      );

      if (!response.ok) throw new Error('Face swapping failed');
      
      const data = await response.json();
      if (data.status === 'success' && data.base64_image) {
        // Update the image on success
        onGenerateImage();
        toast({
          title: 'Success',
          description: 'Face swap completed successfully',
          status: 'success',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error swapping faces:', error);
      toast({
        title: 'Error',
        description: 'Failed to swap faces',
        status: 'error',
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    // if (!imageData || !faceDetectionResult || !canvasRef.current) return;
    if (!imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    // Remove the data URL prefix if it exists
    img.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      if (faceDetectionResult && faceDetectionResult.faces) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        
        Object.values(faceDetectionResult.faces).forEach(face => {
          const [x1, y1] = face.top_left;
          const [x2, y2] = face.bottom_right;
          const width = x2 - x1;
          const height = y2 - y1;
          
          ctx.strokeRect(x1, y1, width, height);
        });
      }
    };
  }, [imageData, faceDetectionResult]);

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
        <Box mt={4} position="relative">
          {faceDetectionResult ? (
            <canvas
              ref={canvasRef}
              style={{
                maxHeight: '300px',
                width: '100%',
                objectFit: 'contain',
                borderRadius: 'md',
              }}
            />
          ) : (
            <Image
              src={imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`}
              alt={`${type} frame`}
              maxH="300px"
              w="100%"
              objectFit="contain"
              borderRadius="md"
            />
          )}

          <HStack position="absolute" bottom={2} right={2} spacing={2}>
            {!showFaceTools ? (
              <Button
                size="sm"
                colorScheme={buttonColor}
                onClick={() => setShowFaceTools(true)}
              >
                Face Tools
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  colorScheme={buttonColor}
                  onClick={detectFaces}
                >
                  Detect Faces
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  ref={swapFileInputRef}
                  onChange={handleSwapFileUpload}
                  style={{ display: 'none' }}
                />
                <Button
                  size="sm"
                  colorScheme={buttonColor}
                  onClick={() => swapFileInputRef.current?.click()}
                >
                  Upload Face
                </Button>
                {swapSourceImage && (
                  <Button
                    size="sm"
                    colorScheme={buttonColor}
                    onClick={handleFaceSwap}
                  >
                    Swap Face
                  </Button>
                )}
                <Button
                  size="sm"
                  colorScheme="gray"
                  onClick={() => {
                    setShowFaceTools(false);
                    setFaceDetectionResult(null);
                    setSwapSourceImage(null);
                  }}
                >
                  Hide Tools
                </Button>
              </>
            )}
          </HStack>
          {swapSourceImage && showFaceTools && (
            <Box position="absolute" bottom={14} right={2} width="100px">
              <Image
                src={swapSourceImage}
                alt="Source face"
                maxH="100px"
                objectFit="contain"
                borderRadius="md"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ImageDisplay;