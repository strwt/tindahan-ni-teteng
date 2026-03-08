const testData = {
    taxiRentRecords: [
        {
            id: 1,
            roomName: 'Test Room',
            renterName: 'John Doe',
            date: '2024-01-15',
            period: 'daily',
            rentAmount: 500,
            paidAmount: 0,
            excepted: false,
            exceptNote: '',
            paymentHistory: []
        }
    ]
};

console.log('Testing sync with data:', JSON.stringify(testData, null, 2));

const http = require('http');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function testSync() {
    // First, try to push data
    const postData = JSON.stringify(testData);
    const syncOptions = {
        hostname: 'localhost',
        port: 4000,
        path: '/api/sync',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    try {
        const syncResult = await makeRequest(syncOptions, postData);
        console.log('Sync response:', JSON.stringify(syncResult, null, 2));

        // Then try to pull data back
        const pullOptions = {
            hostname: 'localhost',
            port: 4000,
            path: '/api/collections/taxiRentRecords',
            method: 'GET'
        };

        const pullResult = await makeRequest(pullOptions);
        console.log('Pull response:', JSON.stringify(pullResult, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSync();

