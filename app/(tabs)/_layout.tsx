import MaterialIcons from '@expo/vector-icons/MaterialIcons'; // Import MaterialIcons
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab'; // Assuming this path is correct
// import { IconSymbol } from '@/components/ui/IconSymbol'; // Temporarily comment out if testing MaterialIcons
import TabBarBackground from '@/components/ui/TabBarBackground'; // Assuming this path is correct
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const currentSchemeColors = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      sceneContainerStyle={{
        backgroundColor: colorScheme === 'dark' ? '#000000' : currentSchemeColors.background,
      }}
      screenOptions={{
        tabBarActiveTintColor: currentSchemeColors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
        tabBarLabelStyle: {
          fontSize: 12, // Adjust this value to your desired font size
          // You can also add other text style properties here, like fontWeight
          // fontWeight: 'bold', 
        },
      }}>
      <Tabs.Screen
        name="index" // This refers to app/(tabs)/index.tsx
        options={{
          title: 'Translate', 
          tabBarIcon: ({ color, size }) => <MaterialIcons name="g-translate" size={size || 28} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="explore" // This refers to app/(tabs)/explore.tsx
        options={{
          title: 'Videos', 
          tabBarIcon: ({ color, size }) => <MaterialIcons name="videocam" size={size || 28} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="about" 
        options={{
          title: 'About', 
          tabBarIcon: ({ color, size }) => <MaterialIcons name="info" size={size || 28} color={color} />, 
        }}
      />
    </Tabs>
  );
}
