const dgram = require('dgram');

const NTP_SERVERS = ['time.stdtime.gov.tw', 'pool.ntp.org', 'time.google.com']; // 可新增更多伺服器
const NTP_PORT = 123;
const NTP_DELTA = 2208988800; // NTP timestamp starts in 1900, Unix in 1970. Difference in seconds.

function createNtpPacket() {
    const buffer = Buffer.alloc(48);
    buffer[0] = 0x1B;  // LI = 0 (no warning), Version = 3, Mode = 3 (client)
    return buffer;
}

function parseNtpResponse(msg) {
    const secondsSince1900 = msg.readUIntBE(40, 4);  // Read the 4 bytes starting at byte 40
    const secondsSince1970 = secondsSince1900 - NTP_DELTA;
    return new Date(secondsSince1970 * 1000);
}

function checkNtpServer(server) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const ntpPacket = createNtpPacket();
        let timeout;

        client.send(ntpPacket, 0, ntpPacket.length, NTP_PORT, server, (err) => {
            if (err) {
                reject(`Failed to send NTP request to ${server}: ${err.message}`);
                client.close();
            }
        });

        client.on('message', (msg) => {
            clearTimeout(timeout); // 清除超時定時器
            const serverTime = parseNtpResponse(msg);
            resolve({ server, time: serverTime });
            client.close();  // 確保只關閉一次
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            reject(`NTP request to ${server} failed: ${err.message}`);
            client.close();
        });

        // 設置一個超時定時器，避免請求卡住
        timeout = setTimeout(() => {
            reject(`NTP request to ${server} timed out.`);
            client.close();  // 確保超時時關閉 socket
        }, 5000);
    });
}

function checkMultipleNtpServers(servers) {
    const promises = servers.map(server => checkNtpServer(server));

    Promise.allSettled(promises).then(results => {
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                console.log(`NTP Server ${result.value.server} is reachable.`);
                console.log(`Server time: ${result.value.time}`);
            } else {
                console.error(result.reason);
            }
        });
    });
}

// 檢查多個 NTP 伺服器
checkMultipleNtpServers(NTP_SERVERS);

