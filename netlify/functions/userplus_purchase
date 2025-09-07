const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    
    try {
        const { userId, paymentToken } = JSON.parse(event.body);
        
        if (!userId) {
            return { statusCode: 400, headers, body: 'Fehlende Benutzer-ID' };
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

        // In a real implementation, you would verify the payment here
        // For now, we'll simulate a successful payment
        // TODO: Implement actual payment processing with Stripe/PayPal/etc.
        
        if (!paymentToken || paymentToken !== 'demo_success') {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Zahlung fehlgeschlagen' }) 
            };
        }

        // Update user to UserPlus
        await sql`
            UPDATE users 
            SET is_user_plus = TRUE 
            WHERE id = ${userId}
        `;

        // Optional: Log the purchase for analytics
        // You might want to create a purchases table for this
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'UserPlus erfolgreich aktiviert!',
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
