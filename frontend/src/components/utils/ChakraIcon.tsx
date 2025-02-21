import { Icon, IconProps } from '@chakra-ui/react';
import { IconType } from 'react-icons';
import React from 'react';

interface ChakraIconProps extends Omit<IconProps, 'as'> {
  icon: IconType;
}

export const ChakraIcon: React.FC<ChakraIconProps> = ({ icon: IconComponent, ...props }) => {
  return <Icon as={IconComponent as React.ElementType} {...props} />;
}; 