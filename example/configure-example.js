#!/usr/bin / env node

var iM880 = require('../iM880');

// set the endpoint ID
DEVICE_ID = 0x09;
DEVICE_GROUP = 0x10;
SERIAL_PORT = '/dev/ttyUSB1';
SF = 10;
TX_PWR = 10;
BANDWIDTH = 0;
ERROR_CODING = 1;

// call the construction with and endpointID
device = new iM880(DEVICE_ID, DEVICE_GROUP, SERIAL_PORT, SF, BANDWIDTH, ERROR_CODING, TX_PWR);
// wait for config-done message and print endpointID
var msg = new Uint8Array([ 9, 8, 10, 67 ]);
device.on('config-done', function(statusmsg) {
  // print the ID of the endpoint
  console.log('Configuration status: ' + statusmsg);
  // send a message
  // device.send(0x10, 0x0009, msg);
});

// listen for new messages and print them
device.on('rx-msg', function(data) {
  // print rx message without slip encoding or checksum
  console.log('Received message!!');
  console.log(data);
});

setTimeout(function() {
    console.log("Changing settings");
    device.configure(DEVICE_ID, DEVICE_GROUP, 7,2,1,TX_PWR);
}, 20*1000);