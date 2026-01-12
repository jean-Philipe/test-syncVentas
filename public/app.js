// Estado de la aplicación
let productosData = [];
let productosFiltrados = [];
let mesesHistoricos = []; // Array de objetos {ano, mes, nombre}
let mesActual = null;
const API_BASE_URL = '/api';
// Timeouts para debounce de guardado automático
const timeoutsGuardado = new Map();

// Nombres de meses en español
const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Elementos del DOM
const btnCargar = document.getElementById('btnCargar');
const marcaInput = document.getElementById('marca');
const mesesSelect = document.getElementById('meses');
const busquedaInput = document.getElementById('busqueda');
const ocultarCeroCheckbox = document.getElementById('ocultarCero');
const theadMeses = document.getElementById('theadMeses');
const theadMesesActual = document.getElementById('theadMesesActual');
const tbodyProductos = document.getElementById('tbodyProductos');
const statusSpan = document.getElementById('status');
const totalProductosSpan = document.getElementById('totalProductos');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    btnCargar.addEventListener('click', cargarDatos);
    busquedaInput.addEventListener('input', aplicarFiltros);
    ocultarCeroCheckbox.addEventListener('change', aplicarFiltros);
    mesesSelect.addEventListener('change', cargarDatos); // Recargar datos cuando cambie el filtro de meses
    
    // Cargar datos automáticamente al iniciar
    cargarDatos();
});

// Cargar datos desde la API
async function cargarDatos() {
    try {
        statusSpan.textContent = 'Cargando...';
        btnCargar.disabled = true;
        
        const marca = marcaInput.value.trim();
        const meses = mesesSelect.value;
        
        // Construir URL con parámetros
        let url = `${API_BASE_URL}/productos/completo?meses=${meses}`;
        if (marca) {
            url += `&marca=${encodeURIComponent(marca)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Respuesta completa del backend:', data);
        productosData = data.productos || [];
        mesActual = data.mesActual || null;
        
        console.log('Datos cargados:', {
            totalProductos: productosData.length,
            mesActual: mesActual,
            productosConVentasHistoricas: productosData.filter(p => p.ventasHistoricas && p.ventasHistoricas.length > 0).length
        });
        
        // Log de ejemplo de producto para debug
        if (productosData.length > 0) {
            const ejemploProducto = productosData[0];
            console.log('Ejemplo de producto:', {
                sku: ejemploProducto.producto?.sku,
                promedioVenta: ejemploProducto.promedioVenta,
                ventaActual: ejemploProducto.ventaActual,
                stockActual: ejemploProducto.ventaActual?.stockActual,
                cantidadVendida: ejemploProducto.ventaActual?.cantidadVendida,
                ventasHistoricas: ejemploProducto.ventasHistoricas?.length || 0,
                productoCompleto: ejemploProducto
            });
            
            // Resumen de promedios de venta
            const productosConPromedio = productosData.filter(p => (p.promedioVenta || 0) > 0);
            const productosConStock = productosData.filter(p => (p.ventaActual?.stockActual || 0) > 0);
            const productosConVentaActual = productosData.filter(p => (p.ventaActual?.cantidadVendida || 0) > 0);
            
            console.log('Resumen de datos:', {
                totalProductos: productosData.length,
                productosConPromedioMayorACero: productosConPromedio.length,
                productosConStockMayorACero: productosConStock.length,
                productosConVentaActualMayorACero: productosConVentaActual.length,
                primerosPromedios: productosData.slice(0, 5).map(p => ({
                    sku: p.producto?.sku,
                    promedioVenta: p.promedioVenta,
                    stockActual: p.ventaActual?.stockActual,
                    cantidadVendida: p.ventaActual?.cantidadVendida
                }))
            });
        }
        
        // Procesar meses históricos únicos de todos los productos
        procesarMesesHistoricos();
        
        console.log('Meses históricos procesados:', mesesHistoricos.length, mesesHistoricos);
        
        if (productosData.length === 0) {
            statusSpan.textContent = 'No se encontraron productos con los filtros aplicados';
        } else {
            statusSpan.textContent = `Datos cargados - ${new Date().toLocaleTimeString()}`;
        }
        
        aplicarFiltros();
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        statusSpan.textContent = `Error: ${error.message}`;
        productosData = [];
        productosFiltrados = [];
        mesesHistoricos = [];
        mesActual = null;
        
        // Generar encabezados básicos incluso en caso de error
        theadMeses.innerHTML = '<th rowspan="2">SKU</th><th rowspan="2">Descripción</th><th colspan="5" class="section-header">Mes Actual</th>';
        theadMesesActual.innerHTML = '<th class="section-divider col-mes-actual">Stock Actual</th><th class="col-mes-actual">Promedio Venta</th><th class="col-mes-actual">Compra Sugerida</th><th class="col-mes-actual">Pedido Actual</th><th class="col-mes-actual">Venta Actual</th>';
        
        tbodyProductos.innerHTML = `<tr><td colspan="7" class="empty-message">Error al cargar datos: ${error.message}<br><small>Verifica que el servidor esté corriendo y que la API esté disponible</small></td></tr>`;
        totalProductosSpan.textContent = '0 productos';
    } finally {
        btnCargar.disabled = false;
    }
}

// Procesar meses históricos únicos de todos los productos
function procesarMesesHistoricos() {
    const mesesSet = new Set();
    
    productosData.forEach(producto => {
        if (producto.ventasHistoricas && Array.isArray(producto.ventasHistoricas)) {
            producto.ventasHistoricas.forEach(venta => {
                const key = `${venta.ano}-${venta.mes}`;
                mesesSet.add(JSON.stringify({ ano: venta.ano, mes: venta.mes }));
            });
        }
    });
    
    // Convertir a array y ordenar por año y mes (más antiguo primero)
    mesesHistoricos = Array.from(mesesSet)
        .map(str => JSON.parse(str))
        .sort((a, b) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.mes - b.mes;
        });
    
    console.log('Meses históricos encontrados:', mesesHistoricos.length, mesesHistoricos.map(m => `${m.mes}/${m.ano}`));
    
    // Generar encabezados de la tabla
    generarEncabezados();
}

// Generar encabezados de la tabla dinámicamente
function generarEncabezados() {
    let htmlMeses = '';
    
    // SKU y Descripción con rowspan 2
    const skuDesc = '<th rowspan="2">SKU</th><th rowspan="2">Descripción</th>';
    
    // Columnas de meses históricos (cada mes en su propia columna)
    mesesHistoricos.forEach(mes => {
        const nombreMes = nombresMeses[mes.mes - 1];
        htmlMeses += `<th rowspan="2">${nombreMes} ${mes.ano}</th>`;
    });
    
    // Primera fila: SKU, Descripción, meses históricos, y "Mes Actual" (colspan 5)
    theadMeses.innerHTML = skuDesc + htmlMeses + '<th colspan="5" class="section-header">Mes Actual</th>';
    
    // Segunda fila: solo las 5 columnas del mes actual (SKU y Descripción tienen rowspan, meses históricos también)
    const htmlActual = `
        <th class="section-divider col-mes-actual">Stock Actual</th>
        <th class="col-mes-actual">Promedio Venta</th>
        <th class="col-mes-actual">Compra Sugerida</th>
        <th class="col-mes-actual">Pedido Actual</th>
        <th class="col-mes-actual">Venta Actual</th>
    `;
    
    theadMesesActual.innerHTML = htmlActual;
}

// Aplicar filtros de búsqueda
function aplicarFiltros() {
    const busqueda = busquedaInput.value.trim().toLowerCase();
    const ocultarCero = ocultarCeroCheckbox.checked;
    
    // Aplicar filtro de búsqueda
    let productosTemp = productosData;
    
    if (busqueda) {
        productosTemp = productosData.filter(producto => {
            const sku = producto.producto.sku.toLowerCase();
            const descripcion = producto.producto.descripcion.toLowerCase();
            return sku.includes(busqueda) || descripcion.includes(busqueda);
        });
    }
    
    // Aplicar filtro de promedio de venta = 0
    // Ocultar todos los productos que tengan promedioVenta = 0, independientemente del stock
    if (ocultarCero) {
        productosFiltrados = productosTemp.filter(producto => {
            const promedioVenta = producto.promedioVenta || 0;
            // Solo mostrar productos con promedioVenta > 0
            return promedioVenta > 0;
        });
    } else {
        productosFiltrados = productosTemp;
    }
    
    renderizarTabla();
}

// Renderizar tabla con los datos
function renderizarTabla() {
    // Calcular total de columnas: SKU + Descripción + meses históricos + 5 columnas del mes actual
    const totalColumnas = 2 + mesesHistoricos.length + 5; // SKU + Descripción + meses + 5 del mes actual
    
    if (productosFiltrados.length === 0) {
        // Si no hay meses históricos, usar mínimo de 7 columnas
        const colspan = mesesHistoricos.length > 0 ? totalColumnas : 7;
        tbodyProductos.innerHTML = `<tr><td colspan="${colspan}" class="empty-message">No se encontraron productos</td></tr>`;
        totalProductosSpan.textContent = '0 productos';
        return;
    }
    
    totalProductosSpan.textContent = `${productosFiltrados.length} productos`;
    
    // Crear mapa de ventas por mes para cada producto
    tbodyProductos.innerHTML = productosFiltrados.map(producto => {
        // Crear mapa de ventas históricas por mes
        const ventasPorMes = new Map();
        if (producto.ventasHistoricas && Array.isArray(producto.ventasHistoricas)) {
            producto.ventasHistoricas.forEach(venta => {
                const key = `${venta.ano}-${venta.mes}`;
                ventasPorMes.set(key, venta.cantidadVendida);
            });
        }
        
        // Generar celdas de meses históricos
        let celdasMeses = '';
        mesesHistoricos.forEach(mes => {
            const key = `${mes.ano}-${mes.mes}`;
            const cantidad = ventasPorMes.get(key) || 0;
            celdasMeses += `<td>${formatearNumero(cantidad)}</td>`;
        });
        
        // Datos del mes actual
        const stockActual = producto.ventaActual?.stockActual || 0;
        const promedioVenta = producto.promedioVenta || 0;
        const pedidoActual = producto.pedidoActual !== null ? producto.pedidoActual : '';
        const ventaActual = producto.ventaActual?.cantidadVendida || 0;
        const compraSugerida = Math.ceil(promedioVenta - stockActual - ventaActual);
        
        // Debug: log del primer producto para verificar valores
        if (productosFiltrados.indexOf(producto) === 0) {
            console.log('Renderizando primer producto:', {
                sku: producto.producto.sku,
                stockActual,
                promedioVenta,
                ventaActual,
                ventaActualObj: producto.ventaActual
            });
        }
        
        // Determinar clase para compra sugerida (negativa o positiva)
        const compraSugeridaClass = compraSugerida < 0 ? 'negative' : '';
        
        return `
            <tr>
                <td>${producto.producto.sku}</td>
                <td>${producto.producto.descripcion}</td>
                ${celdasMeses}
                <td class="stock-column section-divider col-mes-actual">${formatearNumero(stockActual)}</td>
                <td class="col-mes-actual">${formatearNumero(promedioVenta)}</td>
                <td class="${compraSugeridaClass} col-mes-actual">${formatearNumero(compraSugerida)}</td>
                <td class="pedido-column col-mes-actual">
                    <span class="editable" 
                          data-producto-id="${producto.producto.id}"
                          data-value="${pedidoActual}"
                          contenteditable="true"
                          onblur="guardarPedido(${producto.producto.id}, this, true)"
                          oninput="guardarPedidoAutomatico(${producto.producto.id}, this)"
                          onkeypress="if(event.key==='Enter') { this.blur(); }">
                        ${pedidoActual || '0'}
                    </span>
                </td>
                <td class="col-mes-actual">${formatearNumero(ventaActual)}</td>
            </tr>
        `;
    }).join('');
}

// Guardar pedido automáticamente con debounce
function guardarPedidoAutomatico(productoId, elemento) {
    // Cancelar timeout anterior si existe
    if (timeoutsGuardado.has(productoId)) {
        clearTimeout(timeoutsGuardado.get(productoId));
    }
    
    // Validar el valor actual antes de guardar
    const nuevoValor = elemento.textContent.trim();
    const cantidad = nuevoValor === '' ? 0 : parseFloat(nuevoValor);
    
    // Si el valor no es válido, no hacer nada (el usuario puede estar escribiendo)
    if (nuevoValor !== '' && (isNaN(cantidad) || cantidad < 0)) {
        return; // No guardar valores inválidos, pero permitir que el usuario siga escribiendo
    }
    
    // Crear nuevo timeout para guardar después de 500ms de inactividad
    const timeoutId = setTimeout(() => {
        guardarPedido(productoId, elemento, false);
        timeoutsGuardado.delete(productoId);
    }, 500);
    
    timeoutsGuardado.set(productoId, timeoutId);
}

// Guardar pedido
async function guardarPedido(productoId, elemento, esInmediato = false) {
    // Si hay un timeout pendiente, cancelarlo
    if (timeoutsGuardado.has(productoId)) {
        clearTimeout(timeoutsGuardado.get(productoId));
        timeoutsGuardado.delete(productoId);
    }
    
    const nuevoValor = elemento.textContent.trim();
    const cantidad = nuevoValor === '' ? 0 : parseFloat(nuevoValor);
    
    // Validar que sea un número válido
    if (isNaN(cantidad) || cantidad < 0) {
        // Restaurar valor anterior
        const valorAnterior = elemento.getAttribute('data-value') || '0';
        elemento.textContent = valorAnterior;
        return;
    }
    
    // Si el valor no ha cambiado, no hacer nada
    const valorAnterior = parseFloat(elemento.getAttribute('data-value') || '0');
    if (cantidad === valorAnterior && !esInmediato) {
        return;
    }
    
    try {
        statusSpan.textContent = 'Guardando pedido...';
        
        const response = await fetch(`${API_BASE_URL}/pedidos/${productoId}/actual`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cantidad: cantidad
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error al guardar: ${response.statusText}`);
        }
        
        // Actualizar el atributo data-value
        elemento.setAttribute('data-value', cantidad.toString());
        
        // Actualizar los datos locales
        const producto = productosData.find(p => p.producto.id === productoId);
        if (producto) {
            producto.pedidoActual = cantidad;
        }
        
        statusSpan.textContent = `Pedido guardado - ${new Date().toLocaleTimeString()}`;
        
    } catch (error) {
        console.error('Error al guardar pedido:', error);
        statusSpan.textContent = `Error al guardar: ${error.message}`;
        
        // Restaurar valor anterior en caso de error
        const valorAnterior = elemento.getAttribute('data-value') || '0';
        elemento.textContent = valorAnterior;
    }
}

// Formatear números
function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '0';
    const num = parseFloat(numero);
    if (isNaN(num)) return '0';
    
    // Si es un número entero, mostrarlo sin decimales
    if (num % 1 === 0) {
        return num.toString();
    }
    
    // Si tiene decimales, mostrar 2 decimales
    return num.toFixed(2);
}

// Hacer las funciones disponibles globalmente
window.guardarPedido = guardarPedido;
window.guardarPedidoAutomatico = guardarPedidoAutomatico;