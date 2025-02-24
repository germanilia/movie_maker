import React from 'react';
import {
  Box,
  useColorModeValue,
} from '@chakra-ui/react';
import { Script } from '../models/models';
import Chapter from './Chapter';

interface ScriptTimelineProps {
  script: Script;
  projectName: string;
  setScript: React.Dispatch<React.SetStateAction<Script | null>>;
  imageData: Record<string, string>;
  narrationData: Record<string, string>;
  backgroundMusicData: Record<string, string>;
  videoData: Record<string, string>;
  generatingImages: Set<string>;
  generatingMusic: Set<string>;
  handleGenerateImage: (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: string,
    description: string,
    overwriteImage?: boolean,
    referenceImage?: string,
    modelType?: string,
    seed?: number
  ) => Promise<void>;
  handleGenerateBackgroundMusic: (chapterNumber: number, sceneNumber: number, style?: string) => Promise<void>;
  handleUpdateDescription: (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing',
    newDescription: string
  ) => Promise<void>;
  getImageKey: (chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) => string;
  onVideoGenerated: () => Promise<void>;
  onScriptUpdate: (script: Script) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
}

const ScriptTimeline: React.FC<ScriptTimelineProps> = ({
  script,
  projectName,
  setScript,
  imageData,
  narrationData,
  backgroundMusicData,
  videoData,
  generatingImages,
  generatingMusic,
  handleGenerateImage,
  handleGenerateBackgroundMusic,
  handleUpdateDescription,
  getImageKey,
  onVideoGenerated,
  onScriptUpdate,
  timelineRef,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      ref={timelineRef}
      width="350px"
      borderRightWidth={1}
      borderColor={borderColor}
      p={4}
      overflowY="auto"
      bg={bgColor}
      css={{
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '2px',
        },
      }}
    >
      {script.chapters.map((chapter, chapterIndex) => (
        <Box key={chapterIndex} mb={6}>
          <Chapter
            chapter={chapter}
            chapterIndex={chapterIndex}
            projectName={projectName}
            script={script}
            setScript={setScript}
            imageData={imageData}
            narrationData={narrationData}
            backgroundMusicData={backgroundMusicData}
            videoData={videoData}
            generatingImages={generatingImages}
            generatingMusic={generatingMusic}
            handleGenerateImage={handleGenerateImage}
            handleGenerateBackgroundMusic={handleGenerateBackgroundMusic}
            handleUpdateDescription={handleUpdateDescription}
            getImageKey={getImageKey}
            onVideoGenerated={onVideoGenerated}
            onScriptUpdate={onScriptUpdate}
          />
        </Box>
      ))}
    </Box>
  );
};

export default ScriptTimeline; 