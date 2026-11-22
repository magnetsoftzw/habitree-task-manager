import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const navigateTo = (name, params) => {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
};
