import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable } from 'react-native';
import { database } from '../src/database/database';


export default function Pedidos({ navigation }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const facturaCollection = database.collections.get('t_factura_pedido');
        const allPedidos = await facturaCollection.query().fetch();
        setPedidos(allPedidos);
      } catch (error) {
        console.error("Error al obtener los pedidos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Pressable onPress={() => navigation.navigate('TestApi')} style={{ padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 18 }}>Nuevo Pedido</Text>
      </Pressable>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Pedidos Realizados</Text>
      <FlatList
        data={pedidos}
        keyExtractor={item => item.f_documento.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 10, marginBottom: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
            <Text style={{ fontSize: 18 }}>Documento: {item.f_documento}</Text>
            <Text style={{ fontSize: 16 }}>Cliente: {item.f_cliente}</Text>
            <Text style={{ fontSize: 16 }}>Total: ${item.f_monto}</Text>
            {/* Puedes agregar más detalles según tu necesidad */}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
