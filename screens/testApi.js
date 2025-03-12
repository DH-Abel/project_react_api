import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TextInput, Button, TouchableOpacity, Modal, SafeAreaView, Alert, Pressable,
  Platform
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axios';
import { database } from '../src/database/database';
import { styles } from '../assets/styles';
import { Q } from '@nozbe/watermelondb';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import CambiarCantidadModal from './modal/cambiarCantidad';


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
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [productoParaEditar, setProductoParaEditar] = useState(null);
  const [nuevaCantidad, setNuevaCantidad] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  let syncInProgress = false;
  let syncClientesInProgress = false;


  const normalizeString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };
  
  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    return Number(value);
  };

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
  const sincronizarClientes = async () => {
    if (syncClientesInProgress) return; // Evitar concurrencia
    syncClientesInProgress = true;
    try {
      const response = await api.get('/clientes');
      const clientesRemotos = response.data;
  
      await database.write(async () => {
        const clientesCollection = database.collections.get('t_clientes');
  
        for (let cli of clientesRemotos) {
          const remote = {
            f_id: cli.f_id,
            f_nombre: normalizeString(cli.f_nombre),
            f_d_municipio: normalizeString(cli.f_d_municipio),
            f_vendedor: normalizeString(cli.f_vendedor),
            f_zona: normalizeString(cli.f_zona),
            f_telefono: normalizeString(cli.f_telefono),
            f_telefono_pro: normalizeString(cli.f_telefono_pro),
            f_descuento_maximo: normalizeNumber(cli.f_descuento_maximo),
            f_descuento1: normalizeNumber(cli.f_descuento1),
            f_clasificacion: normalizeString(cli.f_clasificacion),
            f_direccion: normalizeString(cli.f_direccion),
            f_activo: normalizeString(cli.f_activo),
            f_cedula: normalizeString(cli.f_cedula),
            f_dias_aviso: normalizeString(cli.f_dias_aviso),
            f_bloqueo_credito: normalizeString(cli.f_bloqueo_credito),
            f_facturar_contra_entrega: normalizeString(cli.f_facturar_contra_entrega),
            f_bloqueo_ck: normalizeString(cli.f_bloqueo_ck),
            f_limite_credito: normalizeNumber(cli.f_limite_credito)
          };
  
          const clientesLocales = await clientesCollection.query(
            Q.where('f_id', remote.f_id)
          ).fetch();
  
          if (clientesLocales.length > 0) {
            const clienteLocal = clientesLocales[0];
            const local = {
              f_id: clienteLocal.f_id,
              f_nombre: normalizeString(clienteLocal.f_nombre),
              f_d_municipio: normalizeString(clienteLocal.f_d_municipio),
              f_vendedor: normalizeString(clienteLocal.f_vendedor),
              f_zona: normalizeString(clienteLocal.f_zona),
              f_telefono: normalizeString(clienteLocal.f_telefono),
              f_telefono_pro: normalizeString(clienteLocal.f_telefono_pro),
              f_descuento_maximo: normalizeNumber(clienteLocal.f_descuento_maximo),
              f_descuento1: normalizeNumber(clienteLocal.f_descuento1),
              f_clasificacion: normalizeString(clienteLocal.f_clasificacion),
              f_direccion: normalizeString(clienteLocal.f_direccion),
              f_activo: normalizeString(clienteLocal.f_activo),
              f_cedula: normalizeString(clienteLocal.f_cedula),
              f_dias_aviso: normalizeString(clienteLocal.f_dias_aviso),
              f_bloqueo_credito: normalizeString(clienteLocal.f_bloqueo_credito),
              f_facturar_contra_entrega: normalizeString(clienteLocal.f_facturar_contra_entrega),
              f_bloqueo_ck: normalizeString(clienteLocal.f_bloqueo_ck),
              f_limite_credito: normalizeNumber(clienteLocal.f_limite_credito)
            };
  
            let updateNeeded = false;
            let differences = [];
  
            if (local.f_nombre !== remote.f_nombre) {
              updateNeeded = true;
              differences.push(`f_nombre: local (${local.f_nombre}) vs remoto (${remote.f_nombre})`);
            }
            // Compara el resto de los campos de la misma manera...
            if (local.f_d_municipio !== remote.f_d_municipio) {
              updateNeeded = true;
              differences.push(`f_d_municipio: local (${local.f_d_municipio}) vs remoto (${remote.f_d_municipio})`);
            }
            // ... agrega todas las comparaciones necesarias
  
            if (updateNeeded) {
              await clienteLocal.update(record => {
                record.f_id = remote.f_id;
                record.f_nombre = remote.f_nombre;
                record.f_d_municipio = remote.f_d_municipio;
                record.f_vendedor = remote.f_vendedor;
                record.f_zona = remote.f_zona;
                record.f_telefono = remote.f_telefono;
                record.f_telefono_pro = remote.f_telefono_pro;
                record.f_descuento_maximo = remote.f_descuento_maximo;
                record.f_descuento1 = remote.f_descuento1;
                record.f_clasificacion = remote.f_clasificacion;
                record.f_direccion = remote.f_direccion;
                record.f_activo = remote.f_activo;
                record.f_cedula = remote.f_cedula;
                record.f_dias_aviso = remote.f_dias_aviso;
                record.f_bloqueo_credito = remote.f_bloqueo_credito;
                record.f_facturar_contra_entrega = remote.f_facturar_contra_entrega;
                record.f_bloqueo_ck = remote.f_bloqueo_ck;
                record.f_limite_credito = remote.f_limite_credito;
              });
              console.log(`Cliente ${remote.f_id} actualizado. Cambios: ${differences.join(', ')}`);
            } else {
              console.log(`Cliente ${remote.f_id} sin cambios.`);
            }
          } else {
            await clientesCollection.create(record => {
              record.f_id = remote.f_id;
              record.f_nombre = remote.f_nombre;
              record.f_d_municipio = remote.f_d_municipio;
              record.f_vendedor = remote.f_vendedor;
              record.f_zona = remote.f_zona;
              record.f_telefono = remote.f_telefono;
              record.f_telefono_pro = remote.f_telefono_pro;
              record.f_descuento_maximo = remote.f_descuento_maximo;
              record.f_descuento1 = remote.f_descuento1;
              record.f_clasificacion = remote.f_clasificacion;
              record.f_direccion = remote.f_direccion;
              record.f_activo = remote.f_activo;
              record.f_cedula = remote.f_cedula;
              record.f_dias_aviso = remote.f_dias_aviso;
              record.f_bloqueo_credito = remote.f_bloqueo_credito;
              record.f_facturar_contra_entrega = remote.f_facturar_contra_entrega;
              record.f_bloqueo_ck = remote.f_bloqueo_ck;
              record.f_limite_credito = remote.f_limite_credito;
            });
            console.log(`Cliente ${remote.f_id} insertado.`);
          }
        }
      });
      cargarClientesLocales();
    } catch (error) {
      console.error('❌ Error al sincronizar clientes:', error);
    }
    finally {
      syncClientesInProgress = false;
    }
  };
  


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

const cargarClientesLocales = async () =>{
  try {
    const clientesLocales = await database.collections.get('t_clientes').query().fetch();
    setClientes(clientesLocales);
  } catch (error) {
    console.error('Error al cargar clientes locales:', error);
  }
  
}

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
    if (syncInProgress) {
      return;
    }
    cargarProductos();
  }, 40000); // 90,000 ms = 90 segundos

  // Limpia el intervalo cuando el componente se desmonte
  return () => clearInterval(intervalId);
}, []);

useEffect(() => {
  // Cargar clientes locales de inmediato
  cargarClientesLocales();

  // Verificar la conexión y sincronizar si es posible
  NetInfo.fetch().then(netState => {
    if (netState.isConnected) {
      sincronizarClientes();
    }
  });
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
      {/* Listado de clientes filtrados */}
      <View style={styles.listContainer2}>
        <KeyboardAwareFlatList
          data={clientesFiltrados}
          keyExtractor={item => item.f_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.textContainer}>
                <TouchableOpacity onPress={() => setClienteSeleccionado(item)}>
                  <Text style={styles.itemText}>({item.f_id}) {item.f_nombre}</Text>
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

//funcion del modal cambiar cantidad adel resumen del pedido
const cambiarCantidad = (f_referencia) => {
  const producto = pedido[f_referencia];
  if (!producto) {
    Alert.alert("Producto no encontrado", "El producto seleccionado no existe en el pedido.");
    return;
  }
  setProductoParaEditar({ ...producto, f_referencia });
  setNuevaCantidad(producto.cantidad.toString());
  setModalEditVisible(true);
};

const realizarPedidoLocal = async () => {
  if(isSaving) return;
  setIsSaving(true);
  // Convertir el objeto 'pedido' en un array de detalles
  const productosPedido = Object.entries(pedido).map(([f_referencia, data]) => ({
    f_referencia: parseInt(f_referencia, 10),
    cantidad: data.cantidad,
    f_precio: data.f_precio5,
  }));

  if (productosPedido.length === 0) {
    Alert.alert("Error", "No has seleccionado ningún producto");
    return;
  }

  try {
    await database.write(async () => {
      // Obtener las colecciones correspondientes
      const facturaCollection = database.collections.get('t_factura_pedido');
      const detalleCollection = database.collections.get('t_detalle_factura_pedido');

      // Generar un identificador único para el documento del pedido
      const documento = `PEDO-${Date.now()}`;

      // Insertar el encabezado (factura del pedido)
      await facturaCollection.create(record => {
        record.f_cliente = clienteSeleccionado.f_id;
        record.f_documento = documento;
        record.f_tipodoc = 'PEDO';
        record.f_nodoc = 1; // Ajusta según tu lógica
        record.f_fecha = new Date().toISOString();
        record.f_itbis = itbis; // Calculado previamente
        record.f_descuento = 0;
        record.f_porc_descuento = 0;
        record.f_monto = totalNeto; // Total neto del pedido
        record.f_condicion = 1; // Por ejemplo, 1 para contado
      });

      // Insertar cada detalle del pedido
      for (const item of productosPedido) {
        await detalleCollection.create(record => {
          record.f_documento = documento; // Relaciona el detalle con el encabezado
          record.f_referencia = item.f_referencia;
          record.f_cantidad = item.cantidad;
          record.f_precio = item.f_precio;
        });
      }
    });

    Alert.alert("Éxito", "Pedido guardado localmente");
    setPedido({});
    setModalVisible(false);
  } catch (error) {
    console.error("Error al guardar el pedido localmente:", error);
    Alert.alert("Error", "No se pudo guardar el pedido localmente");
  }
  finally {
    setIsSaving(false);
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


    {/* Listado de productos hacer*/}
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
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 10 }}>
          {/* Sección no scrollable: encabezado */}
          <View>
            <Text style={styles.title}>🛒 Resumen del Pedido</Text>
            <Text style={styles.title}>
              Cliente: ({clienteSeleccionado.f_id}) {clienteSeleccionado.f_nombre}
            </Text>
            <Text>Crédito Disponible: ${creditoDisponible.toFixed(2)}</Text>
            <View style={styles.modalHeader}>
              <Text>Total bruto: ${totalBruto.toFixed(2)}</Text>
              <Text>ITBIS: ${itbis.toFixed(2)}</Text>
              <Text style={styles.title}>
                Total del pedido: ${totalNeto.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.title}>Detalle del pedido:</Text>
          </View>

          {/* Área scrollable: lista de productos */}
          <View style={{ flex: 1 }}>
            {Object.keys(pedido).length > 0 ? (
              <KeyboardAwareFlatList
                data={Object.entries(pedido)}
                keyExtractor={([f_referencia]) => f_referencia}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item: [f_referencia, data] }) => (
                  <View style={styles.listContainer}>
                    <View style={{ flex: 1 }}>
                      <Text>
                        ({data.f_referencia}) - {data.f_referencia_suplidor}
                      </Text>
                      <Text>{data.f_descripcion}</Text>
                      <Text>Cantidad: {data.cantidad}</Text>
                      <Text>
                        Precio: ${data.f_precio5} Total: $
                        {(data.f_precio5 * data.cantidad).toFixed(2)}
                      </Text>
                    </View>
                    <View>
                      <TouchableOpacity onPress={() => cambiarCantidad(f_referencia)} style={styles.modalButton2}>
                        <Text style={[styles.modalButtonText, isSaving && { opacity: 0.6 }]}
                          disabled={isSaving}>✍️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => eliminarDelPedido(f_referencia)} style={[styles.modalButton3, isSaving && { opacity: 0.6 }]}
                        disabled={isSaving}>
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

        {/* Contenedor fijo de botones */}
        <View style={{ height: 60, flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
          <Pressable onPress={() => setModalVisible(false)} style={[styles.buttonRow2, isSaving && { opacity: 0.6 }]}
            disabled={isSaving}>
            <Text style={styles.buttonText}>Agregar productos</Text>
          </Pressable>
          <Pressable 
              onPress={realizarPedidoLocal} 
              style={[styles.buttonRow, isSaving && { opacity: 0.6 }]} 
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirmar Pedido</Text>
              )}
            </Pressable>
        </View>
      </SafeAreaView>
    </Modal>

    <CambiarCantidadModal
      visible={modalEditVisible}
      onCancel={() => setModalEditVisible(false)}
      onAccept={() => {
        actualizarCantidad(productoParaEditar.f_referencia, nuevaCantidad, productoParaEditar);
        setModalEditVisible(false);
      }}
      producto={productoParaEditar}
      nuevaCantidad={nuevaCantidad}
      setNuevaCantidad={setNuevaCantidad}
    />



  </SafeAreaView>
);
}
