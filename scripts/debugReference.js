require('dotenv').config();
const axios = require('axios'); // Asegúrate de tener axios instalado
const { getAuthHeaders } = require('../utils/auth');

async function debugFave() {
    const headers = await getAuthHeaders();
    const url = `${process.env.ERP_BASE_URL}/documents/${process.env.RUT_EMPRESA}/FAVE/V?details=1&limit=1`;

    console.log('Fetching URL:', url);
    const response = await axios.get(url, { headers });

    console.log('Response Keys:', Object.keys(response.data));
    if (response.data.data && Array.isArray(response.data.data)) {
        console.log('First Doc Keys:', Object.keys(response.data.data[0]));
        console.log('Full First Doc:', JSON.stringify(response.data.data[0], null, 2));
    } else {
        console.log('Data structure unexpected:', JSON.stringify(response.data, null, 2));
    }
}

debugFave().catch(console.error);
