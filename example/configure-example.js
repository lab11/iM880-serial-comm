#!/usr/bin/env node

var iM880 = require('../iM880');

// set the endpoint ID
SERIAL_PORT = '/dev/ttyUSB1';
DEVICE_ID = 0x09;
DEVICE_GROUP = 0x10;
SF = 9;
BANDWIDTH = 250000;
ERROR_CODING = 4/6;
TX_PWR = 10;

// call the construction with and endpointID
device = new iM880(SERIAL_PORT, DEVICE_ID, DEVICE_GROUP, SF, BANDWIDTH, ERROR_CODING, TX_PWR);
// wait for config-done message and print endpointID
device.on('config-done', function(statusmsg) {
  // print the ID of the endpoint
  console.log('Configuration status: ' + statusmsg);
});

// listen for new messages and print them
device.on('rx-msg', function(data) {
  // print rx message without slip encoding or checksum
  console.log('Received message!!');
  console.log(data);
});

setTimeout(function() {
    console.log("Changing settings");
    new_spreading_factor = 10;
    new_bandwidth = 125000;
    new_error_coding = 4/5;
    device.configure(DEVICE_ID, DEVICE_GROUP, new_spreading_factor, new_bandwidth, new_error_coding, TX_PWR);
}, 10*1000);
