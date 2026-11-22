import React from 'react';
import { useSelector } from 'react-redux';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import TabBar from '../components/navigation/TabBar';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TodayScreen from '../screens/today/TodayScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import TaskDetailsScreen from '../screens/tasks/TaskDetailsScreen';
import ProjectsScreen from '../screens/projects/ProjectsScreen';
import ProjectDetailScreen from '../screens/projects/ProjectDetailScreen';
import RoadmapsScreen from '../screens/roadmaps/RoadmapsScreen';
import RoadmapEditorScreen from '../screens/roadmaps/RoadmapEditorScreen';
import InsightsScreen from '../screens/insights/InsightsScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Root = createStackNavigator();
const Tabs = createBottomTabNavigator();
const ProjectStack = createStackNavigator();

function ProjectsNavigator() {
  const { colors } = useTheme();
  return (
    <ProjectStack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.bg } }}>
      <ProjectStack.Screen name="ProjectsList" component={ProjectsScreen} />
      <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    </ProjectStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Today" component={TodayScreen} />
      <Tabs.Screen name="Tasks" component={TasksScreen} />
      <Tabs.Screen name="Projects" component={ProjectsNavigator} />
      <Tabs.Screen name="Roadmaps" component={RoadmapsScreen} />
      <Tabs.Screen name="Insights" component={InsightsScreen} />
    </Tabs.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);

  return (
    <Root.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.bg } }}>
      {isAuthenticated ? (
        <>
          <Root.Screen name="Main" component={MainTabs} />
          <Root.Screen name="TaskDetails" component={TaskDetailsScreen} />
          <Root.Screen name="Calendar" component={CalendarScreen} />
          <Root.Screen name="Settings" component={SettingsScreen} />
          <Root.Screen name="RoadmapEditor" component={RoadmapEditorScreen} />
        </>
      ) : (
        <>
          <Root.Screen name="Login" component={LoginScreen} />
          <Root.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Root.Navigator>
  );
}
