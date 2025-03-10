import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import TestApi from './screens/testApi';
import TestDb from './screens/test2';
export default function App() {
  return (
   //<ConsultaPedidos/>
   <TestApi/>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
