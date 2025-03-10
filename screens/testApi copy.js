import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, ActivityIndicator,
    TextInput, Button, TouchableOpacity, Modal, SafeAreaView, Alert
} from 'react-native';
import api from '../api/axios';
import { styles } from '../assets/styles';

export default function TestApi() {
    // Estados para clientes
    const [clientes, setClientes] = useState([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [searchTextClientes, setSearchTextClientes] = useState('');
    const [balanceCliente, setBalanceCliente] = useState(0);

    // Estados para productos y pedido
    const [productos, setProductos] = useState([]);
    const [searchTextProductos, setSearchTextProductos] = useState('');
    const [pedido, setPedido] = useState({});
    const [modalVisible, setModalVisible] = useState(false);

    // Estado de carga general
    const [loading, setLoading] = useState(true);

    // Obtiene los clientes al cargar el componente
    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const response = await api.get('/clientes');
                setClientes(response.data);
            } catch (error) {
                console.error('❌ Error al obtener clientes:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchClientes();
    }, []);

    //BUSCAR CUENTA POR COBRAR DEL CLIENTE
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





    // Una vez seleccionado un cliente, se obtienen los productos
    useEffect(() => {
        if (clienteSeleccionado) {
            const fetchProductos = async () => {
                try {
                    setLoading(true);
                    const response = await api.get('/productos');
                    setProductos(response.data);
                } catch (error) {
                    console.error('❌ Error al obtener productos:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchProductos();
        }
    }, [clienteSeleccionado]);

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
    }

    // Si aún no se ha seleccionado un cliente, mostramos la selección de cliente
    if (!clienteSeleccionado) {
        const clientesFiltrados = clientes.filter(cliente =>
            cliente.f_nombre.toLowerCase().includes(searchTextClientes.toLowerCase())
        );

        return (
            <View style={styles.container}>
                <Text style={styles.title}>Selecciona un Cliente</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Buscar cliente..."
                    value={searchTextClientes}
                    onChangeText={setSearchTextClientes}
                />
                <FlatList
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
        );
    }

    // Filtra los productos según lo ingresado en la búsqueda
    const productosFiltrados = productos.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTextProductos.toLowerCase()) ||
        producto.referencia.toLowerCase().includes(searchTextProductos.toLowerCase()) ||
        producto.id.toString().includes(searchTextProductos)
    );

    // Función para actualizar la cantidad en el pedido
    const actualizarCantidad = (id, cantidad, producto) => {
        if (cantidad === '') {
            // Si se borra el contenido, eliminamos el producto del pedido
            setPedido(prevPedido => {
                const nuevoPedido = { ...prevPedido };
                delete nuevoPedido[id];
                return nuevoPedido;
            });
        } else {
            const cantidadNumerica = parseInt(cantidad, 10) || 0;
            setPedido(prevPedido => ({
                ...prevPedido,
                [id]: prevPedido[id]
                    ? { ...prevPedido[id], cantidad: cantidadNumerica }
                    : { nombre: producto.nombre, precio: producto.precio, cantidad: cantidadNumerica }
            }));
        }
    };

    const eliminarDelPedido = (id) => {
        setPedido(prevPedido => {
            const nuevoPedido = { ...prevPedido };
            delete nuevoPedido[id];
            return nuevoPedido;
        });
    };

    const realizarPedido = async () => {
        const productosPedido = Object.entries(pedido).map(([id, data]) => ({
            producto_id: id,
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



    const totalBruto = Object.values(pedido).reduce((total, item) => (total + item.precio * item.cantidad), 0);
    const itbis = Number(totalBruto) * 0.18;
    const totalNeto = Number(totalBruto) + Number(itbis);

    const creditoDisponible = balanceCliente - clienteSeleccionado.f_limite_credito - totalNeto;



    return (
        <View style={styles.container}>
            <Text style={styles.title}>Cliente: ({clienteSeleccionado.f_id}){clienteSeleccionado.f_nombre}</Text>
            <Text style={styles}>Limite de credito: ${clienteSeleccionado.f_limite_credito} </Text>
            <Text style={styles}>Disponible: ${creditoDisponible.toFixed(2)}</Text>
            <Text style={styles.title}>Total del pedido: ${totalNeto.toFixed(2)}</Text>
            <TextInput
                style={styles.input}
                placeholder="Buscar por nombre o referencia"
                value={searchTextProductos}
                onChangeText={setSearchTextProductos}
            />

            <FlatList
                data={productosFiltrados}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.item}>
                        <View style={styles.textContainer}>
                            <Text style={styles.itemText}>
                                ({item.id}) - {item.referencia}
                            </Text>
                            <Text style={styles.itemText}>{item.nombre}</Text>
                            <Text style={styles.itemText}>${item.precio}</Text>
                        </View>
                        <TextInput
                            style={styles.inputP}
                            placeholder="QTY"
                            keyboardType="numeric"
                            value={pedido[item.id]?.cantidad?.toString() || ''}
                            onChangeText={(cantidad) => actualizarCantidad(item.id, cantidad, item)}
                        />
                    </View>
                )}
                ListEmptyComponent={<Text>No se encontraron productos</Text>}
            />

            <Button title="Ver Pedido" onPress={() => setModalVisible(true)} />

            {/* Modal para mostrar el resumen del pedido */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <SafeAreaView style={styles.container}>
                    <View style={styles.modalContent}>
                        <Text style={styles.title}>🛒 Resumen del Pedido</Text>
                        <Text style={styles.title}>Cliente: ({clienteSeleccionado.f_id}){clienteSeleccionado.f_nombre}</Text>
                        <Text >Credito Disponible: ${creditoDisponible.toFixed(2)}</Text>
                        <View style={styles.modalHeader}>
                            <Text >Total bruto: ${totalBruto.toFixed(2)} </Text>
                            <Text >ITBIS: ${itbis.toFixed(2)} </Text>
                            <Text style={styles.title}>Total del pedido: ${totalNeto.toFixed(2)}</Text>
                        </View>
                        <Text style={styles.title}>Detalle del pedido:</Text>
                        {Object.keys(pedido).length > 0 ? (
                            <FlatList
                                data={Object.entries(pedido)}
                                keyExtractor={([id]) => id}
                                renderItem={({ item: [id, data] }) => (

                                    <View style={styles.item}>
                                        <View style={styles.textContainer}>
                                            <Text>{data.nombre} - {data.cantidad} x ${data.precio}</Text>
                                        </View>
                                        <View style={styles.deleteButtonContainer}>
                                        <TouchableOpacity onPress={() => eliminarDelPedido(id)}>
                                                <Text style={styles.modalButtonText}>❌</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            />
                        ) : (
                            <Text>No hay productos en el pedido</Text>
                        )}

                        <Button title="Confirmar Pedido" onPress={realizarPedido} />
                        <Button title="Cerrar" onPress={() => setModalVisible(false)} />
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
