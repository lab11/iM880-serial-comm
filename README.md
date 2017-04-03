iM880 Serial Communications
===========================
**Note**: This is for use with the WiMOD LR Base firmware (has been tested using v1.12) 

This script allows the iM880 to be configured, receive confirmed messages, and 
    send confirmed messages all over a serial port.
- The file `configuration.info` are the selected configuration parameters based
    on our use case.
- Based on the [iM880](http://www.wireless-solutions.de/products/radiomodules/im880b-l.html).

Usage
--------

```javascript
var iM880 = require('iM880');

// call the constructor with a deviceID and deviceGroup
SERIAL_PORT  = '/dev/ttyUSB1'; // serial port to connect to
DEVICE_ID    = 0x04; // in range [0x0000, 0xFFFF)
DEVICE_GROUP = 0x10; // in range [0x00, 0xFF)
SF = 10;  // spreading factor, optional argument, defaults to 10
BANDWIDTH = 125000; // bandwidth, optional argument, defaults to 125000
ERROR_CODING = 4/5; // error coding, optional argument, defaults to 4/5
TX_PWR = 20; // transmit power in dBm, optional argument, defaults to 20
device = new iM880(SERIAL_PORT, DEVICE_ID, DEVICE_GROUP, SF, BANDWIDTH, ERROR_CODING, TX_PWR);

// callback for when constructor done and device configured
device.on('config-done', function(statusmsg) {
    // print the meaning of status byte
    console.log('Config status: ' + statusmsg);
    
    if( statusmsg == 'successful!' ){
        // make a packet and send it
        var msg = new Uint8Array([ 4, 67, 23, 12, 90, 100]);
        DEST_DEVICE_ID    = 0x09; // in range [0x0000, 0xFFFF)
        DEST_DEVICE_GROUP = 0x10; // in range [0x00, 0xFF)
        device.sendConfirmed(DEST_DEVICE_ID, DEST_DEVICE_GROUP, msg);
        var broadcast_msg = new Uint8Array([ 5, 8, 9]);
        device.sendBroadcast(broadcast_msg);
   }
});

// callback for reception of a confirmed message
device.on('rx-msg', function(rxmsg) {
    console.log(rxmsg);
});

// callback for when a transmit message completed and status
device.on('tx-msg-done', function(statusmsg) {
    console.log('Tx-status: ' + statusmsg);
}
```

Example `rx-msg` Packet
----------------------
**Note**: This message would be received by the other iM880 in the example 
        (`DEVICE_ID=0x09`, `DEVICE_GROUP=0x10`)

```
{
    destGroupAddr   : 16,
    destDeviceAddr  : 9,
    srcGroupAddr    : 16,
    srcDeviceAddr   : 4,
    payload         : [4, 67, 23, 12, 90, 100],
    receivedTime    : 2016-10-10T17:38:49.198Z
}
```

- `destGroupAddr`: Group address of destination device (iM880 receiving message).
- `destDeviceAddr`: Device address of destination device (iM880 receiving message).
- `srcGroupAddr`: Group address of source device (iM880 transmitting message).
- `srcDeviceAddr`: Device address of source device (iM880 transmitting message).
- `payload`: Message being sent.
- `receivedTime`: Timestamp message was received at.


Running examples
-------------------
- Notice the files `example/tx-example.js` and `example/rx-example.js`, they can
   be used to quickly test your LoRa system:

1. Run `node rx-example.js` to open an iM880 waiting to receive messages.
2. Run `node tx-example.js` in another terminal to open an iM880 that will 
        transmit messages.
3. After running both your output should be:
    * for `rx-example.js`: 
   
   ```
    Configuration status: successful!
    Received message!!
    {
        //your received message
    }
    ```
   
   * for `tx-example.js`:
   
   ```
    Configuration status: successful!
    Tx-status: successful!
    ```
