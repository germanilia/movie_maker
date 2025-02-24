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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Radio,
  RadioGroup,
  Stack,
  Spinner,
  Badge,
  Progress,
  useColorModeValue,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
  AspectRatio,
  Input,
} from '@chakra-ui/react';
import { RepeatIcon, EditIcon, CheckIcon, CloseIcon, AttachmentIcon, ChevronDownIcon, Icon } from '@chakra-ui/icons';
import { FaImage, FaUserAlt, FaVideo, FaRedo } from 'react-icons/fa';
import { ChakraIcon } from './utils/ChakraIcon';
import { BiMoviePlay } from 'react-icons/bi';

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

// Update the FaceDetectionResult interface to match the new response structure
interface FaceDetectionResult {
  [key: string]: {
    bbox: number[];
    kps: [number, number][];
    det_score: number;
  };
}

interface ImageDisplayProps {
  imageKey: string;
  imageData: string;
  videoData?: string;
  description: string;
  type: string;
  isGenerating: boolean;
  isGeneratingVideo?: boolean;
  onGenerateImage: (referenceImage?: string, modelType?: string, seed?: number) => void;
  onGenerateVideo?: () => void;
  onUpdateDescription: (newDescription: string) => void;
  onShotRegenerated: (newDescription: string, newInstructions: string) => void;
  directorInstructions: string;
  chapterIndex: number;
  sceneIndex: number;
  shotIndex: number;
  projectName: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

interface SourceImage {
  base64: string;
  name: string;
  file: File;  // Add the File type
}

interface VideoPlayerProps {
  src: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkVideo = async () => {
      try {
        const response = await fetch(`http://localhost:8000${src}`);
        if (!response.ok) {
          throw new Error(`Failed to load video: ${response.status} ${response.statusText}`);
        }
        // Check if the response is video content
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('video/')) {
          throw new Error('Invalid video content received');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      }
    };
    
    if (src) {
      checkVideo();
    }
  }, [src]);

  if (error) {
    return (
      <Box p={4} bg="red.50" color="red.800" borderRadius="md">
        <Text>{error}</Text>
      </Box>
    );
  }

  return (
    <video 
      className={className}
      controls
      src={`http://localhost:8000${src}`}
    >
      Your browser does not support the video tag.
    </video>
  );
};

const ShotVideo: React.FC<{
  videoData: string;
  chapterIndex: number;
  sceneIndex: number;
  shotIndex: number;
}> = ({ videoData, chapterIndex, sceneIndex, shotIndex }) => {
  return (
    <AspectRatio ratio={16/9}>
      <VideoPlayer
        src={videoData}
        className="w-full h-full object-contain"
      />
    </AspectRatio>
  );
};

// Update the component to manage its own modelType state
const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageKey,
  imageData,
  videoData,
  description,
  type,
  isGenerating,
  isGeneratingVideo,
  onGenerateImage,
  onGenerateVideo,
  onUpdateDescription,
  onShotRegenerated,
  directorInstructions,
  chapterIndex,
  sceneIndex,
  shotIndex,
  projectName,
  selectedModel,
  onModelChange,
}) => {
  // Add local state for description and instructions
  const [localDescription, setLocalDescription] = useState(description);
  const [localDirectorInstructions, setLocalDirectorInstructions] = useState(directorInstructions);
  
  // Update local state when props change
  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  useEffect(() => {
    setLocalDirectorInstructions(directorInstructions);
  }, [directorInstructions]);

  // Add local modelType state
  const [localModelType, setLocalModelType] = useState('flux_ultra_model');
  
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
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [faceMapping, setFaceMapping] = useState<Record<number, string>>({});
  const [localImageData, setLocalImageData] = useState<string | undefined>(imageData);
  const [isRegeneratingShot, setIsRegeneratingShot] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const { isOpen: isRegenerateModalOpen, onOpen: onRegenerateModalOpen, onClose: onRegenerateModalClose } = useDisclosure();

  // Add new loading states
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const buttonColorScheme = type === 'opening' ? 'teal' : 'pink';
  const accentBgColor = useColorModeValue(`${buttonColorScheme}.50`, `${buttonColorScheme}.900`);
  const accentTextColor = useColorModeValue(`${buttonColorScheme}.700`, `${buttonColorScheme}.100`);

  const modelOptions = [
    { value: 'flux_ultra_model', label: 'Flux Ultra Model' },
    { value: 'flux_dev_realism', label: 'Flux Dev Realism' },
  ];

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (videoData) {
      setActiveTab(1);
    }
  }, [videoData]);

  const handleSave = async () => {
    if (!onUpdateDescription) return;
    
    setIsSaving(true);
    try {
      await onUpdateDescription(editedDescription);
      setIsEditing(false);
      setEditedDescription(editedDescription);
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


  // Update the detectFaces function
  const detectFaces = async () => {
    setIsDetectingFaces(true);
    setShowFaceTools(false); // Hide tools during detection
    
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
        setFaceDetectionResult(data.face_detection_result);
        setShowFaceTools(true);
        
        if (Object.keys(data.face_detection_result).length === 0) {
          toast({
            title: 'No faces detected',
            description: 'No faces were found in the image',
            status: 'warning',
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Error detecting faces:', error);
      toast({
        title: 'Error',
        description: 'Failed to detect faces in image',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsDetectingFaces(false);
    }
  };



  const handleSourceFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setSourceImages(prev => [...prev, { 
            base64, 
            name: file.name,  // Keep the original filename
            file: file  // Store the original file object
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Update the handleCustomFaceSwap function
  const handleCustomFaceSwap = async () => {
    if (!faceDetectionResult || Object.keys(faceMapping).length === 0) {
      toast({
        title: 'Error',
        description: 'Please detect faces and map them to source images first',
        status: 'error',
        duration: 3000,
      });
      return;
    }
  
    setIsSwapping(true);
    try {
      const swapInstructions = Object.entries(faceMapping).map(([targetIdx, sourceName]) => {
        // Find the index of the source image in the sourceImages array
        const sourceIdx = sourceImages.findIndex(img => img.name === sourceName);
        return {
          target_idx: parseInt(targetIdx),
          source_img_name: sourceName,
          source_idx: sourceIdx // Use the actual index from the array
        };
      });
  
      const response = await fetch(
        `http://localhost:8000/api/swap-faces-custom/${projectName}?` +
        `chapter_index=${chapterIndex+1}&scene_index=${sceneIndex+1}&` +
        `shot_index=${shotIndex+1}&type=${type}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_images: sourceImages.map(img => img.base64),
            swap_instructions: swapInstructions
          }),
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Custom face swapping failed');
      }
      
      const data = await response.json();
      if (data.status === 'success' && data.base64_image) {
        // Clear face detection result
        setFaceDetectionResult(null);
        
        // Update image data directly without triggering regeneration
        setLocalImageData(data.base64_image);
  
        // Reset states
        setIsSwapModalOpen(false);
        setSourceImages([]);
        setFaceMapping({});
        
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
        description: (error as any).message || 'Failed to swap faces',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSwapping(false);
    }
  };

  // Update the useEffect that draws the faces
  useEffect(() => {
    if (!localImageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.src = localImageData.startsWith('data:') ? localImageData : `data:image/png;base64,${localImageData}`;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      if (faceDetectionResult) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.font = '48px Arial'; // Increased font size to 48px
        ctx.fillStyle = 'red';
        
        Object.entries(faceDetectionResult).forEach(([faceIdx, face]) => {
          const [x1, y1, x2, y2] = face.bbox;
          const width = x2 - x1;
          const height = y2 - y1;
          
          // Draw rectangle around face
          ctx.strokeRect(x1, y1, width, height);
          
          // Draw face index (starting from 1)
          const displayNumber = (parseInt(faceIdx) + 1).toString();
          ctx.fillText(displayNumber, x1, y1 - 15); // Increased y-offset for larger text
        });
      }
    };
  }, [localImageData, faceDetectionResult]);

  useEffect(() => {
    if (imageData !== undefined) {
      setLocalImageData(imageData);
    }
  }, [imageData]);

  useEffect(() => {
    setEditedDescription(description);
  }, [description]);

  const handleRegenerateShot = async () => {
    setIsRegeneratingShot(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/regenerate-shot/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_index: chapterIndex + 1,
            scene_index: sceneIndex + 1,
            shot_index: shotIndex + 1,
            instructions: regenerateInstructions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to regenerate shot');
      }

      const updatedScript = await response.json();
      
      // Get the updated shot from the response
      const updatedShot = updatedScript.chapters[chapterIndex]?.scenes?.[sceneIndex]?.shots?.[shotIndex];
      if (updatedShot) {
        // Update local state
        setLocalDescription(updatedShot.opening_frame);
        setLocalDirectorInstructions(updatedShot.director_instructions);
        
        // Notify parent component
        if (onShotRegenerated) {
          onShotRegenerated(updatedShot.opening_frame, updatedShot.director_instructions);
        }
      }

      onRegenerateModalClose();
      setRegenerateInstructions('');
      toast({
        title: 'Success',
        description: 'Shot regenerated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error regenerating shot:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to regenerate shot',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsRegeneratingShot(false);
    }
  };

  const handleImageClick = () => {
    // Image click handler implementation
  };

  return (
    <Box 
      bg={bgColor} 
      p={4} 
      borderWidth={1} 
      borderRadius="md"
      borderColor={borderColor}
      position="relative"
    >
      {(isGenerating || isDetectingFaces || isSwapping) && (
        <Progress 
          size="xs" 
          isIndeterminate 
          position="absolute"
          top={0}
          left={0}
          right={0}
        />
      )}

      <VStack spacing={4} align="stretch">
        {/* Header Section - Only Type Badge */}
        <HStack justify="space-between">
          <Badge 
            colorScheme={buttonColorScheme}
            variant="subtle"
            px={2}
            py={1}
          >
            {type === 'opening' ? 'Opening Shot' : 'Closing Shot'}
          </Badge>
        </HStack>

        {/* Description Section */}
        {isEditing ? (
          <Box>
            <Textarea
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              color={accentTextColor}
              mb={2}
              bg={accentBgColor}
              _hover={{ borderColor: `${buttonColorScheme}.300` }}
              _focus={{ borderColor: `${buttonColorScheme}.500`, boxShadow: `0 0 0 1px ${buttonColorScheme}.500` }}
            />
            <HStack justify="flex-end" spacing={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLocalDescription(description);
                  setIsEditing(false);
                }}
                leftIcon={<CloseIcon />}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                colorScheme={buttonColorScheme}
                onClick={async () => {
                  if (onUpdateDescription) {
                    setIsSaving(true);
                    try {
                      await onUpdateDescription(localDescription);
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
                  }
                }}
                isLoading={isSaving}
                leftIcon={<CheckIcon />}
              >
                Save
              </Button>
            </HStack>
          </Box>
        ) : (
          <Text color={accentTextColor}>{localDescription}</Text>
        )}

        {/* Media Display Section */}
        {(localImageData || videoData) && (
          <Box>
            <Tabs 
              variant="enclosed"
              colorScheme={buttonColorScheme}
              index={activeTab}
              onChange={setActiveTab}
              isLazy
            >
              <TabList>
                <Tab>
                  <HStack spacing={2}>
                    <ChakraIcon icon={FaImage} />
                    <Text>Image</Text>
                  </HStack>
                </Tab>
                {videoData && (
                  <Tab>
                    <HStack spacing={2}>
                      <ChakraIcon icon={FaVideo} />
                      <Text>Video</Text>
                    </HStack>
                  </Tab>
                )}
              </TabList>

              <TabPanels>
                <TabPanel p={0} pt={4}>
                  {/* Image Controls */}
                  <HStack justify="space-between" mb={4}>
                    <Menu>
                      <MenuButton
                        as={Button}
                        size="sm"
                        rightIcon={<ChevronDownIcon />}
                        leftIcon={<ChakraIcon icon={FaImage} />}
                        variant="outline"
                        colorScheme={buttonColorScheme}
                      >
                        {modelOptions.find(opt => opt.value === localModelType)?.label}
                      </MenuButton>
                      <MenuList>
                        {modelOptions.map(option => (
                          <MenuItem 
                            key={option.value}
                            onClick={() => {
                              setLocalModelType(option.value);
                              if (option.value !== 'flux_ultra_model') {
                                setReferenceImage(null);
                              }
                            }}
                          >
                            {option.label}
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>

                    <HStack spacing={2}>
                      <NumberInput
                        size="sm"
                        width="100px"
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
                        colorScheme={buttonColorScheme}
                        onClick={handleGenerateWithReference}
                        isLoading={isGenerating}
                        loadingText="Generating"
                        leftIcon={<RepeatIcon />}
                      >
                        Generate
                      </Button>
                    </HStack>
                  </HStack>

                  {/* Image Display and Face Tools */}
                  <Box 
                    position="relative" 
                    borderWidth={1}
                    borderColor={borderColor}
                    borderRadius="md"
                    overflow="hidden"
                  >
                    {faceDetectionResult ? (
                      <canvas
                        ref={canvasRef}
                        style={{
                          maxHeight: '400px',
                          width: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <Image
                        src={localImageData?.startsWith('data:') ? localImageData : `data:image/png;base64,${localImageData}`}
                        alt={`${type} frame`}
                        maxH="400px"
                        w="100%"
                        objectFit="contain"
                      />
                    )}
                  </Box>

                  {/* Face Tools */}
                  <HStack justify="flex-end" mt={2} spacing={2}>
                    {!showFaceTools ? (
                      <Button
                        size="sm"
                        colorScheme={buttonColorScheme}
                        variant="outline"
                        leftIcon={<ChakraIcon icon={FaUserAlt} />}
                        onClick={() => setShowFaceTools(true)}
                      >
                        Face Tools
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          colorScheme={buttonColorScheme}
                          onClick={detectFaces}
                          isLoading={isDetectingFaces}
                          loadingText="Detecting"
                          variant="outline"
                        >
                          Detect Faces
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleSourceFileUpload}
                          style={{ display: 'none' }}
                          ref={swapFileInputRef}
                          disabled={!faceDetectionResult || Object.keys(faceDetectionResult).length === 0}
                        />
                        <Button
                          size="sm"
                          colorScheme={buttonColorScheme}
                          onClick={() => swapFileInputRef.current?.click()}
                          isDisabled={!faceDetectionResult || Object.keys(faceDetectionResult).length === 0}
                          variant="outline"
                        >
                          Upload Faces
                        </Button>
                        {sourceImages.length > 0 && faceDetectionResult && (
                          <Button
                            size="sm"
                            colorScheme={buttonColorScheme}
                            onClick={() => setIsSwapModalOpen(true)}
                            isDisabled={isSwapping}
                            variant="outline"
                          >
                            Map & Swap
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowFaceTools(false);
                            setFaceDetectionResult(null);
                            setSourceImages([]);
                            setFaceMapping({});
                          }}
                        >
                          Hide Tools
                        </Button>
                      </>
                    )}
                  </HStack>

                  {/* Reference Image Upload Section */}
                  {localModelType === 'flux_ultra_model' && (
                    <Box
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      borderWidth={2}
                      borderStyle="dashed"
                      borderRadius="md"
                      p={4}
                      borderColor={isDragging ? `${buttonColorScheme}.500` : 'gray.300'}
                      bg={isDragging ? `${buttonColorScheme}.50` : 'transparent'}
                      transition="all 0.2s"
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
                          colorScheme={referenceImage ? 'green' : buttonColorScheme}
                          onClick={() => fileInputRef.current?.click()}
                        />
                        <Text fontSize="sm" color="gray.600">
                          {referenceImage ? 'Reference image loaded' : 'Drop reference image here or click to upload'}
                        </Text>
                        {referenceImage && (
                          <Image
                            src={referenceImage}
                            alt="Reference"
                            maxH="100px"
                            objectFit="contain"
                            borderRadius="md"
                          />
                        )}
                      </VStack>
                    </Box>
                  )}
                </TabPanel>

                {videoData && (
                  <TabPanel p={0} pt={4}>
                    {/* Video Controls */}
                    <HStack spacing={2} mb={4}>
                      <Select
                        size="sm"
                        value={selectedModel}
                        onChange={(e) => onModelChange?.(e.target.value)}
                        variant="outline"
                        width="auto"
                      >
                        <option value="replicate">Replicate</option>
                        <option value="runwayml">Runway ML</option>
                      </Select>
                      <Button
                        size="sm"
                        colorScheme={buttonColorScheme}
                        leftIcon={<Icon as={FaVideo} />}
                        onClick={onGenerateVideo}
                        isLoading={isGeneratingVideo}
                        loadingText="Generating"
                        isDisabled={!imageData}
                      >
                        {videoData ? 'Regenerate' : 'Generate'}
                      </Button>
                    </HStack>

                    {/* Video Player */}
                    <ShotVideo
                      videoData={videoData}
                      chapterIndex={chapterIndex}
                      sceneIndex={sceneIndex}
                      shotIndex={shotIndex}
                    />

                    {/* Video Generation Progress */}
                    {isGeneratingVideo && (
                      <Box mt={2}>
                        <Progress size="xs" isIndeterminate colorScheme={buttonColorScheme} />
                        <Text fontSize="sm" color="gray.600" mt={1} textAlign="center">
                          Generating video... This may take a few minutes
                        </Text>
                      </Box>
                    )}
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </Box>
        )}
      </VStack>

      {/* Face Mapping Modal */}
      <Modal 
        isOpen={isSwapModalOpen} 
        onClose={() => setIsSwapModalOpen(false)}
        closeOnOverlayClick={!isSwapping}
        closeOnEsc={!isSwapping}
        size="xl"
      >
        <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(3px)" />
        <ModalContent>
          <ModalHeader>Map Faces for Swapping</ModalHeader>
          {!isSwapping && <ModalCloseButton />}
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>Select a source image for each detected face:</Text>
              {faceDetectionResult && Object.entries(faceDetectionResult).map(([faceIdx, face]) => (
                <Box 
                  key={faceIdx} 
                  p={4} 
                  borderWidth={1} 
                  borderRadius="md" 
                  borderColor={borderColor}
                  bg={bgColor}
                >
                  <Text mb={2} fontWeight="bold">Face {parseInt(faceIdx) + 1}:</Text>
                  <RadioGroup
                    value={faceMapping[parseInt(faceIdx)] || ''}
                    onChange={(value) => setFaceMapping(prev => ({
                      ...prev,
                      [parseInt(faceIdx)]: value
                    }))}
                  >
                    <Stack>
                      {sourceImages.map((img, idx) => (
                        <Radio 
                          key={idx} 
                          value={img.name}
                          colorScheme={buttonColorScheme}
                        >
                          <HStack>
                            <Image
                              src={img.base64}
                              alt={`Source ${idx + 1}`}
                              boxSize="50px"
                              objectFit="cover"
                              borderRadius="md"
                            />
                            <Text>{img.name}</Text>
                          </HStack>
                        </Radio>
                      ))}
                    </Stack>
                  </RadioGroup>
                </Box>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="ghost" 
              mr={3} 
              onClick={() => setIsSwapModalOpen(false)}
              isDisabled={isSwapping}
            >
              Cancel
            </Button>
            <Button
              colorScheme={buttonColorScheme}
              onClick={handleCustomFaceSwap}
              isLoading={isSwapping}
              loadingText="Swapping Faces"
            >
              Swap Faces
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Shot Regeneration Modal */}
      <Modal 
        isOpen={isRegenerateModalOpen} 
        onClose={() => {
          setRegenerateInstructions('');
          onRegenerateModalClose();
        }}
        size="xl"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Shot Regeneration Instructions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Enter any specific instructions for regenerating this shot. These instructions will help guide the AI in creating a new version of the shot.
            </Text>
            <Textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="Enter instructions for shot regeneration..."
              size="lg"
              rows={6}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRegenerateModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme={buttonColorScheme}
              onClick={handleRegenerateShot}
              isLoading={isRegeneratingShot}
              loadingText="Regenerating Shot"
            >
              Regenerate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ImageDisplay;