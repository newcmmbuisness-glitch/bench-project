const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

// WICHTIG: Setze hier TEST_MODE auf true für Tests, false für echte PayPal-Zahlungen
const TEST_MODE = true; // true = überspringt PayPal, false = echte PayPal-Zahlung erforderlich

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    
    try {
        const { userId, paymentToken, testMode } = JSON.parse(event.body);
        
        if (!userId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Fehlende Benutzer-ID' }) 
            };
        }

        // Check if user exists
        const userCheck = await sql`
            SELECT id, is_user_plus FROM users WHERE id = ${userId}
        `;
        
        if (userCheck.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Benutzer nicht gefunden' }) 
            };
        }

        if (userCheck[0].is_user_plus) {
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Benutzer hat bereits UserPlus' 
                }) 
            };
        }

        // Test-Modus oder echte PayPal-Zahlung
        if (TEST_MODE) {
            console.log('TEST-MODUS: PayPal-Zahlung wird übersprungen');
            // Im Test-Modus direkt UserPlus aktivieren
        } else {
            // Echte PayPal-Zahlung überprüfen
            if (!paymentToken) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ 
                        error: 'PayPal-Zahlung erforderlich',
                        requiresPayment: true 
                    }) 
                };
            }

            // Hier würdest du die PayPal-Zahlung verifizieren
            // TODO: PayPal Payment verification implementieren
            const paymentValid = await verifyPayPalPayment(paymentToken);
            if (!paymentValid) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'PayPal-Zahlung fehlgeschlagen' }) 
                };
            }
        }

        // Update user to UserPlus
        await sql`
            UPDATE users 
            SET is_user_plus = TRUE 
            WHERE id = ${userId}
        `;

        // Optional: Log the purchase
        await sql`
            INSERT INTO purchases (user_id, product, payment_method, created_at)
            VALUES (${userId}, 'UserPlus', ${TEST_MODE ? 'test' : 'paypal'}, NOW())
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'UserPlus erfolgreich aktiviert!',
                testMode: TEST_MODE,
                features: [
                    'Swipe Back - Mache den letzten Swipe rückgängig',
                    'InstaMatch - Erstelle sofort ein Match'
                ]
            })
        };
        
    } catch (error) {
        console.error('Fehler beim UserPlus Kauf:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Echte PayPal-Verifikation implementiert
async function verifyPayPalPayment(paymentToken) {
    if (!paymentToken || !PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        console.error('PayPal Konfiguration unvollständig');
        return false;
    }

    try {
        // 1. Access Token von PayPal holen
        const authResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
                'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!authResponse.ok) {
            console.error('PayPal Auth fehlgeschlagen:', await authResponse.text());
            return false;
        }

        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        // 2. Order Details von PayPal abrufen
        const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paymentToken}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!orderResponse.ok) {
            console.error('PayPal Order Abruf fehlgeschlagen:', await orderResponse.text());
            return false;
        }

        const orderData = await orderResponse.json();
        console.log('PayPal Order Details:', JSON.stringify(orderData, null, 2));

        // 3. Zahlung validieren
        const isValid = 
            orderData.status === 'COMPLETED' && 
            orderData.purchase_units && 
            orderData.purchase_units.length > 0 &&
            orderData.purchase_units[0].amount &&
            parseFloat(orderData.purchase_units[0].amount.value) === 4.99 &&
            orderData.purchase_units[0].amount.currency_code === 'EUR';

        console.log('PayPal Validierung:', {
            status: orderData.status,
            amount: orderData.purchase_units?.[0]?.amount?.value,
            currency: orderData.purchase_units?.[0]?.amount?.currency_code,
            isValid
        });

        return isValid;

    } catch (error) {
        console.error('Fehler bei PayPal-Verifikation:', error);
        return false;
    }
}
