import React from 'react';
import {
  Box,
  Text,
  VStack,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { Scene as SceneType, Shot, Script } from '../models/models';
import BackgroundMusic from './BackgroundMusic';
import NarrationBox from './NarrationBox';
import ImageDisplay from './ImageDisplay';
import DirectorInstructions from './DirectorInstructions';
import ShotVideo from './ShotVideo';

interface SceneProps {
  scene: SceneType;
  chapterIndex: number;
  sceneIndex: number;
  chapterNumber: number;
  projectName: string;
  script: Script;
  setScript: (script: Script) => void;
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
  handleGenerateBackgroundMusic: (chapterNumber: number, sceneNumber: number) => Promise<void>;
  handleUpdateDescription: (
    chapterIndex: number,
    sceneIndex: number,
    shotIndex: number,
    type: 'opening' | 'closing',
    newDescription: string
  ) => Promise<void>;
  getImageKey: (chapterIndex: number, sceneIndex: number, shotIndex: number, type: string) => string;
  onVideoGenerated: () => Promise<void>;
}

const Scene: React.FC<SceneProps> = ({
  scene,
  chapterIndex,
  sceneIndex,
  chapterNumber,
  projectName,
  script,
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
}) => {
  const renderSceneDescription = (
    shot: Shot,
    shotIndex: number,
    type: 'opening' | 'closing'
  ) => {
    const imageKey = getImageKey(chapterIndex, sceneIndex, shotIndex, type);
    const description = type === 'opening' ? shot.opening_frame : shot.closing_frame;

    return (
      <ImageDisplay
        imageKey={imageKey}
        imageData={imageData[imageKey]}
        description={description || ''}
        type={type}
        isGenerating={generatingImages.has(imageKey)}
        onGenerateImage={(referenceImage?: string, modelType?: string, seed?: number) => {
          if (description) {
            handleGenerateImage(
              chapterIndex,
              sceneIndex,
              shotIndex,
              type,
              description,
              true,
              referenceImage,
              modelType || 'flux_dev_realism',
              seed
            );
          }
        }}
        onUpdateDescription={(newDescription) =>
          handleUpdateDescription(chapterIndex, sceneIndex, shotIndex, type, newDescription)
        }
        chapterIndex={chapterIndex}
        sceneIndex={sceneIndex}
        shotIndex={shotIndex}
      />
    );
  };

  return (
    <AccordionItem>
      <AccordionButton>
        <Box flex="1" textAlign="left">
          <Text fontWeight="bold">Scene {scene.scene_number}</Text>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <VStack spacing={4} align="stretch">
          <Box bg="gray.50" p={3} borderRadius="md">
            <Text>{scene.description}</Text>
          </Box>

          <BackgroundMusic
            backgroundMusic={scene.background_music || []}
            projectName={projectName}
            chapterNumber={chapterNumber}
            sceneNumber={scene.scene_number}
            isGenerating={generatingMusic.has(`${chapterNumber}-${scene.scene_number}`)}
            onGenerate={() => handleGenerateBackgroundMusic(chapterNumber, scene.scene_number)}
            existingMusic={backgroundMusicData[`${chapterNumber}-${scene.scene_number}`]}
          />

          <NarrationBox
            narrationText={scene.narration_text}
            projectName={projectName}
            chapterNumber={chapterNumber}
            sceneNumber={scene.scene_number}
            existingNarration={narrationData[`${chapterNumber}-${scene.scene_number}`]}
          />

          {scene.shots?.map((shot, shotIndex) => (
            <Box key={shotIndex} borderWidth="1px" borderRadius="md" p={4} bg="white">
              <VStack spacing={4} align="stretch">
                <Text fontWeight="bold">Shot {shot.shot_number}</Text>

                {shot.reasoning && (
                  <Box bg="yellow.50" p={3} borderRadius="md">
                    <Text fontWeight="bold" mb={1}>Shot Reasoning:</Text>
                    <Text color="yellow.800">{shot.reasoning}</Text>
                  </Box>
                )}

                <DirectorInstructions
                  instructions={shot.director_instructions}
                  projectName={projectName}
                  chapterIndex={chapterIndex}
                  sceneIndex={sceneIndex}
                  shotIndex={shotIndex}
                  onInstructionsUpdated={(newInstructions) => {
                    const updatedScript = JSON.parse(JSON.stringify(script));
                    updatedScript.chapters[chapterIndex].scenes[sceneIndex].shots[shotIndex].director_instructions = newInstructions;
                    setScript(updatedScript);
                  }}
                />

                {shot.opening_frame && renderSceneDescription(shot, shotIndex, 'opening')}
                {shot.closing_frame && renderSceneDescription(shot, shotIndex, 'closing')}

                <ShotVideo
                  projectName={projectName}
                  chapterNumber={chapterNumber}
                  sceneNumber={scene.scene_number}
                  shotNumber={shot.shot_number}
                  shotDescription={shot.director_instructions || ''}
                  existingVideo={videoData[`${chapterNumber}-${scene.scene_number}-${shot.shot_number}`]}
                  onVideoGenerated={onVideoGenerated}
                />
              </VStack>
            </Box>
          ))}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export default Scene;