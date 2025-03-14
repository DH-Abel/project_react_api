import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TextInput, Button, TouchableOpacity, Modal, SafeAreaView, Alert, Pressable
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axios';
import { database } from '../src/database/database';
import { styles } from '../assets/styles';
import { Q } from '@nozbe/watermelondb';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';

export default function TestApi() {
  // Estados para clientes y productos
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productos, setProductos] = useState([]);
  const [searchTextClientes, setSearchTextClientes] = useState('');
  const [searchTextProductos, setSearchTextProductos] = useState('');
  const [pedido, setPedido] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [balanceCliente, setBalanceCliente] = useState(0);


  let syncInProgress = false;

  // Carga de clientes al iniciar
  // Función para obtener clientes desde la API
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clientes');
      setClientes(response.data);
    } catch (error) {
      console.error('❌ Error al obtener clientes:', error);
      Alert.alert('Error', 'No se pudo obtener la lista de clientes. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar clientes al iniciar el componente
  useEffect(() => {
    fetchClientes();
  }, []);
  // Buscar cuenta por cobrar del cliente seleccionado
  useEffect(() => {
    if (clienteSeleccionado) {
      const fetchClientesCxc = async () => {
        try {
          const response = await api.get(`/cuenta_cobrar/${clienteSeleccionado.f_id}`);
          setBalanceCliente(response.data.f_balance || 0);
        } catch (error) {
          console.error('❌ Error al obtener cxc:', error);
          setBalanceCliente(0);
        } finally {
          setLoading(false);
        }
      };
      fetchClientesCxc();
    }
  }, [clienteSeleccionado]);

  // Función para sincronizar productos desde la API hacia la base local
  const sincronizarProductos = async () => {
    if (syncInProgress) return; // Evitar operaciones concurrentes
    syncInProgress = true;
    try {
      // Obtén los productos desde la API
      const response = await api.get('/productos');
      const productosRemotos = response.data;

      await database.write(async () => {
        const productosCollection = database.collections.get('t_productos_sucursal');

        for (let prod of productosRemotos) {
          //formatea todo, para quitarle espacios delante y detras con TRIM
          prod.f_descripcion = prod.f_descripcion ? prod.f_descripcion.trim() : prod.f_descripcion;
          prod.f_referencia_suplidor = prod.f_referencia_suplidor ? prod.f_referencia_suplidor.trim() : prod.f_referencia_suplidor;

          // Busca el producto local por su referencia (suponiendo que es un identificador único)
          const productosLocales = await productosCollection.query(
            Q.where('f_referencia', parseInt(prod.f_referencia, 10))
          ).fetch();

          if (productosLocales.length > 0) {
            // Producto ya existe, actualizar si alguno de los campos difiere
            const roundToTwo = (num) => Math.round(num * 100) / 100;

            const productoLocal = productosLocales[0];
            const existenciaRemota = roundToTwo(parseFloat(prod.f_existencia));
            const existenciaLocal = roundToTwo(productoLocal.f_existencia);
            const precioRemoto = roundToTwo(parseFloat(prod.f_precio5));
            const referenciaRemota = parseInt(prod.f_referencia, 10);

            let updateNeeded = false;
            let differences = [];
            if (Math.abs(existenciaLocal - existenciaRemota) > 0.001) {
              updateNeeded = true;
              differences.push(`existencia: local ""(${existenciaLocal})"" vs remoto ""(${existenciaRemota})""`);
            }
            if (productoLocal.f_descripcion !== prod.f_descripcion) {
              updateNeeded = true;
              differences.push(`descripción: local """${productoLocal.f_descripcion}""" vs remoto "" "${prod.f_descripcion}" ""`);
            }
            if (Math.abs(roundToTwo(productoLocal.f_precio5) - precioRemoto) > 0.001) {
              updateNeeded = true;
              differences.push(`precio5: local ""${productoLocal.f_precio5}"" vs remoto ""${precioRemoto}""`);
            }
            if (productoLocal.f_referencia !== referenciaRemota) {
              updateNeeded = true;
              differences.push(`referencia: local ""(${productoLocal.f_referencia})"" vs remoto ""(${referenciaRemota})""`);
            }
            if (productoLocal.f_referencia_suplidor !== prod.f_referencia_suplidor) {
              updateNeeded = true;
              differences.push(`referencia_suplidor: local " "${productoLocal.f_referencia_suplidor}" " vs remoto ""(${prod.f_referencia_suplidor})""`);
            }

            if (updateNeeded) {
              await productoLocal.update(record => {
                record.f_existencia = existenciaRemota;
                record.f_descripcion = prod.f_descripcion;
                record.f_precio5 = precioRemoto;
                record.f_referencia = referenciaRemota;
                record.f_referencia_suplidor = prod.f_referencia_suplidor;
              });
              console.log(`Producto ${productoLocal.f_referencia} actualizado. Cambios: ${differences.join(', ')}`);
            }

            //comparar existencia local con existencia remota
            // console.log('Comparación - Existencia local:', existenciaLocal, 'Existencia remota:', existenciaRemota);
            // Verifica si alguno de los campos es diferente
            if (
              Math.abs(existenciaLocal - existenciaRemota) > 0.001 ||
              productoLocal.f_descripcion !== prod.f_descripcion ||
              Math.abs(roundToTwo(productoLocal.f_precio5) - precioRemoto) > 0.001 ||
              productoLocal.f_referencia !== referenciaRemota ||
              productoLocal.f_referencia_suplidor !== prod.f_referencia_suplidor
            ) {
              await productoLocal.update(record => {
                record.f_existencia = existenciaRemota;
                record.f_descripcion = prod.f_descripcion;
                record.f_precio5 = precioRemoto;
                record.f_referencia = referenciaRemota;
                record.f_referencia_suplidor = prod.f_referencia_suplidor;
              });
              console.log(`Producto ${productoLocal.f_referencia} actualizado.`);
            }
          } else {
            // Si el producto no existe, créalo con todos los campos
            await productosCollection.create(record => {
              record.f_referencia = parseInt(prod.f_referencia, 10);
              record.f_referencia_suplidor = prod.f_referencia_suplidor;
              record.f_descripcion = prod.f_descripcion;
              record.f_precio5 = parseFloat(prod.f_precio5);
              record.f_existencia = parseFloat(prod.f_existencia);
            });
            console.log(`Producto ${prod.f_referencia} insertado.`);
          }

        }
      });

      // Si lo deseas, actualiza el estado con los productos remotos o recarga los locales
      setProductos(productosRemotos);
    } catch (error) {
      console.error('Error en la sincronización de productos:', error);
    }
    finally {
      syncInProgress = false;
    }
  };



  // Función para cargar productos desde la base de datos local
  const cargarProductosLocales = async () => {
    try {
      const productosLocales = await database.collections
        .get('t_productos_sucursal')
        .query()
        .fetch();
      // Si es necesario, transforma los registros de WatermelonDB a objetos JS planos
      setProductos(productosLocales);
    } catch (error) {
      console.error('Error al cargar productos locales:', error);
    }
  };

  // Función que decide si sincronizar o cargar localmente según la conexión
  const cargarProductos = async () => {
    // Primero carga los productos locales para una respuesta inmediata
    await cargarProductosLocales();

    // Luego verifica si hay conexión a internet
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      try {
        // Sincroniza con la API para actualizar los productos
        await sincronizarProductos();
      } catch (error) {
        console.error("Error al sincronizar, se mantienen los productos locales:", error);
      }
    }
  };

  useEffect(() => {
    // Configura el intervalo para revisar y sincronizar cada 5 minutos
    const intervalId = setInterval(() => {
      cargarProductos();
    }, 30000); // 90,000 ms = 1.5 minutos

    // Limpia el intervalo cuando el componente se desmonte
    return () => clearInterval(intervalId);
  }, []);



  // Al seleccionar un cliente, carga los productos (sincronizando o desde la base local)
  useEffect(() => {
    if (clienteSeleccionado) {
      setLoading(true);
      cargarProductos().finally(() => setLoading(false));
    }
  }, [clienteSeleccionado]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
  }

  // Selección de cliente si aún no se ha seleccionado
  if (!clienteSeleccionado) {
    const clientesFiltrados = clientes.filter(cliente =>
      cliente.f_nombre.toLowerCase().includes(searchTextClientes.toLowerCase())
    );

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Selecciona un Cliente</Text>
        <Pressable title='cargar Clientes' onPress={fetchClientes}></Pressable>
        <TextInput
          style={styles.input}
          placeholder="Buscar cliente..."
          value={searchTextClientes}
          onChangeText={setSearchTextClientes}
        />

        <View style={styles.listContainer2}>
          <KeyboardAwareFlatList
            data={clientesFiltrados}
            keyExtractor={item => item.f_id.toString()}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <View style={styles.textContainer}>
                  <TouchableOpacity onPress={() => setClienteSeleccionado(item)}>
                    <Text style={styles.itemText}>{item.f_nombre}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text>No se encontraron clientes</Text>}
          />
        </View>
      </View>
    );
  }

  // Filtrar productos según búsqueda
  const productosFiltrados = productos.filter(producto =>
    (producto.f_descripcion || '').toLowerCase().includes(searchTextProductos.toLowerCase()) ||
    (producto.f_referencia ? producto.f_referencia.toString().toLowerCase() : '').includes(searchTextProductos.toLowerCase())
  );



  // Funciones para actualizar pedido y eliminar productos (se mantienen igual)
  const actualizarCantidad = (f_referencia, cantidad, producto) => {
    if (cantidad === '') {
      setPedido(prevPedido => {
        const nuevoPedido = { ...prevPedido };
        delete nuevoPedido[f_referencia];
        return nuevoPedido;
      });
    } else {
      const cantidadNumerica = parseInt(cantidad, 10) || 0;
      setPedido(prevPedido => ({
        ...prevPedido,
        [f_referencia]: prevPedido[f_referencia]
          ? { ...prevPedido[f_referencia], cantidad: cantidadNumerica }
          : { f_referencia: producto.f_referencia, f_precio5: producto.f_precio5, cantidad: cantidadNumerica, f_referencia_suplidor: producto.f_referencia_suplidor, f_descripcion: producto.f_descripcion, f_existencia: producto.f_existencia }
      }));
    }
  };

  const eliminarDelPedido = (f_referencia) => {
    setPedido(prevPedido => {
      const nuevoPedido = { ...prevPedido };
      delete nuevoPedido[f_referencia];
      return nuevoPedido;
    });
  };

  const realizarPedido = async () => {
    const productosPedido = Object.entries(pedido).map(([f_referencia, data]) => ({
      producto_id: f_referencia,
      cantidad: data.cantidad
    }));

    if (productosPedido.length === 0) {
      Alert.alert("Error", "No has seleccionado ningún producto");
      return;
    }

    try {
      await api.post('/pedidos', { productos: productosPedido });
      Alert.alert("Éxito", "Pedido realizado correctamente");
      setPedido({});
      setModalVisible(false);
    } catch (error) {
      console.error("❌ Error al realizar el pedido:", error);
      Alert.alert("Error", "No se pudo realizar el pedido");
    }
  };

  const totalBruto = Object.values(pedido).reduce((total, item) => (total + item.f_precio5 * item.cantidad), 0);
  const itbis = Number(totalBruto) * 0.18;
  const totalNeto = Number(totalBruto) + Number(itbis);
  const creditoDisponible = clienteSeleccionado.f_limite_credito - balanceCliente - totalNeto;

  return (

    <SafeAreaView style={styles.container}>
      <View>
        <Text style={styles.title}>Cliente: ({clienteSeleccionado.f_id}) {clienteSeleccionado.f_nombre}</Text>
        <View style={styles.headerContainer}>
          <View style={{ flex: 2 }}>
            <Text style={styles.headerText}>Limite de credito: ${clienteSeleccionado.f_limite_credito}</Text>
            <Text style={styles.headerText}>Balance: ${balanceCliente}</Text>
            <Text style={styles.headerText}>Disponible: ${creditoDisponible.toFixed(2)}</Text>
            <Text style={styles.title}>Total del pedido: ${totalNeto.toFixed(2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={() => setClienteSeleccionado(null)} style={styles.button}>
              <Text style={styles.buttonText}>Cambiar Cliente</Text>
            </Pressable>
            <Pressable onPress={cargarProductosLocales} style={styles.button}>
              <Text style={styles.buttonText}>Cargar productos localess</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center' }}>
        <TextInput
          style={styles.input}
          placeholder="Buscar por nombre o referencia"
          value={searchTextProductos}
          onChangeText={setSearchTextProductos}
        />
      </View>


      {/* Listado de productos */}
      <View style={styles.listContainer2}>
        <KeyboardAwareFlatList
          data={productosFiltrados}
          keyExtractor={(item) => (item.f_referencia ? item.f_referencia.toString() : item.f_referencia.toString())}
          keyboardShouldPersistTaps="always"
          extraScrollHeight={20}
          renderItem={({ item }) => (
            <View style={styles.listContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemText}>
                  ({item.f_referencia}) - {item.f_referencia_suplidor}
                </Text>
                <Text style={styles.itemText}>{item.f_descripcion}</Text>
                <Text style={styles.itemText}>${item.f_precio5}</Text>
                <Text style={styles.itemText}>Existencia: {item.f_existencia}</Text>
              </View>
              <TextInput
                style={styles.inputP}
                placeholder="QTY"
                keyboardType="numeric"
                value={pedido[item.f_referencia]?.cantidad?.toString() || ''}
                onChangeText={(cantidad) => actualizarCantidad(item.f_referencia, cantidad, item)}
              />
            </View>

          )}
          ListEmptyComponent={<Text>No se encontraron productos</Text>}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Pressable onPress={() => setModalVisible(true)} style={styles.buttonB}>
          <Text style={styles.buttonText}>VER PEDIDO</Text>
        </Pressable>
      </View>











      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >

        <SafeAreaView style={styles.container}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>🛒 Resumen del Pedido</Text>
            <Text style={styles.title}>Cliente: ({clienteSeleccionado.f_id}) {clienteSeleccionado.f_nombre}</Text>
            <Text>Credito Disponible: ${creditoDisponible.toFixed(2)}</Text>
            <View style={styles.modalHeader}>
              <Text>Total bruto: ${totalBruto.toFixed(2)}</Text>
              <Text>ITBIS: ${itbis.toFixed(2)}</Text>
              <Text style={styles.title}>Total del pedido: ${totalNeto.toFixed(2)}</Text>
            </View>
            <Text style={styles.title}>Detalle del pedido:</Text>
            <View style={styles.listContainer2}>


                {/* Resumen del pedido */}
            {Object.keys(pedido).length > 0 ? (
      
              <KeyboardAwareFlatList
                data={Object.entries(pedido)}
                keyExtractor={([f_referencia]) => f_referencia}
                renderItem={({ item: [f_referencia, data] }) => (
                  <View style={styles.listContainer}>
                    <View style={{ flex: 1 }}>
                      <Text>({data.f_referencia}) -{data.f_referencia_suplidor}</Text>
                      <Text>{data.f_descripcion}</Text>
                      <Text>Cantidad: {data.cantidad}</Text>
                      <Text>Precio: ${data.f_precio5}  Total: ${(data.f_precio5 * data.cantidad).toFixed(2)}</Text>
                    </View>
                    <View style={styles.deleteButtonContainer}>
                      <TouchableOpacity onPress={() => eliminarDelPedido(f_referencia)}>
                        <Text style={styles.modalButtonText}>❌</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <Text>No hay productos en el pedido</Text>
            )}
          </View>
          </View>
        </SafeAreaView>


        <View style={styles.buttonContainerRow}>
          <Pressable title="Cerrar" onPress={() => setModalVisible(false)} style={styles.buttonRow2} >
            <Text style={styles.buttonText}>Agregar productos</Text>
          </Pressable>
          <Pressable title="Confirmar Pedido" onPress={realizarPedido} style={styles.buttonRow} >
            <Text style={styles.buttonText}>Confirmar Pedido</Text>
          </Pressable>
        </View>

      </Modal>
    </SafeAreaView>
  );
}
