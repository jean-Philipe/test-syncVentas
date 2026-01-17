// Estado de la aplicación
let productosData = [];
let productosFiltrados = [];
let columnasHistoricas = []; // Array de labels de meses
let mesActual = null;
const API_BASE_URL = '/api';
// Timeouts para debounce de guardado automático
const timeoutsGuardado = new Map();

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
    mesesSelect.addEventListener('change', cargarDatos);

    // Cargar datos automáticamente al iniciar
    cargarDatos();
});

// Cargar datos desde la API (nueva endpoint /api/dashboard)
async function cargarDatos() {
    try {
        statusSpan.textContent = 'Cargando...';
        btnCargar.disabled = true;

        const marca = marcaInput.value.trim();
        const meses = mesesSelect.value;

        // Usar el nuevo endpoint del dashboard
        let url = `${API_BASE_URL}/dashboard?meses=${meses}`;
        if (marca) {
            url += `&marca=${encodeURIComponent(marca)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Respuesta del dashboard:', data);

        productosData = data.productos || [];
        mesActual = data.meta?.mesActual || null;
        columnasHistoricas = data.meta?.columnas || [];

        console.log('Datos cargados:', {
            totalProductos: productosData.length,
            mesActual: mesActual,
            columnas: columnasHistoricas
        });

        // Generar encabezados con las columnas dinámicas
        generarEncabezados();

        if (productosData.length === 0) {
            statusSpan.textContent = 'No se encontraron productos con los filtros aplicados';
        } else {
            const lastSync = data.meta?.generadoEn ? new Date(data.meta.generadoEn).toLocaleTimeString() : new Date().toLocaleTimeString();
            statusSpan.textContent = `Datos cargados - ${lastSync}`;
        }

        aplicarFiltros();

    } catch (error) {
        console.error('Error al cargar datos:', error);
        statusSpan.textContent = `Error: ${error.message}`;
        productosData = [];
        productosFiltrados = [];
        columnasHistoricas = [];
        mesActual = null;

        // Generar encabezados básicos en caso de error
        theadMeses.innerHTML = '<th rowspan="2">SKU</th><th rowspan="2">Descripción</th><th rowspan="2">Familia</th><th colspan="4" class="section-header">Mes Actual</th>';
        theadMesesActual.innerHTML = '<th class="section-divider col-mes-actual">Venta Mes</th><th class="col-mes-actual">Stock</th><th class="col-mes-actual">Compra Sugerida</th><th class="col-mes-actual">Compra a Realizar</th>';

        tbodyProductos.innerHTML = `<tr><td colspan="7" class="empty-message">Error al cargar datos: ${error.message}<br><small>Verifica que el servidor esté corriendo</small></td></tr>`;
        totalProductosSpan.textContent = '0 productos';
    } finally {
        btnCargar.disabled = false;
    }
}

// Generar encabezados de la tabla dinámicamente
function generarEncabezados() {
    // SKU, Descripción y Familia con rowspan 2
    let htmlMeses = '<th rowspan="2">SKU</th><th rowspan="2">Descripción</th><th rowspan="2">Familia</th>';

    // Columnas de meses históricos (cada mes en su propia columna)
    columnasHistoricas.forEach(label => {
        htmlMeses += `<th rowspan="2">${label}</th>`;
    });

    // Primera fila: columnas base + meses históricos + "Mes Actual" (colspan 4)
    theadMeses.innerHTML = htmlMeses + '<th colspan="4" class="section-header">Mes Actual</th>';

    // Segunda fila: las 4 columnas del mes actual
    const htmlActual = `
        <th class="section-divider col-mes-actual">Venta Mes</th>
        <th class="col-mes-actual">Stock</th>
        <th class="col-mes-actual">Compra Sugerida</th>
        <th class="col-mes-actual pedido-column">Compra a Realizar</th>
    `;

    theadMesesActual.innerHTML = htmlActual;
}

// Aplicar filtros de búsqueda
function aplicarFiltros() {
    const busqueda = busquedaInput.value.trim().toLowerCase();
    const ocultarCero = ocultarCeroCheckbox.checked;

    let productosTemp = productosData;

    // Filtro de búsqueda
    if (busqueda) {
        productosTemp = productosData.filter(producto => {
            const sku = producto.producto.sku.toLowerCase();
            const descripcion = producto.producto.descripcion.toLowerCase();
            const familia = (producto.producto.familia || '').toLowerCase();
            return sku.includes(busqueda) || descripcion.includes(busqueda) || familia.includes(busqueda);
        });
    }

    // Filtro de promedio = 0
    if (ocultarCero) {
        productosFiltrados = productosTemp.filter(producto => {
            return (producto.promedio || 0) > 0;
        });
    } else {
        productosFiltrados = productosTemp;
    }

    renderizarTabla();
}

// Renderizar tabla con los datos
function renderizarTabla() {
    // Total columnas: SKU + Descripción + Familia + meses históricos + 4 columnas mes actual
    const totalColumnas = 3 + columnasHistoricas.length + 4;

    if (productosFiltrados.length === 0) {
        const colspan = columnasHistoricas.length > 0 ? totalColumnas : 7;
        tbodyProductos.innerHTML = `<tr><td colspan="${colspan}" class="empty-message">No se encontraron productos</td></tr>`;
        totalProductosSpan.textContent = '0 productos';
        return;
    }

    totalProductosSpan.textContent = `${productosFiltrados.length} productos`;

    tbodyProductos.innerHTML = productosFiltrados.map(producto => {
        // Generar celdas de meses históricos usando ventasMeses del backend
        let celdasMeses = '';
        if (producto.ventasMeses && Array.isArray(producto.ventasMeses)) {
            producto.ventasMeses.forEach(mes => {
                celdasMeses += `<td>${formatearNumero(mes.cantidad)}</td>`;
            });
        } else {
            // Fallback: celdas vacías si no hay datos
            columnasHistoricas.forEach(() => {
                celdasMeses += '<td>0</td>';
            });
        }

        // Datos del mes actual
        const ventaMesActual = producto.mesActual?.ventaActual || 0;
        const stockActual = producto.mesActual?.stockActual || 0;
        const compraSugerida = producto.compraSugerida || 0;
        const compraRealizar = producto.compraRealizar !== null ? producto.compraRealizar : '';

        // Clase para compra sugerida negativa
        const compraSugeridaClass = compraSugerida < 0 ? 'negative' : (compraSugerida > 0 ? 'positive' : '');

        return `
            <tr>
                <td>${producto.producto.sku}</td>
                <td>${producto.producto.descripcion}</td>
                <td>${producto.producto.familia || '-'}</td>
                ${celdasMeses}
                <td class="section-divider col-mes-actual">${formatearNumero(ventaMesActual)}</td>
                <td class="stock-column col-mes-actual">${formatearNumero(stockActual)}</td>
                <td class="${compraSugeridaClass} col-mes-actual">${formatearNumero(compraSugerida)}</td>
                <td class="pedido-column col-mes-actual">
                    <span class="editable" 
                          data-producto-id="${producto.producto.id}"
                          data-value="${compraRealizar}"
                          contenteditable="true"
                          onblur="guardarOrden(${producto.producto.id}, this)"
                          oninput="guardarOrdenAutomatico(${producto.producto.id}, this)"
                          onkeypress="if(event.key==='Enter') { this.blur(); }">
                        ${compraRealizar || ''}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Guardar orden automáticamente con debounce
function guardarOrdenAutomatico(productoId, elemento) {
    if (timeoutsGuardado.has(productoId)) {
        clearTimeout(timeoutsGuardado.get(productoId));
    }

    const nuevoValor = elemento.textContent.trim();
    const cantidad = nuevoValor === '' ? 0 : parseFloat(nuevoValor);

    if (nuevoValor !== '' && (isNaN(cantidad) || cantidad < 0)) {
        return;
    }

    const timeoutId = setTimeout(() => {
        guardarOrden(productoId, elemento);
        timeoutsGuardado.delete(productoId);
    }, 800);

    timeoutsGuardado.set(productoId, timeoutId);
}

// Guardar orden (usando el nuevo endpoint del dashboard)
async function guardarOrden(productoId, elemento) {
    if (timeoutsGuardado.has(productoId)) {
        clearTimeout(timeoutsGuardado.get(productoId));
        timeoutsGuardado.delete(productoId);
    }

    const nuevoValor = elemento.textContent.trim();
    const cantidad = nuevoValor === '' ? 0 : parseFloat(nuevoValor);

    if (isNaN(cantidad) || cantidad < 0) {
        const valorAnterior = elemento.getAttribute('data-value') || '';
        elemento.textContent = valorAnterior;
        return;
    }

    const valorAnterior = parseFloat(elemento.getAttribute('data-value') || '0');
    if (cantidad === valorAnterior) {
        return;
    }

    try {
        statusSpan.textContent = 'Guardando...';

        const response = await fetch(`${API_BASE_URL}/dashboard/orden`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: [{ productoId, cantidad }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error al guardar: ${response.statusText}`);
        }

        elemento.setAttribute('data-value', cantidad.toString());

        // Actualizar datos locales
        const producto = productosData.find(p => p.producto.id === productoId);
        if (producto) {
            producto.compraRealizar = cantidad;
        }

        statusSpan.textContent = `Guardado - ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Error al guardar orden:', error);
        statusSpan.textContent = `Error: ${error.message}`;

        const valorAnterior = elemento.getAttribute('data-value') || '';
        elemento.textContent = valorAnterior;
    }
}

// Formatear números
function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '0';
    const num = parseFloat(numero);
    if (isNaN(num)) return '0';

    if (num % 1 === 0) {
        return num.toLocaleString('es-CL');
    }

    return num.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Hacer las funciones disponibles globalmente
window.guardarOrden = guardarOrden;
window.guardarOrdenAutomatico = guardarOrdenAutomatico;