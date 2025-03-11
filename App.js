import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import TestApi from './screens/testApi';
import TestDb from './screens/test2';
import ConsultaPedidos from './screens/consultaPedido';
import MyStack from './screens/navigator/stack';
//import { enableScreens } from 'react-native-screens';


//enableScreens(false);
export default function App() {
  return (
    
    <MyStack/>
  //<ConsultaPedidos/>
   //<TestApi/>
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
