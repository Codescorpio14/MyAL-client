import { DrawerActions, useNavigation } from 'expo-router/react-navigation';

/** Opens the global hamburger drawer from any nested screen. */
export function useOpenDrawer(): () => void {
  const navigation = useNavigation();
  return () => navigation.dispatch(DrawerActions.openDrawer());
}
